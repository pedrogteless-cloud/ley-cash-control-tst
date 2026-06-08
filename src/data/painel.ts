export type NF = {
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number;
  statusNf: string;
  entrega: string;
  chequeEnviadoEm?: string;
};

export const isEnviar = (n: NF) =>
  n.entrega.toUpperCase().includes("CHEGOU") && !n.entrega.toUpperCase().includes("NÃO");

export const isAguardando = (n: NF) => n.entrega.toUpperCase().includes("NÃO");

export const isEnviado = (n: NF) => !!n.chequeEnviadoEm;

/** NF cujo cheque ainda PRECISA ser enviado (chegou e ainda não foi baixada). */
export const isAEnviar = (n: NF) => isEnviar(n) && !isEnviado(n);

export type CaixaDia = {
  data: string;
  saldoAnterior: number;
  entrada: number;
  saida: number;
  saldoTotal: number;
  destino?: string;
  origem?: string;
};
