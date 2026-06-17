import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { NF, CaixaDia } from "@/data/painel";

export type NFRecord = NF & { id: string; createdAt?: string; statusEnvio?: string | null };
export type CaixaRecord = CaixaDia & { id: string; createdAt?: string; nfsResolvidas?: string[] };

type NfRow = {
  id: string;
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number | string;
  status_nf: string;
  entrega: string;
  cheque_enviado_em?: string | null;
  status_envio?: string | null;
  cheque_separado_em?: string | null;
  separado_por?: string | null;
  created_at?: string;
};

type CaixaRow = {
  id: string;
  data: string;
  saldo_anterior: number | string;
  entrada: number | string;
  saida: number | string;
  saldo_total: number | string;
  destino: string | null;
  origem?: string | null;
  nfs_resolvidas?: string[] | null;
  created_at?: string;
};

const toNum = (v: number | string) => (typeof v === "number" ? v : Number(v));
const toStringArray = (v: string[] | null | undefined) =>
  Array.isArray(v) ? v.map(String) : undefined;

const mapNf = (r: NfRow): NFRecord => ({
  id: r.id,
  fornecedor: r.fornecedor,
  nf: r.nf,
  filial: r.filial,
  valor: toNum(r.valor),
  statusNf: r.status_nf,
  entrega: r.entrega,
  chequeEnviadoEm: r.cheque_enviado_em ?? undefined,
  statusEnvio: r.status_envio ?? null,
  chequeSeparadoEm: r.cheque_separado_em ?? undefined,
  separadoPor: r.separado_por ?? undefined,
  createdAt: r.created_at,
});

const mapCaixa = (r: CaixaRow): CaixaRecord => ({
  id: r.id,
  data: r.data,
  saldoAnterior: toNum(r.saldo_anterior),
  entrada: toNum(r.entrada),
  saida: toNum(r.saida),
  saldoTotal: toNum(r.saldo_total),
  destino: r.destino ?? undefined,
  origem: r.origem ?? undefined,
  nfsResolvidas: toStringArray(r.nfs_resolvidas),
  createdAt: r.created_at,
});

/**
 * Deriva saldo_anterior e saldo_total em cadeia a partir dos dados brutos.
 * Seed = saldo_anterior da primeira linha (único valor que o usuário controla).
 * Garante consistência mesmo após edições, inserções retroativas ou exclusões.
 */
function computeChain(rows: CaixaRecord[]): CaixaRecord[] {
  if (!rows.length) return [];
  const result: CaixaRecord[] = [];
  let running = rows[0].saldoAnterior;
  for (const row of rows) {
    const saldoAnterior = running;
    const saldoTotal = Math.round((saldoAnterior + row.entrada - row.saida) * 100) / 100;
    result.push({ ...row, saldoAnterior, saldoTotal });
    running = saldoTotal;
  }
  return result;
}

const QK = {
  notas: ["notas_fiscais"] as const,
  caixa: ["caixa_movimentos"] as const,
};

async function snapshot<T>(qc: QueryClient, key: readonly unknown[]) {
  await qc.cancelQueries({ queryKey: key });
  return qc.getQueryData<T>(key);
}

