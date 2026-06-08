## Objetivo

Adicionar, na aba **Time** (visível só para admins) em `/gerenciar`, um formulário para **criar novos usuários** definindo email + senha + papéis iniciais. Hoje a aba já lista o time e permite ligar/desligar papéis, mas não cria contas — usuários só entram via signup público.

## Escopo

### 1. Server function: `createTeamMember`
Arquivo: `src/lib/api/roles.functions.ts` (mesmo arquivo de `listTeam`/`setRole`).

- `createServerFn({ method: "POST" })` com `requireSupabaseAuth`.
- Valida com zod:
  - `email`: string email, max 255
  - `password`: string min 8, max 72
  - `displayName`: string min 1, max 80 (opcional, default = parte antes do `@`)
  - `roles`: array de `app_role` (`admin` | `lancador_nf` | `lancador_caixa` | `diretoria`), min 1, max 4
- Verifica via `supabase.rpc("has_role", { _user_id: userId, _role: "admin" })` — só admin pode criar.
- Importa `supabaseAdmin` dentro do `.handler()` (`await import("@/integrations/supabase/client.server")`) — service role.
- Chama `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name } })`.
- O trigger `handle_new_user` já cria `profiles` e dá papel padrão (`diretoria` ou `admin` se for o 1º). Depois do create:
  - Apaga papéis automáticos não pedidos: `delete from user_roles where user_id = novo and role not in (roles solicitados)`.
  - Insere os papéis pedidos com `upsert`/insert ignorando duplicata (mesma lógica de `setRole`).
- Retorna `{ id, email }`.

### 2. UI no `TeamManager` (aba "Time")
Arquivo: `src/routes/_authenticated/gerenciar.tsx`.

Acima da lista atual do time, adicionar um card **"Novo usuário"** colapsável (botão "Adicionar usuário" abre/fecha), só renderiza se `isAdmin`:

Campos:
- Email (input email, obrigatório)
- Nome para exibição (opcional)
- Senha (input password, min 8) — com botão "Gerar" que cria senha aleatória de 12 chars e mostra em claro para o admin copiar
- Papéis: checkboxes para `admin`, `lancador_nf`, `lancador_caixa`, `diretoria` (default: `diretoria` marcado)
- Botões "Cancelar" / "Criar usuário"

Comportamento:
- `useMutation` chamando `createTeamMember` via `useServerFn`.
- Em sucesso: `toast.success("Usuário criado")`, mostra um aviso destacado com email + senha para o admin anotar/enviar, invalida `["team"]` (usado por `listTeam`), limpa o form.
- Em erro: `toast.error(err.message)` (ex.: email já existe).

Estilo: reusa classes existentes (`rounded-xl border border-gold/40 bg-card p-4`, `inputCls`, botões dourados).

### 3. Sem mudanças em DB
O trigger `handle_new_user` e tabelas `profiles` / `user_roles` já existem e funcionam. Sem migration.

## Fora de escopo
- Reset de senha de outro usuário (pode ser próximo passo).
- Exclusão de usuário (`auth.admin.deleteUser`) — já existe a remoção de papéis via `setRole`, mas remover a conta inteira fica para depois se você quiser.
- Convite por email (link mágico) — você pediu senha definida por você, então não usamos invite.

## Detalhes técnicos
- `supabaseAdmin.auth.admin.createUser` bypassa RLS e confirma email automaticamente (`email_confirm: true`), então o usuário já pode logar com a senha que você definiu.
- Senha trafega só do seu browser → server fn (HTTPS) → Supabase Admin API. Não é logada em lugar nenhum.
- Como o trigger insere um papel default, a server fn faz limpeza pós-create para que o resultado bata exatamente com o que você marcou.