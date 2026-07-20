import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2, Pencil, PlusCircle, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { buildDevolvidosWorkbook } from "@/lib/excel-devolvidos";
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

type LaunchMode = "devolvido" | "recuperacao";

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

const mutationMessage = (e: Error) => {
  if (e.message.includes("invalid_money_values")) return "Informe valores válidos";
  if (e.message.includes("recovered_exceeds_devolvido")) {
    return "O total recuperado não pode ser maior que o valor devolvido";
  }
  return e.message;
};

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

function rowRecovered(r: Pick<Row, "valor_rec_fornecedor" | "valor_rec_empresa">) {
  return Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0);
}

export function DevolvidosManager() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [mode, setMode] = useState<LaunchMode>("devolvido");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportForm, setShowExportForm] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo,   setExportTo]   = useState("");
  const [enviosFrom, setEnviosFrom] = useState("");
  const [enviosTo,   setEnviosTo]   = useState("");

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
      setMode(isRecoveryOnly(r) ? "recuperacao" : "devolvido");
      setForm({
        data: r.data,
        valor_devolvido: r.valor_devolvido,
        valor_rec_fornecedor: 0,
        valor_rec_empresa: rowRecovered(r),
      });
    }
  }, [editingId, rows]);

  // ── Excel export ────────────────────────────────────────────────────────
  const exportToExcel = async () => {
    setShowExportForm(false);
    setExporting(true);
    try {
      const filtered = rows.filter((r) => {
        if (exportFrom && r.data < exportFrom) return false;
        if (exportTo   && r.data > exportTo)   return false;
        return true;
      });
      if (filtered.length === 0) {
        toast.error("Nenhum lançamento no período selecionado");
        return;
      }
      const enviosPeriod = (enviosFrom || enviosTo)
        ? { from: enviosFrom || undefined, to: enviosTo || undefined }
        : undefined;
      const blob = await buildDevolvidosWorkbook(
        filtered,
        { from: exportFrom || undefined, to: exportTo || undefined },
        enviosPeriod,
      );
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `Ley_ChequesDevolvidos_${today}.xlsx`;
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
    onError: (e: Error) => toast.error(mutationMessage(e)),
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
    onError: (e: Error) => toast.error(mutationMessage(e)),
  });

  // ── Delete mutation ──────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cheques_devolvidos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, deletedId) => {
      toast.success("Lançamento removido");
      qc.invalidateQueries({ queryKey: ["cheques_devolvidos"] });
      setDeleteTarget(null);
      if (editingId === deletedId) {
        setEditingId(null);
        setForm(emptyForm());
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelEdit = () => {
    setEditingId(null);
    setMode("devolvido");
    setForm(emptyForm());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data) return;
    if (
      !Number.isFinite(form.valor_devolvido) ||
      !Number.isFinite(form.valor_rec_fornecedor) ||
      !Number.isFinite(form.valor_rec_empresa)
    ) {
      toast.error("Informe valores válidos");
      return;
    }
    if (form.valor_devolvido < 0 || form.valor_rec_fornecedor < 0 || form.valor_rec_empresa < 0) {
      toast.error("Os valores não podem ser negativos");
      return;
    }
    const normalizedForm = {
      ...form,
      valor_rec_fornecedor: 0,
      valor_rec_empresa: rowRecovered(form),
    };
    const payload =
      mode === "recuperacao" ? { ...normalizedForm, valor_devolvido: 0 } : normalizedForm;
    const totalRecuperado = payload.valor_rec_empresa;
    if (mode === "devolvido" && totalRecuperado > payload.valor_devolvido) {
      toast.error("O total recuperado não pode ser maior que o valor devolvido");
      return;
    }
    if (mode === "devolvido" && payload.valor_devolvido <= 0 && !editingId) {
      toast.error("Informe o valor devolvido");
      return;
    }
    if (mode === "recuperacao" && totalRecuperado <= 0) {
      toast.error("Informe o valor recuperado");
      return;
    }
    if (editingId) {
      updateMut.mutate({ ...payload, id: editingId });
    } else {
      insertMut.mutate(payload);
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
    const voltouMes = monthRows.reduce((s, r) => s + Number(r.valor_devolvido || 0), 0);
    const recFMes = monthRows.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0), 0);
    const recEMes = monthRows.reduce((s, r) => s + Number(r.valor_rec_empresa || 0), 0);
    const voltouTotal = rows.reduce((s, r) => s + Number(r.valor_devolvido || 0), 0);
    const recTotal = rows.reduce(
      (s, r) => s + Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0),
      0,
    );
    return {
      voltouMes,
      recuperadoMes: recFMes + recEMes,
      pendenteTotal: voltouTotal - recTotal,
    };
  }, [monthRows, rows]);

  const prevRows = useMemo(
    () => rows.filter((r) => ymKey(r.data) !== currentYM),
    [rows, currentYM],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Cheques devolvidos</h2>
        <button
          type="button"
          onClick={() => setShowExportForm((v) => !v)}
          disabled={exporting || rows.length === 0}
          title="Exportar planilha Excel com análise completa"
          className={`inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
            showExportForm
              ? "border-gold/60 text-gold"
              : "border-border text-soft-foreground hover:border-gold/40 hover:text-gold"
          }`}
        >
          {exporting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <FileSpreadsheet className="h-3.5 w-3.5" />}
          {exporting ? "Gerando…" : "Exportar Excel"}
        </button>
      </div>

      {/* ── Painel de período para exportação ─────────────────────────────── */}
      {showExportForm && !exporting && (
        <div className="rounded-xl border border-gold/30 bg-card p-4 space-y-4">

          {/* Período dos devolvidos */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Período dos devolvidos
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">De</span>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={(e) => setExportFrom(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Até</span>
                <input
                  type="date"
                  value={exportTo}
                  onChange={(e) => setExportTo(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* Período dos envios (para correlação) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Período dos envios — correlação
            </p>
            <p className="text-[11px] text-muted-foreground">
              Define quais notas enviadas entram na análise "Enviado × Devolvido". Deixe em branco para usar o mesmo período dos devolvidos.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">De</span>
                <input
                  type="date"
                  value={enviosFrom}
                  onChange={(e) => setEnviosFrom(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Até</span>
                <input
                  type="date"
                  value={enviosTo}
                  onChange={(e) => setEnviosTo(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowExportForm(false)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-soft-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={exportToExcel}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-background hover:bg-gold/90 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Gerar planilha
            </button>
          </div>
        </div>
      )}

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

        <div className="inline-flex rounded-lg border border-border bg-surface p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("devolvido");
              setForm((f) => ({ ...f, valor_devolvido: f.valor_devolvido || 0 }));
            }}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              mode === "devolvido"
                ? "bg-card text-gold ring-1 ring-gold/40"
                : "text-soft-foreground hover:text-foreground"
            }`}
          >
            Cheque devolvido
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("recuperacao");
              setForm((f) => ({
                ...f,
                valor_devolvido: 0,
                valor_rec_fornecedor: 0,
                valor_rec_empresa: rowRecovered(f),
              }));
            }}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              mode === "recuperacao"
                ? "bg-card text-blue ring-1 ring-blue/40"
                : "text-soft-foreground hover:text-foreground"
            }`}
          >
            Recuperação avulsa
          </button>
        </div>

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
          {mode === "devolvido" ? (
            <Field label="Valor devolvido (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_devolvido || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valor_devolvido: Number(e.target.value) }))
                }
                className={inputCls}
              />
            </Field>
          ) : (
            <div className="rounded-lg border border-blue/30 bg-blue-dim/20 px-3 py-2">
              <div className="text-xs font-medium uppercase tracking-wider text-blue">Tipo</div>
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <PlusCircle className="h-4 w-4 text-blue" />
                Recuperado sem vínculo
              </div>
            </div>
          )}
          <Field label="Valor recuperado (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={rowRecovered(form) || ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  valor_rec_fornecedor: 0,
                  valor_rec_empresa: Number(e.target.value),
                }))
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
            {isPending
              ? "Salvando..."
              : editingId
                ? "Salvar edição"
                : mode === "recuperacao"
                  ? "Adicionar recuperado"
                  : "Salvar"}
          </button>
        </div>
      </form>

      {/* ── KPIs deste mês ───────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiBox label="Voltou este mês" value={brl(totals.voltouMes)} tone="text-red" />
        <KpiBox label="Recuperado este mês" value={brl(totals.recuperadoMes)} tone="text-blue" />
        <KpiBox
          label="Pendente geral"
          value={totals.pendenteTotal <= 0 ? "✓ Tudo quitado" : brl(totals.pendenteTotal)}
          tone={totals.pendenteTotal <= 0 ? "text-green" : "text-gold"}
        />
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
                  Lançamento de <strong>{fmtDateBR(deleteTarget.data)}</strong> —{" "}
                  {isRecoveryOnly(deleteTarget) ? "recuperado " : "devolvido "}
                  <strong>
                    {brl(
                      isRecoveryOnly(deleteTarget)
                        ? rowRecovered(deleteTarget)
                        : Number(deleteTarget.valor_devolvido),
                    )}
                  </strong>
                  .
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
              <th className="px-4 py-3 text-right font-medium">Recuperado</th>
              <th className="px-4 py-3 text-right font-medium">Pendente</th>
              <th className="px-4 py-3 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const devolvido = Number(r.valor_devolvido);
              const recuperado = rowRecovered(r);
              const pend = devolvido - recuperado;
              const recuperacaoAvulsa = isRecoveryOnly(r);
              const quitado = pend <= 0;
              const semRecuperacao = recuperado === 0 && devolvido > 0;
              const isActive = editingId === r.id;
              return (
                <tr
                  key={r.id}
                  className={`border-b border-border/50 last:border-0 ${
                    isActive
                      ? "bg-blue-dim/30"
                      : quitado
                        ? "opacity-60 hover:opacity-100 hover:bg-surface/50"
                        : "hover:bg-surface/50"
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div>{fmtDateBR(r.data)}</div>
                    {recuperacaoAvulsa && (
                      <div className="mt-0.5 text-[11px] font-medium text-blue">
                        Recuperação avulsa
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red">
                    {devolvido > 0 ? (
                      brl(devolvido)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-blue">
                    {recuperado > 0 ? (
                      brl(recuperado)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {recuperacaoAvulsa ? (
                      <span className="text-muted-foreground">—</span>
                    ) : quitado ? (
                      <span className="text-green">✓ Quitado</span>
                    ) : semRecuperacao ? (
                      <span className="text-red">{brl(pend)}</span>
                    ) : (
                      <span className="text-gold">{brl(pend)}</span>
                    )}
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
                        disabled={isActive}
                        className="rounded-md p-1.5 text-red transition-colors hover:bg-red-dim disabled:opacity-40"
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
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
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

function isRecoveryOnly(r: Row) {
  return Number(r.valor_devolvido || 0) <= 0 && rowRecovered(r) > 0;
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
