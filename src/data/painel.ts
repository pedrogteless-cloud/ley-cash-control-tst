export type NF = {
  fornecedor: string;
  nf: string;
  filial: string;
  valor: number;
  statusNf: string;
  entrega: string;
};

export const notas: NF[] = [
  { fornecedor: "Rogerio Jacauna", nf: "15130", filial: "MATRIZ", valor: 56159.53, statusNf: "CHEGOU", entrega: "CHEGOU" },
  { fornecedor: "Rogerio Jacauna", nf: "15131", filial: "FILIAL", valor: 91830.95, statusNf: "CHEGOU", entrega: "CHEGOU 26/05" },
  { fornecedor: "Moveis Marx", nf: "85743", filial: "CARGA", valor: 54552.29, statusNf: "FATURADO", entrega: "NÃO CHEGOU" },
  { fornecedor: "Moveis Marx", nf: "85740", filial: "CARGA", valor: 56027.36, statusNf: "FATURADO", entrega: "NÃO CHEGOU" },
  { fornecedor: "Ferplas", nf: "31612", filial: "FILIAL", valor: 13672.73, statusNf: "CHEGOU", entrega: "CHEGOU" },
  { fornecedor: "Madeireira Cordilheira", nf: "20316", filial: "—", valor: 28652.44, statusNf: "FATURADO", entrega: "NÃO CHEGOU" },
  { fornecedor: "Rogerio Jacauna", nf: "15135", filial: "MATRIZ", valor: 53085.62, statusNf: "CHEGOU", entrega: "CHEGOU 01/06" },
];

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

export const caixa: CaixaDia[] = [
  { data: "25/05", saldoAnterior: 876398.02, entrada: 245123.0, saida: 0, saldoTotal: 1121521.02 },
  { data: "26/05", saldoAnterior: 1121521.02, entrada: 244169.0, saida: 188548.9, saldoTotal: 1117141.12, destino: "Atualle + Nobeltex" },
  { data: "27/05", saldoAnterior: 1177141.12, entrada: 48257.06, saida: 0, saldoTotal: 1225398.18 },
  { data: "28/05", saldoAnterior: 1225398.18, entrada: 102466.24, saida: 226523.05, saldoTotal: 1101341.37, destino: "Ecoplac + Rogerio Jacauna" },
  { data: "29/05", saldoAnterior: 1101341.37, entrada: 0, saida: 134352.16, saldoTotal: 1042788.96, destino: "Atualle" },
  { data: "01/06", saldoAnterior: 1042788.96, entrada: 29989.55, saida: 0, saldoTotal: 1072778.51 },
];

export const mudancasDia = [
  { icone: "plus", titulo: "Entrada de R$ 29.989,55 no caixa", desc: "Novos cheques recebidos hoje" },
  { icone: "truck", titulo: "Nova NF Rogerio Jacauna chegou", desc: "NF 15135 entrou na carteira como pronta para envio" },
  { icone: "alert", titulo: "3 NFs prontas para envio de cheque", desc: "Total de R$ 161.018,88 aguardando repasse" },
];
