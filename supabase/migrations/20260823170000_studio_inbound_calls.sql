BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_inbound_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  customer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  called_at timestamptz NOT NULL DEFAULT now(),
  intro_sms_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS studio_inbound_calls_called_at_idx
  ON public.studio_inbound_calls (called_at DESC);

CREATE INDEX IF NOT EXISTS studio_inbound_calls_phone_idx
  ON public.studio_inbound_calls (phone);

REVOKE ALL ON TABLE public.studio_inbound_calls FROM PUBLIC;
REVOKE ALL ON TABLE public.studio_inbound_calls FROM anon;
REVOKE ALL ON TABLE public.studio_inbound_calls FROM authenticated;
GRANT SELECT ON TABLE public.studio_inbound_calls TO authenticated;

ALTER TABLE public.studio_inbound_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS studio_inbound_calls_select_staff ON public.studio_inbound_calls;
CREATE POLICY studio_inbound_calls_select_staff
  ON public.studio_inbound_calls
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

COMMIT;
