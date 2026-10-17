# 通知账本与店主通知

网站界面是英文。这份说明给内部用。不要在这台环境连接生产库，也不要执行下面的 SQL。

统一领取规则在应用代码 `decideClaim`（`src/lib/communications/claim.ts`）。没有第二套 `decideExisting`。`communication_logs_claim` 的函数体不在仓库里，迁移不会替换它。

客人物流短信、次日回访、21 天回访提醒、客户自助预约的店主通知，都写 `communication_logs`。幂等键形状是 `channel|notificationType|audience|scope|fingerprint`。同一次上门用 `visit:<uuid>`。应用不写 `visit_notifications`，避免两套账本各发一次。

## 四份迁移的顺序

时间戳顺序就是执行顺序。后一份不依赖前一份里会被替换的函数。

1. `supabase/migrations/20261009120000_visit_notifications.sql`  
   依赖已有的 `public.visits`。`CREATE TABLE IF NOT EXISTS`。这张表保留给旧迁移幂等，当前发送代码不写它。
2. `supabase/migrations/20261009130000_communication_logs.sql`  
   依赖 `public.visits`、`public.profiles`、`private.is_staff()`。表已存在时不会重建。缺列用 `ADD COLUMN IF NOT EXISTS`。已有的 `communication_logs_protect_snapshot` 不替换。不创建、不替换 `communication_logs_claim`。
3. `supabase/migrations/20261009140000_visit_notification_attempts.sql`  
   依赖第 1 份。补 `attempted_at`，并收紧状态检查。可重复执行。
4. `supabase/migrations/20261016020000_merchant_communication_compatibility.sql`  
   依赖第 2 份。再补 `provider_called_at`、索引和告警表。不替换领取函数，也不把 `provider_called_at` 当成第二套领取规则。

生产库里 `communication_logs` 已经存在，而且比仓库里曾经的建表语句更完整。`schema_migrations` 目前读不到，所以不能假设这四份都未执行，也不能在这里 `db push`。`20261015190000_guest_booking_idempotency.sql` 与这四份无关，不要为了通知再跑它。

## 店主通知配置

`MERCHANT_NOTIFY_FROM_EMAIL` 必须是已验证的 `@k9atelier.com` 地址，而且不能等于店主收件箱 `penny@k9atelier.com`。没有配置时不回退到 `SUPPORT_FROM_EMAIL`。

`MERCHANT_NOTIFY_PHONE` 是店主短信号码。不读取 `STAFF_VOICE_PHONE`。

示例只放在 `.env.example`。不要把真实号码或密钥写进仓库，也不要在这里改 Vercel 环境变量。

客户自助预约会先读完整 Visit。未取消的狗没有全部确认时，不写已发送、也不发店主通知。旧的 `notifyStaffNewAppointment` 不再从自助预约路径发送。加狗那条员工邮件还在，是否改成 Visit 通知待确认。

不确定的服务商结果（超时、5xx、没有消息 id）停止再发。只有明确拒绝，或当时因为缺配置跳过，才允许以后重试。
