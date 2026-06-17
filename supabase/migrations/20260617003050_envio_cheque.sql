-- Adds status_envio to notas_fiscais (replaces cheque_enviado_em logic)
-- and nfs_resolvidas to caixa_movimentos for traceability.

ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS status_envio TEXT DEFAULT NULL;

ALTER TABLE public.caixa_movimentos
  ADD COLUMN IF NOT EXISTS nfs_resolvidas JSONB DEFAULT NULL;

-- Migrate existing data: NFs with cheque_enviado_em set → mark as ENVIADO
UPDATE public.notas_fiscais
  SET status_envio = 'ENVIADO'
  WHERE cheque_enviado_em IS NOT NULL
    AND status_envio IS NULL;
