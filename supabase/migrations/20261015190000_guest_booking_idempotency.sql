-- Guest booking idempotency. Not applied to production by this change.
-- One row claims one customer confirmation key.
-- create_guest_booking inserts the visit and the appointment in the same
-- transaction, so a failed appointment insert does not leave a visit behind.
-- Replaying the same key and the same booking contents returns the original
-- appointment. The same key with different contents is rejected.
-- Existing appointment rows are not rewritten. Staff booking does not call this function.
-- Only service_role may execute the function or insert a visit. The browser
-- session cannot bypass the server's measured distance and price check.

BEGIN;

CREATE TABLE public.guest_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  payload_hash text NOT NULL,
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_booking_requests_customer_key_uidx UNIQUE (customer_id, idempotency_key)
);

COMMENT ON TABLE public.guest_booking_requests IS
  'One self-serve confirmation attempt. Staff bookings do not write this table.';

REVOKE ALL ON TABLE public.guest_booking_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.guest_booking_requests FROM anon;
REVOKE ALL ON TABLE public.guest_booking_requests FROM authenticated;

ALTER TABLE public.guest_booking_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_guest_booking(
  p_idempotency_key uuid,
  p_payload_hash text,
  p_visit jsonb,
  p_appointment jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id uuid := NULLIF(p_visit ->> 'customer_id', '')::uuid;
  v_request public.guest_booking_requests%ROWTYPE;
  v_visit_id uuid;
  v_appointment_id uuid;
  v_guard integer := 0;
  v_pet_id uuid;
  v_payment_method_id uuid;
BEGIN
  IF v_customer_id IS NULL
    OR (p_appointment ->> 'customer_id')::uuid IS DISTINCT FROM v_customer_id
  THEN
    RAISE EXCEPTION 'pet_not_found' USING ERRCODE = 'P0001';
  END IF;

  v_pet_id := NULLIF(p_appointment ->> 'pet_id', '')::uuid;
  v_payment_method_id := NULLIF(p_appointment ->> 'payment_method_id', '')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pets AS pet
    WHERE pet.id = v_pet_id
      AND pet.customer_id = v_customer_id
      AND pet.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'pet_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payment_methods AS method
    WHERE method.id = v_payment_method_id
      AND method.customer_id = v_customer_id
  ) THEN
    RAISE EXCEPTION 'payment_required' USING ERRCODE = 'P0001';
  END IF;

  LOOP
    v_guard := v_guard + 1;
    IF v_guard > 3 THEN
      RAISE EXCEPTION 'idempotency_busy' USING ERRCODE = '40001';
    END IF;

    INSERT INTO public.guest_booking_requests (
      customer_id,
      idempotency_key,
      payload_hash
    ) VALUES (
      v_customer_id,
      p_idempotency_key,
      p_payload_hash
    )
    ON CONFLICT (customer_id, idempotency_key) DO NOTHING;

    SELECT request.*
    INTO v_request
    FROM public.guest_booking_requests AS request
    WHERE request.customer_id = v_customer_id
      AND request.idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_request.payload_hash IS DISTINCT FROM p_payload_hash THEN
      RAISE EXCEPTION 'idempotency_mismatch' USING ERRCODE = 'P0001';
    END IF;

    IF v_request.appointment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'created', false,
        'appointment_id', v_request.appointment_id
      );
    END IF;

    EXIT;
  END LOOP;

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
    v_customer_id,
    (p_visit ->> 'service_date')::date,
    (p_visit ->> 'scheduled_start')::integer,
    NULLIF(p_visit ->> 'appointment_time', ''),
    NULLIF(p_visit ->> 'time_preference', ''),
    COALESCE(NULLIF(p_visit ->> 'timezone', ''), 'America/New_York'),
    COALESCE(NULLIF(p_visit ->> 'status', '')::public.visit_status, 'confirmed'),
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
    staff_created
  ) VALUES (
    v_customer_id,
    v_visit_id,
    COALESCE(NULLIF(p_appointment ->> 'visit_sequence', '')::integer, 1),
    v_pet_id,
    p_appointment ->> 'service_id',
    p_appointment ->> 'service_name',
    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(p_appointment -> 'add_on_ids') = 'array'
              THEN p_appointment -> 'add_on_ids'
            ELSE '[]'::jsonb
          END
        )
      ),
      ARRAY[]::text[]
    ),
    COALESCE(p_appointment -> 'add_on_options', '{}'::jsonb),
    p_appointment ->> 'address_street',
    p_appointment ->> 'address_city',
    p_appointment ->> 'address_state',
    p_appointment ->> 'address_zip',
    COALESCE(NULLIF(p_appointment ->> 'travel_distance_miles', '')::numeric, 0),
    COALESCE(NULLIF(p_appointment ->> 'travel_fee', '')::numeric, 0),
    NULLIF(p_appointment ->> 'service_price', '')::numeric,
    NULLIF(p_appointment ->> 'estimated_duration_minutes', '')::integer,
    (p_appointment ->> 'appointment_date')::date,
    NULLIF(p_appointment ->> 'appointment_time', ''),
    (p_appointment ->> 'scheduled_start')::integer,
    NULLIF(p_appointment ->> 'time_preference', ''),
    NULLIF(p_appointment ->> 'address_lat', '')::double precision,
    NULLIF(p_appointment ->> 'address_lon', '')::double precision,
    COALESCE(NULLIF(p_appointment ->> 'timezone', ''), 'America/New_York'),
    NULLIF(p_appointment ->> 'estimated_total', '')::numeric,
    COALESCE(NULLIF(p_appointment ->> 'new_client_deposit', '')::numeric, 0),
    v_payment_method_id,
    NULLIF(p_appointment ->> 'vaccination_status_at_booking', ''),
    COALESCE(
      NULLIF(p_appointment ->> 'status', '')::public.appointment_status,
      'confirmed'
    ),
    COALESCE(NULLIF(p_appointment ->> 'confirmed_at', '')::timestamptz, now()),
    false
  )
  RETURNING id INTO v_appointment_id;

  UPDATE public.guest_booking_requests
  SET appointment_id = v_appointment_id
  WHERE id = v_request.id;

  RETURN jsonb_build_object(
    'created', true,
    'appointment_id', v_appointment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) TO service_role;

-- Self-serve inserts go through create_guest_booking. A signed-in browser
-- session can no longer write visits or appointments directly. Staff booking
-- keeps its own service-role function and does not use these policies.
REVOKE INSERT ON TABLE public.visits FROM authenticated;
REVOKE INSERT ON TABLE public.appointments FROM authenticated;
DROP POLICY IF EXISTS visits_insert_own ON public.visits;
DROP POLICY IF EXISTS appointments_insert_own ON public.appointments;

COMMIT;
