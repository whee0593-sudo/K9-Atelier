# K9 Atelier

Mobile pet grooming marketing + online booking website.

- Stack: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Package manager: **npm** (`package-lock.json`).
- No database. Business data (services, pricing, fees, travel/booking rules, privacy settings) lives in `content/business.json` — the single source of truth.
- Auth is preview-only, not real: customer/admin "login" is a `localStorage`/cookie stub (see `src/lib/customer-session.ts`, `src/lib/site-access.ts`), and there is no backend user store.

## Cursor Cloud specific instructions

Standard commands are in `package.json`: `npm run dev` (→ http://localhost:3000), `npm run build`, `npm run start`. Non-obvious caveats:

- **Privacy gate is active in local dev.** `content/business.json` sets `site.privacyMode: true` AND `site.previewAccessPassword` (currently `"Anakin"`). Because a preview password is configured, `middleware.ts` redirects every non-public page to `/under-construction` even in `npm run dev`. To view the real site you must unlock it:
  - Go to `/login/admin`, enter the preview password (`Anakin`, or whatever `site.previewAccessPassword` / the `SITE_ACCESS_PASSWORD` env var is set to), and submit. This sets an HttpOnly `k9-site-access` cookie via `POST /api/site-access`.
  - Or set env `SITE_PRIVACY_MODE=false` to disable the gate entirely for local dev (see `isPrivacyModeEnabled` in `src/lib/site-access.ts`).
  - `SITE_ACCESS_PASSWORD` env overrides the `business.json` password. `.env*.local` is gitignored; no env file is required for dev since `business.json` already provides the password.
- **The homepage (`/`) is a minimal portal** (logo + "Book Service" / "Online Shop" buttons), not a long marketing page. Rich content lives on `/services`, `/book`, `/service-area`, etc. There is no `/home` route.
- **Booking requires "customer login" first** (`/book` shows a "Customer login required" gate). This is the `localStorage` stub above, not real auth.
- **`npm run lint` is not usable out of the box.** No ESLint config is committed, so `next lint` drops into an interactive "How would you like to configure ESLint?" prompt and cannot run non-interactively. `next build` compiles and type-checks fine regardless.
- Deployment target is Vercel (push to `main` auto-deploys). See `DEPLOY.md` / `VERCEL-404-FIX.md`.
