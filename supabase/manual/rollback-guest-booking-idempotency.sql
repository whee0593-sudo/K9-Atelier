-- Roll back 20261015190000_guest_booking_idempotency.sql.
-- Does not delete or alter visits, appointments, or staff bookings.
-- Restores the customer insert policies this migration removed.
-- Run only when no application release still calls create_guest_booking.

BEGIN;

DROP FUNCTION IF EXISTS public.create_guest_booking(uuid, text, jsonb, jsonb);
DROP TABLE IF EXISTS public.guest_booking_requests;

GRANT INSERT ON TABLE public.visits TO authenticated;
DROP POLICY IF EXISTS visits_insert_own ON public.visits;
CREATE POLICY visits_insert_own
  ON public.visits
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));

GRANT INSERT ON TABLE public.appointments TO authenticated;
DROP POLICY IF EXISTS appointments_insert_own ON public.appointments;
CREATE POLICY appointments_insert_own
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = pet_id
        AND p.customer_id = (SELECT auth.uid())
        AND p.archived_at IS NULL
    )
    AND EXISTS (
      SELECT 1
      FROM public.visits v
      WHERE v.id = visit_id
        AND v.customer_id = (SELECT auth.uid())
    )
  );

COMMIT;
