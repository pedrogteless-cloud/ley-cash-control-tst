import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { AppHeader } from "@/components/painel/AppHeader";
import { CarteiraTab } from "@/components/painel/CarteiraTab";
import { CaixaTab } from "@/components/painel/CaixaTab";
import { MobileTabBar } from "@/components/painel/MobileTabBar";
import { useStore } from "@/data/store";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel de Cheques · Grupo Ley" },
      { name: "description", content: "Painel de análise: carteira de NFs e caixa de cheques do Grupo Ley." },
    ],
  }),
  component: Painel,
});

type Tab = "carteira" | "caixa";

function Painel() {
  const [tab, setTab] = useState<Tab>("carteira");

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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-blue/30 bg-blue-dim/40 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
          <div className="text-soft-foreground">
            Este é o <span className="font-semibold text-foreground">painel de análise</span>.
            Os números aqui são apenas para leitura — para registrar NFs ou movimentos de caixa, acesse <span className="font-semibold text-gold">Lançamentos</span>.
          </div>
        </div>

        {tab === "carteira" ? <CarteiraTab readOnly /> : <CaixaTab readOnly />}
      </main>

      <footer className="border-t border-border bg-surface mb-16 sm:mb-0">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-sm font-semibold text-gold sm:px-6">
          Atualizado em 01 de junho de 2026
        </div>
      </footer>

      <MobileTabBar activeTab={tab} onChangeTab={setTab} />
    </div>
  );
}
