import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  createdAt: r.created_at,
});

const QK = {
  notas: ["notas_fiscais"] as const,
  caixa: ["caixa_movimentos"] as const,
};

export function useStore() {
  const qc = useQueryClient();

  const notasQ = useQuery({
    queryKey: QK.notas,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("id, fornecedor, nf, filial, valor, status_nf, entrega, created_at")
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
        .select("id, data, saldo_anterior, entrada, saida, saldo_total, destino, created_at")
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as CaixaRow[]).map(mapCaixa);
    },
  });

  const invalidateNotas = () => qc.invalidateQueries({ queryKey: QK.notas });
  const invalidateCaixa = () => qc.invalidateQueries({ queryKey: QK.caixa });

  const addNotaM = useMutation({
    mutationFn: async (n: Omit<NFRecord, "id">) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("notas_fiscais").insert({
        fornecedor: n.fornecedor,
        nf: n.nf,
        filial: n.filial,
        valor: n.valor,
        status_nf: n.statusNf,
        entrega: n.entrega,
        criado_por: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateNotas();
      toast.success("Nota fiscal adicionada");
    },
    onError: (e: Error) => toast.error(`Erro ao salvar: ${e.message}`),
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
    onSuccess: () => {
      invalidateNotas();
      toast.success("Nota fiscal atualizada");
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  });

  const removeNotaM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateNotas();
      toast.success("Nota fiscal removida");
    },
    onError: (e: Error) => toast.error(`Erro ao remover: ${e.message}`),
  });

  const addCaixaM = useMutation({
    mutationFn: async (c: Omit<CaixaRecord, "id">) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("caixa_movimentos").insert({
        data: c.data,
        saldo_anterior: c.saldoAnterior,
        entrada: c.entrada,
        saida: c.saida,
        saldo_total: c.saldoTotal,
        destino: c.destino ?? null,
        criado_por: u.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCaixa();
      toast.success("Movimento de caixa salvo");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
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
    onSuccess: () => {
      invalidateCaixa();
      toast.success("Movimento atualizado");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const removeCaixaM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("caixa_movimentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateCaixa();
      toast.success("Movimento removido");
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
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
  };
}
