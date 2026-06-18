CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove job antigo se existir
DO $$
BEGIN
  PERFORM cron.unschedule('telegram-status-automatico');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'telegram-status-automatico',
  '0 22 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/telegram-notify',
    headers := jsonb_strip_nulls(jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_ubJq9BGLBkHgUK3IfL2vvQ_PK8pxV8x',
      'x-telegram-secret', nullif(current_setting('app.telegram_webhook_secret', true), '')
    )),
    body := jsonb_build_object('type','resumo_automatico','usuario','Envio automático')
  ) AS request_id;
  $$
);