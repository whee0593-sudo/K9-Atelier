-- Phase 2: customer pet soft-archive (post v5 foundation).
-- 1. Split UPDATE RLS so archive can set archived_at.
-- 2. archive_own_pet() RPC used by DELETE /api/pets/[petId].

BEGIN;

DROP POLICY IF EXISTS pets_archive_own ON public.pets;
DROP POLICY IF EXISTS pets_update_own ON public.pets;

CREATE POLICY pets_update_own
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    AND archived_at IS NULL
  )
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    AND archived_at IS NULL
  );

CREATE POLICY pets_archive_own
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    AND archived_at IS NULL
  )
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    AND archived_at IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.archive_own_pet(p_pet_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.pets
  SET archived_at = now(),
      updated_at = now()
  WHERE id = p_pet_id
    AND customer_id = (SELECT auth.uid())
    AND archived_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_own_pet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_own_pet(uuid) TO authenticated;

COMMIT;
