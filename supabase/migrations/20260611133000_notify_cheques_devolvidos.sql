-- Notify Telegram when a devolved-check movement is inserted.
DROP TRIGGER IF EXISTS trg_notify_cheques_devolvidos_insert ON public.cheques_devolvidos;

CREATE TRIGGER trg_notify_cheques_devolvidos_insert
AFTER INSERT ON public.cheques_devolvidos
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram();
