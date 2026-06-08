import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, Users, Search, History, UserPlus, Copy, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useStore, type NFRecord, type CaixaRecord } from "@/data/store";
import { brl } from "@/lib/format";
import { isEnviar } from "@/data/painel";
import { listTeam, setRole, createTeamMember } from "@/lib/api/roles.functions";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/gerenciar")({
  head: () => ({
    meta: [
      { title: "Gerenciar · Painel de Cheques" },
      { name: "description", content: "Cadastro e edição de notas fiscais e movimentos de caixa." },
    ],
  }),
  component: GerenciarPage,
});

type Tab = "nfs" | "caixa" | "time" | "auditoria";

function GerenciarPage() {
  const { isAdmin } = useRoles();
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
        <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1">
          {([
            { id: "nfs", label: "Notas Fiscais" },
            { id: "caixa", label: "Movimentos de Caixa" },
            ...(isAdmin ? [{ id: "time" as const, label: "Time" }] : []),
            ...(isAdmin ? [{ id: "auditoria" as const, label: "Auditoria" }] : []),
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
        {tab === "nfs" && <NotasManager />}
        {tab === "caixa" && <CaixaManager />}
        {tab === "time" && isAdmin && <TeamManager />}
        {tab === "auditoria" && isAdmin && <AuditoriaManager />}
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
  const [search, setSearch] = useState("");
  const [filial, setFilial] = useState<string>("Todas");

  const filiais = useMemo(() => {
    const s = new Set<string>();
    notas.forEach((n) => n.filial && s.add(n.filial));
    return ["Todas", ...Array.from(s).sort()];
  }, [notas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notas.filter((n) => {
      if (filial !== "Todas" && n.filial !== filial) return false;
      if (!q) return true;
      return (
        n.fornecedor.toLowerCase().includes(q) ||
        n.nf.toLowerCase().includes(q)
      );
    });
  }, [notas, search, filial]);

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
          Notas fiscais{" "}
          <span className="text-muted-foreground">
            ({filtered.length}
            {filtered.length !== notas.length ? ` de ${notas.length}` : ""})
          </span>
        </h2>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-card px-3 py-2 text-sm font-semibold text-gold hover:bg-gold-dim transition-colors"
        >
          <Plus className="h-4 w-4" /> Nova NF
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor ou nº NF..."
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          />
        </div>
        <select
          value={filial}
          onChange={(e) => setFilial(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        >
          {filiais.map((f) => (
            <option key={f} value={f}>
              Filial: {f}
            </option>
          ))}
        </select>
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
                <th className="px-4 py-3 font-medium">Entrega</th>
                <th className="px-4 py-3 font-medium">Cheque</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => {
                const enviar = isEnviar(n);
                return (
                  <tr key={n.id} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-medium text-foreground">{n.fornecedor}</td>
                    <td className="px-4 py-3 text-soft-foreground">{n.nf}</td>
                    <td className="px-4 py-3 text-muted-foreground">{n.filial}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{brl(n.valor)}</td>
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
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {notas.length === 0 ? "Nenhuma NF cadastrada." : "Nenhuma NF para esse filtro."}
                </td></tr>
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
          statusNf: "FATURADO",
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
        <Field label="Entrega">
          <select value={form.entrega} onChange={(e) => set("entrega", e.target.value)} className={inputCls}>
            {["NÃO CHEGOU", "CHEGOU"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
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
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return caixa;
    return caixa.filter(
      (c) => c.data.toLowerCase().includes(q) || (c.destino ?? "").toLowerCase().includes(q)
    );
  }, [caixa, search]);

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
          Movimentos do caixa{" "}
          <span className="text-muted-foreground">
            ({filtered.length}
            {filtered.length !== caixa.length ? ` de ${caixa.length}` : ""})
          </span>
        </h2>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-card px-3 py-2 text-sm font-semibold text-gold hover:bg-gold-dim transition-colors"
        >
          <Plus className="h-4 w-4" /> Novo dia
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por data (DD/MM) ou destino..."
          className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
        />
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
              {filtered.map((c) => (
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
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {caixa.length === 0 ? "Nenhum movimento cadastrado." : "Nenhum movimento para essa busca."}
                </td></tr>
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

/* ------------- Time / Papéis ------------- */

const ROLE_LABELS: Record<string, { label: string; hint: string }> = {
  admin: { label: "Admin", hint: "Acesso total + gerencia o time" },
  lancador_nf: { label: "Lançador NF", hint: "Cria/edita notas fiscais" },
  lancador_caixa: { label: "Lançador Caixa", hint: "Cria/edita movimentos de caixa" },
  diretoria: { label: "Diretoria", hint: "Apenas visualização" },
};
const ALL_ROLES = ["admin", "lancador_nf", "lancador_caixa", "diretoria"] as const;

function TeamManager() {
  const listFn = useServerFn(listTeam);
  const setRoleFn = useServerFn(setRole);
  const qc = useQueryClient();

  const { data: team, isLoading, error } = useQuery({
    queryKey: ["team"],
    queryFn: () => listFn(),
  });

  const mut = useMutation({
    mutationFn: (vars: { userId: string; role: typeof ALL_ROLES[number]; enabled: boolean }) =>
      setRoleFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success("Papel atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Users className="h-5 w-5 text-gold" /> Time
          <span className="text-muted-foreground">({team?.length ?? 0})</span>
        </h2>
      </div>

      <NewUserForm onCreated={() => qc.invalidateQueries({ queryKey: ["team"] })} />

      {isLoading && <div className="text-sm text-muted-foreground">Carregando time...</div>}
      {error && <div className="text-sm text-red">{(error as Error).message}</div>}

      {team && (
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  {ALL_ROLES.map((r) => (
                    <th key={r} className="px-3 py-3 text-center font-medium">
                      <div>{ROLE_LABELS[r].label}</div>
                      <div className="font-normal normal-case text-[10px] text-muted-foreground/80">
                        {ROLE_LABELS[r].hint}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((u) => (
                  <tr key={u.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{u.displayName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    {ALL_ROLES.map((r) => {
                      const has = u.roles.includes(r);
                      return (
                        <td key={r} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={has}
                            disabled={mut.isPending}
                            onChange={(e) =>
                              mut.mutate({ userId: u.id, role: r, enabled: e.target.checked })
                            }
                            className="h-5 w-5 cursor-pointer accent-gold"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {team.length === 0 && (
                  <tr>
                    <td colSpan={ALL_ROLES.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum usuário cadastrado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NewUserForm({ onCreated }: { onCreated: () => void }) {
  const createFn = useServerFn(createTeamMember);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(["diretoria"]);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  const toggleRole = (r: string) =>
    setRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let out = "";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    for (let i = 0; i < arr.length; i++) out += chars[arr[i] % chars.length];
    setPassword(out);
  };

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          email: email.trim(),
          password,
          displayName: displayName.trim() || undefined,
          roles: roles as ("admin" | "lancador_nf" | "lancador_caixa" | "diretoria")[],
        },
      }),
    onSuccess: () => {
      toast.success("Usuário criado");
      setLastCreated({ email: email.trim(), password });
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRoles(["diretoria"]);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => { setOpen(true); setLastCreated(null); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-card px-3 py-2 text-sm font-semibold text-gold hover:bg-gold-dim transition-colors"
        >
          <UserPlus className="h-4 w-4" /> Adicionar usuário
        </button>
        {lastCreated && (
          <div className="rounded-xl border border-green/40 bg-green-dim/40 p-4 text-sm">
            <div className="mb-2 font-semibold text-green">Usuário criado — anote a senha:</div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-foreground">
              <span>{lastCreated.email}</span>
              <span>·</span>
              <span>{lastCreated.password}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${lastCreated.email} / ${lastCreated.password}`);
                  toast.success("Copiado");
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-soft-foreground hover:text-gold"
              >
                <Copy className="h-3 w-3" /> Copiar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const canSubmit = email.trim().length > 3 && password.length >= 8 && roles.length > 0 && !mut.isPending;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (canSubmit) mut.mutate(); }}
      className="rounded-xl border border-gold/40 bg-card p-4 space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-gold">
        <UserPlus className="h-4 w-4" /> Novo usuário
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required maxLength={255} autoComplete="off" className={inputCls}
          />
        </Field>
        <Field label="Nome para exibição (opcional)">
          <input
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80} className={inputCls}
          />
        </Field>
        <Field label="Senha (mín. 8 caracteres)">
          <div className="flex gap-2">
            <input
              type="text" value={password} onChange={(e) => setPassword(e.target.value)}
              minLength={8} maxLength={72} required autoComplete="new-password"
              className={inputCls}
            />
            <button
              type="button" onClick={generatePassword}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-soft-foreground hover:text-gold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Gerar
            </button>
          </div>
        </Field>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Papéis</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_ROLES.map((r) => (
            <label key={r} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface p-3 hover:border-gold/40">
              <input
                type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-gold"
              />
              <div>
                <div className="text-sm font-semibold text-foreground">{ROLE_LABELS[r].label}</div>
                <div className="text-xs text-muted-foreground">{ROLE_LABELS[r].hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button" onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-soft-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" /> Cancelar
        </button>
        <button
          type="submit" disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background hover:bg-gold/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {mut.isPending ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}

/* ------------- Auditoria ------------- */

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string;
  action: "UPDATE" | "DELETE";
  changed_by: string | null;
  changed_at: string;
  data_before: Record<string, unknown> | null;
  data_after: Record<string, unknown> | null;
};

const TABLE_LABEL: Record<string, string> = {
  notas_fiscais: "NF",
  caixa_movimentos: "Caixa",
};

const FIELD_LABEL: Record<string, string> = {
  fornecedor: "Fornecedor",
  nf: "NF",
  filial: "Filial",
  valor: "Valor",
  status_nf: "Status",
  entrega: "Entrega",
  data: "Data",
  saldo_anterior: "Saldo ant.",
  entrada: "Entrada",
  saida: "Saída",
  saldo_total: "Saldo total",
  destino: "Destino",
};

function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  if (!before) return [];
  const target = after ?? {};
  const changes: { field: string; from: unknown; to: unknown }[] = [];
  for (const k of Object.keys(FIELD_LABEL)) {
    const a = before[k];
    const b = target[k];
    if (after === null || JSON.stringify(a) !== JSON.stringify(b)) {
      if (after === null) {
        changes.push({ field: k, from: a, to: undefined });
      } else if (a !== undefined || b !== undefined) {
        changes.push({ field: k, from: a, to: b });
      }
    }
  }
  return changes;
}

const fmtVal = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return String(v);
  return String(v);
};

function AuditoriaManager() {
  const [tableFilter, setTableFilter] = useState<string>("Todas");
  const [actionFilter, setActionFilter] = useState<string>("Todas");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit_log"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, table_name, record_id, action, changed_by, changed_at, data_before, data_after")
        .order("changed_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.changed_by).filter(Boolean) as string[])),
    [data],
  );

  const { data: profiles } = useQuery({
    queryKey: ["audit_profiles", userIds.sort().join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [] as { id: string; display_name: string; email: string | null }[];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", userIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    (profiles ?? []).forEach((p) => m.set(p.id, p.display_name || p.email || p.id));
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (tableFilter !== "Todas" && r.table_name !== tableFilter) return false;
      if (actionFilter !== "Todas" && r.action !== actionFilter) return false;
      return true;
    });
  }, [data, tableFilter, actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <History className="h-5 w-5 text-gold" /> Auditoria
          <span className="text-muted-foreground">({filtered.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="Todas">Todas as tabelas</option>
            <option value="notas_fiscais">Notas Fiscais</option>
            <option value="caixa_movimentos">Caixa</option>
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
          >
            <option value="Todas">Todas as ações</option>
            <option value="UPDATE">Edição</option>
            <option value="DELETE">Exclusão</option>
          </select>
        </div>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Carregando histórico...</div>}
      {error && <div className="text-sm text-red">{(error as Error).message}</div>}

      <div className="space-y-3">
        {filtered.map((r) => {
          const changes = diffFields(r.data_before, r.data_after);
          const who = r.changed_by ? userMap.get(r.changed_by) ?? "—" : "—";
          const when = new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          }).format(new Date(r.changed_at));
          const isDelete = r.action === "DELETE";
          const before = r.data_before ?? {};
          const ident = (before.nf as string | undefined) ?? (before.data as string | undefined) ?? r.record_id.slice(0, 8);

          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                    isDelete ? "bg-red-dim text-red" : "bg-blue-dim text-blue"
                  }`}>
                    {isDelete ? "EXCLUSÃO" : "EDIÇÃO"}
                  </span>
                  <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-soft-foreground ring-1 ring-border">
                    {TABLE_LABEL[r.table_name] ?? r.table_name}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{ident}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-soft-foreground">{who}</span> · {when}
                </div>
              </div>

              {changes.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="px-2 py-1 font-medium">Campo</th>
                        <th className="px-2 py-1 font-medium">Antes</th>
                        {!isDelete && <th className="px-2 py-1 font-medium">Depois</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((c) => (
                        <tr key={c.field} className="border-t border-border/50">
                          <td className="px-2 py-1 font-semibold text-soft-foreground">{FIELD_LABEL[c.field] ?? c.field}</td>
                          <td className="px-2 py-1 text-red">{fmtVal(c.from)}</td>
                          {!isDelete && <td className="px-2 py-1 text-green">{fmtVal(c.to)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum registro de auditoria.
          </div>
        )}
      </div>
    </div>
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
