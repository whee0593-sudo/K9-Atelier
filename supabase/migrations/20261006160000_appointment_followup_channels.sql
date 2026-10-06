-- Channel-level next-day review follow-up state.
-- followup_sent_at remains for rows already contacted before this change.
-- A historical followup_sent_at is copied onto both channels so those
-- households are not asked for another review when this migration lands.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS followup_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_sms_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_sms_claimed_at timestamptz;

COMMENT ON COLUMN public.appointments.followup_email_sent_at IS
  'When the household next-day review email was accepted by the mailer. Null means that channel can still be retried.';

COMMENT ON COLUMN public.appointments.followup_sms_sent_at IS
  'When the household next-day review SMS was accepted by Twilio. Null means that channel can still be retried.';

COMMENT ON COLUMN public.appointments.followup_email_claimed_at IS
  'Short lease taken before sending the review email so overlapping cron runs cannot both send.';

COMMENT ON COLUMN public.appointments.followup_sms_claimed_at IS
  'Short lease taken before sending the review SMS so overlapping cron runs cannot both send.';

UPDATE public.appointments
SET
  followup_email_sent_at = COALESCE(followup_email_sent_at, followup_sent_at),
  followup_sms_sent_at = COALESCE(followup_sms_sent_at, followup_sent_at)
WHERE followup_sent_at IS NOT NULL
  AND (followup_email_sent_at IS NULL OR followup_sms_sent_at IS NULL);

CREATE INDEX IF NOT EXISTS appointments_followup_due_idx
  ON public.appointments (appointment_date)
  WHERE service_ended_at IS NOT NULL
    AND (followup_email_sent_at IS NULL OR followup_sms_sent_at IS NULL);

COMMIT;
