-- Expose staff check to authenticated app code (admin vaccination review UI).

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_staff();
$$;

REVOKE ALL ON FUNCTION public.is_staff_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;
