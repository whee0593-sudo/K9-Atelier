# Supabase Auth Setup (K9 Atelier)

One-time Dashboard configuration for Magic Link + OTP login. Required before Phase 3.

Project ref: `ceejxoobxxoxqhpujrdz`

---

## 1. URL Configuration

**Dashboard → Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| **Site URL** | `https://k9atelier.com` |

Keep production as Site URL. Local dev uses `emailRedirectTo` from the app (see login code), not Site URL.

### Redirect URLs (allowlist)

Add every URL below (one per line):

```
https://k9atelier.com/auth/callback
https://k9atelier.com/auth/reset
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset
http://localhost:3003/auth/callback
http://localhost:3004/auth/callback
```

When `npm run dev` picks a different port, add that port too before testing Magic Link.

### Email OTP length

**Dashboard → Authentication → Sign In / Providers → Email → Email OTP length**

Set to **6** (shortest allowed; Supabase does **not** support 4-digit email OTP).

Allowed range: **6–10** digits. The login page input matches this range.

---

## 2. Email Templates

**Dashboard → Authentication → Email Templates**

Copy HTML from:

| Template | File | Subject |
|----------|------|---------|
| **Magic Link** | [`email-templates/magic-link.html`](./email-templates/magic-link.html) | `Your K9 Atelier sign-in link` |
| **Confirm signup** | [`email-templates/confirm-signup.html`](./email-templates/confirm-signup.html) | `Welcome to K9 Atelier — confirm your email` |
| **Reset password** | [`email-templates/reset-password.html`](./email-templates/reset-password.html) | `Reset your K9 Atelier password` |

Both templates include:

- **`{{ .ConfirmationURL }}`** on the button — respects the app’s `emailRedirectTo` (works on any local port)
- **`{{ .Token }}`** — 6-digit OTP for manual entry on `/login`

See [`email-templates/README.md`](./email-templates/README.md) for details.

---

## 3. Database migrations (Phase 2 archive fix)

After v5 foundation, apply in order:

1. [`migrations/20260812143000_phase2_pet_archive.sql`](./migrations/20260812143000_phase2_pet_archive.sql)

Already applied manually during Phase 2 acceptance? Safe to re-run (idempotent).

Verify (optional, requires `DATABASE_URL` in `.env.local`):

```bash
npm run verify:supabase
```

---

## Checklist

- [ ] Site URL = `https://k9atelier.com`
- [ ] Redirect URLs include production + localhost callbacks
- [ ] Magic Link template pasted; email shows 6-digit code
- [ ] Confirm signup template pasted
- [ ] Phase 2 archive migration applied
- [ ] Test password sign-in and OTP fallback on `/login`
- [ ] Email provider: allow new signups; Confirm email ON (one confirmation email at signup)
