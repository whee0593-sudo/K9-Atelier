BEGIN;

-- ---------------------------------------------------------------------------
-- Route-aware booking: coordinates, assigned start, day-zone plans
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS address_lat double precision,
  ADD COLUMN IF NOT EXISTS address_lon double precision,
  ADD COLUMN IF NOT EXISTS scheduled_start integer,
  ADD COLUMN IF NOT EXISTS time_preference text;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_scheduled_start_range;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_scheduled_start_range
  CHECK (
    scheduled_start IS NULL
    OR (scheduled_start >= 0 AND scheduled_start < 1440)
  );

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_time_preference_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_time_preference_check
  CHECK (
    time_preference IS NULL
    OR time_preference IN ('morning', 'afternoon')
  );

CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_scheduled_start
  ON public.appointments (appointment_date, scheduled_start)
  WHERE status IS DISTINCT FROM 'cancelled'
    AND scheduled_start IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.service_day_plans (
  service_date date PRIMARY KEY,
  zone_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('staff', 'auto')),
  anchor_lat double precision,
  anchor_lon double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS service_day_plans_set_updated_at ON public.service_day_plans;
CREATE TRIGGER service_day_plans_set_updated_at
  BEFORE UPDATE ON public.service_day_plans
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

REVOKE ALL ON TABLE public.service_day_plans FROM PUBLIC;
REVOKE ALL ON TABLE public.service_day_plans FROM anon;
REVOKE ALL ON TABLE public.service_day_plans FROM authenticated;
GRANT SELECT ON TABLE public.service_day_plans TO authenticated;

ALTER TABLE public.service_day_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_day_plans_staff_select ON public.service_day_plans;
CREATE POLICY service_day_plans_staff_select
  ON public.service_day_plans
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

COMMIT;
