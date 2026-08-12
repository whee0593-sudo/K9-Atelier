# Supabase Auth Email Templates (K9 Atelier)

Paste into **Supabase Dashboard → Authentication → Email Templates**.

Full setup (redirect URLs, checklist): [`../AUTH_SETUP.md`](../AUTH_SETUP.md)

---

## Files

| Template | HTML file | Subject line |
|----------|-----------|--------------|
| Magic Link | [`magic-link.html`](./magic-link.html) | `Your K9 Atelier sign-in link` |
| Confirm signup | [`confirm-signup.html`](./confirm-signup.html) | `Welcome to K9 Atelier — confirm your email` |

Open each `.html` file, copy all contents, paste into the matching Dashboard template body.

---

## Template variables used

| Variable | Purpose |
|----------|---------|
| `{{ .ConfirmationURL }}` | Button link — honors app `emailRedirectTo` (correct local port) |
| `{{ .Token }}` | 6-digit OTP for manual entry on `/login` |

Do **not** use `{{ .SiteURL }}` alone for the sign-in button in local dev; it ignores the port from `npm run dev`.

---

## Redirect URL allowlist

Add in **Authentication → URL Configuration**:

```
https://k9atelier.com/auth/callback
http://localhost:3000/auth/callback
http://localhost:3003/auth/callback
http://localhost:3004/auth/callback
```

Site URL stays `https://k9atelier.com`.

### Email OTP length

**Authentication → Sign In / Providers → Email → Email OTP length** = **6** (minimum; 4 digits is not supported by Supabase).

---

## Dashboard checks

- [ ] Magic Link body pasted from `magic-link.html`
- [ ] Confirm signup body pasted from `confirm-signup.html`
- [ ] Test email shows **Access My Account** button and **6-digit code**
- [ ] OTP login works on `/login`
- [ ] Magic Link opens `/auth/callback` on the same port you used to request login
