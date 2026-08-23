-- Owner (penny@k9atelier.com) can invite admins. New admins stay pending
-- until she confirms. Only active staff pass private.is_staff().

ALTER TABLE private.staff_members
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users (id);

ALTER TABLE private.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_role_check;
ALTER TABLE private.staff_members
  ADD CONSTRAINT staff_members_role_check
  CHECK (role IN ('owner', 'admin'));

ALTER TABLE private.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_status_check;
ALTER TABLE private.staff_members
  ADD CONSTRAINT staff_members_status_check
  CHECK (status IN ('pending', 'active', 'disabled'));

CREATE TABLE IF NOT EXISTS private.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  invited_by uuid REFERENCES auth.users (id),
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_normalized)
);

REVOKE ALL ON TABLE private.staff_invites FROM PUBLIC;
REVOKE ALL ON TABLE private.staff_invites FROM authenticated;
REVOKE ALL ON TABLE private.staff_invites FROM anon;
GRANT ALL ON TABLE private.staff_invites TO postgres, service_role;
GRANT ALL ON TABLE private.staff_members TO postgres, service_role;

ALTER TABLE private.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.staff_members ENABLE ROW LEVEL SECURITY;

UPDATE private.staff_members sm
SET email = u.email,
    role = CASE
      WHEN lower(u.email) = 'penny@k9atelier.com' THEN 'owner'
      ELSE COALESCE(sm.role, 'admin')
    END,
    status = COALESCE(sm.status, 'active'),
    confirmed_at = COALESCE(sm.confirmed_at, sm.created_at)
FROM auth.users u
WHERE u.id = sm.user_id;

INSERT INTO private.staff_members (user_id, email, role, status, confirmed_at)
SELECT u.id, u.email, 'owner', 'active', now()
FROM auth.users u
WHERE lower(u.email) = 'penny@k9atelier.com'
ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      role = 'owner',
      status = 'active',
      confirmed_at = COALESCE(private.staff_members.confirmed_at, EXCLUDED.confirmed_at);

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
      AND sm.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = (SELECT auth.uid())
      AND lower(u.email) = 'penny@k9atelier.com'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_owner()
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
      AND sm.role = 'owner'
      AND sm.status = 'active'
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = (SELECT auth.uid())
      AND lower(u.email) = 'penny@k9atelier.com'
  );
$$;

REVOKE ALL ON FUNCTION private.is_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_owner() FROM anon;
GRANT EXECUTE ON FUNCTION private.is_owner() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_owner_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_owner();
$$;

REVOKE ALL ON FUNCTION public.is_owner_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_owner_user() TO authenticated;

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

  IF lower(btrim(NEW.email)) = 'penny@k9atelier.com' THEN
    INSERT INTO private.staff_members (user_id, email, role, status, confirmed_at)
    VALUES (NEW.id, NEW.email, 'owner', 'active', now())
    ON CONFLICT (user_id) DO UPDATE
      SET email = EXCLUDED.email,
          role = 'owner',
          status = 'active',
          confirmed_at = COALESCE(private.staff_members.confirmed_at, EXCLUDED.confirmed_at);
  ELSIF EXISTS (
    SELECT 1
    FROM private.staff_invites si
    WHERE si.email_normalized = lower(btrim(NEW.email))
      AND si.confirmed_at IS NOT NULL
  ) THEN
    INSERT INTO private.staff_members (
      user_id, email, role, status, confirmed_at, confirmed_by
    )
    SELECT
      NEW.id,
      NEW.email,
      'admin',
      'active',
      si.confirmed_at,
      si.confirmed_by
    FROM private.staff_invites si
    WHERE si.email_normalized = lower(btrim(NEW.email))
      AND si.confirmed_at IS NOT NULL
    ON CONFLICT (user_id) DO UPDATE
      SET email = EXCLUDED.email,
          status = 'active',
          confirmed_at = COALESCE(private.staff_members.confirmed_at, EXCLUDED.confirmed_at);
  END IF;

  RETURN NEW;
END;
$$;
