## Objetivo
Fechar o cadastro público no app. Só o admin pode criar novos usuários a partir de agora.

## Mudanças

### 1. Desabilitar signup no Lovable Cloud
Via `configure_auth` com `disable_signup: true`. Efeito: a chamada `supabase.auth.signUp(...)` na tela `/auth` vai falhar com erro "Signups not allowed". Ninguém de fora consegue mais criar conta, mesmo com o site público.

### 2. Esconder UI de signup em `src/routes/auth.tsx`
- Remover o toggle "Não tem conta? Criar uma"
- Remover o estado `mode` e o branch de `signUp`
- Manter só o formulário de login (email/senha + Google)

### 3. Como criar novos usuários daqui pra frente
Duas opções (você escolhe depois, não faz parte deste passo):
- **Manual**: você (admin) cria pelo painel do Cloud → Users → Add user, e o trigger `handle_new_user` cria o profile + role `diretoria` automaticamente.
- **Tela de convite no app**: criar uma página `/admin/usuarios` protegida por `has_role('admin')` que usa `supabaseAdmin.auth.admin.createUser(...)` via server function. Posso montar isso num próximo passo se quiser.

## Não faz parte deste passo
- Mudar roles existentes
- Mexer em RLS
- Tornar o site privado (continua público; só o cadastro fecha)

Confirma que quer seguir assim?