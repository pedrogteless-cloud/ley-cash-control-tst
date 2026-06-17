CREATE OR REPLACE FUNCTION public.separar_nf(p_nf_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nf   RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (
    public.has_role(v_user, 'admin')
    OR public.has_role(v_user, 'lancador_nf')
    OR public.has_role(v_user, 'lancador_caixa')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.notas_fiscais
     SET cheque_separado_em = now(),
         separado_por       = v_user
   WHERE id                 = p_nf_id
     AND cheque_enviado_em  IS NULL
     AND cheque_separado_em IS NULL
  RETURNING id, fornecedor, nf, valor INTO v_nf;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nf_not_found_or_already_processed';
  END IF;

  RETURN jsonb_build_object('id', v_nf.id, 'fornecedor', v_nf.fornecedor, 'nf', v_nf.nf, 'valor', v_nf.valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.separar_nf(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_separacao_nf(p_nf_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_nf   RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT (
    public.has_role(v_user, 'admin')
    OR public.has_role(v_user, 'lancador_nf')
    OR public.has_role(v_user, 'lancador_caixa')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.notas_fiscais
     SET cheque_separado_em = NULL,
         separado_por       = NULL
   WHERE id                 = p_nf_id
     AND cheque_enviado_em  IS NULL
     AND cheque_separado_em IS NOT NULL
  RETURNING id, fornecedor, nf, valor INTO v_nf;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'nf_not_found_or_not_separated';
  END IF;

  RETURN jsonb_build_object('id', v_nf.id, 'fornecedor', v_nf.fornecedor, 'nf', v_nf.nf, 'valor', v_nf.valor);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_separacao_nf(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';