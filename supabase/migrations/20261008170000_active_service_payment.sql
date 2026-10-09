-- Keep one active normal grooming payment per visit and per appointment.
-- A fully refunded row stays paid for history, and it no longer occupies the slot.
-- Cancellation and no-show rows are a different kind, so they are outside this index.
-- Safe to run after 20261008160000. It does not rewrite charge amounts or Stripe ids.

BEGIN;

DROP INDEX IF EXISTS public.appointment_charges_one_visit_service_uidx;

CREATE UNIQUE INDEX appointment_charges_one_visit_service_uidx
  ON public.appointment_charges (visit_id)
  WHERE kind = 'service'
    AND status IN ('pending', 'paid')
    AND bill_snapshot IS NOT NULL
    AND NOT (
      status = 'paid'
      AND total > 0
      AND refunded_amount >= total
    );

DROP INDEX IF EXISTS public.appointment_charges_one_paid_kind_uidx;

CREATE UNIQUE INDEX appointment_charges_one_paid_kind_uidx
  ON public.appointment_charges (appointment_id, kind)
  WHERE status = 'paid'
    AND NOT (
      total > 0
      AND refunded_amount >= total
    );

COMMIT;
