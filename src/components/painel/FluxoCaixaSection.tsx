import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { useStore } from "@/data/store";
import { buildFluxo, fmtDataBR, type FluxoMovimento, type Granularidade } from "@/lib/fluxo-caixa";
import { buildFluxoCaixaWorkbook } from "@/lib/excel-fluxo-caixa";

type Visao = "periodo" | "fornecedor";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.id
              ? "bg-card text-gold ring-1 ring-gold/40"
              : "text-soft-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MovimentoLinha({ m }: { m: FluxoMovimento }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-soft-foreground">
          <span className="font-semibold text-foreground">{m.dataBR.slice(0, 5)}</span>
          {m.saida > 0 ? (
            <span className="truncate">→ {m.destino ?? "Sem destino"}</span>
          ) : (
            <span>Entrada de cheques</span>
          )}
          {m.automatico && (
            <span className="inline-flex items-center gap-0.5 rounded bg-orange-dim px-1 py-0.5 text-[9px] font-bold text-orange">
              <Zap className="h-2.5 w-2.5" /> AUTO
            </span>
          )}
        </div>
        {m.nfs.length > 0 && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            NF{m.nfs.length > 1 ? "s" : ""} {m.nfs.map((n) => n.nf).join(", ")}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right font-semibold">
        {m.entrada > 0 && <div className="text-blue">+{brl(m.entrada)}</div>}
        {m.saida > 0 && <div className="text-red">−{brl(m.saida)}</div>}
      </div>
    </div>
  );
}

