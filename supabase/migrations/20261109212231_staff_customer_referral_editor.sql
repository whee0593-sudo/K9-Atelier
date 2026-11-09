BEGIN;

CREATE FUNCTION public.staff_update_customer_referrals(
  p_customer_id uuid,
  p_admin_id uuid,
  p_source text,
  p_name text,
  p_expected_balance integer,
  p_target_balance integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  previous_source text;
  previous_name text;
  previous_balance integer;
  next_balance integer;
  delta integer;
  entry_id uuid;
BEGIN
  IF p_target_balance < 0 OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'invalid_referral_adjustment';
  END IF;

  -- Checkout takes the same lock when reserving credit.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_customer_id::text));

  SELECT referral_source, referral_name INTO previous_source, previous_name
  FROM public.profiles
  WHERE id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  previous_balance := public.referral_available_cents(p_customer_id);
  IF p_target_balance IS NOT NULL AND previous_balance IS DISTINCT FROM p_expected_balance THEN
    RAISE EXCEPTION 'referral_balance_changed';
  END IF;
  next_balance := COALESCE(p_target_balance, previous_balance);
  delta := next_balance - previous_balance;

  IF delta <> 0 THEN
    INSERT INTO public.referral_credit_ledger (
      customer_id, entry_type, amount_cents, balance_effect_cents, status,
      confirmed_at, metadata
    ) VALUES (
      p_customer_id, 'adjustment', abs(delta), delta, 'confirmed',
      now(), jsonb_build_object('admin', true, 'source', 'customer_profile')
    ) RETURNING id INTO entry_id;
  END IF;

  IF previous_source IS DISTINCT FROM p_source OR previous_name IS DISTINCT FROM p_name THEN
    UPDATE public.profiles
    SET referral_source = p_source, referral_name = p_name
    WHERE id = p_customer_id;
  ELSIF delta = 0 THEN
    RETURN next_balance;
  END IF;

  INSERT INTO public.referral_audit_log (
    customer_id, admin_user_id, ledger_entry_id, action, previous_value, new_value
  ) VALUES (
    p_customer_id, p_admin_id, entry_id, 'update_customer_referrals',
    jsonb_build_object('source', previous_source, 'name', previous_name, 'balanceCents', previous_balance),
    jsonb_build_object('source', p_source, 'name', p_name, 'balanceCents', next_balance)
  );
  RETURN next_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_update_customer_referrals(uuid, uuid, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_update_customer_referrals(uuid, uuid, text, text, integer, integer)
  TO service_role;

ALTER POLICY referral_credit_ledger_select_own_or_staff ON public.referral_credit_ledger
  USING (private.is_staff());
ALTER POLICY referral_reward_sources_select_own_or_staff ON public.referral_reward_sources
  USING (private.is_staff());

-- Keep existing profile reads available while withholding referral attribution.
REVOKE SELECT ON public.profiles FROM authenticated;
DO $$
DECLARE
  visible_columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum)
  INTO visible_columns
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.profiles'::regclass
    AND attnum > 0 AND NOT attisdropped
    AND attname NOT IN ('referral_source', 'referral_name');
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', visible_columns);
END;
$$;

COMMIT;
