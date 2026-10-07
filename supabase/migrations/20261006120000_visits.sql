-- Visit is one on-site stop for a customer.
-- Each dog remains its own appointment and gains visit_id.
-- Travel fee on the visit is the source of truth.
-- appointments.travel_fee stays as a compatibility mirror for current checkout
-- and email code. Phase 2 should read visits.travel_fee and then stop writing
-- the per-appointment mirror. There is no weekend fee.

BEGIN;

CREATE TYPE public.visit_status AS ENUM (
  'pending_confirmation',
  'confirmed',
  'completed',
  'cancelled'
);

CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
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
  travel_fee numeric(8, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visits_scheduled_start_range CHECK (
    scheduled_start IS NULL
    OR (scheduled_start >= 0 AND scheduled_start < 1440)
  ),
  CONSTRAINT visits_time_preference_check CHECK (
    time_preference IS NULL
    OR time_preference IN ('morning', 'afternoon')
  )
);

COMMENT ON TABLE public.visits IS
  'One customer on-site visit. Pet appointments reference visits.id. Address columns are a snapshot from booking time.';

COMMENT ON COLUMN public.visits.travel_fee IS
  'Source of truth for the single travel fee on this visit. Not a per-dog fee.';

COMMENT ON COLUMN public.visits.scheduled_start IS
  'Canonical visit arrival, in minutes from midnight. Pet appointments are chained after this start. visits.appointment_time is derived from this value.';

COMMENT ON COLUMN public.visits.appointment_time IS
  'Display label derived from scheduled_start, for example 3:30 PM. Do not write a different clock time here.';

