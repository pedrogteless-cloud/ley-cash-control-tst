// Geração de planilha Excel do Fluxo de Caixa de Cheques — Grupo Ley
// Mesma paleta/estilo da planilha de Cheques Devolvidos.

import type { Fluxo, Granularidade } from "@/lib/fluxo-caixa";
import { fmtDataBR } from "@/lib/fluxo-caixa";

// ── Paleta ────────────────────────────────────────────────────────────────────
const NAVY = "FF0D1117";
const GOLD = "FFF0B429";
const RED_H = "FF8B2000";
const GRN_H = "FF1A5E35";
const TEL_H = "FF0D4A5F";
const AMB_H = "FF6B4200";
const WHITE = "FFFFFFFF";
const GOLD_LT = "FFFFF9EE";
const BORD = "FFD4B483";
const INK = "FF0D1117";
const RED_T = "FF8B1A1A";
const GRN_T = "FF1A5E35";
const AMB_T = "FF8B5A00";
const BLU_T = "FF0D3B73";
const GRAY_T = "FF5A5A6E";

const BRL = '"R$" #,##0.00';
const PCT = "0.0%";
const INT = "#,##0";
const DELT = '+#,##0.00;-#,##0.00;"-"';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AW = any;

function fill(argb: string) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } } as const;
}
function brd() {
  const t = (a: string) => ({ style: "thin", color: { argb: a } }) as const;
  return { top: t(BORD), left: t(BORD), bottom: t(BORD), right: t(BORD) };
}

function hdr(cell: AC, text: string, bg: string, align: "left" | "center" | "right" = "center") {
  cell.value = text;
  cell.font = { bold: true, size: 9, color: { argb: WHITE }, name: "Arial" };
  cell.fill = fill(bg);
  cell.alignment = { vertical: "middle", horizontal: align, wrapText: true };
  cell.border = brd();
}

function dat(
  cell: AC,
  value: unknown,
  numFmt: string | undefined,
  textColor: string,
  bgColor: string,
  align: "left" | "center" | "right",
  bold = false,
) {
  cell.value = value ?? null;
  if (numFmt) cell.numFmt = numFmt;
  cell.font = { size: 9, bold, color: { argb: textColor }, name: "Arial" };
  cell.fill = fill(bgColor);
  cell.alignment = {
    vertical: "middle",
    horizontal: align,
    indent: align === "left" ? 1 : 0,
    wrapText: align === "left",
  };
  cell.border = brd();
}

function tot(
  cell: AC,
  value: unknown,
  numFmt: string | undefined,
  align: "left" | "center" | "right" = "right",
) {
  cell.value = value ?? null;
  if (numFmt) cell.numFmt = numFmt;
  cell.font = { bold: true, size: 9, color: { argb: WHITE }, name: "Arial" };
  cell.fill = fill(NAVY);
  cell.alignment = { vertical: "middle", horizontal: align, indent: align === "left" ? 1 : 0 };
  cell.border = brd();
}

function zebra(i: number): string {
  return i % 2 === 0 ? GOLD_LT : WHITE;
}

function titulo(ws: AW, range: string, text: string, sub?: string) {
  ws.mergeCells(range);
  const t = ws.getCell(range.split(":")[0]);
  t.value = text;
  t.font = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  t.fill = fill(NAVY);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;
  if (sub) {
    const r2 = range.replace(/1/g, "2");
    ws.mergeCells(r2);
    const s = ws.getCell(r2.split(":")[0]);
    s.value = sub;
    s.font = { italic: true, size: 9, color: { argb: GRAY_T }, name: "Arial" };
    s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(2).height = 18;
  }
}

const GRAN_LABEL: Record<Granularidade, string> = {
  dia: "Diário",
  semana: "Semanal",
  mes: "Mensal",
};

function periodoLabel(f: Fluxo["filtro"]): string {
  if (!f.from && !f.to) return "Todos os registros";
  if (f.from && f.to) return `${fmtDataBR(f.from)} a ${fmtDataBR(f.to)}`;
  if (f.from) return `A partir de ${fmtDataBR(f.from)}`;
  return `Até ${fmtDataBR(f.to!)}`;
}

