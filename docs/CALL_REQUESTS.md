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

## Live test review — 2026-10-20

The dedicated Development project was transferred to the Free organization `K9 Atelier Testing`; Production remains in its original Pro organization. The callback migration was installed only in Development. Its older schema also needed server-only SELECT/UPDATE on profiles and SELECT/INSERT on payment_methods for owner linking. Public callback access remains denied. Local credentials are in ignored `.env*.local` files, with merchant notifications disabled.

Verified at 390 × 844: a card is saved and a callback request is received; refresh preserves success; the page says the appointment is not confirmed. A second browser test completed Stripe's 3D Secure challenge and saved the received request. Only test cards and test Stripe keys were used. API checks verified idempotent duplicate completion, rejection of declined cards and incomplete authentication, and denied public table reads. No charges or merchant notifications were created.

Live testing found that setting the uncollected email field to `never` made Stripe require an email in confirmSetup. The callback now leaves email collection at Stripe's default, while supplying the already-collected name and phone. The tested card form did not require email.

Authenticated owner linking, live merchant notification delivery, and an entire existing Book Online appointment have not been exercised against this older Development schema. These remain release checks; the booking, tracking, and notification isolation regression tests cover the existing behavior locally. Keep the callback feature disabled while the test database is paused. Do not deploy this configuration to Production.

## Staff and existing-booking review — 2026-10-20

The later review completed authenticated owner linking and an entire existing Book Online appointment in Development. The paragraph above records the earlier review's limits.

- Rehearsed the 47 existing migrations locally, then applied the 28 missing pre-callback migrations only to Development. Its older grants also needed server-only availability reads and day-plan writes; no public callback access was added.
- Created dedicated synthetic owner and customer accounts only in Development. Verified mobile queue display, masked card details, marking contacted, owner-only linking, anonymous/customer rejection, and duplicate linking leaving one saved card.
- Intercepted the email provider locally while using real Development communication records. Concurrent and repeated notice calls produced one provider attempt, one accepted test log and one receipt. The notice had no appointment/Visit relation. No email was sent. Actual email/SMS delivery remains unverified because provider credentials were unavailable; do not treat the intercepted provider receipt as real delivery.
- Completed Book Online at 390 × 844 with a synthetic pet/customer and a public test address. It reused the card linked from the callback, created exactly one confirmed appointment and one linked Visit, and produced zero Stripe charges. Missing notification/referral provider configuration did not roll back the booking.
- Found a reproducible migration omission: the allergy columns existed, but the original customer column grants did not cover them, so owner-details saving failed. The new `20261020191652_booking_allergy_field_permissions.sql` grants only those customer-editable fields. A database regression test reproduces the old denial, verifies own-profile/pet writes after the fix, and confirms other-customer, anonymous and Stripe-account updates remain denied. Applied only in Development; Production still needs separate review and approval.

Before release, supply a deliberately configured mail/SMS test environment and verify real delivery separately. Production migration, merge, push and deployment remain unapproved.
