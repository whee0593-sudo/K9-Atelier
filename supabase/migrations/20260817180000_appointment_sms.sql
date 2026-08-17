BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS en_route_sms_sent_at timestamptz;

COMMIT;
