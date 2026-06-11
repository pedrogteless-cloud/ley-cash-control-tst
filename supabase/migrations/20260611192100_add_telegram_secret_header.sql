-- Add an optional shared-secret header to trigger-originated Telegram calls.
-- Configure the matching value in the edge function env as TELEGRAM_WEBHOOK_SECRET
-- and in Postgres as app.telegram_webhook_secret when available.
CREATE OR REPLACE FUNCTION public.notify_telegram()
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
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
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
