DROP TRIGGER IF EXISTS trg_notify_nf_update ON public.notas_fiscais;

CREATE TRIGGER trg_notify_nf_update
AFTER UPDATE ON public.notas_fiscais
FOR EACH ROW
WHEN (
  upper(NEW.status_nf) = 'CHEGOU'
  AND upper(OLD.status_nf) IS DISTINCT FROM 'CHEGOU'
)
EXECUTE FUNCTION public.notify_telegram();