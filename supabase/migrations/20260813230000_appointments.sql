BEGIN;

-- ---------------------------------------------------------------------------
-- Appointments (booking persistence)
-- ---------------------------------------------------------------------------
CREATE TYPE public.appointment_status AS ENUM (
  'pending_confirmation',
  'confirmed',
  'cancelled'
);

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pets (id) ON DELETE RESTRICT,
  service_id text NOT NULL,
  service_name text NOT NULL,
  add_on_ids text[] NOT NULL DEFAULT '{}',
  add_on_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  address_street text NOT NULL,
  address_city text NOT NULL,
  address_state text NOT NULL,
  address_zip text NOT NULL,
  travel_distance_miles numeric(5, 1) NOT NULL,
  travel_fee numeric(8, 2) NOT NULL DEFAULT 0,
  appointment_date date NOT NULL,
  appointment_time text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  estimated_total numeric(8, 2),
  new_client_deposit numeric(8, 2),
  vaccination_status_at_booking text,
  status public.appointment_status NOT NULL,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users (id),
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX appointments_customer_id_idx
  ON public.appointments (customer_id, appointment_date DESC);

CREATE INDEX appointments_status_idx
  ON public.appointments (status, appointment_date);

CREATE INDEX appointments_pet_id_idx
  ON public.appointments (pet_id);

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Staff RPC: confirm or cancel appointments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.appointments;
BEGIN
  IF NOT private.is_staff() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_status NOT IN ('confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'invalid appointment status transition';
  END IF;

  UPDATE public.appointments
  SET status = p_status,
      confirmed_at = CASE
        WHEN p_status = 'confirmed' THEN now()
        ELSE confirmed_at
      END,
      confirmed_by = CASE
        WHEN p_status = 'confirmed' THEN (SELECT auth.uid())
        ELSE confirmed_by
      END,
      cancelled_at = CASE
        WHEN p_status = 'cancelled' THEN now()
        ELSE cancelled_at
      END,
      updated_at = now()
  WHERE id = p_appointment_id
    AND status <> 'cancelled'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'appointment not found';
  END IF;

  RETURN v_row;
END;
$$;

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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.appointments FROM PUBLIC;
REVOKE ALL ON TABLE public.appointments FROM anon;
REVOKE ALL ON TABLE public.appointments FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.appointments TO authenticated;

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointments_select_own_or_staff
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

CREATE POLICY appointments_insert_own
  ON public.appointments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.pets p
      WHERE p.id = pet_id
        AND p.customer_id = (SELECT auth.uid())
        AND p.archived_at IS NULL
    )
  );

COMMIT;
