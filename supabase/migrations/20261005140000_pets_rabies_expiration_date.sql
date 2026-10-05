BEGIN;

-- Record expiration is part of the pet profile. It must survive a save
-- even when no certificate file is uploaded with it.
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS rabies_expiration_date date;

COMMENT ON COLUMN public.pets.rabies_expiration_date IS
  'Expiration date entered on the pet profile for the rabies record. Saved with the profile, with or without a certificate upload.';

UPDATE public.pets AS p
SET rabies_expiration_date = latest.expiration_date
FROM (
  SELECT DISTINCT ON (r.pet_id)
    r.pet_id,
    r.expiration_date
  FROM public.pet_vaccination_records AS r
  WHERE r.expiration_date IS NOT NULL
  ORDER BY r.pet_id, r.created_at DESC
) AS latest
WHERE p.id = latest.pet_id
  AND p.rabies_expiration_date IS NULL;

-- Column privileges are explicit. A new pets column is not writable until granted.
GRANT INSERT (rabies_expiration_date) ON TABLE public.pets TO authenticated;
GRANT UPDATE (rabies_expiration_date) ON TABLE public.pets TO authenticated;

COMMIT;
