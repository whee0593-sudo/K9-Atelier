-- Order 3 of 4 notification migrations.
-- Depends on public.visit_notifications from 20261009120000.
-- Does not depend on communication_logs.
-- Safe to run when 20261009120000 already created attempted_at.
-- Do not execute against production from the integration branch.

BEGIN;

ALTER TABLE public.visit_notifications
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz;

ALTER TABLE public.visit_notifications
  DROP CONSTRAINT IF EXISTS visit_notifications_status_check;

ALTER TABLE public.visit_notifications
  ADD CONSTRAINT visit_notifications_status_check
  CHECK (status IN ('sending', 'sent', 'uncertain'));

COMMENT ON COLUMN public.visit_notifications.attempted_at IS
  'Set immediately before a provider request by the retired visit ledger. The unified sender does not use this column.';

COMMENT ON COLUMN public.visit_notifications.status IS
  'sending: claim held. sent: provider accepted. uncertain: ambiguous provider response; do not send again.';

COMMIT;
