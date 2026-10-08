-- Phase 2 expand. Visit checkout can record one service charge per visit.
-- visit_id stays nullable so the previous per-appointment charges keep working.
-- Do not set visit_id NOT NULL in this file.
-- bill_snapshot is written only by the new visit checkout. Historical rows
-- stay null, so the uniqueness rule does not rewrite or reject old payments.

BEGIN;

ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS visit_id uuid REFERENCES public.visits (id) ON DELETE RESTRICT;

ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS bill_snapshot jsonb;

COMMENT ON COLUMN public.appointment_charges.visit_id IS
  'Canonical parent for a visit grooming payment. appointment_id remains the dog the admin opened, and the only parent for older charges.';

COMMENT ON COLUMN public.appointment_charges.bill_snapshot IS
  'Frozen visit receipt: pets, service amounts, travel, discount, tip, and total at payment time.';

CREATE INDEX IF NOT EXISTS appointment_charges_visit_id_idx
  ON public.appointment_charges (visit_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_charges_one_visit_service_uidx
  ON public.appointment_charges (visit_id)
  WHERE kind = 'service'
    AND status IN ('pending', 'paid')
    AND bill_snapshot IS NOT NULL
    AND NOT (
      status = 'paid'
      AND total > 0
      AND refunded_amount >= total
    );

ALTER TABLE public.appointment_charges
  DROP CONSTRAINT IF EXISTS appointment_charges_tender_check;

ALTER TABLE public.appointment_charges
  ADD CONSTRAINT appointment_charges_tender_check
  CHECK (tender IN ('card', 'cash', 'zelle'));

UPDATE public.appointment_charges AS charge
SET visit_id = appointment.visit_id
FROM public.appointments AS appointment
WHERE charge.appointment_id = appointment.id
  AND charge.visit_id IS NULL
  AND appointment.visit_id IS NOT NULL;

COMMIT;
