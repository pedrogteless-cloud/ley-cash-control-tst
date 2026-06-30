-- Função que reencadeia saldo_anterior / saldo_total de toda a tabela
CREATE OR REPLACE FUNCTION public.rechain_caixa_saldos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seed numeric;
BEGIN
  -- Evita recursão: o próprio UPDATE abaixo dispararia o trigger de novo
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  -- Saldo inicial = saldo_anterior do primeiro lançamento cronológico
  SELECT saldo_anterior INTO v_seed
    FROM public.caixa_movimentos
   ORDER BY split_part(data,'/',2)::int,
            split_part(data,'/',1)::int,
            created_at
   LIMIT 1;

  IF v_seed IS NULL THEN
    RETURN NULL;
  END IF;

  WITH ordered AS (
    SELECT id,
      v_seed + COALESCE(SUM(entrada - saida) OVER (
        ORDER BY split_part(data,'/',2)::int, split_part(data,'/',1)::int, created_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
      ), 0) AS new_anterior,
      v_seed + SUM(entrada - saida) OVER (
        ORDER BY split_part(data,'/',2)::int, split_part(data,'/',1)::int, created_at
      ) AS new_total
    FROM public.caixa_movimentos
  )
  UPDATE public.caixa_movimentos cm
     SET saldo_anterior = ROUND(o.new_anterior::numeric, 2),
         saldo_total    = ROUND(o.new_total::numeric, 2)
    FROM ordered o
   WHERE o.id = cm.id
     AND (ROUND(o.new_anterior::numeric,2) <> cm.saldo_anterior
       OR ROUND(o.new_total::numeric,2) <> cm.saldo_total);

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rechain_caixa_saldos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_rechain_caixa_saldos ON public.caixa_movimentos;

CREATE TRIGGER trg_rechain_caixa_saldos
AFTER INSERT OR UPDATE OF data, entrada, saida, saldo_anterior OR DELETE
ON public.caixa_movimentos
FOR EACH STATEMENT
EXECUTE FUNCTION public.rechain_caixa_saldos();