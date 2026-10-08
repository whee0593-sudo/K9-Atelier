-- Phase 1 hardening.
-- Visit arrival time has one source of truth: visits.scheduled_start.
-- visits.appointment_time is the display label derived from that minute.
-- Deleting a visit cannot delete its appointments.
-- Staff multi-pet create and visit reschedule each run as one transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.visit_arrival_label(p_minutes integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_minutes IS NULL THEN NULL::text
    ELSE
      (CASE
        WHEN (p_minutes / 60) % 12 = 0 THEN 12
        ELSE (p_minutes / 60) % 12
      END)::text
      || ':'
      || pg_catalog.lpad((pg_catalog.mod(p_minutes, 60))::text, 2, '0')
      || CASE WHEN (p_minutes / 60) >= 12 THEN ' PM' ELSE ' AM' END
  END;
$$;

REVOKE ALL ON FUNCTION public.visit_arrival_label(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visit_arrival_label(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.sync_visit_from_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_visit uuid;
  v_active integer;
  v_pending integer;
  v_open integer;
  v_status public.visit_status;
  v_start integer;
  v_pref text;
  v_date date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_visit := NEW.visit_id;
  ELSE
    v_visit := COALESCE(NEW.visit_id, OLD.visit_id);
  END IF;
  IF v_visit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE status <> 'cancelled'),
    count(*) FILTER (WHERE status = 'pending_confirmation'),
    count(*) FILTER (WHERE status <> 'cancelled' AND service_ended_at IS NULL)
  INTO v_active, v_pending, v_open
  FROM public.appointments
  WHERE visit_id = v_visit;

  IF v_active = 0 THEN
    v_status := 'cancelled';
  ELSIF v_open = 0 THEN
    v_status := 'completed';
  ELSIF v_pending = v_active THEN
    v_status := 'pending_confirmation';
  ELSE
    v_status := 'confirmed';
  END IF;

  SELECT scheduled_start, time_preference, appointment_date
  INTO v_start, v_pref, v_date
  FROM public.appointments
  WHERE visit_id = v_visit
    AND status <> 'cancelled'
  ORDER BY scheduled_start NULLS LAST, created_at
  LIMIT 1;

  UPDATE public.visits
  SET status = v_status,
      scheduled_start = COALESCE(v_start, scheduled_start),
      appointment_time = CASE
        WHEN v_start IS NOT NULL THEN public.visit_arrival_label(v_start)
        ELSE appointment_time
      END,
      time_preference = COALESCE(v_pref, time_preference),
      service_date = COALESCE(v_date, service_date)
  WHERE id = v_visit;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_visit_from_appointments() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_visit_from_appointments() FROM anon;
REVOKE ALL ON FUNCTION private.sync_visit_from_appointments() FROM authenticated;

UPDATE public.visits
SET appointment_time = public.visit_arrival_label(scheduled_start)
WHERE scheduled_start IS NOT NULL
  AND appointment_time IS DISTINCT FROM public.visit_arrival_label(scheduled_start);

ALTER TABLE public.visits
  DROP CONSTRAINT IF EXISTS visits_appointment_time_matches_start;

ALTER TABLE public.visits
  ADD CONSTRAINT visits_appointment_time_matches_start
  CHECK (
    scheduled_start IS NULL
    OR appointment_time = public.visit_arrival_label(scheduled_start)
  );

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_visit_id_fkey;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_visit_id_fkey
  FOREIGN KEY (visit_id) REFERENCES public.visits (id) ON DELETE RESTRICT;

-- One transaction: the visit and every pet appointment commit together.
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
    INSERT INTO public.appointments (
      customer_id,
      visit_id,
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

-- One transaction: clear and rewrite every child start, then the visit arrival.
-- A failure rolls the clear back with the writes.
CREATE OR REPLACE FUNCTION public.replace_visit_schedule(
  p_visit_id uuid,
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
  v_label text;
BEGIN
  IF jsonb_typeof(p_children) <> 'array'
    OR jsonb_array_length(p_children) < 1
  THEN
    RAISE EXCEPTION 'visit schedule requires pets' USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT count(*)
    FROM jsonb_array_elements(p_children)
  ) <> (
    SELECT count(DISTINCT value ->> 'id')
    FROM jsonb_array_elements(p_children)
  ) THEN
    RAISE EXCEPTION 'duplicate appointment in visit schedule' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_children) AS child(value)
    WHERE (child.value ->> 'scheduled_start') IS NULL
  ) THEN
    RAISE EXCEPTION 'every pet needs a start' USING ERRCODE = '23514';
  END IF;

  IF (
    SELECT min((value ->> 'scheduled_start')::integer)
    FROM jsonb_array_elements(p_children)
  ) IS DISTINCT FROM p_visit_start THEN
    RAISE EXCEPTION 'visit arrival must be the first pet start' USING ERRCODE = '23514';
  END IF;

  PERFORM 1
  FROM public.visits
  WHERE id = p_visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'visit not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_children) AS child(value)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.appointments AS appointment
      WHERE appointment.id = (child.value ->> 'id')::uuid
        AND appointment.visit_id = p_visit_id
    )
  ) THEN
    RAISE EXCEPTION 'appointment is not on this visit' USING ERRCODE = '23514';
  END IF;

  v_label := public.visit_arrival_label(p_visit_start);

  UPDATE public.appointments
  SET scheduled_start = NULL
  WHERE visit_id = p_visit_id
    AND id IN (
      SELECT (value ->> 'id')::uuid
      FROM jsonb_array_elements(p_children)
    );

  UPDATE public.appointments AS appointment
  SET
    appointment_date = COALESCE(p_service_date, appointment.appointment_date),
    scheduled_start = child.scheduled_start,
    estimated_duration_minutes = COALESCE(
      child.duration_minutes,
      appointment.estimated_duration_minutes
    ),
    appointment_time = COALESCE(child.appointment_time, v_label),
    time_preference = COALESCE(child.time_preference, NULLIF(p_time_preference, ''))
  FROM (
    SELECT
      (value ->> 'id')::uuid AS id,
      (value ->> 'scheduled_start')::integer AS scheduled_start,
      NULLIF(value ->> 'estimated_duration_minutes', '')::integer AS duration_minutes,
      NULLIF(value ->> 'appointment_time', '') AS appointment_time,
      NULLIF(value ->> 'time_preference', '') AS time_preference
    FROM jsonb_array_elements(p_children)
  ) AS child
  WHERE appointment.id = child.id
    AND appointment.visit_id = p_visit_id;

  UPDATE public.visits
  SET
    service_date = COALESCE(p_service_date, service_date),
    scheduled_start = p_visit_start,
    appointment_time = v_label,
    time_preference = COALESCE(NULLIF(p_time_preference, ''), time_preference)
  WHERE id = p_visit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_visit_schedule(uuid, date, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_visit_schedule(uuid, date, integer, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_visit_schedule(uuid, date, integer, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_visit_schedule(uuid, date, integer, text, jsonb) TO service_role;

COMMIT;
