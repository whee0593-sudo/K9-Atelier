BEGIN;

ALTER TABLE public.customer_sms_messages
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}'::text[];

COMMIT;
