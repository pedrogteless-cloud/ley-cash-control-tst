-- Resumo do dia em imagem (tabelinha PNG) enviado ao Telegram às 18:30 (America/Fortaleza).
--
-- Fluxo: send_daily_cheques_table() calcula os números do dia, monta o JSON da
-- tabela, codifica em base64url e chama a edge function telegram-notify via
-- pg_net (type 'resumo_tabela_png'). A telegram-notify faz o sendPhoto com o
-- token/chat que já estão nos segredos dela; o Telegram baixa o PNG da edge
-- function pública tabela-png.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Configuração (ativar/pausar) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telegram_resumo_diario_config (
  id             boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativo          boolean NOT NULL DEFAULT true,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
INSERT INTO public.telegram_resumo_diario_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ── Log de envios ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telegram_resumo_diario_envios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enviado_em  timestamptz NOT NULL DEFAULT now(),
  origem      text NOT NULL CHECK (origem IN ('cron', 'manual')),
  enviado_por uuid,
  request_id  bigint,
  image_url   text NOT NULL,
  dados       jsonb NOT NULL
);

ALTER TABLE public.telegram_resumo_diario_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_resumo_diario_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins leem config do resumo diario" ON public.telegram_resumo_diario_config;
CREATE POLICY "Admins leem config do resumo diario"
  ON public.telegram_resumo_diario_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins leem envios do resumo diario" ON public.telegram_resumo_diario_envios;
CREATE POLICY "Admins leem envios do resumo diario"
  ON public.telegram_resumo_diario_envios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── Formatação R$ 1.234,56 (independe do locale do banco) ──────────────────
