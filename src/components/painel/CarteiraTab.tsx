import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  AlertTriangle, Send, Clock, Wallet, Search, CheckCircle2,
  PackageCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import { isAEnviar, isAguardando, isEnviado, isSeparado, isAConfirmarEnvio } from "@/data/painel";
import { useStore } from "@/data/store";
import { brl, parseBrlInput, formatBrlInput } from "@/lib/format";
import { KpiCard } from "./KpiCard";
import { NfCard } from "./NfCard";
import { useRoles } from "@/hooks/use-role";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const FILTERS = ["Todas", "Em Carteira", "Separado p/ Envio", "Aguardando Carga", "Enviados"] as const;
type Filter = (typeof FILTERS)[number];

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Card de envio agrupado por fornecedor — seleciona NFs e digita valor real enviado */
function EnvioFornecedorCard({
  fornecedor,
  nfs,
  onEnviar,
  isEnviando,
}: {
  fornecedor: string;
  nfs: { id: string; nf: string; valor: number }[];
  onEnviar: (nfIds: string[], valorEnviado: number) => void;
  isEnviando: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(nfs.map((n) => n.id)));
  const [valorStr, setValorStr] = useState("");

  const somaSelecionadas = nfs
    .filter((n) => selecionadas.has(n.id))
    .reduce((s, n) => s + n.valor, 0);
  const valorEnviado = parseBrlInput(valorStr);
  const diff = valorEnviado - somaSelecionadas;

  const toggle = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnviar = () => {
    if (selecionadas.size === 0) return;
    const valor = valorEnviado > 0 ? valorEnviado : somaSelecionadas;
    onEnviar(Array.from(selecionadas), valor);
  };

  return (
    <div className="rounded-xl border border-blue/40 bg-card">
      <button
        className="flex w-full items-center justify-between gap-3 px-4 py-3"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <PackageCheck className="h-4 w-4 shrink-0 text-blue" />
          <span className="truncate text-sm font-semibold text-foreground">{fornecedor}</span>
          <span className="rounded-full bg-blue-dim px-2 py-0.5 text-[11px] font-bold text-blue">
            {nfs.length} NF{nfs.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-bold text-foreground">{brl(somaSelecionadas)}</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 space-y-3">
          {/* Checkboxes por NF */}
          <div className="space-y-2 pt-3">
            {nfs.map((n) => (
              <label key={n.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selecionadas.has(n.id)}
                  onChange={() => toggle(n.id)}
                  className="h-4 w-4 rounded border-border accent-blue"
                />
                <span className="flex-1 text-sm text-soft-foreground">NF {n.nf}</span>
                <span className="text-sm font-semibold text-foreground">{brl(n.valor)}</span>
              </label>
            ))}
          </div>

          {/* Valor enviado */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Valor real enviado (R$)
            </label>
            <input
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              inputMode="decimal"
              placeholder={formatBrlInput(somaSelecionadas) || "0,00"}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
            {valorEnviado > 0 && (
              <div className={`text-[11px] ${diff === 0 ? "text-green" : diff > 0 ? "text-blue" : "text-orange"}`}>
                {diff === 0
                  ? "✓ Valor igual à soma das NFs"
                  : diff > 0
                    ? `+${brl(diff)} a mais que a soma`
                    : `${brl(Math.abs(diff))} a menos que a soma`}
              </div>
            )}
          </div>

          <button
            onClick={handleEnviar}
            disabled={isEnviando || selecionadas.size === 0}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-green px-3 py-2.5 text-sm font-bold text-background hover:bg-green/90 active:scale-95 disabled:opacity-60 transition-all"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isEnviando ? "Registrando saída..." : "Registrar saída de cheque"}
          </button>
        </div>
      )}
    </div>
  );
}

