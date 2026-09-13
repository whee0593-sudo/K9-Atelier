BEGIN;

-- Staff can create a pet for another customer (admin client has no auth.uid()).
CREATE OR REPLACE FUNCTION private.set_pet_customer_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := (SELECT auth.uid());

  IF v_actor IS NOT NULL THEN
    IF private.is_staff()
       AND NEW.customer_id IS NOT NULL
       AND NEW.customer_id <> v_actor THEN
      RETURN NEW;
    END IF;
    NEW.customer_id := v_actor;
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS staff_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_confirm_token_hash text,
  ADD COLUMN IF NOT EXISTS customer_confirm_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS appointments_customer_confirm_token_hash_idx
  ON public.appointments (customer_confirm_token_hash)
  WHERE customer_confirm_token_hash IS NOT NULL;

COMMIT;