CREATE OR REPLACE FUNCTION public.visit_arrival_label(p_minutes integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_minutes IS NULL THEN NULL::text
    ELSE
      (CASE
        WHEN (p_minutes / 60) % 12 = 0 THEN 12
        ELSE (p_minutes / 60) % 12
      END)::text
      || ':'
      || pg_catalog.lpad((pg_catalog.mod(p_minutes, 60))::text, 2, '0')
      || CASE WHEN (p_minutes / 60) >= 12 THEN ' PM' ELSE ' AM' END
  END;
$$;

REVOKE ALL ON FUNCTION public.visit_arrival_label(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.visit_arrival_label(integer) TO authenticated, service_role;

CREATE INDEX visits_customer_service_date_idx
  ON public.visits (customer_id, service_date DESC);

DROP TRIGGER IF EXISTS visits_set_updated_at ON public.visits;
CREATE TRIGGER visits_set_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

ALTER TABLE public.appointments
  ADD COLUMN visit_id uuid,
  ADD COLUMN service_price numeric(8, 2),
  ADD COLUMN estimated_duration_minutes integer;

COMMENT ON COLUMN public.appointments.visit_id IS
  'The on-site visit this pet appointment belongs to. Do not infer the visit from date and address.';

COMMENT ON COLUMN public.appointments.service_price IS
  'Service price snapshot at booking, excluding travel. Catalog price changes must not rewrite it.';

COMMENT ON COLUMN public.appointments.estimated_duration_minutes IS
  'Service duration snapshot in minutes at booking. Null on rows backfilled before a duration was stored. New bookings write it via estimateServiceDurationMinutes().';

COMMENT ON COLUMN public.appointments.travel_fee IS
  'Compatibility mirror. visits.travel_fee is the source of truth. New companion dogs store 0 here so existing per-appointment checkout does not charge travel again.';

-- ---------------------------------------------------------------------------
-- Status sync. Cancelling one dog does not cancel the visit.
-- The visit is cancelled only when no active pet appointment remains.
-- The visit is completed when every active pet has service_ended_at.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.sync_visit_from_appointments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_visit uuid;
  v_active integer;
  v_pending integer;
  v_open integer;
  v_status public.visit_status;
  v_start integer;
  v_pref text;
  v_date date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_visit := NEW.visit_id;
  ELSE
    v_visit := COALESCE(NEW.visit_id, OLD.visit_id);
  END IF;
  IF v_visit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE status <> 'cancelled'),
    count(*) FILTER (WHERE status = 'pending_confirmation'),
    count(*) FILTER (WHERE status <> 'cancelled' AND service_ended_at IS NULL)
  INTO v_active, v_pending, v_open
  FROM public.appointments
  WHERE visit_id = v_visit;

  IF v_active = 0 THEN
    v_status := 'cancelled';
  ELSIF v_open = 0 THEN
    v_status := 'completed';
  ELSIF v_pending = v_active THEN
    v_status := 'pending_confirmation';
  ELSE
    v_status := 'confirmed';
  END IF;

  SELECT scheduled_start, time_preference, appointment_date
  INTO v_start, v_pref, v_date
  FROM public.appointments
  WHERE visit_id = v_visit
    AND status <> 'cancelled'
  ORDER BY scheduled_start NULLS LAST, created_at
  LIMIT 1;

  -- appointment_time is always the label of the canonical arrival.
  -- Child appointment_time may still be a route window and is not copied.
  UPDATE public.visits
  SET status = v_status,
      scheduled_start = COALESCE(v_start, scheduled_start),
      appointment_time = CASE
        WHEN v_start IS NOT NULL THEN public.visit_arrival_label(v_start)
        ELSE appointment_time
      END,
      time_preference = COALESCE(v_pref, time_preference),
      service_date = COALESCE(v_date, service_date)
  WHERE id = v_visit;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.sync_visit_from_appointments() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sync_visit_from_appointments() FROM anon;
REVOKE ALL ON FUNCTION private.sync_visit_from_appointments() FROM authenticated;

DROP TRIGGER IF EXISTS appointments_sync_visit ON public.appointments;
CREATE TRIGGER appointments_sync_visit
  AFTER INSERT OR UPDATE OF status, service_ended_at, scheduled_start, appointment_time, time_preference, appointment_date, visit_id
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_visit_from_appointments();

-- ---------------------------------------------------------------------------
-- Conservative historical backfill. See src/lib/visits/backfill.ts.
-- Only a shared customer_confirm_token_hash merges appointments into one visit.
-- Same customer, date, address, or a short create gap is not evidence.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE visit_backfill_rows ON COMMIT DROP AS
SELECT
  id,
  customer_id,
  appointment_date,
  lower(btrim(address_street)) || '|' || left(regexp_replace(coalesce(address_zip, ''), '\D', '', 'g'), 5) AS address_key,
  scheduled_start,
  created_at,
  customer_confirm_token_hash
FROM public.appointments;

CREATE TEMP TABLE visit_backfill_groups (
  appointment_id uuid PRIMARY KEY,
  group_key text NOT NULL
) ON COMMIT DROP;

INSERT INTO visit_backfill_groups (appointment_id, group_key)
SELECT id, 'token:' || customer_confirm_token_hash
FROM visit_backfill_rows
WHERE customer_confirm_token_hash IS NOT NULL
  AND btrim(customer_confirm_token_hash) <> '';

INSERT INTO visit_backfill_groups (appointment_id, group_key)
SELECT id, 'single:' || id::text
FROM visit_backfill_rows AS row
WHERE NOT EXISTS (
  SELECT 1
  FROM visit_backfill_groups grouped
  WHERE grouped.appointment_id = row.id
);

CREATE TEMP TABLE visit_backfill_ids ON COMMIT DROP AS
SELECT group_key, gen_random_uuid() AS visit_id
FROM visit_backfill_groups
GROUP BY group_key;

INSERT INTO public.visits (
  id,
  customer_id,
  service_date,
  scheduled_start,
  appointment_time,
  time_preference,
  timezone,
  status,
  address_street,
  address_city,
  address_state,
  address_zip,
  address_lat,
  address_lon,
  travel_distance_miles,
  travel_fee,
  created_at
)
SELECT
  ids.visit_id,
  (array_agg(a.customer_id ORDER BY a.created_at))[1],
  (array_agg(a.appointment_date ORDER BY a.created_at))[1],
  (
    SELECT aa.scheduled_start
    FROM public.appointments aa
    JOIN visit_backfill_groups gg ON gg.appointment_id = aa.id
    WHERE gg.group_key = ids.group_key
      AND aa.status <> 'cancelled'
    ORDER BY aa.scheduled_start NULLS LAST, aa.created_at
    LIMIT 1
  ),
  (
    SELECT CASE
      WHEN aa.scheduled_start IS NOT NULL THEN public.visit_arrival_label(aa.scheduled_start)
      ELSE aa.appointment_time
    END
    FROM public.appointments aa
    JOIN visit_backfill_groups gg ON gg.appointment_id = aa.id
    WHERE gg.group_key = ids.group_key
      AND aa.status <> 'cancelled'
    ORDER BY aa.scheduled_start NULLS LAST, aa.created_at
    LIMIT 1
  ),
  (
    SELECT aa.time_preference
    FROM public.appointments aa
    JOIN visit_backfill_groups gg ON gg.appointment_id = aa.id
    WHERE gg.group_key = ids.group_key
      AND aa.status <> 'cancelled'
    ORDER BY aa.scheduled_start NULLS LAST, aa.created_at
    LIMIT 1
  ),
  COALESCE((array_agg(a.timezone ORDER BY a.created_at))[1], 'America/New_York'),
  CASE
    WHEN count(*) FILTER (WHERE a.status <> 'cancelled') = 0 THEN 'cancelled'::public.visit_status
    WHEN count(*) FILTER (WHERE a.status <> 'cancelled' AND a.service_ended_at IS NULL) = 0
      THEN 'completed'::public.visit_status
    WHEN count(*) FILTER (WHERE a.status = 'pending_confirmation')
      = count(*) FILTER (WHERE a.status <> 'cancelled')
      THEN 'pending_confirmation'::public.visit_status
    ELSE 'confirmed'::public.visit_status
  END,
  (array_agg(a.address_street ORDER BY a.created_at))[1],
  (array_agg(a.address_city ORDER BY a.created_at))[1],
  (array_agg(a.address_state ORDER BY a.created_at))[1],
  (array_agg(a.address_zip ORDER BY a.created_at))[1],
  (array_agg(a.address_lat ORDER BY a.created_at))[1],
  (array_agg(a.address_lon ORDER BY a.created_at))[1],
  COALESCE(MAX(a.travel_distance_miles), 0),
  COALESCE(MAX(a.travel_fee), 0),
  MIN(a.created_at)
FROM visit_backfill_ids ids
JOIN visit_backfill_groups grouped ON grouped.group_key = ids.group_key
JOIN public.appointments a ON a.id = grouped.appointment_id
GROUP BY ids.visit_id, ids.group_key;

UPDATE public.appointments AS appointment
SET
  visit_id = ids.visit_id,
  service_price = CASE
    WHEN appointment.estimated_total IS NULL THEN NULL
    WHEN COALESCE(appointment.travel_fee, 0) > 0
      AND appointment.estimated_total >= appointment.travel_fee
      THEN round((appointment.estimated_total - appointment.travel_fee)::numeric, 2)
    ELSE appointment.estimated_total
  END
FROM visit_backfill_groups grouped
JOIN visit_backfill_ids ids ON ids.group_key = grouped.group_key
WHERE appointment.id = grouped.appointment_id;

ALTER TABLE public.appointments
  ALTER COLUMN visit_id SET NOT NULL;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_visit_id_fkey
  FOREIGN KEY (visit_id) REFERENCES public.visits (id) ON DELETE RESTRICT;

CREATE INDEX appointments_visit_id_idx
  ON public.appointments (visit_id, scheduled_start);

-- ---------------------------------------------------------------------------
-- RLS. Customers insert their own visit during booking. Later edits use the
-- service role. The sync trigger is security definer and owns status updates.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE public.visits FROM PUBLIC;
REVOKE ALL ON TABLE public.visits FROM anon;
REVOKE ALL ON TABLE public.visits FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.visits TO authenticated;

ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visits_select_own_or_staff ON public.visits;
CREATE POLICY visits_select_own_or_staff
  ON public.visits
  FOR SELECT
  TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR private.is_staff()
  );

DROP POLICY IF EXISTS visits_insert_own ON public.visits;
CREATE POLICY visits_insert_own
  ON public.visits
  FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS appointments_insert_own ON public.appointments;
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

COMMIT;
