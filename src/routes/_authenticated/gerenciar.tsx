import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useStore, type NFRecord, type CaixaRecord } from "@/data/store";
import { brl } from "@/lib/format";
import { isEnviar } from "@/data/painel";

export const Route = createFileRoute("/gerenciar")({
  head: () => ({
    meta: [
      { title: "Gerenciar · Painel de Cheques" },
      { name: "description", content: "Cadastro e edição de notas fiscais e movimentos de caixa." },
    ],
  }),
  component: GerenciarPage,
});

type Tab = "nfs" | "caixa";

function GerenciarPage() {
  const [tab, setTab] = useState<Tab>("nfs");

  return (
    <div className="min-h-screen bg-background">
      <header className="header-gradient sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
              ◆ Gerenciamento
            </div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Cadastros</h1>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-soft-foreground hover:text-gold hover:border-gold/40 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao painel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {([
            { id: "nfs", label: "Notas Fiscais" },
            { id: "caixa", label: "Movimentos de Caixa" },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-card text-gold ring-1 ring-gold/40"
                  : "text-soft-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {tab === "nfs" ? <NotasManager /> : <CaixaManager />}
      </main>
    </div>
  );
}

/* ------------- NFs ------------- */

const emptyNota = {
  fornecedor: "",
  nf: "",
  filial: "MATRIZ",
  valor: 0,
  statusNf: "FATURADO",
  entrega: "NÃO CHEGOU",
};

function NotasManager() {
  const { notas, addNota, updateNota, removeNota } = useStore();
  const [editing, setEditing] = useState<NFRecord | "new" | null>(null);

  const initial = editing === "new" || editing === null ? emptyNota : editing;

  const handleSubmit = (data: typeof emptyNota) => {
    if (editing === "new") addNota(data);
    else if (editing) updateNota(editing.id, data);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Notas fiscais <span className="text-muted-foreground">({notas.length})</span>
        </h2>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background hover:bg-gold/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Nova NF
        </button>
      </div>

      {editing !== null && (
        <NotaForm
          key={editing === "new" ? "new" : editing.id}
          initial={initial}
          onCancel={() => setEditing(null)}
          onSave={handleSubmit}
        />
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">NF</th>
                <th className="px-4 py-3 font-medium">Filial</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Entrega</th>
                <th className="px-4 py-3 font-medium">Cheque</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => {
                const enviar = isEnviar(n);
                return (
                  <tr key={n.id} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-foreground">{n.fornecedor}</td>
                    <td className="px-4 py-3 text-soft-foreground">{n.nf}</td>
                    <td className="px-4 py-3 text-muted-foreground">{n.filial}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{brl(n.valor)}</td>
                    <td className="px-4 py-3 text-xs text-soft-foreground">{n.statusNf}</td>
                    <td className="px-4 py-3 text-xs text-soft-foreground">{n.entrega}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                        enviar ? "bg-orange-dim text-orange" : "bg-surface text-muted-foreground ring-1 ring-border"
                      }`}>
                        {enviar ? "ENVIAR" : "Esp."}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditing(n)}
                          className="rounded-md p-1.5 text-blue hover:bg-blue-dim transition-colors"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => confirm(`Remover NF ${n.nf}?`) && removeNota(n.id)}
                          className="rounded-md p-1.5 text-red hover:bg-red-dim transition-colors"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {notas.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma NF cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NotaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: typeof emptyNota;
  onSave: (d: typeof emptyNota) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.fornecedor.trim() || !form.nf.trim() || form.valor <= 0) return;
        onSave({
          ...form,
          fornecedor: form.fornecedor.trim().slice(0, 80),
          nf: form.nf.trim().slice(0, 20),
          filial: form.filial.trim().slice(0, 30),
          statusNf: form.statusNf.trim().slice(0, 20),
          entrega: form.entrega.trim().slice(0, 40),
        });
      }}
      className="rounded-xl border border-gold/40 bg-card p-4 space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Fornecedor">
          <input value={form.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} maxLength={80} required className={inputCls} />
        </Field>
        <Field label="Número NF">
          <input value={form.nf} onChange={(e) => set("nf", e.target.value)} maxLength={20} required className={inputCls} />
        </Field>
        <Field label="Filial">
          <select value={form.filial} onChange={(e) => set("filial", e.target.value)} className={inputCls}>
            {["MATRIZ", "FILIAL", "CARGA", "—"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Valor (R$)">
          <input
            type="number" step="0.01" min="0"
            value={form.valor || ""}
            onChange={(e) => set("valor", Number(e.target.value))}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Status da NF">
          <select value={form.statusNf} onChange={(e) => set("statusNf", e.target.value)} className={inputCls}>
            {["FATURADO", "CHEGOU"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Entrega">
          <input
            value={form.entrega}
            onChange={(e) => set("entrega", e.target.value)}
            maxLength={40}
            placeholder="Ex.: CHEGOU 01/06 ou NÃO CHEGOU"
            className={inputCls}
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-soft-foreground hover:text-foreground">
          <X className="h-4 w-4" /> Cancelar
        </button>
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background hover:bg-gold/90">
          <Save className="h-4 w-4" /> Salvar
        </button>
      </div>
    </form>
  );
}

/* ------------- Caixa ------------- */

const emptyCaixa = {
  data: "",
  saldoAnterior: 0,
  entrada: 0,
  saida: 0,
  saldoTotal: 0,
  destino: "",
};

function CaixaManager() {
  const { caixa, addCaixa, updateCaixa, removeCaixa } = useStore();
  const [editing, setEditing] = useState<CaixaRecord | "new" | null>(null);

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
  const lastSaldo = caixa.length ? caixa[caixa.length - 1].saldoTotal : 0;

  const initial =
    editing === "new"
      ? { ...emptyCaixa, data: todayStr, saldoAnterior: lastSaldo, saldoTotal: lastSaldo }
      : editing === null
      ? emptyCaixa
      : { ...editing, destino: editing.destino ?? "" };

  const handleSubmit = (data: typeof emptyCaixa) => {
    const payload = { ...data, destino: data.destino.trim() || undefined };
    if (editing === "new") addCaixa(payload);
    else if (editing) updateCaixa(editing.id, payload);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          Movimentos do caixa <span className="text-muted-foreground">({caixa.length})</span>
        </h2>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background hover:bg-gold/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo dia
        </button>
      </div>

      {editing !== null && (
        <CaixaForm
          key={editing === "new" ? "new" : editing.id}
          initial={initial}
          onCancel={() => setEditing(null)}
          onSave={handleSubmit}
        />
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 text-right font-medium">Saldo Ant.</th>
                <th className="px-4 py-3 text-right font-medium">Entrada</th>
                <th className="px-4 py-3 text-right font-medium">Saída</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {caixa.map((c) => (
                <tr key={c.id} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold text-foreground">{c.data}</td>
                  <td className="px-4 py-3 text-right text-soft-foreground">{brl(c.saldoAnterior)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue">{c.entrada > 0 ? brl(c.entrada) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red">{c.saida > 0 ? brl(c.saida) : "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-green">{brl(c.saldoTotal)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.destino ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(c)} className="rounded-md p-1.5 text-blue hover:bg-blue-dim" aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => confirm(`Remover dia ${c.data}?`) && removeCaixa(c.id)} className="rounded-md p-1.5 text-red hover:bg-red-dim" aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {caixa.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum movimento cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CaixaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: typeof emptyCaixa;
  onSave: (d: typeof emptyCaixa) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Cálculo automático do saldo total
  const totalCalc = form.saldoAnterior + form.entrada - form.saida;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.data.trim()) return;
        onSave({
          ...form,
          data: form.data.trim().slice(0, 10),
          destino: form.destino.trim().slice(0, 100),
          saldoTotal: totalCalc,
        });
      }}
      className="rounded-xl border border-gold/40 bg-card p-4 space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Data (DD/MM)">
          <input value={form.data} onChange={(e) => set("data", e.target.value)} placeholder="01/06" maxLength={10} required className={inputCls} />
        </Field>
        <Field label="Saldo anterior (R$)">
          <input type="number" step="0.01" min="0" value={form.saldoAnterior || ""} onChange={(e) => set("saldoAnterior", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Entrada (R$)">
          <input type="number" step="0.01" min="0" value={form.entrada || ""} onChange={(e) => set("entrada", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Saída (R$)">
          <input type="number" step="0.01" min="0" value={form.saida || ""} onChange={(e) => set("saida", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Destino da saída">
          <input value={form.destino} onChange={(e) => set("destino", e.target.value)} maxLength={100} placeholder="Ex.: Atualle + Nobeltex" className={inputCls} />
        </Field>
        <Field label="Saldo total (calculado)">
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-bold text-green">
            {brl(totalCalc)}
          </div>
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-soft-foreground hover:text-foreground">
          <X className="h-4 w-4" /> Cancelar
        </button>
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background hover:bg-gold/90">
          <Save className="h-4 w-4" /> Salvar
        </button>
      </div>
    </form>
  );
}

/* ------------- Helpers ------------- */

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
