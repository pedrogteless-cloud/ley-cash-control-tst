import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { AlertTriangle, Send, Clock, Wallet, Search, CheckCircle2 } from "lucide-react";
import { isAEnviar, isAguardando, isEnviado } from "@/data/painel";
import { useStore } from "@/data/store";
import { brl } from "@/lib/format";
import { KpiCard } from "./KpiCard";
import { NfCard } from "./NfCard";
import { useRoles } from "@/hooks/use-role";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FILTERS = ["Todas", "Enviar Cheque", "Aguardando Carga", "Enviados"] as const;
type Filter = (typeof FILTERS)[number];

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function CarteiraTab({
  onEdit,
  readOnly = false,
}: {
  onEdit?: (kind: "nf", id: string) => void;
  readOnly?: boolean;
}) {
  const { notas, removeNota, confirmarEnvio, confirmandoEnvioId } = useStore();
  const { canWriteNf } = useRoles();
  const canEdit = !readOnly && canWriteNf;
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("Todas");
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; fornecedor: string; valor: number } | null>(null);

  const totals = useMemo(() => {
    const enviar = notas.filter(isAEnviar);
    const aguardando = notas.filter(isAguardando);
    const enviados = notas.filter(isEnviado);
    const sum = (arr: typeof notas) => arr.reduce((s, n) => s + n.valor, 0);
    // Carteira total = ainda em aberto (não enviados)
    const emAberto = notas.filter((n) => !isEnviado(n));
    return {
      enviar: { qtd: enviar.length, val: sum(enviar) },
      aguardando: { qtd: aguardando.length, val: sum(aguardando) },
      enviados: { qtd: enviados.length, val: sum(enviados) },
      total: sum(emAberto),
    };
  }, [notas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = notas;
    if (filter === "Enviar Cheque") arr = arr.filter(isAEnviar);
    else if (filter === "Aguardando Carga") arr = arr.filter(isAguardando);
    else if (filter === "Enviados") arr = arr.filter(isEnviado);
    if (q) arr = arr.filter((n) => n.fornecedor.toLowerCase().includes(q) || n.nf.toLowerCase().includes(q));
    return arr;
  }, [filter, search, notas]);

  const porFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    notas.filter((n) => !isEnviado(n)).forEach((n) => m.set(n.fornecedor, (m.get(n.fornecedor) || 0) + n.valor));
    return Array.from(m, ([fornecedor, valor]) => ({ fornecedor, valor })).sort((a, b) => b.valor - a.valor);
  }, [notas]);

  const pieData = [
    { name: "Enviar Cheque", value: totals.enviar.val, color: "#FF9F43" },
    { name: "Aguardando Carga", value: totals.aguardando.val, color: "#58A6FF" },
  ];

  const enviarCount = totals.enviar.qtd;

  return (
    <div className="space-y-6">
      {/* Alerta */}
      {enviarCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange/40 bg-orange-dim p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
          <div>
            <div className="font-semibold text-orange">
              {enviarCount} NF{enviarCount > 1 ? "s" : ""} com cheque a enviar
            </div>
            <div className="text-sm text-soft-foreground">
              Total de {brl(totals.enviar.val)} pronto para repasse pois essas cargas já chegaram.
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <KpiCard label="Cheque a Enviar" value={brl(totals.enviar.val)} hint={`${totals.enviar.qtd} notas`} explain="Cheques prontos para mandar ao fornecedor." tone="orange" icon={<Send className="h-4 w-4" />} />
        <KpiCard label="Aguardando Carga" value={brl(totals.aguardando.val)} hint={`${totals.aguardando.qtd} notas`} explain="Mercadoria ainda não chegou." tone="blue" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Total Carteira" value={brl(totals.total)} hint={`${notas.length - totals.enviados.qtd} em aberto`} explain="Soma do que ainda está em aberto." tone="green" icon={<Wallet className="h-4 w-4" />} />
      </div>

      {/* Charts - desktop só */}
      <div className="hidden lg:grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-3 text-sm font-semibold text-foreground">Valor por fornecedor</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porFornecedor} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid stroke="#2D3748" vertical={false} />
              <XAxis dataKey="fornecedor" stroke="#8B949E" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="#8B949E" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#1C2330", border: "1px solid #2D3748", borderRadius: 12, color: "#E6EDF3" }} formatter={(v: number) => brl(v)} />
              <Bar dataKey="valor" fill="#F0B429" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 text-sm font-semibold text-foreground">Distribuição</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="#161B22" strokeWidth={2} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1C2330", border: "1px solid #2D3748", borderRadius: 12, color: "#E6EDF3" }} formatter={(v: number) => brl(v)} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#C9D1D9" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filtros + busca */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor ou nº NF..."
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform transition-colors duration-150 active:scale-95 ${
                filter === f ? "bg-gold text-background" : "bg-surface text-soft-foreground hover:bg-border/40"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isMobile ? (
        <div className="space-y-2">
          {filtered.map((n) => (
            <NfCard
              key={n.id}
              n={n}
              canWrite={canEdit}
              onEdit={() => onEdit?.("nf", n.id)}
              onDelete={() => removeNota(n.id)}
              onConfirmarEnvio={() => setConfirmTarget({ id: n.id, fornecedor: n.fornecedor, valor: n.valor })}
              confirmando={confirmandoEnvioId === n.id}
            />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma nota neste filtro.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">NF</th>
                  <th className="px-4 py-3 font-medium">Filial</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Entrega</th>
                  <th className="px-4 py-3 font-medium">Cheque</th>
                  {canEdit && <th className="px-4 py-3 font-medium">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const aEnviar = isAEnviar(n);
                  const enviado = isEnviado(n);
                  return (
                    <tr key={n.id} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                      <td className="px-4 py-3 font-medium text-foreground">{n.fornecedor}</td>
                      <td className="px-4 py-3 text-soft-foreground">{n.nf}</td>
                      <td className="px-4 py-3 text-muted-foreground">{n.filial}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{brl(n.valor)}</td>
                      <td className="px-4 py-3 text-xs text-soft-foreground">{n.entrega}</td>
                      <td className="px-4 py-3">
                        {enviado ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-green-dim px-2 py-0.5 text-xs font-bold text-green">
                            <CheckCircle2 className="h-3 w-3" /> Enviado {fmtDate(n.chequeEnviadoEm)}
                          </span>
                        ) : aEnviar ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-orange-dim px-2 py-0.5 text-xs font-bold text-orange">
                            <Send className="h-3 w-3" /> ENVIAR CHEQUE
                          </span>
                        ) : (
                          <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                            Aguardando Carga
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          {aEnviar && (
                            <button
                              onClick={() => setConfirmTarget({ id: n.id, fornecedor: n.fornecedor, valor: n.valor })}
                              disabled={confirmandoEnvioId === n.id}
                              className="inline-flex items-center gap-1 rounded-md bg-orange px-2.5 py-1.5 text-xs font-bold text-background transition-transform transition-colors duration-150 hover:bg-orange/90 active:scale-95 disabled:opacity-60"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {confirmandoEnvioId === n.id ? "Enviando..." : "Confirmar envio"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma nota neste filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio do cheque?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget && (
                <>
                  Confirmar envio do cheque para <strong>{confirmTarget.fornecedor}</strong> — <strong>{brl(confirmTarget.valor)}</strong>?
                  <br />
                  Esta ação dá baixa automática no caixa de hoje.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="active:scale-95 transition-transform">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTarget) confirmarEnvio(confirmTarget.id);
                setConfirmTarget(null);
              }}
              className="bg-orange text-background hover:bg-orange/90 active:scale-95 transition-transform"
            >
              Confirmar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
