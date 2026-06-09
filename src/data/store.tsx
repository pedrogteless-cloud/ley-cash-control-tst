import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { NF, CaixaDia } from "@/data/painel";

export type NFRecord = NF & { id: string; createdAt?: string };
export type CaixaRecord = CaixaDia & { id: string; createdAt?: string };

type NfRow = {
  id: string;
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number | string;
  status_nf: string;
  entrega: string;
  cheque_enviado_em?: string | null;
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
  created_at?: string;
};

const toNum = (v: number | string) => (typeof v === "number" ? v : Number(v));

const mapNf = (r: NfRow): NFRecord => ({
  id: r.id,
  fornecedor: r.fornecedor,
  nf: r.nf,
  filial: r.filial,
  valor: toNum(r.valor),
  statusNf: r.status_nf,
  entrega: r.entrega,
  chequeEnviadoEm: r.cheque_enviado_em ?? undefined,
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
  createdAt: r.created_at,
});

const QK = {
  notas: ["notas_fiscais"] as const,
  caixa: ["caixa_movimentos"] as const,
};

const todayDDMM = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const todayDDMMYYYY = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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
        .select("id, fornecedor, nf, filial, valor, status_nf, entrega, cheque_enviado_em, created_at")
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
        .select("id, data, saldo_anterior, entrada, saida, saldo_total, destino, origem, created_at")
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as CaixaRow[]).map(mapCaixa);
    },
  });

  const invalidateNotas = () => qc.invalidateQueries({ queryKey: QK.notas });
  const invalidateCaixa = () => qc.invalidateQueries({ queryKey: QK.caixa });
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
      const optimistic: NFRecord = {
        ...n,
        id: `optimistic-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
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
        .update({
          fornecedor: n.fornecedor,
          nf: n.nf,
          filial: n.filial,
          valor: n.valor,
          status_nf: n.statusNf,
          entrega: n.entrega,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, n }) => {
      const prev = await snapshot<NFRecord[]>(qc, QK.notas);
      qc.setQueryData<NFRecord[]>(QK.notas, (old) =>
        (old ?? []).map((x) => (x.id === id ? { ...x, ...n } : x)),
      );
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
          ? {
              label: "Desfazer",
              onClick: () => {
                const { id: _omit, createdAt: _c, ...rest } = removed;
                addNotaM.mutate(rest);
              },
            }
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
        data: c.data,
        saldo_anterior: c.saldoAnterior,
        entrada: c.entrada,
        saida: c.saida,
        saldo_total: c.saldoTotal,
        destino: c.destino ?? null,
        criado_por: s.session?.user.id ?? null,
      });
      if (error) throw error;
    },
    onMutate: async (c) => {
      const prev = await snapshot<CaixaRecord[]>(qc, QK.caixa);
      const optimistic: CaixaRecord = {
        ...c,
        id: `optimistic-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<CaixaRecord[]>(QK.caixa, (old) => [...(old ?? []), optimistic]);
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
        .update({
          data: c.data,
          saldo_anterior: c.saldoAnterior,
          entrada: c.entrada,
          saida: c.saida,
          saldo_total: c.saldoTotal,
          destino: c.destino ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, c }) => {
      const prev = await snapshot<CaixaRecord[]>(qc, QK.caixa);
      qc.setQueryData<CaixaRecord[]>(QK.caixa, (old) =>
        (old ?? []).map((x) => (x.id === id ? { ...x, ...c } : x)),
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
      qc.setQueryData<CaixaRecord[]>(QK.caixa, (old) => (old ?? []).filter((c) => c.id !== id));
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
          ? {
              label: "Desfazer",
              onClick: () => {
                const { id: _omit, createdAt: _c, ...rest } = removed;
                addCaixaM.mutate(rest);
              },
            }
          : undefined,
        duration: 6000,
      });
    },
    onSettled: () => invalidateCaixa(),
  });

  // ============ CONFIRMAR ENVIO ============

  const confirmarEnvioM = useMutation({
    mutationFn: async (nfId: string) => {
      const { data, error } = await supabase.rpc("confirmar_envio_nf", { p_nf_id: nfId });
      if (error) throw error;
      return data as { id: string; fornecedor: string; nf: string; valor: number };
    },
    onMutate: async (nfId) => {
      const prevNotas = await snapshot<NFRecord[]>(qc, QK.notas);
      const prevCaixa = await snapshot<CaixaRecord[]>(qc, QK.caixa);
      const nf = (prevNotas ?? []).find((n) => n.id === nfId);
      if (!nf) return { prevNotas, prevCaixa };

      const nowIso = new Date().toISOString();
      qc.setQueryData<NFRecord[]>(QK.notas, (old) =>
        (old ?? []).map((n) => (n.id === nfId ? { ...n, chequeEnviadoEm: nowIso } : n)),
      );

      const hoje = todayDDMM();
      qc.setQueryData<CaixaRecord[]>(QK.caixa, (old) => {
        const arr = [...(old ?? [])];
        const idx = arr.map((c, i) => ({ c, i })).filter((x) => x.c.data === hoje).pop();
        if (idx) {
          const c = idx.c;
          const novaSaida = c.saida + nf.valor;
          const novoDestino =
            !c.destino || c.destino.trim() === ""
              ? nf.fornecedor
              : c.destino.includes(nf.fornecedor)
                ? c.destino
                : `${c.destino} + ${nf.fornecedor}`;
          arr[idx.i] = {
            ...c,
            saida: novaSaida,
            saldoTotal: c.saldoAnterior + c.entrada - novaSaida,
            destino: novoDestino,
          };
        } else {
          const last = arr[arr.length - 1];
          const saldoAnt = last?.saldoTotal ?? 0;
          arr.push({
            id: `optimistic-${Date.now()}`,
            data: hoje,
            saldoAnterior: saldoAnt,
            entrada: 0,
            saida: nf.valor,
            saldoTotal: saldoAnt - nf.valor,
            destino: nf.fornecedor,
            origem: "auto_nf",
            createdAt: nowIso,
          });
        }
        return arr;
      });

      return { prevNotas, prevCaixa, nf };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prevNotas) qc.setQueryData(QK.notas, ctx.prevNotas);
      if (ctx?.prevCaixa) qc.setQueryData(QK.caixa, ctx.prevCaixa);
      toast.error(`Erro ao confirmar envio: ${e.message}`);
    },
    onSuccess: async (data) => {
      toast.success(`Cheque enviado: ${data.fornecedor}`);
      try {
        const { data: s } = await supabase.auth.getSession();
        const uid = s.session?.user.id;
        let usuario: string | undefined;
        if (uid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name, email")
            .eq("id", uid)
            .maybeSingle();
          usuario = prof?.display_name || prof?.email || s.session?.user.email || undefined;
        }
        await supabase.functions.invoke("telegram-notify", {
          body: {
            type: "cheque_enviado",
            notas: [{ fornecedor: data.fornecedor, nf: data.nf, valor: Number(data.valor) }],
            data: todayDDMMYYYY(),
            usuario,
          },
        });
      } catch (err) {
        console.error("telegram-notify invoke failed", err);
      }
    },
    onSettled: () => {
      invalidateNotas();
      invalidateCaixa();
    },
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
    confirmarEnvio: (id: string) => confirmarEnvioM.mutate(id),
    confirmandoEnvioId: confirmarEnvioM.isPending ? confirmarEnvioM.variables ?? null : null,
    addingNota: addNotaM.isPending,
    addingCaixa: addCaixaM.isPending,
  };
}
