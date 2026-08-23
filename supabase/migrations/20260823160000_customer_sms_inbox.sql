BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_sms_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone text NOT NULL,
  body text NOT NULL,
  customer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  customer_name text,
  pet_names text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_sms_messages_created_at_idx
  ON public.customer_sms_messages (created_at DESC);

REVOKE ALL ON TABLE public.customer_sms_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_sms_messages FROM anon;
REVOKE ALL ON TABLE public.customer_sms_messages FROM authenticated;
GRANT SELECT ON TABLE public.customer_sms_messages TO authenticated;

ALTER TABLE public.customer_sms_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_sms_messages_select_staff ON public.customer_sms_messages;
CREATE POLICY customer_sms_messages_select_staff
  ON public.customer_sms_messages
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

COMMIT;
