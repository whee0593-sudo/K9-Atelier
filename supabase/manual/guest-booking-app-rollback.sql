-- 新版应用已部署，Migration B 尚未执行。
-- 可以回退应用：重新部署旧版。旧版仍使用 authenticated INSERT。
-- 数据库不回滚。幂等表、幂等记录、Visit、Appointment 和 RPC 都保留。
-- 已有正式 RPC 预约时也是这样：预约继续有效，旧版能和新留下的记录并存。
-- 若 Migration B 已经执行，本脚本失败。那时不能回退旧应用，只能向前修复。
-- 本脚本不删除、不授权、不改策略。

DO $check$
BEGIN
  IF to_regprocedure('public.create_guest_booking(uuid,text,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'guest_booking_expand_missing'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.visits', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.appointments', 'INSERT')
  THEN
    RAISE EXCEPTION 'guest_booking_app_rollback_blocked'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'visits_insert_own'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'appointments_insert_own'
  ) THEN
    RAISE EXCEPTION 'guest_booking_app_rollback_blocked'
      USING ERRCODE = 'P0001';
  END IF;
END
$check$;
