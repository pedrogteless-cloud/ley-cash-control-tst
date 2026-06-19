import { useState, useEffect, type ReactNode } from "react";
import { Save, X, Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useStore, type NFRecord, type CaixaRecord } from "@/data/store";
import { brl, parseBrlInput, formatBrlInput } from "@/lib/format";
import { useRoles } from "@/hooks/use-role";

type Mode =
  | { kind: "new-nf" }
  | { kind: "edit-nf"; nota: NFRecord }
  | { kind: "new-caixa" }
  | { kind: "edit-caixa"; caixa: CaixaRecord };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: Mode | null;
  /** Allows the parent to default which tab opens when mode is null (FAB). */
  initialTab?: "nf" | "caixa";
};

export function QuickAddDrawer({ open, onOpenChange, mode, initialTab = "nf" }: Props) {
  const [tab, setTab] = useState<"nf" | "caixa">(initialTab);

  useEffect(() => {
    if (!open) return;
    if (mode?.kind === "new-nf" || mode?.kind === "edit-nf") setTab("nf");
    else if (mode?.kind === "new-caixa" || mode?.kind === "edit-caixa") setTab("caixa");
    else setTab(initialTab);
  }, [open, mode, initialTab]);

  const isEdit = mode?.kind === "edit-nf" || mode?.kind === "edit-caixa";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-card border-border max-h-[92vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-foreground">
            {isEdit ? "Editar lançamento" : "Novo lançamento"}
          </DrawerTitle>
          <DrawerDescription className="text-muted-foreground text-xs">
            {isEdit ? "Atualize os dados e salve." : "Adicione uma NF ou um movimento do caixa."}
          </DrawerDescription>
          {!isEdit && (
            <div className="mt-3 inline-flex rounded-lg border border-border bg-surface p-1">
              {(
                [
                  { id: "nf", label: "Nova NF" },
                  { id: "caixa", label: "Mov. Caixa" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    tab === t.id
                      ? "bg-card text-gold ring-1 ring-gold/40"
                      : "text-soft-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-2">
          {tab === "nf" ? (
            <NfForm
              key={mode?.kind === "edit-nf" ? mode.nota.id : "new-nf"}
              initial={mode?.kind === "edit-nf" ? mode.nota : null}
              onDone={() => onOpenChange(false)}
            />
          ) : (
            <CaixaForm
              key={mode?.kind === "edit-caixa" ? mode.caixa.id : "new-caixa"}
              initial={mode?.kind === "edit-caixa" ? mode.caixa : null}
              onDone={() => onOpenChange(false)}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/* --------------- NF Form --------------- */

function NfForm({ initial, onDone }: { initial: NFRecord | null; onDone: () => void }) {
  const { addNota, updateNota, notas } = useStore();
  const [fornecedor, setFornecedor] = useState(initial?.fornecedor ?? "");
  const [nf, setNf] = useState(initial?.nf ?? "");
  const [filial, setFilial] = useState(initial?.filial ?? "MATRIZ");
  const [valorStr, setValorStr] = useState(formatBrlInput(initial?.valor ?? 0));
  const [entrega, setEntrega] = useState(initial?.entrega ?? "NÃO CHEGOU");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Sugestões: fornecedores já cadastrados (únicos, ordenados por uso)
  const fornecedoresSugeridos = Array.from(new Set(notas.map((n) => n.fornecedor))).sort();

  // Aviso: NF duplicada (mesmo número + filial, ignorando o próprio registro em edição)
  const nfDuplicada =
    nf.trim().length > 0 &&
    notas.some(
      (n) =>
        n.id !== initial?.id &&
        n.nf.trim().toLowerCase() === nf.trim().toLowerCase() &&
        n.filial.trim().toLowerCase() === filial.trim().toLowerCase(),
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseBrlInput(valorStr);
    const errs: Record<string, string> = {};
    if (!fornecedor.trim()) errs.fornecedor = "Informe o fornecedor";
    if (!nf.trim()) errs.nf = "Informe o número da NF";
    if (valor <= 0) errs.valor = "Valor deve ser maior que zero";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      fornecedor: fornecedor.trim().slice(0, 80),
      nf: nf.trim().slice(0, 20),
      filial: filial.trim().slice(0, 30),
      valor,
      statusNf: "FATURADO",
      entrega: entrega.trim().slice(0, 40),
    };
    setSaving(true);
    if (initial) updateNota(initial.id, payload);
    else addNota(payload);
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Fornecedor" error={errors.fornecedor}>
        <input
          autoFocus
          value={fornecedor}
          onChange={(e) => setFornecedor(e.target.value)}
          maxLength={80}
          list="fornecedores-list"
          className={inputCls(errors.fornecedor)}
          placeholder="Ex.: Atualle"
        />
        <datalist id="fornecedores-list">
          {fornecedoresSugeridos.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nº NF" error={errors.nf}>
          <input
            value={nf}
            onChange={(e) => setNf(e.target.value)}
            maxLength={20}
            inputMode="numeric"
            className={inputCls(errors.nf)}
            placeholder="123456"
          />
          {nfDuplicada && !errors.nf && (
            <div className="mt-1 text-[11px] text-orange">
              ⚠ Já existe uma NF {nf} nessa filial. Confirme antes de salvar.
            </div>
          )}
        </Field>
        <Field label="Filial">
          <select
            value={filial}
            onChange={(e) => setFilial(e.target.value)}
            className={inputCls()}
          >
            {["MATRIZ", "FILIAL", "CARGA", "—"].map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Valor (R$)" error={errors.valor}>
        <input
          value={valorStr}
          onChange={(e) => setValorStr(e.target.value)}
          inputMode="decimal"
          className={inputCls(errors.valor)}
          placeholder="0,00"
        />
        {valorStr && !errors.valor && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            {brl(parseBrlInput(valorStr))}
          </div>
        )}
      </Field>

      <Field label="Entrega">
        <select
          value={entrega}
          onChange={(e) => setEntrega(e.target.value)}
          className={inputCls()}
        >
          {["NÃO CHEGOU", "CHEGOU"].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </Field>

      <FooterButtons saving={saving} onCancel={onDone} />
    </form>
  );
}

/* --------------- Caixa Form --------------- */

function CaixaForm({ initial, onDone }: { initial: CaixaRecord | null; onDone: () => void }) {
  const { addCaixa, updateCaixa, caixa } = useStore();
  const { isAdmin } = useRoles();
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}/${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}`;

  const parseCaixaData = (d: string) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return new Date(d).getTime();
    const [dd, mm] = d.split("/");
    return new Date(new Date().getFullYear(), Number(mm) - 1, Number(dd)).getTime();
  };

  /**
   * Saldo anterior derivado: pega o saldo_total do último movimento
   * anterior à data indicada (já computado via computeChain no store).
   * Para o primeiro registro de todos usa o saldo_anterior do primeiro
   * registro (o "saldo de abertura").
   */
  const saldoAnteriorDerived = (ddmm: string): number => {
    if (!/^\d{2}\/\d{2}$/.test(ddmm)) return 0;
    const target = parseCaixaData(ddmm);
    // Movimentos estritamente anteriores à data (exclui o próprio registro em edição)
    const anteriores = caixa.filter((c) => {
      if (initial && c.id === initial.id) return false;
      return parseCaixaData(c.data ?? "") < target;
    });
    if (!anteriores.length) {
      // Sem histórico anterior: usa saldo_anterior do primeiro registro geral como seed
      return caixa[0]?.saldoAnterior ?? 0;
    }
    return anteriores[anteriores.length - 1].saldoTotal;
  };

  const [dataStr, setDataStr] = useState(initial?.data ?? todayStr);
  const [entradaStr, setEntradaStr] = useState(formatBrlInput(initial?.entrada ?? 0));
  const [saidaStr, setSaidaStr] = useState(formatBrlInput(initial?.saida ?? 0));
  const [destino, setDestino] = useState(initial?.destino ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Editing existing record always uses full form. Non-admin lancador_caixa: simplified.
  const modoSimples = !isAdmin && !initial;

  const saldoAnt = saldoAnteriorDerived(dataStr);
  const ent = parseBrlInput(entradaStr);
  const sai = parseBrlInput(saidaStr);
  const total = Math.round((saldoAnt + ent - sai) * 100) / 100;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!dataStr.trim()) errs.data = "Informe a data";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      data: dataStr.trim().slice(0, 10),
      saldoAnterior: saldoAnt,
      entrada: ent,
      saida: sai,
      saldoTotal: total,
      destino: destino.trim() ? destino.trim().slice(0, 100) : undefined,
    };
    setSaving(true);
    if (initial) updateCaixa(initial.id, payload);
    else addCaixa(payload);
    setSaving(false);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Data (DD/MM)" error={errors.data}>
        <input
          autoFocus
          value={dataStr}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
            const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
            setDataStr(formatted);
          }}
          inputMode="numeric"
          maxLength={5}
          placeholder="01/06"
          className={inputCls(errors.data)}
        />
      </Field>

      {modoSimples ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Entrada (R$)">
            <input
              value={entradaStr}
              onChange={(e) => setEntradaStr(e.target.value)}
              inputMode="decimal"
              className={inputCls()}
              placeholder="0,00"
            />
          </Field>
          <Field label="Saída (R$)">
            <input
              value={saidaStr}
              onChange={(e) => setSaidaStr(e.target.value)}
              inputMode="decimal"
              className={inputCls()}
              placeholder="0,00"
            />
          </Field>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entrada (R$)">
              <input
                value={entradaStr}
                onChange={(e) => setEntradaStr(e.target.value)}
                inputMode="decimal"
                className={inputCls()}
                placeholder="0,00"
              />
            </Field>
            <Field label="Saída (R$)">
              <input
                value={saidaStr}
                onChange={(e) => setSaidaStr(e.target.value)}
                inputMode="decimal"
                className={inputCls()}
                placeholder="0,00"
              />
            </Field>
          </div>

          <Field label="Destino da saída">
            <input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              maxLength={100}
              className={inputCls()}
              placeholder="Ex.: Atualle + Nobeltex"
            />
          </Field>
        </>
      )}

      <div className="rounded-lg border border-border bg-surface px-3 py-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Saldo total (calculado)
            </div>
            <div className="text-lg font-bold text-green">{brl(total)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Saldo anterior
            </div>
            <div className="text-sm font-semibold text-soft-foreground">{brl(saldoAnt)}</div>
          </div>
        </div>
      </div>

      <FooterButtons saving={saving} onCancel={onDone} />
    </form>
  );
}

/* --------------- helpers --------------- */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
      {error && <div className="mt-1 text-[11px] text-red">{error}</div>}
    </label>
  );
}

const inputCls = (err?: string) =>
  `w-full rounded-lg border ${
    err ? "border-red" : "border-border"
  } bg-surface px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold sm:text-sm`;

function FooterButtons({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <DrawerFooter className="mt-2 flex-row gap-2 px-0">
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold text-soft-foreground transition-transform transition-colors duration-150 hover:text-foreground active:scale-95"
      >
        <X className="h-4 w-4" /> Cancelar
      </button>
      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-3 text-sm font-bold text-background transition-transform transition-colors duration-150 hover:bg-gold/90 active:scale-95 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
        {saving ? "Salvando..." : "Salvar"}
      </button>
    </DrawerFooter>
  );
}