export function CarteiraTab({
  onEdit,
  readOnly = false,
}: {
  onEdit?: (kind: "nf", id: string) => void;
  readOnly?: boolean;
}) {
  const { notas, removeNota, separarNf, cancelarSeparacao, enviarCheque, isSeparandoNf, isCancelando, isEnviandoCheque } = useStore();
  const { canWriteNf } = useRoles();
  const canEdit = !readOnly && canWriteNf;
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<Filter>("Todas");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fornecedor: string; valor: number } | null>(null);

  const totals = useMemo(() => {
    const emCarteira  = notas.filter(isAEnviar);
    const separados   = notas.filter(isSeparado);
    const aguardando  = notas.filter(isAguardando);
    const enviados    = notas.filter(isEnviado);
    const sum = (arr: typeof notas) => arr.reduce((s, n) => s + n.valor, 0);
    const emAberto    = notas.filter((n) => !isEnviado(n));
    return {
      emCarteira:  { qtd: emCarteira.length,  val: sum(emCarteira) },
      separados:   { qtd: separados.length,   val: sum(separados) },
      aguardando:  { qtd: aguardando.length,  val: sum(aguardando) },
      enviados:    { qtd: enviados.length,    val: sum(enviados) },
      total:       sum(emAberto),
    };
  }, [notas]);

  // Grupos de fornecedores separados — para o painel de envio
  const gruposEnviar = useMemo(() => {
    const map = new Map<string, { id: string; nf: string; valor: number }[]>();
    notas.filter(isAConfirmarEnvio).forEach((n) => {
      const arr = map.get(n.fornecedor) ?? [];
      arr.push({ id: n.id, nf: n.nf, valor: n.valor });
      map.set(n.fornecedor, arr);
    });
    return Array.from(map.entries());
  }, [notas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr: typeof notas;
    if (filter === "Enviados")           arr = notas.filter(isEnviado);
    else if (filter === "Em Carteira")   arr = notas.filter(isAEnviar);
    else if (filter === "Separado p/ Envio") arr = notas.filter(isSeparado);
    else if (filter === "Aguardando Carga")  arr = notas.filter(isAguardando);
    else                                     arr = notas.filter((n) => !isEnviado(n));
    if (q) arr = arr.filter((n) => n.fornecedor.toLowerCase().includes(q) || n.nf.toLowerCase().includes(q));
    return arr;
  }, [filter, search, notas]);

  const porFornecedor = useMemo(() => {
    const m = new Map<string, number>();
    notas.filter((n) => !isEnviado(n)).forEach((n) => m.set(n.fornecedor, (m.get(n.fornecedor) || 0) + n.valor));
    return Array.from(m, ([fornecedor, valor]) => ({ fornecedor, valor })).sort((a, b) => b.valor - a.valor);
  }, [notas]);

  const pieData = [
    { name: "Em Carteira",  value: totals.emCarteira.val,  color: "#F0B429" },
    { name: "Separado",     value: totals.separados.val,   color: "#58A6FF" },
    { name: "Aguardando",   value: totals.aguardando.val,  color: "#8B949E" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Alerta de NFs prontas */}
      {totals.emCarteira.qtd > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange/40 bg-orange-dim p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
          <div>
            <div className="font-semibold text-orange">
              {totals.emCarteira.qtd} NF{totals.emCarteira.qtd > 1 ? "s" : ""} aguardando separação
            </div>
            <div className="text-sm text-soft-foreground">
              {brl(totals.emCarteira.val)} prontos para separar e enviar cheque.
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Em Carteira"   value={brl(totals.emCarteira.val)} hint={`${totals.emCarteira.qtd} prontas`}  explain="NFs chegadas, cheque ainda não separado." tone="orange" icon={<Send className="h-4 w-4" />} />
        <KpiCard label="Separado p/ Envio" value={brl(totals.separados.val)} hint={`${totals.separados.qtd} separadas`} explain="Reservadas para baixa em uma saída de cheque." tone="blue" icon={<PackageCheck className="h-4 w-4" />} />
        <KpiCard label="Aguardando Carga"  value={brl(totals.aguardando.val)} hint={`${totals.aguardando.qtd} notas`} explain="Mercadoria ainda não chegou." tone="gold" icon={<Clock className="h-4 w-4" />} />
        <KpiCard label="Total Carteira"    value={brl(totals.total)}          hint={`${notas.length - totals.enviados.qtd} em aberto`} explain="Soma do que ainda está em aberto." tone="green" icon={<Wallet className="h-4 w-4" />} />
      </div>

      {/* Painel de envio — fornecedores separados */}
      {canEdit && gruposEnviar.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-blue" />
            Separados para envio — registre a saída por fornecedor
          </div>
          {gruposEnviar.map(([fornecedor, nfs]) => (
            <EnvioFornecedorCard
              key={fornecedor}
              fornecedor={fornecedor}
              nfs={nfs}
              onEnviar={(nfIds, valorEnviado) => enviarCheque({ nfIds, fornecedor, valorEnviado })}
              isEnviando={isEnviandoCheque}
            />
          ))}
        </div>
      )}

      {/* Charts — desktop */}
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
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
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
              onDelete={() => setDeleteTarget({ id: n.id, fornecedor: n.fornecedor, valor: n.valor })}
              onSeparar={isAEnviar(n) ? () => separarNf(n.id) : undefined}
              onCancelarSeparacao={isAConfirmarEnvio(n) ? () => cancelarSeparacao(n.id) : undefined}
              separando={isSeparandoNf === n.id}
              cancelando={isCancelando === n.id}
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
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canEdit && <th className="px-4 py-3 font-medium">Ação</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => {
                  const aEnviar    = isAEnviar(n);
                  const separado   = isSeparado(n);
                  const aConfirmar = isAConfirmarEnvio(n);
                  const enviado    = isEnviado(n);
                  return (
                    <tr key={n.id} className={`border-b border-border/50 last:border-0 hover:bg-surface/50 ${separado ? "bg-blue-dim/10" : ""}`}>
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
                        ) : separado ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-dim px-2 py-0.5 text-xs font-bold text-blue">
                            <PackageCheck className="h-3 w-3" /> Separado
                          </span>
                        ) : aEnviar ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-orange-dim px-2 py-0.5 text-xs font-bold text-orange">
                            <Send className="h-3 w-3" /> Em Carteira
                          </span>
                        ) : (
                          <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                            Aguardando Carga
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {aEnviar && (
                              <button
                                onClick={() => separarNf(n.id)}
                                disabled={isSeparandoNf === n.id}
                                className="inline-flex items-center gap-1 rounded-md bg-blue px-2.5 py-1.5 text-xs font-bold text-background hover:bg-blue/90 active:scale-95 disabled:opacity-60 transition-all"
                              >
                                <PackageCheck className="h-3 w-3" />
                                {isSeparandoNf === n.id ? "..." : "Separar"}
                              </button>
                            )}
                            {aConfirmar && (
                              <button
                                onClick={() => cancelarSeparacao(n.id)}
                                disabled={isCancelando === n.id}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-soft-foreground hover:text-red hover:border-red/40 active:scale-95 disabled:opacity-60 transition-all"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {isCancelando === n.id ? "..." : "Cancelar sep."}
                              </button>
                            )}
                          </div>
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

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover nota fiscal?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && <>Remover NF de <strong>{deleteTarget.fornecedor}</strong> — <strong>{brl(deleteTarget.valor)}</strong>? Esta ação não pode ser desfeita.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="active:scale-95">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) removeNota(deleteTarget.id); setDeleteTarget(null); }}
              className="bg-red text-background hover:bg-red/90 active:scale-95"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
