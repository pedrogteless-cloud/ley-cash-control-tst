import { ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2 } from "lucide-react";
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
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Dia</div>
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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue hover:bg-blue-dim"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red hover:bg-red-dim"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
