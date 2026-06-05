## Correção 1 — Footer dinâmico em `src/routes/_authenticated/index.tsx`

Hoje o footer mostra `"Atualizado em 01 de junho de 2026"` hard-coded (linha ~62).

Mudança:
- Usar `useStore()` para pegar `notas` e `caixa`.
- Calcular a data mais recente entre `createdAt` de NFs e `createdAt`/`data` de caixa (fallback para hoje se não houver registros).
- Formatar com `Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" })`.
- Render: `Atualizado em {dataFormatada}`.

Sem mudar layout/classes.

## Correção 2 — Apagar a migration de seed

Arquivo: `supabase/migrations/20260603185255_b98f893b-b30f-4750-8bb0-01c34c4e87fa.sql`

Esse arquivo faz `TRUNCATE` em `notas_fiscais` e `caixa_movimentos` toda vez que roda, o que apaga dados reais já lançados. Como é seed de demo e já foi aplicado uma vez, o caminho seguro é **deletar a migration inteira** (`rm`). 

Importante: migrations já aplicadas não desfazem nada ao remover o arquivo — só evitam reexecução em ambientes novos. Os dados atuais permanecem intactos.

## Correção 3 — Variáveis de ambiente do Supabase

Verifiquei `src/integrations/supabase/{client,client.server,auth-middleware}.ts` e o `.env`. Os nomes estão corretos e consistentes:

- Browser (`client.ts`): `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (com fallback SSR para `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY`).
- Server (`client.server.ts`, `auth-middleware.ts`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `.env` define os 6 nomes esperados.

Não há `SUPABASE_ANON_KEY` legado nem referência quebrada. **Nada a corrigir aqui** — só confirmar no plano que está OK.

## Ordem de execução
1. Deletar `supabase/migrations/20260603185255_*.sql` (`rm`).
2. Editar `src/routes/_authenticated/index.tsx` (footer dinâmico).
3. Sem mudanças em env vars.