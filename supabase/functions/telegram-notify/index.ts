// Telegram notification edge function
// Invoked by Postgres triggers (via pg_net) on inserts to notas_fiscais and caixa_movimentos,
// and pelo cliente quando um cheque é confirmado como enviado.

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

type NfPayload = { fornecedor: string; nf: string; valor: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();

    // ============ NOVO: Cheque enviado (chamado pelo cliente) ============
    if (payload?.type === "cheque_enviado" && Array.isArray(payload.notas)) {
      const notas = payload.notas as NfPayload[];
      const dataStr = String(payload.data ?? "");
      const usuario = String(payload.usuario ?? "").trim();

      // Agrupar por fornecedor
      const groups = new Map<string, { nfs: string[]; total: number }>();
      for (const n of notas) {
        const g = groups.get(n.fornecedor) ?? { nfs: [], total: 0 };
        g.nfs.push(String(n.nf));
        g.total += Number(n.valor) || 0;
        groups.set(n.fornecedor, g);
      }

      const titulo =
        notas.length === 1
          ? "🟢 <b>Cheque enviado — Grupo Ley</b>"
          : "🟢 <b>Cheques enviados — Grupo Ley</b>";

      const linhas: string[] = [titulo, ""];
      for (const [fornecedor, g] of groups) {
        linhas.push(`🏭 <b>Fornecedor:</b> ${escapeHtml(fornecedor)}`);
        linhas.push(`🧾 <b>NF:</b> ${escapeHtml(g.nfs.join(", "))}`);
        linhas.push(`💰 <b>Valor:</b> ${escapeHtml(brl(g.total))}`);
        linhas.push("");
      }
      if (dataStr) linhas.push(`📅 <b>Data:</b> ${escapeHtml(dataStr)}`);
      if (usuario) linhas.push(`👤 <b>Ação executada por:</b> ${escapeHtml(usuario)}`);

      await sendTelegram(linhas.join("\n"));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      // Não notificar lançamentos automáticos (já notificamos via cheque_enviado)
      if (record.origem === "auto_nf") {
        return new Response(JSON.stringify({ ok: true, skipped: "auto_nf" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
