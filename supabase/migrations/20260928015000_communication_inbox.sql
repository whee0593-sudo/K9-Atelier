BEGIN;

CREATE TABLE IF NOT EXISTS public.communication_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  customer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communication_conversations_phone_key UNIQUE (phone_number)
);

CREATE INDEX IF NOT EXISTS communication_conversations_activity_idx
  ON public.communication_conversations (last_activity_at DESC);

CREATE INDEX IF NOT EXISTS communication_conversations_customer_idx
  ON public.communication_conversations (customer_id);

CREATE TABLE IF NOT EXISTS public.communication_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.communication_conversations (id) ON DELETE CASCADE,
  twilio_message_sid text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT communication_messages_sid_key UNIQUE (twilio_message_sid)
);

CREATE INDEX IF NOT EXISTS communication_messages_conversation_created_idx
  ON public.communication_messages (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.communication_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.communication_conversations (id) ON DELETE CASCADE,
  twilio_call_sid text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  status text NOT NULL DEFAULT 'ringing',
  answered boolean,
  duration integer,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT communication_calls_sid_key UNIQUE (twilio_call_sid)
);

CREATE INDEX IF NOT EXISTS communication_calls_conversation_created_idx
  ON public.communication_calls (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS communication_calls_unhandled_idx
  ON public.communication_calls (created_at DESC)
  WHERE direction = 'inbound'
    AND answered = false
    AND read_at IS NULL;

DROP TRIGGER IF EXISTS communication_conversations_set_updated_at
  ON public.communication_conversations;
CREATE TRIGGER communication_conversations_set_updated_at
  BEFORE UPDATE ON public.communication_conversations
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

REVOKE ALL ON TABLE public.communication_conversations FROM PUBLIC;
REVOKE ALL ON TABLE public.communication_conversations FROM anon;
REVOKE ALL ON TABLE public.communication_conversations FROM authenticated;
GRANT SELECT ON TABLE public.communication_conversations TO authenticated;
GRANT ALL ON TABLE public.communication_conversations TO service_role;

REVOKE ALL ON TABLE public.communication_messages FROM PUBLIC;
REVOKE ALL ON TABLE public.communication_messages FROM anon;
REVOKE ALL ON TABLE public.communication_messages FROM authenticated;
GRANT SELECT ON TABLE public.communication_messages TO authenticated;
GRANT ALL ON TABLE public.communication_messages TO service_role;

REVOKE ALL ON TABLE public.communication_calls FROM PUBLIC;
REVOKE ALL ON TABLE public.communication_calls FROM anon;
REVOKE ALL ON TABLE public.communication_calls FROM authenticated;
GRANT SELECT ON TABLE public.communication_calls TO authenticated;
GRANT ALL ON TABLE public.communication_calls TO service_role;

ALTER TABLE public.communication_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_conversations_select_staff
  ON public.communication_conversations;
CREATE POLICY communication_conversations_select_staff
  ON public.communication_conversations
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

DROP POLICY IF EXISTS communication_messages_select_staff
  ON public.communication_messages;
CREATE POLICY communication_messages_select_staff
  ON public.communication_messages
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

DROP POLICY IF EXISTS communication_calls_select_staff
  ON public.communication_calls;
CREATE POLICY communication_calls_select_staff
  ON public.communication_calls
  FOR SELECT
  TO authenticated
  USING (private.is_staff());

CREATE OR REPLACE VIEW public.communication_inbox_rows
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.phone_number,
  c.customer_id,
  c.last_activity_at,
  c.unread_count,
  c.created_at,
  lm.body AS latest_message_body,
  lm.direction AS latest_message_direction,
  lm.created_at AS latest_message_at,
  lc.status AS latest_call_status,
  lc.direction AS latest_call_direction,
  lc.answered AS latest_call_answered,
  lc.started_at AS latest_call_started_at,
  lc.created_at AS latest_call_at,
  EXISTS (
    SELECT 1
    FROM public.communication_messages m
    WHERE m.conversation_id = c.id
  ) AS has_message,
  EXISTS (
    SELECT 1
    FROM public.communication_calls k
    WHERE k.conversation_id = c.id
  ) AS has_call,
  EXISTS (
    SELECT 1
    FROM public.communication_calls k
    WHERE k.conversation_id = c.id
      AND k.direction = 'inbound'
      AND k.answered = false
      AND k.read_at IS NULL
      AND k.status IN ('busy', 'no-answer', 'failed', 'canceled')
  ) AS missed_unhandled
FROM public.communication_conversations c
LEFT JOIN LATERAL (
  SELECT m.body, m.direction, m.created_at
  FROM public.communication_messages m
  WHERE m.conversation_id = c.id
  ORDER BY m.created_at DESC
  LIMIT 1
) lm ON true
LEFT JOIN LATERAL (
  SELECT k.status, k.direction, k.answered, k.started_at, k.created_at
  FROM public.communication_calls k
  WHERE k.conversation_id = c.id
  ORDER BY k.created_at DESC
  LIMIT 1
) lc ON true;

REVOKE ALL ON TABLE public.communication_inbox_rows FROM PUBLIC;
REVOKE ALL ON TABLE public.communication_inbox_rows FROM anon;
REVOKE ALL ON TABLE public.communication_inbox_rows FROM authenticated;
GRANT SELECT ON TABLE public.communication_inbox_rows TO service_role;

COMMIT;
