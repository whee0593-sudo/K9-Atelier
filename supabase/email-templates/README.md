# Supabase Auth 邮件模板（K9 Atelier）

粘贴到 **Supabase Dashboard → Authentication → Email Templates**。

完整设置（Redirect URLs、检查清单）：[`../AUTH_SETUP.md`](../AUTH_SETUP.md)

---

## 文件

| 模板 | HTML 文件 | 主题行（英文，发给客人） |
|------|-----------|--------------------------|
| Magic Link | [`magic-link.html`](./magic-link.html) | `Your K9 Atelier sign-in link` |
| Confirm signup | [`confirm-signup.html`](./confirm-signup.html) | `Welcome to K9 Atelier — confirm your email` |
| Reset password | [`reset-password.html`](./reset-password.html) | `Reset your K9 Atelier password` |

打开每个 `.html`，复制全部内容，粘贴到 Dashboard 对应模板正文。

---

## 用到的模板变量

| 变量 | 用途 |
|------|------|
| `{{ .ConfirmationURL }}` | 按钮链接 — 尊重应用的 `emailRedirectTo`（本地端口正确） |
| `{{ .Token }}` | 在 `/login` 手动输入的 6 位 OTP |

本地开发时，登录按钮**不要**只依赖 `{{ .SiteURL }}`；它不会带上 `npm run dev` 的端口。

---

## Redirect URL 白名单

在 **Authentication → URL Configuration** 添加：

```
https://k9atelier.com/auth/callback
https://k9atelier.com/auth/reset
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset
http://localhost:3003/auth/callback
http://localhost:3004/auth/callback
```

Site URL 保持 `https://k9atelier.com`。

### Email OTP 位数

**Authentication → Sign In / Providers → Email → Email OTP length** = **6**（最小值；Supabase 不支持 4 位）。

---

## Dashboard 检查

- [ ] Magic Link 正文已从 `magic-link.html` 粘贴
- [ ] Confirm signup 正文已从 `confirm-signup.html` 粘贴
- [ ] Reset password 正文已从 `reset-password.html` 粘贴
- [ ] 测试邮件显示 **Access My Account** 按钮和 **6 位验证码**
- [ ] `/login` 上 OTP 登录可用
- [ ] Magic Link 会打开你发起登录时同一端口的 `/auth/callback`
