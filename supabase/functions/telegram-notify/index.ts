// Telegram notification edge function
// Invoked by Postgres triggers (via pg_net) on inserts to notas_fiscais,
// caixa_movimentos and cheques_devolvidos, and pelo cliente quando um
// cheque é confirmado como enviado.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-secret",
};

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

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

async function sendTelegramOrThrow(text: string) {
  const result = await sendTelegram(text);
  if (!result.ok) {
    throw new Error(String(result.error ?? "telegram_send_failed"));
  }
}

type NfPayload = { fornecedor: string; nf: string; valor: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const serverOriginated = payload?.type === "devolvido_atualizado" || typeof payload?.table === "string";
    if (serverOriginated && WEBHOOK_SECRET && req.headers.get("x-telegram-secret") !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ Resumo geral (manual via botão OU automático via cron) ============
    if (payload?.type === "resumo_geral" || payload?.type === "resumo_automatico") {
      let carteira_valor: number;
      let carteira_notas: number;
      let prioridade_valor: number;
      let prioridade_notas: number;
      let saldo_caixa: number;
      let usuario: string | undefined = payload?.usuario;

      if (payload?.type === "resumo_automatico") {
        // Verificação de segredo para chamada automática
        if (WEBHOOK_SECRET && req.headers.get("x-telegram-secret") !== WEBHOOK_SECRET) {
          return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!SUPABASE_URL || !SERVICE_KEY) {
          return new Response(JSON.stringify({ ok: false, error: "missing_supabase_env" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
        const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

        const { data: nfs, error: nfsErr } = await sb
          .from("notas_fiscais")
          .select("valor, entrega, status_envio, cheque_enviado_em");
        if (nfsErr) throw nfsErr;
        const abertas = (nfs ?? []).filter(
          (n: any) => n.status_envio !== "ENVIADO" && !n.cheque_enviado_em,
        );
        const prioridade = abertas.filter((n: any) => {
          const e = String(n.entrega ?? "").toUpperCase();
          return e.includes("CHEGOU") && !e.includes("NÃO") && !e.includes("NAO");
        });
        carteira_valor = abertas.reduce((s: number, n: any) => s + Number(n.valor || 0), 0);
        carteira_notas = abertas.length;
        prioridade_valor = prioridade.reduce((s: number, n: any) => s + Number(n.valor || 0), 0);
        prioridade_notas = prioridade.length;

        const { data: movs, error: movErr } = await sb
          .from("caixa_movimentos")
          .select("entrada, saida, saldo_anterior, data, created_at");
        if (movErr) throw movErr;
        const arr = movs ?? [];
        let saldoBase = 0;
        if (arr.length) {
          const sorted = [...arr].sort((a: any, b: any) => {
            const [da, ma] = String(a.data ?? "").split("/").map((x) => parseInt(x, 10));
            const [db, mb] = String(b.data ?? "").split("/").map((x) => parseInt(x, 10));
            if ((ma || 0) !== (mb || 0)) return (ma || 0) - (mb || 0);
            if ((da || 0) !== (db || 0)) return (da || 0) - (db || 0);
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          saldoBase = Number(sorted[0].saldo_anterior || 0);
        }
        const totalEnt = arr.reduce((s: number, m: any) => s + Number(m.entrada || 0), 0);
        const totalSai = arr.reduce((s: number, m: any) => s + Number(m.saida || 0), 0);
        saldo_caixa = saldoBase + totalEnt - totalSai;

        usuario = usuario ?? "Envio automático";
      } else {
        carteira_valor = Number(payload?.carteira_valor ?? 0);
        carteira_notas = Number(payload?.carteira_notas ?? 0);
        prioridade_valor = Number(payload?.prioridade_valor ?? 0);
        prioridade_notas = Number(payload?.prioridade_notas ?? 0);
        saldo_caixa = Number(payload?.saldo_caixa ?? 0);
      }

      const cobertura = carteira_valor > 0
        ? ((saldo_caixa / carteira_valor) * 100).toFixed(0)
        : "—";

      const now = new Date();
      const dataBR = now.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
      const horaBR = now.toLocaleTimeString("pt-BR", { timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit" });

      const linhas = [
        "📊 <b>Status Geral — Grupo Ley</b>",
        "",
        `📅 <b>${escapeHtml(dataBR)} · ${escapeHtml(horaBR)}</b>`,
        "",
        `💵 <b>Saldo em casa:</b>  ${escapeHtml(brl(saldo_caixa))}`,
        `💼 <b>Total Carteira:</b>  ${escapeHtml(brl(carteira_valor))}  <i>(${carteira_notas} nota${carteira_notas === 1 ? "" : "s"})</i>`,
        `🚨 <b>Prioridade no envio:</b>  ${escapeHtml(brl(prioridade_valor))}  <i>(${prioridade_notas} ${prioridade_notas === 1 ? "nota já chegou" : "notas já chegaram"})</i>`,
        `🎯 <b>Cobertura:</b>  ${escapeHtml(cobertura)}%`,
      ];
      if (usuario) linhas.push("", `👤 <b>Solicitado por:</b> ${escapeHtml(String(usuario))}`);

      await sendTelegramOrThrow(linhas.join("\n"));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ Devolvido atualizado (chamado via RPC/pg_net) ============
    if (payload?.type === "devolvido_atualizado") {
      const {
        data,
        recuperacao_avulsa,
        total_recuperado_delta,
        total_recuperado_lancamento,
        total_recuperado_acumulado,
        pendente_lancamento,
        pendente_acumulado,
      } = payload ?? {};

      const parts = String(data ?? "").split("-");
      const dataFmt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(data ?? "");
      const totalNovo = Number(total_recuperado_delta ?? 0);
      const totalLancamento = Number(total_recuperado_lancamento ?? 0);
      const totalAcumulado = Number(total_recuperado_acumulado ?? 0);
      const pendAcum = Number(pendente_acumulado ?? 0);
      const actor = String(payload?.actor_name ?? "").trim();

      const linhas: string[] = [];
      if (recuperacao_avulsa) {
        linhas.push(
          "♻️ <b>Recuperação avulsa de cheque — Grupo Ley</b>",
          "",
          `📅 <b>Data:</b> ${escapeHtml(dataFmt)}`,
          `💰 <b>Valor recuperado:</b> ${escapeHtml(brl(totalLancamento))}`,
          "",
          `📊 <b>Total acumulado:</b> ${escapeHtml(brl(totalAcumulado))}`,
          `⏳ <b>Pendente acumulado:</b> ${escapeHtml(brl(pendAcum))}`,
        );
      } else {
        linhas.push(
          "♻️ <b>Recuperação de cheque atualizada — Grupo Ley</b>",
          "",
          `📅 <b>Lançamento de:</b> ${escapeHtml(dataFmt)}`,
          `💰 <b>Valor recuperado:</b> ${escapeHtml(brl(totalNovo))}`,
          "",
          `🧾 <b>Recuperado no lançamento:</b> ${escapeHtml(brl(totalLancamento))}`,
          `⏳ <b>Pendente no lançamento:</b> ${escapeHtml(brl(Number(pendente_lancamento ?? 0)))}`,
          `📊 <b>Total acumulado:</b> ${escapeHtml(brl(totalAcumulado))}`,
          `⏳ <b>Pendente acumulado:</b> ${escapeHtml(brl(pendAcum))}`,
        );
      }
      if (actor) linhas.push("", `👤 <b>Ação executada por:</b> ${escapeHtml(actor)}`);

      await sendTelegramOrThrow(linhas.join("\n"));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // ============ Envio de cheque com baixa automática (novo fluxo multi-NF) ============
    if (payload?.type === "envio_cheque") {
      const { fornecedor, qtdNfs, valor, novoSaldo } = payload ?? {};
      const msg = [
        "📤 <b>Cheque enviado — Grupo Ley</b>",
        "",
        `🏭 <b>Fornecedor:</b> ${escapeHtml(String(fornecedor ?? ""))}`,
        `🧾 <b>NFs resolvidas:</b> ${escapeHtml(String(qtdNfs ?? 1))}`,
        `💰 <b>Valor enviado:</b> ${escapeHtml(brl(Number(valor ?? 0)))}`,
        `💵 <b>Novo saldo de caixa:</b> ${escapeHtml(brl(Number(novoSaldo ?? 0)))}`,
      ].join("\n");
      await sendTelegramOrThrow(msg);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ Valor de NF editado (chamado via trigger) ============
    if (payload?.type === "nf_valor_editada") {
      const fornecedor = String(payload.fornecedor ?? "");
      const nf = String(payload.nf ?? "");
      const filial = String(payload.filial ?? "");
      const valorAntigo = Number(payload.valor_antigo ?? 0);
      const valorNovo = Number(payload.valor_novo ?? 0);
      const delta = Math.round((valorNovo - valorAntigo) * 100) / 100;
      const aumentou = delta >= 0;
      const actor = String(payload?.actor_name ?? "").trim();

      const linhas = [
        "✏️ <b>Valor de NF editado — Grupo Ley</b>",
        "",
        `🏭 <b>Fornecedor:</b> ${escapeHtml(fornecedor)}`,
        `🧾 <b>NF:</b> ${escapeHtml(nf)}`,
        `🏢 <b>Filial:</b> ${escapeHtml(filial)}`,
        "",
        `${aumentou ? "📈" : "📉"} <b>De</b> ${escapeHtml(brl(valorAntigo))} <b>→</b> ${escapeHtml(brl(valorNovo))}`,
        `${aumentou ? "🔺" : "🔻"} <b>${aumentou ? "Aumento de" : "Redução de"}</b> ${escapeHtml(brl(Math.abs(delta)))}`,
      ].join("\n") + (actor ? `\n\n👤 <b>Ação executada por:</b> ${escapeHtml(actor)}` : "");

      await sendTelegramOrThrow(linhas);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ Cheque enviado (chamado pelo cliente) ============
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

      await sendTelegramOrThrow(linhas.join("\n"));
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { table, record } = payload ?? {};
    const actorName = String(payload?.actor_name ?? "").trim();
    const actorLine = actorName ? `\n👤 <b>Ação executada por:</b> ${escapeHtml(actorName)}` : "";

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
        ].join("\n") + actorLine;
        await sendTelegramOrThrow(msg);
      } else if (op === "INSERT") {
        const msg = [
          chegou
            ? "📬 <b>NF chegou! Cheques a enviar...</b>"
            : "🚚 <b>Nova NF faturada, carga a caminho!</b>",
          `🏭 <b>Fornecedor:</b> ${escapeHtml(record.fornecedor)}`,
          `🧾 <b>NF:</b> ${escapeHtml(record.nf)}`,
          `🏢 <b>Filial:</b> ${escapeHtml(record.filial)}`,
          `💰 <b>Valor:</b> ${escapeHtml(brl(record.valor))}`,
        ].join("\n") + actorLine;
        await sendTelegramOrThrow(msg);
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
        .join("\n") + actorLine;
      await sendTelegramOrThrow(msg);
    } else if (table === "cheques_devolvidos") {
      const devolvido = Number(record.valor_devolvido) || 0;
      const recF = Number(record.valor_rec_fornecedor) || 0;
      const recE = Number(record.valor_rec_empresa) || 0;
      const totalRec = recF + recE;
      const pendente = devolvido - totalRec;
      const isAvulsa = devolvido <= 0 && totalRec > 0;

      const [y, m, d] = String(record.data ?? "").split("-");
      const dataBR = y && m && d ? `${d}/${m}/${y}` : String(record.data ?? "");

      let linhas: string;
      if (isAvulsa) {
        linhas = [
          "♻️ <b>Recuperação avulsa de cheque — Grupo Ley</b>",
          `📅 <b>Data:</b> ${escapeHtml(dataBR)}`,
          `💰 <b>Valor recuperado:</b> ${escapeHtml(brl(totalRec))}`,
        ].join("\n") + actorLine;
      } else {
        linhas = [
          "😕 <b>Cheques devolvidos!</b>",
          `📅 <b>Data:</b> ${escapeHtml(dataBR)}`,
          `💸 <b>Valor devolvido:</b> ${escapeHtml(brl(devolvido))}`,
          totalRec > 0 ? `💰 <b>Valor recuperado:</b> ${escapeHtml(brl(totalRec))}` : "",
          `⏳ <b>Pendente:</b> ${escapeHtml(brl(pendente))}`,
        ].filter(Boolean).join("\n") + actorLine;
      }

      await sendTelegramOrThrow(linhas);
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
