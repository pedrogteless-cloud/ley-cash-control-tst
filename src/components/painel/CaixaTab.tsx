import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Shield } from "lucide-react";
import { caixa, notas } from "@/data/painel";
import { brl } from "@/lib/format";
import { KpiCard } from "./KpiCard";

const totalCarteira = notas.reduce((s, n) => s + n.valor, 0);

export function CaixaTab() {
  const ultimo = caixa[caixa.length - 1];
  const cobertura = (ultimo.saldoTotal / totalCarteira) * 100;

  const lineData = caixa.map((c) => ({
    data: c.data, Saldo: c.saldoTotal, Entrada: c.entrada, Saida: c.saida,
  }));

  const compareData = caixa.map((c) => ({
    data: c.data, "Saldo em casa": c.saldoTotal, "Carteira NFs": totalCarteira,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Saldo em Casa" value={brl(ultimo.saldoTotal)} hint={`Em ${ultimo.data}`} tone="green" icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Entrada do Dia" value={brl(ultimo.entrada)} hint="Cheques recebidos" tone="blue" icon={<ArrowDownToLine className="h-4 w-4" />} />
        <KpiCard label="Saída do Dia" value={brl(ultimo.saida)} hint={ultimo.destino ?? "Sem saídas"} tone="red" icon={<ArrowUpFromLine className="h-4 w-4" />} />
        <KpiCard label="Cobertura da Carteira" value={`${cobertura.toFixed(0)}%`} hint={brl(totalCarteira) + " a pagar"} tone="gold" icon={<Shield className="h-4 w-4" />} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-semibold text-foreground">Evolução do caixa</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={lineData}>
            <CartesianGrid stroke="#2D3748" vertical={false} />
            <XAxis dataKey="data" stroke="#8B949E" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8B949E" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "#1C2330", border: "1px solid #2D3748", borderRadius: 12, color: "#E6EDF3" }} formatter={(v: number) => brl(v)} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#C9D1D9" }} />
            <Line type="monotone" dataKey="Saldo" stroke="#3DDC84" strokeWidth={3} dot={{ r: 4, fill: "#3DDC84" }} />
            <Line type="monotone" dataKey="Entrada" stroke="#58A6FF" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Saida" stroke="#FF6B6B" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-semibold text-foreground">Saldo em casa vs Carteira de NFs</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={compareData}>
            <CartesianGrid stroke="#2D3748" vertical={false} />
            <XAxis dataKey="data" stroke="#8B949E" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8B949E" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: "#1C2330", border: "1px solid #2D3748", borderRadius: 12, color: "#E6EDF3" }} formatter={(v: number) => brl(v)} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#C9D1D9" }} />
            <Bar dataKey="Saldo em casa" fill="#3DDC84" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Carteira NFs" fill="#F0B429" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4 text-sm font-semibold text-foreground">Histórico do caixa</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 text-right font-medium">Saldo Anterior</th>
                <th className="px-4 py-3 text-right font-medium">Entrada</th>
                <th className="px-4 py-3 text-right font-medium">Saída</th>
                <th className="px-4 py-3 text-right font-medium">Saldo Total</th>
                <th className="px-4 py-3 font-medium">Destino</th>
              </tr>
            </thead>
            <tbody>
              {caixa.map((c, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold text-foreground">{c.data}</td>
                  <td className="px-4 py-3 text-right text-soft-foreground">{brl(c.saldoAnterior)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue">{c.entrada > 0 ? brl(c.entrada) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red">{c.saida > 0 ? brl(c.saida) : "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-green">{brl(c.saldoTotal)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.destino ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
