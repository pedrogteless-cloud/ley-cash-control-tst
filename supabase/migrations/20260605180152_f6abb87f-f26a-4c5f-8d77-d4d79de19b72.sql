-- Enable pg_net for outbound HTTP from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Generic notifier function that POSTs the new row to the telegram-notify edge function
CREATE OR REPLACE FUNCTION public.notify_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  edge_url text := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/telegram-notify';
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW)
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Trigger: notas_fiscais AFTER INSERT
DROP TRIGGER IF EXISTS trg_notify_nf_insert ON public.notas_fiscais;
CREATE TRIGGER trg_notify_nf_insert
AFTER INSERT ON public.notas_fiscais
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram();

-- Trigger: caixa_movimentos AFTER INSERT
DROP TRIGGER IF EXISTS trg_notify_caixa_insert ON public.caixa_movimentos;
CREATE TRIGGER trg_notify_caixa_insert
AFTER INSERT ON public.caixa_movimentos
FOR EACH ROW
EXECUTE FUNCTION public.notify_telegram();