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

## 4. 存卡时怎么验证，服务后怎么扣

客人或管理员点 Save Card 时，网站会向 Stripe 发一个 **SetupIntent**（`usage: off_session`，只要银行卡）。银行会核对卡号、有效期、安全码和邮编；支持 3D Secure 的卡会在这一步弹出银行验证。只有 Stripe 返回 `succeeded`，而且安全码、邮编没有失败、卡没过期，才会写入客人档案。档案里只留品牌和后四位。

服务结束后的全款、no-show、违规取消，都用这张已验证的卡做 **off-session** 扣款（客人不在结账页上）。这样银行认得这是当初验证过的卡，不会因为客人已经离开而再次要求验证、导致扣款失败。

余额不足、卡被注销、或银行临时拒绝，仍然可能扣不下来。那种情况员工端会看到失败，可以改用另一张卡或现金。过期卡不能用来预约，也不能在收款时被选中。
