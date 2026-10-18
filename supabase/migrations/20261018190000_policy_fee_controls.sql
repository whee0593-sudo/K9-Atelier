-- Policy-fee claims, no-show evidence, waivers, and refund audit.
-- This file does not UPDATE existing appointment_charges amounts or Stripe ids.
-- Historical paid rows keep claim_id NULL and stay under the previous uniqueness rule.

BEGIN;

CREATE TABLE IF NOT EXISTS public.policy_fee_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('cancel', 'reschedule', 'remove_dog', 'no_show')),
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE RESTRICT,
  affected_appointment_ids uuid[] NOT NULL DEFAULT '{}',
  includes_travel boolean NOT NULL DEFAULT false,
  forfeit boolean NOT NULL,
  computed_amount numeric NOT NULL CHECK (computed_amount >= 0),
  collect_cap numeric CHECK (collect_cap IS NULL OR collect_cap >= 0),
  waiver_amount numeric NOT NULL CHECK (waiver_amount >= 0),
  charged_amount numeric NOT NULL CHECK (charged_amount >= 0),
  tender text CHECK (tender IS NULL OR tender IN ('card', 'cash', 'zelle')),
  status text NOT NULL CHECK (status IN ('charging', 'charged', 'waived', 'failed', 'no_fee')),
  charge_id uuid,
  stripe_payment_intent_id text,
  stripe_idempotency_key text NOT NULL UNIQUE,
  attempt integer NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  actor_id uuid NOT NULL,
  waiver_id uuid,
  change_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  appointment_change_applied boolean NOT NULL DEFAULT false,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_fee_claims_reschedule_not_forfeit CHECK (
    action <> 'reschedule' OR NOT forfeit
  ),
  CONSTRAINT policy_fee_claims_forfeit_actions CHECK (
    action = 'reschedule' OR forfeit
  ),
  CONSTRAINT policy_fee_claims_amounts_balance CHECK (
    status = 'failed'
    OR round(charged_amount + waiver_amount, 2) = round(computed_amount, 2)
  )
);

