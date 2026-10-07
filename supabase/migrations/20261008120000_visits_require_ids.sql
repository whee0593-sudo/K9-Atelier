-- Contract step. Do not run this in the same deploy as the expand migrations.
-- Run it only after the app that writes appointments.visit_id and
-- appointments.visit_sequence is the only production writer.
-- This file is one PostgreSQL transaction. If it fails, this file rolls
-- back. Earlier committed migrations stay as they are.
-- It does not delete visits or rewrite historical durations.

BEGIN;

WITH missing AS (
  SELECT
    appointment.id AS appointment_id,
    gen_random_uuid() AS visit_id,
    appointment.customer_id,
    appointment.appointment_date,
    appointment.scheduled_start,
    appointment.appointment_time,
    appointment.time_preference,
    appointment.timezone,
    appointment.status,
    appointment.service_ended_at,
    appointment.address_street,
    appointment.address_city,
    appointment.address_state,
    appointment.address_zip,
    appointment.address_lat,
    appointment.address_lon,
    appointment.travel_distance_miles,
    appointment.travel_fee,
    appointment.visit_sequence
  FROM public.appointments AS appointment
  WHERE appointment.visit_id IS NULL
),
inserted AS (
  INSERT INTO public.visits (
    id,
    customer_id,
    service_date,
    scheduled_start,
    appointment_time,
    time_preference,
    timezone,
    status,
    address_street,
    address_city,
    address_state,
    address_zip,
    address_lat,
    address_lon,
    travel_distance_miles,
    travel_fee
  )
  SELECT
    missing.visit_id,
    missing.customer_id,
    missing.appointment_date,
    missing.scheduled_start,
    CASE
      WHEN missing.scheduled_start IS NOT NULL
        THEN public.visit_arrival_label(missing.scheduled_start)
      ELSE missing.appointment_time
    END,
    missing.time_preference,
    COALESCE(missing.timezone, 'America/New_York'),
    CASE
      WHEN missing.status = 'cancelled' THEN 'cancelled'::public.visit_status
      WHEN missing.service_ended_at IS NOT NULL THEN 'completed'::public.visit_status
      WHEN missing.status = 'pending_confirmation'
        THEN 'pending_confirmation'::public.visit_status
      ELSE 'confirmed'::public.visit_status
    END,
    missing.address_street,
    missing.address_city,
    missing.address_state,
    missing.address_zip,
    missing.address_lat,
    missing.address_lon,
    COALESCE(missing.travel_distance_miles, 0),
    COALESCE(missing.travel_fee, 0)
  FROM missing
  RETURNING id
)
UPDATE public.appointments AS appointment
SET
  visit_id = missing.visit_id,
  visit_sequence = COALESCE(appointment.visit_sequence, 1)
FROM missing
JOIN inserted ON inserted.id = missing.visit_id
WHERE appointment.id = missing.appointment_id;

ALTER TABLE public.appointments
  ALTER COLUMN visit_id SET NOT NULL;

ALTER TABLE public.appointments
  ALTER COLUMN visit_sequence SET NOT NULL;

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
