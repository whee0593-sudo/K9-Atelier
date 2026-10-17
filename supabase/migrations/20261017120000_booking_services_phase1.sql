-- Booking services phase 1.
-- 尚未对生产执行。部署前由审核人单独批准后再跑。
-- 不删除预约、付款或客户行。appointments.id 仍是原来的 uuid 主键。
-- 本文件只加列、约束和兼容旧请求的函数。旧网站在这些列有默认值之后仍可预约。
-- 不在这里改历史 service_id。旧 Production 代码不认识 show-level-coat-care。
-- 标识更新在 20261017121000_show_level_service_id.sql，必须等新代码上线后再跑。
-- 三个旧 Spa 的历史 service_id 保留，供已有预约读取时长和名称。
-- 整文件一个事务。任一语句失败则列、约束和函数一起回滚。可重复执行。

BEGIN;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS allergy_status text,
  ADD COLUMN IF NOT EXISTS allergy_details text;

ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_allergy_status_check;
ALTER TABLE public.pets
  ADD CONSTRAINT pets_allergy_status_check
  CHECK (
    allergy_status IS NULL
    OR allergy_status IN ('yes', 'none', 'unsure')
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS household_allergy_status text,
  ADD COLUMN IF NOT EXISTS household_allergy_details text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_household_allergy_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_household_allergy_status_check
  CHECK (
    household_allergy_status IS NULL
    OR household_allergy_status IN ('yes', 'none', 'unsure')
  );

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS spa_goals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergy_snapshot jsonb;

COMMENT ON COLUMN public.pets.allergy_status IS
  'yes, none, or unsure. Null means not recorded and must not be treated as none.';
COMMENT ON COLUMN public.profiles.household_allergy_status IS
  'Owner or household allergies. Null means not recorded.';
COMMENT ON COLUMN public.appointments.spa_goals IS
  'Luxury Spa Day focus ids. Empty is allowed. Not an add-on and not a price input.';
COMMENT ON COLUMN public.appointments.allergy_snapshot IS
  'Safety snapshot taken when the appointment was saved.';

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

    spa_goals,
    allergy_snapshot,
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

    COALESCE(
      ARRAY(
        SELECT jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(p_appointment -> 'spa_goals') = 'array'
              THEN p_appointment -> 'spa_goals'
            ELSE '[]'::jsonb
          END
        )
      ),
      ARRAY[]::text[]
    ),
    CASE
      WHEN jsonb_typeof(p_appointment -> 'allergy_snapshot') = 'object'
        THEN p_appointment -> 'allergy_snapshot'
      ELSE NULL
    END,
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

      spa_goals,
      allergy_snapshot,
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

      COALESCE(
        ARRAY(
            SELECT jsonb_array_elements_text(
              CASE
                  WHEN jsonb_typeof(v_item -> 'spa_goals') = 'array'
                    THEN v_item -> 'spa_goals'
                  ELSE '[]'::jsonb
              END
            )
        ),
        ARRAY[]::text[]
      ),
      CASE
        WHEN jsonb_typeof(v_item -> 'allergy_snapshot') = 'object'
            THEN v_item -> 'allergy_snapshot'
        ELSE NULL
      END,
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

REVOKE ALL ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(uuid, text, jsonb, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.create_staff_visit(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_staff_visit(jsonb, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_staff_visit(jsonb, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_visit(jsonb, jsonb) TO service_role;

COMMIT;
