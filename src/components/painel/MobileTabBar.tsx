import { Link, useRouterState } from "@tanstack/react-router";
import { Wallet, ArrowDownToLine, Settings2 } from "lucide-react";

type Tab = "carteira" | "caixa";

export function MobileTabBar({
  activeTab,
  onChangeTab,
}: {
  activeTab: Tab;
  onChangeTab: (t: Tab) => void;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const onGerenciar = path.startsWith("/gerenciar");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-7xl items-stretch justify-around px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1.5">
        <TabBtn
          active={!onGerenciar && activeTab === "carteira"}
          onClick={() => onChangeTab("carteira")}
          label="Carteira"
          icon={<Wallet className="h-5 w-5" />}
        />
        <TabBtn
          active={!onGerenciar && activeTab === "caixa"}
          onClick={() => onChangeTab("caixa")}
          label="Caixa"
          icon={<ArrowDownToLine className="h-5 w-5" />}
        />
        <Link
          to="/gerenciar"
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
            onGerenciar ? "text-gold" : "text-soft-foreground"
          }`}
        >
          <Settings2 className="h-5 w-5" />
          Gerenciar
        </Link>
      </div>
    </nav>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
        active ? "text-gold" : "text-soft-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
