BEGIN;

-- Staff-only notes about a customer. Customers never see this table.
CREATE TABLE public.customer_admin_notes (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id)
);

CREATE TRIGGER customer_admin_notes_set_updated_at
  BEFORE UPDATE ON public.customer_admin_notes
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

REVOKE ALL ON TABLE public.customer_admin_notes FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_admin_notes FROM anon;
REVOKE ALL ON TABLE public.customer_admin_notes FROM authenticated;
GRANT SELECT ON TABLE public.customer_admin_notes TO authenticated;

ALTER TABLE public.customer_admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_admin_notes_staff_all
  ON public.customer_admin_notes
  FOR ALL
  TO authenticated
  USING (private.is_staff())
  WITH CHECK (private.is_staff());

COMMIT;
