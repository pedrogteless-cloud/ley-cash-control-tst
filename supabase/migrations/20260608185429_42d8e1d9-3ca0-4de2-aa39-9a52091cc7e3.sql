
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS cheque_enviado_em TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.caixa_movimentos
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual';

CREATE OR REPLACE FUNCTION public.confirmar_envio_nf(p_nf_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nf RECORD;
  v_hoje text;
  v_existing RECORD;
  v_last_saldo numeric;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT (public.has_role(v_user,'admin') OR public.has_role(v_user,'lancador_nf')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.notas_fiscais
    SET cheque_enviado_em = now()
    WHERE id = p_nf_id AND cheque_enviado_em IS NULL
    RETURNING id, fornecedor, nf, valor INTO v_nf;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nf_already_sent_or_missing';
  END IF;

  v_hoje := to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM');

  SELECT * INTO v_existing
    FROM public.caixa_movimentos
    WHERE data = v_hoje
    ORDER BY created_at DESC
    LIMIT 1;

  IF FOUND THEN
    UPDATE public.caixa_movimentos
      SET saida = v_existing.saida + v_nf.valor,
          saldo_total = v_existing.saldo_anterior + v_existing.entrada - (v_existing.saida + v_nf.valor),
          destino = CASE
            WHEN v_existing.destino IS NULL OR v_existing.destino = '' THEN v_nf.fornecedor
            WHEN position(v_nf.fornecedor in v_existing.destino) > 0 THEN v_existing.destino
            ELSE v_existing.destino || ' + ' || v_nf.fornecedor
          END
      WHERE id = v_existing.id;
  ELSE
    SELECT saldo_total INTO v_last_saldo
      FROM public.caixa_movimentos
      ORDER BY created_at DESC LIMIT 1;
    v_last_saldo := COALESCE(v_last_saldo, 0);

    INSERT INTO public.caixa_movimentos(data, saldo_anterior, entrada, saida, saldo_total, destino, origem, criado_por)
    VALUES (v_hoje, v_last_saldo, 0, v_nf.valor, v_last_saldo - v_nf.valor, v_nf.fornecedor, 'auto_nf', v_user);
  END IF;

  RETURN jsonb_build_object('id', v_nf.id, 'fornecedor', v_nf.fornecedor, 'nf', v_nf.nf, 'valor', v_nf.valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_envio_nf(uuid) TO authenticated;
