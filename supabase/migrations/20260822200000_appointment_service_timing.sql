-- Visit check-in / check-out for hourly services such as hand stripping.
-- Run in Supabase SQL Editor after review.

BEGIN;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_ended_at timestamptz;

COMMIT;
