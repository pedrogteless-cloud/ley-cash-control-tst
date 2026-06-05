SELECT net.http_post(
  url := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/telegram-notify',
  headers := jsonb_build_object('Content-Type','application/json'),
  body := jsonb_build_object('type','TEST','table','notas_fiscais','record',jsonb_build_object('nf','TEST-999','fornecedor','TESTE TRIGGER','status_nf','CHEGOU','entrega','CHEGOU','valor',1,'filial','MATRIZ'))
);