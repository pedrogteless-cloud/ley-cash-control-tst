-- Audit edits and deletes for cheques_devolvidos now that the table is editable.
DROP TRIGGER IF EXISTS cheques_devolvidos_audit ON public.cheques_devolvidos;

CREATE TRIGGER cheques_devolvidos_audit
AFTER UPDATE OR DELETE ON public.cheques_devolvidos
FOR EACH ROW
EXECUTE FUNCTION public.log_audit();
