import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ArrowLeft, LogOut, Pencil, Trash2, Inbox } from "lucide-react";
import { QuickAddDrawer } from "@/components/painel/QuickAddDrawer";
import { useStore, type NFRecord, type CaixaRecord } from "@/data/store";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançar · Grupo Ley" },
      { name: "description", content: "Entrada rápida de notas fiscais e movimentos de caixa do dia." },
    ],
  }),
  component: Lancamentos,
});

type Tab = "carteira" | "caixa";
type DrawerMode =
  | { kind: "new-nf" }
  | { kind: "new-caixa" }
  | { kind: "edit-nf"; id: string }
  | { kind: "edit-caixa"; id: string };

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isToday(iso?: string) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= startOfTodayMs();
}

function Lancamentos() {
  const [tab, setTab] = useState<Tab>("carteira");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const { notas, caixa, removeNota, removeCaixa } = useStore();
  const { canWrite, canWriteNf, canWriteCaixa, loading } = useRoles();
  const navigate = useNavigate();

  if (!loading && !canWrite) {
    navigate({ to: "/", replace: true });
  }

  const nfsHoje = useMemo(
    () => notas.filter((n) => isToday(n.createdAt)).sort(byCreatedDesc),
    [notas]
  );
  const caixaHoje = useMemo(
    () => caixa.filter((c) => isToday(c.createdAt)).sort(byCreatedDesc),
    [caixa]
  );

  const resolvedMode = useMemo(() => {
    if (!drawerMode) return null;
    if (drawerMode.kind === "new-nf") return { kind: "new-nf" as const };
    if (drawerMode.kind === "new-caixa") return { kind: "new-caixa" as const };
    if (drawerMode.kind === "edit-nf") {
      const nota = notas.find((n) => n.id === drawerMode.id);
      return nota ? { kind: "edit-nf" as const, nota } : null;
    }
    const c = caixa.find((x) => x.id === drawerMode.id);
    return c ? { kind: "edit-caixa" as const, caixa: c } : null;
  }, [drawerMode, notas, caixa]);

  const showCarteira = canWriteNf;
  const showCaixa = canWriteCaixa;
  const activeTab: Tab = showCarteira && (tab === "carteira" || !showCaixa) ? "carteira" : "caixa";

  const openFab = () => {
    setDrawerMode(activeTab === "carteira" ? { kind: "new-nf" } : { kind: "new-caixa" });
    setDrawerOpen(true);
  };

  const onEdit = (kind: "nf" | "caixa", id: string) => {
    setDrawerMode(kind === "nf" ? { kind: "edit-nf", id } : { kind: "edit-caixa", id });
    setDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-0">
      <header className="header-gradient sticky top-0 z-40 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-soft-foreground hover:text-gold hover:border-gold/40 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Painel
            </Link>
            <div className="text-[11px] font-semibold tracking-[0.18em] text-gold uppercase">
              ◆ Lançar
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-soft-foreground hover:text-red hover:border-red/40 transition-colors"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Lançamentos de hoje</h1>
            <TodayCounter nfs={nfsHoje.length} cx={caixaHoje.length} />
          </div>

          <div className="mt-4 inline-flex rounded-xl border border-border bg-surface p-1">
            {showCarteira && (
              <button
                onClick={() => setTab("carteira")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === "carteira" ? "bg-card text-gold ring-1 ring-gold/40" : "text-soft-foreground hover:text-foreground"
                }`}
              >
                Notas Fiscais
              </button>
            )}
            {showCaixa && (
              <button
                onClick={() => setTab("caixa")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === "caixa" ? "bg-card text-gold ring-1 ring-gold/40" : "text-soft-foreground hover:text-foreground"
                }`}
              >
                Caixa
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === "carteira" ? (
          <TodayList
            items={nfsHoje}
            empty="Nenhuma NF lançada hoje ainda. Toque em + para começar."
            renderItem={(n) => (
              <NfRow
                key={n.id}
                n={n}
                onEdit={() => onEdit("nf", n.id)}
                onDelete={() => removeNota(n.id)}
              />
            )}
          />
        ) : (
          <TodayList
            items={caixaHoje}
            empty="Nenhum movimento de caixa hoje ainda. Toque em + para começar."
            renderItem={(c) => (
              <CaixaRow
                key={c.id}
                c={c}
                onEdit={() => onEdit("caixa", c.id)}
                onDelete={() => removeCaixa(c.id)}
              />
            )}
          />
        )}
      </main>

      <button
        onClick={openFab}
        className="fixed bottom-6 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold text-background shadow-lg shadow-gold/30 transition-transform transition-colors duration-150 hover:bg-gold/90 active:scale-95 sm:right-6"
        aria-label="Novo lançamento"
      >
        <Plus className="h-6 w-6" />
      </button>

      <QuickAddDrawer
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) setDrawerMode(null);
        }}
        mode={resolvedMode}
        initialTab={activeTab === "carteira" ? "nf" : "caixa"}
      />
    </div>
  );
}

function byCreatedDesc(a: { createdAt?: string }, b: { createdAt?: string }) {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tb - ta;
}

function TodayCounter({ nfs, cx }: { nfs: number; cx: number }) {
  if (nfs === 0 && cx === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-soft-foreground">
        Nenhum lançamento hoje ainda.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gold/30 bg-gold-dim px-3 py-2 text-xs">
      <span className="font-semibold text-gold">Hoje:</span>{" "}
      <span className="text-foreground">
        {nfs} NF{nfs === 1 ? "" : "s"} · {cx} mov. de caixa
      </span>
    </div>
  );
}

function TodayList<T>({
  items,
  empty,
  renderItem,
}: {
  items: T[];
  empty: string;
  renderItem: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-16 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <p className="max-w-xs text-sm text-soft-foreground">{empty}</p>
      </div>
    );
  }
  return <div className="space-y-2">{items.map(renderItem)}</div>;
}

function timeLabel(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function NfRow({
  n,
  onEdit,
  onDelete,
}: {
  n: NFRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>{timeLabel(n.createdAt)}</span>
          <span>·</span>
          <span>{n.filial}</span>
          <span>·</span>
          <span>NF {n.nf}</span>
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{n.fornecedor}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-foreground">{brl(n.valor)}</div>
        <div className="mt-1 flex justify-end gap-1">
          <button onClick={onEdit} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-blue transition-transform transition-colors duration-150 hover:bg-blue-dim active:scale-95" aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-red transition-transform transition-colors duration-150 hover:bg-red-dim active:scale-95" aria-label="Excluir">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CaixaRow({
  c,
  onEdit,
  onDelete,
}: {
  c: CaixaRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tipo =
    c.entrada > 0 && c.saida === 0 ? "Entrada" : c.saida > 0 && c.entrada === 0 ? "Saída" : "Movimento";
  const valor = c.entrada > 0 ? c.entrada : c.saida;
  const tone = c.entrada > 0 ? "text-blue" : "text-red";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>{timeLabel(c.createdAt)}</span>
          <span>·</span>
          <span>{c.data}</span>
          <span>·</span>
          <span>{tipo}</span>
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {c.destino?.trim() || "—"}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${tone}`}>{brl(valor)}</div>
        <div className="mt-1 flex justify-end gap-1">
          <button onClick={onEdit} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-blue transition-transform transition-colors duration-150 hover:bg-blue-dim active:scale-95" aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-red transition-transform transition-colors duration-150 hover:bg-red-dim active:scale-95" aria-label="Excluir">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
