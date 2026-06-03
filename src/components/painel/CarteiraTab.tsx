import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { AlertTriangle, Send, Clock, FileText, Wallet } from "lucide-react";
import { isEnviar } from "@/data/painel";
import { useStore } from "@/data/store";
import { brl } from "@/lib/format";
import { KpiCard } from "./KpiCard";

const FILTERS = ["Todas", "Enviar Cheque", "Não Chegou", "Esp. entrega"] as const;
type Filter = (typeof FILTERS)[number];

export function CarteiraTab() {
  const { notas } = useStore();
  const [filter, setFilter] = useState<Filter>("Todas");

  const totals = useMemo(() => {
    const enviar = notas.filter(isEnviar);
    const aguardando = notas.filter((n) => n.entrega.toUpperCase().includes("NÃO") && n.statusNf.toUpperCase() === "FATURADO");
    const apenasFat = notas.filter((n) => !isEnviar(n) && !(n.entrega.toUpperCase().includes("NÃO") && n.statusNf.toUpperCase() === "FATURADO"));
    const sum = (arr: typeof notas) => arr.reduce((s, n) => s + n.valor, 0);
    const total = sum(notas);
    return {
      enviar: { qtd: enviar.length, val: sum(enviar) },
      aguardando: { qtd: aguardando.length, val: sum(aguardando) },
      apenasFat: { qtd: apenasFat.length, val: sum(apenasFat) },
      total,
    };
  }, [notas]);

  const filtered = useMemo(() => {
    if (filter === "Todas") return notas;
    if (filter === "Enviar Cheque") return notas.filter(isEnviar);
    if (filter === "Não Chegou") return notas.filter((n) => n.entrega.toUpperCase().includes("NÃO"));
    return notas.filter((n) => !isEnviar(n));
  }, [filter, notas]);

  const porFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    notas.forEach((n) => m.set(n.fornecedor, (m.get(n.fornecedor) || 0) + n.valor));
    return Array.from(m, ([fornecedor, valor]) => ({ fornecedor, valor })).sort((a, b) => b.valor - a.valor);
  }, [notas]);

  const pieData = [
    { name: "Enviar Cheque", value: totals.enviar.val, color: "#FF9F43" },
    { name: "Esp. entrega", value: totals.aguardando.val + totals.apenasFat.val, color: "#58A6FF" },
  ];

  const enviarCount = totals.enviar.qtd;

  const iconMap: Record<string, ReactNode> = {
    plus: <PlusCircle className="h-5 w-5" />,
    truck: <TruckIcon className="h-5 w-5" />,
    alert: <AlertTriangle className="h-5 w-5" />,
  };

  return (
    <div className="space-y-6">
      {/* Mudanças */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Mudanças em relação ao dia anterior
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mudancasDia.map((m, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-dim text-gold">
                {iconMap[m.icone]}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{m.titulo}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Alerta */}
      {enviarCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange/40 bg-orange-dim p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
          <div>
            <div className="font-semibold text-orange">
              {enviarCount} NF{enviarCount > 1 ? "s" : ""} com cheque a enviar
            </div>
            <div className="text-sm text-soft-foreground">
              Total de {brl(totals.enviar.val)} pronto para repasse aos fornecedores.
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Cheque a Enviar"
          value={brl(totals.enviar.val)}
          hint={`${totals.enviar.qtd} notas · ${((totals.enviar.val / totals.total) * 100).toFixed(0)}%`}
          tone="orange"
          icon={<Send className="h-4 w-4" />}
        />
        <KpiCard
          label="Aguardando Entrega"
          value={brl(totals.aguardando.val)}
          hint={`${totals.aguardando.qtd} notas · ${((totals.aguardando.val / totals.total) * 100).toFixed(0)}%`}
          tone="blue"
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiCard
          label="Apenas Faturado"
          value={brl(totals.apenasFat.val)}
          hint={`${totals.apenasFat.qtd} notas · ${((totals.apenasFat.val / totals.total) * 100).toFixed(0)}%`}
          tone="gold"
          icon={<FileText className="h-4 w-4" />}
        />
        <KpiCard
          label="Total da Carteira"
          value={brl(totals.total)}
          hint={`${notas.length} notas em aberto`}
          tone="green"
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 text-sm font-semibold text-foreground">Valor por fornecedor</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porFornecedor} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid stroke="#2D3748" vertical={false} />
              <XAxis dataKey="fornecedor" stroke="#8B949E" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="#8B949E" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#1C2330", border: "1px solid #2D3748", borderRadius: 12, color: "#E6EDF3" }}
                formatter={(v: number) => brl(v)}
              />
              <Bar dataKey="valor" fill="#F0B429" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold text-foreground">Distribuição da carteira</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="#161B22" strokeWidth={2} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1C2330", border: "1px solid #2D3748", borderRadius: 12, color: "#E6EDF3" }}
                formatter={(v: number) => brl(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#C9D1D9" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div className="text-sm font-semibold text-foreground">Notas fiscais</div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === f
                    ? "bg-gold text-background"
                    : "bg-surface text-soft-foreground hover:bg-border/40"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">NF</th>
                <th className="px-4 py-3 font-medium">Filial</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status NF</th>
                <th className="px-4 py-3 font-medium">Entrega</th>
                <th className="px-4 py-3 font-medium">Cheque</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n, i) => {
                const enviar = isEnviar(n);
                return (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-foreground">{n.fornecedor}</td>
                    <td className="px-4 py-3 text-soft-foreground">{n.nf}</td>
                    <td className="px-4 py-3 text-muted-foreground">{n.filial}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{brl(n.valor)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                        n.statusNf.toUpperCase() === "CHEGOU" ? "bg-green-dim text-green" : "bg-gold-dim text-gold"
                      }`}>{n.statusNf}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-soft-foreground">{n.entrega}</td>
                    <td className="px-4 py-3">
                      {enviar ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-orange-dim px-2 py-0.5 text-xs font-bold text-orange">
                          <Send className="h-3 w-3" /> ENVIAR CHEQUE
                        </span>
                      ) : (
                        <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                          Cheque esp. entrega
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma nota neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
