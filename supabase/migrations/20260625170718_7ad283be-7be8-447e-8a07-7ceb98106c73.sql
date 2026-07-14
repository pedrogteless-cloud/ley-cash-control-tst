
CREATE OR REPLACE FUNCTION public.update_devolvido(
  p_id uuid,
  p_data text,
  p_valor_devolvido numeric,
  p_valor_rec_fornecedor numeric,
  p_valor_rec_empresa numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_old record;
  v_rec_forn_delta numeric;
  v_rec_emp_delta numeric;
  v_total_recuperado numeric;
  v_total_devolvido numeric;
  v_pendente_acumulado numeric;
  v_total_recuperado_lancamento numeric;
  v_pendente_lancamento numeric;
  v_is_avulsa boolean;
  v_payload jsonb;
  v_secret text := nullif(current_setting('app.telegram_webhook_secret', true), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'diretoria'))
    THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_valor_devolvido IS NULL OR p_valor_rec_fornecedor IS NULL OR p_valor_rec_empresa IS NULL
    OR p_valor_devolvido < 0 OR p_valor_rec_fornecedor < 0 OR p_valor_rec_empresa < 0
    THEN RAISE EXCEPTION 'invalid_money_values'; END IF;

  v_is_avulsa := (p_valor_devolvido = 0 AND (p_valor_rec_fornecedor + p_valor_rec_empresa) > 0);

  -- Regra antiga só vale para cheques devolvidos normais (não avulsas)
  IF NOT v_is_avulsa
     AND p_valor_rec_fornecedor + p_valor_rec_empresa > p_valor_devolvido
    THEN RAISE EXCEPTION 'recovered_exceeds_devolvido'; END IF;

  SELECT * INTO v_old FROM public.cheques_devolvidos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'record_not_found'; END IF;

  v_rec_forn_delta := p_valor_rec_fornecedor - COALESCE(v_old.valor_rec_fornecedor, 0);
  v_rec_emp_delta  := p_valor_rec_empresa    - COALESCE(v_old.valor_rec_empresa,    0);
  v_total_recuperado_lancamento := p_valor_rec_fornecedor + p_valor_rec_empresa;
  v_pendente_lancamento := CASE WHEN v_is_avulsa THEN NULL
                                ELSE p_valor_devolvido - v_total_recuperado_lancamento END;

  UPDATE public.cheques_devolvidos
     SET data = p_data::date, valor_devolvido = p_valor_devolvido,
         valor_rec_fornecedor = p_valor_rec_fornecedor, valor_rec_empresa = p_valor_rec_empresa
   WHERE id = p_id;

  IF v_rec_forn_delta > 0 OR v_rec_emp_delta > 0 THEN
    SELECT COALESCE(SUM(valor_rec_fornecedor),0)+COALESCE(SUM(valor_rec_empresa),0),
           COALESCE(SUM(valor_devolvido),0)
      INTO v_total_recuperado, v_total_devolvido FROM public.cheques_devolvidos;
    v_pendente_acumulado := v_total_devolvido - v_total_recuperado;

    v_payload := jsonb_build_object(
      'type','devolvido_atualizado',
      'data',p_data,
      'recuperacao_avulsa', v_is_avulsa,
      'total_recuperado_delta', GREATEST(v_rec_forn_delta,0)+GREATEST(v_rec_emp_delta,0),
      'total_recuperado_lancamento', v_total_recuperado_lancamento,
      'pendente_lancamento', v_pendente_lancamento,
      'total_recuperado_acumulado', v_total_recuperado,
      'pendente_acumulado', v_pendente_acumulado
    );
    BEGIN
      PERFORM net.http_post(
        url := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/telegram-notify',
        body := v_payload::text,
        headers := jsonb_strip_nulls(jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer sb_publishable_ubJq9BGLBkHgUK3IfL2vvQ_PK8pxV8x',
          'x-telegram-secret', v_secret))
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN jsonb_build_object('updated', true, 'recuperacao_avulsa', v_is_avulsa);
END;
$function$;
