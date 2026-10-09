-- Phase 3. One successful customer notification per visit event.
-- Pet-record mail (rabies, medical, missing details) does not use this table.
-- Depends on public.visits (20261006120000_visits.sql). Does not depend on any other notification table.
-- A definite provider rejection deletes the sending row so the next attempt can retry.
-- uncertain means the provider may already have accepted the message. Do not delete or resend that row.
-- A sending row may be reclaimed only when attempted_at is still null and created_at is at least 15 minutes old.
-- There is no weekend fee.

BEGIN;

CREATE TABLE public.visit_notifications (
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  event text NOT NULL,
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'uncertain')),
  sent_at timestamptz,
  attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, event)
);

COMMENT ON TABLE public.visit_notifications IS
  'Customer logistics notices for one visit. The same event is sent at most once after a successful delivery. Multi-dog visits share one row. uncertain rows are not retried.';

COMMENT ON COLUMN public.visit_notifications.event IS
  'booking_confirmation, staff_confirmed, staff_declined, staff_cancelled, reschedule_confirmation:<from date>:<from time>:<to date>:<to time>, confirm_reminder_3_day, customer_reply_c, en_route, checkout_ready, payment_thank_you, next_day_followup, google_review_request, rebook_reminder_21_day. A partial staff cancel uses staff_cancelled:<appointment id>.';

COMMENT ON COLUMN public.visit_notifications.attempted_at IS
  'Set immediately before the provider request. Stale sending rows are reusable only while this is null.';

COMMENT ON COLUMN public.visit_notifications.status IS
  'sending: claim held. sent: provider accepted. uncertain: timeout or ambiguous provider response; do not send again.';

REVOKE ALL ON TABLE public.visit_notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.visit_notifications FROM anon;
REVOKE ALL ON TABLE public.visit_notifications FROM authenticated;
GRANT ALL ON TABLE public.visit_notifications TO service_role;

ALTER TABLE public.visit_notifications ENABLE ROW LEVEL SECURITY;

COMMIT;
