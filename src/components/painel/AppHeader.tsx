import { brl } from "@/lib/format";
import { caixa, notas } from "@/data/painel";

const totalCarteira = notas.reduce((s, n) => s + n.valor, 0);
const saldoAtual = caixa[caixa.length - 1].saldoTotal;
const cobertura = (saldoAtual / totalCarteira) * 100;

export function AppHeader() {
  return (
    <header className="header-gradient sticky top-0 z-40 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
          ◆ Cheques Fornecedores · Grupo Ley
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
