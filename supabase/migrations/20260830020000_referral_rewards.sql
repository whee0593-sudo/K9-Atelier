-- Referral Rewards: pet codes, relationships, reward sources, cents ledger, audit.
-- Non-destructive. Does not alter existing customer, pet, or payment rows.
--
-- Ledger rules:
--   * status is the only reservation/lifecycle source of truth
--     (reserved | confirmed | released | reversed | under_review)
--   * Monetary history is append-only. Release/reverse keeps the original
--     debit amount and balance_effect_cents, then inserts one reversal row.
--
-- Rollback (plan only — do not run against production unless requested):
--   DROP FUNCTION IF EXISTS public.release_expired_referral_reservations();
--   DROP FUNCTION IF EXISTS public.reserve_referral_credit(uuid, uuid, uuid, integer, uuid);
--   DROP FUNCTION IF EXISTS public.referral_available_cents(uuid);
--   DROP POLICY IF EXISTS pet_referral_codes_select_own_or_staff ON public.pet_referral_codes;
--   DROP POLICY IF EXISTS referral_relationships_select_own_or_staff ON public.referral_relationships;
--   DROP POLICY IF EXISTS referral_reward_sources_select_own_or_staff ON public.referral_reward_sources;
--   DROP POLICY IF EXISTS referral_credit_ledger_select_own_or_staff ON public.referral_credit_ledger;
--   DROP POLICY IF EXISTS referral_audit_log_select_staff ON public.referral_audit_log;
--   DROP TABLE IF EXISTS public.referral_audit_log;
--   DROP TABLE IF EXISTS public.referral_credit_ledger;
--   DROP TABLE IF EXISTS public.referral_reward_sources;
--   DROP TABLE IF EXISTS public.referral_relationships;
--   DROP TABLE IF EXISTS public.pet_referral_codes;
--   ALTER TABLE public.appointment_charges DROP COLUMN IF EXISTS referral_credit_applied;
--   ALTER TABLE public.appointment_charges DROP COLUMN IF EXISTS new_client_discount;
--   ALTER TABLE public.appointments DROP COLUMN IF EXISTS referral_code;

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS referral_code text;

ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS new_client_discount numeric NOT NULL DEFAULT 0
    CHECK (new_client_discount >= 0);
ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS referral_credit_applied numeric NOT NULL DEFAULT 0
    CHECK (referral_credit_applied >= 0);

CREATE TABLE IF NOT EXISTS public.pet_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE CASCADE,
  owner_customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  referral_code_normalized text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pet_id),
  UNIQUE (referral_code_normalized)
);

CREATE INDEX IF NOT EXISTS pet_referral_codes_owner_idx
  ON public.pet_referral_codes (owner_customer_id);

CREATE TABLE IF NOT EXISTS public.referral_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.pet_referral_codes (id),
  referrer_customer_id uuid NOT NULL REFERENCES public.profiles (id),
  referrer_pet_id uuid NOT NULL REFERENCES public.pets (id),
  referred_customer_id uuid NOT NULL REFERENCES public.profiles (id),
  first_appointment_id uuid REFERENCES public.appointments (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled', 'under_review')),
  review_required boolean NOT NULL DEFAULT false,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  completed_at timestamptz,
  UNIQUE (referred_customer_id),
  CHECK (referrer_customer_id <> referred_customer_id)
);

CREATE INDEX IF NOT EXISTS referral_relationships_referrer_idx
  ON public.referral_relationships (referrer_customer_id, status);

