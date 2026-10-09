-- Phase 3. One successful customer notification per visit event.
-- Pet-record mail (rabies, medical, missing details) does not use this table.
-- A failed send deletes the sending row so the next attempt can retry.
-- There is no weekend fee.

BEGIN;

CREATE TABLE public.visit_notifications (
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  event text NOT NULL,
  status text NOT NULL CHECK (status IN ('sending', 'sent')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, event)
);

COMMENT ON TABLE public.visit_notifications IS
  'Customer logistics notices for one visit. The same event is sent at most once after a successful delivery. Multi-dog visits share one row.';

COMMENT ON COLUMN public.visit_notifications.event IS
  'booking_confirmation, staff_confirmed, staff_declined, staff_cancelled, reschedule_confirmation:<date>:<time>, confirm_reminder_3_day, customer_reply_c, en_route, checkout_ready, payment_thank_you, next_day_followup, google_review_request, rebook_reminder_21_day. A partial staff cancel uses staff_cancelled:<appointment id>.';

REVOKE ALL ON TABLE public.visit_notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.visit_notifications FROM anon;
REVOKE ALL ON TABLE public.visit_notifications FROM authenticated;
GRANT ALL ON TABLE public.visit_notifications TO service_role;

ALTER TABLE public.visit_notifications ENABLE ROW LEVEL SECURITY;

COMMIT;
