# K9 Atelier

Mobile pet grooming marketing + online booking website.

- Stack: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4. Package manager: **npm** (`package-lock.json`).
- No database. Business data (services, pricing, fees, travel/booking rules, privacy settings) lives in `content/business.json` — the single source of truth.
- Auth is preview-only, not real: customer/admin "login" is a `localStorage`/cookie stub (see `src/lib/customer-session.ts`, `src/lib/site-access.ts`), and there is no backend user store.

## Cursor Cloud specific instructions

Standard commands are in `package.json`: `npm run dev` (→ http://localhost:3000), `npm run build`, `npm run start`. Non-obvious caveats:

- **Privacy gate can be active in local dev.** When `content/business.json` sets `site.privacyMode: true` and `SITE_ACCESS_PASSWORD` is configured, `middleware.ts` redirects every non-public page to `/under-construction`. To view the real site you must unlock it:
  - Go to `/login/admin`, enter the password from the server-only `SITE_ACCESS_PASSWORD` environment variable, and submit. This sets an HttpOnly `k9-site-access` cookie via `POST /api/site-access`.
  - Or set env `SITE_PRIVACY_MODE=false` to disable the gate entirely for local dev (see `isPrivacyModeEnabled` in `src/lib/site-access.ts`).
  - Secrets and the private mobile-service base address are never stored in `business.json`. Put `SITE_ACCESS_PASSWORD`, `SITE_PREVIEW_SHARE_TOKEN`, and `SITE_BASE_ADDRESS` in `.env.local`; `.env*.local` is gitignored.
- **The homepage (`/`) is a minimal portal** (logo + "Book Service" / "Online Shop" buttons), not a long marketing page. Rich content lives on `/services`, `/book`, `/service-area`, etc. There is no `/home` route.
- **Booking requires "customer login" first** (`/book` shows a "Customer login required" gate). This is the `localStorage` stub above, not real auth.
- **`npm run lint` is not usable out of the box.** No ESLint config is committed, so `next lint` drops into an interactive "How would you like to configure ESLint?" prompt and cannot run non-interactively. `next build` compiles and type-checks fine regardless.
- **Do not run `npm run build` while `npm run dev` is running.** The production build overwrites the shared `.next` directory and breaks the running dev server with `MODULE_NOT_FOUND` / `Cannot find module './xxx.js'` 500s. To recover: stop dev, `rm -rf .next`, then `npm run dev` again.
- Deployment target is Vercel (push to `main` auto-deploys). See `DEPLOY.md` / `VERCEL-404-FIX.md`.
