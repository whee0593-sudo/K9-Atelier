-- One 21-day rebooking reminder per completed visit.
-- Run in Supabase SQL Editor after review.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS rebook_reminder_status text,
  ADD COLUMN IF NOT EXISTS rebook_reminder_sent_at timestamptz;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_rebook_reminder_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_rebook_reminder_status_check
  CHECK (
    (
      rebook_reminder_status IS NULL
      AND rebook_reminder_sent_at IS NULL
    )
    OR (
      rebook_reminder_status = 'sending'
      AND rebook_reminder_sent_at IS NULL
    )
    OR (
      rebook_reminder_status = 'skipped'
      AND rebook_reminder_sent_at IS NULL
    )
    OR (
      rebook_reminder_status = 'sent'
      AND rebook_reminder_sent_at IS NOT NULL
    )
  );

COMMENT ON COLUMN public.appointments.rebook_reminder_status IS
  '21-day rebooking reminder: sending while the email is in progress, sent after delivery, or skipped when the client already has a future appointment.';

COMMENT ON COLUMN public.appointments.rebook_reminder_sent_at IS
  'Timestamp of the 21-day rebooking reminder email. Set only when rebook_reminder_status is sent.';

CREATE INDEX IF NOT EXISTS appointments_rebook_reminder_due_idx
  ON public.appointments (service_ended_at)
  WHERE rebook_reminder_status IS NULL AND service_ended_at IS NOT NULL;

COMMIT;
