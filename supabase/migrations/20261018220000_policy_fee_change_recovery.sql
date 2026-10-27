-- Recover a paid cancel, reschedule, or remove-dog change after a crash.
-- Does not UPDATE appointment_charges amounts or Stripe ids.
-- A claim whose Stripe result is still unknown stays locked.

BEGIN;

ALTER TABLE public.policy_fee_claims
  ADD COLUMN IF NOT EXISTS change_phase text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS calendar_written_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'policy_fee_claims_change_phase_check'
  ) THEN
    ALTER TABLE public.policy_fee_claims
      ADD CONSTRAINT policy_fee_claims_change_phase_check
      CHECK (change_phase IN ('pending', 'applying', 'applied', 'review'));
  END IF;
END $$;

UPDATE public.policy_fee_claims
SET change_phase = 'applied'
WHERE appointment_change_applied
  AND change_phase IS DISTINCT FROM 'applied';

UPDATE public.policy_fee_claims
SET change_phase = 'applying'
WHERE NOT appointment_change_applied
  AND change_started_at IS NOT NULL
  AND change_phase = 'pending';

CREATE OR REPLACE FUNCTION public.policy_fee_claims_set_phase()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.appointment_change_applied THEN
    NEW.change_phase := 'applied';
  ELSIF NEW.change_phase IS NULL THEN
    NEW.change_phase := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_fee_claims_set_phase ON public.policy_fee_claims;
CREATE TRIGGER policy_fee_claims_set_phase
  BEFORE INSERT ON public.policy_fee_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.policy_fee_claims_set_phase();

CREATE OR REPLACE FUNCTION public.policy_fee_claims_reset_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'failed'
    AND NEW.status = 'charging'
    AND NEW.attempt IS DISTINCT FROM OLD.attempt
  THEN
    NEW.payment_state := 'none';
    NEW.stripe_submitted_at := NULL;
    NEW.change_started_at := NULL;
    IF OLD.calendar_written_at IS NOT NULL OR NEW.calendar_written_at IS NOT NULL THEN
      NEW.calendar_written_at := COALESCE(OLD.calendar_written_at, NEW.calendar_written_at);
      NEW.change_phase := 'review';
    ELSE
      NEW.calendar_written_at := NULL;
      NEW.change_phase := CASE
        WHEN NEW.appointment_change_applied THEN 'applied'
        ELSE 'pending'
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.acquire_policy_fee_change(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claim public.policy_fee_claims%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_claim
  FROM public.policy_fee_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'missing');
  END IF;
  IF v_claim.appointment_change_applied OR v_claim.change_phase = 'applied' THEN
    RETURN jsonb_build_object('outcome', 'already');
  END IF;
  IF v_claim.status NOT IN ('charged', 'waived', 'no_fee') THEN
    RETURN jsonb_build_object('outcome', 'not_ready');
  END IF;
  IF v_claim.change_phase = 'review' THEN
    RETURN jsonb_build_object('outcome', 'review');
  END IF;
  IF v_claim.calendar_written_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'resume');
  END IF;
  IF v_claim.change_phase = 'applying'
    AND v_claim.change_started_at > now() - interval '2 minutes'
  THEN
    RETURN jsonb_build_object('outcome', 'busy');
  END IF;
  UPDATE public.policy_fee_claims
  SET change_phase = 'applying',
      change_started_at = now(),
      updated_at = now()
  WHERE id = p_claim_id
    AND calendar_written_at IS NULL
    AND NOT appointment_change_applied
    AND (
      change_phase = 'pending'
      OR change_started_at IS NULL
      OR change_started_at <= now() - interval '2 minutes'
    )
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'busy');
  END IF;
  RETURN jsonb_build_object('outcome', 'apply');
END;
$$;

