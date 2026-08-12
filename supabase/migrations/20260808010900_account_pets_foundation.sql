-- ============================================================================
-- K9 ATELIER — ACCOUNT + PETS FOUNDATION (v5)
-- Vaccination uploads: server-only via SUPABASE_SECRET_KEY (Phase 5).
-- Max file size: 4 MB (Vercel Functions payload limit).
-- DO NOT RUN until explicit approval:
--   "MIGRATION APPROVED — PROCEED TO PHASE 1"
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. PRIVATE SCHEMA
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

GRANT USAGE ON SCHEMA private TO postgres, service_role;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. PRIVATE.STAFF_MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE private.staff_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.staff_members FROM PUBLIC;
REVOKE ALL ON TABLE private.staff_members FROM authenticated;
REVOKE ALL ON TABLE private.staff_members FROM anon;

-- Bootstrap after Penny's first signup (trusted admin only):
-- INSERT INTO private.staff_members (user_id)
-- SELECT id FROM auth.users WHERE email = 'penny@k9atelier.com';

-- ---------------------------------------------------------------------------
-- 3. PRIVATE.IS_STAFF()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.staff_members sm
    WHERE sm.user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.is_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_staff() FROM anon;
GRANT EXECUTE ON FUNCTION private.is_staff() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. TRIGGER / HELPER FUNCTIONS (NOT customer-callable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_pet_customer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.customer_id := (SELECT auth.uid());
  IF NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.set_vaccination_record_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT p.customer_id
  INTO v_owner
  FROM public.pets p
  WHERE p.id = NEW.pet_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'pet not found';
  END IF;

  IF v_owner <> (SELECT auth.uid()) AND NOT private.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  NEW.customer_id := v_owner;

  IF NOT private.is_staff() THEN
    NEW.verification_status := 'pending';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION private.set_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION private.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION private.sync_profile_email_from_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_profile_email_from_auth() FROM anon;
REVOKE ALL ON FUNCTION private.sync_profile_email_from_auth() FROM authenticated;

REVOKE ALL ON FUNCTION private.set_pet_customer_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_pet_customer_id() FROM anon;
REVOKE ALL ON FUNCTION private.set_pet_customer_id() FROM authenticated;

REVOKE ALL ON FUNCTION private.set_vaccination_record_defaults() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_vaccination_record_defaults() FROM anon;
REVOKE ALL ON FUNCTION private.set_vaccination_record_defaults() FROM authenticated;

-- ---------------------------------------------------------------------------
-- 5. PROFILES
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  preferred_contact text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX profiles_email_idx ON public.profiles (email);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_profile_email_from_auth();

-- ---------------------------------------------------------------------------
-- 6. PETS
-- ---------------------------------------------------------------------------
CREATE TABLE public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  breed text NOT NULL,
  weight_lbs numeric(5,1) NOT NULL
    CHECK (weight_lbs > 0 AND weight_lbs <= 200),
  date_of_birth date,
  approximate_age_years numeric(4,1)
    CHECK (
      approximate_age_years IS NULL
      OR (approximate_age_years > 0 AND approximate_age_years <= 30)
    ),
  sex text,
  temperament_notes text,
  health_comfort_notes text,
  grooming_preferences text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pets_dob_xor_approx_age CHECK (
    NOT (date_of_birth IS NOT NULL AND approximate_age_years IS NOT NULL)
  ),
  CONSTRAINT pets_dob_not_future CHECK (
    date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE
  )
);

CREATE INDEX pets_customer_id_idx ON public.pets (customer_id);
CREATE INDEX pets_customer_active_idx ON public.pets (customer_id)
  WHERE archived_at IS NULL;

CREATE TRIGGER pets_set_customer_id
  BEFORE INSERT ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_pet_customer_id();

CREATE TRIGGER pets_set_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. PET_ADMIN_NOTES
-- ---------------------------------------------------------------------------
CREATE TABLE public.pet_admin_notes (
  pet_id uuid PRIMARY KEY REFERENCES public.pets (id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id)
);

CREATE TRIGGER pet_admin_notes_set_updated_at
  BEFORE UPDATE ON public.pet_admin_notes
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. VACCINATION ENUM
-- ---------------------------------------------------------------------------
CREATE TYPE public.vaccination_verification_status AS ENUM (
  'pending',
  'verified',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- 9. PET_VACCINATION_RECORDS (+ unique storage_path)
-- ---------------------------------------------------------------------------
CREATE TABLE public.pet_vaccination_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text,
  mime_type text NOT NULL,
  file_size_bytes integer NOT NULL
    CHECK (file_size_bytes > 0 AND file_size_bytes <= 4194304),
  expiration_date date,
  verification_status public.vaccination_verification_status NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pet_vaccination_records_storage_path_unique UNIQUE (storage_path)
);