export function useStore() {
  const qc = useQueryClient();

  const notasQ = useQuery({
    queryKey: QK.notas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("id, fornecedor, nf, filial, valor, status_nf, entrega, cheque_enviado_em, status_envio, cheque_separado_em, separado_por, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as NfRow[]).map(mapNf);
    },
  });

  const caixaQ = useQuery({
    queryKey: QK.caixa,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_movimentos")
        .select("id, data, saldo_anterior, entrada, saida, saldo_total, destino, origem, nfs_resolvidas, created_at")
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return computeChain((data as CaixaRow[]).map(mapCaixa));
    },
  });

  const invalidateNotas = () => qc.invalidateQueries({ queryKey: QK.notas });
  const invalidateCaixa = () => qc.invalidateQueries({ queryKey: QK.caixa });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`store-realtime-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas_fiscais" }, () => invalidateNotas())
      .on("postgres_changes", { event: "*", schema: "public", table: "caixa_movimentos" }, () => invalidateCaixa())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ============ NF MUTATIONS ============

  const addNotaM = useMutation({
    mutationFn: async (n: Omit<NFRecord, "id">) => {
      const { data: s } = await supabase.auth.getSession();
      const { error } = await supabase.from("notas_fiscais").insert({
        fornecedor: n.fornecedor,
        nf: n.nf,
        filial: n.filial,
        valor: n.valor,
        status_nf: n.statusNf,
        entrega: n.entrega,
        criado_por: s.session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onMutate: async (n) => {
      const prev = await snapshot<NFRecord[]>(qc, QK.notas);
      const optimistic: NFRecord = { ...n, id: `optimistic-${Date.now()}`, createdAt: new Date().toISOString() };
      qc.setQueryData<NFRecord[]>(QK.notas, (old) => [optimistic, ...(old ?? [])]);
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.notas, ctx.prev);
      toast.error(`Erro ao salvar: ${e.message}`);
    },
    onSuccess: () => toast.success("Nota fiscal adicionada"),
    onSettled: () => invalidateNotas(),
  });

  const updateNotaM = useMutation({
    mutationFn: async ({ id, n }: { id: string; n: Omit<NFRecord, "id"> }) => {
      const { error } = await supabase
        .from("notas_fiscais")
        .update({ fornecedor: n.fornecedor, nf: n.nf, filial: n.filial, valor: n.valor, status_nf: n.statusNf, entrega: n.entrega })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, n }) => {
      const prev = await snapshot<NFRecord[]>(qc, QK.notas);
      qc.setQueryData<NFRecord[]>(QK.notas, (old) => (old ?? []).map((x) => (x.id === id ? { ...x, ...n } : x)));
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.notas, ctx.prev);
      toast.error(`Erro ao atualizar: ${e.message}`);
    },
    onSuccess: () => toast.success("Nota fiscal atualizada"),
    onSettled: () => invalidateNotas(),
  });

  const removeNotaM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const prev = await snapshot<NFRecord[]>(qc, QK.notas);
      const removed = (prev ?? []).find((n) => n.id === id);
      qc.setQueryData<NFRecord[]>(QK.notas, (old) => (old ?? []).filter((n) => n.id !== id));
      return { prev, removed };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.notas, ctx.prev);
      toast.error(`Erro ao remover: ${e.message}`);
    },
    onSuccess: (_d, _id, ctx) => {
      const removed = ctx?.removed;
      toast.success("Nota fiscal removida", {
        action: removed
          ? { label: "Desfazer", onClick: () => { const { id: _omit, createdAt: _c, statusEnvio: _se, chequeSeparadoEm: _cs, separadoPor: _sp, chequeEnviadoEm: _ce, ...rest } = removed; addNotaM.mutate(rest); } }
          : undefined,
        duration: 6000,
      });
    },
    onSettled: () => invalidateNotas(),
  });

  // ============ CAIXA MUTATIONS ============

  const addCaixaM = useMutation({
    mutationFn: async (c: Omit<CaixaRecord, "id">) => {
      const { data: s } = await supabase.auth.getSession();
      const { error } = await supabase.from("caixa_movimentos").insert({
        data: c.data, saldo_anterior: c.saldoAnterior, entrada: c.entrada, saida: c.saida,
        saldo_total: c.saldoTotal, destino: c.destino ?? null,
        nfs_resolvidas: c.nfsResolvidas ?? null,
        criado_por: s.session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onMutate: async (c) => {
      const prev = await snapshot<CaixaRecord[]>(qc, QK.caixa);
      const optimistic: CaixaRecord = { ...c, id: `optimistic-${Date.now()}`, createdAt: new Date().toISOString() };
      qc.setQueryData<CaixaRecord[]>(QK.caixa, (old) => computeChain([...(old ?? []), optimistic]));
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.caixa, ctx.prev);
      toast.error(`Erro: ${e.message}`);
    },
    onSuccess: () => toast.success("Movimento de caixa salvo"),
    onSettled: () => invalidateCaixa(),
  });

  const updateCaixaM = useMutation({
    mutationFn: async ({ id, c }: { id: string; c: Omit<CaixaRecord, "id"> }) => {
      const { error } = await supabase
        .from("caixa_movimentos")
        .update({ data: c.data, entrada: c.entrada, saida: c.saida, destino: c.destino ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, c }) => {
      const prev = await snapshot<CaixaRecord[]>(qc, QK.caixa);
      qc.setQueryData<CaixaRecord[]>(QK.caixa, (old) =>
        computeChain((old ?? []).map((x) => (x.id === id ? { ...x, ...c } : x))),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.caixa, ctx.prev);
      toast.error(`Erro: ${e.message}`);
    },
    onSuccess: () => toast.success("Movimento atualizado"),
    onSettled: () => invalidateCaixa(),
  });

  const removeCaixaM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("caixa_movimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      const prev = await snapshot<CaixaRecord[]>(qc, QK.caixa);
      const removed = (prev ?? []).find((c) => c.id === id);
      qc.setQueryData<CaixaRecord[]>(QK.caixa, (old) => computeChain((old ?? []).filter((c) => c.id !== id)));
      return { prev, removed };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.caixa, ctx.prev);
      toast.error(`Erro: ${e.message}`);
    },
    onSuccess: (_d, _id, ctx) => {
      const removed = ctx?.removed;
      toast.success("Movimento removido", {
        action: removed
          ? { label: "Desfazer", onClick: () => { const { id: _omit, createdAt: _c, nfsResolvidas: _nr, ...rest } = removed; addCaixaM.mutate(rest); } }
          : undefined,
        duration: 6000,
      });
    },
    onSettled: () => invalidateCaixa(),
  });

  // ============ SEPARAR / CANCELAR SEPARAÇÃO ============

  const separarNfM = useMutation({
    mutationFn: async (nfId: string) => {
      const { data, error } = await supabase.rpc("separar_nf", { p_nf_id: nfId });
      if (error) throw error;
      return data as { id: string; fornecedor: string; nf: string; valor: number };
    },
    onMutate: async (nfId) => {
      const prev = await snapshot<NFRecord[]>(qc, QK.notas);
      const now = new Date().toISOString();
      qc.setQueryData<NFRecord[]>(QK.notas, (old) =>
        (old ?? []).map((n) => n.id === nfId ? { ...n, chequeSeparadoEm: now } : n),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.notas, ctx.prev);
      toast.error(`Erro ao separar: ${e.message}`);
    },
    onSuccess: (data) => toast.success(`${data.fornecedor} separado para envio`),
    onSettled: () => invalidateNotas(),
  });

  const cancelarSeparacaoM = useMutation({
    mutationFn: async (nfId: string) => {
      const { data, error } = await supabase.rpc("cancelar_separacao_nf", { p_nf_id: nfId });
      if (error) throw error;
      return data as { id: string; fornecedor: string };
    },
    onMutate: async (nfId) => {
      const prev = await snapshot<NFRecord[]>(qc, QK.notas);
      qc.setQueryData<NFRecord[]>(QK.notas, (old) =>
        (old ?? []).map((n) => n.id === nfId ? { ...n, chequeSeparadoEm: undefined, separadoPor: undefined } : n),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK.notas, ctx.prev);
      toast.error(`Erro ao cancelar separação: ${e.message}`);
    },
    onSuccess: (data) => toast.success(`Separação de ${data.fornecedor} cancelada`),
    onSettled: () => invalidateNotas(),
  });

  // ============ ENVIAR CHEQUE (baixa automática de caixa) ============

  const enviarChequeM = useMutation({
    mutationFn: async ({ nfIds, fornecedor, valorEnviado }: { nfIds: string[]; fornecedor: string; valorEnviado: number }) => {
      if (!nfIds.length) throw new Error("Selecione ao menos uma NF");
      if (valorEnviado <= 0) throw new Error("Informe o valor enviado");

      const { data, error } = await supabase.rpc("enviar_cheque_nfs", {
        p_nf_ids: nfIds,
        p_fornecedor: fornecedor,
        p_valor_enviado: valorEnviado,
      });
      if (error) throw error;

      return data as {
        saldo_total?: number;
        saldoTotal?: number;
        saldo_anterior?: number;
        saldoAnterior?: number;
        valor_enviado?: number;
        valor_titulos?: number;
      };
    },
    onSuccess: async (result, vars) => {
      invalidateNotas();
      invalidateCaixa();
      const novoSaldo = Number(result.saldo_total ?? result.saldoTotal ?? 0);
      toast.success(`Saída de cheque registrada para ${vars.fornecedor}`);

      // Telegram — busca nome do usuário
      try {
        await supabase.functions.invoke("telegram-notify", {
          body: {
            type: "envio_cheque",
            fornecedor: vars.fornecedor,
            qtdNfs: vars.nfIds.length,
            valor: vars.valorEnviado,
            novoSaldo,
          },
        });
      } catch (err) {
        console.error("telegram-notify invoke failed", err);
      }
    },
    onError: (e: Error) => toast.error(`Erro ao registrar saída: ${e.message}`),
  });

  return {
    notas: notasQ.data ?? [],
    caixa: caixaQ.data ?? [],
    loading: notasQ.isLoading || caixaQ.isLoading,
    addNota: (n: Omit<NFRecord, "id">) => addNotaM.mutate(n),
    updateNota: (id: string, n: Omit<NFRecord, "id">) => updateNotaM.mutate({ id, n }),
    removeNota: (id: string) => removeNotaM.mutate(id),
    addCaixa: (c: Omit<CaixaRecord, "id">) => addCaixaM.mutate(c),
    updateCaixa: (id: string, c: Omit<CaixaRecord, "id">) => updateCaixaM.mutate({ id, c }),
    removeCaixa: (id: string) => removeCaixaM.mutate(id),
    separarNf: (id: string) => separarNfM.mutate(id),
    cancelarSeparacao: (id: string) => cancelarSeparacaoM.mutate(id),
    enviarCheque: (vars: { nfIds: string[]; fornecedor: string; valorEnviado: number }) =>
      enviarChequeM.mutateAsync(vars),
    addingNota: addNotaM.isPending,
    addingCaixa: addCaixaM.isPending,
    isSeparandoNf: separarNfM.isPending ? separarNfM.variables ?? null : null,
    isCancelando: cancelarSeparacaoM.isPending ? cancelarSeparacaoM.variables ?? null : null,
    isEnviandoCheque: enviarChequeM.isPending,
  };
}
