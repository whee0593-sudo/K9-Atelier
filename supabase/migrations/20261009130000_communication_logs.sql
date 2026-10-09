-- Immutable communication snapshots for automatic email and SMS.
-- Status, provider id, and error fields may change after insert.
-- Subject, body, recipient, and relation ids may not.
-- body_html is untrusted text. Do not assign it to innerHTML.
-- Confirm links may remain in the snapshot. Access is staff-only.

BEGIN;

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

COMMENT ON TABLE public.communication_logs IS
  'Immutable snapshot of an outbound email or SMS, written before the provider call. Customers cannot read this table.';

COMMENT ON COLUMN public.communication_logs.body_text IS
  'Plain-text snapshot handed to the provider after credential redaction. Later template edits must not change this value.';

COMMENT ON COLUMN public.communication_logs.body_html IS
  'Untrusted HTML snapshot. Store and display it as text. Do not inject it into a page with innerHTML or dangerouslySetInnerHTML.';

COMMENT ON COLUMN public.communication_logs.provider_message_id IS
  'Resend email id or Twilio message SID. Reserved for a later delivery webhook.';

COMMENT ON COLUMN public.communication_logs.idempotency_key IS
  'One logical send. A second worker that finds accepted or in-flight must not send again.';

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
  'Staff-visible signal when a communication snapshot or status update cannot be saved. If the database itself is down, this row cannot be written either.';

CREATE INDEX IF NOT EXISTS communication_log_alerts_created_idx
  ON public.communication_log_alerts (created_at DESC);

CREATE OR REPLACE FUNCTION private.communication_logs_protect_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
$$;

REVOKE ALL ON FUNCTION private.communication_logs_protect_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.communication_logs_protect_snapshot() FROM anon;
REVOKE ALL ON FUNCTION private.communication_logs_protect_snapshot() FROM authenticated;
GRANT EXECUTE ON FUNCTION private.communication_logs_protect_snapshot() TO service_role;

DROP TRIGGER IF EXISTS communication_logs_protect_snapshot ON public.communication_logs;
CREATE TRIGGER communication_logs_protect_snapshot
  BEFORE UPDATE ON public.communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION private.communication_logs_protect_snapshot();

REVOKE ALL ON TABLE public.communication_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.communication_logs FROM anon;
REVOKE ALL ON TABLE public.communication_logs FROM authenticated;
GRANT SELECT ON TABLE public.communication_logs TO authenticated;
GRANT ALL ON TABLE public.communication_logs TO service_role;

ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_logs_select_staff ON public.communication_logs;
CREATE POLICY communication_logs_select_staff
  ON public.communication_logs
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

REVOKE ALL ON TABLE public.communication_log_alerts FROM PUBLIC;
REVOKE ALL ON TABLE public.communication_log_alerts FROM anon;
REVOKE ALL ON TABLE public.communication_log_alerts FROM authenticated;
GRANT SELECT ON TABLE public.communication_log_alerts TO authenticated;
GRANT ALL ON TABLE public.communication_log_alerts TO service_role;

ALTER TABLE public.communication_log_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_log_alerts_select_staff ON public.communication_log_alerts;
CREATE POLICY communication_log_alerts_select_staff
  ON public.communication_log_alerts
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

COMMIT;
