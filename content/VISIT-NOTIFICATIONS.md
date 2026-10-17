# Visit 级客户通知

一次上门是一个 Visit。每一只狗仍是自己的 Appointment。

服务行程类通知按 Visit 发。同一种事件成功送出之后，这个 Visit 不会再发第二次。多只狗写在同一条里，例如 `Daisy, Milo and Coco`。

服务商明确拒绝时，会放开记录，下次可以再试。邮件或短信超时、没有收到明确结果，或服务商返回不确定的错误时，这条记录停住，不会自动重发，避免客人收到两条一样的消息。进程在联系服务商之前就中断，并且超过 15 分钟，才可以再试。成功送达之后才记为已发送。

## 按 Visit 发送

- 预约确认
- 员工确认
- 员工拒绝，或整次上门取消
- 改期确认（身份是原来的日期和时间，加上新的日期和时间。同一段改期重复执行只发一次。改回原来的时间会再发一条）
- 提前 3 天请客人回复 C
- 客人回复 C 之后的收到确认
- 出发
- 可以接狗（要等这次上门里还在的狗都做完）
- 正常美容付款后的感谢短信（不另发第二封收据；收据仍走原来的账单）
- 第二天回访
- Google 评价请求（写在第二天回访里，成功后记一笔，不再单独发）
- 21 天后再预约提醒

员工如果只取消其中一只、其他狗还在，那是这一只狗的取消说明，不会写成整次上门都取消了，也不会重发其他狗的确认。预约确认之后再加一只狗，会另发这只狗的更新，不会被第一次确认挡住。如果暂时读不到这次上门的其他狗，确认信会先等着；取消则只按这一只狗发。

## 仍按狗发送

- 狂犬疫苗 / 疫苗记录
- 某一只狗的健康或行为说明
- 某一只狗资料缺失
- 其他明确只属于一只狗档案的邮件

服务行程是 Visit。狗的档案是 Pet。

不改行程计算、服务定价、出行费、结账总额、Stripe、收据账单、45 磅规则。没有 Weekend Fee。

## 店主通知

客户自助预约、员工确认、取消、改期和客人回复 C，都走同一套 `decideClaim`。店主没有第二套领取规则。

发信地址只认 `MERCHANT_NOTIFY_FROM_EMAIL`。必须是已验证的 `@k9atelier.com` 地址，而且不能是收件箱 `penny@k9atelier.com`。没有 `SUPPORT_FROM_EMAIL` 回退。短信只发到 `MERCHANT_NOTIFY_PHONE`，这是收件号码，不是 Twilio 的发信号码。缺配置时跳过，配置补上后可以再发。地址不合法则不再重试。

自助预约必须先读出这次 Visit 里全部未取消的狗。每一只都是 confirmed 之后才发一条店主通知。旧的 `notifyStaffNewAppointment` 已从发送路径移除。

未确定的服务商结果停住，不自动重发。只有能证明服务商明确拒绝时才重试。

## 本地 migration 顺序

这四份文件不在 origin/main 上。本轮只整理本地文件，不连接生产库，也不执行 SQL。生产库是否已经手工跑过其中某一份，需要上线前再核对 `schema_migrations`。

按文件名顺序，在已有的 `public.visits`（`20261006120000`）和 `private.is_staff()`（`20260813221500`）之后：

1. `20261009120000_visit_notifications.sql` — 建立 Visit 通知表。`CREATE TABLE IF NOT EXISTS`，可重复执行。
2. `20261009130000_communication_logs.sql` — 建立统一领取表和快照保护。`CREATE SCHEMA IF NOT EXISTS private`，不改已有的 `private.is_staff()`。
3. `20261009140000_visit_notification_attempts.sql` — 给已有表补 `attempted_at` 和 `uncertain`。先删后加约束，可重复执行。
4. `20261016020000_merchant_communication_compatibility.sql` — 只 `ADD COLUMN IF NOT EXISTS provider_called_at`。不建第二张表。`decideClaim` 不读这一列，空值也不代表服务商没收到请求。

不要把第 4 份放到第 2 份前面。第 4 份如果先跑，会因为表还不存在而失败，这是故意的。

## 待确认

- 「结账」目前只看 `service_ended_at`（checkout 动作）。没有另加「账单已付款」门槛。付款感谢短信仍是另一条消息。
- 次日回访若要等全部狗做完，查找窗口用了 14 天（`NEXT_DAY_FOLLOWUP_CATCHUP_DAYS`）。不会把更早的历史空记录一次性补发。天数还没有业务确认。
- 同一条 Visit 事件里，只要一个渠道明确送达，另一个渠道被明确拒绝时不会再单独重试。这是现有 `combineProviderDeliveries` 规则。
- 狗只名单变化的店主补发，不能只凭告警里的指纹还原改之前的名单，所以这类告警先停住不补发。
