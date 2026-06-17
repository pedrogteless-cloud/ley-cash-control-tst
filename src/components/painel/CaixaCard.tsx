import { ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2, Zap, Link2 } from "lucide-react";
import { brl } from "@/lib/format";
import type { CaixaRecord } from "@/data/store";

export function CaixaCard({
  c,
  canWrite,
  onEdit,
  onDelete,
}: {
  c: CaixaRecord;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            Dia
            {c.origem === "auto_nf" && (
              <span className="inline-flex items-center gap-0.5 rounded bg-orange-dim px-1.5 py-0.5 text-[9px] font-bold text-orange">
                <Zap className="h-2.5 w-2.5" /> AUTO
              </span>
            )}
            {c.nfsResolvidas && c.nfsResolvidas.length > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-green-dim px-1.5 py-0.5 text-[9px] font-bold text-green">
                <Link2 className="h-2.5 w-2.5" /> {c.nfsResolvidas.length} NF{c.nfsResolvidas.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="text-base font-semibold text-foreground">{c.data}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo</div>
          <div className="text-lg font-bold text-green">{brl(c.saldoTotal)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-surface/60 px-2 py-1.5">
          <div className="text-[10px] uppercase text-muted-foreground">Ant.</div>
          <div className="font-semibold text-soft-foreground">{brl(c.saldoAnterior)}</div>
        </div>
        <div className="rounded-md bg-blue-dim/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase text-blue">
            <ArrowDownToLine className="h-3 w-3" /> Ent.
          </div>
          <div className="font-semibold text-blue">{c.entrada > 0 ? brl(c.entrada) : "—"}</div>
        </div>
        <div className="rounded-md bg-red-dim/50 px-2 py-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase text-red">
            <ArrowUpFromLine className="h-3 w-3" /> Saída
          </div>
          <div className="font-semibold text-red">{c.saida > 0 ? brl(c.saida) : "—"}</div>
        </div>
      </div>

      {c.destino && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          Destino: <span className="text-soft-foreground">{c.destino}</span>
        </div>
      )}

      {canWrite && (
        <div className="mt-3 flex justify-end gap-1 border-t border-border/60 pt-2">
          <button
            onClick={onEdit}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-blue hover:bg-blue-dim active:scale-95 transition-all"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={onDelete}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-red hover:bg-red-dim active:scale-95 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
