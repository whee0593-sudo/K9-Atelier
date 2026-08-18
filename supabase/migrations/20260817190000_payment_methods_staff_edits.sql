-- Payment methods on file (Stripe Setup Intent) + staff may edit customer/pet profiles.
-- Run in Supabase SQL Editor after review.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Stripe customer id on profiles (service-role writes only)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_uidx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Saved cards (display fields only — never store PAN)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  stripe_payment_method_id text NOT NULL UNIQUE,
  brand text NOT NULL,
  last4 text NOT NULL,
  exp_month integer NOT NULL CHECK (exp_month >= 1 AND exp_month <= 12),
  exp_year integer NOT NULL CHECK (exp_year >= 2000),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_methods_customer_id_idx
  ON public.payment_methods (customer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS payment_methods_one_default_uidx
  ON public.payment_methods (customer_id)
  WHERE is_default;

DROP TRIGGER IF EXISTS payment_methods_set_updated_at ON public.payment_methods;
CREATE TRIGGER payment_methods_set_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_payment_method_id_idx
  ON public.appointments (payment_method_id);

-- ---------------------------------------------------------------------------
-- 3. Grants / RLS for payment_methods
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.payment_methods FROM PUBLIC;
REVOKE ALL ON TABLE public.payment_methods FROM anon;
REVOKE ALL ON TABLE public.payment_methods FROM authenticated;
GRANT SELECT ON TABLE public.payment_methods TO authenticated;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_methods_select_own_or_staff ON public.payment_methods;
CREATE POLICY payment_methods_select_own_or_staff
  ON public.payment_methods
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

-- Writes go through API routes using the service-role key.

-- ---------------------------------------------------------------------------
-- 4. Staff may update customer profiles and pet records
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR private.is_staff()
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR private.is_staff()
  );

DROP POLICY IF EXISTS pets_update_own ON public.pets;
CREATE POLICY pets_update_own
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR private.is_staff()
  )
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

COMMIT;
