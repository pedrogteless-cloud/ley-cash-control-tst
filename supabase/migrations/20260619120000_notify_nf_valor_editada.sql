-- Notify Telegram when an NF's value is edited (up or down).
-- Dedicated trigger function so we can ship OLD vs NEW value and let the
-- edge function render the direction/delta. Does not touch the existing
-- "NF chegou" notification flow.
CREATE OR REPLACE FUNCTION public.notify_telegram_nf_valor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  edge_url text := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/telegram-notify';
  payload jsonb;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_secret text := nullif(current_setting('app.telegram_webhook_secret', true), '');
BEGIN
  SELECT COALESCE(NULLIF(p.display_name, ''), p.email)
    INTO v_actor_name
    FROM public.profiles p
   WHERE p.id = v_actor;

  payload := jsonb_build_object(
    'type', 'nf_valor_editada',
    'table', TG_TABLE_NAME,
    'fornecedor', NEW.fornecedor,
    'nf', NEW.nf,
    'filial', NEW.filial,
    'valor_antigo', OLD.valor,
    'valor_novo', NEW.valor,
    'actor_name', v_actor_name
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_strip_nulls(jsonb_build_object(
      'Content-Type', 'application/json',
      'x-telegram-secret', v_secret
    )),
    body := payload
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_telegram_nf_valor() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_nf_valor_update ON public.notas_fiscais;

CREATE TRIGGER trg_notify_nf_valor_update
AFTER UPDATE ON public.notas_fiscais
FOR EACH ROW
WHEN (NEW.valor IS DISTINCT FROM OLD.valor)
EXECUTE FUNCTION public.notify_telegram_nf_valor();
