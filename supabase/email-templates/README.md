# Supabase Auth Email Templates (K9 Atelier)

Paste into **Supabase Dashboard → Authentication → Email Templates**.

Full setup (redirect URLs, checklist): [`../AUTH_SETUP.md`](../AUTH_SETUP.md)

---

## Files

| Template | HTML file | Subject line |
|----------|-----------|--------------|
| Confirm signup | [`confirm-signup.html`](./confirm-signup.html) | `Welcome to K9 Atelier — confirm your email` |
| Reset password | [`reset-password.html`](./reset-password.html) | `Reset your K9 Atelier password` |

Open each `.html` file, copy all contents, paste into the matching Dashboard template body.

---

## Template variables used

| Variable | Purpose |
|----------|---------|
| `{{ .ConfirmationURL }}` | Button link — honors app `emailRedirectTo` (correct local port) |
| `{{ .Token }}` | 6-digit code for the password-reset form (reset template only) |

Do **not** use `{{ .SiteURL }}` alone for confirmation or reset buttons in local dev; it ignores the port from `npm run dev`.

The site does not use Magic Link / passwordless email login.

---

## Redirect URL allowlist

Add in **Authentication → URL Configuration**:

```
https://k9atelier.com/auth/callback
https://k9atelier.com/auth/reset
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset
http://localhost:3003/auth/callback
http://localhost:3004/auth/callback
```

Site URL stays `https://k9atelier.com`.

### Email OTP length

**Authentication → Sign In / Providers → Email → Email OTP length** = **6** (minimum; 4 digits is not supported by Supabase).

---

## Dashboard checks

- [ ] Confirm signup body pasted from `confirm-signup.html`
- [ ] Reset password body pasted from `reset-password.html`
- [ ] Confirm-signup email shows **Access My Account**
- [ ] Reset-password email shows **Set a new password** and a **6-digit code**
- [ ] Confirmation and reset links open `/auth/callback` or `/auth/reset` on the same port you used to request them
