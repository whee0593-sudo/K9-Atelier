-- Record whether a collect charge was paid by card or cash.
-- Run in Supabase SQL Editor after review.

ALTER TABLE public.appointment_charges
  ADD COLUMN IF NOT EXISTS tender text NOT NULL DEFAULT 'card';

ALTER TABLE public.appointment_charges
  DROP CONSTRAINT IF EXISTS appointment_charges_tender_check;

ALTER TABLE public.appointment_charges
  ADD CONSTRAINT appointment_charges_tender_check
  CHECK (tender IN ('card', 'cash'));
