-- RPC to update a cheque_devolvido record.
-- Security: only admin and diretoria may call it.
-- Notification: calls the telegram-notify edge function via pg_net ONLY when
-- valor_rec_fornecedor or valor_rec_empresa actually increases.
-- The notification decision is enforced here (server-side), not on the client.

CREATE OR REPLACE FUNCTION public.update_devolvido(
  p_id                  uuid,
  p_data                text,
  p_valor_devolvido     numeric,
  p_valor_rec_fornecedor numeric,
  p_valor_rec_empresa   numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user               uuid := auth.uid();
  v_old                RECORD;
  v_rec_forn_delta     numeric;
  v_rec_emp_delta      numeric;
  v_total_recuperado   numeric;
  v_total_devolvido    numeric;
  v_pendente           numeric;
  v_payload            jsonb;
BEGIN
  -- Auth check
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT (
    public.has_role(v_user, 'admin')
    OR public.has_role(v_user, 'diretoria')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Capture values BEFORE the update
  SELECT * INTO v_old FROM public.cheques_devolvidos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_not_found';
  END IF;

  v_rec_forn_delta := p_valor_rec_fornecedor - COALESCE(v_old.valor_rec_fornecedor, 0);
  v_rec_emp_delta  := p_valor_rec_empresa    - COALESCE(v_old.valor_rec_empresa,    0);

  -- Perform the update
  UPDATE public.cheques_devolvidos
  SET
    data                 = p_data,
    valor_devolvido      = p_valor_devolvido,
    valor_rec_fornecedor = p_valor_rec_fornecedor,
    valor_rec_empresa    = p_valor_rec_empresa
  WHERE id = p_id;

  -- Only notify Telegram when recovered amounts increased
  IF v_rec_forn_delta > 0 OR v_rec_emp_delta > 0 THEN

    -- Totals after the update
    SELECT
      COALESCE(SUM(valor_rec_fornecedor), 0) + COALESCE(SUM(valor_rec_empresa), 0),
      COALESCE(SUM(valor_devolvido), 0)
    INTO v_total_recuperado, v_total_devolvido
    FROM public.cheques_devolvidos;

    v_pendente := v_total_devolvido - v_total_recuperado;

    v_payload := jsonb_build_object(
      'type',                      'devolvido_atualizado',
      'data',                      p_data,
      'rec_fornecedor',            CASE WHEN v_rec_forn_delta > 0 THEN p_valor_rec_fornecedor ELSE NULL END,
      'rec_empresa',               CASE WHEN v_rec_emp_delta  > 0 THEN p_valor_rec_empresa    ELSE NULL END,
      'total_recuperado_novo',     p_valor_rec_fornecedor + p_valor_rec_empresa,
      'total_recuperado_acumulado', v_total_recuperado,
      'pendente',                  v_pendente
    );

    -- Fire-and-forget: notification failure must not roll back the update
    BEGIN
      PERFORM net.http_post(
        url     := 'https://otcjduyietrmrcsisymx.supabase.co/functions/v1/telegram-notify',
        body    := v_payload::text,
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer sb_publishable_ubJq9BGLBkHgUK3IfL2vvQ_PK8pxV8x'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('updated', true);
END;
$function$;
