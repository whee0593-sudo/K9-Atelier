BEGIN;

-- Column-level privileges on pets are explicit. Adding rabies_status did not
-- grant INSERT/UPDATE to authenticated, so customer/staff pet saves that
-- include rabies_status failed with permission denied (HTTP 500).
GRANT USAGE ON TYPE public.pet_rabies_status TO authenticated;

GRANT INSERT (rabies_status) ON TABLE public.pets TO authenticated;
GRANT UPDATE (rabies_status) ON TABLE public.pets TO authenticated;

COMMIT;
