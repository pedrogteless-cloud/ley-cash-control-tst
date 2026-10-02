// Fluxo de caixa de cheques — cálculo compartilhado entre a tela e o Excel.

import type { CaixaRecord, NFRecord } from "@/data/store";
import { isAConfirmarEnvio, isAEnviar, isEnviado } from "@/data/painel";

export type Granularidade = "dia" | "semana" | "mes";

export type FluxoFiltro = {
  /** YYYY-MM-DD (inclusive) */
  from?: string;
  /** YYYY-MM-DD (inclusive) */
  to?: string;
  granularidade: Granularidade;
};

export type FluxoNf = { id: string; nf: string; valor: number; filial?: string };

export type FluxoMovimento = {
  id: string;
  /** YYYY-MM-DD derivado de "dd/mm" + ano do created_at */
  dataISO: string;
  dataBR: string;
  saldoAnterior: number;
  entrada: number;
  saida: number;
  saldoTotal: number;
  destino?: string;
  automatico: boolean;
  nfs: FluxoNf[];
};

export type FluxoPeriodo = {
  key: string;
  label: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  movimentos: FluxoMovimento[];
};

export type FluxoFornecedor = {
  fornecedor: string;
  envios: number;
  qtdNfs: number;
  total: number;
  ultimoEnvio: string;
  movimentos: FluxoMovimento[];
};

export type FluxoProjecao = {
  saldoAtual: number;
  separadas: { qtd: number; valor: number };
  aEnviar: { qtd: number; valor: number };
  aguardando: { qtd: number; valor: number };
  /** Saldo depois de pagar o que já chegou (separadas + a enviar). */
  saldoAposChegadas: number;
  /** Saldo depois de pagar toda a carteira em aberto. */
  saldoAposCarteira: number;
};

export type Fluxo = {
  filtro: FluxoFiltro;
  movimentos: FluxoMovimento[];
  periodos: FluxoPeriodo[];
  fornecedores: FluxoFornecedor[];
  totais: { saldoInicial: number; entradas: number; saidas: number; saldoFinal: number };
  projecao: FluxoProjecao;
};

const round = (v: number) => Math.round(v * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDataBR = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/**
 * caixa_movimentos.data é "dd/mm" sem ano. Usa o ano (−1, 0, +1) que deixa a
 * data mais próxima do created_at do lançamento — resolve a virada de ano.
 */
export function caixaDataISO(c: Pick<CaixaRecord, "data" | "createdAt">): string {
  const [dd, mm] = c.data.split("/").map(Number);
  const ref = c.createdAt ? new Date(c.createdAt) : new Date();
  if (!dd || !mm) return toISO(ref);
  const base = ref.getFullYear();
  let best = new Date(base, mm - 1, dd);
  for (const y of [base - 1, base + 1]) {
    const cand = new Date(y, mm - 1, dd);
    if (Math.abs(cand.getTime() - ref.getTime()) < Math.abs(best.getTime() - ref.getTime()))
      best = cand;
  }
  return toISO(best);
}

function periodoKey(iso: string, g: Granularidade): { key: string; label: string } {
  if (g === "dia") return { key: iso, label: fmtDataBR(iso) };
  if (g === "mes") {
    const [y, m] = iso.split("-");
    return { key: `${y}-${m}`, label: `${MESES[Number(m) - 1]}/${y}` };
  }
  // Semana de segunda a domingo
  const d = fromISO(iso);
  const seg = new Date(d);
  seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);
  const fmt = (x: Date) => `${pad(x.getDate())}/${pad(x.getMonth() + 1)}`;
  return { key: toISO(seg), label: `${fmt(seg)} a ${fmt(dom)}/${dom.getFullYear()}` };
}

const normFornecedor = (s: string) => s.trim().replace(/\s+/g, " ").toUpperCase();

