-- Staff can file a dog profile before weight is known.
ALTER TABLE public.pets
  ALTER COLUMN weight_lbs DROP NOT NULL;

ALTER TABLE public.pets
  DROP CONSTRAINT IF EXISTS pets_weight_lbs_check;

ALTER TABLE public.pets
  ADD CONSTRAINT pets_weight_lbs_check
  CHECK (weight_lbs IS NULL OR (weight_lbs > 0 AND weight_lbs <= 200));
