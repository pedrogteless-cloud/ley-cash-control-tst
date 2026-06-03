import { Link } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { brl } from "@/lib/format";
import { useStore } from "@/data/store";

export function AppHeader() {
  const { notas, caixa } = useStore();
  const totalCarteira = notas.reduce((s, n) => s + n.valor, 0);
  const saldoAtual = caixa.length ? caixa[caixa.length - 1].saldoTotal : 0;
  const cobertura = totalCarteira > 0 ? (saldoAtual / totalCarteira) * 100 : 0;

  return (
    <header className="header-gradient sticky top-0 z-40 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
            ◆ Cheques Fornecedores · Grupo Ley
          </div>
          <Link
            to="/gerenciar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-soft-foreground hover:text-gold hover:border-gold/40 transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" /> Gerenciar
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
            Painel de Controle
          </h1>
          <span className="rounded-full bg-gold-dim px-3 py-1 text-xs font-semibold text-gold ring-1 ring-gold/30">
            01 jun · 2026
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Carteira de NFs</div>
            <div className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">{brl(totalCarteira)}</div>
            <div className="text-xs text-soft-foreground">{notas.length} notas em aberto</div>
          </div>
          <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo em Caixa</div>
            <div className="mt-1 text-2xl font-bold text-green sm:text-3xl">{brl(saldoAtual)}</div>
            <div className="text-xs text-soft-foreground">
              Cobertura de <span className="font-semibold text-green">{cobertura.toFixed(0)}%</span> da carteira
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
