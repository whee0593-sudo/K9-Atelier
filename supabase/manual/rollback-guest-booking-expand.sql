-- Migration A 已执行、新版应用尚未部署、且没有任何 RPC 预约时，才能回退数据库。
-- 此时旧版应用一直都能预约，因为客户 INSERT 和政策都还在。
-- 本脚本只在 guest_booking_requests 为空时删除空表和函数。
-- 表里已有记录时直接失败，不删除幂等记录，不删除 Visit / Appointment。
-- 不授予、不收回客户 INSERT。
-- 已有正式 RPC 预约时，不要运行本脚本。保留表、记录和预约，改为向前修复。

BEGIN;

DO $guard$
BEGIN
  IF to_regclass('public.guest_booking_requests') IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.guest_booking_requests)
  THEN
    RAISE EXCEPTION 'guest_booking_requests_not_empty'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.visits', 'INSERT')
    OR NOT has_table_privilege('authenticated', 'public.appointments', 'INSERT')
  THEN
    RAISE EXCEPTION 'guest_booking_contract_already_applied'
      USING ERRCODE = 'P0001';
  END IF;
END
$guard$;

DROP FUNCTION IF EXISTS public.create_guest_booking(uuid, text, jsonb, jsonb);
DROP TABLE IF EXISTS public.guest_booking_requests;

COMMIT;
