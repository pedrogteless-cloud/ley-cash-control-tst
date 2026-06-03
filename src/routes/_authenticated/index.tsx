import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/painel/AppHeader";
import { CarteiraTab } from "@/components/painel/CarteiraTab";
import { CaixaTab } from "@/components/painel/CaixaTab";
import { MobileTabBar } from "@/components/painel/MobileTabBar";
import { QuickAddDrawer } from "@/components/painel/QuickAddDrawer";
import { useStore } from "@/data/store";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel de Cheques · Grupo Ley" },
      { name: "description", content: "Controle de cheques pré-datados e carteira de notas fiscais do Grupo Ley." },
    ],
  }),
  component: Painel,
});

type Tab = "carteira" | "caixa";
type DrawerMode =
  | { kind: "new-nf" }
  | { kind: "new-caixa" }
  | { kind: "edit-nf"; id: string }
  | { kind: "edit-caixa"; id: string };

function Painel() {
  const [tab, setTab] = useState<Tab>("carteira");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const { notas, caixa } = useStore();
  const { canWrite } = useRoles();

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

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-0">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 hidden sm:block">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {([
            { id: "carteira", label: "Carteira NFs" },
            { id: "caixa", label: "Caixa de Cheques" },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id ? "bg-card text-gold ring-1 ring-gold/40" : "text-soft-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === "carteira" ? (
          <CarteiraTab onEdit={(_k, id) => onEdit("nf", id)} />
        ) : (
          <CaixaTab onEdit={(_k, id) => onEdit("caixa", id)} />
        )}
      </main>

      <footer className="border-t border-border bg-surface mb-16 sm:mb-0">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-sm font-semibold text-gold sm:px-6">
          Atualizado em 01 de junho de 2026
        </div>
      </footer>

      {canWrite && (
        <button
          onClick={openFab}
          className="fixed bottom-20 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gold text-background shadow-lg shadow-gold/30 hover:bg-gold/90 sm:bottom-6 sm:right-6"
          aria-label="Novo lançamento"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <MobileTabBar activeTab={tab} onChangeTab={setTab} />

      <QuickAddDrawer
        open={drawerOpen}
        onOpenChange={(o) => {
          setDrawerOpen(o);
          if (!o) setDrawerMode(null);
        }}
        mode={resolvedMode}
        initialTab={tab === "carteira" ? "nf" : "caixa"}
      />
    </div>
  );
}
