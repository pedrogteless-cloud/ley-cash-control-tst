-- Registers one cheque outflow that resolves one or more NFs.
-- The NF status update and caixa movement are committed atomically.

CREATE OR REPLACE FUNCTION public.enviar_cheque_nfs(
  p_nf_ids uuid[],
  p_fornecedor text,
  p_valor_enviado numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nf_ids uuid[];
  v_count int;
  v_sent_count int;
  v_not_ready_count int;
  v_valor_titulos numeric;
  v_saldo_anterior numeric;
  v_saldo_total numeric;
  v_destino text;
  v_hoje text;
  v_movimento_id uuid;
  v_nfs jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF NOT (
    public.has_role(v_user, 'admin')
    OR public.has_role(v_user, 'lancador_nf')
    OR public.has_role(v_user, 'lancador_caixa')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_valor_enviado IS NULL OR p_valor_enviado <= 0 THEN
    RAISE EXCEPTION 'valor_enviado_invalido';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p_nf_ids, ARRAY[]::uuid[])) AS x
    WHERE x IS NOT NULL
  ) INTO v_nf_ids;

  IF COALESCE(array_length(v_nf_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'nenhuma_nf_selecionada';
  END IF;

  PERFORM 1
    FROM public.notas_fiscais
   WHERE id = ANY(v_nf_ids)
   FOR UPDATE;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status_envio = 'ENVIADO' OR cheque_enviado_em IS NOT NULL),
    COUNT(*) FILTER (
      WHERE NOT (
        UPPER(entrega) LIKE '%CHEGOU%'
        AND UPPER(entrega) NOT LIKE '%NÃO%'
        AND UPPER(entrega) NOT LIKE '%NAO%'
      )
    ),
    COALESCE(SUM(valor), 0),
    COALESCE(NULLIF(BTRIM(p_fornecedor), ''), string_agg(DISTINCT fornecedor, ' + ' ORDER BY fornecedor)),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'fornecedor', fornecedor,
          'nf', nf,
          'valor', valor
        )
        ORDER BY fornecedor, nf
      ),
      '[]'::jsonb
    )
    INTO v_count, v_sent_count, v_not_ready_count, v_valor_titulos, v_destino, v_nfs
    FROM public.notas_fiscais
   WHERE id = ANY(v_nf_ids);

  IF v_count <> array_length(v_nf_ids, 1) THEN
    RAISE EXCEPTION 'nf_nao_encontrada';
  END IF;

  IF v_sent_count > 0 THEN
    RAISE EXCEPTION 'nf_ja_enviada';
  END IF;

  IF v_not_ready_count > 0 THEN
    RAISE EXCEPTION 'nf_ainda_sem_carga';
  END IF;

  LOCK TABLE public.caixa_movimentos IN SHARE ROW EXCLUSIVE MODE;

  SELECT
    COALESCE(
      (
        SELECT saldo_anterior
          FROM public.caixa_movimentos
         ORDER BY split_part(data, '/', 2)::int ASC,
                  split_part(data, '/', 1)::int ASC,
                  created_at ASC
         LIMIT 1
      ),
      0
    )
    + COALESCE(SUM(entrada), 0)
    - COALESCE(SUM(saida), 0)
    INTO v_saldo_anterior
    FROM public.caixa_movimentos;

  v_saldo_anterior := COALESCE(v_saldo_anterior, 0);
  v_saldo_total := ROUND((v_saldo_anterior - p_valor_enviado)::numeric, 2);
  v_hoje := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM');

  UPDATE public.notas_fiscais
     SET status_envio = 'ENVIADO',
         cheque_enviado_em = COALESCE(cheque_enviado_em, now())
   WHERE id = ANY(v_nf_ids);

  INSERT INTO public.caixa_movimentos
    (data, saldo_anterior, entrada, saida, saldo_total, destino, origem, nfs_resolvidas, criado_por)
  VALUES
    (v_hoje, v_saldo_anterior, 0, p_valor_enviado, v_saldo_total, v_destino, 'auto_nf',
     to_jsonb(v_nf_ids), v_user)
  RETURNING id INTO v_movimento_id;

  RETURN jsonb_build_object(
    'movimento_id', v_movimento_id,
    'fornecedor', v_destino,
    'qtd_nfs', array_length(v_nf_ids, 1),
    'nfs', v_nfs,
    'valor_titulos', v_valor_titulos,
    'valor_enviado', p_valor_enviado,
    'saldo_anterior', v_saldo_anterior,
    'saldo_total', v_saldo_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enviar_cheque_nfs(uuid[], text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirmar_envio_nf(p_nf_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nf RECORD;
BEGIN
  SELECT fornecedor, valor INTO v_nf
    FROM public.notas_fiscais
   WHERE id = p_nf_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nf_nao_encontrada';
  END IF;

  RETURN public.enviar_cheque_nfs(ARRAY[p_nf_id], v_nf.fornecedor, v_nf.valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirmar_envio_nf(uuid) TO authenticated;