const nfsTexto = (nfs: { nf: string }[]) => nfs.map((n) => n.nf).join(", ");

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 1 — Resumo + Projeção
// ══════════════════════════════════════════════════════════════════════════════
function buildResumoSheet(wb: AW, fx: Fluxo, geradoEm: string) {
  const ws: AW = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 46 }, { width: 20 }, { width: 14 }];
  titulo(
    ws,
    "A1:C1",
    "FLUXO DE CAIXA DE CHEQUES — GRUPO LEY",
    `Período: ${periodoLabel(fx.filtro)}  ·  Agrupamento: ${GRAN_LABEL[fx.filtro.granularidade]}  ·  Gerado em ${geradoEm}`,
  );

  let r = 4;
  const secao = (text: string, bg: string) => {
    ws.mergeCells(r, 1, r, 3);
    hdr(ws.getCell(r, 1), text, bg, "left");
    ws.getRow(r).height = 20;
    r++;
  };
  const linha = (
    label: string,
    value: unknown,
    fmt: string | undefined,
    color: string,
    bold = false,
    extra?: unknown,
    extraFmt?: string,
  ) => {
    const bg = zebra(r);
    dat(ws.getCell(r, 1), label, undefined, INK, bg, "left", bold);
    dat(ws.getCell(r, 2), value, fmt, color, bg, "right", bold);
    dat(ws.getCell(r, 3), extra ?? null, extraFmt, GRAY_T, bg, "right");
    ws.getRow(r).height = 18;
    r++;
  };

  const t = fx.totais;
  secao("REALIZADO NO PERÍODO", TEL_H);
  linha("Saldo no início do período", t.saldoInicial, BRL, INK);
  linha("(+) Entradas de cheques", t.entradas, BRL, GRN_T);
  linha("(−) Saídas de cheques", t.saidas, BRL, RED_T);
  linha("(=) Saldo no fim do período", t.saldoFinal, BRL, t.saldoFinal >= 0 ? GRN_T : RED_T, true);
  linha("Variação no período", t.entradas - t.saidas, DELT, t.entradas >= t.saidas ? GRN_T : RED_T);
  linha("Qtd. movimentos", fx.movimentos.length, INT, INK);
  linha("Qtd. envios a fornecedores", fx.movimentos.filter((m) => m.saida > 0).length, INT, INK);

  r++;
  const p = fx.projecao;
  const carteira = p.separadas.valor + p.aEnviar.valor + p.aguardando.valor;
  secao("PROJEÇÃO — CARTEIRA EM ABERTO (posição atual)", AMB_H);
  hdr(ws.getCell(r, 1), "Item", NAVY, "left");
  hdr(ws.getCell(r, 2), "Valor", NAVY);
  hdr(ws.getCell(r, 3), "Qtd. NFs", NAVY);
  r++;
  linha("Saldo em caixa hoje", p.saldoAtual, BRL, INK, true);
  linha("(−) Separadas para envio", p.separadas.valor, BRL, RED_T, false, p.separadas.qtd, INT);
  linha("(−) Chegaram, a enviar", p.aEnviar.valor, BRL, RED_T, false, p.aEnviar.qtd, INT);
  linha(
    "(=) Saldo após pagar o que já chegou",
    p.saldoAposChegadas,
    BRL,
    p.saldoAposChegadas >= 0 ? GRN_T : RED_T,
    true,
  );
  linha("(−) Carga ainda não chegou", p.aguardando.valor, BRL, AMB_T, false, p.aguardando.qtd, INT);
  linha(
    "(=) Saldo após pagar toda a carteira",
    p.saldoAposCarteira,
    BRL,
    p.saldoAposCarteira >= 0 ? GRN_T : RED_T,
    true,
  );
  linha(
    "Cobertura do caixa sobre a carteira",
    carteira > 0 ? p.saldoAtual / carteira : null,
    PCT,
    BLU_T,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA DFC — Demonstração do Fluxo de Caixa (períodos em colunas)
// ══════════════════════════════════════════════════════════════════════════════
function buildDfcSheet(wb: AW, fx: Fluxo) {
  const nPer = fx.periodos.length;
  const totalCol = nPer + 2;
  const ws: AW = wb.addWorksheet("DFC", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 4, showGridLines: false }],
  });
  ws.columns = [{ width: 38 }, ...fx.periodos.map(() => ({ width: 16 })), { width: 18 }];
  const L = (c: number) => ws.getColumn(c).letter as string;
  const lastL = L(totalCol);

  titulo(
    ws,
    `A1:${lastL}1`,
    "DEMONSTRAÇÃO DO FLUXO DE CAIXA DE CHEQUES",
    `Período: ${periodoLabel(fx.filtro)}  ·  Colunas: ${GRAN_LABEL[fx.filtro.granularidade]}`,
  );

  // Cabeçalho
  hdr(ws.getCell(4, 1), "Demonstração", NAVY, "left");
  fx.periodos.forEach((p, i) => hdr(ws.getCell(4, i + 2), p.label, NAVY));
  hdr(ws.getCell(4, totalCol), "Total do período", TEL_H);
  ws.getRow(4).height = 30;

  // Fornecedor de cada saída (mesmo agrupamento da aba Por Fornecedor)
  const fornDoMov = new Map<string, number>();
  fx.fornecedores.forEach((f, fi) => f.movimentos.forEach((m) => fornDoMov.set(m.id, fi)));

  let r = 5;
  const secao = (text: string, bg: string) => {
    ws.mergeCells(r, 1, r, totalCol);
    hdr(ws.getCell(r, 1), text, bg, "left");
    ws.getRow(r).height = 18;
    r++;
  };

  /** Linha de valores; Total = soma das colunas (fórmula). */
  const linhaValores = (label: string, valores: number[], color: string, zi: number) => {
    const bg = zebra(zi);
    dat(ws.getCell(r, 1), label, undefined, INK, bg, "left");
    valores.forEach((v, i) => dat(ws.getCell(r, i + 2), v || null, BRL, color, bg, "right"));
    const total = valores.reduce((s, v) => s + v, 0);
    dat(
      ws.getCell(r, totalCol),
      { formula: `SUM(B${r}:${L(nPer + 1)}${r})`, result: total },
      BRL,
      color,
      bg,
      "right",
      true,
    );
    ws.getRow(r).height = 17;
    return r++;
  };

  /** Linha de subtotal/resultado com fórmula por coluna. */
  const linhaFormula = (
    label: string,
    formula: (col: string) => string,
    results: number[],
    totalFormula: string,
    totalResult: number,
    bg: string,
    fmt = BRL,
  ) => {
    hdr(ws.getCell(r, 1), label, bg, "left");
    results.forEach((v, i) => {
      const c = ws.getCell(r, i + 2);
      hdr(c, "", bg, "right");
      c.value = { formula: formula(L(i + 2)), result: v };
      c.numFmt = fmt;
    });
    const ct = ws.getCell(r, totalCol);
    hdr(ct, "", bg, "right");
    ct.value = { formula: totalFormula, result: totalResult };
    ct.numFmt = fmt;
    ws.getRow(r).height = 19;
    return r++;
  };

  const ini = fx.periodos.map((p) => p.saldoInicial);
  const ent = fx.periodos.map((p) => p.entradas);
  const sai = fx.periodos.map((p) => p.saidas);
  const t = fx.totais;

  // Saldo inicial: 1ª coluna = valor; demais = saldo final da coluna anterior
  const rIni = r;
  r++;
  r++; // espaço

  secao("(+) ENTRADAS", GRN_H);
  const rEnt0 = linhaValores("Cheques recebidos", ent, GRN_T, 0);
  const rEntTot = linhaFormula(
    "(=) Total de entradas",
    (c) => `SUM(${c}${rEnt0}:${c}${rEnt0})`,
    ent,
    `SUM(${L(totalCol)}${rEnt0}:${L(totalCol)}${rEnt0})`,
    t.entradas,
    GRN_H,
  );
  r++;

  secao("(−) SAÍDAS — CHEQUES ENVIADOS A FORNECEDORES", RED_H);
  const rSai0 = r;
  fx.fornecedores.forEach((f, fi) => {
    const vals = fx.periodos.map((p) =>
      p.movimentos.reduce(
        (s, m) => (m.saida > 0 && fornDoMov.get(m.id) === fi ? s + m.saida : s),
        0,
      ),
    );
    linhaValores(f.fornecedor, vals, RED_T, fi);
  });
  const rSai1 = r - 1;
  const somaSai = (c: string) => (rSai1 >= rSai0 ? `SUM(${c}${rSai0}:${c}${rSai1})` : "0");
  const rSaiTot = linhaFormula(
    "(=) Total de saídas",
    somaSai,
    sai,
    somaSai(L(totalCol)),
    t.saidas,
    RED_H,
  );
  r++;

  const rVar = linhaFormula(
    "(=) VARIAÇÃO LÍQUIDA DO CAIXA",
    (c) => `${c}${rEntTot}-${c}${rSaiTot}`,
    fx.periodos.map((p) => p.entradas - p.saidas),
    `${L(totalCol)}${rEntTot}-${L(totalCol)}${rSaiTot}`,
    t.entradas - t.saidas,
    TEL_H,
    DELT,
  );
  r++;

  const rFim = linhaFormula(
    "SALDO FINAL DO CAIXA",
    (c) => `${c}${rIni}+${c}${rVar}`,
    fx.periodos.map((p) => p.saldoFinal),
    `${L(totalCol)}${rIni}+${L(totalCol)}${rVar}`,
    t.saldoFinal,
    NAVY,
  );

  // Preenche o saldo inicial agora que sabemos a linha do saldo final
  {
    const save = r;
    r = rIni;
    linhaFormula(
      "SALDO INICIAL DO CAIXA",
      (c) => (c === "B" ? String(ini[0] ?? 0) : `${L(ws.getColumn(c).number - 1)}${rFim}`),
      ini,
      `B${rIni}`,
      t.saldoInicial,
      NAVY,
    );
    r = save;
  }
  ws.getCell(rIni, 2).value = ini[0] ?? 0;
  ws.getCell(rFim, 1).font = { bold: true, size: 10, color: { argb: GOLD }, name: "Arial" };
  ws.getCell(rIni, 1).font = { bold: true, size: 10, color: { argb: GOLD }, name: "Arial" };

  // Nota
  r += 2;
  ws.mergeCells(r, 1, r, Math.min(totalCol, 6));
  const nota = ws.getCell(r, 1);
  nota.value =
    "Saldo inicial de cada coluna = saldo final da coluna anterior. Totais e saldos são fórmulas — confira à vontade.";
  nota.font = { italic: true, size: 8, color: { argb: GRAY_T }, name: "Arial" };
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 2 — Fluxo por período
// ══════════════════════════════════════════════════════════════════════════════
function buildPeriodoSheet(wb: AW, fx: Fluxo) {
  const ws: AW = wb.addWorksheet(`Fluxo ${GRAN_LABEL[fx.filtro.granularidade]}`, {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
  });
  ws.columns = [
    { width: 24 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 16 },
    { width: 12 },
  ];
  titulo(
    ws,
    "A1:G1",
    `FLUXO ${GRAN_LABEL[fx.filtro.granularidade].toUpperCase()} — ${fx.periodos.length} períodos`,
    periodoLabel(fx.filtro),
  );

  (
    [
      ["Período", NAVY],
      ["Saldo Inicial", NAVY],
      ["Entradas", GRN_H],
      ["Saídas", RED_H],
      ["Saldo Final", TEL_H],
      ["Δ Variação", NAVY],
      ["Movimentos", NAVY],
    ] as [string, string][]
  ).forEach(([h, bg], ci) => hdr(ws.getCell(3, ci + 1), h, bg));
  ws.getRow(3).height = 20;

  fx.periodos.forEach((p, i) => {
    const ri = 4 + i;
    const bg = zebra(i);
    const delta = p.entradas - p.saidas;
    ws.getRow(ri).height = 17;
    dat(ws.getCell(ri, 1), p.label, undefined, INK, bg, "center", true);
    dat(ws.getCell(ri, 2), p.saldoInicial, BRL, GRAY_T, bg, "right");
    dat(ws.getCell(ri, 3), p.entradas || null, BRL, GRN_T, bg, "right");
    dat(ws.getCell(ri, 4), p.saidas || null, BRL, RED_T, bg, "right");
    dat(ws.getCell(ri, 5), p.saldoFinal, BRL, p.saldoFinal >= 0 ? GRN_T : RED_T, bg, "right", true);
    dat(
      ws.getCell(ri, 6),
      delta,
      DELT,
      delta > 0 ? GRN_T : delta < 0 ? RED_T : GRAY_T,
      bg,
      "right",
    );
    dat(ws.getCell(ri, 7), p.movimentos.length, INT, GRAY_T, bg, "center");
  });

  const tr = 4 + fx.periodos.length;
  const t = fx.totais;
  ws.getRow(tr).height = 20;
  tot(ws.getCell(tr, 1), "TOTAL", undefined, "left");
  tot(ws.getCell(tr, 2), t.saldoInicial, BRL);
  tot(ws.getCell(tr, 3), t.entradas, BRL);
  tot(ws.getCell(tr, 4), t.saidas, BRL);
  tot(ws.getCell(tr, 5), t.saldoFinal, BRL);
  tot(ws.getCell(tr, 6), t.entradas - t.saidas, DELT);
  tot(ws.getCell(tr, 7), fx.movimentos.length, INT, "center");
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 3 — Movimentos (detalhe com NFs)
// ══════════════════════════════════════════════════════════════════════════════
function buildMovimentosSheet(wb: AW, fx: Fluxo) {
  const ws: AW = wb.addWorksheet("Movimentos", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
  });
  ws.columns = [
    { width: 12 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 28 },
    { width: 10 },
    { width: 34 },
    { width: 16 },
  ];
  titulo(
    ws,
    "A1:I1",
    `MOVIMENTOS DE CAIXA — ${fx.movimentos.length} lançamentos`,
    periodoLabel(fx.filtro),
  );

  (
    [
      ["Data", NAVY],
      ["Saldo Anterior", NAVY],
      ["Entrada", GRN_H],
      ["Saída", RED_H],
      ["Saldo Total", TEL_H],
      ["Destino", NAVY],
      ["Tipo", NAVY],
      ["NFs pagas", NAVY],
      ["Valor das NFs", NAVY],
    ] as [string, string][]
  ).forEach(([h, bg], ci) => hdr(ws.getCell(3, ci + 1), h, bg));
  ws.getRow(3).height = 20;

  fx.movimentos.forEach((m, i) => {
    const ri = 4 + i;
    const bg = zebra(i);
    const valorNfs = m.nfs.reduce((s, n) => s + n.valor, 0);
    dat(ws.getCell(ri, 1), m.dataBR, undefined, INK, bg, "center", true);
    dat(ws.getCell(ri, 2), m.saldoAnterior, BRL, GRAY_T, bg, "right");
    dat(ws.getCell(ri, 3), m.entrada || null, BRL, GRN_T, bg, "right");
    dat(ws.getCell(ri, 4), m.saida || null, BRL, RED_T, bg, "right");
    dat(ws.getCell(ri, 5), m.saldoTotal, BRL, m.saldoTotal >= 0 ? GRN_T : RED_T, bg, "right", true);
    dat(ws.getCell(ri, 6), m.destino ?? "—", undefined, GRAY_T, bg, "left");
    dat(
      ws.getCell(ri, 7),
      m.automatico ? "Auto" : "Manual",
      undefined,
      m.automatico ? AMB_T : GRAY_T,
      bg,
      "center",
    );
    dat(ws.getCell(ri, 8), m.nfs.length ? nfsTexto(m.nfs) : "—", undefined, GRAY_T, bg, "left");
    dat(ws.getCell(ri, 9), m.nfs.length ? valorNfs : null, BRL, GRAY_T, bg, "right");
  });

  const tr = 4 + fx.movimentos.length;
  ws.getRow(tr).height = 20;
  tot(ws.getCell(tr, 1), "TOTAL", undefined, "left");
  tot(ws.getCell(tr, 2), null, undefined);
  tot(ws.getCell(tr, 3), fx.totais.entradas, BRL);
  tot(ws.getCell(tr, 4), fx.totais.saidas, BRL);
  tot(ws.getCell(tr, 5), fx.totais.saldoFinal, BRL);
  for (let c = 6; c <= 9; c++) tot(ws.getCell(tr, c), null, undefined);
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 4 — Saídas por fornecedor
// ══════════════════════════════════════════════════════════════════════════════
function buildFornecedorSheet(wb: AW, fx: Fluxo) {
  const ws: AW = wb.addWorksheet("Por Fornecedor", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
  });
  ws.columns = [
    { width: 34 },
    { width: 10 },
    { width: 10 },
    { width: 18 },
    { width: 12 },
    { width: 18 },
    { width: 14 },
  ];
  titulo(
    ws,
    "A1:G1",
    `SAÍDAS POR FORNECEDOR — ${fx.fornecedores.length} fornecedores`,
    periodoLabel(fx.filtro),
  );

  (
    [
      ["Fornecedor", NAVY],
      ["Envios", NAVY],
      ["NFs", NAVY],
      ["Total Saído", RED_H],
      ["% do Total", NAVY],
      ["Ticket Médio", NAVY],
      ["Último Envio", NAVY],
    ] as [string, string][]
  ).forEach(([h, bg], ci) => hdr(ws.getCell(3, ci + 1), h, bg));
  ws.getRow(3).height = 20;

  const totalSaidas = fx.fornecedores.reduce((s, f) => s + f.total, 0);
  let ri = 4;
  fx.fornecedores.forEach((f, i) => {
    const bg = zebra(i);
    dat(ws.getCell(ri, 1), f.fornecedor, undefined, INK, bg, "left", true);
    dat(ws.getCell(ri, 2), f.envios, INT, INK, bg, "center");
    dat(ws.getCell(ri, 3), f.qtdNfs || null, INT, GRAY_T, bg, "center");
    dat(ws.getCell(ri, 4), f.total, BRL, RED_T, bg, "right", true);
    dat(ws.getCell(ri, 5), totalSaidas > 0 ? f.total / totalSaidas : null, PCT, BLU_T, bg, "right");
    dat(ws.getCell(ri, 6), f.total / f.envios, BRL, GRAY_T, bg, "right");
    dat(ws.getCell(ri, 7), fmtDataBR(f.ultimoEnvio), undefined, GRAY_T, bg, "center");
    ri++;
  });

  ws.getRow(ri).height = 20;
  tot(ws.getCell(ri, 1), "TOTAL", undefined, "left");
  tot(
    ws.getCell(ri, 2),
    fx.fornecedores.reduce((s, f) => s + f.envios, 0),
    INT,
    "center",
  );
  tot(
    ws.getCell(ri, 3),
    fx.fornecedores.reduce((s, f) => s + f.qtdNfs, 0),
    INT,
    "center",
  );
  tot(ws.getCell(ri, 4), totalSaidas, BRL);
  tot(ws.getCell(ri, 5), totalSaidas > 0 ? 1 : null, PCT);
  tot(ws.getCell(ri, 6), null, undefined);
  tot(ws.getCell(ri, 7), null, undefined);

  // Detalhe de cada envio, agrupado por fornecedor
  ri += 2;
  ws.mergeCells(ri, 1, ri, 7);
  hdr(ws.getCell(ri, 1), "DETALHE DOS ENVIOS", TEL_H, "left");
  ri++;
  (["Fornecedor", "Data", "NFs", "Valor Enviado", "", "NFs pagas", ""] as string[]).forEach(
    (h, ci) => hdr(ws.getCell(ri, ci + 1), h, NAVY),
  );
  ws.mergeCells(ri, 6, ri, 7);
  ri++;
  let z = 0;
  for (const f of fx.fornecedores) {
    for (const m of f.movimentos) {
      const bg = zebra(z++);
      dat(ws.getCell(ri, 1), f.fornecedor, undefined, INK, bg, "left");
      dat(ws.getCell(ri, 2), m.dataBR, undefined, INK, bg, "center");
      dat(ws.getCell(ri, 3), m.nfs.length || null, INT, GRAY_T, bg, "center");
      dat(ws.getCell(ri, 4), m.saida, BRL, RED_T, bg, "right", true);
      dat(ws.getCell(ri, 5), null, undefined, GRAY_T, bg, "center");
      ws.mergeCells(ri, 6, ri, 7);
      dat(ws.getCell(ri, 6), m.nfs.length ? nfsTexto(m.nfs) : "—", undefined, GRAY_T, bg, "left");
      ri++;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Função principal
// ══════════════════════════════════════════════════════════════════════════════
export async function buildFluxoCaixaWorkbook(fx: Fluxo): Promise<Blob> {
  // @ts-ignore
  const ExcelJS: any = (await import("exceljs")).default; // eslint-disable-line @typescript-eslint/no-explicit-any
  const wb = new ExcelJS.Workbook();
  wb.creator = "Painel Cheques — Grupo Ley";
  wb.created = new Date();

  const now = new Date();
  const geradoEm = now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  buildDfcSheet(wb, fx);
  buildResumoSheet(wb, fx, geradoEm);
  buildPeriodoSheet(wb, fx);
  buildMovimentosSheet(wb, fx);
  buildFornecedorSheet(wb, fx);

  wb.views = [{ activeTab: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
