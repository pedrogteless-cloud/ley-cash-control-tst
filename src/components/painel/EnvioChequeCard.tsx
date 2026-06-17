import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, PackageCheck } from "lucide-react";
import { brl, formatBrlInput, parseBrlInput } from "@/lib/format";

export type EnvioChequeNf = {
  id: string;
  nf: string;
  valor: number;
  filial?: string;
  separado?: boolean;
};

export function EnvioChequeFornecedorCard({
  fornecedor,
  nfs,
  onEnviar,
  isEnviando = false,
  defaultOpen = false,
}: {
  fornecedor: string;
  nfs: EnvioChequeNf[];
  onEnviar: (nfIds: string[], valorEnviado: number) => Promise<unknown> | void;
  isEnviando?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set(nfs.map((n) => n.id)));
  const [valorStr, setValorStr] = useState("");

  const nfsKey = useMemo(() => nfs.map((n) => n.id).join("|"), [nfs]);

  useEffect(() => {
    setSelecionadas(new Set(nfs.map((n) => n.id)));
    setValorStr("");
  }, [nfsKey, nfs]);

  const somaSelecionadas = useMemo(
    () => nfs.filter((n) => selecionadas.has(n.id)).reduce((s, n) => s + n.valor, 0),
    [nfs, selecionadas],
  );
  const valorEnviado = parseBrlInput(valorStr);
  const valorFinal = valorEnviado > 0 ? valorEnviado : somaSelecionadas;
  const diff = valorFinal - somaSelecionadas;
  const selectedCount = selecionadas.size;

  const toggle = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEnviar = async () => {
    if (selectedCount === 0 || valorFinal <= 0) return;
    try {
      await onEnviar(Array.from(selecionadas), valorFinal);
      setValorStr("");
      setOpen(false);
    } catch {
      // A mutation já mostra o erro em toast.
    }
  };

  return (
    <div className="rounded-xl border border-blue/35 bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <PackageCheck className="h-4 w-4 shrink-0 text-blue" />
          <span className="truncate text-sm font-semibold text-foreground">{fornecedor}</span>
          <span className="rounded-full bg-blue-dim px-2 py-0.5 text-[11px] font-bold text-blue">
            {nfs.length} NF{nfs.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold text-foreground">{brl(somaSelecionadas)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 pb-4">
          <div className="space-y-2 pt-3">
            {nfs.map((n) => (
              <label key={n.id} className="flex min-h-9 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={selecionadas.has(n.id)}
                  onChange={() => toggle(n.id)}
                  className="h-4 w-4 rounded border-border accent-blue"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-soft-foreground">
                  NF {n.nf}
                  {n.filial ? ` - ${n.filial}` : ""}
                </span>
                <span className="text-sm font-semibold text-foreground">{brl(n.valor)}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Valor real enviado (R$)
            </label>
            <input
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              inputMode="decimal"
              placeholder={formatBrlInput(somaSelecionadas) || "0,00"}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
            />
            {selectedCount > 0 && (
              <div className={`text-[11px] ${diff === 0 ? "text-green" : diff > 0 ? "text-blue" : "text-orange"}`}>
                {diff === 0
                  ? "Valor igual aos títulos selecionados"
                  : diff > 0
                    ? `+${brl(diff)} sobre os títulos`
                    : `${brl(Math.abs(diff))} abaixo dos títulos`}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleEnviar}
            disabled={isEnviando || selectedCount === 0 || valorFinal <= 0}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-green px-3 py-2.5 text-sm font-bold text-background transition-all hover:bg-green/90 active:scale-95 disabled:opacity-60"
          >
            {isEnviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isEnviando ? "Registrando..." : "Registrar saída de cheque"}
          </button>
        </div>
      )}
    </div>
  );
}
