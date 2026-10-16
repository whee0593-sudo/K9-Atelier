-- Merchant visit notices use the existing communication_logs ledger.
-- CREATE TABLE IF NOT EXISTS does not alter columns on a table that already exists.
-- This file does not replace communication_logs_claim.
-- This file does not CREATE OR REPLACE communication_logs_protect_snapshot.
-- This file does not DROP or recreate an existing trigger or policy.
-- A non-null provider_called_at blocks another automatic send.
-- accepted is not delivered. failed and uncertain are not reclaimed.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.communication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  notification_type text NOT NULL,
  audience text NOT NULL DEFAULT 'customer' CHECK (audience IN ('customer', 'staff')),
  customer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  visit_id uuid REFERENCES public.visits (id) ON DELETE SET NULL,
  appointment_ids uuid[] NOT NULL DEFAULT '{}',
  pet_ids uuid[] NOT NULL DEFAULT '{}',
  recipient text NOT NULL,
  subject text,
  body_text text NOT NULL,
  body_html text,
  reply_to text,
  status text NOT NULL CHECK (
    status IN (
      'pending',
      'skipped',
      'accepted',
      'failed',
      'uncertain',
      'delivered',
      'undelivered',
      'bounced'
    )
  ),
  skip_reason text CHECK (
    skip_reason IS NULL
    OR skip_reason IN ('missing_config', 'invalid_recipient')
  ),
  provider text CHECK (provider IS NULL OR provider IN ('resend', 'twilio')),
  provider_message_id text,
  provider_called_at timestamptz,
  error_message text,
  idempotency_key text NOT NULL,
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  failed_at timestamptz,
  delivered_at timestamptz,
  CONSTRAINT communication_logs_idempotency_key_unique UNIQUE (idempotency_key),
  CONSTRAINT communication_logs_body_present CHECK (
    char_length(body_text) > 0 OR body_html IS NOT NULL
  )
);

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS provider_called_at timestamptz;

COMMENT ON COLUMN public.communication_logs.provider_called_at IS
  'Set immediately before the provider is contacted. A non-null value blocks another automatic send. accepted is not delivered. failed and uncertain are not reclaimed.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS uniqueness
    WHERE uniqueness.conrelid = 'public.communication_logs'::regclass
      AND uniqueness.contype = 'u'
      AND pg_get_constraintdef(uniqueness.oid) ILIKE '%idempotency_key%'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_index AS uniqueness
    JOIN pg_class AS table_class ON table_class.oid = uniqueness.indrelid
    JOIN pg_namespace AS table_namespace ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_class.relname = 'communication_logs'
      AND uniqueness.indisunique
      AND pg_get_indexdef(uniqueness.indexrelid) ILIKE '%idempotency_key%'
  ) THEN
    CREATE UNIQUE INDEX communication_logs_idempotency_key_uidx
      ON public.communication_logs (idempotency_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS communication_logs_customer_created_idx
  ON public.communication_logs (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS communication_logs_status_created_idx
  ON public.communication_logs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS communication_logs_visit_id_idx
  ON public.communication_logs (visit_id);

CREATE TABLE IF NOT EXISTS public.communication_log_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  message text NOT NULL,
  log_id uuid REFERENCES public.communication_logs (id) ON DELETE SET NULL,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.communication_log_alerts IS
  'Visible signal when a merchant notice could not be claimed or its outcome could not be saved. The message stores a visit id and channel, not the recipient or body.';

COMMENT ON COLUMN public.communication_log_alerts.idempotency_key IS
  'SHA-256 prefix of the send key. Do not store the raw recipient, message body, confirm link, or payment data.';

CREATE INDEX IF NOT EXISTS communication_log_alerts_created_idx
  ON public.communication_log_alerts (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS communication_log_alerts_code_key_uidx
  ON public.communication_log_alerts (code, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Fresh databases get a snapshot trigger that freezes the message and allows
-- status, skip_reason, and provider_called_at to change. An existing function
-- is left untouched, including its body.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS fn
    JOIN pg_namespace AS ns ON ns.oid = fn.pronamespace
    WHERE ns.nspname = 'private'
      AND fn.proname = 'communication_logs_protect_snapshot'
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION private.communication_logs_protect_snapshot()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = ''
      AS $body$
      BEGIN
        IF NEW.channel IS DISTINCT FROM OLD.channel
          OR NEW.notification_type IS DISTINCT FROM OLD.notification_type
          OR NEW.audience IS DISTINCT FROM OLD.audience
          OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
          OR NEW.visit_id IS DISTINCT FROM OLD.visit_id
          OR NEW.appointment_ids IS DISTINCT FROM OLD.appointment_ids
          OR NEW.pet_ids IS DISTINCT FROM OLD.pet_ids
          OR NEW.recipient IS DISTINCT FROM OLD.recipient
          OR NEW.subject IS DISTINCT FROM OLD.subject
          OR NEW.body_text IS DISTINCT FROM OLD.body_text
          OR NEW.body_html IS DISTINCT FROM OLD.body_html
          OR NEW.reply_to IS DISTINCT FROM OLD.reply_to
          OR NEW.provider IS DISTINCT FROM OLD.provider
          OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
          OR NEW.created_at IS DISTINCT FROM OLD.created_at
        THEN
          RAISE EXCEPTION 'communication log snapshot is immutable'
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $body$;
    $create$;
    REVOKE ALL ON FUNCTION private.communication_logs_protect_snapshot() FROM PUBLIC;
    REVOKE ALL ON FUNCTION private.communication_logs_protect_snapshot() FROM anon;
    REVOKE ALL ON FUNCTION private.communication_logs_protect_snapshot() FROM authenticated;
    GRANT EXECUTE ON FUNCTION private.communication_logs_protect_snapshot() TO service_role;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'communication_logs_protect_snapshot'
      AND tgrelid = 'public.communication_logs'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER communication_logs_protect_snapshot
      BEFORE UPDATE ON public.communication_logs
      FOR EACH ROW
      EXECUTE FUNCTION private.communication_logs_protect_snapshot();
  END IF;
END
$migration$;

GRANT SELECT ON TABLE public.communication_logs TO authenticated;
GRANT ALL ON TABLE public.communication_logs TO service_role;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'communication_logs'
      AND policyname = 'communication_logs_select_staff'
  ) THEN
    CREATE POLICY communication_logs_select_staff
      ON public.communication_logs
      FOR SELECT
      TO authenticated
      USING (private.is_staff());
  END IF;
END
$migration$;

GRANT SELECT ON TABLE public.communication_log_alerts TO authenticated;
GRANT ALL ON TABLE public.communication_log_alerts TO service_role;
ALTER TABLE public.communication_log_alerts ENABLE ROW LEVEL SECURITY;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'communication_log_alerts'
      AND policyname = 'communication_log_alerts_select_staff'
  ) THEN
    CREATE POLICY communication_log_alerts_select_staff
      ON public.communication_log_alerts
      FOR SELECT
      TO authenticated
      USING (private.is_staff());
  END IF;
END
$migration$;

COMMIT;
