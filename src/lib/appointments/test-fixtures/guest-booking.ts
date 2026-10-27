const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PET = "11111111-1111-4111-8111-111111111111";
const CARD = "22222222-2222-4222-8222-222222222222";

export function guestBookingFixtureSql() {
  return `
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
    $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END $$;

    CREATE TYPE public.visit_status AS ENUM (
      'pending_confirmation', 'confirmed', 'completed', 'cancelled'
    );
    CREATE TYPE public.appointment_status AS ENUM (
      'pending_confirmation', 'confirmed', 'completed', 'cancelled'
    );

    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY
    );
    CREATE TABLE public.pets (
      id uuid PRIMARY KEY,
      customer_id uuid NOT NULL,
      archived_at timestamptz
    );
    CREATE TABLE public.payment_methods (
      id uuid PRIMARY KEY,
      customer_id uuid NOT NULL
    );
    CREATE TABLE public.visits (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL,
      service_date date NOT NULL,
      scheduled_start integer,
      appointment_time text,
      time_preference text,
      timezone text NOT NULL DEFAULT 'America/New_York',
      status public.visit_status NOT NULL DEFAULT 'confirmed',
      address_street text NOT NULL,
      address_city text NOT NULL,
      address_state text NOT NULL,
      address_zip text NOT NULL,
      address_lat double precision,
      address_lon double precision,
      travel_distance_miles numeric(5, 1) NOT NULL DEFAULT 0,
      travel_fee numeric(8, 2) NOT NULL DEFAULT 0
    );
    CREATE TABLE public.appointments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL,
      visit_id uuid,
      visit_sequence integer,
      pet_id uuid NOT NULL,
      service_id text NOT NULL,
      service_name text NOT NULL,
      add_on_ids text[] NOT NULL DEFAULT '{}',
      add_on_options jsonb NOT NULL DEFAULT '{}'::jsonb,
      address_street text NOT NULL,
      address_city text NOT NULL,
      address_state text NOT NULL,
      address_zip text NOT NULL,
      travel_distance_miles numeric(5, 1) NOT NULL DEFAULT 0,
      travel_fee numeric(8, 2) NOT NULL DEFAULT 0,
      service_price numeric,
      estimated_duration_minutes integer,
      appointment_date date NOT NULL,
      appointment_time text,
      scheduled_start integer,
      time_preference text,
      address_lat double precision,
      address_lon double precision,
      timezone text NOT NULL DEFAULT 'America/New_York',
      estimated_total numeric,
      new_client_deposit numeric NOT NULL DEFAULT 0,
      payment_method_id uuid,
      vaccination_status_at_booking text,
      status public.appointment_status NOT NULL DEFAULT 'confirmed',
      confirmed_at timestamptz,
      staff_created boolean NOT NULL DEFAULT false,
      customer_confirm_token_hash text,
      customer_confirm_expires_at timestamptz
    );
    CREATE UNIQUE INDEX appointments_unique_scheduled_start
      ON public.appointments (appointment_date, scheduled_start)
      WHERE status IS DISTINCT FROM 'cancelled'
        AND scheduled_start IS NOT NULL;

    REVOKE ALL ON TABLE public.visits FROM PUBLIC;
    REVOKE ALL ON TABLE public.visits FROM anon;
    GRANT SELECT, INSERT ON TABLE public.visits TO authenticated;
    GRANT ALL ON TABLE public.visits TO service_role;
    REVOKE ALL ON TABLE public.appointments FROM PUBLIC;
    REVOKE ALL ON TABLE public.appointments FROM anon;
    GRANT SELECT, INSERT ON TABLE public.appointments TO authenticated;
    GRANT ALL ON TABLE public.appointments TO service_role;
    GRANT SELECT ON TABLE public.pets TO authenticated;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER ROLE service_role BYPASSRLS;
    ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
    CREATE POLICY visits_select_own
      ON public.visits
      FOR SELECT
      TO authenticated
      USING (customer_id = (SELECT auth.uid()));
    CREATE POLICY appointments_select_own
      ON public.appointments
      FOR SELECT
      TO authenticated
      USING (customer_id = (SELECT auth.uid()));
    CREATE POLICY visits_insert_own
      ON public.visits
      FOR INSERT
      TO authenticated
      WITH CHECK (customer_id = (SELECT auth.uid()));
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
        AND EXISTS (
          SELECT 1
          FROM public.visits v
          WHERE v.id = visit_id
            AND v.customer_id = (SELECT auth.uid())
        )
      );

    INSERT INTO public.profiles (id) VALUES ('${CUSTOMER}');
    INSERT INTO public.pets (id, customer_id) VALUES ('${PET}', '${CUSTOMER}');
    INSERT INTO public.payment_methods (id, customer_id) VALUES ('${CARD}', '${CUSTOMER}');
    SELECT set_config('app.user_id', '${CUSTOMER}', false);
  `;
}
