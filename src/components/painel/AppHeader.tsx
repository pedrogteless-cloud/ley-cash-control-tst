import { Link } from "@tanstack/react-router";
import { LeyLogo } from "@/components/LeyLogo";
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

  const hoje = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date())
    .replace(/\./g, "");
  const btn =
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-soft-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50";

  return (
    <header className="sticky top-0 z-40 border-b-2 border-b-[#4aa3ef] bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <LeyLogo className="h-8 sm:h-9" />
            <span className="hidden h-6 w-px bg-border sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-extrabold leading-tight text-foreground sm:text-base">
                Painel de Controle
              </h1>
              <span className="hidden text-[11px] text-muted-foreground sm:block">
                Cheques · Grupo Ley · {hoje}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {canWrite && (
              <Link
                to="/lancamentos"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-gold px-3 text-xs font-semibold text-background transition-colors hover:bg-gold/90"
              >
                <ClipboardEdit className="h-3.5 w-3.5" /> Lançar
              </Link>
            )}
            {isAdmin && (
              <button onClick={enviarStatus} disabled={sendingStatus} title="Enviar resumo ao Telegram" className={`hidden sm:inline-flex ${btn}`}>
                {sendingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart2 className="h-3.5 w-3.5" />}
                Status
              </button>
            )}
            {isAdmin && (
              <button onClick={exportToExcel} disabled={exporting} title="Exportar dados completos em Excel" className={`hidden sm:inline-flex ${btn}`}>
                {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Exportar
              </button>
            )}
            {isAdmin && (
              <Link to="/gerenciar" className={`hidden sm:inline-flex ${btn}`}>
                <Settings2 className="h-3.5 w-3.5" /> Gerenciar
              </Link>
            )}
            <button onClick={() => supabase.auth.signOut()} className={btn} aria-label="Sair">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 divide-x divide-border rounded-md border border-border bg-card">
          <KpiBlock label="Carteira de NFs" value={brl(totalCarteira)} hint={`${notas.length} notas em aberto`} tone="default" />
          <KpiBlock
            label="Saldo em Caixa"
            value={brl(saldoAtual)}
            hint={<>Cobertura de <span className="font-semibold text-green">{cobertura.toFixed(0)}%</span></>}
            tone="green"
          />
        </dl>
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
    <div className="min-w-0 px-3 py-2.5 sm:px-4">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 truncate whitespace-nowrap text-lg font-semibold tabular-nums leading-tight sm:text-2xl ${tone === "green" ? "text-green" : "text-foreground"}`}>
        {value}
      </dd>
      <dd className="text-xs text-soft-foreground">{hint}</dd>
    </div>
  );
}
