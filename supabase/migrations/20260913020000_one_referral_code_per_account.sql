-- One active referral code per customer account.
-- Prefer the first uploaded pet's code, deactivate extras, rewrite keepers to
-- {FIRST_PET_NAME}{PHONE_LAST4}, and enforce uniqueness.

WITH first_pets AS (
  SELECT DISTINCT ON (customer_id)
    customer_id,
    id AS pet_id
  FROM public.pets
  ORDER BY customer_id, created_at ASC, id ASC
),
ranked AS (
  SELECT
    c.id,
    ROW_NUMBER() OVER (
      PARTITION BY c.owner_customer_id
      ORDER BY
        CASE WHEN fp.pet_id IS NOT NULL THEN 0 ELSE 1 END,
        c.created_at ASC,
        c.id ASC
    ) AS rn
  FROM public.pet_referral_codes c
  LEFT JOIN first_pets fp
    ON fp.customer_id = c.owner_customer_id
   AND fp.pet_id = c.pet_id
  WHERE c.is_active = true
)
UPDATE public.pet_referral_codes AS extra
SET
  is_active = false,
  updated_at = now()
FROM ranked
WHERE extra.id = ranked.id
  AND ranked.rn > 1;

DO $$
DECLARE
  rec RECORD;
  pet_token text;
  last4 text;
  base text;
  candidate text;
  attempt integer;
BEGIN
  FOR rec IN
    SELECT
      c.id,
      p.name AS pet_name,
      pr.phone
    FROM public.pet_referral_codes c
    LEFT JOIN public.pets p ON p.id = c.pet_id
    LEFT JOIN public.profiles pr ON pr.id = c.owner_customer_id
    WHERE c.is_active = true
  LOOP
    last4 := right(regexp_replace(coalesce(rec.phone, ''), '\D', '', 'g'), 4);
    IF length(regexp_replace(coalesce(rec.phone, ''), '\D', '', 'g')) < 4 THEN
      CONTINUE;
    END IF;

    pet_token := upper(regexp_replace(coalesce(rec.pet_name, ''), '[^A-Za-z0-9]', '', 'g'));
    IF pet_token = '' THEN
      pet_token := 'K9';
    END IF;
    base := pet_token || last4;

    attempt := 1;
    LOOP
      candidate := CASE
        WHEN attempt <= 1 THEN base
        ELSE base || '-' || attempt::text
      END;
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.pet_referral_codes other
        WHERE other.referral_code_normalized = candidate
          AND other.id <> rec.id
      );
      attempt := attempt + 1;
      EXIT WHEN attempt > 40;
    END LOOP;

    UPDATE public.pet_referral_codes
    SET
      referral_code = candidate,
      referral_code_normalized = candidate,
      updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS pet_referral_codes_one_active_per_owner
  ON public.pet_referral_codes (owner_customer_id)
  WHERE is_active = true;
