-- Token-scoped server operation: update every service row and its visit in one transaction.
CREATE OR REPLACE FUNCTION public.complete_staff_booking_address(
  p_token_hash text, p_customer_id uuid, p_appointment_id uuid,
  p_address jsonb, p_lat double precision, p_lon double precision,
  p_distance numeric, p_automatic_fee numeric
) RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_visit uuid;
  v_override numeric;
  v_row public.appointments%ROWTYPE;
BEGIN
  SELECT visit_id INTO v_visit FROM public.appointments WHERE id = p_appointment_id AND customer_id = p_customer_id;
  IF v_visit IS NULL THEN RAISE EXCEPTION 'Visit unavailable' USING ERRCODE = 'P0002'; END IF;
  SELECT travel_fee_override INTO v_override FROM public.visits
    WHERE id = v_visit AND customer_id = p_customer_id AND status <> 'cancelled' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visit unavailable' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_row FROM public.appointments WHERE id = p_appointment_id AND customer_id = p_customer_id
    AND staff_created AND status IN ('pending_confirmation','confirmed')
    AND customer_confirm_token_hash = p_token_hash AND customer_confirm_expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Confirmation link unavailable' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE visit_id = v_visit AND status <> 'cancelled'
    AND (length(trim(address_street)) = 0 OR length(trim(address_city)) = 0
      OR length(trim(address_state)) = 0 OR length(trim(address_zip)) = 0)) THEN RETURN true; END IF;
  IF p_address IS NULL OR COALESCE(length(trim(p_address->>'street')),0) NOT BETWEEN 1 AND 200
    OR COALESCE(length(trim(p_address->>'city')),0) NOT BETWEEN 1 AND 120
    OR COALESCE(length(trim(p_address->>'state')),0) NOT BETWEEN 1 AND 40
    OR COALESCE(length(trim(p_address->>'zip')),0) NOT BETWEEN 1 AND 20
    OR p_lat IS NULL OR p_lon IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180
    OR p_distance IS NULL OR p_distance < 0 OR p_distance > 9999 THEN
    RAISE EXCEPTION 'Invalid service address' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.appointments WHERE visit_id = v_visit ORDER BY id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.appointments WHERE visit_id = v_visit AND status <> 'cancelled'
    AND (customer_id <> p_customer_id OR customer_confirm_token_hash IS DISTINCT FROM p_token_hash)) THEN
    RAISE EXCEPTION 'Visit changed; reload the confirmation link' USING ERRCODE = '23514';
  END IF;
  UPDATE public.appointments SET address_street = trim(p_address->>'street'), address_city = trim(p_address->>'city'),
    address_state = trim(p_address->>'state'), address_zip = trim(p_address->>'zip'),
    address_lat = p_lat, address_lon = p_lon, travel_distance_miles = p_distance
    WHERE visit_id = v_visit AND customer_id = p_customer_id AND status <> 'cancelled';
  UPDATE public.visits SET address_street = trim(p_address->>'street'), address_city = trim(p_address->>'city'),
    address_state = trim(p_address->>'state'), address_zip = trim(p_address->>'zip'),
    address_lat = p_lat, address_lon = p_lon, travel_distance_miles = p_distance WHERE id = v_visit;
  PERFORM public.set_visit_travel_fee(v_visit, p_automatic_fee, v_override);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_staff_booking_address(text, uuid, uuid, jsonb, double precision, double precision, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_staff_booking_address(text, uuid, uuid, jsonb, double precision, double precision, numeric, numeric) TO service_role;
