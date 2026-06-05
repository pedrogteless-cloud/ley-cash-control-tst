## Divisão de papéis

**Lançar (`/lancamentos`)** — entrada rápida do dia
- Lista mostra **só lançamentos de hoje** (filtra por `createdAt`)
- FAB "+" continua como ação principal
- Editar/excluir inline nas linhas (pra corrigir erro recém-feito)
- Empty state quando não houver nada hoje

**Gerenciar (`/gerenciar`)** — base completa
- Tabela completa de NF e Caixa com busca (fornecedor/nº/descrição) e filtros (filial, status, período)
- Aba Time continua aqui (só admin)
- Botão "Novo" no topo vira secundário (outline), já que a criação principal mora em Lançar

## Mudanças concretas

1. **`/lancamentos`** — filtrar lista por início do dia, ajustar empty state.
2. **`/gerenciar`** — adicionar busca + filtros nas abas NFs e Caixa; reduzir destaque do botão "Novo".
3. **`AppHeader` (desktop)** — Lançar fica primário (dourado preenchido), Gerenciar fica secundário (outline).
4. **`MobileTabBar`** — sem mudança nos labels.

## Fora de escopo

- Painel (`/`) continua read-only
- Sem mudança de banco
- Aba Time fica só no Gerenciar
