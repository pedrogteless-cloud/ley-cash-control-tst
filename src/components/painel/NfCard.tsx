import { Send, Pencil, Trash2, CheckCircle2, Loader2, PackageCheck, X } from "lucide-react";
import { brl } from "@/lib/format";
import { isAEnviar, isEnviado, isSeparado, isAConfirmarEnvio } from "@/data/painel";
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
  onSeparar,
  onCancelarSeparacao,
  onConfirmarEnvio,
  separando = false,
  cancelandoSeparacao = false,
  confirmando = false,
}: {
  n: NFRecord;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSeparar?: () => void;
  onCancelarSeparacao?: () => void;
  onConfirmarEnvio?: () => void;
  separando?: boolean;
  cancelandoSeparacao?: boolean;
  confirmando?: boolean;
}) {
  const aEnviar = isAEnviar(n);
  const separado = isSeparado(n);
  const aConfirmar = isAConfirmarEnvio(n);
  const enviado = isEnviado(n);
  const naoChegou = n.entrega.toUpperCase().includes("NÃO");

  return (
    <div className={`rounded-xl border bg-card p-4 transition-colors active:bg-surface/60 ${
      separado ? "border-blue/40" : "border-border"
    }`}>
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
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
          naoChegou ? "bg-blue-dim text-blue" : "bg-green-dim text-green"
        }`}>
          {n.entrega}
        </span>

        {enviado && (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-dim px-2 py-0.5 text-[11px] font-bold text-green">
            <CheckCircle2 className="h-3 w-3" /> Enviado em {fmtDate(n.chequeEnviadoEm)}
          </span>
        )}

        {separado && !enviado && (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-dim px-2 py-0.5 text-[11px] font-bold text-blue">
            <PackageCheck className="h-3 w-3" /> Separado {fmtDate(n.chequeSeparadoEm)}
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
          {/* Botão: Separar para envio */}
          {aEnviar && onSeparar && (
            <button
              onClick={onSeparar}
              disabled={separando}
              className="mr-auto inline-flex min-h-11 items-center gap-1.5 rounded-md bg-blue px-3 py-2 text-xs font-bold text-background transition-transform transition-colors duration-150 hover:bg-blue/90 active:scale-95 disabled:opacity-60"
            >
              {separando ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Separando...</>
              ) : (
                <><PackageCheck className="h-3.5 w-3.5" /> Separar para envio</>
              )}
            </button>
          )}

          {/* Botões: Confirmar envio + Cancelar separação */}
          {aConfirmar && (
            <>
              {onConfirmarEnvio && (
                <button
                  onClick={onConfirmarEnvio}
                  disabled={confirmando}
                  className="mr-auto inline-flex min-h-11 items-center gap-1.5 rounded-md bg-green px-3 py-2 text-xs font-bold text-background transition-transform transition-colors duration-150 hover:bg-green/90 active:scale-95 disabled:opacity-60"
                >
                  {confirmando ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar envio</>
                  )}
                </button>
              )}
              {onCancelarSeparacao && (
                <button
                  onClick={onCancelarSeparacao}
                  disabled={cancelandoSeparacao}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-soft-foreground transition-transform transition-colors duration-150 hover:border-red/40 hover:text-red active:scale-95 disabled:opacity-60"
                >
                  {cancelandoSeparacao ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <><X className="h-3.5 w-3.5" /> Cancelar</>
                  )}
                </button>
              )}
            </>
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
