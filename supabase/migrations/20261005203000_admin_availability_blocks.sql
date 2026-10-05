BEGIN;

-- Admin calendar blocks. Local studio date + minutes, same clock model as
-- appointments.scheduled_start. Writes are service-role only, after the
-- admin API confirms a staff session. Authenticated users can only read
-- when private.is_staff() is true; customers have no insert/update/delete.

CREATE TABLE IF NOT EXISTS public.admin_availability_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date date NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  start_minutes integer,
  end_minutes integer,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_availability_blocks_reason_len CHECK (
    reason IS NULL OR char_length(reason) <= 160
  ),
  CONSTRAINT admin_availability_blocks_shape CHECK (
    (
      all_day
      AND start_minutes IS NULL
      AND end_minutes IS NULL
    )
    OR (
      NOT all_day
      AND start_minutes IS NOT NULL
      AND end_minutes IS NOT NULL
      AND start_minutes >= 0
      AND end_minutes <= 1440
      AND start_minutes < end_minutes
      AND start_minutes % 15 = 0
      AND end_minutes % 15 = 0
    )
  )
);

CREATE INDEX IF NOT EXISTS admin_availability_blocks_service_date_idx
  ON public.admin_availability_blocks (service_date, all_day, start_minutes);

CREATE UNIQUE INDEX IF NOT EXISTS admin_availability_blocks_one_all_day
  ON public.admin_availability_blocks (service_date)
  WHERE all_day;

DROP TRIGGER IF EXISTS admin_availability_blocks_set_updated_at
  ON public.admin_availability_blocks;
CREATE TRIGGER admin_availability_blocks_set_updated_at
  BEFORE UPDATE ON public.admin_availability_blocks
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

REVOKE ALL ON TABLE public.admin_availability_blocks FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_availability_blocks FROM anon;
REVOKE ALL ON TABLE public.admin_availability_blocks FROM authenticated;
GRANT SELECT ON TABLE public.admin_availability_blocks TO authenticated;

ALTER TABLE public.admin_availability_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_availability_blocks_staff_select
  ON public.admin_availability_blocks;
CREATE POLICY admin_availability_blocks_staff_select
  ON public.admin_availability_blocks
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

COMMIT;
