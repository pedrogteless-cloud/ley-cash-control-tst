import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

type Row = {
  id: string;
  data: string; // YYYY-MM-DD
  valor_devolvido: number;
  valor_rec_fornecedor: number;
  valor_rec_empresa: number;
  created_at: string;
};

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold";

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

function ymKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
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
  const [form, setForm] = useState({
    data: todayISO(),
    valor_devolvido: 0,
    valor_rec_fornecedor: 0,
    valor_rec_empresa: 0,
  });

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

  const mut = useMutation({
    mutationFn: async (payload: typeof form) => {
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
      setForm({
        data: todayISO(),
        valor_devolvido: 0,
        valor_rec_fornecedor: 0,
        valor_rec_empresa: 0,
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const historico = useMemo(() => {
    const map = new Map<string, { voltou: number; recuperado: number }>();
    rows.forEach((r) => {
      const k = ymKey(r.data);
      if (k === currentYM) return;
      const cur = map.get(k) ?? { voltou: 0, recuperado: 0 };
      cur.voltou += Number(r.valor_devolvido || 0);
      cur.recuperado += Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0);
      map.set(k, cur);
    });
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6)
      .map(([ym, v]) => ({ ym, ...v, pendente: v.voltou - v.recuperado }));
  }, [rows, currentYM]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">Cheques devolvidos</h2>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.data) return;
          if (form.valor_devolvido <= 0 && form.valor_rec_fornecedor <= 0 && form.valor_rec_empresa <= 0) {
            toast.error("Informe ao menos um valor");
            return;
          }
          mut.mutate(form);
        }}
        className="rounded-xl border border-gold/40 bg-card p-4 space-y-4"
      >
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
              type="number" step="0.01" min="0"
              value={form.valor_devolvido || ""}
              onChange={(e) => setForm((f) => ({ ...f, valor_devolvido: Number(e.target.value) }))}
              className={inputCls}
            />
          </Field>
          <Field label="Recuperado direto do fornecedor (R$)">
            <input
              type="number" step="0.01" min="0"
              value={form.valor_rec_fornecedor || ""}
              onChange={(e) => setForm((f) => ({ ...f, valor_rec_fornecedor: Number(e.target.value) }))}
              className={inputCls}
            />
          </Field>
          <Field label="Recuperado via empresa (R$)">
            <input
              type="number" step="0.01" min="0"
              value={form.valor_rec_empresa || ""}
              onChange={(e) => setForm((f) => ({ ...f, valor_rec_empresa: Number(e.target.value) }))}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-background hover:bg-gold/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Salvar
          </button>
        </div>
      </form>

      {/* Painel mensal */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiBox label="Voltou este mês" value={brl(totals.voltou)} tone="text-red" />
        <KpiBox label="Recuperado" value={brl(totals.recuperado)} tone="text-blue" />
        <KpiBox label="Pendente" value={brl(totals.pendente)} tone="text-gold" />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Lançamentos de {fmtMonthBR(currentYM)}
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
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => {
                const pend = Number(r.valor_devolvido) - Number(r.valor_rec_fornecedor) - Number(r.valor_rec_empresa);
                return (
                  <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-semibold text-foreground">{fmtDateBR(r.data)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red">{brl(Number(r.valor_devolvido))}</td>
                    <td className="px-4 py-3 text-right text-blue">{brl(Number(r.valor_rec_fornecedor))}</td>
                    <td className="px-4 py-3 text-right text-blue">{brl(Number(r.valor_rec_empresa))}</td>
                    <td className="px-4 py-3 text-right font-bold text-gold">{brl(pend)}</td>
                  </tr>
                );
              })}
              {!isLoading && monthRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Nenhum lançamento neste mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico 6 meses */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico — últimos 6 meses
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Mês</th>
                <th className="px-4 py-3 text-right font-medium">Voltou</th>
                <th className="px-4 py-3 text-right font-medium">Recuperado</th>
                <th className="px-4 py-3 text-right font-medium">Pendente</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.ym} className="border-b border-border/50 last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold text-foreground">{fmtMonthBR(h.ym)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red">{brl(h.voltou)}</td>
                  <td className="px-4 py-3 text-right text-blue">{brl(h.recuperado)}</td>
                  <td className="px-4 py-3 text-right font-bold text-gold">{brl(h.pendente)}</td>
                </tr>
              ))}
              {historico.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Sem histórico anterior.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiBox({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-xl font-bold sm:text-2xl ${tone}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
