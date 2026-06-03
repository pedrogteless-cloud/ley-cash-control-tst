# Plano de evolução — Cheque Flow (mês Pro, ~100 créditos)

Objetivo: tirar o app do `localStorage`, abrir acesso controlado para 4 pessoas (1 NF, 1 Caixa, 2 diretoria), turbinar a UX no celular e entregar exportação/alertas. Tudo em 4 entregas pequenas para você validar de uma em uma.

## Entrega 1 — Backend real (Lovable Cloud + login + papéis)

Por que primeiro: sem isso, nenhuma outra melhoria "viaja" entre dispositivos nem fica segura.

- Ativar Lovable Cloud (Postgres + Auth + Storage). Sem servidor separado.
- Tabelas no schema `public`:
  - `notas_fiscais` (fornecedor, nf, filial, valor, status_nf, entrega, criado_por, datas)
  - `caixa_movimentos` (data, saldo_anterior, entrada, saida, saldo_total, destino, criado_por)
  - `profiles` (display_name vinculado a `auth.users`)
  - `user_roles` com enum `app_role` = `admin | lancador_nf | lancador_caixa | diretoria` (tabela separada, função `has_role` security definer — padrão seguro).
- RLS:
  - Todos os autenticados leem tudo (é um painel interno compartilhado).
  - Só `admin` e `lancador_nf` escrevem em `notas_fiscais`.
  - Só `admin` e `lancador_caixa` escrevem em `caixa_movimentos`.
  - Só `admin` gerencia papéis.
- Login: email/senha + Google. Você cria as 4 contas e atribui papéis em uma tela `/admin/usuarios` (só admin vê).
- Migrar o `StoreProvider` atual de `localStorage` para Supabase (mantendo a API `useStore()` quase igual, com `react-query` para cache). As telas atuais continuam funcionando.
- Esconder/desabilitar botões de editar conforme papel (diretoria vê tudo, mas sem botões de ação).

## Entrega 2 — UX mobile de verdade (prioridade sua nº 1)

Não é só responsivo: é repensado para a mão.

- **Header colapsável** ao rolar (libera espaço para conteúdo).
- **KPIs em carrossel horizontal** no celular (em vez de quebrar 4 cards em 2x2 apertados).
- **Listas viram cards** em telas <640px (NFs e Caixa). Tabela só no desktop.
- **Bottom sheet (drawer)** para cadastro/edição em vez do form inline atual — abre de baixo, mais natural no celular.
- **FAB (botão flutuante "+")** no canto inferior direito para "Nova NF" / "Novo dia" dependendo da aba.
- **Swipe nos cards**: arrastar para esquerda revela "Editar" e "Excluir".
- **Pull-to-refresh** para sincronizar.
- **Filtro rápido em chips** no topo: "Enviar cheque", "Não chegou", "Por fornecedor".
- Validação visual instantânea no formulário (não esperar submit).
- Toasts (sonner) confirmando cada ação.

## Entrega 3 — Exportação e alertas (prioridade sua nº 2)

- **Exportar Excel** (xlsx) da carteira de NFs e do histórico de caixa, com filtros aplicados.
- **Exportar PDF** "Relatório do dia" — uma página A4 com KPIs, top fornecedores, movimento do caixa, pronto para mandar para diretoria no WhatsApp.
- **Alertas no painel**:
  - Cobertura abaixo de 100% (saldo < carteira) → banner vermelho.
  - NFs com status "ENVIAR CHEQUE" há mais de N dias → destaque laranja.
  - Variação do saldo do dia (positiva/negativa) com seta e %.
- **Resumo diário automático** no rodapé do header: "Hoje: +R$ X entrou, −R$ Y saiu, cobertura Z%".
- Atalhos de período (Hoje / 7 dias / 30 dias / mês) nos gráficos.

## Entrega 4 — Refinos que multiplicam valor

Se sobrar crédito (deve sobrar):

- **Anexos**: foto do cheque ou da NF no Storage, miniatura no card.
- **Busca global** (Cmd/Ctrl+K ou ícone de lupa) por fornecedor/NF.
- **Histórico/auditoria**: quem criou/editou/removeu e quando (coluna `updated_by` + tela simples).
- **Dashboard de diretoria** dedicado: visão consolidada read-only com gráficos maiores e ranking de fornecedores.
- **PWA**: ícone na tela inicial do celular + funcionamento offline básico (leitura do cache).

## Sobre "back no Claude"

Recomendo **não** separar. Razões objetivas:
1. O Lovable Cloud já entrega Postgres + Auth + Storage + Edge Functions integrados. Você não gasta créditos montando autenticação, CORS, deploy, variáveis de ambiente.
2. Backend separado significa manter dois projetos, dois deploys, e cuidar de chaves/segredos. Para 4 usuários internos, é overkill.
3. Os créditos do Pro rendem muito mais quando o agente trabalha em um só lugar — cada mudança no front que precisa de dado novo vira 1 alteração, não 2.
4. Se um dia precisar de lógica server específica (ex.: enviar email automático, integrar com banco), criamos uma Edge Function dentro do próprio Cloud — não precisa de outro projeto.

Se mesmo assim quiser separar depois, o app fica preparado: a camada de dados fica isolada em `src/data/store.tsx`, fácil de trocar.

## Estimativa de crédito (aproximada)

| Entrega | Tamanho |
|---|---|
| 1 — Cloud + auth + papéis + migração | médio (a maior) |
| 2 — UX mobile | médio |
| 3 — Export + alertas | pequeno-médio |
| 4 — Refinos | pequeno (por item, sob demanda) |

Cabe folgado em 100 créditos no mês, desde que a gente não refaça grandes pedaços. Por isso vou pedir sua validação ao fim de cada entrega antes de seguir.

## Detalhes técnicos (pode pular se preferir)

- Stack atual mantida: TanStack Start + Recharts + Tailwind + shadcn.
- Dados: `@tanstack/react-query` + `createServerFn` com `requireSupabaseAuth` para reads/writes que respeitam RLS.
- Papéis em tabela `user_roles` separada com função `has_role` security definer (evita recursão em RLS).
- Mobile: `vaul` (já compatível com shadcn) para bottom sheets, `framer-motion` para swipe.
- Export: `xlsx` (SheetJS) para Excel; `jspdf` + `jspdf-autotable` para PDF (tudo client-side, sem custo de servidor).
- PWA (entrega 4): `vite-plugin-pwa`.

## O que faço primeiro quando você aprovar

Começo pela **Entrega 1** (ativar Cloud, criar tabelas com RLS, login, papéis, e migrar o store). Sem isso, as outras entregas não fazem sentido. Em seguida você me diz se quer ir para a 2 (UX mobile) ou para a 3 (export/alertas).