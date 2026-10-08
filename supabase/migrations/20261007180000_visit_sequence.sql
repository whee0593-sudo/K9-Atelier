-- Expand step. Do not set visit_id or visit_sequence NOT NULL here.
-- Run this while the previous app may still insert appointments.
-- Historical pet order is backfilled once from scheduled_start ASC NULLS LAST, id ASC.
-- That id tie-break is only for this backfill. Live scheduling must use visit_sequence.
-- This file does not write estimated_duration_minutes. Unknown history stays NULL.
-- The whole file is one transaction. A failure rolls this file back.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN visit_sequence integer;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_visit_sequence_positive
  CHECK (visit_sequence IS NULL OR visit_sequence >= 1);

COMMENT ON COLUMN public.appointments.visit_sequence IS
  'Stable pet order inside one visit. Cancel keeps the number. Gaps are allowed. Live code must not order pets by scheduled_start, created_at, or id. Historical backfill used scheduled_start ASC NULLS LAST, then appointment id ASC when the start was equal or NULL.';

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY visit_id
      ORDER BY scheduled_start ASC NULLS LAST, id ASC
    ) AS seq
  FROM public.appointments
  WHERE visit_id IS NOT NULL
)
UPDATE public.appointments AS appointment
SET visit_sequence = ranked.seq
FROM ranked
WHERE appointment.id = ranked.id
  AND appointment.visit_sequence IS NULL;

CREATE UNIQUE INDEX appointments_visit_sequence_uidx
  ON public.appointments (visit_id, visit_sequence)
  WHERE visit_sequence IS NOT NULL;

CREATE OR REPLACE FUNCTION private.assign_visit_sequence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.visit_id IS NULL OR NEW.visit_sequence IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(appointment.visit_sequence), 0) + 1
  INTO NEW.visit_sequence
  FROM public.appointments AS appointment
  WHERE appointment.visit_id = NEW.visit_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_assign_visit_sequence ON public.appointments;
CREATE TRIGGER appointments_assign_visit_sequence
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION private.assign_visit_sequence();

