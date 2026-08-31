-- Harden RPC / SECURITY DEFINER privileges without changing authorized behavior.
-- Does not alter customer, pet, appointment, or payment rows.

BEGIN;

CREATE OR REPLACE FUNCTION public.referral_available_cents(p_customer_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(balance_effect_cents), 0)::integer
  FROM public.referral_credit_ledger
  WHERE customer_id = p_customer_id;
$$;

REVOKE ALL ON FUNCTION public.referral_available_cents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_available_cents(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.referral_available_cents(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.referral_available_cents(uuid) TO service_role;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn.sig);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.archive_own_pet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_own_pet(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.archive_own_pet(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;

REVOKE ALL ON FUNCTION public.is_owner_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_owner_user() TO authenticated;

REVOKE ALL ON FUNCTION public.staff_set_appointment_status(
  uuid,
  public.appointment_status
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_set_appointment_status(
  uuid,
  public.appointment_status
) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_set_appointment_status(
  uuid,
  public.appointment_status
) TO authenticated;

REVOKE ALL ON FUNCTION public.staff_set_vaccination_verification(
  uuid,
  public.vaccination_verification_status
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_set_vaccination_verification(
  uuid,
  public.vaccination_verification_status
) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_set_vaccination_verification(
  uuid,
  public.vaccination_verification_status
) TO authenticated;

REVOKE ALL ON FUNCTION public.staff_upsert_pet_admin_notes(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_upsert_pet_admin_notes(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_upsert_pet_admin_notes(uuid, text) TO authenticated;

COMMIT;
