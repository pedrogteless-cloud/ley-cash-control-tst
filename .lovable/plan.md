# Corrigir total da Carteira de NFs no painel

## Problema
Ao confirmar o envio de uma NF, ela some da lista da aba "Carteira NFs", mas o valor continua somado em:
- KPI "Carteira de NFs" no header (`AppHeader.tsx`)
- KPI "Cobertura" e gráfico "Saldo vs Carteira" na aba Caixa (`CaixaTab.tsx`)

A causa é que esses dois lugares fazem `notas.reduce((s, n) => s + n.valor, 0)` sem filtrar as NFs já enviadas (`cheque_enviado_em != null`), enquanto o `CarteiraTab` já filtra com `!isEnviado(n)`.

## Mudanças

### `src/components/painel/AppHeader.tsx`
- Importar o helper `isEnviado` de `@/data/store`.
- Trocar `notas.reduce(...)` por `notas.filter(n => !isEnviado(n)).reduce(...)` para que o KPI do topo (e a % de cobertura ao lado) reflitam apenas o que ainda está em aberto.

### `src/components/painel/CaixaTab.tsx`
- Mesma alteração: usar `notas.filter(n => !isEnviado(n))` como base do `totalCarteira`, mantendo o cálculo de cobertura e o gráfico consistentes com a aba Carteira.

Nenhuma outra tela precisa mudar — `CarteiraTab` já está correto. Sem alterações de banco.
