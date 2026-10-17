-- Compatibility column only. This file must run after
-- 20261009130000_communication_logs.sql has created public.communication_logs.
-- It does not create that table. A second CREATE TABLE would diverge from the
-- canonical snapshot schema if this file ran first.
-- decideClaim does not read provider_called_at. A null value is not proof the
-- provider never received the request, and it is not a second claim.

BEGIN;

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS provider_called_at timestamptz;

COMMENT ON COLUMN public.communication_logs.provider_called_at IS
  'Reserved compatibility column. The unified claim is decideClaim. Null does not mean the provider was never called.';

COMMIT;