CREATE INDEX IF NOT EXISTS policy_fee_claims_visit_idx
  ON public.policy_fee_claims (visit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.policy_fee_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.policy_fee_claims (id) ON DELETE RESTRICT,
  attempt integer NOT NULL CHECK (attempt >= 1),
  stripe_idempotency_key text NOT NULL UNIQUE,
  stripe_payment_intent_id text,
  status text NOT NULL CHECK (status IN ('failed', 'succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, attempt)
);

CREATE TABLE IF NOT EXISTS public.policy_fee_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES public.policy_fee_claims (id) ON DELETE RESTRICT,
  legacy_review_id uuid,
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE RESTRICT,
  component text NOT NULL CHECK (component IN ('service', 'travel')),
  active boolean NOT NULL DEFAULT true,
  release_reason text CHECK (
    release_reason IS NULL OR release_reason IN ('charge_failed', 'admin_reopen')
  ),
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_fee_coverage_owner CHECK (
    (claim_id IS NOT NULL AND legacy_review_id IS NULL)
    OR (claim_id IS NULL AND legacy_review_id IS NOT NULL)
  ),
  CONSTRAINT policy_fee_coverage_service_appointment CHECK (
    component <> 'service' OR appointment_id IS NOT NULL
  ),
  CONSTRAINT policy_fee_coverage_release CHECK (
    (active AND release_reason IS NULL)
    OR (NOT active AND release_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_fee_coverage_one_active_service
  ON public.policy_fee_coverage (appointment_id)
  WHERE component = 'service' AND active;

CREATE UNIQUE INDEX IF NOT EXISTS policy_fee_coverage_one_active_travel
  ON public.policy_fee_coverage (visit_id)
  WHERE component = 'travel' AND active;

CREATE TABLE IF NOT EXISTS public.fee_waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('cancel', 'reschedule', 'remove_dog', 'no_show')),
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE RESTRICT,
  collect_cap numeric NOT NULL CHECK (collect_cap >= 0),
  cap_kind text NOT NULL DEFAULT 'fixed_amount' CHECK (cap_kind = 'fixed_amount'),
  status text NOT NULL CHECK (status IN ('authorized', 'consumed', 'revoked')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 3),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumed_by_claim_id uuid REFERENCES public.policy_fee_claims (id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS fee_waivers_one_authorized
  ON public.fee_waivers (idempotency_key)
  WHERE status = 'authorized';

CREATE TABLE IF NOT EXISTS public.fee_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  appointment_id uuid REFERENCES public.appointments (id) ON DELETE RESTRICT,
  claim_id uuid REFERENCES public.policy_fee_claims (id) ON DELETE RESTRICT,
  charge_id uuid,
  waiver_id uuid REFERENCES public.fee_waivers (id) ON DELETE RESTRICT,
  fee_kind text NOT NULL CHECK (fee_kind IN ('cancellation', 'reschedule', 'remove_dog', 'no_show')),
  action text NOT NULL CHECK (
    action IN (
      'waiver_consumed',
      'waiver_revoked',
      'refund_requested',
      'refund_completed',
      'refund_failed',
      'coverage_reopened',
      'legacy_reviewed'
    )
  ),
  original_amount numeric NOT NULL CHECK (original_amount >= 0),
  adjustment_amount numeric NOT NULL CHECK (adjustment_amount >= 0),
  resulting_amount numeric NOT NULL CHECK (resulting_amount >= 0),
  actor_id uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 3),
  result text NOT NULL CHECK (result IN ('pending', 'completed', 'failed')),
  tender text CHECK (tender IS NULL OR tender IN ('card', 'cash', 'zelle')),
  stripe_refund_id text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  funds_confirmed_at timestamptz,
  funds_confirmed_by uuid,
  CONSTRAINT fee_adjustments_balance CHECK (
    round(original_amount - adjustment_amount, 2) = round(resulting_amount, 2)
  )
);

CREATE TABLE IF NOT EXISTS public.policy_fee_reopens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('cancel', 'reschedule', 'remove_dog', 'no_show')),
  base_key text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 3),
  actor_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('authorized', 'consumed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumed_by_claim_id uuid REFERENCES public.policy_fee_claims (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS policy_fee_reopens_one_authorized_action
  ON public.policy_fee_reopens (visit_id, action)
  WHERE status = 'authorized';

CREATE TABLE IF NOT EXISTS public.policy_fee_legacy_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id uuid NOT NULL UNIQUE,
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  classification text NOT NULL CHECK (classification IN ('forfeit', 'non_forfeit')),
  covers_travel boolean NOT NULL DEFAULT false,
  reason text NOT NULL CHECK (char_length(btrim(reason)) >= 3),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.policy_fee_coverage
  DROP CONSTRAINT IF EXISTS policy_fee_coverage_legacy_review_id_fkey;
ALTER TABLE public.policy_fee_coverage
  ADD CONSTRAINT policy_fee_coverage_legacy_review_id_fkey
  FOREIGN KEY (legacy_review_id) REFERENCES public.policy_fee_legacy_reviews (id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS public.visit_no_show_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits (id) ON DELETE RESTRICT,
  arrived_at timestamptz NOT NULL,
  contact_attempted_at timestamptz NOT NULL,
  contact_channel text NOT NULL CHECK (
    contact_channel IN ('phone', 'text_message', 'email', 'in_person', 'other')
  ),
  customer_replied boolean NOT NULL,
  handoff_arranged boolean NOT NULL,
  note text,
  recorded_by uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'confirmed', 'withdrawn')),
  confirmed_by uuid,
  confirmed_at timestamptz,
  charge_id uuid,
  withdrawn_by uuid,
  withdrawn_at timestamptz,
  withdraw_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT visit_no_show_reports_contact_after_arrival CHECK (
    contact_attempted_at >= arrived_at
  ),
  CONSTRAINT visit_no_show_reports_confirmed_fields CHECK (
    status <> 'confirmed'
    OR (
      confirmed_by IS NOT NULL
      AND confirmed_at IS NOT NULL
      AND NOT customer_replied
      AND NOT handoff_arranged
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS visit_no_show_reports_one_open
  ON public.visit_no_show_reports (visit_id)
  WHERE status IN ('draft', 'confirmed');

CREATE TABLE IF NOT EXISTS public.visit_policy_locks (
  visit_id uuid PRIMARY KEY REFERENCES public.visits (id) ON DELETE RESTRICT,
  claim_id uuid REFERENCES public.policy_fee_claims (id) ON DELETE RESTRICT,
  acquired_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS claim_id uuid REFERENCES public.policy_fee_claims (id) ON DELETE RESTRICT;

ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS refund_hold_id uuid REFERENCES public.fee_adjustments (id) ON DELETE RESTRICT;

ALTER TABLE public.policy_fee_claims
  DROP CONSTRAINT IF EXISTS policy_fee_claims_charge_id_fkey;
ALTER TABLE public.policy_fee_claims
  ADD CONSTRAINT policy_fee_claims_charge_id_fkey
  FOREIGN KEY (charge_id) REFERENCES public.appointment_charges (id) ON DELETE RESTRICT;

ALTER TABLE public.fee_adjustments
  DROP CONSTRAINT IF EXISTS fee_adjustments_charge_id_fkey;
ALTER TABLE public.fee_adjustments
  ADD CONSTRAINT fee_adjustments_charge_id_fkey
  FOREIGN KEY (charge_id) REFERENCES public.appointment_charges (id) ON DELETE RESTRICT;

ALTER TABLE public.policy_fee_legacy_reviews
  DROP CONSTRAINT IF EXISTS policy_fee_legacy_reviews_charge_id_fkey;
ALTER TABLE public.policy_fee_legacy_reviews
  ADD CONSTRAINT policy_fee_legacy_reviews_charge_id_fkey
  FOREIGN KEY (charge_id) REFERENCES public.appointment_charges (id) ON DELETE RESTRICT;

ALTER TABLE public.visit_no_show_reports
  DROP CONSTRAINT IF EXISTS visit_no_show_reports_charge_id_fkey;
ALTER TABLE public.visit_no_show_reports
  ADD CONSTRAINT visit_no_show_reports_charge_id_fkey
  FOREIGN KEY (charge_id) REFERENCES public.appointment_charges (id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS appointment_charges_one_claim_uidx
  ON public.appointment_charges (claim_id)
  WHERE claim_id IS NOT NULL;

DROP INDEX IF EXISTS public.appointment_charges_one_paid_kind_uidx;
CREATE UNIQUE INDEX appointment_charges_one_paid_kind_uidx
  ON public.appointment_charges (appointment_id, kind)
  WHERE status = 'paid'
    AND claim_id IS NULL
    AND NOT (
      total > 0
      AND refunded_amount >= total
    );

COMMIT;
