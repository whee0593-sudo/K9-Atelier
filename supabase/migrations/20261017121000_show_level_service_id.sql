-- Show-Level Coat Care 历史标识。
-- 只在新网站代码已经上线、并且 20261017120000 已经成功之后执行。
-- 旧 Production 代码的服务目录没有 show-level-coat-care。
-- 若在旧代码仍在服务时改标识，时长和目录查找会落到默认值。
-- 新代码同时认识 long-coat-show-care 和 show-level-coat-care。
-- 只更新文本标识和显示名称。不删除预约，不改 uuid 主键，不改付款。
-- 可重复执行：已经是新标识的行不会被选中。
-- 本文件是独立事务。失败则整段回滚，标识保持执行前的值。

BEGIN;

CREATE TABLE IF NOT EXISTS public.appointments_show_level_id_backup (
  id uuid PRIMARY KEY,
  service_id text NOT NULL,
  service_name text NOT NULL,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments_show_level_id_backup ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.appointments_show_level_id_backup FROM PUBLIC;
REVOKE ALL ON TABLE public.appointments_show_level_id_backup FROM anon;
REVOKE ALL ON TABLE public.appointments_show_level_id_backup FROM authenticated;

INSERT INTO public.appointments_show_level_id_backup (id, service_id, service_name)
SELECT id, service_id, service_name
FROM public.appointments
WHERE btrim(service_id) = 'long-coat-show-care'
ON CONFLICT (id) DO NOTHING;

UPDATE public.appointments
SET
  service_id = 'show-level-coat-care',
  service_name = 'Show-Level Coat Care'
WHERE btrim(service_id) = 'long-coat-show-care';

COMMIT;
