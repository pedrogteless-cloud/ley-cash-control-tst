CREATE TRIGGER trg_notify_nf_update
AFTER UPDATE ON public.notas_fiscais
FOR EACH ROW
WHEN (
  (UPPER(NEW.status_nf) = 'CHEGOU' AND UPPER(NEW.entrega) LIKE '%CHEGOU%')
  AND NOT (UPPER(OLD.status_nf) = 'CHEGOU' AND UPPER(OLD.entrega) LIKE '%CHEGOU%')
)
EXECUTE FUNCTION public.notify_telegram();