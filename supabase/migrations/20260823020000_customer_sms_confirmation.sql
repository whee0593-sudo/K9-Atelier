BEGIN;

-- Customer YES reply to the 3-day confirmation SMS.
-- Separate from staff/vaccine confirmation (status + confirmed_at).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS customer_confirmed_at timestamptz;

COMMENT ON COLUMN public.appointments.customer_confirmed_at IS
  'When the customer replied YES to the 3-day SMS. Not staff/vaccine confirmation.';

COMMIT;
