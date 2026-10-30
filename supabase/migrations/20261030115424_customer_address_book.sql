BEGIN;

-- Address book edits affect future selections, never a booked visit snapshot.
GRANT INSERT (customer_id, street, city, state, zip)
  ON public.customer_service_addresses TO authenticated;
GRANT UPDATE (street, city, state, zip, address_lat, address_lon)
  ON public.customer_service_addresses TO authenticated;

CREATE POLICY customer_service_addresses_insert_own
  ON public.customer_service_addresses FOR INSERT TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));
CREATE POLICY customer_service_addresses_update_own
  ON public.customer_service_addresses FOR UPDATE TO authenticated
  USING (customer_id = (SELECT auth.uid()))
  WITH CHECK (customer_id = (SELECT auth.uid()));

-- Repair addresses omitted from the old customer-facing placeholder page.
INSERT INTO public.customer_service_addresses (customer_id, street, city, state, zip)
SELECT DISTINCT customer_id, trim(address_street), trim(address_city), trim(address_state), trim(address_zip)
FROM public.appointments
WHERE length(trim(address_street)) BETWEEN 1 AND 200
  AND length(trim(address_city)) BETWEEN 1 AND 120
  AND length(trim(address_state)) BETWEEN 1 AND 40
  AND length(trim(address_zip)) BETWEEN 1 AND 20
ON CONFLICT DO NOTHING;

-- Invoker rights preserve the caller's ownership checks. No service-role
-- credential or SECURITY DEFINER bypass is needed for customer bookings.
CREATE OR REPLACE FUNCTION private.remember_booking_service_address()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF length(trim(NEW.address_street)) BETWEEN 1 AND 200
    AND length(trim(NEW.address_city)) BETWEEN 1 AND 120
    AND length(trim(NEW.address_state)) BETWEEN 1 AND 40
    AND length(trim(NEW.address_zip)) BETWEEN 1 AND 20 THEN
    INSERT INTO public.customer_service_addresses (customer_id, street, city, state, zip)
    VALUES (NEW.customer_id, trim(NEW.address_street), trim(NEW.address_city), trim(NEW.address_state), trim(NEW.address_zip))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- An ancillary address-book error must never roll back a booking.
  RAISE WARNING 'Could not remember booking address: %', SQLSTATE;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.remember_booking_service_address() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER appointments_remember_service_address
  AFTER INSERT OR UPDATE OF address_street, address_city, address_state, address_zip
  ON public.appointments FOR EACH ROW
  EXECUTE FUNCTION private.remember_booking_service_address();

COMMIT;