export function buildFluxo(caixa: CaixaRecord[], notas: NFRecord[], filtro: FluxoFiltro): Fluxo {
  const nfById = new Map(notas.map((n) => [n.id, n]));

  // Ordena por data real (com ano) e recalcula o saldo em cadeia a partir do seed.
  const ordenados = caixa
    .map((c) => ({ c, iso: caixaDataISO(c) }))
    .sort(
      (a, b) =>
        a.iso.localeCompare(b.iso) ||
        String(a.c.createdAt ?? "").localeCompare(String(b.c.createdAt ?? "")),
    );

  let running = caixa.length ? caixa[0].saldoAnterior : 0;
  const todos: FluxoMovimento[] = ordenados.map(({ c, iso }) => {
    const saldoAnterior = running;
    const saldoTotal = round(saldoAnterior + c.entrada - c.saida);
    running = saldoTotal;
    return {
      id: c.id,
      dataISO: iso,
      dataBR: fmtDataBR(iso),
      saldoAnterior,
      entrada: c.entrada,
      saida: c.saida,
      saldoTotal,
      destino: c.destino?.trim() || undefined,
      automatico: c.origem === "auto_nf",
      nfs: (c.nfsResolvidas ?? []).flatMap((id) => {
        const n = nfById.get(id);
        return n ? [{ id, nf: n.nf, valor: n.valor, filial: n.filial }] : [];
      }),
    };
  });

  const saldoAtual = todos.length ? todos[todos.length - 1].saldoTotal : 0;

  const movimentos = todos.filter(
    (m) => (!filtro.from || m.dataISO >= filtro.from) && (!filtro.to || m.dataISO <= filtro.to),
  );

  // ── Por período ────────────────────────────────────────────────────────────
  const periodos: FluxoPeriodo[] = [];
  for (const m of movimentos) {
    const { key, label } = periodoKey(m.dataISO, filtro.granularidade);
    let p = periodos[periodos.length - 1];
    if (!p || p.key !== key) {
      p = {
        key,
        label,
        saldoInicial: m.saldoAnterior,
        entradas: 0,
        saidas: 0,
        saldoFinal: m.saldoTotal,
        movimentos: [],
      };
      periodos.push(p);
    }
    p.entradas = round(p.entradas + m.entrada);
    p.saidas = round(p.saidas + m.saida);
    p.saldoFinal = m.saldoTotal;
    p.movimentos.push(m);
  }

  // ── Por fornecedor (só saídas) ─────────────────────────────────────────────
  const fornMap = new Map<string, FluxoFornecedor>();
  for (const m of movimentos) {
    if (m.saida <= 0) continue;
    const nome = m.destino ?? "Sem destino";
    const key = normFornecedor(nome);
    let f = fornMap.get(key);
    if (!f) {
      f = {
        fornecedor: nome,
        envios: 0,
        qtdNfs: 0,
        total: 0,
        ultimoEnvio: m.dataISO,
        movimentos: [],
      };
      fornMap.set(key, f);
    }
    f.envios += 1;
    f.qtdNfs += m.nfs.length;
    f.total = round(f.total + m.saida);
    if (m.dataISO > f.ultimoEnvio) f.ultimoEnvio = m.dataISO;
    f.movimentos.push(m);
  }
  const fornecedores = [...fornMap.values()].sort((a, b) => b.total - a.total);

  // ── Projeção (carteira em aberto) ──────────────────────────────────────────
  const soma = (list: NFRecord[]) => ({
    qtd: list.length,
    valor: round(list.reduce((s, n) => s + n.valor, 0)),
  });
  const separadas = soma(notas.filter(isAConfirmarEnvio));
  const aEnviar = soma(notas.filter(isAEnviar));
  // Resto da carteira em aberto (carga ainda não chegou) — fecha com a "Cobertura" da aba.
  const aguardando = soma(
    notas.filter((n) => !isEnviado(n) && !isAConfirmarEnvio(n) && !isAEnviar(n)),
  );
  const saldoAposChegadas = round(saldoAtual - separadas.valor - aEnviar.valor);

  const entradas = round(movimentos.reduce((s, m) => s + m.entrada, 0));
  const saidas = round(movimentos.reduce((s, m) => s + m.saida, 0));

  return {
    filtro,
    movimentos,
    periodos,
    fornecedores,
    totais: {
      saldoInicial: movimentos.length ? movimentos[0].saldoAnterior : saldoAtual,
      entradas,
      saidas,
      saldoFinal: movimentos.length ? movimentos[movimentos.length - 1].saldoTotal : saldoAtual,
    },
    projecao: {
      saldoAtual,
      separadas,
      aEnviar,
      aguardando,
      saldoAposChegadas,
      saldoAposCarteira: round(saldoAposChegadas - aguardando.valor),
    },
  };
}
