BEGIN;

-- These customer-editable columns were added after the original column grants.
-- Existing ownership policies still restrict updates to the current customer.
GRANT UPDATE (household_allergy_status, household_allergy_details)
  ON TABLE public.profiles TO authenticated;
GRANT INSERT (allergy_status, allergy_details),
      UPDATE (allergy_status, allergy_details)
  ON TABLE public.pets TO authenticated;

COMMIT;
