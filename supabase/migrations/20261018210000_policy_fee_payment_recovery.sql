-- Payment recovery for policy fees.
-- Does not UPDATE appointment_charges totals or historical Stripe ids.
-- Unknown card results stay charging and keep the visit lock.

BEGIN;

ALTER TABLE public.policy_fee_claims
  ADD COLUMN IF NOT EXISTS payment_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS change_started_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'policy_fee_claims_payment_state_check'
  ) THEN
    ALTER TABLE public.policy_fee_claims
      ADD CONSTRAINT policy_fee_claims_payment_state_check
      CHECK (
        payment_state IN (
          'none',
          'submitting',
          'awaiting_customer',
          'processing',
          'succeeded',
          'failed',
          'canceled',
          'unknown'
        )
      );
  END IF;
END $$;

ALTER TABLE public.policy_fee_attempts
  DROP CONSTRAINT IF EXISTS policy_fee_attempts_status_check;

ALTER TABLE public.policy_fee_attempts
  ADD CONSTRAINT policy_fee_attempts_status_check
  CHECK (
    status IN (
      'submitting',
      'awaiting_customer',
      'processing',
      'succeeded',
      'failed',
      'canceled',
      'unknown'
    )
  );

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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS policy_fee_claims_reset_payment ON public.policy_fee_claims;
CREATE TRIGGER policy_fee_claims_reset_payment
  BEFORE UPDATE ON public.policy_fee_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.policy_fee_claims_reset_payment();