CREATE TABLE IF NOT EXISTS public.referral_reward_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_relationship_id uuid NOT NULL REFERENCES public.referral_relationships (id),
  referrer_customer_id uuid NOT NULL REFERENCES public.profiles (id),
  referred_customer_id uuid NOT NULL REFERENCES public.profiles (id),
  source_appointment_id uuid REFERENCES public.appointments (id) ON DELETE SET NULL,
  source_charge_id uuid NOT NULL REFERENCES public.appointment_charges (id),
  visit_key text,
  source_payment_id text,
  eligible_subtotal_cents integer NOT NULL CHECK (eligible_subtotal_cents >= 0),
  new_client_discount_cents integer NOT NULL CHECK (new_client_discount_cents >= 0),
  reward_credit_cents integer NOT NULL CHECK (reward_credit_cents >= 0),
  remaining_credit_cents integer NOT NULL CHECK (remaining_credit_cents >= 0),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN (
      'pending',
      'available',
      'partially_used',
      'redeemed',
      'cancelled',
      'under_review'
    )),
  issued_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_charge_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_reward_sources_visit_uidx
  ON public.referral_reward_sources (referral_relationship_id, visit_key)
  WHERE visit_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS referral_reward_sources_referrer_idx
  ON public.referral_reward_sources (referrer_customer_id, status);

CREATE TABLE IF NOT EXISTS public.referral_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles (id),
  reward_source_id uuid REFERENCES public.referral_reward_sources (id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('credit', 'debit', 'adjustment', 'reversal')),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  balance_effect_cents integer NOT NULL,
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE SET NULL,
  charge_id uuid REFERENCES public.appointment_charges (id) ON DELETE SET NULL,
  payment_id text,
  stripe_payment_intent_id text,
  related_ledger_entry_id uuid REFERENCES public.referral_credit_ledger (id),
  status text NOT NULL DEFAULT 'confirmed'
    CHECK (status IN (
      'reserved',
      'confirmed',
      'released',
      'reversed',
      'under_review'
    )),
  reservation_expires_at timestamptz,
  released_at timestamptz,
  release_reason text,
  reserved_by_admin_id uuid REFERENCES auth.users (id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  reversed_at timestamptz
);

ALTER TABLE public.referral_credit_ledger
  ADD COLUMN IF NOT EXISTS related_ledger_entry_id uuid
    REFERENCES public.referral_credit_ledger (id);
ALTER TABLE public.referral_credit_ledger
  DROP COLUMN IF EXISTS reservation_status;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referral_ledger_debit_effect_chk'
  ) THEN
    ALTER TABLE public.referral_credit_ledger
      ADD CONSTRAINT referral_ledger_debit_effect_chk
      CHECK (entry_type <> 'debit' OR balance_effect_cents = -amount_cents);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referral_ledger_reversal_related_chk'
  ) THEN
    ALTER TABLE public.referral_credit_ledger
      ADD CONSTRAINT referral_ledger_reversal_related_chk
      CHECK (entry_type <> 'reversal' OR related_ledger_entry_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'referral_ledger_reversal_effect_chk'
  ) THEN
    ALTER TABLE public.referral_credit_ledger
      ADD CONSTRAINT referral_ledger_reversal_effect_chk
      CHECK (entry_type <> 'reversal' OR balance_effect_cents = amount_cents);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS referral_ledger_one_open_debit_per_charge_uidx
  ON public.referral_credit_ledger (charge_id)
  WHERE entry_type = 'debit'
    AND status IN ('reserved', 'confirmed', 'under_review');

CREATE UNIQUE INDEX IF NOT EXISTS referral_ledger_one_reversal_per_entry_uidx
  ON public.referral_credit_ledger (related_ledger_entry_id)
  WHERE entry_type = 'reversal' AND related_ledger_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS referral_ledger_expire_idx
  ON public.referral_credit_ledger (reservation_expires_at)
  WHERE status = 'reserved' AND stripe_payment_intent_id IS NULL;

