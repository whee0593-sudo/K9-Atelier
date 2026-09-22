BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;

COMMIT;
