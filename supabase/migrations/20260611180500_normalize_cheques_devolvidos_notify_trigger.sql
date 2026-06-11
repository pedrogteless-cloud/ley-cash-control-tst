-- Keep a single Telegram trigger for cheques_devolvidos.
-- Earlier migrations used two different trigger names for the same event.
DROP TRIGGER IF EXISTS trg_notify_cheques_devolvidos_insert ON public.cheques_devolvidos;
DROP TRIGGER IF EXISTS trg_notify_cheques_devolvidos ON public.cheques_devolvidos;

CREATE TRIGGER trg_notify_cheques_devolvidos
AFTER INSERT ON public.cheques_devolvidos
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram();
