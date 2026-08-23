-- Staff checkout after service, no-show charges, and receipt channel.
-- Run in Supabase SQL Editor after review.

BEGIN;

CREATE TABLE IF NOT EXISTS public.appointment_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('service', 'no_show')),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL CHECK (subtotal >= 0),
  tip_amount numeric NOT NULL DEFAULT 0 CHECK (tip_amount >= 0),
  total numeric NOT NULL CHECK (total >= 0),
  currency text NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id text,
  payment_method_id uuid REFERENCES public.payment_methods (id) ON DELETE SET NULL,
  receipt_channel text CHECK (receipt_channel IN ('sms', 'email')),
  receipt_sent_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS appointment_charges_appointment_id_idx
  ON public.appointment_charges (appointment_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS appointment_charges_one_paid_kind_uidx
  ON public.appointment_charges (appointment_id, kind)
  WHERE status = 'paid';

REVOKE ALL ON TABLE public.appointment_charges FROM PUBLIC;
REVOKE ALL ON TABLE public.appointment_charges FROM anon;
REVOKE ALL ON TABLE public.appointment_charges FROM authenticated;
GRANT SELECT ON TABLE public.appointment_charges TO authenticated;

ALTER TABLE public.appointment_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_charges_select_own_or_staff ON public.appointment_charges;
CREATE POLICY appointment_charges_select_own_or_staff
  ON public.appointment_charges
  FOR SELECT
  TO authenticated
  USING (
    private.is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = appointment_id
        AND a.customer_id = (SELECT auth.uid())
    )
  );

COMMIT;
