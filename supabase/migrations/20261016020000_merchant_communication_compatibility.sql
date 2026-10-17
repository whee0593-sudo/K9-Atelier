-- Order 4 of 4 notification migrations.
-- Depends on 20261009130000_communication_logs.sql.
-- Does not replace communication_logs_claim.
-- Does not CREATE OR REPLACE communication_logs_protect_snapshot.
-- Does not drop an existing trigger or policy.
-- Does not add a second claim rule. Application code uses decideClaim.
-- A failed status may be retried. uncertain, pending, and accepted may not.
-- Do not execute against production from the integration branch.

BEGIN;

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS provider_called_at timestamptz;

COMMENT ON COLUMN public.communication_logs.provider_called_at IS
  'Optional timestamp. Not a second claim rule. decideClaim retries failed rows and holds uncertain or pending rows.';

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

CREATE INDEX IF NOT EXISTS communication_log_alerts_created_idx
  ON public.communication_log_alerts (created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS communication_log_alerts_code_key_uidx
  ON public.communication_log_alerts (code, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
