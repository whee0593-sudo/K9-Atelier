# Stripe 存卡（不扣款）设置说明

> 网站界面是英文。这份说明给 Penny / 内部用。

政策：

- 建宠物档案前，账户里必须有一张**已验证的卡**
- 预约时**不扣钱**；客人选完日期时间后，勾选这次用哪张卡
- 服务后再收全款
- 违规取消 / no-show 按现有政策从这张卡扣

---

## 1. 在 Supabase 跑 SQL

打开 [Supabase SQL Editor](https://supabase.com/dashboard)，把 `supabase/migrations/20260817190000_payment_methods_staff_edits.sql` 贴进去执行。

这会：

- 保存客人的卡（只存卡品牌和后四位，不存完整卡号）
- 让管理员可以改主人档案和宠物档案

---

## 2. 注册 Stripe

1. 打开 https://dashboard.stripe.com 注册
2. 先开 **Test mode**（测试模式，不扣真钱）
3. Developers → API keys，复制：
   - **Publishable key**（`pk_test_...`）
   - **Secret key**（`sk_test_...`）

测试卡号：`4242 4242 4242 4242`，有效期任意未来日期，CVC 任意 3 位。

正式营业前再换成 **Live** 密钥（`pk_live_` / `sk_live_`）。

---

## 3. 把密钥加到 Vercel

Vercel 项目 → **Settings → Environment Variables**（Production + Preview）：

| 名称 | 值 |
|------|------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| `STRIPE_SECRET_KEY` | `sk_test_...` |

加完后 **Redeploy** 一次。

本地测试写在 `.env.local`（不要提交到 Git）。

---

## 4. 还没做的（以后）

现在只做了**存卡 + 验证**。服务结束后扣全款、以及按政策扣取消费，需要再接 Stripe 扣款（PaymentIntent）。卡已经在档案里，到时可以直接扣。
