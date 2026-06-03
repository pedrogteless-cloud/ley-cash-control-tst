## Objetivo
Deixar o app pronto pra você mostrar pro time **hoje**, com dados que parecem reais e logins por papel funcionando.

## Estratégia (3 passos)

### 1. Seed de dados realistas (eu faço via migration)
Insiro direto no banco ~25 NFs e ~10 dias de caixa com fornecedores plausíveis do varejo/distribuição (BR), valores variados, status misturados (FATURADO/CHEGOU, ENVIAR/NÃO CHEGOU) pra demo ter:
- Alertas laranja ("X NFs com cheque a enviar")
- Carteira distribuída entre fornecedores (gráficos populam)
- Saldo de caixa com cobertura ~70-90% (KPI verde faz sentido)
- Histórico de caixa pra ver evolução

Você pode editar/remover tudo depois pelo próprio painel.

### 2. Publicar o app
Clico em Publish → gera URL `cheque-flow.lovable.app` (ou similar). A partir daí o time acessa de qualquer lugar (celular, desktop).

### 3. Criar usuários do time
Pra cada pessoa, eu te passo o passo-a-passo (3 cliques):
- **Você (admin)**: cria sua conta no `/auth`, eu te dou role admin via migration
- **Lançador NF**: pessoa cria conta, você atribui role pelo `/gerenciar` (vou adicionar uma aba "Usuários" rápida pra você gerenciar roles sem SQL)
- **Lançador Caixa**: idem
- **Diretoria**: idem (só leitura, sem FAB nem botões editar)

## O que vou construir

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/*_seed_demo.sql` | INSERT de 25 NFs + 10 dias de caixa + sua conta admin (você me passa o email) |
| `src/routes/_authenticated/gerenciar.tsx` | Nova aba "Time": lista usuários do `profiles`, dropdown pra atribuir/remover roles (admin/lancador_nf/lancador_caixa/diretoria) |
| `src/lib/api/roles.functions.ts` | Server functions `assignRole` / `removeRole` (só admin pode chamar, via `requireSupabaseAuth` + check `has_role`) |

## Out of scope (deixar pra depois)
- Exportar Excel/PDF (Entrega 3)
- Alertas por email (Entrega 3)
- Reset de senha por email (já funciona nativo pelo Supabase)

## O que eu preciso de você
**1 informação só:** seu email (o que você vai usar pra logar como admin). Pode me responder agora ou quando aprovar o plano.

## Tempo estimado
~10 min implementando + 5 min você publicar e criar contas do time. **Pronto pra demo em 15 min.**