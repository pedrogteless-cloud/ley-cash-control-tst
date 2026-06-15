export type NF = {
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number;
  statusNf: string;
  entrega: string;
  chequeEnviadoEm?: string;
  /** Timestamp set when the NF is reserved ("Separado para envio"). */
  chequeSeparadoEm?: string;
  /** User who performed the separation. */
  separadoPor?: string;
};

export const isEnviar = (n: NF) =>
  n.entrega.toUpperCase().includes("CHEGOU") && !n.entrega.toUpperCase().includes("NÃO");

export const isAguardando = (n: NF) => n.entrega.toUpperCase().includes("NÃO");

export const isEnviado = (n: NF) => !!n.chequeEnviadoEm;

/** Cheque foi separado pelo operador mas ainda não confirmado/enviado. */
export const isSeparado = (n: NF) => !!n.chequeSeparadoEm && !n.chequeEnviadoEm;

/** NF disponível para separação: chegou, ainda não separada e não enviada. */
export const isAEnviar = (n: NF) => isEnviar(n) && !isSeparado(n) && !isEnviado(n);

/** NF separada aguardando confirmação de envio (botão "Confirmar envio"). */
export const isAConfirmarEnvio = (n: NF) => isSeparado(n) && !isEnviado(n);

export type CaixaDia = {
  data: string;
  saldoAnterior: number;
  entrada: number;
  saida: number;
  saldoTotal: number;
  destino?: string;
  origem?: string;
};
