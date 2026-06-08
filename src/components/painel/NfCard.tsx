import { Send, Pencil, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { brl } from "@/lib/format";
import { isAEnviar, isEnviado } from "@/data/painel";
import type { NFRecord } from "@/data/store";

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function NfCard({
  n,
  canWrite,
  onEdit,
  onDelete,
  onConfirmarEnvio,
  confirmando = false,
}: {
  n: NFRecord;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmarEnvio?: () => void;
  confirmando?: boolean;
}) {
  const aEnviar = isAEnviar(n);
  const enviado = isEnviado(n);
  const naoChegou = n.entrega.toUpperCase().includes("NÃO");

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors active:bg-surface/60">
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
        {enviado && (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-dim px-2 py-0.5 text-[11px] font-bold text-green">
            <CheckCircle2 className="h-3 w-3" /> Enviado em {fmtDate(n.chequeEnviadoEm)}
          </span>
        )}
        {aEnviar && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-orange-dim px-2 py-0.5 text-[11px] font-bold text-orange">
            <Send className="h-3 w-3" /> ENVIAR
          </span>
        )}
      </div>

      {canWrite && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border/60 pt-2">
          {aEnviar && onConfirmarEnvio && (
            <button
              onClick={onConfirmarEnvio}
              disabled={confirmando}
              className="mr-auto inline-flex min-h-11 items-center gap-1.5 rounded-md bg-orange px-3 py-2 text-xs font-bold text-background transition-transform transition-colors duration-150 hover:bg-orange/90 active:scale-95 disabled:opacity-60"
            >
              {confirmando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar envio
                </>
              )}
            </button>
          )}
          <button
            onClick={onEdit}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-blue transition-transform transition-colors duration-150 hover:bg-blue-dim active:scale-95"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            onClick={onDelete}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-red transition-transform transition-colors duration-150 hover:bg-red-dim active:scale-95"
            aria-label="Remover"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}
