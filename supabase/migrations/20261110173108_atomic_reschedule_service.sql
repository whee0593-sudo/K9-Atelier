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
  v_started timestamptz;
BEGIN
  SELECT COALESCE(service_started_at, service_ended_at) INTO v_started
  FROM public.visits
  WHERE id = p_visit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'visit not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_service ? 'service_price' THEN
    PERFORM 1
    FROM public.appointments
    WHERE id = p_appointment_id
      AND visit_id = p_visit_id
      AND status IN ('confirmed', 'pending_confirmation')
      AND service_started_at IS NULL
      AND service_ended_at IS NULL
      AND service_id = p_service ->> 'previous_service_id'
      AND appointment_date = (p_service ->> 'previous_date')::date
      AND scheduled_start IS NOT DISTINCT FROM (p_service ->> 'previous_start')::integer
    FOR UPDATE;
    IF v_started IS NOT NULL OR NOT FOUND THEN
      RAISE EXCEPTION 'appointment changed while editing' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF p_children IS NULL THEN
    UPDATE public.appointments
    SET
      service_id = COALESCE(NULLIF(p_service ->> 'service_id', ''), service_id),
      service_name = COALESCE(NULLIF(p_service ->> 'service_name', ''), service_name),
      service_price = COALESCE((p_service ->> 'service_price')::numeric, service_price),
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
        NULLIF(p_service ->> 'estimated_total', '')::numeric
          - COALESCE((p_service ->> 'appointment_travel_fee')::numeric, (p_service ->> 'travel_fee')::numeric, 0) + travel_fee,
        estimated_total
      )
    WHERE id = p_appointment_id
      AND visit_id = p_visit_id;
  ELSE
    UPDATE public.appointments
    SET
      service_id = COALESCE(NULLIF(p_service ->> 'service_id', ''), service_id),
      service_name = COALESCE(NULLIF(p_service ->> 'service_name', ''), service_name),
      service_price = COALESCE((p_service ->> 'service_price')::numeric, service_price),
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
        NULLIF(p_service ->> 'estimated_total', '')::numeric
          - COALESCE((p_service ->> 'appointment_travel_fee')::numeric, (p_service ->> 'travel_fee')::numeric, 0) + travel_fee,
        estimated_total
      ),
      estimated_duration_minutes = NULLIF(p_service ->> 'estimated_duration_minutes', '')::integer
    WHERE id = p_appointment_id
      AND visit_id = p_visit_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment is not on this visit' USING ERRCODE = '23514';
  END IF;

  -- Dog service edits preserve the canonical visit fee and its override.
  PERFORM private.mirror_visit_travel_fee(p_visit_id);

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
