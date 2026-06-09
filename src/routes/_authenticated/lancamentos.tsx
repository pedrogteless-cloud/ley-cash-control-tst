import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ArrowLeft, LogOut, Pencil, Trash2, Inbox, CheckCircle2, Send, Search, Loader2 } from "lucide-react";
import { QuickAddDrawer } from "@/components/painel/QuickAddDrawer";
import { useStore, type NFRecord, type CaixaRecord } from "@/data/store";
import { useRoles } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { isAEnviar, isAguardando, isEnviado } from "@/data/painel";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const NF_FILTERS = ["Todas", "Enviar Cheque", "Aguardando Carga", "Enviados"] as const;
type NfFilter = (typeof NF_FILTERS)[number];

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

const fmtDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function Lancamentos() {
  const [tab, setTab] = useState<Tab>("carteira");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const {
    notas, caixa, removeNota, removeCaixa,
    confirmarEnvio, confirmandoEnvioId,
  } = useStore();
  const { canWrite, canWriteNf, canWriteCaixa, isAdmin, loading } = useRoles();
  const navigate = useNavigate();

  // Quem pode confirmar envio: admin, lancador_nf, lancador_caixa
  const canConfirmarEnvio = isAdmin || canWriteNf || canWriteCaixa;

  // Filtros / busca / modais
  const [nfFilter, setNfFilter] = useState<NfFilter>("Todas");
  const [nfSearch, setNfSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; fornecedor: string; valor: number } | null>(null);
  const [deleteNfTarget, setDeleteNfTarget] = useState<NFRecord | null>(null);
  const [deleteCaixaTarget, setDeleteCaixaTarget] = useState<CaixaRecord | null>(null);

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

  const todasNfs = useMemo(() => {
    const q = nfSearch.trim().toLowerCase();
    let arr = [...notas].sort(byCreatedDesc);
    if (nfFilter === "Enviar Cheque") arr = arr.filter(isAEnviar);
    else if (nfFilter === "Aguardando Carga") arr = arr.filter(isAguardando);
    else if (nfFilter === "Enviados") arr = arr.filter(isEnviado);
    if (q) arr = arr.filter((n) => n.fornecedor.toLowerCase().includes(q) || n.nf.toLowerCase().includes(q));
    return arr;
  }, [notas, nfFilter, nfSearch]);

  const caixaHistorico = useMemo(() => [...caixa].sort(byCreatedDesc), [caixa]);

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
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">Lançamentos e Ações</h1>
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-8">
        {activeTab === "carteira" ? (
          <>
            <Section title="Lançados hoje" subtitle="Atalho rápido para revisar o que você acabou de cadastrar.">
              <TodayList
                items={nfsHoje}
                empty="Nenhuma NF lançada hoje ainda. Toque em + para começar."
                renderItem={(n) => (
                  <NfRow
                    key={n.id}
                    n={n}
                    canConfirmar={canConfirmarEnvio}
                    confirmando={confirmandoEnvioId === n.id}
                    onEdit={() => onEdit("nf", n.id)}
                    onConfirmarEnvio={() => setConfirmTarget({ id: n.id, fornecedor: n.fornecedor, valor: n.valor })}
                    onDelete={() => setDeleteNfTarget(n)}
                  />
                )}
              />
            </Section>

            <Section
              title="Todas as NFs"
              subtitle="Lista completa para editar, confirmar envio de cheque (com baixa no caixa) ou excluir."
            >
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={nfSearch}
                    onChange={(e) => setNfSearch(e.target.value)}
                    placeholder="Buscar fornecedor ou nº NF..."
                    className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  />
                </div>
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                  {NF_FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setNfFilter(f)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform transition-colors duration-150 active:scale-95 ${
                        nfFilter === f ? "bg-gold text-background" : "bg-surface text-soft-foreground hover:bg-border/40"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                {todasNfs.length === 0 ? (
                  <EmptyBox text="Nenhuma NF neste filtro." />
                ) : (
                  <div className="space-y-2">
                    {todasNfs.map((n) => (
                      <NfRow
                        key={n.id}
                        n={n}
                        canConfirmar={canConfirmarEnvio}
                        confirmando={confirmandoEnvioId === n.id}
                        onEdit={() => onEdit("nf", n.id)}
                        onConfirmarEnvio={() => setConfirmTarget({ id: n.id, fornecedor: n.fornecedor, valor: n.valor })}
                        onDelete={() => setDeleteNfTarget(n)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Section>
          </>
        ) : (
          <>
            <Section title="Lançados hoje" subtitle="Atalho rápido para revisar o que você acabou de cadastrar.">
              <TodayList
                items={caixaHoje}
                empty="Nenhum movimento de caixa hoje ainda. Toque em + para começar."
                renderItem={(c) => (
                  <CaixaRow
                    key={c.id}
                    c={c}
                    onEdit={() => onEdit("caixa", c.id)}
                    onDelete={() => setDeleteCaixaTarget(c)}
                  />
                )}
              />
            </Section>

            <Section title="Histórico completo" subtitle="Todos os movimentos já registrados.">
              {caixaHistorico.length === 0 ? (
                <EmptyBox text="Nenhum movimento registrado." />
              ) : (
                <div className="space-y-2">
                  {caixaHistorico.map((c) => (
                    <CaixaRow
                      key={c.id}
                      c={c}
                      onEdit={() => onEdit("caixa", c.id)}
                      onDelete={() => setDeleteCaixaTarget(c)}
                    />
                  ))}
                </div>
              )}
            </Section>
          </>
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

      {/* Confirmar envio de cheque */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => !o && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio do cheque?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget && (
                <>
                  Confirmar envio do cheque para <strong>{confirmTarget.fornecedor}</strong> — <strong>{brl(confirmTarget.valor)}</strong>?
                  <br />
                  Esta ação dá baixa automática no caixa de hoje.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="active:scale-95 transition-transform">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTarget) confirmarEnvio(confirmTarget.id);
                setConfirmTarget(null);
              }}
              className="bg-orange text-background hover:bg-orange/90 active:scale-95 transition-transform"
            >
              Confirmar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir NF — com alerta sobre cheque enviado */}
      <AlertDialog open={!!deleteNfTarget} onOpenChange={(o) => !o && setDeleteNfTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que quer excluir esta NF?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteNfTarget && (
                <>
                  <strong>{deleteNfTarget.fornecedor}</strong> — NF {deleteNfTarget.nf} — <strong>{brl(deleteNfTarget.valor)}</strong>
                  <br /><br />
                  <span className="text-orange">
                    Atenção: se o cheque já foi enviado ao fornecedor, o correto é usar <strong>Confirmar envio</strong>,
                    não excluir. Confirmar envio registra a baixa no caixa; excluir apaga o registro permanentemente.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="active:scale-95 transition-transform">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteNfTarget) removeNota(deleteNfTarget.id);
                setDeleteNfTarget(null);
              }}
              className="bg-red text-background hover:bg-red/90 active:scale-95 transition-transform"
            >
              Excluir mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir caixa */}
      <AlertDialog open={!!deleteCaixaTarget} onOpenChange={(o) => !o && setDeleteCaixaTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir movimento de caixa?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCaixaTarget && (
                <>
                  Movimento de <strong>{deleteCaixaTarget.data}</strong> — {deleteCaixaTarget.destino || "sem destino"}.
                  <br />
                  Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="active:scale-95 transition-transform">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCaixaTarget) removeCaixa(deleteCaixaTarget.id);
                setDeleteCaixaTarget(null);
              }}
              className="bg-red text-background hover:bg-red/90 active:scale-95 transition-transform"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function byCreatedDesc(a: { createdAt?: string }, b: { createdAt?: string }) {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tb - ta;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-bold text-foreground sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-soft-foreground sm:text-sm">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="max-w-xs text-sm text-soft-foreground">{text}</p>
    </div>
  );
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
    return <EmptyBox text={empty} />;
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
  canConfirmar,
  confirmando,
  onEdit,
  onConfirmarEnvio,
  onDelete,
}: {
  n: NFRecord;
  canConfirmar: boolean;
  confirmando: boolean;
  onEdit: () => void;
  onConfirmarEnvio: () => void;
  onDelete: () => void;
}) {
  const aEnviar = isAEnviar(n);
  const enviado = isEnviado(n);
  const aguardando = isAguardando(n);

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {n.createdAt && <><span>{timeLabel(n.createdAt)}</span><span>·</span></>}
            <span>{n.filial}</span>
            <span>·</span>
            <span>NF {n.nf}</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{n.fornecedor}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {enviado ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-green-dim px-2 py-0.5 text-[11px] font-bold text-green">
                <CheckCircle2 className="h-3 w-3" /> Enviado em {fmtDate(n.chequeEnviadoEm)}
              </span>
            ) : aEnviar ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-dim px-2 py-0.5 text-[11px] font-bold text-orange">
                <Send className="h-3 w-3" /> ENVIAR CHEQUE
              </span>
            ) : aguardando ? (
              <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                Aguardando carga
              </span>
            ) : (
              <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                {n.entrega}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-foreground">{brl(n.valor)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border/60 pt-2">
        {canConfirmar && !enviado && (
          <button
            onClick={onConfirmarEnvio}
            disabled={confirmando}
            className="mr-auto inline-flex min-h-11 items-center gap-1.5 rounded-md bg-orange px-3 py-2 text-xs font-bold text-background transition-transform transition-colors duration-150 hover:bg-orange/90 active:scale-95 disabled:opacity-60"
          >
            {confirmando ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando...</>
            ) : (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Confirmar envio</>
            )}
          </button>
        )}
        <button
          onClick={onEdit}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-blue transition-transform transition-colors duration-150 hover:bg-blue-dim active:scale-95"
          aria-label="Editar"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
        <button
          onClick={onDelete}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-semibold text-red transition-transform transition-colors duration-150 hover:bg-red-dim active:scale-95"
          aria-label="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </button>
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
          {c.createdAt && <><span>{timeLabel(c.createdAt)}</span><span>·</span></>}
          <span>{c.data}</span>
          <span>·</span>
          <span>{tipo}</span>
          {c.origem === "auto_nf" && (
            <>
              <span>·</span>
              <span className="text-orange">auto NF</span>
            </>
          )}
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {c.destino?.trim() || "—"}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`text-sm font-bold ${tone}`}>{brl(valor)}</div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-blue transition-transform transition-colors duration-150 hover:bg-blue-dim active:scale-95"
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-red transition-transform transition-colors duration-150 hover:bg-red-dim active:scale-95"
            aria-label="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
