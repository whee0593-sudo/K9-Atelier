BEGIN;

-- Authorize an inline staff waiver and acquire the visit claim together.
CREATE FUNCTION public.begin_staff_cancellation_fee_claim(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_waiver jsonb;
  v_visit uuid := (p_input->>'visit_id')::uuid;
  v_cap numeric := (p_input->>'staff_collect_cap')::numeric;
BEGIN
  IF p_input->>'action' NOT IN ('cancel', 'remove_dog')
    OR v_cap IS NULL OR v_cap < 0
    OR v_cap IS DISTINCT FROM (p_input->>'charged')::numeric
  THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  INSERT INTO public.visit_policy_locks (visit_id, claim_id)
  VALUES (v_visit, NULL)
  ON CONFLICT (visit_id) DO NOTHING;
  PERFORM 1 FROM public.visit_policy_locks WHERE visit_id = v_visit FOR UPDATE;

  BEGIN
    v_waiver := public.authorize_policy_fee_waiver(p_input || jsonb_build_object(
      'collect_cap', v_cap,
      'reason', 'Staff edited the calendar cancellation fee'
    ));
    IF v_waiver->>'outcome' NOT IN ('authorized', 'already_settled') THEN
      RETURN jsonb_build_object('outcome', 'invalid');
    END IF;
    v_result := public.begin_policy_fee_claim(p_input);
    IF v_result->>'outcome' NOT IN ('created', 'existing') THEN
      RAISE SQLSTATE 'P0409' USING MESSAGE = 'Cancellation fee claim was not acquired';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P0409' THEN
    RETURN v_result;
  END;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_staff_cancellation_fee_claim(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_staff_cancellation_fee_claim(jsonb)
  TO service_role;

COMMIT;
