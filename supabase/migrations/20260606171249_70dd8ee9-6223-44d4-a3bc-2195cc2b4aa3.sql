
-- Audit log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('UPDATE','DELETE')),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  data_before jsonb,
  data_after jsonb
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read audit"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX audit_log_changed_at_idx ON public.audit_log (changed_at DESC);
CREATE INDEX audit_log_table_record_idx ON public.audit_log (table_name, record_id);

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, changed_by, data_before, data_after)
    VALUES (TG_TABLE_NAME, OLD.id, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (table_name, record_id, action, changed_by, data_before, data_after)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER notas_fiscais_audit
AFTER UPDATE OR DELETE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER caixa_movimentos_audit
AFTER UPDATE OR DELETE ON public.caixa_movimentos
FOR EACH ROW EXECUTE FUNCTION public.log_audit();
