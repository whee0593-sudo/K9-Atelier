-- Track partial and full refunds on appointment charges.
-- Run in Supabase SQL Editor after review.

ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0
    CHECK (refunded_amount >= 0),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