CREATE OR REPLACE FUNCTION public.reserve_policy_fee_stripe_submit(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claim public.policy_fee_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim
  FROM public.policy_fee_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF v_claim.id IS NULL OR v_claim.status <> 'charging' THEN
    RETURN jsonb_build_object('outcome', 'not_charging');
  END IF;
  IF v_claim.stripe_payment_intent_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'known',
      'payment_intent_id', v_claim.stripe_payment_intent_id,
      'payment_state', v_claim.payment_state,
      'stripe_idempotency_key', v_claim.stripe_idempotency_key
    );
  END IF;
  IF v_claim.payment_state = 'none' AND v_claim.stripe_submitted_at IS NULL THEN
    UPDATE public.policy_fee_claims
    SET payment_state = 'submitting',
        stripe_submitted_at = now(),
        updated_at = now()
    WHERE id = p_claim_id
      AND payment_state = 'none'
      AND stripe_submitted_at IS NULL
      AND stripe_payment_intent_id IS NULL
    RETURNING * INTO v_claim;
    IF v_claim.id IS NULL THEN
      SELECT * INTO v_claim FROM public.policy_fee_claims WHERE id = p_claim_id;
      RETURN jsonb_build_object(
        'outcome', 'reconcile',
        'payment_state', v_claim.payment_state,
        'stripe_idempotency_key', v_claim.stripe_idempotency_key
      );
    END IF;
    INSERT INTO public.policy_fee_attempts (
      claim_id, attempt, stripe_idempotency_key, status
    ) VALUES (
      v_claim.id, v_claim.attempt, v_claim.stripe_idempotency_key, 'submitting'
    )
    ON CONFLICT (claim_id, attempt) DO NOTHING;
    RETURN jsonb_build_object(
      'outcome', 'submit',
      'stripe_idempotency_key', v_claim.stripe_idempotency_key,
      'payment_state', v_claim.payment_state
    );
  END IF;
  RETURN jsonb_build_object(
    'outcome', 'reconcile',
    'payment_state', v_claim.payment_state,
    'stripe_idempotency_key', v_claim.stripe_idempotency_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_policy_fee_payment(
  p_claim_id uuid,
  p_payment_intent_id text,
  p_state text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claim public.policy_fee_claims%ROWTYPE;
  v_updated uuid;
BEGIN
  IF p_state NOT IN (
    'awaiting_customer', 'processing', 'succeeded', 'failed', 'canceled', 'unknown'
  ) OR p_payment_intent_id IS NULL OR btrim(p_payment_intent_id) = '' THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;
  SELECT * INTO v_claim
  FROM public.policy_fee_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF v_claim.id IS NULL OR v_claim.status <> 'charging' THEN
    RETURN jsonb_build_object('outcome', 'not_charging');
  END IF;
  IF v_claim.stripe_payment_intent_id IS NOT NULL
    AND v_claim.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id
  THEN
    RETURN jsonb_build_object('outcome', 'different_intent');
  END IF;
  UPDATE public.policy_fee_claims
  SET stripe_payment_intent_id = p_payment_intent_id,
      payment_state = p_state,
      updated_at = now()
  WHERE id = p_claim_id
    AND status = 'charging'
    AND (
      stripe_payment_intent_id IS NULL
      OR stripe_payment_intent_id = p_payment_intent_id
    )
  RETURNING id INTO v_updated;
  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('outcome', 'different_intent');
  END IF;
  UPDATE public.policy_fee_attempts
  SET stripe_payment_intent_id = p_payment_intent_id,
      status = p_state
  WHERE claim_id = p_claim_id
    AND attempt = v_claim.attempt;
  RETURN jsonb_build_object('outcome', 'saved', 'payment_state', p_state);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_policy_fee_payment_unknown(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_claim public.policy_fee_claims%ROWTYPE;
BEGIN
  SELECT * INTO v_claim
  FROM public.policy_fee_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF v_claim.id IS NULL OR v_claim.status <> 'charging' THEN
    RETURN jsonb_build_object('outcome', 'not_charging');
  END IF;
  IF v_claim.payment_state IN ('succeeded', 'failed', 'canceled') THEN
    RETURN jsonb_build_object('outcome', 'definite', 'payment_state', v_claim.payment_state);
  END IF;
  IF v_claim.payment_state = 'none' AND v_claim.stripe_submitted_at IS NULL THEN
    RETURN jsonb_build_object('outcome', 'not_submitted');
  END IF;
  UPDATE public.policy_fee_claims
  SET payment_state = 'unknown', updated_at = now()
  WHERE id = p_claim_id AND status = 'charging';
  UPDATE public.policy_fee_attempts
  SET status = 'unknown'
  WHERE claim_id = p_claim_id AND attempt = v_claim.attempt;
  RETURN jsonb_build_object('outcome', 'unknown');
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
  SELECT * INTO v_claim
  FROM public.policy_fee_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF v_claim.id IS NULL OR v_claim.status <> 'charging' THEN
    RETURN jsonb_build_object('outcome', 'not_charging');
  END IF;
  IF v_claim.tender = 'card'
    AND v_claim.charged_amount > 0
    AND v_claim.payment_state NOT IN ('failed', 'canceled')
  THEN
    RETURN jsonb_build_object(
      'outcome', 'unconfirmed',
      'payment_state', v_claim.payment_state
    );
  END IF;
  UPDATE public.policy_fee_claims
  SET status = 'failed', failure_reason = p_reason, updated_at = now()
  WHERE id = p_claim_id AND status = 'charging'
  RETURNING * INTO v_claim;
  INSERT INTO public.policy_fee_attempts (
    claim_id, attempt, stripe_idempotency_key, stripe_payment_intent_id, status
  ) VALUES (
    v_claim.id, v_claim.attempt, v_claim.stripe_idempotency_key,
    v_claim.stripe_payment_intent_id, 'failed'
  )
  ON CONFLICT (claim_id, attempt) DO UPDATE
  SET status = 'failed',
      stripe_payment_intent_id = EXCLUDED.stripe_payment_intent_id
  WHERE public.policy_fee_attempts.status IS DISTINCT FROM 'succeeded';
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

CREATE OR REPLACE FUNCTION public.acquire_policy_fee_change(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_applied boolean;
  v_started timestamptz;
  v_status text;
  v_id uuid;
BEGIN
  SELECT appointment_change_applied, change_started_at, status
    INTO v_applied, v_started, v_status
  FROM public.policy_fee_claims
  WHERE id = p_claim_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'missing');
  END IF;
  IF v_applied THEN
    RETURN jsonb_build_object('outcome', 'already');
  END IF;
  IF v_status NOT IN ('charged', 'waived', 'no_fee') THEN
    RETURN jsonb_build_object('outcome', 'not_ready');
  END IF;
  IF v_started IS NOT NULL THEN
    RETURN jsonb_build_object('outcome', 'busy');
  END IF;
  UPDATE public.policy_fee_claims
  SET change_started_at = now(), updated_at = now()
  WHERE id = p_claim_id
    AND change_started_at IS NULL
    AND NOT appointment_change_applied
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
  SET change_started_at = NULL, updated_at = now()
  WHERE id = p_claim_id
    AND NOT appointment_change_applied
    AND change_started_at IS NOT NULL
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'kept');
  END IF;
  RETURN jsonb_build_object('outcome', 'released');
END;
$$;

REVOKE ALL ON FUNCTION public.policy_fee_claims_reset_payment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_policy_fee_stripe_submit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_policy_fee_payment(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_policy_fee_payment_unknown(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_policy_fee_change(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_policy_fee_change(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_policy_fee_claim(uuid, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.reserve_policy_fee_stripe_submit(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.record_policy_fee_payment(uuid, text, text) TO service_role;
    GRANT EXECUTE ON FUNCTION public.mark_policy_fee_payment_unknown(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.acquire_policy_fee_change(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.release_policy_fee_change(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.fail_policy_fee_claim(uuid, text) TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.reserve_policy_fee_stripe_submit(uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.record_policy_fee_payment(uuid, text, text) FROM anon;
    REVOKE ALL ON FUNCTION public.mark_policy_fee_payment_unknown(uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.acquire_policy_fee_change(uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.release_policy_fee_change(uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.fail_policy_fee_claim(uuid, text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.reserve_policy_fee_stripe_submit(uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.record_policy_fee_payment(uuid, text, text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.mark_policy_fee_payment_unknown(uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.acquire_policy_fee_change(uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.release_policy_fee_change(uuid) FROM authenticated;
    REVOKE ALL ON FUNCTION public.fail_policy_fee_claim(uuid, text) FROM authenticated;
  END IF;
END $$;

COMMIT;