CREATE OR REPLACE FUNCTION public.release_policy_fee_change(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.policy_fee_claims
  SET change_phase = 'pending',
      change_started_at = NULL,
      updated_at = now()
  WHERE id = p_claim_id
    AND change_phase = 'applying'
    AND calendar_written_at IS NULL
    AND NOT appointment_change_applied
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'kept');
  END IF;
  RETURN jsonb_build_object('outcome', 'released');
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_policy_fee_change_applied(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_visit uuid;
  v_id uuid;
  v_status text;
  v_applied boolean;
  v_written timestamptz;
  v_phase text;
BEGIN
  UPDATE public.policy_fee_claims
  SET appointment_change_applied = true,
      change_phase = 'applied',
      updated_at = now()
  WHERE id = p_claim_id
    AND NOT appointment_change_applied
    AND status IN ('charged', 'waived', 'no_fee')
    AND change_phase = 'applying'
    AND calendar_written_at IS NOT NULL
  RETURNING id, visit_id INTO v_id, v_visit;
  IF v_id IS NULL THEN
    SELECT visit_id, status, appointment_change_applied, calendar_written_at, change_phase
      INTO v_visit, v_status, v_applied, v_written, v_phase
    FROM public.policy_fee_claims
    WHERE id = p_claim_id;
    IF v_applied AND v_status IN ('charged', 'waived', 'no_fee') THEN
      UPDATE public.visit_policy_locks
      SET claim_id = NULL
      WHERE visit_id = v_visit AND claim_id = p_claim_id;
      RETURN jsonb_build_object('outcome', 'already_applied');
    END IF;
    IF v_phase = 'applying' AND v_written IS NULL THEN
      RETURN jsonb_build_object('outcome', 'not_written');
    END IF;
    RETURN jsonb_build_object('outcome', 'not_ready');
  END IF;
  UPDATE public.visit_policy_locks
  SET claim_id = NULL
  WHERE visit_id = v_visit AND claim_id = p_claim_id;
  RETURN jsonb_build_object('outcome', 'applied');
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_policy_fee_calendar(
  p_claim_id uuid,
  p_plan jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claim public.policy_fee_claims%ROWTYPE;
  v_payload jsonb;
  v_ids uuid[];
  v_payload_ids uuid[];
  v_claim_ids uuid[];
  v_item record;
  v_status text;
  v_found_date date;
  v_found_start integer;
  v_mismatch boolean := false;
  v_count integer := 0;
  v_date date;
  v_start integer;
  v_label text;
  v_pref text;
  v_updated uuid;
BEGIN
  SELECT * INTO v_claim
  FROM public.policy_fee_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'missing');
  END IF;
  IF v_claim.status NOT IN ('charged', 'waived', 'no_fee') THEN
    RETURN jsonb_build_object('outcome', 'not_ready');
  END IF;
  IF v_claim.appointment_change_applied OR v_claim.change_phase = 'applied' THEN
    RETURN jsonb_build_object('outcome', 'already');
  END IF;
  IF v_claim.change_phase = 'review' THEN
    RETURN jsonb_build_object('outcome', 'review');
  END IF;
  IF v_claim.change_phase <> 'applying' THEN
    RETURN jsonb_build_object('outcome', 'not_acquired');
  END IF;
  IF v_claim.calendar_written_at IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'already_written');
  END IF;

  v_payload := v_claim.change_payload;
  v_ids := v_claim.affected_appointment_ids;

  -- Match the visit-first lock order used by travel-fee edits and checkout.
  -- Keep the canonical fee stable while cancelling and moving its mirror.
  PERFORM 1 FROM public.visits WHERE id = v_claim.visit_id FOR UPDATE;

  BEGIN
    IF v_claim.action NOT IN ('cancel', 'reschedule', 'remove_dog')
      OR v_payload->>'operationId' IS DISTINCT FROM v_claim.idempotency_key
      OR v_payload->>'action' IS DISTINCT FROM v_claim.action
      OR v_payload->>'visitId' IS DISTINCT FROM v_claim.visit_id::text
      OR jsonb_typeof(v_payload->'confirmedFee') <> 'number'
      OR round((v_payload->>'confirmedFee')::numeric, 2)
        IS DISTINCT FROM round(v_claim.charged_amount, 2)
      OR jsonb_typeof(v_payload->'appointments') <> 'array'
      OR jsonb_array_length(v_payload->'appointments') <> cardinality(v_ids)
      OR cardinality(v_ids) < 1
      OR (
        SELECT count(*)
        FROM jsonb_array_elements(v_payload->'appointments') AS item
      ) IS DISTINCT FROM (
        SELECT count(DISTINCT item->>'id')
        FROM jsonb_array_elements(v_payload->'appointments') AS item
      )
    THEN
      UPDATE public.policy_fee_claims
      SET change_phase = 'review', updated_at = now()
      WHERE id = p_claim_id
        AND change_phase = 'applying'
        AND calendar_written_at IS NULL;
      RETURN jsonb_build_object('outcome', 'review');
    END IF;

    SELECT COALESCE(array_agg((item->>'id')::uuid ORDER BY (item->>'id')::uuid), '{}'::uuid[])
      INTO v_payload_ids
    FROM jsonb_array_elements(v_payload->'appointments') AS item;
    SELECT COALESCE(array_agg(value ORDER BY value), '{}'::uuid[])
      INTO v_claim_ids
    FROM unnest(v_ids) AS value;
    IF v_payload_ids IS DISTINCT FROM v_claim_ids THEN
      UPDATE public.policy_fee_claims
      SET change_phase = 'review', updated_at = now()
      WHERE id = p_claim_id
        AND change_phase = 'applying'
        AND calendar_written_at IS NULL;
      RETURN jsonb_build_object('outcome', 'review');
    END IF;

    PERFORM 1
    FROM public.appointments
    WHERE id = ANY (v_ids)
    ORDER BY id
    FOR UPDATE;

    FOR v_item IN
      SELECT item FROM jsonb_array_elements(v_payload->'appointments') AS item
    LOOP
      SELECT status::text, appointment_date, scheduled_start
        INTO v_status, v_found_date, v_found_start
      FROM public.appointments
      WHERE id = (v_item.item->>'id')::uuid;
      IF NOT FOUND
        OR v_status IS DISTINCT FROM v_item.item->>'status'
        OR v_found_date IS DISTINCT FROM (v_item.item->>'appointmentDate')::date
        OR v_found_start IS DISTINCT FROM NULLIF(v_item.item->>'scheduledStart', '')::integer
      THEN
        v_mismatch := true;
      END IF;
    END LOOP;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      UPDATE public.policy_fee_claims
      SET change_phase = 'review', updated_at = now()
      WHERE id = p_claim_id
        AND change_phase = 'applying'
        AND calendar_written_at IS NULL;
      RETURN jsonb_build_object('outcome', 'review');
  END;

  IF v_mismatch OR (
    SELECT count(*) FROM public.appointments WHERE id = ANY (v_ids)
  ) <> cardinality(v_ids) THEN
    UPDATE public.policy_fee_claims
    SET change_phase = 'review', updated_at = now()
    WHERE id = p_claim_id
      AND change_phase = 'applying'
      AND calendar_written_at IS NULL;
    RETURN jsonb_build_object('outcome', 'review');
  END IF;

  IF v_claim.action = 'reschedule'
    AND (
      p_plan IS NULL
      OR jsonb_typeof(p_plan->'appointments') <> 'array'
      OR jsonb_array_length(p_plan->'appointments') <> cardinality(v_ids)
    )
  THEN
    RETURN jsonb_build_object('outcome', 'plan_required');
  END IF;

  BEGIN
    IF v_claim.action IN ('cancel', 'remove_dog') THEN
      UPDATE public.appointments AS appointment
      SET status = 'cancelled',
          cancelled_at = COALESCE(appointment.cancelled_at, now())
      FROM jsonb_array_elements(v_payload->'appointments') AS item
      WHERE appointment.id = (item->>'id')::uuid
        AND appointment.id = ANY (v_ids)
        AND appointment.status::text = item->>'status'
        AND appointment.appointment_date IS NOT DISTINCT FROM (item->>'appointmentDate')::date
        AND appointment.scheduled_start IS NOT DISTINCT FROM NULLIF(item->>'scheduledStart', '')::integer;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'policy fee calendar mismatch' USING ERRCODE = '23514';
      END IF;

      -- This must commit with the calendar write, before calendar_written_at.
      -- A failed mirror rolls the cancellation back, so recovery can retry
      -- without creating another payment or sending another notification.
      PERFORM public.sync_visit_travel_fee(v_claim.visit_id);
    ELSE
      IF (
        SELECT COALESCE(array_agg((item->>'id')::uuid ORDER BY (item->>'id')::uuid), '{}'::uuid[])
        FROM jsonb_array_elements(p_plan->'appointments') AS item
      ) IS DISTINCT FROM v_claim_ids
      OR v_payload->'rescheduleTo'->>'date' IS NULL
      THEN
        RAISE EXCEPTION 'policy fee calendar mismatch' USING ERRCODE = '23514';
      END IF;
      v_date := (v_payload->'rescheduleTo'->>'date')::date;

      UPDATE public.appointments AS appointment
      SET scheduled_start = NULL
      FROM jsonb_array_elements(v_payload->'appointments') AS item
      WHERE appointment.id = (item->>'id')::uuid
        AND appointment.id = ANY (v_ids)
        AND appointment.status::text = item->>'status'
        AND appointment.appointment_date IS NOT DISTINCT FROM (item->>'appointmentDate')::date
        AND appointment.scheduled_start IS NOT DISTINCT FROM NULLIF(item->>'scheduledStart', '')::integer;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'policy fee calendar mismatch' USING ERRCODE = '23514';
      END IF;

      UPDATE public.appointments AS appointment
      SET appointment_date = v_date,
          scheduled_start = child.scheduled_start,
          appointment_time = child.appointment_time,
          time_preference = child.time_preference
      FROM (
        SELECT
          (item->>'id')::uuid AS id,
          (item->>'scheduledStart')::integer AS scheduled_start,
          NULLIF(item->>'appointmentTime', '') AS appointment_time,
          NULLIF(item->>'timePreference', '') AS time_preference
        FROM jsonb_array_elements(p_plan->'appointments') AS item
      ) AS child
      WHERE appointment.id = child.id
        AND appointment.id = ANY (v_ids)
        AND appointment.scheduled_start IS NULL
        AND child.scheduled_start IS NOT NULL;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'policy fee calendar mismatch' USING ERRCODE = '23514';
      END IF;

      SELECT child.scheduled_start, child.appointment_time, child.time_preference
        INTO v_start, v_label, v_pref
      FROM (
        SELECT
          (item->>'scheduledStart')::integer AS scheduled_start,
          NULLIF(item->>'appointmentTime', '') AS appointment_time,
          NULLIF(item->>'timePreference', '') AS time_preference
        FROM jsonb_array_elements(p_plan->'appointments') AS item
      ) AS child
      ORDER BY child.scheduled_start
      LIMIT 1;

      UPDATE public.visits
      SET service_date = v_date,
          scheduled_start = v_start,
          appointment_time = v_label,
          time_preference = v_pref
      WHERE id = v_claim.visit_id;
    END IF;

    UPDATE public.policy_fee_claims
    SET calendar_written_at = now(), updated_at = now()
    WHERE id = p_claim_id
      AND change_phase = 'applying'
      AND calendar_written_at IS NULL
      AND NOT appointment_change_applied
    RETURNING id INTO v_updated;
    IF v_updated IS NULL THEN
      RAISE EXCEPTION 'policy fee calendar mismatch' USING ERRCODE = '23514';
    END IF;
  EXCEPTION
    WHEN check_violation THEN
      UPDATE public.policy_fee_claims
      SET change_phase = 'review', updated_at = now()
      WHERE id = p_claim_id
        AND change_phase = 'applying'
        AND calendar_written_at IS NULL;
      RETURN jsonb_build_object('outcome', 'review');
  END;

  RETURN jsonb_build_object('outcome', 'written');
END;
$$;

REVOKE ALL ON FUNCTION public.policy_fee_claims_set_phase() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_policy_fee_change(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_policy_fee_change(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_policy_fee_change_applied(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_policy_fee_calendar(uuid, jsonb) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.acquire_policy_fee_change(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.release_policy_fee_change(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.mark_policy_fee_change_applied(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.apply_policy_fee_calendar(uuid, jsonb) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.policy_fee_claims_set_phase() FROM anon;
    REVOKE ALL ON FUNCTION public.acquire_policy_fee_change(uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.release_policy_fee_change(uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.mark_policy_fee_change_applied(uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.apply_policy_fee_calendar(uuid, jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.policy_fee_claims_set_phase() FROM authenticated;
    REVOKE ALL ON FUNCTION public.acquire_policy_fee_change(uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.release_policy_fee_change(uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.mark_policy_fee_change_applied(uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.apply_policy_fee_calendar(uuid, jsonb) FROM authenticated;
  END IF;
END $$;

COMMIT;
