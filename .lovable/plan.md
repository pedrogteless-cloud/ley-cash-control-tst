# Padronização de rótulos: "Aguardando Carga"

Trocar todas as variações ("Aguardando", "Esp. entrega", "Cheque esp. entrega", "Não Chegou") por **"Aguardando Carga"** para manter coerência em toda a UI da Carteira.

## Arquivo: `src/components/painel/CarteiraTab.tsx`

1. **Linha 15** — array `FILTERS`:
   - De: `["Todas", "Enviar Cheque", "Não Chegou", "Esp. entrega"]`
   - Para: `["Todas", "Enviar Cheque", "Aguardando Carga"]`
   - (remove duplicidade "Não Chegou" + "Esp. entrega", que hoje filtram coisas parecidas)

2. **Linha 49** — ajuste do filtro:
   - Substituir o branch `"Esp. entrega"` por `"Aguardando Carga"` usando `isAguardando`.

3. **Linha 62** — `pieData`:
   - `name: "Esp. entrega"` → `name: "Aguardando Carga"`.

4. **Linha 87** — KpiCard:
   - `label="Aguardando"` → `label="Aguardando Carga"`.

5. **Linha 195** — célula da tabela:
   - `"Cheque esp. entrega"` → `"Aguardando Carga"`.

## Fora de escopo
- `isAguardando` em `src/data/painel.ts` permanece (é lógica, não label).
- Nenhuma mudança em DB, tipos ou outros componentes.