CREATE INDEX IF NOT EXISTS referral_credit_ledger_customer_idx
  ON public.referral_credit_ledger (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_relationship_id uuid REFERENCES public.referral_relationships (id),
  reward_source_id uuid REFERENCES public.referral_reward_sources (id),
  ledger_entry_id uuid REFERENCES public.referral_credit_ledger (id),
  customer_id uuid REFERENCES public.profiles (id),
  admin_user_id uuid REFERENCES auth.users (id),
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_audit_log_created_idx
  ON public.referral_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.referral_available_cents(p_customer_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(balance_effect_cents), 0)::integer
  FROM public.referral_credit_ledger
  WHERE customer_id = p_customer_id;
$$;

CREATE OR REPLACE FUNCTION public.reserve_referral_credit(
  p_customer_id uuid,
  p_charge_id uuid,
  p_appointment_id uuid,
  p_amount_cents integer,
  p_admin_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  available integer;
  entry_id uuid;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_customer_id::text));

  SELECT public.referral_available_cents(p_customer_id) INTO available;
  IF available < p_amount_cents THEN
    RAISE EXCEPTION 'insufficient_credit';
  END IF;

  INSERT INTO public.referral_credit_ledger (
    customer_id,
    entry_type,
    amount_cents,
    balance_effect_cents,
    appointment_id,
    charge_id,
    status,
    reservation_expires_at,
    reserved_by_admin_id,
    metadata
  )
  VALUES (
    p_customer_id,
    'debit',
    p_amount_cents,
    -p_amount_cents,
    p_appointment_id,
    p_charge_id,
    'reserved',
    now() + interval '30 minutes',
    p_admin_id,
    jsonb_build_object('source', 'collect')
  )
  RETURNING id INTO entry_id;

  RETURN entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_expired_referral_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer := 0;
BEGIN
  WITH expired AS (
    SELECT ledger.id
    FROM public.referral_credit_ledger AS ledger
    LEFT JOIN public.appointment_charges AS charges
      ON charges.id = ledger.charge_id
    WHERE ledger.entry_type = 'debit'
      AND ledger.status = 'reserved'
      AND ledger.stripe_payment_intent_id IS NULL
      AND ledger.reservation_expires_at IS NOT NULL
      AND ledger.reservation_expires_at <= now()
      AND COALESCE(charges.status, 'pending') <> 'paid'
      AND NOT EXISTS (
        SELECT 1
        FROM public.referral_credit_ledger AS reversal
        WHERE reversal.entry_type = 'reversal'
          AND reversal.related_ledger_entry_id = ledger.id
      )
  ),
  updated AS (
    UPDATE public.referral_credit_ledger AS ledger
    SET
      status = 'released',
      released_at = now(),
      release_reason = 'expired_no_payment_intent'
    FROM expired
    WHERE ledger.id = expired.id
      AND ledger.status = 'reserved'
    RETURNING
      ledger.id,
      ledger.customer_id,
      ledger.appointment_id,
      ledger.charge_id,
      ledger.amount_cents,
      ledger.balance_effect_cents
  ),
  reversed AS (
    INSERT INTO public.referral_credit_ledger (
      customer_id,
      entry_type,
      amount_cents,
      balance_effect_cents,
      appointment_id,
      charge_id,
      related_ledger_entry_id,
      status,
      confirmed_at,
      metadata
    )
    SELECT
      updated.customer_id,
      'reversal',
      updated.amount_cents,
      -updated.balance_effect_cents,
      updated.appointment_id,
      updated.charge_id,
      updated.id,
      'confirmed',
      now(),
      jsonb_build_object(
        'source', 'auto_expire',
        'related_ledger_entry_id', updated.id
      )
    FROM updated
    ON CONFLICT (related_ledger_entry_id)
      WHERE entry_type = 'reversal' AND related_ledger_entry_id IS NOT NULL
      DO NOTHING
    RETURNING id, related_ledger_entry_id
  ),
  audited AS (
    INSERT INTO public.referral_audit_log (
      ledger_entry_id,
      customer_id,
      action,
      previous_value,
      new_value,
      reason
    )
    SELECT
      updated.id,
      updated.customer_id,
      'auto_release_expired_reservation',
      jsonb_build_object('status', 'reserved', 'debitId', updated.id),
      jsonb_build_object(
        'status', 'released',
        'debitId', updated.id,
        'reversalId', reversed.id
      ),
      'Collect reservation expired before a PaymentIntent was created.'
    FROM updated
    LEFT JOIN reversed ON reversed.related_ledger_entry_id = updated.id
    RETURNING ledger_entry_id
  )
  SELECT COUNT(*) INTO released_count FROM audited;
  RETURN COALESCE(released_count, 0);
