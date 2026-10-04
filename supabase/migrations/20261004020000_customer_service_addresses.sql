BEGIN;

-- Saved service addresses on a customer file (staff can add/edit without a visit).
-- Appointment visit addresses remain the source of travel quotes for bookings;
-- staff edits also rewrite matching appointment rows via the API.
CREATE TABLE IF NOT EXISTS public.customer_service_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  street text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  label text,
  parking_notes text,
  address_lat double precision,
  address_lon double precision,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_service_addresses_street_len CHECK (char_length(street) BETWEEN 1 AND 200),
  CONSTRAINT customer_service_addresses_city_len CHECK (char_length(city) BETWEEN 1 AND 120),
  CONSTRAINT customer_service_addresses_state_len CHECK (char_length(state) BETWEEN 1 AND 40),
  CONSTRAINT customer_service_addresses_zip_len CHECK (char_length(zip) BETWEEN 1 AND 20)
);

CREATE INDEX IF NOT EXISTS customer_service_addresses_customer_id_idx
  ON public.customer_service_addresses (customer_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS customer_service_addresses_unique_address_uidx
  ON public.customer_service_addresses (
    customer_id,
    lower(street),
    lower(city),
    lower(state),
    lower(zip)
  );

CREATE UNIQUE INDEX IF NOT EXISTS customer_service_addresses_one_default_uidx
  ON public.customer_service_addresses (customer_id)
  WHERE is_default;

DROP TRIGGER IF EXISTS customer_service_addresses_set_updated_at
  ON public.customer_service_addresses;

CREATE TRIGGER customer_service_addresses_set_updated_at
  BEFORE UPDATE ON public.customer_service_addresses
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

REVOKE ALL ON TABLE public.customer_service_addresses FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_service_addresses FROM anon;
REVOKE ALL ON TABLE public.customer_service_addresses FROM authenticated;
GRANT SELECT ON TABLE public.customer_service_addresses TO authenticated;

ALTER TABLE public.customer_service_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_service_addresses_select_own_or_staff
  ON public.customer_service_addresses;

CREATE POLICY customer_service_addresses_select_own_or_staff
  ON public.customer_service_addresses
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

-- Writes go through API routes using the service-role key.

COMMIT;
