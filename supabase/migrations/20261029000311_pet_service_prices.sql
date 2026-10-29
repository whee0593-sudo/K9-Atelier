-- Per-dog primary-service prices. NULL restores standard pricing; old bookings stay frozen.
CREATE TABLE public.pet_service_prices (
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  service_id text NOT NULL CHECK (length(service_id) BETWEEN 1 AND 100),
  amount numeric CHECK (amount IS NULL OR (amount >= 0 AND amount <= 5000 AND amount = round(amount, 2))),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pet_id, service_id)
);
CREATE INDEX pet_service_prices_updated_by_idx ON public.pet_service_prices(updated_by);
ALTER TABLE public.pet_service_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pet_service_prices FROM anon, authenticated;
GRANT SELECT ON public.pet_service_prices TO authenticated;
GRANT ALL ON public.pet_service_prices TO service_role;
CREATE POLICY pet_service_prices_owner_read ON public.pet_service_prices
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.customer_id = (SELECT auth.uid()) AND p.archived_at IS NULL
  ));

CREATE TABLE public.pet_service_price_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pet_id uuid NOT NULL,
  service_id text NOT NULL,
  previous_amount numeric,
  amount numeric,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pet_service_price_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pet_service_price_events FROM anon, authenticated;
GRANT ALL ON public.pet_service_price_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.pet_service_price_events_id_seq TO service_role;

CREATE FUNCTION public.audit_pet_service_price() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_WHEN = 'BEFORE' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.amount IS DISTINCT FROM OLD.amount THEN
    INSERT INTO public.pet_service_price_events(pet_id, service_id, previous_amount, amount, actor_id)
    VALUES (NEW.pet_id, NEW.service_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.amount ELSE NULL END, NEW.amount, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_pet_service_price() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_pet_service_price() TO service_role;
CREATE TRIGGER pet_service_price_timestamp BEFORE INSERT OR UPDATE ON public.pet_service_prices
  FOR EACH ROW EXECUTE FUNCTION public.audit_pet_service_price();
CREATE TRIGGER pet_service_price_audit AFTER INSERT OR UPDATE ON public.pet_service_prices
  FOR EACH ROW EXECUTE FUNCTION public.audit_pet_service_price();
