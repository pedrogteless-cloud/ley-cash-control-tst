import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, ClipboardEdit, Wallet, ArrowDownToLine, Settings2 } from "lucide-react";
import { useRoles } from "@/hooks/use-role";

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
  const onLancamentos = path.startsWith("/lancamentos");
  const onPainel = !onGerenciar && !onLancamentos;
  const { canWrite, isAdmin } = useRoles();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-7xl items-stretch justify-around px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1.5">
        {onPainel ? (
          <>
            <TabBtn
              active={activeTab === "carteira"}
              onClick={() => onChangeTab("carteira")}
              label="Carteira"
              icon={<Wallet className="h-5 w-5" />}
            />
            <TabBtn
              active={activeTab === "caixa"}
              onClick={() => onChangeTab("caixa")}
              label="Caixa"
              icon={<ArrowDownToLine className="h-5 w-5" />}
            />
          </>
        ) : (
          <NavLink to="/" active={false} label="Painel" icon={<BarChart3 className="h-5 w-5" />} />
        )}

        {canWrite && (
          <NavLink
            to="/lancamentos"
            active={onLancamentos}
            label="Lançar"
            icon={<ClipboardEdit className="h-5 w-5" />}
          />
        )}

        {isAdmin && (
          <NavLink
            to="/gerenciar"
            active={onGerenciar}
            label="Gerenciar"
            icon={<Settings2 className="h-5 w-5" />}
          />
        )}
      </div>
    </nav>
  );
}

function NavLink({
  to,
  active,
  label,
  icon,
}: {
  to: string;
  active: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
        active ? "text-gold" : "text-soft-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
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
