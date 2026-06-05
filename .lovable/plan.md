## Diagnóstico

Hoje o `/` mistura dois papéis: análise (KPIs, gráficos) e operação (FAB "+", botões editar/excluir nos cards). Você quer que o **Painel seja só leitura/explicativo** e que o **trabalho do dia-a-dia dos lançadores** ganhe uma área própria, mais rápida e mobile-first.

## Plano em 4 entregas

### Entrega 1 — Separar Painel de Lançamentos (núcleo do pedido)

**Painel (`/`) vira somente análise:**
- Remove FAB "+", remove botões editar/excluir dos cards
- Adiciona "modo explicativo": tooltips nos KPIs ("o que é cobertura?", "como ler este gráfico"), legendas curtas em cada bloco, e um banner-resumo no topo ("Hoje você tem X NFs a vencer, cobertura Y%, atenção em Z fornecedores")
- Diretoria/admin/lançadores: todos veem igual aqui
- Mantém tudo que já existe de visual, só tira ação

**Nova área `/lancamentos`** (visível só pra quem tem role de lançador ou admin):
- Lista enxuta focada em velocidade: busca, filtros (status, fornecedor, período), edição/exclusão, FAB "+"
- Duas abas internas: "Notas Fiscais" e "Caixa"
- Atalhos de teclado básicos (novo lançamento, salvar) no desktop
- Card otimizado pra toque no mobile (swipe pra editar/excluir, confirmação inline)

**MobileTabBar** ganha 3 ícones: Painel · Lançamentos · Gerenciar (admin)

### Entrega 2 — UX dos lançadores (a dor real)

- **Lançamento mais rápido**: drawer já abre com data de hoje, último fornecedor usado em sugestão, máscara de valor BR sem precisar digitar vírgula
- **Confirmação visual forte**: toast com botão "Desfazer" por 5s em vez de só "salvo"
- **Validação inline** no drawer (NF duplicada, valor zerado, data futura) antes de salvar
- **Histórico do dia** no topo da tela de lançamentos: "Hoje você lançou X NFs / Y movimentos" — sensação de progresso

### Entrega 3 — Segurança e robustez

- Fix dos 2 findings pendentes (RLS de `profiles` e `user_roles`) — 1 migration, zero impacto no código
- **Log de auditoria**: tabela `audit_log` que grava quem criou/editou/removeu cada NF e movimento de caixa (admin vê em `/gerenciar`)
- **Soft delete** opcional: em vez de DELETE direto, marca `removido_em` — permite "lixeira" e recuperação
- Validação server-side com Zod nos `createServerFn` (hoje só validamos no client)

### Entrega 4 — Performance e qualidade

- Paginação/virtualização na lista de NFs (hoje carrega tudo de uma vez — vai pesar com 500+ notas)
- Cache mais agressivo no React Query (staleTime maior pra dados que mudam pouco)
- Skeleton loaders em vez de tela em branco durante carregamento
- Pequenas correções de acessibilidade (contraste, foco visível, labels em botões-ícone)

## Out of scope (deixa pra depois se quiser)

- Exportar Excel/PDF
- Alertas por email/WhatsApp
- Dashboard exclusivo da diretoria com gráficos diferentes
- PWA / instalação no celular

## Próximo passo

Me diz quais entregas você quer e em que ordem. Sugestão: **começar pela Entrega 1** (resolve o pedido direto), depois Entrega 2 (impacto imediato pro time), e Segurança quando estiver confortável (precisa de 1 migration que eu já te mostrei antes).
