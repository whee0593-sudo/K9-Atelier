-- Atomic policy-fee transitions. Not run against historical charge amounts.
-- Refund completion never releases forfeiture coverage.

BEGIN;

CREATE OR REPLACE FUNCTION public.policy_fee_amounts(
  p_computed numeric,
  p_cap numeric
) RETURNS TABLE (charged numeric, waiver numeric)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    round(CASE WHEN p_cap IS NULL THEN p_computed ELSE LEAST(p_computed, p_cap) END, 2),
    round(
      p_computed - CASE WHEN p_cap IS NULL THEN p_computed ELSE LEAST(p_computed, p_cap) END,
      2
    );
$$;

CREATE OR REPLACE FUNCTION public.begin_policy_fee_claim(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_key text := p_input->>'idempotency_key';
  v_visit uuid := (p_input->>'visit_id')::uuid;
  v_action text := p_input->>'action';
  v_appointment uuid := NULLIF(p_input->>'appointment_id', '')::uuid;
  v_affected uuid[];
  v_travel boolean := COALESCE((p_input->>'includes_travel')::boolean, false);
  v_forfeit boolean := COALESCE((p_input->>'forfeit')::boolean, false);
  v_computed numeric := round((p_input->>'computed')::numeric, 2);
  v_tender text := NULLIF(p_input->>'tender', '');
  v_actor uuid := (p_input->>'actor_id')::uuid;
  v_expected numeric := CASE
    WHEN p_input ? 'expected_amount' AND jsonb_typeof(p_input->'expected_amount') = 'number'
      THEN round((p_input->>'expected_amount')::numeric, 2)
    ELSE NULL
  END;
  v_payload jsonb := COALESCE(p_input->'change_payload', '{}'::jsonb);
  v_caller_charged numeric := round((p_input->>'charged')::numeric, 2);
  v_caller_waiver numeric := round((p_input->>'waiver')::numeric, 2);
  v_cap numeric;
  v_charged numeric;
  v_waiver numeric;
  v_claim public.policy_fee_claims%ROWTYPE;
  v_holder uuid;
  v_holder_status text;
  v_holder_applied boolean;
  v_holder_key text;
  v_waiver_id uuid;
  v_status text;
  v_attempt integer;
  v_stripe_key text;
BEGIN
  IF v_key IS NULL OR v_visit IS NULL OR v_actor IS NULL OR v_computed IS NULL OR v_computed < 0 THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  IF v_action NOT IN ('cancel', 'reschedule', 'remove_dog', 'no_show') THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  IF (v_action = 'reschedule' AND v_forfeit) OR (v_action <> 'reschedule' AND NOT v_forfeit) THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
    INTO v_affected
  FROM jsonb_array_elements_text(COALESCE(p_input->'affected_appointment_ids', '[]'::jsonb)) AS value;

  INSERT INTO public.visit_policy_locks (visit_id, claim_id)
  VALUES (v_visit, NULL)
  ON CONFLICT (visit_id) DO NOTHING;

  SELECT claim_id INTO v_holder
  FROM public.visit_policy_locks
  WHERE visit_id = v_visit
  FOR UPDATE;

  SELECT * INTO v_claim
  FROM public.policy_fee_claims
  WHERE idempotency_key = v_key
  FOR UPDATE;

  IF v_claim.id IS NOT NULL AND v_claim.status <> 'failed' THEN
    RETURN jsonb_build_object(
      'outcome', 'existing',
      'claim_id', v_claim.id,
      'status', v_claim.status,
      'computed', v_claim.computed_amount,
      'charged', v_claim.charged_amount,
      'waiver', v_claim.waiver_amount,
      'collect_cap', v_claim.collect_cap,
      'stripe_idempotency_key', v_claim.stripe_idempotency_key,
      'stripe_payment_intent_id', v_claim.stripe_payment_intent_id,
      'charge_id', v_claim.charge_id,
      'appointment_change_applied', v_claim.appointment_change_applied,
      'tender', v_claim.tender,
      'attempt', v_claim.attempt
    );
  END IF;

  IF v_holder IS NOT NULL AND (v_claim.id IS NULL OR v_holder <> v_claim.id) THEN
    SELECT status, appointment_change_applied, idempotency_key
      INTO v_holder_status, v_holder_applied, v_holder_key
    FROM public.policy_fee_claims
    WHERE id = v_holder;
    IF v_holder_key IS NOT NULL
      AND v_holder_key IS DISTINCT FROM v_key
      AND NOT (
        v_holder_status = 'failed'
        OR (v_holder_status IN ('charged', 'waived', 'no_fee') AND v_holder_applied)
      )
    THEN
      RETURN jsonb_build_object('outcome', 'visit_busy');
    END IF;
  END IF;

  SELECT id, collect_cap INTO v_waiver_id, v_cap
  FROM public.fee_waivers
  WHERE idempotency_key = v_key AND status = 'authorized'
  FOR UPDATE;

  IF v_waiver_id IS NULL AND v_claim.id IS NOT NULL THEN
    v_cap := v_claim.collect_cap;
  END IF;

  SELECT charged, waiver INTO v_charged, v_waiver
  FROM public.policy_fee_amounts(v_computed, v_cap);

  IF v_caller_charged IS DISTINCT FROM v_charged OR v_caller_waiver IS DISTINCT FROM v_waiver THEN
    RETURN jsonb_build_object(
      'outcome', 'amount_mismatch',
      'charged', v_charged,
      'waiver', v_waiver
    );
  END IF;
  IF v_expected IS NOT NULL AND v_expected IS DISTINCT FROM v_charged THEN
    RETURN jsonb_build_object('outcome', 'fee_changed', 'charged', v_charged);
  END IF;

  IF v_action = 'no_show' AND NOT EXISTS (
    SELECT 1 FROM public.visit_no_show_reports
    WHERE visit_id = v_visit
      AND status = 'confirmed'
      AND NOT customer_replied
      AND NOT handoff_arranged
  ) THEN
    RETURN jsonb_build_object('outcome', 'no_show_not_confirmed');
  END IF;

  IF v_key LIKE '%:reopen:%' AND NOT EXISTS (
    SELECT 1 FROM public.policy_fee_reopens
    WHERE idempotency_key = v_key AND status = 'authorized'
  ) THEN
    RETURN jsonb_build_object('outcome', 'reopen_required');
  END IF;

  IF v_forfeit AND (
    EXISTS (
      SELECT 1 FROM public.policy_fee_coverage
      WHERE active AND component = 'service' AND appointment_id = ANY (v_affected)
    )
    OR (
      v_travel AND EXISTS (
        SELECT 1 FROM public.policy_fee_coverage
        WHERE active AND component = 'travel' AND visit_id = v_visit
      )
    )
  ) THEN
    RETURN jsonb_build_object('outcome', 'coverage_conflict');
  END IF;

  IF v_charged > 0 THEN
    v_status := 'charging';
  ELSIF v_waiver > 0 THEN
    v_status := 'waived';
  ELSE
    v_status := 'no_fee';
  END IF;

  IF v_claim.id IS NULL THEN
    INSERT INTO public.policy_fee_claims (
      idempotency_key, visit_id, action, appointment_id, affected_appointment_ids,
      includes_travel, forfeit, computed_amount, collect_cap, waiver_amount,
      charged_amount, tender, status, stripe_idempotency_key, attempt, actor_id,
      waiver_id, change_payload, appointment_change_applied
    ) VALUES (
      v_key, v_visit, v_action, v_appointment, v_affected,
      v_travel, v_forfeit, v_computed, v_cap, v_waiver,
      v_charged, v_tender, v_status, gen_random_uuid()::text || ':1', 1, v_actor,
      v_waiver_id, v_payload, v_action = 'no_show'
    )
    RETURNING * INTO v_claim;
    UPDATE public.policy_fee_claims
    SET stripe_idempotency_key = id::text || ':1'
    WHERE id = v_claim.id
    RETURNING * INTO v_claim;
  ELSE
    INSERT INTO public.policy_fee_attempts (
      claim_id, attempt, stripe_idempotency_key, stripe_payment_intent_id, status
    ) VALUES (
      v_claim.id, v_claim.attempt, v_claim.stripe_idempotency_key,
      v_claim.stripe_payment_intent_id, 'failed'
    )
    ON CONFLICT (claim_id, attempt) DO NOTHING;
    v_attempt := v_claim.attempt + 1;
    v_stripe_key := v_claim.id::text || ':' || v_attempt::text;
    UPDATE public.policy_fee_claims
    SET computed_amount = v_computed,
        collect_cap = v_cap,
        waiver_amount = v_waiver,
        charged_amount = v_charged,
        affected_appointment_ids = v_affected,
        includes_travel = v_travel,
        tender = COALESCE(v_tender, tender),
        status = v_status,
        stripe_payment_intent_id = NULL,
        stripe_idempotency_key = v_stripe_key,
        attempt = v_attempt,
        waiver_id = COALESCE(v_waiver_id, waiver_id),
        change_payload = v_payload,
        failure_reason = NULL,
        appointment_change_applied = v_action = 'no_show',
        updated_at = now()
    WHERE id = v_claim.id AND status = 'failed'
    RETURNING * INTO v_claim;
    IF NOT FOUND THEN
      SELECT * INTO v_claim FROM public.policy_fee_claims WHERE idempotency_key = v_key;
      RETURN jsonb_build_object(
        'outcome', 'existing',
        'claim_id', v_claim.id,
        'status', v_claim.status,
        'charged', v_claim.charged_amount,
        'stripe_idempotency_key', v_claim.stripe_idempotency_key,
        'stripe_payment_intent_id', v_claim.stripe_payment_intent_id,
        'charge_id', v_claim.charge_id,
        'appointment_change_applied', v_claim.appointment_change_applied,
        'tender', v_claim.tender
      );
    END IF;
  END IF;

  IF v_waiver_id IS NOT NULL THEN
    UPDATE public.fee_waivers
    SET status = 'consumed', consumed_at = now(), consumed_by_claim_id = v_claim.id
    WHERE id = v_waiver_id AND status = 'authorized';
    IF v_waiver > 0 THEN
      INSERT INTO public.fee_adjustments (
        visit_id, appointment_id, claim_id, waiver_id, fee_kind, action,
        original_amount, adjustment_amount, resulting_amount, actor_id, reason,
        result, idempotency_key, completed_at
      )
      SELECT
        v_visit, v_appointment, v_claim.id, v_waiver_id,
        CASE v_action
          WHEN 'cancel' THEN 'cancellation'
          WHEN 'reschedule' THEN 'reschedule'
          WHEN 'remove_dog' THEN 'remove_dog'
          ELSE 'no_show'
        END,
        'waiver_consumed', v_computed, v_waiver, v_charged, actor_id, reason,
        'completed', 'waiver:' || id::text, now()
      FROM public.fee_waivers
      WHERE id = v_waiver_id
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  IF v_forfeit THEN
    INSERT INTO public.policy_fee_coverage (claim_id, visit_id, appointment_id, component)
    SELECT DISTINCT v_claim.id, v_visit, appointment_id, 'service'
    FROM unnest(v_affected) AS appointment_id;
    IF v_travel THEN
      INSERT INTO public.policy_fee_coverage (claim_id, visit_id, component)
      VALUES (v_claim.id, v_visit, 'travel');
    END IF;
  END IF;

  UPDATE public.policy_fee_reopens
  SET status = 'consumed', consumed_at = now(), consumed_by_claim_id = v_claim.id
  WHERE idempotency_key = v_key AND status = 'authorized';

  UPDATE public.visit_policy_locks
  SET claim_id = v_claim.id, acquired_at = now()
  WHERE visit_id = v_visit;

  RETURN jsonb_build_object(
    'outcome', 'created',
    'claim_id', v_claim.id,
    'status', v_claim.status,
    'computed', v_claim.computed_amount,
    'charged', v_claim.charged_amount,
    'waiver', v_claim.waiver_amount,
    'collect_cap', v_claim.collect_cap,
    'stripe_idempotency_key', v_claim.stripe_idempotency_key,
    'stripe_payment_intent_id', v_claim.stripe_payment_intent_id,
    'charge_id', v_claim.charge_id,
    'appointment_change_applied', v_claim.appointment_change_applied,
    'tender', v_claim.tender,
    'attempt', v_claim.attempt
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_policy_fee_intent(
  p_claim_id uuid,
  p_payment_intent_id text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_updated uuid;
  v_existing text;
BEGIN
  UPDATE public.policy_fee_claims
  SET stripe_payment_intent_id = p_payment_intent_id, updated_at = now()
  WHERE id = p_claim_id
    AND status = 'charging'
    AND (
      stripe_payment_intent_id IS NULL
      OR stripe_payment_intent_id = p_payment_intent_id
    )
  RETURNING id INTO v_updated;
  IF v_updated IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'saved');
  END IF;
  SELECT stripe_payment_intent_id INTO v_existing
  FROM public.policy_fee_claims WHERE id = p_claim_id;
  IF v_existing IS NOT DISTINCT FROM p_payment_intent_id THEN
    RETURN jsonb_build_object('outcome', 'saved');
  END IF;
  RETURN jsonb_build_object('outcome', 'different_intent');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_policy_fee_claim(
  p_claim_id uuid,
  p_charge_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.policy_fee_claims
  SET status = 'charged',
      charge_id = p_charge_id,
      updated_at = now()
  WHERE id = p_claim_id
    AND status = 'charging'
    AND (charge_id IS NULL OR charge_id = p_charge_id)
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_charging');
  END IF;
  RETURN jsonb_build_object('outcome', 'charged');
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_policy_fee_claim(
  p_claim_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claim public.policy_fee_claims%ROWTYPE;
BEGIN
  UPDATE public.policy_fee_claims
  SET status = 'failed', failure_reason = p_reason, updated_at = now()
  WHERE id = p_claim_id AND status = 'charging'
  RETURNING * INTO v_claim;
  IF v_claim.id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_charging');
  END IF;
  INSERT INTO public.policy_fee_attempts (
    claim_id, attempt, stripe_idempotency_key, stripe_payment_intent_id, status
  ) VALUES (
    v_claim.id, v_claim.attempt, v_claim.stripe_idempotency_key,
    v_claim.stripe_payment_intent_id, 'failed'
  )
  ON CONFLICT (claim_id, attempt) DO NOTHING;
  UPDATE public.policy_fee_coverage
  SET active = false,
      release_reason = 'charge_failed',
      released_at = now()
  WHERE claim_id = p_claim_id AND active;
  UPDATE public.visit_policy_locks
  SET claim_id = NULL
  WHERE visit_id = v_claim.visit_id AND claim_id = p_claim_id;
  RETURN jsonb_build_object('outcome', 'failed');
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
BEGIN
  UPDATE public.policy_fee_claims
  SET appointment_change_applied = true, updated_at = now()
  WHERE id = p_claim_id
    AND NOT appointment_change_applied
    AND status IN ('charged', 'waived', 'no_fee')
  RETURNING id, visit_id INTO v_id, v_visit;
  IF v_id IS NULL THEN
    SELECT visit_id, status, appointment_change_applied
      INTO v_visit, v_status, v_applied
    FROM public.policy_fee_claims
    WHERE id = p_claim_id;
    IF v_applied AND v_status IN ('charged', 'waived', 'no_fee') THEN
      UPDATE public.visit_policy_locks
      SET claim_id = NULL
      WHERE visit_id = v_visit AND claim_id = p_claim_id;
      RETURN jsonb_build_object('outcome', 'already_applied');
    END IF;
    RETURN jsonb_build_object('outcome', 'not_ready');
  END IF;
  UPDATE public.visit_policy_locks
  SET claim_id = NULL
  WHERE visit_id = v_visit AND claim_id = p_claim_id;
  RETURN jsonb_build_object('outcome', 'applied');
END;
$$;

CREATE OR REPLACE FUNCTION public.authorize_policy_fee_waiver(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_key text := p_input->>'idempotency_key';
  v_cap numeric := round((p_input->>'collect_cap')::numeric, 2);
  v_reason text := btrim(p_input->>'reason');
  v_actor uuid := (p_input->>'actor_id')::uuid;
  v_visit uuid := (p_input->>'visit_id')::uuid;
  v_action text := p_input->>'action';
  v_appointment uuid := NULLIF(p_input->>'appointment_id', '')::uuid;
  v_status text;
  v_id uuid;
BEGIN
  IF v_cap IS NULL OR v_cap < 0 OR char_length(v_reason) < 3 OR v_actor IS NULL THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  SELECT status INTO v_status
  FROM public.policy_fee_claims
  WHERE idempotency_key = v_key
  FOR UPDATE;
  IF v_status IN ('charging', 'charged', 'waived', 'no_fee') THEN
    RETURN jsonb_build_object('outcome', 'already_settled');
  END IF;
  UPDATE public.fee_waivers
  SET status = 'revoked', revoked_at = now(), revoked_by = v_actor, revoke_reason = v_reason
  WHERE idempotency_key = v_key AND status = 'authorized';
  INSERT INTO public.fee_waivers (
    idempotency_key, visit_id, action, appointment_id, collect_cap, cap_kind,
    status, reason, actor_id
  ) VALUES (
    v_key, v_visit, v_action, v_appointment, v_cap, 'fixed_amount',
    'authorized', v_reason, v_actor
  )
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('outcome', 'authorized', 'waiver_id', v_id, 'collect_cap', v_cap);
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_policy_fee_refund(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_charge public.appointment_charges%ROWTYPE;
  v_amount numeric := round((p_input->>'amount')::numeric, 2);
  v_expected numeric := round((p_input->>'expected_refunded')::numeric, 2);
  v_actor uuid := (p_input->>'actor_id')::uuid;
  v_reason text := btrim(p_input->>'reason');
  v_adjustment uuid;
  v_remaining numeric;
  v_visit uuid;
BEGIN
  IF v_amount IS NULL OR v_amount <= 0 OR char_length(v_reason) < 3 OR v_actor IS NULL THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  SELECT * INTO v_charge
  FROM public.appointment_charges
  WHERE id = (p_input->>'charge_id')::uuid
  FOR UPDATE;
  IF v_charge.id IS NULL OR v_charge.status <> 'paid' THEN
    RETURN jsonb_build_object('outcome', 'not_refundable');
  END IF;
  IF v_charge.refund_hold_id IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'in_progress', 'adjustment_id', v_charge.refund_hold_id);
  END IF;
  IF round(v_charge.refunded_amount, 2) IS DISTINCT FROM v_expected THEN
    RETURN jsonb_build_object('outcome', 'amount_conflict', 'refunded_amount', v_charge.refunded_amount);
  END IF;
  v_remaining := round(v_charge.total - v_charge.refunded_amount, 2);
  IF v_amount > v_remaining THEN
    RETURN jsonb_build_object('outcome', 'exceeds_remaining', 'remaining', v_remaining);
  END IF;
  v_visit := COALESCE(
    v_charge.visit_id,
    (SELECT visit_id FROM public.appointments WHERE id = v_charge.appointment_id)
  );
  IF v_visit IS NULL THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  INSERT INTO public.fee_adjustments (
    visit_id, appointment_id, claim_id, charge_id, fee_kind, action,
    original_amount, adjustment_amount, resulting_amount, actor_id, reason,
    result, tender, idempotency_key
  ) VALUES (
    v_visit,
    v_charge.appointment_id,
    v_charge.claim_id,
    v_charge.id,
    CASE v_charge.kind
      WHEN 'no_show' THEN 'no_show'
      WHEN 'cancellation' THEN 'cancellation'
      ELSE 'cancellation'
    END,
    'refund_requested',
    v_remaining,
    v_amount,
    round(v_remaining - v_amount, 2),
    v_actor,
    v_reason,
    'pending',
    v_charge.tender,
    'refund:' || v_charge.id::text || ':' || v_expected::text || ':' || v_amount::text
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_adjustment;
  IF v_adjustment IS NULL THEN
    SELECT id INTO v_adjustment FROM public.fee_adjustments
    WHERE idempotency_key = 'refund:' || v_charge.id::text || ':' || v_expected::text || ':' || v_amount::text;
  END IF;
  UPDATE public.appointment_charges
  SET refund_hold_id = v_adjustment
  WHERE id = v_charge.id AND refund_hold_id IS NULL AND refunded_amount = v_charge.refunded_amount;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'in_progress');
  END IF;
  RETURN jsonb_build_object(
    'outcome', 'pending',
    'adjustment_id', v_adjustment,
    'tender', v_charge.tender,
    'stripe_payment_intent_id', v_charge.stripe_payment_intent_id,
    'amount', v_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_policy_fee_refund(
  p_adjustment_id uuid,
  p_stripe_refund_id text,
  p_funds_confirmed_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_adjustment public.fee_adjustments%ROWTYPE;
  v_charge public.appointment_charges%ROWTYPE;
BEGIN
  SELECT * INTO v_adjustment
  FROM public.fee_adjustments
  WHERE id = p_adjustment_id
  FOR UPDATE;
  IF v_adjustment.id IS NULL OR v_adjustment.result <> 'pending' THEN
    RETURN jsonb_build_object('outcome', 'not_pending');
  END IF;
  SELECT * INTO v_charge
  FROM public.appointment_charges
  WHERE id = v_adjustment.charge_id AND refund_hold_id = p_adjustment_id
  FOR UPDATE;
  IF v_charge.id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'hold_missing');
  END IF;
  UPDATE public.appointment_charges
  SET refunded_amount = round(refunded_amount + v_adjustment.adjustment_amount, 2),
      refunded_at = now(),
      refund_hold_id = NULL
  WHERE id = v_charge.id
    AND refund_hold_id = p_adjustment_id
    AND round(refunded_amount, 2) = round(v_charge.refunded_amount, 2);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'amount_conflict');
  END IF;
  UPDATE public.fee_adjustments
  SET result = 'completed',
      stripe_refund_id = p_stripe_refund_id,
      completed_at = now(),
      funds_confirmed_at = CASE WHEN p_funds_confirmed_by IS NULL THEN NULL ELSE now() END,
      funds_confirmed_by = p_funds_confirmed_by
  WHERE id = p_adjustment_id;
  RETURN jsonb_build_object('outcome', 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_policy_fee_refund(p_adjustment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_charge uuid;
BEGIN
  UPDATE public.fee_adjustments
  SET result = 'failed', completed_at = now()
  WHERE id = p_adjustment_id AND result = 'pending'
  RETURNING charge_id INTO v_charge;
  IF v_charge IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_pending');
  END IF;
  UPDATE public.appointment_charges
  SET refund_hold_id = NULL
  WHERE refund_hold_id = p_adjustment_id;
  RETURN jsonb_build_object('outcome', 'failed');
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_policy_fee_coverage(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_visit uuid := (p_input->>'visit_id')::uuid;
  v_action text := p_input->>'action';
  v_base text := p_input->>'base_key';
  v_reason text := btrim(p_input->>'reason');
  v_actor uuid := (p_input->>'actor_id')::uuid;
  v_ids uuid[];
  v_count integer;
  v_reopen uuid := gen_random_uuid();
  v_key text;
BEGIN
  IF char_length(v_reason) < 3 OR v_actor IS NULL OR v_base IS NULL THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
    INTO v_ids
  FROM jsonb_array_elements_text(COALESCE(p_input->'coverage_ids', '[]'::jsonb)) AS value;
  UPDATE public.policy_fee_coverage
  SET active = false,
      release_reason = 'admin_reopen',
      released_by = v_actor,
      released_at = now()
  WHERE id = ANY (v_ids) AND visit_id = v_visit AND active;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count < 1 THEN
    RETURN jsonb_build_object('outcome', 'nothing_to_reopen');
  END IF;
  v_key := v_base || ':reopen:' || v_reopen::text;
  INSERT INTO public.policy_fee_reopens (
    id, visit_id, action, base_key, idempotency_key, reason, actor_id, status
  ) VALUES (
    v_reopen, v_visit, v_action, v_base, v_key, v_reason, v_actor, 'authorized'
  );
  INSERT INTO public.fee_adjustments (
    visit_id, fee_kind, action, original_amount, adjustment_amount, resulting_amount,
    actor_id, reason, result, idempotency_key, completed_at
  ) VALUES (
    v_visit,
    CASE v_action
      WHEN 'cancel' THEN 'cancellation'
      WHEN 'reschedule' THEN 'reschedule'
      WHEN 'remove_dog' THEN 'remove_dog'
      ELSE 'no_show'
    END,
    'coverage_reopened', 0, 0, 0, v_actor, v_reason, 'completed',
    'reopen:' || v_reopen::text, now()
  );
  RETURN jsonb_build_object('outcome', 'authorized', 'reopen_id', v_reopen, 'idempotency_key', v_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.review_legacy_policy_charge(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_charge public.appointment_charges%ROWTYPE;
  v_visit uuid := (p_input->>'visit_id')::uuid;
  v_class text := p_input->>'classification';
  v_travel boolean := COALESCE((p_input->>'covers_travel')::boolean, false);
  v_reason text := btrim(p_input->>'reason');
  v_actor uuid := (p_input->>'actor_id')::uuid;
  v_ids uuid[];
  v_review uuid;
BEGIN
  IF v_class NOT IN ('forfeit', 'non_forfeit') OR char_length(v_reason) < 3 THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  SELECT * INTO v_charge
  FROM public.appointment_charges
  WHERE id = (p_input->>'charge_id')::uuid;
  IF v_charge.id IS NULL OR v_charge.claim_id IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'not_legacy');
  END IF;
  IF v_charge.kind NOT IN ('cancellation', 'no_show') OR v_charge.status = 'failed' THEN
    RETURN jsonb_build_object('outcome', 'not_legacy');
  END IF;
  INSERT INTO public.policy_fee_legacy_reviews (
    charge_id, visit_id, classification, covers_travel, reason, actor_id
  ) VALUES (
    v_charge.id, v_visit, v_class, v_travel, v_reason, v_actor
  )
  RETURNING id INTO v_review;
  IF v_class = 'forfeit' THEN
    SELECT COALESCE(array_agg(value::uuid), '{}'::uuid[])
      INTO v_ids
    FROM jsonb_array_elements_text(COALESCE(p_input->'appointment_ids', '[]'::jsonb)) AS value;
    INSERT INTO public.policy_fee_coverage (
      legacy_review_id, visit_id, appointment_id, component
    )
    SELECT v_review, v_visit, appointment_id, 'service'
    FROM unnest(v_ids) AS appointment_id;
    IF v_travel THEN
      INSERT INTO public.policy_fee_coverage (legacy_review_id, visit_id, component)
      VALUES (v_review, v_visit, 'travel');
    END IF;
  END IF;
  RETURN jsonb_build_object('outcome', 'reviewed', 'review_id', v_review);
END;
$$;

CREATE OR REPLACE FUNCTION public.visit_no_show_reports_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'confirmed' THEN
      RAISE EXCEPTION 'no-show evidence must be saved as a draft before it is confirmed';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    IF OLD.status <> 'draft'
      OR NEW.customer_replied
      OR NEW.handoff_arranged
      OR NEW.confirmed_by IS NULL
      OR NEW.contact_attempted_at > now() - interval '15 minutes'
    THEN
      RAISE EXCEPTION 'no-show evidence is not ready to confirm';
    END IF;
  END IF;
  IF OLD.status = 'confirmed' THEN
    IF NEW.arrived_at IS DISTINCT FROM OLD.arrived_at
      OR NEW.contact_attempted_at IS DISTINCT FROM OLD.contact_attempted_at
      OR NEW.contact_channel IS DISTINCT FROM OLD.contact_channel
      OR NEW.customer_replied IS DISTINCT FROM OLD.customer_replied
      OR NEW.handoff_arranged IS DISTINCT FROM OLD.handoff_arranged
      OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
    THEN
      RAISE EXCEPTION 'confirmed no-show evidence cannot be edited';
    END IF;
    IF OLD.charge_id IS NOT NULL AND NEW.charge_id IS DISTINCT FROM OLD.charge_id THEN
      RAISE EXCEPTION 'no-show charge link cannot change';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visit_no_show_reports_guard ON public.visit_no_show_reports;
CREATE TRIGGER visit_no_show_reports_guard
  BEFORE INSERT OR UPDATE ON public.visit_no_show_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.visit_no_show_reports_guard();

CREATE OR REPLACE FUNCTION public.fee_adjustments_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'fee adjustments cannot be deleted';
  END IF;
  IF NEW.original_amount IS DISTINCT FROM OLD.original_amount
    OR NEW.adjustment_amount IS DISTINCT FROM OLD.adjustment_amount
    OR NEW.resulting_amount IS DISTINCT FROM OLD.resulting_amount
    OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.charge_id IS DISTINCT FROM OLD.charge_id
    OR NEW.claim_id IS DISTINCT FROM OLD.claim_id
    OR NEW.action IS DISTINCT FROM OLD.action
  THEN
    RAISE EXCEPTION 'fee adjustment amounts and reasons cannot change';
  END IF;
  IF OLD.result <> 'pending' OR NEW.result NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'fee adjustment result cannot change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fee_adjustments_immutable ON public.fee_adjustments;
CREATE TRIGGER fee_adjustments_immutable
  BEFORE UPDATE OR DELETE ON public.fee_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.fee_adjustments_immutable();

REVOKE ALL ON FUNCTION public.policy_fee_amounts(numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_policy_fee_claim(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_policy_fee_intent(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_policy_fee_claim(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_policy_fee_claim(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_policy_fee_change_applied(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authorize_policy_fee_waiver(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_policy_fee_refund(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_policy_fee_refund(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_policy_fee_refund(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_policy_fee_coverage(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_legacy_policy_charge(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.visit_no_show_reports_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fee_adjustments_immutable() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.policy_fee_amounts(numeric, numeric) TO service_role;
    GRANT EXECUTE ON FUNCTION public.begin_policy_fee_claim(jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.record_policy_fee_intent(uuid, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.complete_policy_fee_claim(uuid, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.fail_policy_fee_claim(uuid, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.mark_policy_fee_change_applied(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.authorize_policy_fee_waiver(jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.begin_policy_fee_refund(jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.complete_policy_fee_refund(uuid, text, uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.fail_policy_fee_refund(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.reopen_policy_fee_coverage(jsonb) TO service_role;
    GRANT EXECUTE ON FUNCTION public.review_legacy_policy_charge(jsonb) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.begin_policy_fee_claim(jsonb) FROM anon;
    REVOKE ALL ON FUNCTION public.authorize_policy_fee_waiver(jsonb) FROM anon;
    REVOKE ALL ON FUNCTION public.begin_policy_fee_refund(jsonb) FROM anon;
    REVOKE ALL ON FUNCTION public.complete_policy_fee_refund(uuid, text, uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.reopen_policy_fee_coverage(jsonb) FROM anon;
    REVOKE ALL ON FUNCTION public.review_legacy_policy_charge(jsonb) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.begin_policy_fee_claim(jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION public.authorize_policy_fee_waiver(jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION public.begin_policy_fee_refund(jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION public.complete_policy_fee_refund(uuid, text, uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.reopen_policy_fee_coverage(jsonb) FROM authenticated;
    REVOKE ALL ON FUNCTION public.review_legacy_policy_charge(jsonb) FROM authenticated;
  END IF;
END $$;

ALTER TABLE public.policy_fee_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_fee_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_fee_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_fee_reopens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_fee_legacy_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_no_show_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_policy_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.policy_fee_claims FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_fee_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_fee_coverage FROM PUBLIC;
REVOKE ALL ON TABLE public.fee_waivers FROM PUBLIC;
REVOKE ALL ON TABLE public.fee_adjustments FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_fee_reopens FROM PUBLIC;
REVOKE ALL ON TABLE public.policy_fee_legacy_reviews FROM PUBLIC;
REVOKE ALL ON TABLE public.visit_no_show_reports FROM PUBLIC;
REVOKE ALL ON TABLE public.visit_policy_locks FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.policy_fee_claims FROM anon;
    REVOKE ALL ON TABLE public.policy_fee_attempts FROM anon;
    REVOKE ALL ON TABLE public.policy_fee_coverage FROM anon;
    REVOKE ALL ON TABLE public.fee_waivers FROM anon;
    REVOKE ALL ON TABLE public.fee_adjustments FROM anon;
    REVOKE ALL ON TABLE public.policy_fee_reopens FROM anon;
    REVOKE ALL ON TABLE public.policy_fee_legacy_reviews FROM anon;
    REVOKE ALL ON TABLE public.visit_no_show_reports FROM anon;
    REVOKE ALL ON TABLE public.visit_policy_locks FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.policy_fee_claims FROM authenticated;
    REVOKE ALL ON TABLE public.policy_fee_attempts FROM authenticated;
    REVOKE ALL ON TABLE public.policy_fee_coverage FROM authenticated;
    REVOKE ALL ON TABLE public.fee_waivers FROM authenticated;
    REVOKE ALL ON TABLE public.fee_adjustments FROM authenticated;
    REVOKE ALL ON TABLE public.policy_fee_reopens FROM authenticated;
    REVOKE ALL ON TABLE public.policy_fee_legacy_reviews FROM authenticated;
    REVOKE ALL ON TABLE public.visit_no_show_reports FROM authenticated;
    REVOKE ALL ON TABLE public.visit_policy_locks FROM authenticated;
    GRANT SELECT ON TABLE public.policy_fee_claims TO authenticated;
    GRANT SELECT ON TABLE public.policy_fee_attempts TO authenticated;
    GRANT SELECT ON TABLE public.policy_fee_coverage TO authenticated;
    GRANT SELECT ON TABLE public.fee_waivers TO authenticated;
    GRANT SELECT ON TABLE public.fee_adjustments TO authenticated;
    GRANT SELECT ON TABLE public.policy_fee_reopens TO authenticated;
    GRANT SELECT ON TABLE public.policy_fee_legacy_reviews TO authenticated;
    GRANT SELECT ON TABLE public.visit_no_show_reports TO authenticated;
    GRANT SELECT ON TABLE public.visit_policy_locks TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON TABLE public.policy_fee_claims TO service_role;
    GRANT ALL ON TABLE public.policy_fee_attempts TO service_role;
    GRANT ALL ON TABLE public.policy_fee_coverage TO service_role;
    GRANT ALL ON TABLE public.fee_waivers TO service_role;
    GRANT ALL ON TABLE public.fee_adjustments TO service_role;
    GRANT ALL ON TABLE public.policy_fee_reopens TO service_role;
    GRANT ALL ON TABLE public.policy_fee_legacy_reviews TO service_role;
    GRANT ALL ON TABLE public.visit_no_show_reports TO service_role;
    GRANT ALL ON TABLE public.visit_policy_locks TO service_role;
  END IF;
END $$;

DROP POLICY IF EXISTS policy_fee_claims_staff_select ON public.policy_fee_claims;
CREATE POLICY policy_fee_claims_staff_select ON public.policy_fee_claims
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS policy_fee_attempts_staff_select ON public.policy_fee_attempts;
CREATE POLICY policy_fee_attempts_staff_select ON public.policy_fee_attempts
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS policy_fee_coverage_staff_select ON public.policy_fee_coverage;
CREATE POLICY policy_fee_coverage_staff_select ON public.policy_fee_coverage
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS fee_waivers_staff_select ON public.fee_waivers;
CREATE POLICY fee_waivers_staff_select ON public.fee_waivers
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS fee_adjustments_staff_select ON public.fee_adjustments;
CREATE POLICY fee_adjustments_staff_select ON public.fee_adjustments
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS policy_fee_reopens_staff_select ON public.policy_fee_reopens;
CREATE POLICY policy_fee_reopens_staff_select ON public.policy_fee_reopens
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS policy_fee_legacy_reviews_staff_select ON public.policy_fee_legacy_reviews;
CREATE POLICY policy_fee_legacy_reviews_staff_select ON public.policy_fee_legacy_reviews
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS visit_no_show_reports_staff_select ON public.visit_no_show_reports;
CREATE POLICY visit_no_show_reports_staff_select ON public.visit_no_show_reports
  FOR SELECT TO authenticated USING (private.is_staff());
DROP POLICY IF EXISTS visit_policy_locks_staff_select ON public.visit_policy_locks;
CREATE POLICY visit_policy_locks_staff_select ON public.visit_policy_locks
  FOR SELECT TO authenticated USING (private.is_staff());

COMMIT;
