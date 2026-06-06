// Telegram notification edge function
// Invoked by Postgres triggers (via pg_net) on inserts to notas_fiscais and caixa_movimentos.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

const escapeHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function sendTelegram(text: string) {
  if (!TOKEN || !CHAT_ID) {
    console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    return { ok: false, error: "missing_env" };
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error("Telegram error:", res.status, data);
  return { ok: res.ok, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { table, record } = payload ?? {};

    if (!record) {
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (table === "notas_fiscais") {
      const entrega = String(record.entrega ?? "").toUpperCase();
      const op = String(payload.type ?? "").toUpperCase();
      const chegou = entrega.includes("CHEGOU") && !entrega.includes("NÃO");

      if (op === "UPDATE" && chegou) {
        const msg = [
          "📬 <b>NF chegou! Cheques a enviar...</b>",
          `🏭 <b>Fornecedor:</b> ${escapeHtml(record.fornecedor)}`,
          `🧾 <b>NF:</b> ${escapeHtml(record.nf)}`,
          `🏢 <b>Filial:</b> ${escapeHtml(record.filial)}`,
          `💰 <b>Valor:</b> ${escapeHtml(brl(record.valor))}`,
          "",
          "⚠️ <i>Separe os cheques e envie ao fornecedor.</i>",
        ].join("\n");
        await sendTelegram(msg);
      } else if (op === "INSERT") {
        const msg = [
          chegou
            ? "📬 <b>NF chegou! Cheques a enviar...</b>"
            : "🚚 <b>Nova NF faturada, carga a caminho!</b>",
          `🏭 <b>Fornecedor:</b> ${escapeHtml(record.fornecedor)}`,
          `🧾 <b>NF:</b> ${escapeHtml(record.nf)}`,
          `🏢 <b>Filial:</b> ${escapeHtml(record.filial)}`,
          `💰 <b>Valor:</b> ${escapeHtml(brl(record.valor))}`,
        ].join("\n");
        await sendTelegram(msg);
      }
    } else if (table === "caixa_movimentos") {
      const msg = [
        "💼 <b>Novo movimento de caixa</b>",
        `📅 <b>Data:</b> ${escapeHtml(record.data)}`,
        `🔁 <b>Saldo anterior:</b> ${escapeHtml(brl(record.saldo_anterior))}`,
        `⬇️ <b>Entrada:</b> ${escapeHtml(brl(record.entrada))}`,
        `⬆️ <b>Saída:</b> ${escapeHtml(brl(record.saida))}`,
        `💵 <b>Saldo total:</b> ${escapeHtml(brl(record.saldo_total))}`,
        record.destino ? `🎯 <b>Destino:</b> ${escapeHtml(record.destino)}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      await sendTelegram(msg);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("telegram-notify error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
