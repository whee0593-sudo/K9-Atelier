-- Migration B（Contract）。
-- 不要把本文件放进 supabase/migrations。
-- supabase db push 和 db reset 只按时间顺序执行 supabase/migrations。
-- config.toml 的 schema_paths 为空，不会把 supabase/manual 收进去。
-- 仓库里没有自动执行本文件的 GitHub Action 或 Vercel 步骤。
--
-- 若本文件仍被放进自动迁移目录，下面的会话标记不会由 CLI 设置，
-- 语句会失败并回滚，客户 INSERT 保持原状。
--
-- 人工执行顺序：
-- 1. 新版应用已经部署，并用一笔客人预约验证 RPC。
-- 2. 确认没有旧实例还在接受预约。Vercel 切换期间新旧实例会短时间并存。
-- 3. 在同一个 SQL 会话先执行：
--    SELECT set_config('k9.guest_booking_contract', 'apply', false);
-- 4. 再执行本文件。
--
-- 本文件只收回 authenticated 对 visits、appointments 的 INSERT，
-- 并删除 visits_insert_own、appointments_insert_own。
-- 不删除幂等表、幂等记录、Visit、Appointment，不修改 create_staff_visit。
-- 执行后旧版应用不能再创建预约。

BEGIN;

DO $gate$
BEGIN
  IF current_setting('k9.guest_booking_contract', true) IS DISTINCT FROM 'apply' THEN
    RAISE EXCEPTION 'guest_booking_contract_refused'
      USING ERRCODE = 'P0001';
  END IF;

  IF to_regprocedure('public.create_guest_booking(uuid,text,jsonb,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'guest_booking_expand_missing'
      USING ERRCODE = 'P0001';
  END IF;
END
$gate$;

REVOKE INSERT ON TABLE public.visits FROM authenticated;
REVOKE INSERT ON TABLE public.appointments FROM authenticated;
DROP POLICY IF EXISTS visits_insert_own ON public.visits;
DROP POLICY IF EXISTS appointments_insert_own ON public.appointments;

COMMIT;