CREATE OR REPLACE FUNCTION public.create_staff_visit(
  p_visit jsonb,
  p_appointments jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_visit_id uuid;
  v_item jsonb;
  v_start integer;
  v_label text;
  v_count integer := 0;
  v_sequence integer;
BEGIN
  IF jsonb_typeof(p_appointments) <> 'array'
    OR jsonb_array_length(p_appointments) < 1
  THEN
    RAISE EXCEPTION 'visit requires appointments' USING ERRCODE = '23514';
  END IF;

  v_start := (p_visit ->> 'scheduled_start')::integer;
  v_label := public.visit_arrival_label(v_start);

  INSERT INTO public.visits (
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
  ) VALUES (
    (p_visit ->> 'customer_id')::uuid,
    (p_visit ->> 'service_date')::date,
    v_start,
    v_label,
    NULLIF(p_visit ->> 'time_preference', ''),
    COALESCE(NULLIF(p_visit ->> 'timezone', ''), 'America/New_York'),
    COALESCE(NULLIF(p_visit ->> 'status', '')::public.visit_status, 'pending_confirmation'),
    p_visit ->> 'address_street',
    p_visit ->> 'address_city',
    p_visit ->> 'address_state',
    p_visit ->> 'address_zip',
    NULLIF(p_visit ->> 'address_lat', '')::double precision,
    NULLIF(p_visit ->> 'address_lon', '')::double precision,
    COALESCE(NULLIF(p_visit ->> 'travel_distance_miles', '')::numeric, 0),
    COALESCE(NULLIF(p_visit ->> 'travel_fee', '')::numeric, 0)
  )
  RETURNING id INTO v_visit_id;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_appointments) AS element(value)
  LOOP
    v_sequence := COALESCE(
      NULLIF(v_item ->> 'visit_sequence', '')::integer,
      v_count + 1
    );

    INSERT INTO public.appointments (
      customer_id,
      visit_id,
      visit_sequence,
      pet_id,
      service_id,
      service_name,
      add_on_ids,
      add_on_options,
      address_street,
      address_city,
      address_state,
      address_zip,
      travel_distance_miles,
      travel_fee,
      service_price,
      estimated_duration_minutes,
      appointment_date,
      appointment_time,
      scheduled_start,
      time_preference,
      address_lat,
      address_lon,
      timezone,
      estimated_total,
      new_client_deposit,
      payment_method_id,
      vaccination_status_at_booking,
      status,
      confirmed_at,
      staff_created,
      customer_confirm_token_hash,
      customer_confirm_expires_at
    ) VALUES (
      (v_item ->> 'customer_id')::uuid,
      v_visit_id,
      v_sequence,
      (v_item ->> 'pet_id')::uuid,
      v_item ->> 'service_id',
      v_item ->> 'service_name',
      COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(v_item -> 'add_on_ids') = 'array' THEN v_item -> 'add_on_ids'
              ELSE '[]'::jsonb
            END
          )
        ),
        ARRAY[]::text[]
      ),
      COALESCE(v_item -> 'add_on_options', '{}'::jsonb),
      v_item ->> 'address_street',
      v_item ->> 'address_city',
      v_item ->> 'address_state',
      v_item ->> 'address_zip',
      COALESCE(NULLIF(v_item ->> 'travel_distance_miles', '')::numeric, 0),
      COALESCE(NULLIF(v_item ->> 'travel_fee', '')::numeric, 0),
      NULLIF(v_item ->> 'service_price', '')::numeric,
      NULLIF(v_item ->> 'estimated_duration_minutes', '')::integer,
      (v_item ->> 'appointment_date')::date,
      COALESCE(NULLIF(v_item ->> 'appointment_time', ''), v_label),
      (v_item ->> 'scheduled_start')::integer,
      NULLIF(v_item ->> 'time_preference', ''),
      NULLIF(v_item ->> 'address_lat', '')::double precision,
      NULLIF(v_item ->> 'address_lon', '')::double precision,
      COALESCE(NULLIF(v_item ->> 'timezone', ''), 'America/New_York'),
      NULLIF(v_item ->> 'estimated_total', '')::numeric,
      COALESCE(NULLIF(v_item ->> 'new_client_deposit', '')::numeric, 0),
      NULLIF(v_item ->> 'payment_method_id', '')::uuid,
      NULLIF(v_item ->> 'vaccination_status_at_booking', ''),
      (v_item ->> 'status')::public.appointment_status,
      NULLIF(v_item ->> 'confirmed_at', '')::timestamptz,
      COALESCE((v_item ->> 'staff_created')::boolean, false),
      NULLIF(v_item ->> 'customer_confirm_token_hash', ''),
      NULLIF(v_item ->> 'customer_confirm_expires_at', '')::timestamptz
    );
    v_count := v_count + 1;
  END LOOP;

  IF v_count <> jsonb_array_length(p_appointments) THEN
    RAISE EXCEPTION 'visit appointment count mismatch' USING ERRCODE = '23514';
  END IF;

  RETURN v_visit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_visit(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_staff_visit(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_staff_visit(jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_visit(jsonb, jsonb) TO service_role;

-- Service fields, travel mirror, and the full child chain commit together.
-- p_children NULL updates the service only and leaves duration and starts alone.
CREATE OR REPLACE FUNCTION public.apply_visit_service_change(
  p_appointment_id uuid,
  p_visit_id uuid,
  p_service jsonb,
  p_service_date date,
  p_visit_start integer,
  p_time_preference text,
  p_children jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fee numeric;
BEGIN
  PERFORM 1
  FROM public.visits
  WHERE id = p_visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'visit not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_children IS NULL THEN
    UPDATE public.appointments
    SET
      service_id = COALESCE(NULLIF(p_service ->> 'service_id', ''), service_id),
      service_name = COALESCE(NULLIF(p_service ->> 'service_name', ''), service_name),
      add_on_ids = COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(p_service -> 'add_on_ids') = 'array' THEN p_service -> 'add_on_ids'
              ELSE '[]'::jsonb
            END
          )
        ),
        ARRAY[]::text[]
      ),
      add_on_options = COALESCE(p_service -> 'add_on_options', add_on_options),
      estimated_total = COALESCE(
        NULLIF(p_service ->> 'estimated_total', '')::numeric,
        estimated_total
      )
    WHERE id = p_appointment_id
      AND visit_id = p_visit_id;
  ELSE
    UPDATE public.appointments
    SET
      service_id = COALESCE(NULLIF(p_service ->> 'service_id', ''), service_id),
      service_name = COALESCE(NULLIF(p_service ->> 'service_name', ''), service_name),
      add_on_ids = COALESCE(
        ARRAY(
          SELECT jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(p_service -> 'add_on_ids') = 'array' THEN p_service -> 'add_on_ids'
              ELSE '[]'::jsonb
            END
          )
        ),
        ARRAY[]::text[]
      ),
      add_on_options = COALESCE(p_service -> 'add_on_options', add_on_options),
      estimated_total = COALESCE(
        NULLIF(p_service ->> 'estimated_total', '')::numeric,
        estimated_total
      ),
      estimated_duration_minutes = NULLIF(p_service ->> 'estimated_duration_minutes', '')::integer
    WHERE id = p_appointment_id
      AND visit_id = p_visit_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment is not on this visit' USING ERRCODE = '23514';
  END IF;

  UPDATE public.visits
  SET travel_fee = COALESCE(NULLIF(p_service ->> 'travel_fee', '')::numeric, travel_fee)
  WHERE id = p_visit_id
  RETURNING travel_fee INTO v_fee;

  UPDATE public.appointments
  SET travel_fee = 0
  WHERE visit_id = p_visit_id;

  UPDATE public.appointments
  SET travel_fee = COALESCE(v_fee, 0)
  WHERE id = (
    SELECT appointment.id
    FROM public.appointments AS appointment
    WHERE appointment.visit_id = p_visit_id
      AND appointment.status IS DISTINCT FROM 'cancelled'
    ORDER BY appointment.visit_sequence ASC NULLS LAST
    LIMIT 1
  );

  IF p_children IS NOT NULL THEN
    PERFORM public.replace_visit_schedule(
      p_visit_id,
      p_service_date,
      p_visit_start,
      p_time_preference,
      p_children
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_visit_service_change(uuid, uuid, jsonb, date, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_visit_service_change(uuid, uuid, jsonb, date, integer, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.apply_visit_service_change(uuid, uuid, jsonb, date, integer, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_visit_service_change(uuid, uuid, jsonb, date, integer, text, jsonb) TO service_role;

-- Databases that already applied an earlier draft of visits.sql still have
-- the strict insert policy. Keep NULL visit_id legal until the contract step.
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
    AND (
      visit_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.visits v
        WHERE v.id = visit_id
          AND v.customer_id = (SELECT auth.uid())
      )
    )
  );

COMMIT;