END;
$$;

REVOKE ALL ON TABLE public.pet_referral_codes FROM PUBLIC;
REVOKE ALL ON TABLE public.pet_referral_codes FROM anon;
REVOKE ALL ON TABLE public.referral_relationships FROM PUBLIC;
REVOKE ALL ON TABLE public.referral_relationships FROM anon;
REVOKE ALL ON TABLE public.referral_reward_sources FROM PUBLIC;
REVOKE ALL ON TABLE public.referral_reward_sources FROM anon;
REVOKE ALL ON TABLE public.referral_credit_ledger FROM PUBLIC;
REVOKE ALL ON TABLE public.referral_credit_ledger FROM anon;
REVOKE ALL ON TABLE public.referral_audit_log FROM PUBLIC;
REVOKE ALL ON TABLE public.referral_audit_log FROM anon;
REVOKE ALL ON TABLE public.referral_audit_log FROM authenticated;

GRANT SELECT ON TABLE public.pet_referral_codes TO authenticated;
GRANT SELECT ON TABLE public.referral_relationships TO authenticated;
GRANT SELECT ON TABLE public.referral_reward_sources TO authenticated;
GRANT SELECT ON TABLE public.referral_credit_ledger TO authenticated;
GRANT SELECT ON TABLE public.referral_audit_log TO authenticated;

ALTER TABLE public.pet_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_reward_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pet_referral_codes_select_own_or_staff ON public.pet_referral_codes;
CREATE POLICY pet_referral_codes_select_own_or_staff
  ON public.pet_referral_codes
  FOR SELECT
  TO authenticated
  USING (owner_customer_id = (SELECT auth.uid()) OR private.is_staff());

DROP POLICY IF EXISTS referral_relationships_select_own_or_staff ON public.referral_relationships;
CREATE POLICY referral_relationships_select_own_or_staff
  ON public.referral_relationships
  FOR SELECT
  TO authenticated
  USING (
    referrer_customer_id = (SELECT auth.uid())
    OR referred_customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

DROP POLICY IF EXISTS referral_reward_sources_select_own_or_staff ON public.referral_reward_sources;
CREATE POLICY referral_reward_sources_select_own_or_staff
  ON public.referral_reward_sources
  FOR SELECT
  TO authenticated
  USING (
    referrer_customer_id = (SELECT auth.uid())
    OR referred_customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

DROP POLICY IF EXISTS referral_credit_ledger_select_own_or_staff ON public.referral_credit_ledger;
CREATE POLICY referral_credit_ledger_select_own_or_staff
  ON public.referral_credit_ledger
  FOR SELECT
  TO authenticated
  USING (customer_id = (SELECT auth.uid()) OR private.is_staff());

DROP POLICY IF EXISTS referral_audit_log_select_staff ON public.referral_audit_log;
CREATE POLICY referral_audit_log_select_staff
  ON public.referral_audit_log
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

REVOKE ALL ON FUNCTION public.referral_available_cents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_available_cents(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.referral_available_cents(uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.reserve_referral_credit(uuid, uuid, uuid, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_referral_credit(uuid, uuid, uuid, integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_referral_credit(uuid, uuid, uuid, integer, uuid) FROM authenticated;

REVOKE ALL ON FUNCTION public.release_expired_referral_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_expired_referral_reservations() FROM anon;
REVOKE ALL ON FUNCTION public.release_expired_referral_reservations() FROM authenticated;

COMMIT;
