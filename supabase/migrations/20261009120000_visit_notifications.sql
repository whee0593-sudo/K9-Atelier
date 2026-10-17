-- Order 1 of 4 notification migrations.
-- Depends on public.visits (20261006120000_visits.sql).
-- Does not depend on communication_logs.
-- Application senders do not write this table. Customer and merchant notices
-- use communication_logs plus the application decideClaim rule, so this ledger
-- cannot send a second copy.
-- Idempotent: CREATE TABLE IF NOT EXISTS. Do not execute against production
-- from the integration branch.

BEGIN;

CREATE TABLE IF NOT EXISTS public.visit_notifications (
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  event text NOT NULL,
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'uncertain')),
  sent_at timestamptz,
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, event)
);

COMMENT ON TABLE public.visit_notifications IS
  'Unused by the unified sender. Retained so an older visit-notification migration can be applied idempotently. Do not write a send here and also in communication_logs.';

COMMENT ON COLUMN public.visit_notifications.attempted_at IS
  'Set immediately before a provider request by the retired visit ledger. The unified sender does not use this column.';

COMMENT ON COLUMN public.visit_notifications.status IS
  'sending: claim held. sent: provider accepted. uncertain: ambiguous provider response; do not send again.';

REVOKE ALL ON TABLE public.visit_notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.visit_notifications FROM anon;
REVOKE ALL ON TABLE public.visit_notifications FROM authenticated;
GRANT ALL ON TABLE public.visit_notifications TO service_role;

ALTER TABLE public.visit_notifications ENABLE ROW LEVEL SECURITY;

COMMIT;
