-- Compatibility for databases that already applied the first visit_notifications migration
-- before attempted_at and the uncertain status existed.
-- Fresh installs create those in 20261009120000; these statements stay idempotent.
-- Depends on public.visit_notifications. There is no communication_logs table.

BEGIN;

ALTER TABLE public.visit_notifications
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz;

ALTER TABLE public.visit_notifications
  DROP CONSTRAINT IF EXISTS visit_notifications_status_check;

ALTER TABLE public.visit_notifications
  ADD CONSTRAINT visit_notifications_status_check
  CHECK (status IN ('sending', 'sent', 'uncertain'));

COMMENT ON COLUMN public.visit_notifications.attempted_at IS
  'Set immediately before the provider request. Stale sending rows are reusable only while this is null.';

COMMENT ON COLUMN public.visit_notifications.status IS
  'sending: claim held. sent: provider accepted. uncertain: timeout or ambiguous provider response; do not send again.';

COMMIT;
