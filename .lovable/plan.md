# Notificação Telegram para Cheques Devolvidos

Reusa o mesmo bot já configurado (`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`).

## 1. `supabase/functions/telegram-notify/index.ts`
Adicionar branch `else if (table === "cheques_devolvidos")` no handler existente:
- `pendente = valor_devolvido - valor_rec_fornecedor - valor_rec_empresa`
- Formatar `data` (YYYY-MM-DD) para DD/MM/AAAA
- Mensagem HTML:
  - `😕 <b>Cheques devolvidos!</b>`
  - 📅 Data
  - 💸 Valor devolvido
  - 🤝 Recuperado fornecedor (só se > 0)
  - 🏢 Recuperado empresa (só se > 0)
  - ⏳ Pendente
  - 👤 Ação executada por (via `actor_name` já enviado pela trigger)

## 2. Migration SQL
Criar trigger AFTER INSERT em `public.cheques_devolvidos` usando a função existente `public.notify_telegram()`:

```sql
CREATE TRIGGER trg_notify_cheques_devolvidos
AFTER INSERT ON public.cheques_devolvidos
FOR EACH ROW EXECUTE FUNCTION public.notify_telegram();
```

## Fora do escopo
- UI (`DevolvidosManager.tsx`) — sem mudanças
- Estrutura da tabela — sem mudanças
- Apenas INSERT (não notifica UPDATE/DELETE)
