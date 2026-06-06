## Objetivo

Toda NF cadastrada já é, por definição, FATURADO. Então:

1. **Remover o KPI "Apenas Faturado"** do painel (sempre zerado).
2. **Remover o seletor "Status NF"** dos formulários — fica fixo como `FATURADO` no banco.
3. **Manter o campo "Entrega"** (CHEGOU / NÃO CHEGOU) — é ele que decide se o cheque vai ou não.
4. **Simplificar a lógica**: cheque "ENVIAR" passa a ser simplesmente `entrega === CHEGOU`.

## Mudanças

### `src/data/painel.ts`
- `isEnviar` passa a olhar só `entrega`: `entrega.toUpperCase().includes("CHEGOU")`.
- `isAguardando` passa a olhar só `entrega`: `entrega.toUpperCase().includes("NÃO")`.

### `src/components/painel/CarteiraTab.tsx`
- Tirar o `KpiCard` "Apenas Faturado".
- Tirar `apenasFat` do `totals`.
- Grid de KPIs vira `grid-cols-3` (mantém: Cheque a Enviar, Aguardando, Total Carteira).
- `pieData` "Esp. entrega" passa a usar só `totals.aguardando.val`.
- Tabela desktop: remover a coluna "Status NF" (mantém Entrega).

### `src/components/painel/NfCard.tsx`
- Remover o badge de `statusNf` (mostra só Entrega + ENVIAR).

### `src/components/painel/QuickAddDrawer.tsx` (NfForm)
- Remover o `<select>` "Status NF" e o estado `statusNf`.
- Continuar enviando `statusNf: "FATURADO"` fixo no payload (compatibilidade com o schema atual).
- O grid de 2 colunas vira só o campo "Entrega" em coluna inteira.

### `src/routes/_authenticated/gerenciar.tsx` (NotasManager / NotaForm)
- Remover a coluna "Status" da tabela de NFs.
- Remover o seletor "Status da NF" do formulário.
- Salvar `statusNf: "FATURADO"` fixo no payload.

## Banco de dados

Não muda. A coluna `status_nf` continua existindo com default `'FATURADO'` — apenas deixa de ser editável pela UI. Isso evita migration e mantém o histórico de auditoria intacto.

## Notificação Telegram

A função `telegram-notify` hoje diferencia "Nova NF faturada, carga a caminho" (INSERT FATURADO) vs "NF chegou! Cheques a enviar" (UPDATE para CHEGOU). Como toda inserção continuará vindo como FATURADO e a transição "chegou" agora será detectada por mudança no campo `entrega`, **proponho ajustar o gatilho**:

- INSERT: continua mandando "Nova NF faturada, carga a caminho!" (já é assim).
- UPDATE: dispara "NF chegou! Cheques a enviar..." quando `entrega` muda para CHEGOU (em vez de `status_nf`).

Se preferir deixar a notificação como está agora (olhando `status_nf`), me avise antes de eu mexer — fora isso, sigo com essa adaptação.
