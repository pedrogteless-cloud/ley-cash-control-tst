import { Send, Pencil, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";
import { isEnviar } from "@/data/painel";
import type { NFRecord } from "@/data/store";

export function NfCard({
  n,
  canWrite,
  onEdit,
  onDelete,
}: {
  n: NFRecord;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const enviar = isEnviar(n);
  const naoChegou = n.entrega.toUpperCase().includes("NÃO");

  return (
    <div className="rounded-xl border border-border bg-card p-4 active:bg-surface/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{n.fornecedor}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            NF {n.nf} · {n.filial}
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold text-foreground">{brl(n.valor)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
            naoChegou ? "bg-blue-dim text-blue" : "bg-green-dim text-green"
          }`}
        >
          {n.entrega}
        </span>
        {enviar && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-orange-dim px-2 py-0.5 text-[11px] font-bold text-orange">
            <Send className="h-3 w-3" /> ENVIAR
          </span>
        )}
      </div>

      {canWrite && (
        <div className="mt-3 flex justify-end gap-1 border-t border-border/60 pt-2">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue hover:bg-blue-dim"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red hover:bg-red-dim"
            aria-label="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
