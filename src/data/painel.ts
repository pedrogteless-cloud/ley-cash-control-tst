export type NF = {
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number;
  statusNf: string;
  entrega: string;
};

export const isEnviar = (n: NF) =>
  n.statusNf.trim().toUpperCase() === "CHEGOU" && n.entrega.toUpperCase().includes("CHEGOU");

export type CaixaDia = {
  data: string;
  saldoAnterior: number;
  entrada: number;
  saida: number;
  saldoTotal: number;
  destino?: string;
};
