# 预约短信与电话设置

> 网站界面是英文。这份说明给 Penny / 内部用。

**号码：** `(561) 593-3335` → Twilio `+15615933335`  
**A2P 10DLC：** 已通过后，才能正式给美国客人发短信。

客人会收到：

1. **确认短信** — 预约确认时（若还在等审核，先发一条“已收到”）
2. **当天早上提醒** — 工作日纽约时间约早上 8 点（夏令时）
3. **出发短信** — 后台预约页点 **Text: on the way**

---

## 1. Twilio：把号码加进 Messaging Service

A2P 通过时，Twilio 通常已经建好一个 Messaging Service。

1. 打开 [Campaigns](https://www.twilio.com/console/sms/a2p-10dlc)
2. 点开已通过的 Campaign
3. 找到关联的 **Messaging Service**，点进去
4. 打开 **Sender Pool** / **Add Senders**
5. 把 `+15615933335` 加进去（若已在列表里可跳过）
6. 复制 Messaging Service SID（`MG` 开头）

在 Messaging Service 里打开 **Opt-Out Management / Integration**，确认 Twilio 自动处理 **STOP** / **HELP** / **START**（Advanced Opt-Out 打开即可）。

---

## 2. 在 Supabase 跑 SQL

打开 [Supabase SQL Editor](https://supabase.com/dashboard)，执行 `supabase/migrations/20260817180000_appointment_sms.sql`。

这会给预约表加上“提醒已发 / 出发短信已发”，避免重复发。

若提示 column already exists，说明以前跑过，可以忽略。

---

## 3. 把密钥加到 Vercel

Twilio Console 首页复制 **Account SID**（`AC` 开头）和 **Auth Token**。

Vercel 项目 → **Settings → Environment Variables**（Production + Preview）：

| 名称 | 值 |
|------|----|
| `TWILIO_ACCOUNT_SID` | `ACxxxx` |
| `TWILIO_AUTH_TOKEN` | Auth Token |
| `TWILIO_FROM_NUMBER` | `+15615933335` |
| `TWILIO_MESSAGING_SERVICE_SID` | `MGxxxx`（上一步复制的） |
| `CRON_SECRET` | 一串很长的随机密码 |

加完后 **Deployments → 最新部署 → Redeploy**。只 Save 不会生效。

本地测试写在 `.env.local`（不要提交到 Git）。

网站发短信时：有 `TWILIO_MESSAGING_SERVICE_SID` 就走 Messaging Service（A2P 正式发送方式）；否则用 `TWILIO_FROM_NUMBER`。

---

## 4. 试用账号必须升级

Trial 只能发到 Twilio 里验证过的手机号。正式给客人发，账户要 **Upgrade** 成付费。

---

## 5. 来电转接到你的手机

这个 Twilio 号默认不会响你的私人手机。

1. [TwiML Bins](https://www.twilio.com/console/twiml-bins) → Create → 名称 `Forward calls`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Number>+1你自己的手机号</Number>
  </Dial>
</Response>
```

2. [Phone Numbers Inventory](https://www.twilio.com/console/phone-numbers/incoming) → 点开 `+15615933335`
3. **Configuration details** → **Voice and emergency calling** → **Edit details**
4. 选 **Webhook, TwiML Bin, Function, Studio Flow, Proxy Service**
5. Primary method 选 **TwiML Bin** → `Forward calls` → Save

如果详情页没有 Voice 这一栏，说明这个号买的时候没开通语音，只能发短信，不能接电话。需要另买一个带 **Voice + SMS** 的号码。

拨号测试用 `+1 561 593 3335`。

---

## 6. 自动提醒

Vercel Cron 工作日 UTC 12:00 调用 `/api/cron/appointment-reminders`：

- 夏令时 ≈ 纽约时间早上 8:00
- 冬令时 ≈ 纽约时间早上 7:00

只给当天、已确认、还没发过提醒、档案里有手机号的预约发短信。请求头需要 `Authorization: Bearer <CRON_SECRET>`。

---

## 客人手机号从哪来？

预约最后一步填写 **Mobile phone**，并勾选短信同意。号码存进客人档案。
