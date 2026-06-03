import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { notas as seedNotas, caixa as seedCaixa, type NF, type CaixaDia } from "@/data/painel";

const STORAGE_KEY = "painel-ley-v1";

export type NFRecord = NF & { id: string };
export type CaixaRecord = CaixaDia & { id: string };

type State = { notas: NFRecord[]; caixa: CaixaRecord[] };

const uid = () => Math.random().toString(36).slice(2, 10);

const seed = (): State => ({
  notas: seedNotas.map((n) => ({ ...n, id: uid() })),
  caixa: seedCaixa.map((c) => ({ ...c, id: uid() })),
});

function load(): State {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as State;
    if (!parsed.notas || !parsed.caixa) return seed();
    return parsed;
  } catch {
    return seed();
  }
}

type Ctx = {
  notas: NFRecord[];
  caixa: CaixaRecord[];
  addNota: (n: Omit<NFRecord, "id">) => void;
  updateNota: (id: string, n: Omit<NFRecord, "id">) => void;
  removeNota: (id: string) => void;
  addCaixa: (c: Omit<CaixaRecord, "id">) => void;
  updateCaixa: (id: string, c: Omit<CaixaRecord, "id">) => void;
  removeCaixa: (id: string) => void;
  resetAll: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [state]);

  const value = useMemo<Ctx>(
    () => ({
      notas: state.notas,
      caixa: state.caixa,
      addNota: (n) => setState((s) => ({ ...s, notas: [{ ...n, id: uid() }, ...s.notas] })),
      updateNota: (id, n) =>
        setState((s) => ({ ...s, notas: s.notas.map((x) => (x.id === id ? { ...n, id } : x)) })),
      removeNota: (id) => setState((s) => ({ ...s, notas: s.notas.filter((x) => x.id !== id) })),
      addCaixa: (c) =>
        setState((s) => ({
          ...s,
          caixa: [...s.caixa, { ...c, id: uid() }].sort((a, b) => a.data.localeCompare(b.data)),
        })),
      updateCaixa: (id, c) =>
        setState((s) => ({
          ...s,
          caixa: s.caixa
            .map((x) => (x.id === id ? { ...c, id } : x))
            .sort((a, b) => a.data.localeCompare(b.data)),
        })),
      removeCaixa: (id) =>
        setState((s) => ({ ...s, caixa: s.caixa.filter((x) => x.id !== id) })),
      resetAll: () => setState(seed()),
    }),
    [state],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
