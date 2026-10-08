-- Phase 1 checks after the contract migration.
-- Each query should return zero rows, except the count query.
-- Compare appointment_count with the count taken before the migration.

-- total appointments
SELECT count(*) AS appointment_count FROM public.appointments;

-- every appointment has a visit
SELECT id
FROM public.appointments
WHERE visit_id IS NULL;

-- no orphan appointments
SELECT appointment.id
FROM public.appointments AS appointment
LEFT JOIN public.visits AS visit ON visit.id = appointment.visit_id
WHERE visit.id IS NULL;

-- no childless visits
SELECT visit.id
FROM public.visits AS visit
LEFT JOIN public.appointments AS appointment ON appointment.visit_id = visit.id
WHERE appointment.id IS NULL;

-- appointment customer matches the visit customer
SELECT appointment.id
FROM public.appointments AS appointment
JOIN public.visits AS visit ON visit.id = appointment.visit_id
WHERE appointment.customer_id IS DISTINCT FROM visit.customer_id;

-- one shared confirmation token belongs to one visit
SELECT btrim(appointment.customer_confirm_token_hash) AS token
FROM public.appointments AS appointment
WHERE NULLIF(btrim(appointment.customer_confirm_token_hash), '') IS NOT NULL
GROUP BY btrim(appointment.customer_confirm_token_hash)
HAVING count(DISTINCT appointment.visit_id) > 1;

-- multi-dog visits with no shared token need a manual look.
-- Add Dog rows can have a null token, so this list is a review queue,
-- not an automatic failure.
SELECT appointment.visit_id
FROM public.appointments AS appointment
GROUP BY appointment.visit_id
HAVING count(*) > 1
  AND count(DISTINCT NULLIF(btrim(appointment.customer_confirm_token_hash), '')) = 0;

-- future confirmed appointments still exist
SELECT count(*) AS future_confirmed_count
FROM public.appointments
WHERE status = 'confirmed'
  AND appointment_date >= CURRENT_DATE;

-- travel fee is mirrored once
SELECT appointment.visit_id
FROM public.appointments AS appointment
JOIN public.visits AS visit ON visit.id = appointment.visit_id
WHERE appointment.status IS DISTINCT FROM 'cancelled'
  AND appointment.travel_fee > 0
GROUP BY appointment.visit_id, visit.travel_fee
HAVING count(*) > 1
  OR sum(appointment.travel_fee) IS DISTINCT FROM visit.travel_fee;

-- visit status matches its children
SELECT visit.id
FROM public.visits AS visit
JOIN LATERAL (
  SELECT
    count(*) FILTER (WHERE status IS DISTINCT FROM 'cancelled') AS active_count,
    count(*) FILTER (
      WHERE status IS DISTINCT FROM 'cancelled' AND service_ended_at IS NULL
    ) AS open_count,
    count(*) FILTER (WHERE status = 'pending_confirmation') AS pending_count
  FROM public.appointments
  WHERE visit_id = visit.id
) AS children ON true
WHERE visit.status IS DISTINCT FROM (
  CASE
    WHEN children.active_count = 0 THEN 'cancelled'::public.visit_status
    WHEN children.open_count = 0 THEN 'completed'::public.visit_status
    WHEN children.pending_count = children.active_count
      THEN 'pending_confirmation'::public.visit_status
    ELSE 'confirmed'::public.visit_status
  END
);

-- future active rows that still have no duration snapshot.
-- Availability reads the live catalog estimate and does not write it.
-- A later scheduling change stores the snapshot. Completed history stays NULL.
SELECT id, appointment_date, status
FROM public.appointments
WHERE estimated_duration_minutes IS NULL
  AND status IN ('confirmed', 'pending_confirmation')
  AND service_ended_at IS NULL
  AND appointment_date >= CURRENT_DATE;
