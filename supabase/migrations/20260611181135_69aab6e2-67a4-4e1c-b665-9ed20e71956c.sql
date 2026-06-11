DROP TRIGGER IF EXISTS trg_notify_cheques_devolvidos ON public.cheques_devolvidos;
CREATE TRIGGER trg_notify_cheques_devolvidos
AFTER INSERT ON public.cheques_devolvidos
FOR EACH ROW EXECUTE FUNCTION public.notify_telegram();