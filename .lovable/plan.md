# Entrega 2 — UX mobile

Foco: tornar o painel confortável de usar no celular (operador lançando NF/caixa em pé no depósito) sem perder a densidade no desktop.

## O que muda na experiência

**Header mais leve no mobile**
- KPIs (Carteira / Saldo) viram um carrossel horizontal de cards (snap), em vez de empilhar e empurrar o conteúdo pra baixo.
- Header encolhe ao rolar (título menor, badge da data some), liberando tela.
- Botão "Gerenciar" some no mobile — substituído por um FAB (botão flutuante "+") no canto inferior direito.

**Listas viram cards no mobile (<640px)**
- Carteira de NFs: cada NF é um card com fornecedor + valor em destaque, chips de status (FATURADO/PAGO, CHEGOU/NÃO CHEGOU), e ações em swipe (deslizar p/ esquerda revela Editar/Excluir).
- Histórico de Caixa: idem, card por dia com saldo total em destaque e mini-linha entrada/saída.
- No desktop continua tabela.

**Lançamento em bottom sheet (drawer)**
- O FAB abre um drawer (vaul) deslizando de baixo, com abas "Nova NF" / "Novo movimento de caixa".
- Formulário em uma coluna, inputs grandes (44px+), teclado numérico nos campos de valor (`inputMode="decimal"`), máscara BR no valor enquanto digita.
- Botões fixos no rodapé do drawer: "Cancelar" / "Salvar". Salvar mostra estado de loading e fecha com toast.

**Filtros e ações rápidas**
- Acima da lista de NFs: chips de filtro rápido (Todas · Faturadas · Pagas · Não chegou · Chegou) + busca por fornecedor/NF.
- Pull-to-refresh em mobile (puxar pra baixo recarrega dados do Supabase).
- Tab bar inferior fixa no mobile: Carteira · Caixa · Gerenciar (substitui o tab atual que fica no topo).

**Validação e feedback**
- Campos com erro ficam com borda vermelha + mensagem inline (não só toast).
- Toasts mais discretos (sonner, posição top, fade rápido) — já está, só ajustar.
- Estado vazio de cada lista com ilustração leve e CTA "Adicionar primeira NF".

**Papéis (Diretoria)**
- Quem é só Diretoria não vê o FAB nem os botões de editar/excluir — vê só leitura, com toasts de "Sem permissão" se tentar.

## Onde mexer no código

- `src/components/painel/AppHeader.tsx` — header colapsável + carrossel de KPIs no mobile.
- `src/components/painel/CarteiraTab.tsx` e `CaixaTab.tsx` — renderização condicional tabela/card via `useIsMobile()`, chips de filtro, busca.
- `src/components/painel/NfCard.tsx`, `CaixaCard.tsx` — novos componentes de card mobile com swipe (framer-motion + drag).
- `src/components/painel/QuickAddDrawer.tsx` — novo bottom sheet com abas (usar `vaul` via shadcn drawer já instalado).
- `src/components/painel/MobileTabBar.tsx` — tab bar inferior fixa.
- `src/components/painel/RoleGate.tsx` — wrapper que esconde ações para Diretoria; hook `useUserRole()` lendo `user_roles` via react-query.
- `src/routes/_authenticated/index.tsx` — integrar tab bar + FAB + drawer; mover tabs do topo pra baixo no mobile.
- `src/routes/_authenticated/gerenciar.tsx` — manter como tela completa para edição em massa no desktop.
- `src/lib/format.ts` — adicionar máscara BR de entrada (`parseBrlInput`).
- `src/data/store.tsx` — expor `refetch()` para o pull-to-refresh.

## Dependências

- Já temos: `vaul` (via `@/components/ui/drawer`), `framer-motion`, `sonner`, `lucide-react`.
- Nada novo a instalar.

## Fora do escopo desta entrega

- Exportar Excel/PDF e alertas → Entrega 3.
- Tela de admin de usuários (atribuir papéis) → fica como gancho da Entrega 1, posso fazer como mini-extra se sobrar.
- Anexos, histórico de auditoria, PWA → Entrega 4.

## Estimativa
~25–30 créditos. Posso fatiar em 2 mensagens se preferir (1ª: header + cards + drawer; 2ª: filtros + tab bar + role gate).
