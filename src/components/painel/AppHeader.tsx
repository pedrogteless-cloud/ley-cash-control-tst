import { Link } from "@tanstack/react-router";
import { LogOut, Settings2, ClipboardEdit, BarChart2, Loader2, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { useStore } from "@/data/store";
import { isEnviado } from "@/data/painel";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-role";
import { buildPainelWorkbook } from "@/lib/excel-painel";

export function AppHeader() {
  const { notas, caixa } = useStore();
  const { isAdmin, canWrite } = useRoles();
  const [sendingStatus, setSendingStatus] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const blob = await buildPainelWorkbook(notas, caixa);
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `Ley_Painel_${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha exportada com sucesso");
    } catch {
      toast.error("Erro ao exportar planilha");
    } finally {
      setExporting(false);
    }
  };

  const enviarStatus = async () => {
    setSendingStatus(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      let usuario: string | null = null;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("id", uid)
          .maybeSingle();
        usuario = prof?.display_name || prof?.email || s.session?.user.email || null;
      }
      const carteiraNFs = notas.filter((n) => !isEnviado(n));
      const prioridadeNFs = carteiraNFs.filter((n) => {
        const e = (n.entrega ?? "").toUpperCase();
        return e.includes("CHEGOU") && !e.includes("NÃO") && !e.includes("NAO");
      });
      const { data, error } = await supabase.functions.invoke("telegram-notify", {
        body: {
          type: "resumo_geral",
          carteira_valor: carteiraNFs.reduce((acc, n) => acc + n.valor, 0),
          carteira_notas: carteiraNFs.length,
          prioridade_valor: prioridadeNFs.reduce((acc, n) => acc + n.valor, 0),
          prioridade_notas: prioridadeNFs.length,
          saldo_caixa: saldoAtual,
          usuario: usuario ?? undefined,
        },
      });
      if (error) throw error;
      const result = data as { ok?: boolean; error?: string } | null;
      if (result?.ok === false) throw new Error(result?.error ?? "Falha ao enviar");
      toast.success("Status enviado ao Telegram ✅");
    } catch (e) {
      toast.error("Erro ao enviar status");
      console.error(e);
    } finally {
      setSendingStatus(false);
    }
  };
  const totalCarteira = notas.filter((n) => !isEnviado(n)).reduce((s, n) => s + n.valor, 0);
  // caixa já vem ordenado (data ASC, created_at ASC) e com saldos derivados
  // via computeChain() no store — o último elemento é sempre o saldo correto.
  const saldoAtual = caixa.length ? caixa[caixa.length - 1].saldoTotal : 0;
  const cobertura = totalCarteira > 0 ? (saldoAtual / totalCarteira) * 100 : 0;

  return (
    <header className="header-gradient sticky top-0 z-40 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
            ◆ Cheques · Grupo Ley
          </div>
          <div className="flex items-center gap-1.5">
            {canWrite && (
              <Link
                to="/lancamentos"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-background hover:bg-gold/90 transition-colors"
              >
                <ClipboardEdit className="h-3.5 w-3.5" /> Lançar
              </Link>
            )}
            {isAdmin && (
              <button
                onClick={enviarStatus}
                disabled={sendingStatus}
                title="Enviar resumo ao Telegram"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-soft-foreground hover:text-blue hover:border-blue/40 transition-colors disabled:opacity-50"
              >
                {sendingStatus
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <BarChart2 className="h-3.5 w-3.5" />}
                Status
              </button>
            )}
            {isAdmin && (
              <button
                onClick={exportToExcel}
                disabled={exporting}
                title="Exportar dados completos em Excel"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-soft-foreground hover:text-gold hover:border-gold/40 transition-colors disabled:opacity-50"
              >
                {exporting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Download className="h-3.5 w-3.5" />}
                Exportar
              </button>
            )}
            {isAdmin && (
              <Link
                to="/gerenciar"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-soft-foreground hover:text-gold hover:border-gold/40 transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" /> Gerenciar
              </Link>
            )}
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-soft-foreground hover:text-red hover:border-red/40 transition-colors"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-foreground sm:text-3xl lg:text-4xl">
            Painel de Controle
          </h1>
          <span className="rounded-full bg-gold-dim px-2.5 py-0.5 text-[11px] font-semibold text-gold ring-1 ring-gold/30">
            Hoje · {(() => {
              const d = new Date();
              const dia = String(d.getDate()).padStart(2, "0");
              const mes = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).replace(".", "");
              return `${dia} ${mes} · ${d.getFullYear()}`;
            })()}
          </span>
          {(() => {
            const times: number[] = [];
            notas.forEach((n) => n.createdAt && times.push(new Date(n.createdAt).getTime()));
            caixa.forEach((c) => {
              if (c.createdAt) times.push(new Date(c.createdAt).getTime());
              if (c.data) times.push(new Date(c.data).getTime());
            });
            const valid = times.filter((t) => Number.isFinite(t));
            if (!valid.length) return null;
            const d = new Date(Math.max(...valid));
            const dia = String(d.getDate()).padStart(2, "0");
            const mes = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(d).replace(".", "");
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            return (
              <span className="rounded-full bg-blue-dim px-2.5 py-0.5 text-[11px] font-semibold text-blue ring-1 ring-blue/30">
                Última atualização · {dia} {mes} · {d.getFullYear()} · {hh}:{mm}
              </span>
            );
          })()}
          {isAdmin && (
            <span className="rounded-full bg-green-dim px-2.5 py-0.5 text-[11px] font-semibold text-green ring-1 ring-green/30">
              Admin
            </span>
          )}
        </div>

        {/* KPIs: carrossel snap no mobile, grid no desktop */}
        <div className="mt-4 -mx-4 sm:mx-0">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0">
            <KpiBlock
              label="Carteira de NFs"
              value={brl(totalCarteira)}
              hint={`${notas.length} notas em aberto`}
              tone="default"
            />
            <KpiBlock
              label="Saldo em Caixa"
              value={brl(saldoAtual)}
              hint={
                <>
                  Cobertura de{" "}
                  <span className="font-semibold text-green">{cobertura.toFixed(0)}%</span>
                </>
              }
              tone="green"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function KpiBlock({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
  tone: "default" | "green";
}) {
  return (
    <div className="min-w-[82%] snap-start rounded-xl border border-border bg-card/60 p-4 backdrop-blur sm:min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1 truncate whitespace-nowrap tabular-nums leading-tight text-xl font-bold sm:text-3xl ${
          tone === "green" ? "text-green" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-soft-foreground">{hint}</div>
    </div>
  );
}
