BEGIN;

-- Acquisition source collected once during new-customer booking registration.
-- Nullable so existing/legacy profiles keep working without a value.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS referral_name text;

COMMENT ON COLUMN public.profiles.referral_source IS
  'How the customer heard about K9 Atelier (standardized value). Set once at registration.';
COMMENT ON COLUMN public.profiles.referral_name IS
  'Optional referrer name when referral_source = referral.';

COMMIT;
