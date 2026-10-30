BEGIN;

-- Deleting a saved selection must not rewrite or delete booked visit addresses.
GRANT DELETE ON public.customer_service_addresses TO authenticated;

CREATE POLICY customer_service_addresses_delete_own
  ON public.customer_service_addresses FOR DELETE TO authenticated
  USING (customer_id = (SELECT auth.uid()));

COMMIT;
