-- Migration B 已执行后的故障恢复。
-- 只能向前修复：继续使用新版应用和 create_guest_booking。
-- 不能回退旧应用，因为旧版客户 INSERT 已经收回。
-- 本脚本不授予客户 INSERT，不删除幂等表、幂等记录、Visit 或 Appointment。
-- 若 RPC 丢失，停止并提示重新执行 Migration A。A 可重复执行，且不会把 INSERT 交回客户。
-- 若本脚本发现客户仍能 INSERT，说明 B 还没生效，不要把它当成已收缩的数据库。

DO $check$
BEGIN
  IF has_table_privilege('authenticated', 'public.visits', 'INSERT')
    OR has_table_privilege('authenticated', 'public.appointments', 'INSERT')
  THEN
    RAISE EXCEPTION 'guest_booking_contract_not_applied'
      USING ERRCODE = 'P0001';
  END IF;

  IF to_regprocedure('public.create_guest_booking(uuid,text,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'guest_booking_rpc_missing'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.create_guest_booking(uuid,text,jsonb,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'guest_booking_service_role_execute_missing'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('visits_insert_own', 'appointments_insert_own')
  ) THEN
    RAISE EXCEPTION 'guest_booking_customer_insert_policy_remains'
      USING ERRCODE = 'P0001';
  END IF;

  IF to_regclass('public.guest_booking_requests') IS NULL THEN
    RAISE EXCEPTION 'guest_booking_requests_missing'
      USING ERRCODE = 'P0001';
  END IF;
END
$check$;
