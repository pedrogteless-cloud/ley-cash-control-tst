import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/painel/AppHeader";
import { CarteiraTab } from "@/components/painel/CarteiraTab";
import { CaixaTab } from "@/components/painel/CaixaTab";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel de Cheques · Grupo Ley" },
      { name: "description", content: "Controle de cheques pré-datados e carteira de notas fiscais do Grupo Ley." },
      { property: "og:title", content: "Painel de Cheques · Grupo Ley" },
      { property: "og:description", content: "Controle de cheques pré-datados e carteira de notas fiscais." },
    ],
  }),
  component: Painel,
});

type Tab = "carteira" | "caixa";

function Painel() {
  const [tab, setTab] = useState<Tab>("carteira");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div className="inline-flex rounded-xl border border-border bg-surface p-1">
          {([
            { id: "carteira", label: "Carteira NFs" },
            { id: "caixa", label: "Caixa de Cheques" },
          ] as { id: Tab; label: string }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-card text-gold ring-1 ring-gold/40"
                  : "text-soft-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === "carteira" ? <CarteiraTab /> : <CaixaTab />}
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-sm font-semibold text-gold sm:px-6">
          Atualizado em 01 de junho de 2026
        </div>
      </footer>
    </div>
  );
}
