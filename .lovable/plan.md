## O que eu já achei no banco

Conferi a tabela `caixa_movimentos` (39 lançamentos) e existem **inconsistências reais** no histórico que muito provavelmente são a causa do Saldo em Caixa parecer errado:

**1. Lançamento "fantasma" em 01/07** (criado 30/06 20:56)
- Linha com `entrada = 0`, `saída = 0`, `saldo_anterior = 1.006.157,96`, `saldo_total = 1.006.157,96`.
- A linha anterior (01/07 20:55, entrada 28.050) terminou em **1.015.593,36**.
- Ou seja, essa linha "zera" o encadeamento e introduz uma diferença de **−9.435,40**.

**2. Outras quebras no encadeamento** (saldo_anterior salvo ≠ saldo_total da linha anterior)
- 16/06 manual: salvo 1.876.590,29 vs anterior 1.876.593,86 (−3,57)
- 25/06 manual: salvo 1.515.976,68 vs anterior 1.508.132,68 (+7.844,00)
- 01/07 fantasma: salvo 1.006.157,96 vs anterior 1.015.593,36 (−9.435,40)

Esses saltos sugerem entradas que foram **editadas ou excluídas depois de criadas**, sem reescrever as colunas `saldo_anterior` / `saldo_total` das linhas seguintes.

**3. O front recalcula em memória, mas pode estar exibindo qualquer um dos dois valores**
- `computeChain()` em `src/data/store.tsx` parte do `saldoAnterior` da primeira linha (R$ 996.978,76) e soma todas as entradas/saídas → daria **R$ 1.015.593,36**.
- Soma pura `Σ entradas − Σ saídas` em todas as 39 linhas = +18.614,60 → mesmo resultado: **R$ 1.015.593,36**.
- O valor "fantasma" salvo no banco é **R$ 1.006.157,96**.

Antes de mexer em qualquer coisa, preciso saber **qual desses dois valores você está vendo no topo do painel** e qual é o saldo correto na sua conta hoje.

## Plano

### 1. Confirmar com você (1 pergunta)
- Qual valor aparece hoje no card "Saldo em Caixa"?
  - R$ 1.015.593,36 (cálculo encadeado)
  - R$ 1.006.157,96 (último `saldo_total` salvo)
  - Outro valor — qual?
- Qual é o saldo correto que você espera ver?

Dependendo da resposta a correção muda — por isso não vou alterar nada agora.

### 2. Limpar a linha "fantasma" de 01/07
Apagar a linha `01/07 · entrada 0 · saída 0 · saldo_total 1.006.157,96` (created_at `2026-06-30 20:56:23`). Ela não representa movimento nenhum e está bagunçando o encadeamento.

### 3. Reescrever `saldo_anterior` e `saldo_total` de todas as linhas
Rodar uma migration que percorre `caixa_movimentos` em ordem (data, created_at) e regrava `saldo_anterior` e `saldo_total` de cada linha a partir do `saldo_anterior` da primeira (996.978,76). Isso alinha o banco ao que o front já calcula e elimina os saltos de 16/06 e 25/06.

Se você disser que o saldo correto não é R$ 1.015.593,36, então o ajuste é diferente: provavelmente falta lançar uma entrada/saída específica, ou o `saldo_anterior` inicial precisa ser corrigido. Aí eu trato como caso 2.

### 4. Proteger o encadeamento daqui pra frente (opcional, recomendado)
Criar um trigger em `caixa_movimentos` que, a cada INSERT/UPDATE/DELETE, recalcule `saldo_anterior` e `saldo_total` das linhas afetadas em diante. Isso evita o mesmo problema voltar quando alguém editar/excluir um lançamento antigo.

### Detalhes técnicos
- Edição em massa via `supabase--migration` (UPDATE com window function `SUM(...) OVER (ORDER BY data, created_at)`).
- Deleção da linha fantasma via `supabase--insert` (DELETE pelo `id`).
- Trigger em PL/pgSQL `SECURITY DEFINER` com `search_path = public`, sem `auth.uid()` (roda em qualquer contexto).
- Nada muda em UI, RLS ou Edge Functions.
