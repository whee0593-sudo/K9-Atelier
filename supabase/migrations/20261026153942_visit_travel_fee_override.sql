-- Travel belongs to the visit. NULL override means automatic, including when
-- the automatic amount is zero. No customer write privileges are added.
ALTER TABLE public.visits
  ADD COLUMN travel_fee_automatic numeric(8,2),
  ADD COLUMN travel_fee_override numeric(8,2),
  ADD CONSTRAINT visit_travel_override_range CHECK (travel_fee_override BETWEEN 0 AND 5000),
  ADD CONSTRAINT visit_travel_automatic_range CHECK (travel_fee_automatic >= 0);

CREATE POLICY visits_customer_cannot_override_travel ON public.visits
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (travel_fee_override IS NULL AND travel_fee_automatic IS NULL);

CREATE OR REPLACE FUNCTION private.mirror_visit_travel_fee(p_visit_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_fee numeric;
  v_carrier uuid;
BEGIN
  SELECT travel_fee INTO STRICT v_fee FROM public.visits WHERE id = p_visit_id;
  SELECT id INTO v_carrier FROM public.appointments
    WHERE visit_id = p_visit_id AND status <> 'cancelled'
    ORDER BY (travel_fee > 0) DESC, visit_sequence ASC NULLS LAST, id LIMIT 1;

  UPDATE public.appointments AS a SET
    estimated_total = CASE WHEN a.estimated_total IS NULL THEN NULL ELSE
      a.estimated_total - a.travel_fee + CASE WHEN a.id = v_carrier THEN v_fee ELSE 0 END END,
    add_on_options = CASE WHEN jsonb_typeof(a.add_on_options -> '__visitLineItems') = 'array' THEN
      jsonb_set(a.add_on_options, '{__visitLineItems}',
        COALESCE((SELECT jsonb_agg(item) FROM jsonb_array_elements(a.add_on_options -> '__visitLineItems') item
          WHERE item ->> 'catalogId' IS DISTINCT FROM 'travel-fee'), '[]'::jsonb)
        || CASE WHEN a.id = v_carrier AND v_fee > 0 THEN jsonb_build_array(jsonb_build_object(
          'id', 'visit-travel-fee', 'label', 'Travel fee', 'catalogId', 'travel-fee',
          'referralCategory', 'travel_fee', 'amount', v_fee)) ELSE '[]'::jsonb END)
      ELSE a.add_on_options END,
    travel_fee = CASE WHEN a.id = v_carrier THEN v_fee ELSE 0 END
    WHERE a.visit_id = p_visit_id;
END;
$$;
REVOKE ALL ON FUNCTION private.mirror_visit_travel_fee(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.mirror_visit_travel_fee(uuid) TO service_role;

-- Retain the existing atomic booking function and add travel metadata in the
-- same transaction. A failed metadata/mirror write rolls back the booking.
CREATE OR REPLACE FUNCTION public.create_staff_visit_with_travel_fee(p_visit jsonb, p_appointments jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_staff_visit(p_visit, p_appointments);
  UPDATE public.visits SET
    travel_fee_automatic = (p_visit ->> 'travel_fee_automatic')::numeric,
    travel_fee_override = (p_visit ->> 'travel_fee_override')::numeric
    WHERE id = v_id;
  PERFORM private.mirror_visit_travel_fee(v_id);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_staff_visit_with_travel_fee(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_staff_visit_with_travel_fee(jsonb, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.set_visit_travel_fee(
  p_visit_id uuid, p_automatic numeric, p_override numeric
)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF p_automatic IS NULL OR p_automatic < 0 OR p_automatic > 5000
    OR (p_override IS NOT NULL AND (p_override < 0 OR p_override > 5000))
    OR p_automatic <> round(p_automatic, 2)
    OR (p_override IS NOT NULL AND p_override <> round(p_override, 2)) THEN
    RAISE EXCEPTION 'Invalid travel fee' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.visits WHERE id = p_visit_id AND status <> 'cancelled' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visit unavailable' USING ERRCODE = 'P0002'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointment_charges c
    WHERE (c.visit_id = p_visit_id OR c.appointment_id IN
      (SELECT id FROM public.appointments WHERE visit_id = p_visit_id))
      AND c.status IN ('pending', 'paid')) THEN
    RAISE EXCEPTION 'Payment already started for this visit' USING ERRCODE = '23514';
  END IF;
  UPDATE public.visits SET travel_fee_automatic = p_automatic,
    travel_fee_override = p_override, travel_fee = COALESCE(p_override, p_automatic)
    WHERE id = p_visit_id;
  PERFORM private.mirror_visit_travel_fee(p_visit_id);
END;
$$;
REVOKE ALL ON FUNCTION public.set_visit_travel_fee(uuid, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_visit_travel_fee(uuid, numeric, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_visit_travel_fee(p_visit_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visit unavailable' USING ERRCODE = 'P0002'; END IF;
  PERFORM private.mirror_visit_travel_fee(p_visit_id);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_visit_travel_fee(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_visit_travel_fee(uuid) TO service_role;

-- Serialize checkout with edits, rejecting stale checkout amounts.
CREATE OR REPLACE FUNCTION private.check_charge_visit_travel_fee()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_fee numeric; v_amount numeric; v_count integer;
BEGIN
  IF NEW.visit_id IS NULL OR NEW.kind <> 'service' THEN RETURN NEW; END IF;
  SELECT travel_fee INTO v_fee FROM public.visits WHERE id = NEW.visit_id FOR UPDATE;
  SELECT count(*), COALESCE(sum((item ->> 'amount')::numeric), 0) INTO v_count, v_amount
    FROM jsonb_array_elements(NEW.line_items) item
    WHERE item ->> 'catalogId' = 'travel-fee' OR item ->> 'referralCategory' = 'travel_fee';
  IF v_count > 1 OR v_amount <> v_fee THEN
    RAISE EXCEPTION 'Visit travel fee changed; reload checkout' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.check_charge_visit_travel_fee() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER charge_visit_travel_fee_check BEFORE INSERT ON public.appointment_charges
  FOR EACH ROW EXECUTE FUNCTION private.check_charge_visit_travel_fee();

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
