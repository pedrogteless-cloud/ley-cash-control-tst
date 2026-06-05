import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ArrowLeft } from "lucide-react";
import { CarteiraTab } from "@/components/painel/CarteiraTab";
import { CaixaTab } from "@/components/painel/CaixaTab";
import { MobileTabBar } from "@/components/painel/MobileTabBar";
import { QuickAddDrawer } from "@/components/painel/QuickAddDrawer";
import { useStore } from "@/data/store";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos · Grupo Ley" },
      { name: "description", content: "Registrar e editar notas fiscais e movimentos de caixa." },
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

function Lancamentos() {
  const [tab, setTab] = useState<Tab>("carteira");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const { notas, caixa } = useStore();
  const { canWrite, canWriteNf, canWriteCaixa, loading } = useRoles();
  const navigate = useNavigate();

  // Redireciona quem não tem permissão de lançar
  if (!loading && !canWrite) {
    navigate({ to: "/", replace: true });
  }

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

  const openFab = () => {
    setDrawerMode(tab === "carteira" ? { kind: "new-nf" } : { kind: "new-caixa" });
    setDrawerOpen(true);
  };

  const onEdit = (kind: "nf" | "caixa", id: string) => {
    setDrawerMode(kind === "nf" ? { kind: "edit-nf", id } : { kind: "edit-caixa", id });
    setDrawerOpen(true);
  };

  // Tabs disponíveis dependem da permissão do usuário
  const showCarteira = canWriteNf;
  const showCaixa = canWriteCaixa;
  const activeTab: Tab = showCarteira && (tab === "carteira" || !showCaixa) ? "carteira" : "caixa";

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
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
              ◆ Lançamentos
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
            <div>
              <h1 className="text-xl font-bold text-foreground sm:text-2xl">Lançamentos</h1>
              <p className="text-xs text-soft-foreground sm:text-sm">
                Registre novas notas e movimentos de caixa.
              </p>
            </div>
            <TodayCounter notas={notas} caixa={caixa} />
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
          <CarteiraTab onEdit={(_k, id) => onEdit("nf", id)} />
        ) : (
          <CaixaTab onEdit={(_k, id) => onEdit("caixa", id)} />
        )}
      </main>

      <button
        onClick={openFab}
        className="fixed bottom-20 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold text-background shadow-lg shadow-gold/30 hover:bg-gold/90 sm:bottom-6 sm:right-6"
        aria-label="Novo lançamento"
      >
        <Plus className="h-6 w-6" />
      </button>

      <MobileTabBar activeTab={activeTab} onChangeTab={setTab} />

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

function TodayCounter({
  notas,
  caixa,
}: {
  notas: { createdAt?: string }[];
  caixa: { createdAt?: string }[];
}) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();

  const isToday = (iso?: string) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= startMs;
  };

  const nfHoje = notas.filter((n) => isToday(n.createdAt)).length;
  const caixaHoje = caixa.filter((c) => isToday(c.createdAt)).length;

  if (nfHoje === 0 && caixaHoje === 0) {
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
        {nfHoje} NF{nfHoje === 1 ? "" : "s"} · {caixaHoje} mov. de caixa
      </span>
    </div>
  );
}

