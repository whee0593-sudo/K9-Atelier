BEGIN;

CREATE TABLE IF NOT EXISTS public.staff_sms_reply_targets (
  staff_phone text PRIMARY KEY,
  customer_phone text NOT NULL,
  customer_name text,
  pet_names text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.staff_sms_reply_targets FROM PUBLIC;
REVOKE ALL ON TABLE public.staff_sms_reply_targets FROM anon;
REVOKE ALL ON TABLE public.staff_sms_reply_targets FROM authenticated;

ALTER TABLE public.staff_sms_reply_targets ENABLE ROW LEVEL SECURITY;

COMMIT;
