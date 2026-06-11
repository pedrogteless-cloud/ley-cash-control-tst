import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Row = {
  id: string;
  data: string; // YYYY-MM-DD
  valor_devolvido: number;
  valor_rec_fornecedor: number;
  valor_rec_empresa: number;
  created_at: string;
};

type FormState = {
  data: string;
  valor_devolvido: number;
  valor_rec_fornecedor: number;
  valor_rec_empresa: number;
};

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

const emptyForm = (): FormState => ({
  data: todayISO(),
  valor_devolvido: 0,
  valor_rec_fornecedor: 0,
  valor_rec_empresa: 0,
});

function ymKey(iso: string) {
  return iso.slice(0, 7);
}

function fmtDateBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtMonthBR(ym: string) {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}

export function DevolvidosManager() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cheques_devolvidos"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("cheques_devolvidos")
        .select("id,data,valor_devolvido,valor_rec_fornecedor,valor_rec_empresa,created_at")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Pre-fill form when entering edit mode
  useEffect(() => {
    if (!editingId) return;
    const r = rows.find((x) => x.id === editingId);
    if (r) {
      setForm({
        data: r.data,
        valor_devolvido: r.valor_devolvido,
        valor_rec_fornecedor: r.valor_rec_fornecedor,
        valor_rec_empresa: r.valor_rec_empresa,
      });
    }
  }, [editingId, rows]);

  // ── Insert mutation ──────────────────────────────────────────────────────
  const insertMut = useMutation({
    mutationFn: async (payload: FormState) => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id;
      const { error } = await supabase.from("cheques_devolvidos").insert({
        data: payload.data,
        valor_devolvido: payload.valor_devolvido,
        valor_rec_fornecedor: payload.valor_rec_fornecedor,
        valor_rec_empresa: payload.valor_rec_empresa,
        criado_por: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento salvo");
      qc.invalidateQueries({ queryKey: ["cheques_devolvidos"] });
      setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Update mutation (via RPC for server-side Telegram decision) ──────────
  const updateMut = useMutation({
    mutationFn: async (payload: FormState & { id: string }) => {
      const { error } = await supabase.rpc("update_devolvido", {
        p_id: payload.id,
        p_data: payload.data,
        p_valor_devolvido: payload.valor_devolvido,
        p_valor_rec_fornecedor: payload.valor_rec_fornecedor,
        p_valor_rec_empresa: payload.valor_rec_empresa,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento atualizado");
      qc.invalidateQueries({ queryKey: ["cheques_devolvidos"] });
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Delete mutation ──────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cheques_devolvidos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento removido");
      qc.invalidateQueries({ queryKey: ["cheques_devolvidos"] });
      setDeleteTarget(null);
      if (editingId === deleteTarget?.id) {
        setEditingId(null);
        setForm(emptyForm());
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data) return;
    const noValues =
      form.valor_devolvido <= 0 &&
      form.valor_rec_fornecedor <= 0 &&
      form.valor_rec_empresa <= 0;
    if (noValues && !editingId) {
      toast.error("Informe ao menos um valor");
      return;
    }
    if (editingId) {
      updateMut.mutate({ ...form, id: editingId });
    } else {
      insertMut.mutate(form);
    }
  };

  const isPending = insertMut.isPending || updateMut.isPending;

  // ── Derived data ─────────────────────────────────────────────────────────
  const currentYM = ymKey(todayISO());

  const monthRows = useMemo(
    () => rows.filter((r) => ymKey(r.data) === currentYM),
    [rows, currentYM],
  );

  const totals = useMemo(() => {
    const voltou = monthRows.reduce((s, r) => s + Number(r.valor_devolvido || 0), 0);
    const recF = monthRows.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0), 0);
    const recE = monthRows.reduce((s, r) => s + Number(r.valor_rec_empresa || 0), 0);
    return { voltou, recuperado: recF + recE, pendente: voltou - recF - recE };
  }, [monthRows]);

  const prevRows = useMemo(
    () => rows.filter((r) => ymKey(r.data) !== currentYM),
    [rows, currentYM],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Cheques devolvidos</h2>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className={`rounded-xl border p-4 space-y-4 ${
          editingId ? "border-blue/40 bg-card" : "border-gold/40 bg-card"
        }`}
      >
        {editingId && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue">
              Editando lançamento de {fmtDateBR(form.data)}
            </span>
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-soft-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Cancelar edição
            </button>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Data">
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              required
              className={inputCls}
            />
          </Field>
          <Field label="Valor devolvido (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valor_devolvido || ""}
              onChange={(e) => setForm((f) => ({ ...f, valor_devolvido: Number(e.target.value) }))}
              className={inputCls}
            />
          </Field>
          <Field label="Recuperado — fornecedor (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valor_rec_fornecedor || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, valor_rec_fornecedor: Number(e.target.value) }))
              }
              className={inputCls}
            />
          </Field>
          <Field label="Recuperado — empresa/Ley (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.valor_rec_empresa || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, valor_rec_empresa: Number(e.target.value) }))
              }
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background hover:bg-gold/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Salvando..." : editingId ? "Salvar edição" : "Salvar"}
          </button>
        </div>
      </form>

      {/* ── KPIs deste mês ───────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiBox label="Voltou este mês" value={brl(totals.voltou)} tone="text-red" />
        <KpiBox label="Recuperado" value={brl(totals.recuperado)} tone="text-blue" />
        <KpiBox label="Pendente" value={brl(totals.pendente)} tone="text-gold" />
      </div>

      {/* ── Tabela: mês atual (detalhe) ──────────────────────────────────── */}
      <EntriesTable
        title={`Lançamentos de ${fmtMonthBR(currentYM)}`}
        rows={monthRows}
        isLoading={isLoading}
        editingId={editingId}
        onEdit={(r) => setEditingId(r.id)}
        onDelete={(r) => setDeleteTarget(r)}
      />

      {/* ── Tabela: meses anteriores (detalhe individual) ────────────────── */}
      {prevRows.length > 0 && (
        <EntriesTable
          title="Histórico — meses anteriores"
          rows={prevRows}
          isLoading={false}
          editingId={editingId}
          onEdit={(r) => setEditingId(r.id)}
          onDelete={(r) => setDeleteTarget(r)}
        />
      )}

      {/* ── AlertDialog: confirmação de exclusão ─────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento de devolvido?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Lançamento de{" "}
                  <strong>{fmtDateBR(deleteTarget.data)}</strong> — devolvido{" "}
                  <strong>{brl(Number(deleteTarget.valor_devolvido))}</strong>.
                  <br />
                  Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="active:scale-95 transition-transform">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
              className="bg-red text-background hover:bg-red/90 active:scale-95 transition-transform disabled:opacity-50"
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function EntriesTable({
  title,
  rows,
  isLoading,
  editingId,
  onEdit,
  onDelete,
}: {
  title: string;
  rows: Row[];
  isLoading: boolean;
  editingId: string | null;
  onEdit: (r: Row) => void;
  onDelete: (r: Row) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 text-right font-medium">Voltou</th>
              <th className="px-4 py-3 text-right font-medium">Rec. Fornecedor</th>
              <th className="px-4 py-3 text-right font-medium">Rec. Empresa</th>
              <th className="px-4 py-3 text-right font-medium">Pendente</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pend =
                Number(r.valor_devolvido) -
                Number(r.valor_rec_fornecedor) -
                Number(r.valor_rec_empresa);
              const isActive = editingId === r.id;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-border/50 last:border-0 ${
                    isActive ? "bg-blue-dim/30" : "hover:bg-surface/50"
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {fmtDateBR(r.data)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red">
                    {brl(Number(r.valor_devolvido))}
                  </td>
                  <td className="px-4 py-3 text-right text-blue">
                    {brl(Number(r.valor_rec_fornecedor))}
                  </td>
                  <td className="px-4 py-3 text-right text-blue">
                    {brl(Number(r.valor_rec_empresa))}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gold">
                    {brl(pend)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onEdit(r)}
                        disabled={isActive}
                        className="rounded-md p-1.5 text-blue transition-colors hover:bg-blue-dim disabled:opacity-40"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(r)}
                        className="rounded-md p-1.5 text-red transition-colors hover:bg-red-dim"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhum lançamento neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 whitespace-nowrap text-lg font-bold sm:text-xl xl:text-2xl ${tone}`}>
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
