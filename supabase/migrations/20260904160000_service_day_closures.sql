BEGIN;

CREATE TABLE IF NOT EXISTS public.service_day_closures (
  service_date date PRIMARY KEY,
  closed_all_day boolean NOT NULL DEFAULT false,
  closed_hours integer[] NOT NULL DEFAULT '{}'::integer[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_day_closures_has_block CHECK (
    closed_all_day OR cardinality(closed_hours) > 0
  ),
  CONSTRAINT service_day_closures_hours_range CHECK (
    closed_hours <@ ARRAY[9,10,11,12,13,14,15]
  )
);

DROP TRIGGER IF EXISTS service_day_closures_set_updated_at ON public.service_day_closures;
CREATE TRIGGER service_day_closures_set_updated_at
  BEFORE UPDATE ON public.service_day_closures
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

REVOKE ALL ON TABLE public.service_day_closures FROM PUBLIC;
REVOKE ALL ON TABLE public.service_day_closures FROM anon;
REVOKE ALL ON TABLE public.service_day_closures FROM authenticated;
GRANT SELECT ON TABLE public.service_day_closures TO authenticated;

ALTER TABLE public.service_day_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_day_closures_staff_select ON public.service_day_closures;
CREATE POLICY service_day_closures_staff_select
  ON public.service_day_closures
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

COMMIT;