export function FluxoCaixaSection() {
  const { caixa, notas } = useStore();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [granularidade, setGranularidade] = useState<Granularidade>("semana");
  const [visao, setVisao] = useState<Visao>("periodo");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showExportForm, setShowExportForm] = useState(false);
  const [expFrom, setExpFrom] = useState("");
  const [expTo, setExpTo] = useState("");
  const [expGranularidade, setExpGranularidade] = useState<Granularidade>("mes");

  const fx = useMemo(
    () => buildFluxo(caixa, notas, { from: from || undefined, to: to || undefined, granularidade }),
    [caixa, notas, from, to, granularidade],
  );

  const toggle = (key: string) =>
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const fxExport = useMemo(
    () =>
      showExportForm
        ? buildFluxo(caixa, notas, {
            from: expFrom || undefined,
            to: expTo || undefined,
            granularidade: expGranularidade,
          })
        : null,
    [showExportForm, caixa, notas, expFrom, expTo, expGranularidade],
  );

  const abrirExportForm = () => {
    if (showExportForm) {
      setShowExportForm(false);
      return;
    }
    // Começa com o que está filtrado na tela
    setExpFrom(from);
    setExpTo(to);
    setExpGranularidade(granularidade);
    setShowExportForm(true);
  };

  const aplicarAtalho = (atalho: "mes" | "mes_anterior" | "30d" | "ano") => {
    const hoje = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const y = hoje.getFullYear();
    const m = hoje.getMonth();
    if (atalho === "mes") {
      setExpFrom(iso(new Date(y, m, 1)));
      setExpTo(iso(new Date(y, m + 1, 0)));
    } else if (atalho === "mes_anterior") {
      setExpFrom(iso(new Date(y, m - 1, 1)));
      setExpTo(iso(new Date(y, m, 0)));
    } else if (atalho === "30d") {
      setExpFrom(iso(new Date(y, m, hoje.getDate() - 29)));
      setExpTo(iso(hoje));
    } else {
      setExpFrom(iso(new Date(y, 0, 1)));
      setExpTo(iso(new Date(y, 11, 31)));
    }
  };

  const exportar = async () => {
    if (!fxExport?.movimentos.length) {
      toast.error("Nenhum movimento no período selecionado");
      return;
    }
    setShowExportForm(false);
    setExporting(true);
    try {
      const blob = await buildFluxoCaixaWorkbook(fxExport);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ley_FluxoCaixa_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha exportada com sucesso");
    } catch (e) {
      toast.error("Erro ao exportar planilha");
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const { totais: t, projecao: p } = fx;
  // Períodos mais recentes primeiro na tela
  const periodos = [...fx.periodos].reverse();

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Cabeçalho + filtros */}
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">Fluxo de caixa</div>
          <button
            type="button"
            onClick={abrirExportForm}
            disabled={exporting || !caixa.length}
            title="Exportar planilha Excel do fluxo de caixa (DFC)"
            className={`inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
              showExportForm
                ? "border-gold/60 text-gold"
                : "border-border text-soft-foreground hover:border-gold/40 hover:text-gold"
            }`}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            {exporting ? "Gerando…" : "Exportar Excel"}
          </button>
        </div>

        {/* ── Painel de período para exportação ─────────────────────────────── */}
        {showExportForm && !exporting && fxExport && (
          <div className="space-y-4 rounded-xl border border-gold/30 bg-surface/40 p-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Período da DFC
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["mes", "Este mês"],
                    ["mes_anterior", "Mês passado"],
                    ["30d", "Últimos 30 dias"],
                    ["ano", "Este ano"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => aplicarAtalho(id)}
                    className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-soft-foreground hover:border-gold/40 hover:text-gold"
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setExpFrom("");
                    setExpTo("");
                  }}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-soft-foreground hover:border-gold/40 hover:text-gold"
                >
                  Tudo
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">De</span>
                  <input
                    type="date"
                    value={expFrom}
                    onChange={(e) => setExpFrom(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-muted-foreground">Até</span>
                  <input
                    type="date"
                    value={expTo}
                    onChange={(e) => setExpTo(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-border/50" />

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Colunas da DFC
              </p>
              <Segmented
                value={expGranularidade}
                onChange={setExpGranularidade}
                options={[
                  { id: "dia", label: "Por dia" },
                  { id: "semana", label: "Por semana" },
                  { id: "mes", label: "Por mês" },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-soft-foreground">
                {fxExport.movimentos.length} movimento{fxExport.movimentos.length === 1 ? "" : "s"}{" "}
                · {fxExport.periodos.length} coluna{fxExport.periodos.length === 1 ? "" : "s"} ·
                saldo {brl(fxExport.totais.saldoInicial)} → {brl(fxExport.totais.saldoFinal)}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowExportForm(false)}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-soft-foreground transition-colors hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={exportar}
                  disabled={fxExport.movimentos.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-background transition-colors hover:bg-gold/90 disabled:opacity-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Gerar planilha
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto">
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">De</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">Até</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <Segmented
            value={visao}
            onChange={setVisao}
            options={[
              { id: "periodo", label: "Por período" },
              { id: "fornecedor", label: "Por fornecedor" },
            ]}
          />
          {visao === "periodo" && (
            <Segmented
              value={granularidade}
              onChange={setGranularidade}
              options={[
                { id: "dia", label: "Dia" },
                { id: "semana", label: "Semana" },
                { id: "mes", label: "Mês" },
              ]}
            />
          )}
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="pb-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Limpar período
            </button>
          )}
        </div>
      </div>

      {/* Resumo realizado + projeção */}
      <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-2">
        <div className="rounded-lg bg-surface/60 p-3 text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Realizado {from || to ? "no período" : "(todo o histórico)"}
          </div>
          <Linha label="Saldo inicial" value={brl(t.saldoInicial)} />
          <Linha label="(+) Entradas" value={brl(t.entradas)} cls="text-blue" />
          <Linha label="(−) Saídas" value={brl(t.saidas)} cls="text-red" />
          <Linha label="(=) Saldo final" value={brl(t.saldoFinal)} cls="text-green" strong />
        </div>
        <div className="rounded-lg bg-surface/60 p-3 text-sm">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Projeção — o que ainda vai sair
          </div>
          <Linha label="Saldo em caixa hoje" value={brl(p.saldoAtual)} />
          <Linha
            label={`(−) Separadas p/ envio · ${p.separadas.qtd} NF`}
            value={brl(p.separadas.valor)}
            cls="text-red"
          />
          <Linha
            label={`(−) Chegaram, a enviar · ${p.aEnviar.qtd} NF`}
            value={brl(p.aEnviar.valor)}
            cls="text-red"
          />
          <Linha
            label="(=) Após pagar o que chegou"
            value={brl(p.saldoAposChegadas)}
            cls={p.saldoAposChegadas >= 0 ? "text-green" : "text-red"}
            strong
          />
          <Linha
            label={`(−) Carga não chegou · ${p.aguardando.qtd} NF`}
            value={brl(p.aguardando.valor)}
            cls="text-orange"
          />
          <Linha
            label="(=) Após pagar toda a carteira"
            value={brl(p.saldoAposCarteira)}
            cls={p.saldoAposCarteira >= 0 ? "text-green" : "text-red"}
            strong
          />
        </div>
      </div>

      {/* Lista */}
      {!fx.movimentos.length ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhum movimento no período selecionado.
        </div>
      ) : visao === "periodo" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
                  Saldo inicial
                </th>
                <th className="px-4 py-3 text-right font-medium">Entradas</th>
                <th className="px-4 py-3 text-right font-medium">Saídas</th>
                <th className="px-4 py-3 text-right font-medium">Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {periodos.map((per) => {
                const open = abertos.has(per.key);
                return (
                  <Fragment key={per.key}>
                    <tr
                      onClick={() => toggle(per.key)}
                      className="cursor-pointer border-b border-border/50 hover:bg-surface/50"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1">
                          {open ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {per.label}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-right text-soft-foreground sm:table-cell">
                        {brl(per.saldoInicial)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue">
                        {per.entradas > 0 ? brl(per.entradas) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red">
                        {per.saidas > 0 ? brl(per.saidas) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green">
                        {brl(per.saldoFinal)}
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-border/50 bg-surface/40">
                        <td colSpan={5} className="divide-y divide-border/40 px-4 py-2 sm:pl-9">
                          {per.movimentos.map((m) => (
                            <MovimentoLinha key={m.id} m={m} />
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !fx.fornecedores.length ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma saída no período selecionado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 text-center font-medium">Envios</th>
                <th className="hidden px-4 py-3 text-center font-medium sm:table-cell">Último</th>
                <th className="px-4 py-3 text-right font-medium">Total saído</th>
              </tr>
            </thead>
            <tbody>
              {fx.fornecedores.map((f) => {
                const key = `f:${f.fornecedor}`;
                const open = abertos.has(key);
                return (
                  <Fragment key={key}>
                    <tr
                      onClick={() => toggle(key)}
                      className="cursor-pointer border-b border-border/50 hover:bg-surface/50"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1">
                          {open ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          {f.fornecedor}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-soft-foreground">{f.envios}</td>
                      <td className="hidden px-4 py-3 text-center text-soft-foreground sm:table-cell">
                        {fmtDataBR(f.ultimoEnvio).slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red">{brl(f.total)}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-border/50 bg-surface/40">
                        <td colSpan={4} className="divide-y divide-border/40 px-4 py-2 sm:pl-9">
                          {[...f.movimentos].reverse().map((m) => (
                            <MovimentoLinha key={m.id} m={m} />
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Linha({
  label,
  value,
  cls = "text-foreground",
  strong = false,
}: {
  label: string;
  value: string;
  cls?: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-0.5 ${strong ? "border-t border-border/60 pt-1.5 mt-1" : ""}`}
    >
      <span className="text-soft-foreground">{label}</span>
      <span className={`whitespace-nowrap ${strong ? "font-bold" : "font-semibold"} ${cls}`}>
        {value}
      </span>
    </div>
  );
}
