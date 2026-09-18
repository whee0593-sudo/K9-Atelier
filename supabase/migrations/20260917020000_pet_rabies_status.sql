BEGIN;

-- Customer-confirmed rabies status. File uploads remain optional profile records.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'pet_rabies_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.pet_rabies_status AS ENUM (
      'current',
      'medical_exemption'
    );
  END IF;
END
$$;

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS rabies_status public.pet_rabies_status;

COMMENT ON COLUMN public.pets.rabies_status IS
  'Customer-confirmed rabies status (current or veterinarian medical exemption). Required to book. Certificate upload is optional.';

-- Existing pets with a vaccination document can keep booking without re-confirming.
UPDATE public.pets p
SET rabies_status = 'current'
WHERE p.rabies_status IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.pet_vaccination_records r
    WHERE r.pet_id = p.id
  );

COMMIT;
