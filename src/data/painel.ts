export type NF = {
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number;
  statusNf: string;
  entrega: string;
};

export const isEnviar = (n: NF) => n.entrega.toUpperCase().includes("CHEGOU") && !n.entrega.toUpperCase().includes("NÃO");

export const isAguardando = (n: NF) => n.entrega.toUpperCase().includes("NÃO");

export type CaixaDia = {
  data: string;
  saldoAnterior: number;
  entrada: number;
  saida: number;
  saldoTotal: number;
  destino?: string;
};
