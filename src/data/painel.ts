export type NF = {
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number;
  statusNf: string;
  entrega: string;
  /** Legacy field — kept for backward-compat with data before 2026-06-17. */
  chequeEnviadoEm?: string;
  /** New field — set to "ENVIADO" when cheque is sent. */
  statusEnvio?: string | null;
  /** Timestamp set when the NF is reserved ("Separado para envio"). */
  chequeSeparadoEm?: string;
  /** User who performed the separation. */
  separadoPor?: string;
};

export const isEnviar = (n: NF) =>
  n.entrega.toUpperCase().includes("CHEGOU") && !n.entrega.toUpperCase().includes("NÃO");

export const isAguardando = (n: NF) => n.entrega.toUpperCase().includes("NÃO");

/** NF já enviada — verifica novo campo status_envio e legacy chequeEnviadoEm */
export const isEnviado = (n: NF) => n.statusEnvio === "ENVIADO" || !!n.chequeEnviadoEm;

/** Cheque foi separado pelo operador mas ainda não foi enviado. */
export const isSeparado = (n: NF) => !!n.chequeSeparadoEm && !isEnviado(n);

/** NF pronta para ser resolvida por uma saída de cheque. */
export const isPendenteEnvio = (n: NF) => isEnviar(n) && !isEnviado(n);

/** NF disponível para separação: chegou, ainda não separada e não enviada. */
export const isAEnviar = (n: NF) => isPendenteEnvio(n) && !isSeparado(n);

/** NF separada aguardando baixa em uma saída de cheque. */
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
