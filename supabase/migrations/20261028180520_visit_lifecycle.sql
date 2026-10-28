-- Arrival/departure belongs to the visit. Dog service clocks remain independent
-- so a household with two hourly services is never billed twice for one clock.
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS service_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_ended_at timestamptz;

-- Recover lifecycle from recorded dog clocks without rewriting paid history.
WITH timing AS (
  SELECT visit_id, min(service_started_at) AS started_at,
    CASE WHEN bool_and(service_ended_at IS NOT NULL) THEN max(service_ended_at) END AS ended_at
  FROM public.appointments WHERE status <> 'cancelled' AND visit_id IS NOT NULL
  GROUP BY visit_id
)
UPDATE public.visits v SET service_started_at = t.started_at, service_ended_at = t.ended_at
FROM timing t WHERE v.id = t.visit_id AND v.service_started_at IS NULL AND v.service_ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.staff_set_visit_lifecycle(
  p_visit_id uuid, p_action text, p_hourly_service_ids text[] DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v public.visits%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.visits WHERE id = p_visit_id FOR UPDATE;
  IF NOT FOUND OR v.status = 'cancelled' THEN RAISE EXCEPTION 'Visit unavailable'; END IF;
  PERFORM id FROM public.appointments WHERE visit_id = p_visit_id ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE visit_id = p_visit_id AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'No active dogs';
  END IF;
  IF p_action = 'check_in' THEN
    UPDATE public.visits SET service_started_at = coalesce(service_started_at, now())
      WHERE id = p_visit_id RETURNING * INTO v;
  ELSIF p_action = 'check_out' THEN
    IF v.service_started_at IS NULL THEN RAISE EXCEPTION 'Check in first'; END IF;
    IF v.service_ended_at IS NULL AND EXISTS (
      SELECT 1 FROM public.appointments WHERE visit_id = p_visit_id AND status <> 'cancelled'
        AND service_id = ANY(p_hourly_service_ids) AND service_ended_at IS NULL
    ) THEN RAISE EXCEPTION 'Finish hourly service timers first'; END IF;
    UPDATE public.visits SET service_ended_at = coalesce(service_ended_at, now())
      WHERE id = p_visit_id RETURNING * INTO v;
    -- Existing completion-based billing, referrals and follow-ups still read
    -- this marker. Do not fabricate per-dog start clocks or alter recorded ones.
    UPDATE public.appointments SET service_ended_at = v.service_ended_at
      WHERE visit_id = p_visit_id AND status <> 'cancelled' AND service_ended_at IS NULL
        AND NOT (service_id = ANY(p_hourly_service_ids));
  ELSE RAISE EXCEPTION 'Invalid action'; END IF;
  RETURN jsonb_build_object('startedAt', v.service_started_at, 'endedAt', v.service_ended_at);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_visit_lifecycle(uuid, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_set_visit_lifecycle(uuid, text, text[]) TO service_role;