CREATE OR REPLACE FUNCTION public.fmt_brl(v numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN round(v, 2) < 0 THEN '-' ELSE '' END
      || 'R$ '
      || translate(to_char(abs(round(v, 2)), 'FM999,999,999,990.00'), ',.', '.,');
$$;

-- ── Envio ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_daily_cheques_table()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user      uuid := auth.uid();
  v_origem    text;
  v_hoje      text := to_char(now() AT TIME ZONE 'America/Fortaleza', 'DD/MM');
  v_hora      text := to_char(now() AT TIME ZONE 'America/Fortaleza', 'HH24:MI');
  v_env_qtd   int;
  v_env_val   numeric;
  v_rec_qtd   int;
  v_rec_val   numeric;
  v_cart_qtd  int;
  v_cart_val  numeric;
  v_mov_qtd   int;
  v_seed      numeric;
  v_delta     numeric;
  v_saldo     numeric;
  v_na        jsonb := jsonb_build_object('v', 'não informado', 'c', 'muted', 'i', 1);
  v_na_qtd    jsonb := jsonb_build_object('v', '—', 'c', 'muted');
  v_spec      jsonb;
  v_url       text;
  v_caption   text;
  v_secret    text := nullif(current_setting('app.telegram_webhook_secret', true), '');
  v_request   bigint;
  v_envio_id  uuid;
BEGIN
  IF v_user IS NOT NULL THEN
    -- Chamado pelo app (botão "Enviar agora"): só admin; envia mesmo se pausado
    IF NOT public.has_role(v_user, 'admin') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    v_origem := 'manual';
  ELSE
    -- Chamado pelo pg_cron
    v_origem := 'cron';
    IF NOT COALESCE((SELECT ativo FROM public.telegram_resumo_diario_config WHERE id), true) THEN
      RETURN jsonb_build_object('enviado', false, 'motivo', 'pausado');
    END IF;
  END IF;

  -- Enviado / Recebido hoje: lançamentos de caixa com data = hoje (dd/mm).
  -- caixa_movimentos.data não tem ano; created_at recente evita pegar o mesmo dia de outro ano.
  SELECT count(*) FILTER (WHERE saida > 0),   COALESCE(sum(saida), 0),
         count(*) FILTER (WHERE entrada > 0), COALESCE(sum(entrada), 0)
    INTO v_env_qtd, v_env_val, v_rec_qtd, v_rec_val
    FROM public.caixa_movimentos
   WHERE data = v_hoje
     AND created_at >= now() - interval '180 days';

  -- Carteira: NFs ainda não enviadas (mesma regra de isEnviado no app)
  SELECT count(*), COALESCE(sum(valor), 0)
    INTO v_cart_qtd, v_cart_val
    FROM public.notas_fiscais
   WHERE status_envio IS DISTINCT FROM 'ENVIADO'
     AND cheque_enviado_em IS NULL;

  -- Saldo de caixa: saldo inicial do 1º lançamento + Σ(entrada − saída) (computeChain do app)
  SELECT saldo_anterior INTO v_seed
    FROM public.caixa_movimentos
   ORDER BY split_part(data, '/', 2)::int, split_part(data, '/', 1)::int, created_at
   LIMIT 1;
  SELECT count(*), COALESCE(sum(entrada - saida), 0) INTO v_mov_qtd, v_delta
    FROM public.caixa_movimentos;
  v_saldo := CASE WHEN v_mov_qtd > 0 THEN round(v_seed + v_delta, 2) END;

  v_spec := jsonb_build_object(
    't', 'Caixa de cheques — ' || v_hoje,
    's', 'posição às ' || v_hora,
    'h', jsonb_build_array('Item', 'Qtd.', 'Valor'),
    'a', 'lrr',
    'w', jsonb_build_array(1.75, 1, 1.35),
    'hl', jsonb_build_array(3),
    'f', 'Painel de Cheques · Grupo Ley',
    'r', jsonb_build_array(
      jsonb_build_array(
        'Enviado (hoje)',
        CASE WHEN v_env_qtd > 0
          THEN to_jsonb(v_env_qtd || CASE WHEN v_env_qtd = 1 THEN ' envio' ELSE ' envios' END)
          ELSE v_na_qtd END,
        CASE WHEN v_env_qtd > 0
          THEN jsonb_build_object('v', public.fmt_brl(v_env_val), 'c', 'red')
          ELSE v_na END
      ),
      jsonb_build_array(
        'Recebido (hoje)',
        CASE WHEN v_rec_qtd > 0
          THEN to_jsonb(v_rec_qtd || CASE WHEN v_rec_qtd = 1 THEN ' lançamento' ELSE ' lançamentos' END)
          ELSE v_na_qtd END,
        CASE WHEN v_rec_qtd > 0
          THEN jsonb_build_object('v', public.fmt_brl(v_rec_val), 'c', 'blue')
          ELSE v_na END
      ),
      jsonb_build_array(
        'Carteira (cheques em aberto)',
        to_jsonb(v_cart_qtd || CASE WHEN v_cart_qtd = 1 THEN ' NF' ELSE ' NFs' END),
        jsonb_build_object('v', public.fmt_brl(v_cart_val), 'c', 'gold')
      ),
      jsonb_build_array(
        'Saldo de caixa',
        '',
        CASE WHEN v_saldo IS NULL THEN v_na
          ELSE jsonb_build_object('v', public.fmt_brl(v_saldo), 'c', CASE WHEN v_saldo < 0 THEN 'red' ELSE 'green' END)
        END
      )
    )
  );

  -- base64url (sem padding e sem quebras de linha)
  v_url := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/tabela-png?d='
        || translate(encode(convert_to(v_spec::text, 'UTF8'), 'base64'), E'+/=\n', '-_');

  v_caption := 'Boa noite! Segue o resultado do caixa de cheques de hoje (' || v_hoje || ').'
            || E'\n' || 'Mensagem automática do Bot';

  SELECT net.http_post(
    url := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/telegram-notify',
    body := jsonb_build_object(
      'type', 'resumo_tabela_png',
      'photo_url', v_url,
      'caption', v_caption
    ),
    headers := jsonb_strip_nulls(jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_ubJq9BGLBkHgUK3IfL2vvQ_PK8pxV8x',
      'x-telegram-secret', v_secret
    )),
    -- o Telegram baixa o PNG antes de responder; a 1ª geração pode levar alguns segundos
    timeout_milliseconds := 30000
  ) INTO v_request;

  INSERT INTO public.telegram_resumo_diario_envios (origem, enviado_por, request_id, image_url, dados)
  VALUES (
    v_origem, v_user, v_request, v_url,
    jsonb_build_object(
      'dia', v_hoje, 'hora', v_hora,
      'enviado_qtd', v_env_qtd, 'enviado_valor', v_env_val,
      'recebido_qtd', v_rec_qtd, 'recebido_valor', v_rec_val,
      'carteira_qtd', v_cart_qtd, 'carteira_valor', v_cart_val,
      'saldo_caixa', v_saldo
    )
  )
  RETURNING id INTO v_envio_id;

  RETURN jsonb_build_object(
    'enviado', true,
    'envio_id', v_envio_id,
    'request_id', v_request,
    'image_url', v_url
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.send_daily_cheques_table() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_daily_cheques_table() TO authenticated;

-- ── Ativar / pausar ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_resumo_diario_ativo(p_ativo boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.telegram_resumo_diario_config
     SET ativo = p_ativo, atualizado_em = now(), atualizado_por = auth.uid()
   WHERE id;
  RETURN jsonb_build_object('ativo', p_ativo);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_resumo_diario_ativo(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_resumo_diario_ativo(boolean) TO authenticated;

-- ── Status: config + últimos envios com a resposta do Telegram (pg_net) ────
CREATE OR REPLACE FUNCTION public.resumo_diario_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'ativo', COALESCE((SELECT ativo FROM public.telegram_resumo_diario_config WHERE id), true),
    'agenda', 'todo dia às 18:30 (America/Fortaleza)',
    'envios', COALESCE((
      SELECT jsonb_agg(e ORDER BY e.enviado_em DESC)
        FROM (
          SELECT en.id, en.enviado_em, en.origem, en.image_url, en.dados,
                 r.status_code,
                 left(r.content, 500) AS resposta,
                 r.error_msg,
                 r.timed_out
            FROM public.telegram_resumo_diario_envios en
            LEFT JOIN net._http_response r ON r.id = en.request_id
           ORDER BY en.enviado_em DESC
           LIMIT 10
        ) e
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.resumo_diario_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_diario_status() TO authenticated;

-- ── Agendamento: 21:30 UTC = 18:30 em Fortaleza (UTC−3, sem horário de verão) ─
DO $$
BEGIN
  PERFORM cron.unschedule('telegram-resumo-tabela-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'telegram-resumo-tabela-diario',
  '30 21 * * *',
  $$ SELECT public.send_daily_cheques_table(); $$
);
