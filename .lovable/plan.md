## Resumo
Adicionar baixa automática de cheque enviado (atualiza NF + caixa numa transação atômica), notificar grupo no Telegram, otimizar UI com React Query optimistic, e melhorar feedback dos botões.

---

## PARTE 1 — Baixa automática no caixa

### 1.1 Migration (via supabase--migration)

```sql
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
  -- Autorização: admin OU lancador_nf
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
      SET saida = saida + v_nf.valor,
          saldo_total = saldo_anterior + entrada - (saida + v_nf.valor),
          destino = CASE
            WHEN destino IS NULL OR destino = '' THEN v_nf.fornecedor
            WHEN position(v_nf.fornecedor in destino) > 0 THEN destino
            ELSE destino || ' + ' || v_nf.fornecedor
          END,
          origem = CASE WHEN origem = 'manual' THEN 'manual' ELSE 'auto_nf' END
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
```

### 1.2 `src/data/painel.ts`
- Adicionar `chequeEnviadoEm?: string` ao tipo `NF`.
- Helpers novos: `isAEnviar(n) = isEnviar(n) && !n.chequeEnviadoEm` e `isEnviado(n) = !!n.chequeEnviadoEm`.
- Manter `isEnviar` e `isAguardando` como estão.

### 1.3 `src/data/store.tsx`
- Adicionar `cheque_enviado_em` ao select de `notas_fiscais` e ao mapeamento `mapNf`.
- Adicionar `origem` no select de `caixa_movimentos` e em `mapCaixa` (campo opcional no `CaixaRecord`).

### 1.4 `CarteiraTab.tsx`
- KPIs/filtros "Enviar Cheque" passam a usar `isAEnviar`.
- Adicionar filtro "Enviados" mostrando NFs com `isEnviado`, exibindo a data formatada.
- Passar `onConfirmEnviar` ao `NfCard` (abre modal confirm → chama `confirmarEnvio`).

### 1.5 `NfCard.tsx`
- Botão "Confirmar envio" visível se `canWrite && isAEnviar(n)`.
- Mostrar badge "Enviado em DD/MM" quando `isEnviado(n)`.

### 1.6 `QuickAddDrawer.tsx` — formulário simplificado de caixa
- Detectar role: se o usuário **não é admin** (apenas `lancador_caixa`), renderizar `CaixaFormSimples` com **apenas Data, Saldo anterior (pré-preenchido), Entrada**. Saldo total = saldo_anterior + entrada (as saídas automáticas do dia entram via RPC).
- Admin (em `/gerenciar`) continua com o `CaixaForm` completo (Saída + Destino).
- Usar `useRoles()` para discriminar.

---

## PARTE 2 — Telegram

### 2.1 `supabase/functions/telegram-notify/index.ts`
Adicionar branch para `payload.type === 'cheque_enviado'`:
- Body esperado: `{ type, notas: [{fornecedor, nf, valor}], data: "DD/MM/AAAA" }`.
- Agrupar NFs com mesmo fornecedor (somar valor, juntar nºs NF).
- Título: 1 NF → `🟢 Cheque enviado — Grupo Ley`; 2+ → `🟢 Cheques enviados — Grupo Ley`.
- Linhas: Fornecedor / NF / Valor / Data.

### 2.2 Disparo no cliente
- Após sucesso de `confirmarEnvio`, chamar `supabase.functions.invoke("telegram-notify", { body: { type: "cheque_enviado", notas: [...], data: "DD/MM/AAAA" } })`.
- Falha do invoke é silenciosa (apenas console.error) — não bloqueia UX.

---

## PARTE 3 — Optimistic UI em `src/data/store.tsx`

Reescrever todas as mutations (`addNota`, `updateNota`, `removeNota`, `addCaixa`, `updateCaixa`, `removeCaixa`) usando o padrão:

```ts
onMutate: async (vars) => {
  await qc.cancelQueries({ queryKey: QK.notas });
  const prev = qc.getQueryData<NFRecord[]>(QK.notas);
  qc.setQueryData<NFRecord[]>(QK.notas, (old) => applyChange(old, vars));
  return { prev };
},
onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(QK.notas, ctx.prev),
onSettled: () => qc.invalidateQueries({ queryKey: QK.notas }),
```

Nova mutation **`confirmarEnvio(nfId)`**:
- `mutationFn`: `supabase.rpc("confirmar_envio_nf", { p_nf_id: nfId })` → retorna `{fornecedor, nf, valor}`.
- `onMutate`: cancela queries de notas+caixa; snapshot dos dois; marca NF como `chequeEnviadoEm = new Date().toISOString()` no cache; atualiza/insere linha de caixa do dia (DD/MM) somando `saida += nf.valor` e recalculando `saldo_total`.
- `onError`: restaura snapshots.
- `onSuccess`: dispara invoke do Telegram com a NF retornada.
- `onSettled`: invalida `notas_fiscais` e `caixa_movimentos`.

Expor `confirmarEnvio(id)` e `confirmarEnvioPending(id)` (ou expor a mutation inteira) pelo `useStore()`.

---

## PARTE 4 — Feedback e responsividade dos botões

Aplicar a todos os botões de ação em `NfCard.tsx`, `CarteiraTab.tsx`, `CaixaTab.tsx`, `CaixaCard.tsx`, `gerenciar.tsx`, `lancamentos.tsx`, `QuickAddDrawer.tsx`:
- Classes base: `transition-transform transition-colors duration-150 active:scale-95`.
- Mobile: `min-h-11 min-w-11` (área de toque 44×44) em ícones de Editar/Excluir.
- `disabled={isPending}` + spinner (ícone `Loader2 animate-spin`) durante mutation pendente.
- "Confirmar envio" mostra "Enviando..." enquanto a mutation roda.
- FAB de `lancamentos.tsx` recebe `active:scale-95` também.
- Como o cache é otimista (Parte 3), o spinner é breve e não trava a tela.

---

## Arquivos afetados
- **Nova migration** (Parte 1.1)
- `src/data/painel.ts`
- `src/data/store.tsx`
- `src/components/painel/CarteiraTab.tsx`
- `src/components/painel/NfCard.tsx`
- `src/components/painel/CaixaCard.tsx` (botões com active:scale + área 44px)
- `src/components/painel/CaixaTab.tsx` (feedback botões)
- `src/components/painel/QuickAddDrawer.tsx` (form simples + feedback)
- `src/routes/_authenticated/lancamentos.tsx` (FAB + linhas)
- `src/routes/_authenticated/gerenciar.tsx` (feedback botões)
- `supabase/functions/telegram-notify/index.ts`

## Fora de escopo
- Reverter envio (desfazer a baixa automática) — não pedido.
- Histórico de quem confirmou (auditoria já existe via `audit_log`).