CREATE INDEX pet_vaccination_records_pet_id_idx
  ON public.pet_vaccination_records (pet_id, created_at DESC);

CREATE INDEX pet_vaccination_records_customer_id_idx
  ON public.pet_vaccination_records (customer_id);

CREATE TRIGGER pet_vaccination_records_set_defaults
  BEFORE INSERT ON public.pet_vaccination_records
  FOR EACH ROW
  EXECUTE FUNCTION private.set_vaccination_record_defaults();

CREATE TRIGGER pet_vaccination_records_set_updated_at
  BEFORE UPDATE ON public.pet_vaccination_records
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------------
-- 10. DERIVATION FUNCTION (per-record)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.derive_vaccination_effective_status(
  p_verification_status public.vaccination_verification_status,
  p_expiration_date date,
  p_reference_date date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_verification_status = 'pending' THEN 'needs_review'
    WHEN p_verification_status = 'rejected' THEN 'needs_attention'
    WHEN p_verification_status = 'verified' AND p_expiration_date IS NULL THEN 'current'
    WHEN p_verification_status = 'verified'
      AND p_expiration_date < p_reference_date THEN 'expired'
    WHEN p_verification_status = 'verified'
      AND p_expiration_date <= p_reference_date + 30 THEN 'expiring_soon'
    WHEN p_verification_status = 'verified' THEN 'current'
    ELSE 'missing'
  END;
$$;

REVOKE ALL ON FUNCTION public.derive_vaccination_effective_status(
  public.vaccination_verification_status,
  date,
  date
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.derive_vaccination_effective_status(
  public.vaccination_verification_status,
  date,
  date
) FROM anon;
GRANT EXECUTE ON FUNCTION public.derive_vaccination_effective_status(
  public.vaccination_verification_status,
  date,
  date
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. SECURITY_INVOKER VIEW
-- ---------------------------------------------------------------------------
CREATE VIEW public.pet_vaccination_effective_status
WITH (security_invoker = true)
AS
SELECT
  r.*,
  public.derive_vaccination_effective_status(
    r.verification_status,
    r.expiration_date,
    CURRENT_DATE
  ) AS effective_status
FROM public.pet_vaccination_records r;

-- ---------------------------------------------------------------------------
-- 12. PET BOOKING VACCINATION STATUS (deterministic priority)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pet_booking_vaccination_status(p_pet_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_best record;
  v_has_pending boolean;
  v_has_any_verified boolean;
  v_all_verified_expired boolean;
  v_latest_status public.vaccination_verification_status;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.pets p
    WHERE p.id = p_pet_id
      AND (
        (p.customer_id = (SELECT auth.uid()) AND p.archived_at IS NULL)
        OR private.is_staff()
      )
  ) THEN
    RETURN 'missing';
  END IF;

  SELECT r.verification_status, r.expiration_date
  INTO v_best
  FROM public.pet_vaccination_records r
  WHERE r.pet_id = p_pet_id
    AND r.verification_status = 'verified'
    AND (r.expiration_date IS NULL OR r.expiration_date >= CURRENT_DATE)
  ORDER BY r.expiration_date DESC NULLS LAST, r.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN public.derive_vaccination_effective_status(
      v_best.verification_status,
      v_best.expiration_date,
      CURRENT_DATE
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pet_vaccination_records r
    WHERE r.pet_id = p_pet_id
      AND r.verification_status = 'pending'
  ) INTO v_has_pending;

  IF v_has_pending THEN
    RETURN 'needs_review';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pet_vaccination_records r
    WHERE r.pet_id = p_pet_id
      AND r.verification_status = 'verified'
  ) INTO v_has_any_verified;

  IF v_has_any_verified THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.pet_vaccination_records r
      WHERE r.pet_id = p_pet_id
        AND r.verification_status = 'verified'
        AND (r.expiration_date IS NULL OR r.expiration_date >= CURRENT_DATE)
    ) INTO v_all_verified_expired;

    IF v_all_verified_expired THEN
      RETURN 'expired';
    END IF;
  END IF;

  SELECT r.verification_status
  INTO v_latest_status
  FROM public.pet_vaccination_records r
  WHERE r.pet_id = p_pet_id
  ORDER BY r.created_at DESC
  LIMIT 1;

  IF v_latest_status = 'rejected' THEN
    RETURN 'needs_attention';
  END IF;

  RETURN 'missing';
END;
$$;

REVOKE ALL ON FUNCTION public.get_pet_booking_vaccination_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_pet_booking_vaccination_status(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pet_booking_vaccination_status(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 13. STAFF RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_set_vaccination_verification(
  p_record_id uuid,
  p_status public.vaccination_verification_status
)
RETURNS public.pet_vaccination_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.pet_vaccination_records;
BEGIN
  IF NOT private.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_status = 'pending' THEN
    RAISE EXCEPTION 'invalid verification transition';
  END IF;

  UPDATE public.pet_vaccination_records
  SET verification_status = p_status,
      verified_at = CASE WHEN p_status = 'verified' THEN now() ELSE NULL END,
      verified_by = CASE WHEN p_status = 'verified' THEN (SELECT auth.uid()) ELSE NULL END,
      updated_at = now()
  WHERE id = p_record_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'record not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_upsert_pet_admin_notes(
  p_pet_id uuid,
  p_notes text
)
RETURNS public.pet_admin_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.pet_admin_notes;
BEGIN
  IF NOT private.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.pet_admin_notes (pet_id, notes, updated_by)
  VALUES (p_pet_id, COALESCE(p_notes, ''), (SELECT auth.uid()))
  ON CONFLICT (pet_id) DO UPDATE
    SET notes = EXCLUDED.notes,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

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

-- ---------------------------------------------------------------------------
-- 14. GRANTS / REVOKES (column-level)
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (
  first_name,
  last_name,
  phone,
  preferred_contact,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relationship
) ON TABLE public.profiles TO authenticated;

REVOKE ALL ON TABLE public.pets FROM PUBLIC;
REVOKE ALL ON TABLE public.pets FROM anon;
REVOKE ALL ON TABLE public.pets FROM authenticated;
GRANT SELECT ON TABLE public.pets TO authenticated;
GRANT INSERT (
  name,
  breed,
  weight_lbs,
  date_of_birth,
  approximate_age_years,
  sex,
  temperament_notes,
  health_comfort_notes,
  grooming_preferences
) ON TABLE public.pets TO authenticated;
GRANT UPDATE (
  name,
  breed,
  weight_lbs,
  date_of_birth,
  approximate_age_years,
  sex,
  temperament_notes,
  health_comfort_notes,
  grooming_preferences,
  archived_at
) ON TABLE public.pets TO authenticated;

REVOKE ALL ON TABLE public.pet_admin_notes FROM PUBLIC;
REVOKE ALL ON TABLE public.pet_admin_notes FROM anon;
REVOKE ALL ON TABLE public.pet_admin_notes FROM authenticated;
GRANT SELECT ON TABLE public.pet_admin_notes TO authenticated;

REVOKE ALL ON TABLE public.pet_vaccination_records FROM PUBLIC;
REVOKE ALL ON TABLE public.pet_vaccination_records FROM anon;
REVOKE ALL ON TABLE public.pet_vaccination_records FROM authenticated;
GRANT SELECT ON TABLE public.pet_vaccination_records TO authenticated;
-- No customer INSERT/UPDATE/DELETE on vaccination metadata.
-- Phase 5 server route uses SUPABASE_SECRET_KEY privileged client.

REVOKE ALL ON public.pet_vaccination_effective_status FROM PUBLIC;
REVOKE ALL ON public.pet_vaccination_effective_status FROM anon;
GRANT SELECT ON public.pet_vaccination_effective_status TO authenticated;

-- ---------------------------------------------------------------------------
-- 15. ENABLE ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_admin_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_vaccination_records ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 16. PROFILES RLS POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_select_own_or_staff
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR private.is_staff()
  );

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 17. PETS RLS POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY pets_select_own_or_staff
  ON public.pets
  FOR SELECT
  TO authenticated
  USING (
    (customer_id = (SELECT auth.uid()) AND archived_at IS NULL)
    OR private.is_staff()
  );

CREATE POLICY pets_insert_own
  ON public.pets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY pets_update_own
  ON public.pets
  FOR UPDATE
  TO authenticated
  USING (customer_id = (SELECT auth.uid()))
  WITH CHECK (customer_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- 18. PET_ADMIN_NOTES RLS POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY pet_admin_notes_staff_all
  ON public.pet_admin_notes
  FOR ALL
  TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

-- ---------------------------------------------------------------------------
-- 19. VACCINATION-RECORD RLS POLICIES
-- ---------------------------------------------------------------------------
CREATE POLICY pet_vaccination_records_select_own_or_staff
  ON public.pet_vaccination_records
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

-- No customer INSERT policy
-- No customer UPDATE policy
-- No customer DELETE policy

-- ---------------------------------------------------------------------------
-- 20. PRIVATE STORAGE BUCKET
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'pet-vaccinations',
  'pet-vaccinations',
  false,
  4194304,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 21. STORAGE SELECT POLICY
-- ---------------------------------------------------------------------------
CREATE POLICY vaccinations_select_own_or_staff
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pet-vaccinations'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR private.is_staff()
    )
  );

-- ---------------------------------------------------------------------------
-- 22. NO customer Storage INSERT policy
-- 23. NO customer Storage UPDATE policy
-- 24. NO customer Storage DELETE policy
-- Phase 5 server route uploads via SUPABASE_SECRET_KEY privileged client.
-- ---------------------------------------------------------------------------

COMMIT;
