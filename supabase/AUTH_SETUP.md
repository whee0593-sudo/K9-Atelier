# Supabase Auth 设置（K9 Atelier）

一次性 Dashboard 配置：Magic Link + OTP 登录。进入第三阶段前需要完成。

项目 ref：`ceejxoobxxoxqhpujrdz`

---

## 1. URL 配置

**Dashboard → Authentication → URL Configuration**

| 设置 | 值 |
|------|-----|
| **Site URL** | `https://k9atelier.com` |

生产环境用上面的 Site URL。本地开发走应用里的 `emailRedirectTo`（见登录相关代码），不依赖 Site URL。

### Redirect URLs（白名单）

把下面每一行都加进去：

```
https://k9atelier.com/auth/callback
https://k9atelier.com/auth/reset
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset
http://localhost:3003/auth/callback
http://localhost:3004/auth/callback
```

如果 `npm run dev` 用了别的端口，测 Magic Link 前也把该端口加进白名单。

### Email OTP 位数

**Dashboard → Authentication → Sign In / Providers → Email → Email OTP length**

设为 **6**（最短可用；Supabase **不支持** 4 位邮箱 OTP）。

允许范围：**6–10** 位。登录页输入框按这个范围校验。

---

## 2. 邮件模板

**Dashboard → Authentication → Email Templates**

从下面文件复制 HTML：

| 模板 | 文件 | 主题 |
|------|------|------|
| **Magic Link** | [`email-templates/magic-link.html`](./email-templates/magic-link.html) | `Your K9 Atelier sign-in link` |
| **Confirm signup** | [`email-templates/confirm-signup.html`](./email-templates/confirm-signup.html) | `Welcome to K9 Atelier — confirm your email` |
| **Reset password** | [`email-templates/reset-password.html`](./email-templates/reset-password.html) | `Reset your K9 Atelier password` |

（邮件主题保持英文，因为会发给客人。）

两个模板都包含：

- 按钮上的 **`{{ .ConfirmationURL }}`** — 会尊重应用的 `emailRedirectTo`（任意本地端口都能用）
- **`{{ .Token }}`** — 在 `/login` 手动输入的 6 位 OTP

细节见 [`email-templates/README.md`](./email-templates/README.md)。

---

## 3. 数据库 migrations（第二阶段 archive 修复）

v5 foundation 之后，按顺序执行：

1. [`migrations/20260812143000_phase2_pet_archive.sql`](./migrations/20260812143000_phase2_pet_archive.sql)

第二阶段验收时如果已经手动跑过，也可以再跑（幂等，安全）。

可选校验（`.env.local` 里需要 `DATABASE_URL`）：

```bash
npm run verify:supabase
```

## 4. 客户档案备注（仅员工）

让员工能在完成账单时保存私密备注，并在该客户档案里看到同一批备注。

1. 打开项目 `ceejxoobxxoxqhpujrdz` 的 Supabase Dashboard  
2. 左侧 → **SQL Editor** → **New query**  
3. 粘贴 [`migrations/20260917013000_customer_admin_notes.sql`](./migrations/20260917013000_customer_admin_notes.sql) 全文  
4. 点 **Run**

可重复执行。成功后，Customer record 上的 **Save** 会写入线上数据库。

## 5. 客户服务地址（员工可添加 / 编辑）

让员工在 Registered Accounts 客户档案里保存服务地址（不必先有预约），并编辑已有上门地址。

1. 打开项目 `ceejxoobxxoxqhpujrdz` 的 Supabase Dashboard  
2. 左侧 → **SQL Editor** → **New query**  
3. 粘贴 [`migrations/20261004020000_customer_service_addresses.sql`](./migrations/20261004020000_customer_service_addresses.sql) 全文  
4. 点 **Run**

可重复执行。成功后，客户档案 **Service addresses** 的 **Edit** / **+ Add address** 会写入线上数据库；编辑时也会同步改写匹配的预约地址。

---

## 检查清单

- [ ] Site URL = `https://k9atelier.com`
- [ ] Redirect URLs 包含生产 + localhost 回调
- [ ] Magic Link 模板已粘贴；邮件里能看到 6 位验证码
- [ ] Confirm signup 模板已粘贴
- [ ] 第二阶段 archive migration 已执行
- [ ] 客户服务地址 migration 已执行
- [ ] 在 `/login` 测试密码登录和 OTP 备用方式
- [ ] Email provider：允许新注册；Confirm email 打开（注册时发一封确认邮件）
