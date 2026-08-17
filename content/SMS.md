# 预约短信（SMS）设置说明

> 网站界面是英文。这份说明给 Penny / 内部用。

客人预约后会收到：

1. **确认短信** — 预约确认时（或提交后等待审核时先发一条“已收到”）
2. **当天早上提醒** — 周一至周五约早上 8 点（夏令时）自动发送
3. **出发短信** — 你在后台点 **Text: on the way**

---

## 1. 在 Supabase 跑这条 SQL

打开 [Supabase SQL Editor](https://supabase.com/dashboard)，把 `supabase/migrations/20260817180000_appointment_sms.sql` 的内容贴进去执行。

这会给预约表加上“提醒已发 / 出发短信已发”的标记，避免重复发短信。

---

## 2. 注册 Twilio（发短信的服务商）

短信不是用现有邮箱（Resend）发的，需要单独的短信账号。

1. 打开 https://www.twilio.com/try-twilio 注册
2. 买一个 **美国手机号**（大约 $1.15/月）
3. 在 Twilio Console 复制：
   - **Account SID**（以 `AC` 开头）
   - **Auth Token**
   - **From** 号码（格式 `+1……`）

### 测试阶段（Twilio Trial）

试用账号**只能发到你在 Twilio 里验证过的手机号**。先用你自己的号码测通，再升级付费。

### 正式对客人发（A2P 10DLC）

美国给客人发营销/通知短信，Twilio 要求登记 **A2P 10DLC**（品牌 + 活动）。审核可能要几天到两周。未通过前，建议继续用测试号码。

---

## 3. 把密钥加到 Vercel

Vercel 项目 → **Settings → Environment Variables**，添加（Production + Preview）：

| 名称 | 值 |
|------|----|
| `TWILIO_ACCOUNT_SID` | `ACxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | `+1` 你的 Twilio 号码 |
| `CRON_SECRET` | 一串很长的随机密码 |

加完后 **Redeploy** 一次。

本地测试可写在 `.env.local`（不要提交到 Git）。

---

## 4. 自动提醒怎么工作

Vercel 会在工作日 UTC 12:00 调用 `/api/cron/appointment-reminders`：

- 夏令时 ≈ 纽约时间 **早上 8:00**
- 冬令时 ≈ 纽约时间 **早上 7:00**

只给**当天、已确认、还没发过提醒、账户里有手机号**的预约发短信。

---

## 客人手机号从哪来？

预约最后一步必须填写 **Mobile phone**。号码会存进客人档案，之后确认 / 提醒 / 出发短信都用这个号码。
