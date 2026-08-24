ALTER TABLE public.appointment_charges
  DROP CONSTRAINT IF EXISTS appointment_charges_kind_check;

ALTER TABLE public.appointment_charges
  ADD CONSTRAINT appointment_charges_kind_check
  CHECK (kind IN ('service', 'no_show', 'cancellation'));
