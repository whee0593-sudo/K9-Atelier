-- Additive, service-only entry point for a self-serve visit with multiple dogs.
-- Reuses the existing visit writer and travel mirror; no customer write grants.
BEGIN;

GRANT SELECT, INSERT, UPDATE ON public.guest_booking_requests TO service_role;

CREATE OR REPLACE FUNCTION public.create_guest_group_booking(
  p_idempotency_key uuid, p_payload_hash text, p_visit jsonb, p_appointments jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_customer uuid := (p_visit ->> 'customer_id')::uuid;
  v_request public.guest_booking_requests%ROWTYPE;
  v_visit uuid;
  v_first uuid;
  v_item jsonb;
  v_start integer := (p_visit ->> 'scheduled_start')::integer;
  v_end integer := v_start;
  v_sequence integer := 0;
BEGIN
  IF v_customer IS NULL OR p_idempotency_key IS NULL OR p_payload_hash IS NULL
    OR jsonb_typeof(p_appointments) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_appointments) < 2 THEN
    RAISE EXCEPTION 'invalid group booking' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_appointments) LOOP
    v_sequence := v_sequence + 1;
    IF (v_item ->> 'customer_id')::uuid IS DISTINCT FROM v_customer
      OR NOT EXISTS (SELECT 1 FROM public.pets WHERE id = (v_item ->> 'pet_id')::uuid
        AND customer_id = v_customer AND archived_at IS NULL) THEN
      RAISE EXCEPTION 'pet_not_found';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE id = (v_item ->> 'payment_method_id')::uuid
      AND customer_id = v_customer) THEN RAISE EXCEPTION 'payment_required'; END IF;
    IF (v_item ->> 'scheduled_start')::integer IS DISTINCT FROM v_end
      OR COALESCE((v_item ->> 'estimated_duration_minutes')::integer, 0) <= 0
      OR (v_item ->> 'visit_sequence')::integer IS DISTINCT FROM v_sequence
      OR (v_item ->> 'appointment_date')::date IS DISTINCT FROM (p_visit ->> 'service_date')::date THEN
      RAISE EXCEPTION 'invalid group sequence' USING ERRCODE = '23514';
    END IF;
    v_end := v_end + (v_item ->> 'estimated_duration_minutes')::integer;
  END LOOP;
  IF (SELECT count(DISTINCT value ->> 'pet_id') FROM jsonb_array_elements(p_appointments)) <> v_sequence THEN
    RAISE EXCEPTION 'duplicate dog' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.guest_booking_requests (customer_id, idempotency_key, payload_hash)
    VALUES (v_customer, p_idempotency_key, p_payload_hash)
    ON CONFLICT (customer_id, idempotency_key) DO NOTHING;
  SELECT * INTO STRICT v_request FROM public.guest_booking_requests
    WHERE customer_id = v_customer AND idempotency_key = p_idempotency_key FOR UPDATE;
  IF v_request.payload_hash IS DISTINCT FROM p_payload_hash THEN RAISE EXCEPTION 'idempotency_mismatch'; END IF;
  IF v_request.appointment_id IS NOT NULL THEN
    RETURN jsonb_build_object('created', false, 'appointment_id', v_request.appointment_id);
  END IF;

  -- The trigger below uses the same date lock for other appointment writers.
  PERFORM pg_advisory_xact_lock(hashtextextended('k9-guest-group:' || (p_visit ->> 'service_date'), 0));
  IF EXISTS (SELECT 1 FROM public.appointments a
    WHERE a.appointment_date = (p_visit ->> 'service_date')::date
      AND a.status <> 'cancelled'
      AND (a.scheduled_start IS NULL OR a.estimated_duration_minutes IS NULL
        OR a.estimated_duration_minutes <= 0
        OR (a.scheduled_start < v_end AND a.scheduled_start + a.estimated_duration_minutes > v_start))) THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23505';
  END IF;

  v_visit := public.create_staff_visit_with_travel_fee(p_visit, p_appointments);
  SELECT id INTO STRICT v_first FROM public.appointments WHERE visit_id = v_visit AND visit_sequence = 1;
  UPDATE public.guest_booking_requests SET appointment_id = v_first WHERE id = v_request.id;
  RETURN jsonb_build_object('created', true, 'appointment_id', v_first);
END;
$$;
REVOKE ALL ON FUNCTION public.create_guest_group_booking(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_group_booking(uuid, text, jsonb, jsonb) TO service_role;

-- Read across households only inside this private trigger, so an old single-dog
-- client cannot insert a start inside a committed multi-dog visit after a stale
-- availability check. No records or customer details are returned to callers.
CREATE OR REPLACE FUNCTION private.guard_guest_group_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_group boolean;
BEGIN
  IF NEW.status = 'cancelled' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('k9-guest-group:' || NEW.appointment_date::text, 0));
  SELECT EXISTS (
    SELECT 1 FROM public.guest_booking_requests r
    JOIN public.appointments first_dog ON first_dog.id = r.appointment_id
    WHERE first_dog.visit_id = NEW.visit_id
      AND EXISTS (SELECT 1 FROM public.appointments sibling WHERE sibling.visit_id = NEW.visit_id AND sibling.id <> first_dog.id)
  ) INTO v_group;
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.appointment_date = NEW.appointment_date AND a.status <> 'cancelled'
      AND a.id IS DISTINCT FROM NEW.id AND a.visit_id IS DISTINCT FROM NEW.visit_id
      AND (v_group OR EXISTS (
        SELECT 1 FROM public.guest_booking_requests r
        JOIN public.appointments first_dog ON first_dog.id = r.appointment_id
        WHERE first_dog.visit_id = a.visit_id
          AND EXISTS (SELECT 1 FROM public.appointments sibling WHERE sibling.visit_id = a.visit_id AND sibling.id <> first_dog.id)
      ))
      AND (NEW.scheduled_start IS NULL OR NEW.estimated_duration_minutes IS NULL
        OR a.scheduled_start IS NULL OR a.estimated_duration_minutes IS NULL
        OR (a.scheduled_start < NEW.scheduled_start + NEW.estimated_duration_minutes
          AND a.scheduled_start + a.estimated_duration_minutes > NEW.scheduled_start))
  ) THEN RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '23505'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_guest_group_schedule() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guard_guest_group_schedule() TO service_role;
CREATE TRIGGER guard_guest_group_schedule
  BEFORE INSERT OR UPDATE OF appointment_date, scheduled_start, estimated_duration_minutes, status, visit_id
  ON public.appointments FOR EACH ROW EXECUTE FUNCTION private.guard_guest_group_schedule();
COMMIT;
