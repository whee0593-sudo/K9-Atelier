BEGIN;
CREATE TABLE public.call_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  ip_hash text NOT NULL CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','requested','contacted')),
  name text CHECK (char_length(name) BETWEEN 2 AND 100),
  phone text CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  consent_at timestamptz,
  consent_version text,
  stripe_customer_id text UNIQUE,
  stripe_setup_intent_id text UNIQUE,
  stripe_payment_method_id text UNIQUE,
  card_brand text,
  card_last4 text CHECK (card_last4 ~ '^[0-9]{4}$'),
  card_exp_month integer CHECK (card_exp_month BETWEEN 1 AND 12),
  card_exp_year integer CHECK (card_exp_year >= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '1 hour',
  requested_at timestamptz,
  contacted_at timestamptz,
  notice_sent_at timestamptz,
  linked_customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (status = 'draft' OR (name IS NOT NULL AND phone IS NOT NULL AND consent_at IS NOT NULL AND consent_version IS NOT NULL AND stripe_customer_id IS NOT NULL AND stripe_setup_intent_id IS NOT NULL AND stripe_payment_method_id IS NOT NULL AND card_brand IS NOT NULL AND card_last4 IS NOT NULL AND card_exp_month IS NOT NULL AND card_exp_year IS NOT NULL AND requested_at IS NOT NULL))
);
CREATE INDEX call_requests_ip_created_idx ON public.call_requests(ip_hash, created_at);
CREATE INDEX call_requests_pending_notice_idx ON public.call_requests(requested_at) WHERE status <> 'draft' AND notice_sent_at IS NULL;
ALTER TABLE public.call_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.call_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.call_requests TO service_role;
COMMENT ON TABLE public.call_requests IS 'Server-only callback requests. No appointment, Visit or availability reservation. Never store raw card details.';

CREATE FUNCTION public.create_call_request_draft(p_token_hash text, p_ip_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE request_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  IF (SELECT count(*) FROM public.call_requests WHERE ip_hash = p_ip_hash AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'call_request_rate_limit';
  END IF;
  INSERT INTO public.call_requests(token_hash,ip_hash) VALUES(p_token_hash,p_ip_hash) RETURNING id INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_call_request_draft(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_call_request_draft(text,text) TO service_role;

-- Called only after server-side owner authorization. Never merge by guest-supplied phone.
CREATE FUNCTION public.link_call_request_customer(p_request_id uuid, p_customer_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE r public.call_requests%ROWTYPE; p public.profiles%ROWTYPE; method_id uuid; existing_customer uuid;
BEGIN
  SELECT * INTO STRICT r FROM public.call_requests WHERE id=p_request_id AND status <> 'draft' FOR UPDATE;
  SELECT * INTO STRICT p FROM public.profiles WHERE lower(email)=lower(trim(p_customer_email)) FOR UPDATE;
  IF r.linked_customer_id IS NOT NULL AND r.linked_customer_id <> p.id THEN RAISE EXCEPTION 'already_linked'; END IF;
  IF r.linked_customer_id = p.id THEN RETURN p.id; END IF;
  IF p.stripe_customer_id IS NOT NULL AND p.stripe_customer_id <> r.stripe_customer_id THEN RAISE EXCEPTION 'different_stripe_customer'; END IF;
  IF p.stripe_customer_id IS NULL AND EXISTS(SELECT 1 FROM public.payment_methods WHERE customer_id=p.id) THEN RAISE EXCEPTION 'existing_saved_card'; END IF;
  SELECT customer_id INTO existing_customer FROM public.payment_methods WHERE stripe_payment_method_id=r.stripe_payment_method_id;
  IF existing_customer IS NOT NULL AND existing_customer <> p.id THEN RAISE EXCEPTION 'card_already_linked'; END IF;
  UPDATE public.profiles SET stripe_customer_id=r.stripe_customer_id WHERE id=p.id;
  INSERT INTO public.payment_methods(customer_id,stripe_payment_method_id,brand,last4,exp_month,exp_year,is_default)
    VALUES(p.id,r.stripe_payment_method_id,r.card_brand,r.card_last4,r.card_exp_month,r.card_exp_year,
      NOT EXISTS(SELECT 1 FROM public.payment_methods WHERE customer_id=p.id))
    ON CONFLICT(stripe_payment_method_id) DO NOTHING RETURNING id INTO method_id;
  UPDATE public.call_requests SET linked_customer_id=p.id WHERE id=r.id;
  RETURN p.id;
END;
$$;
REVOKE ALL ON FUNCTION public.link_call_request_customer(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_call_request_customer(uuid,text) TO service_role;
COMMIT;
