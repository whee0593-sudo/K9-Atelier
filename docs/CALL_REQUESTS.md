# Request a Call — local implementation and release checks

This is a separate callback workflow. It does not insert appointments, Visits, availability reservations or Google Ads booking conversions. Existing Book Online endpoints are unchanged.

## Flow

The customer provides name, callable phone format and explicit card-save consent. Card details are collected by Stripe Elements, never by application inputs. A random one-hour HttpOnly SameSite=Strict cookie identifies a draft; only its SHA-256 hash is stored. Mutations require a matching Origin and JSON bodies under 4 KB. Remote access requires HTTPS. Draft creation is limited durably to five per IP hash per hour, with an advisory lock; individual requests also have an application rate limit.

Contact data freezes when setup begins. Stripe customer/setup creation has stable idempotency keys. SetupIntent uses card-only `off_session` setup, without a PaymentIntent or charge. Completion retrieves the stored SetupIntent and PaymentMethod and verifies succeeded status, intent, metadata, customer, method and card type before storing the received request. Retry after a saved card does not require another setup. Repeated completion is idempotent. The success copy explicitly says the appointment is not confirmed.

Staff can see only received/contacted requests in Admin → Call Requests. Owners may link a card to a completed customer profile by email after the phone conversation. The database transaction rejects ambiguous profiles, a different Stripe customer or a card already assigned elsewhere. It never replaces another customer’s cards, and does not create an appointment. Linking a previously linked request is a no-op, including after a customer removes a saved card.

Merchant email uses an independent communication idempotency key, with hourly retry of pending notices. Existing appointment notifications and reminder schedules are unchanged. Notice failure does not undo the request. Cards and contact details are not exposed through public Supabase roles; both table/RPC grants and RLS are restricted. Staff display uses masked card metadata only.

## Local prerequisites

- A separate Supabase test project with the existing project schema, plus the new `20261020140839_call_requests.sql` migration. Do not apply to Production during review.
- `NEXT_PUBLIC_SUPABASE_URL`, the public Supabase key and the server-only Supabase secret/service-role key for that test project.
- A matching Stripe **test-mode** secret key and publishable key.
- Set `CALL_REQUESTS_ENABLED=true` only after the migration is present in the target test environment. Missing configuration disables submission and offers the published phone number; it never produces fake success.
- Leave `CALL_REQUEST_NOTICES_ENABLED` unset/false during local review. Turning it on uses the existing verified merchant sender and merchant inbox, so it can send real merchant emails. Verify notification behavior in a deliberately configured non-production provider environment before enabling it.
- `CRON_SECRET` protects notification replay. No production environment variables have been changed.

## Verification

Run `npm run test:call-requests`, the existing regression suite and `npm run build`. The callback suite uses local PGlite to execute the migration against isolated tables and roles: revoked guest/customer permissions, RLS, durable limits, incomplete-card rejection, card ownership and atomic/idempotent customer linking. API tests cover CSRF, disabled configuration and cron authorization. Form tests enforce the minimal fields and unavailable state.

Before release, use the configured test environment to verify a successful test card, a declined card, 3DS, refresh/back/retry, timeout after successful Stripe setup but before completion, duplicate clicks, merchant replay and authenticated staff linking. Verify the unchanged Book Online flow end to end. These live provider checks cannot be claimed from local unit/SQL/build checks alone.

Before Production rollout, approve retention/cleanup of abandoned drafts and their standalone Stripe test/customer objects. Session expiry blocks further guest access; it does not delete saved records. Include the new workflow in the business’s existing privacy/retention process. Any deployment, production migration, merge or push remains a separate explicitly approved action.
