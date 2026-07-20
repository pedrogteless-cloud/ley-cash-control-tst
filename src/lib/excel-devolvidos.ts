// Geração de planilha Excel para Cheques Devolvidos — Grupo Ley
// Paleta visual alinhada com o design do software (navy + ouro + semáforo).

import { supabase } from "@/integrations/supabase/client";

// ── Paleta ────────────────────────────────────────────────────────────────────
const NAVY    = "FF0D1117";
const GOLD    = "FFF0B429";
const RED_H   = "FF8B2000";
const GRN_H   = "FF1A5E35";
const TEL_H   = "FF0D4A5F";
const AMB_H   = "FF6B4200";
const WHITE   = "FFFFFFFF";
const GOLD_LT = "FFFFF9EE";
const BORD    = "FFD4B483";
const INK     = "FF0D1117";
const RED_T   = "FF8B1A1A";
const GRN_T   = "FF1A5E35";
const AMB_T   = "FF8B5A00";
const BLU_T   = "FF0D3B73";
const GRAY_T  = "FF5A5A6E";

const BRL  = '"R$" #,##0.00';
const PCT  = "0.0%";
const INT  = "#,##0";
const DELT = '+#,##0.00;-#,##0.00;"-"';
const DPCT = '+0.0%;-0.0%;"-"';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type DevolvidoRow = {
  id: string;
  data: string;
  valor_devolvido: number;
  valor_rec_fornecedor: number;
  valor_rec_empresa: number;
  created_at: string;
};

export type ExportPeriod = { from?: string; to?: string };

// ── Helpers de formatação ─────────────────────────────────────────────────────
function fmtDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function ymKey(iso: string): string { return iso.slice(0, 7); }

function fmtMonthBR(ym: string): string {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [y, m] = ym.split("-");
  return `${meses[Number(m) - 1]}/${y}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AW = any;

function fill(argb: string) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } } as const;
}
function brd() {
  const t = (a: string) => ({ style: "thin", color: { argb: a } } as const);
  return { top: t(BORD), left: t(BORD), bottom: t(BORD), right: t(BORD) };
}

function hdr(cell: AC, text: string, bg: string, align: "left"|"center"|"right" = "center") {
  cell.value = text;
  cell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Arial" };
  cell.fill  = fill(bg);
  cell.alignment = { vertical: "middle", horizontal: align, wrapText: true };
  cell.border = brd();
}

function dat(
  cell: AC, value: unknown, numFmt: string | undefined,
  textColor: string, bgColor: string, align: "left"|"center"|"right",
  bold = false,
) {
  cell.value = value ?? null;
  if (numFmt) cell.numFmt = numFmt;
  cell.font      = { size: 9, bold, color: { argb: textColor }, name: "Arial" };
  cell.fill      = fill(bgColor);
  cell.alignment = { vertical: "middle", horizontal: align, indent: align === "left" ? 1 : 0 };
  cell.border    = brd();
}

function tot(cell: AC, value: unknown, numFmt: string | undefined, align: "left"|"center"|"right" = "right") {
  cell.value = value ?? null;
  if (numFmt) cell.numFmt = numFmt;
  cell.font      = { bold: true, size: 9, color: { argb: WHITE }, name: "Arial" };
  cell.fill      = fill(NAVY);
  cell.alignment = { vertical: "middle", horizontal: align, indent: align === "left" ? 1 : 0 };
  cell.border    = brd();
}

function emptyNav(cell: AC) {
  cell.fill   = fill(NAVY);
  cell.border = brd();
}

function zebra(i: number): string { return i % 2 === 0 ? GOLD_LT : WHITE; }

function periodLabel(period?: ExportPeriod): string {
  if (!period?.from && !period?.to) return "Todos os registros";
  if (period.from && period.to)     return `${fmtDateBR(period.from)} a ${fmtDateBR(period.to)}`;
  if (period.from)                  return `A partir de ${fmtDateBR(period.from)}`;
  return `Até ${fmtDateBR(period.to!)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  buildDevolvidosWorkbook
// ─────────────────────────────────────────────────────────────────────────────
export async function buildDevolvidosWorkbook(
  rows: DevolvidoRow[],
  period?: ExportPeriod,
): Promise<Blob> {
  // @ts-ignore
  const ExcelJS: any = (await import("exceljs")).default;   // eslint-disable-line @typescript-eslint/no-explicit-any
  const wb = new ExcelJS.Workbook();
  wb.creator = "Painel Cheques — Grupo Ley";
  wb.created = new Date();

  const sorted = [...rows].sort((a, b) => b.data.localeCompare(a.data));

  // ── Busca notas enviadas no mesmo período (para correlação) ───────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let notasQuery: any = supabase
    .from("notas_fiscais")
    .select("valor, cheque_enviado_em, fornecedor")
    .eq("status_envio", "ENVIADO")
    .not("cheque_enviado_em", "is", null);

  if (period?.from) notasQuery = notasQuery.gte("cheque_enviado_em", period.from);
  if (period?.to)   notasQuery = notasQuery.lte("cheque_enviado_em", period.to + "T23:59:59");

  const { data: notasData } = await notasQuery;
  const notasEnviadas: { valor: number; cheque_enviado_em: string; fornecedor: string }[] =
    (notasData ?? []) as { valor: number; cheque_enviado_em: string; fornecedor: string }[];

  const totEnviado = notasEnviadas.reduce((s, n) => s + Number(n.valor || 0), 0);

  // ── Totais globais de devolvidos ──────────────────────────────────────────
  const totDev  = rows.reduce((s, r) => s + Number(r.valor_devolvido    || 0), 0);
  const totRecF = rows.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0), 0);
  const totRecE = rows.reduce((s, r) => s + Number(r.valor_rec_empresa   || 0), 0);
  const totRec  = totRecF + totRecE;
  const totPend = totDev - totRec;
  const taxaRec = totDev > 0 ? totRec / totDev : 0;

  // Taxa de inadimplência = quanto do que foi enviado voltou como devolvido
  const taxaInad = totEnviado > 0 ? totDev / totEnviado : null;

  const devRows    = rows.filter(r => Number(r.valor_devolvido) > 0);
  const avulsaRows = rows.filter(r => Number(r.valor_devolvido) <= 0 &&
    (Number(r.valor_rec_fornecedor) + Number(r.valor_rec_empresa)) > 0);
  const pendRows   = rows.filter(r => {
    const d = Number(r.valor_devolvido || 0);
    const rec = Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0);
    return d > 0 && d - rec > 0;
  });

  const ticketMedio   = devRows.length   > 0 ? totDev  / devRows.length   : 0;
  const ticketPend    = pendRows.length  > 0 ? totPend / pendRows.length  : 0;
  const maiorPend     = pendRows.reduce((mx, r) => {
    const p = Number(r.valor_devolvido||0) - Number(r.valor_rec_fornecedor||0) - Number(r.valor_rec_empresa||0);
    return p > mx ? p : mx;
  }, 0);

  // ── Agregação cruzada por mês: enviado × devolvido ────────────────────────
  type CrossMonth = { enviado: number; devolvido: number; recuperado: number };
  const crossMap = new Map<string, CrossMonth>();

  for (const n of notasEnviadas) {
    const ym = n.cheque_enviado_em.slice(0, 7);
    const e = crossMap.get(ym) ?? { enviado: 0, devolvido: 0, recuperado: 0 };
    e.enviado += Number(n.valor || 0);
    crossMap.set(ym, e);
  }
  for (const r of rows) {
    const ym = ymKey(r.data);
    const e = crossMap.get(ym) ?? { enviado: 0, devolvido: 0, recuperado: 0 };
    e.devolvido  += Number(r.valor_devolvido    || 0);
    e.recuperado += Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0);
    crossMap.set(ym, e);
  }

  const crossAsc = [...crossMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, v], idx, arr) => {
      const taxaRetorno   = v.enviado    > 0 ? v.devolvido  / v.enviado    : null;
      const taxaRecupMes  = v.devolvido  > 0 ? v.recuperado / v.devolvido  : null;
      const pendente      = v.devolvido - v.recuperado;
      const prev          = idx > 0 ? arr[idx - 1][1] : null;
      const prevTaxaRet   = prev && prev.enviado > 0 ? prev.devolvido / prev.enviado : null;
      return {
        ym, label: fmtMonthBR(ym),
        enviado: v.enviado, devolvido: v.devolvido,
        recuperado: v.recuperado, pendente,
        taxaRetorno, taxaRecupMes,
        deltaEnv:  prev !== null ? v.enviado   - prev.enviado   : null,
        deltaDev:  prev !== null ? v.devolvido  - prev.devolvido : null,
        deltaTaxa: taxaRetorno !== null && prevTaxaRet !== null
          ? taxaRetorno - prevTaxaRet : null,
      };
    });
  const crossDesc = [...crossAsc].reverse();

  // Melhor / pior mês (taxa de inadimplência) — apenas meses com envio
  const crossComEnvio = crossAsc.filter(m => m.enviado > 0 && m.taxaRetorno !== null);
  const mesMenorInad = crossComEnvio.length
    ? crossComEnvio.reduce((mn, m) => (m.taxaRetorno ?? 1) < (mn.taxaRetorno ?? 1) ? m : mn, crossComEnvio[0])
    : null;
  const mesMaiorInad = crossComEnvio.length
    ? crossComEnvio.reduce((mx, m) => (m.taxaRetorno ?? 0) > (mx.taxaRetorno ?? 0) ? m : mx, crossComEnvio[0])
    : null;

  // ── Agregação mensal de devolvidos (para Resumo existente) ────────────────
  const mMap = new Map<string, { dev: number; rF: number; rE: number }>();
  for (const r of rows) {
    const ym = ymKey(r.data);
    const e  = mMap.get(ym) ?? { dev: 0, rF: 0, rE: 0 };
    e.dev += Number(r.valor_devolvido    || 0);
    e.rF  += Number(r.valor_rec_fornecedor || 0);
    e.rE  += Number(r.valor_rec_empresa   || 0);
    mMap.set(ym, e);
  }

  const monthsAsc = [...mMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, v], idx, arr) => {
      const rec  = v.rF + v.rE;
      const pend = v.dev - rec;
      const taxa = v.dev > 0 ? rec / v.dev : null;
      const prev = idx > 0 ? arr[idx - 1][1] : null;
      const prevRec  = prev ? prev.rF + prev.rE : null;
      const prevTaxa = prev && prev.dev > 0 ? (prev.rF + prev.rE) / prev.dev : null;
      return {
        ym, label: fmtMonthBR(ym),
        dev: v.dev, rF: v.rF, rE: v.rE, rec, pend, taxa,
        particip: totDev > 0 ? v.dev / totDev : null,
        deltaDev : prev  !== null ? v.dev - prev.dev   : null,
        deltaRec : prevRec !== null ? rec - prevRec     : null,
        deltaTaxa: prevTaxa !== null && taxa !== null ? taxa - prevTaxa : null,
      };
    });
  const months = [...monthsAsc].reverse();

  const mComDev = monthsAsc.filter(m => m.dev > 0);
  const mesMaiorDev  = mComDev.reduce((mx, m) => m.dev  > mx.dev  ? m : mx, mComDev[0]);
  const mesMelhorTaxa = mComDev
    .filter(m => m.taxa !== null)
    .reduce((mx, m) => (m.taxa ?? 0) > (mx.taxa ?? 0) ? m : mx, mComDev[0]);
  const mesPiorTaxa  = mComDev
    .filter(m => m.taxa !== null)
    .reduce((mn, m) => (m.taxa ?? 1) < (mn.taxa ?? 1) ? m : mn, mComDev[0]);

  const now     = new Date();
  const todayBR = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;

  // ══════════════════════════════════════════════════════════════════════════
  //  ABA 1 — Resumo Executivo
  // ══════════════════════════════════════════════════════════════════════════
  const wsR: AW = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  wsR.columns = [
    { width: 36 }, // A
    { width: 18 }, // B
    { width: 18 }, // C
    { width: 18 }, // D
    { width: 18 }, // E
    { width: 16 }, // F
    { width: 13 }, // G
    { width: 13 }, // H
    { width: 14 }, // I
    { width: 12 }, // J
  ];

  // Título
  wsR.mergeCells("A1:J1");
  const rT = wsR.getCell("A1");
  rT.value = "CHEQUES DEVOLVIDOS — GRUPO LEY";
  rT.font  = { bold: true, size: 18, color: { argb: GOLD }, name: "Arial" };
  rT.fill  = fill(NAVY);
  rT.alignment = { vertical: "middle", horizontal: "center" };
  wsR.getRow(1).height = 38;

  wsR.mergeCells("A2:J2");
  const rS = wsR.getCell("A2");
  rS.value = `Exportado em ${todayBR}  ·  Período: ${periodLabel(period)}  ·  ${rows.length} lançamento${rows.length !== 1 ? "s" : ""}  ·  ${notasEnviadas.length} cheques enviados no período`;
  rS.font  = { size: 9, italic: true, color: { argb: "FF8B949E" }, name: "Arial" };
  rS.fill  = fill(NAVY);
  rS.alignment = { vertical: "middle", horizontal: "center" };
  wsR.getRow(2).height = 16;
  wsR.getRow(3).height = 8;

  // ── Seção 1: KPIs Acumulados de Devolvidos ────────────────────────────────
  wsR.mergeCells("A4:J4");
  hdr(wsR.getCell("A4"), "📊  INDICADORES DE DEVOLUÇÕES — PERÍODO", GOLD, "left");
  wsR.getRow(4).height = 22;

  hdr(wsR.getCell("A5"), "Indicador", NAVY, "left");
  hdr(wsR.getCell("B5"), "Valor",     NAVY, "right");
  wsR.mergeCells("B5:J5");
  wsR.getRow(5).height = 16;

  type KpiRow = [string, number | string, string | undefined, string, boolean?];
  const kpis: KpiRow[] = [
    ["Total devolvido no período",              totDev,      BRL, RED_T,          true],
    ["Total recuperado",                        totRec,      BRL, GRN_T,          true],
    ["  ↳ Recuperado pelo fornecedor",          totRecF,     BRL, GRN_T],
    ["  ↳ Recuperado pela empresa (Ley)",       totRecE,     BRL, GRN_T],
    ["Pendente acumulado",                      totPend,     BRL, totPend > 0 ? AMB_T : GRN_T, true],
    ["Taxa de recuperação geral",               taxaRec,     PCT, taxaRec >= 1 ? GRN_T : taxaRec >= 0.5 ? AMB_T : RED_T, true],
    ["Ticket médio por devolução",              ticketMedio, BRL, INK],
    ["Ticket médio dos pendentes",              ticketPend,  BRL, ticketPend > 0 ? AMB_T : GRN_T],
    ["Maior cheque individual ainda pendente",  maiorPend,   BRL, maiorPend > 0 ? RED_T : GRN_T],
    ["Qtd. devoluções lançadas",                devRows.length,    INT, INK],
    ["Qtd. recuperações avulsas",               avulsaRows.length, INT, INK],
    ["Qtd. lançamentos ainda pendentes",        pendRows.length,   INT, pendRows.length > 0 ? RED_T : GRN_T],
  ];

  kpis.forEach(([label, value, fmt, color, bold], i) => {
    const ri = 6 + i;
    const bg = zebra(i);
    wsR.getRow(ri).height = 17;

    const la = wsR.getCell(ri, 1);
    la.value = label;
    la.font  = { size: 9, color: { argb: INK }, name: "Arial",
                 bold: !!bold, italic: (label as string).startsWith("  ") };
    la.fill  = fill(bg);
    la.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    la.border = brd();

    const va = wsR.getCell(ri, 2);
    va.value = value;
    if (fmt) va.numFmt = fmt;
    va.font  = { size: 10, bold: !!bold, color: { argb: color }, name: "Arial" };
    va.fill  = fill(bg);
    va.alignment = { vertical: "middle", horizontal: "right" };
    va.border = brd();
    wsR.mergeCells(ri, 2, ri, 10);
  });

  // ── Seção 2: Correlação Envios × Devoluções ───────────────────────────────
  const crSec = 6 + kpis.length + 1;
  wsR.getRow(crSec - 1).height = 8;
  wsR.mergeCells(crSec, 1, crSec, 10);
  hdr(wsR.getCell(crSec, 1), "📈  CORRELAÇÃO: CHEQUES ENVIADOS × DEVOLVIDOS", TEL_H, "left");
  wsR.getRow(crSec).height = 22;

  const inadColor = taxaInad === null ? GRAY_T
    : taxaInad <= 0.02 ? GRN_T
    : taxaInad <= 0.05 ? AMB_T
    : RED_T;

  const crKpis: KpiRow[] = [
    ["Total de cheques enviados no período",              totEnviado,  BRL, INK,  true],
    ["Total de cheques devolvidos (valor de face)",       totDev,      BRL, RED_T, true],
    ["Taxa de inadimplência (devolvido ÷ enviado)",       taxaInad ?? 0, PCT, inadColor, true],
    ["  Interpretação: % do que foi enviado que voltou",  taxaInad !== null
        ? taxaInad <= 0.02 ? "✅ Nível saudável (< 2%)"
        : taxaInad <= 0.05 ? "⚠ Atenção moderada (2%–5%)"
        : "🔴 Nível elevado (> 5%)" : "— Sem envios no período",
      undefined, inadColor],
    ["Devolvido ainda não recuperado (exposição líquida)", totPend > 0 ? totPend : 0, BRL, totPend > 0 ? RED_T : GRN_T, true],
    ["Taxa de recuperação sobre o que voltou",            taxaRec, PCT, taxaRec >= 1 ? GRN_T : taxaRec >= 0.5 ? AMB_T : RED_T],
    mesMenorInad
      ? ["Mês com menor inadimplência", `${mesMenorInad.label} — ${((mesMenorInad.taxaRetorno ?? 0) * 100).toFixed(1)}%`, undefined, GRN_T]
      : ["Mês com menor inadimplência", "— Sem dados suficientes", undefined, GRAY_T],
    mesMaiorInad && mesMaiorInad.ym !== mesMenorInad?.ym
      ? ["Mês com maior inadimplência", `${mesMaiorInad.label} — ${((mesMaiorInad.taxaRetorno ?? 0) * 100).toFixed(1)}%`, undefined, RED_T]
      : ["Mês com maior inadimplência", "— Sem dados suficientes", undefined, GRAY_T],
  ];

  crKpis.forEach(([label, value, fmt, color, bold], i) => {
    const ri = crSec + 1 + i;
    const bg = zebra(i);
    wsR.getRow(ri).height = 17;

    const la = wsR.getCell(ri, 1);
    la.value = label;
    la.font  = { size: 9, color: { argb: INK }, name: "Arial",
                 bold: !!bold, italic: (label as string).startsWith("  ") };
    la.fill  = fill(bg);
    la.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    la.border = brd();

    const va = wsR.getCell(ri, 2);
    va.value = value;
    if (fmt && typeof value === "number") va.numFmt = fmt;
    va.font  = { size: 10, bold: !!bold, color: { argb: color }, name: "Arial" };
    va.fill  = fill(bg);
    va.alignment = { vertical: "middle", horizontal: "right" };
    va.border = brd();
    wsR.mergeCells(ri, 2, ri, 10);
  });

  // ── Seção 3: Destaques / Insights ─────────────────────────────────────────
  const insSec = crSec + crKpis.length + 1;
  wsR.getRow(insSec - 1).height = 8;
  wsR.mergeCells(insSec, 1, insSec, 10);
  hdr(wsR.getCell(insSec, 1), "💡  DESTAQUES DO PERÍODO", NAVY, "left");
  wsR.getRow(insSec).height = 22;

  type InsRow = [string, string, string];
  const insights: InsRow[] = [];

  if (mesMaiorDev) {
    insights.push([
      "Mês com maior volume de devoluções",
      `${mesMaiorDev.label}`,
      mesMaiorDev.dev.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    ]);
  }
  if (mesMelhorTaxa?.taxa !== null && mesMelhorTaxa) {
    insights.push([
      "Mês com melhor taxa de recuperação",
      `${mesMelhorTaxa.label}`,
      `${((mesMelhorTaxa.taxa ?? 0) * 100).toFixed(1)}%`,
    ]);
  }
  if (mesPiorTaxa?.taxa !== null && mesPiorTaxa && mesPiorTaxa.ym !== mesMelhorTaxa?.ym) {
    insights.push([
      "Mês com pior taxa de recuperação",
      `${mesPiorTaxa.label}`,
      `${((mesPiorTaxa.taxa ?? 0) * 100).toFixed(1)}%`,
    ]);
  }
  if (months.length > 1) {
    const ultimo   = months[0];
    const anterior = months[1];
    const sinal    = ultimo.dev < anterior.dev ? "↓ Queda" : "↑ Alta";
    insights.push([
      `Variação de devoluções (${anterior.label} → ${ultimo.label})`,
      sinal,
      (ultimo.dev - anterior.dev).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    ]);
  }
  if (taxaRec > 0) {
    insights.push([
      "Nível de exposição (pendente / total devolvido)",
      totPend <= 0 ? "✅ Zerado" : `${((totPend / totDev) * 100).toFixed(1)}% do total devolvido ainda pendente`,
      totPend > 0 ? totPend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
    ]);
  }
  if (taxaInad !== null) {
    const trend = crossDesc.length >= 2
      ? (crossDesc[0].taxaRetorno ?? 0) < (crossDesc[1].taxaRetorno ?? 0) ? "↓ Melhora" : "↑ Piora"
      : null;
    if (trend) {
      insights.push([
        `Tendência de inadimplência (${crossDesc[1]?.label} → ${crossDesc[0]?.label})`,
        trend,
        `Taxa atual: ${((crossDesc[0]?.taxaRetorno ?? 0) * 100).toFixed(1)}%`,
      ]);
    }
  }

  insights.forEach(([descr, destaque, valor], i) => {
    const ri = insSec + 1 + i;
    const bg = zebra(i);
    wsR.getRow(ri).height = 17;

    dat(wsR.getCell(ri, 1), descr,    undefined, INK, bg, "left");
    wsR.mergeCells(ri, 2, ri, 7);
    dat(wsR.getCell(ri, 2), destaque, undefined, BLU_T, bg, "left", true);
    wsR.mergeCells(ri, 8, ri, 10);
    dat(wsR.getCell(ri, 8), valor,    undefined, INK, bg, "right", true);
  });

  // ── Seção 4: Resumo Mensal de Devolvidos ──────────────────────────────────
  const mSec = insSec + insights.length + 2;
  wsR.getRow(mSec - 1).height = 8;
  wsR.mergeCells(mSec, 1, mSec, 10);
  hdr(wsR.getCell(mSec, 1), "📅  EVOLUÇÃO MENSAL — com Participação % e Variação (Δ)", GOLD, "left");
  wsR.getRow(mSec).height = 22;

  const mHdr = mSec + 1;
  [
    ["Mês",          NAVY],
    ["Devolvido",    RED_H],
    ["Rec. Forn.",   GRN_H],
    ["Rec. Empresa", GRN_H],
    ["Total Rec.",   GRN_H],
    ["Pendente",     AMB_H],
    ["Taxa %",       TEL_H],
    ["Particip. %",  TEL_H],
    ["Δ Devolvido",  NAVY],
    ["Δ Taxa",       NAVY],
  ].forEach(([h, bg], ci) => hdr(wsR.getCell(mHdr, ci + 1), h as string, bg as string));
  wsR.getRow(mHdr).height = 20;

  months.forEach((m, i) => {
    const ri  = mHdr + 1 + i;
    const bg  = zebra(i);
    wsR.getRow(ri).height = 17;

    const pendColor = m.pend  > 0     ? AMB_T : GRN_T;
    const taxaColor = m.taxa !== null  ? (m.taxa >= 1 ? GRN_T : m.taxa >= 0.5 ? AMB_T : RED_T) : INK;
    const dDevColor = m.deltaDev  === null ? INK : m.deltaDev  <= 0 ? GRN_T : RED_T;
    const dTaxColor = m.deltaTaxa === null ? INK : m.deltaTaxa >= 0 ? GRN_T : RED_T;

    dat(wsR.getCell(ri, 1), m.label,                       undefined, INK,       bg, "left", true);
    dat(wsR.getCell(ri, 2), m.dev   || null,                BRL,       RED_T,     bg, "right");
    dat(wsR.getCell(ri, 3), m.rF    || null,                BRL,       GRN_T,     bg, "right");
    dat(wsR.getCell(ri, 4), m.rE    || null,                BRL,       GRN_T,     bg, "right");
    dat(wsR.getCell(ri, 5), m.rec   || null,                BRL,       GRN_T,     bg, "right", true);
    dat(wsR.getCell(ri, 6), m.pend  >  0 ? m.pend : null,  BRL,       pendColor, bg, "right");
    dat(wsR.getCell(ri, 7), m.taxa,                         PCT,       taxaColor, bg, "right", !!(m.taxa !== null));
    dat(wsR.getCell(ri, 8), m.particip,                     PCT,       INK,       bg, "right");
    dat(wsR.getCell(ri, 9), m.deltaDev,                     DELT,      dDevColor, bg, "right");
    dat(wsR.getCell(ri, 10),m.deltaTaxa,                    DPCT,      dTaxColor, bg, "right");
  });

  const mTot = mHdr + 1 + months.length;
  wsR.getRow(mTot).height = 20;
  tot(wsR.getCell(mTot, 1), "TOTAL",   undefined, "left");
  tot(wsR.getCell(mTot, 2), totDev,    BRL);
  tot(wsR.getCell(mTot, 3), totRecF,   BRL);
  tot(wsR.getCell(mTot, 4), totRecE,   BRL);
  tot(wsR.getCell(mTot, 5), totRec,    BRL);
  tot(wsR.getCell(mTot, 6), totPend > 0 ? totPend : 0, BRL);
  tot(wsR.getCell(mTot, 7), taxaRec,   PCT);
  tot(wsR.getCell(mTot, 8), 1,         PCT);
  emptyNav(wsR.getCell(mTot, 9));
  emptyNav(wsR.getCell(mTot, 10));

  wsR.views = [{ state: "frozen", ySplit: 2, showGridLines: false }];

  // ══════════════════════════════════════════════════════════════════════════
  //  ABA 2 — Inadimplência por Mês (NOVA: enviado × devolvido cruzado)
  // ══════════════════════════════════════════════════════════════════════════
  const wsI: AW = wb.addWorksheet("Inadimplência por Mês", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  wsI.columns = [
    { width: 13 }, // A — Mês
    { width: 20 }, // B — Enviado
    { width: 18 }, // C — Devolvido
    { width: 14 }, // D — Taxa Inadimpl.%
    { width: 18 }, // E — Recuperado
    { width: 18 }, // F — Pendente
    { width: 14 }, // G — Taxa Recup.%
    { width: 16 }, // H — Δ Enviado
    { width: 16 }, // I — Δ Devolvido
    { width: 14 }, // J — Δ Taxa Inad.
  ];

  wsI.mergeCells("A1:J1");
  const iT = wsI.getCell("A1");
  iT.value = "ANÁLISE DE INADIMPLÊNCIA — CHEQUES ENVIADOS × DEVOLVIDOS POR MÊS";
  iT.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  iT.fill  = fill(NAVY);
  iT.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsI.getRow(1).height = 28;

  wsI.mergeCells("A2:J2");
  const iS = wsI.getCell("A2");
  iS.value = `Taxa de inadimplência = Devolvido ÷ Enviado no mesmo mês  ·  Período: ${periodLabel(period)}  ·  ${crossDesc.length} meses com dados`;
  iS.font  = { size: 9, italic: true, color: { argb: "FF8B949E" }, name: "Arial" };
  iS.fill  = fill(NAVY);
  iS.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsI.getRow(2).height = 16;

  // KPIs de inadimplência no topo da aba
  const iKpiRow = 3;
  const iKpiData: [string, string][] = [
    ["Total enviado",  totEnviado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
    ["Total devolvido", totDev.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
    ["Taxa inad. global", taxaInad !== null ? `${(taxaInad * 100).toFixed(2)}%` : "—"],
    ["Exposição líquida", totPend > 0 ? totPend.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "✓ Zerado"],
  ];
  const iKpiColors = [INK, RED_T, inadColor, totPend > 0 ? RED_T : GRN_T];
  iKpiData.forEach(([label, value], ci) => {
    const cell = wsI.getCell(iKpiRow, ci + 1);
    const col2 = wsI.getCell(iKpiRow + 1, ci + 1);
    wsI.getRow(iKpiRow).height = 14;
    wsI.getRow(iKpiRow + 1).height = 22;

    cell.value = label;
    cell.font  = { size: 8, color: { argb: "FF8B949E" }, name: "Arial" };
    cell.fill  = fill(WHITE);
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = brd();

    col2.value = value;
    col2.font  = { bold: true, size: 12, color: { argb: iKpiColors[ci] }, name: "Arial" };
    col2.fill  = fill(GOLD_LT);
    col2.alignment = { vertical: "middle", horizontal: "center" };
    col2.border = brd();
  });

  wsI.getRow(iKpiRow + 2).height = 8;

  // Cabeçalho da tabela mensal
  const iHdr = iKpiRow + 3;
  [
    ["Mês",              NAVY],
    ["Enviado",          GRN_H],
    ["Devolvido",        RED_H],
    ["Taxa Inad. %",     RED_H],
    ["Recuperado",       GRN_H],
    ["Pendente",         AMB_H],
    ["Taxa Recup. %",    TEL_H],
    ["Δ Enviado",        NAVY],
    ["Δ Devolvido",      NAVY],
    ["Δ Taxa Inad.",     NAVY],
  ].forEach(([h, bg], ci) => hdr(wsI.getCell(iHdr, ci + 1), h as string, bg as string));
  wsI.getRow(iHdr).height = 22;

  crossDesc.forEach((m, i) => {
    const ri   = iHdr + 1 + i;
    const bg   = zebra(i);
    wsI.getRow(ri).height = 17;

    const tInadC = m.taxaRetorno === null ? GRAY_T
      : m.taxaRetorno <= 0.02 ? GRN_T
      : m.taxaRetorno <= 0.05 ? AMB_T : RED_T;
    const tRecC  = m.taxaRecupMes === null ? GRAY_T
      : m.taxaRecupMes >= 1 ? GRN_T
      : m.taxaRecupMes >= 0.5 ? AMB_T : RED_T;
    const dEnvC  = m.deltaEnv  === null ? GRAY_T : m.deltaEnv  >= 0 ? GRN_T : RED_T;
    const dDevC  = m.deltaDev  === null ? GRAY_T : m.deltaDev  <= 0 ? GRN_T : RED_T;
    const dTaxC  = m.deltaTaxa === null ? GRAY_T : m.deltaTaxa <= 0 ? GRN_T : RED_T;

    dat(wsI.getCell(ri, 1), m.label,                        undefined, INK,   bg, "left", true);
    dat(wsI.getCell(ri, 2), m.enviado   || null,             BRL,       GRN_T, bg, "right");
    dat(wsI.getCell(ri, 3), m.devolvido || null,             BRL,       RED_T, bg, "right");
    dat(wsI.getCell(ri, 4), m.taxaRetorno,                   PCT,       tInadC,bg, "right", true);
    dat(wsI.getCell(ri, 5), m.recuperado || null,            BRL,       GRN_T, bg, "right");
    dat(wsI.getCell(ri, 6), m.pendente > 0 ? m.pendente : null, BRL,   AMB_T, bg, "right");
    dat(wsI.getCell(ri, 7), m.taxaRecupMes,                  PCT,       tRecC, bg, "right");
    dat(wsI.getCell(ri, 8), m.deltaEnv,                      DELT,      dEnvC, bg, "right");
    dat(wsI.getCell(ri, 9), m.deltaDev,                      DELT,      dDevC, bg, "right");
    dat(wsI.getCell(ri, 10),m.deltaTaxa,                     DPCT,      dTaxC, bg, "right");
  });

  // Linha de total
  const iTot = iHdr + 1 + crossDesc.length;
  wsI.getRow(iTot).height = 22;
  const totPendCross = crossAsc.reduce((s, m) => s + m.pendente, 0);
  tot(wsI.getCell(iTot, 1), "TOTAL",        undefined, "left");
  tot(wsI.getCell(iTot, 2), totEnviado,     BRL);
  tot(wsI.getCell(iTot, 3), totDev,         BRL);
  tot(wsI.getCell(iTot, 4), taxaInad ?? 0,  PCT);
  tot(wsI.getCell(iTot, 5), totRec,         BRL);
  tot(wsI.getCell(iTot, 6), totPendCross > 0 ? totPendCross : 0, BRL);
  tot(wsI.getCell(iTot, 7), taxaRec,        PCT);
  emptyNav(wsI.getCell(iTot, 8));
  emptyNav(wsI.getCell(iTot, 9));
  emptyNav(wsI.getCell(iTot, 10));

  // Nota explicativa
  const iNota = iTot + 2;
  wsI.getRow(iNota).height = 16;
  wsI.mergeCells(iNota, 1, iNota, 10);
  const nota = wsI.getCell(iNota, 1);
  nota.value = "ℹ  Taxa Inad. % = quanto do valor ENVIADO naquele mês voltou como devolvido no mesmo mês. Valores de meses diferentes podem não ter correlação causal direta.";
  nota.font  = { size: 8, italic: true, color: { argb: GRAY_T }, name: "Arial" };
  nota.fill  = fill(WHITE);
  nota.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // ══════════════════════════════════════════════════════════════════════════
  //  ABA 3 — Lançamentos Completos
  // ══════════════════════════════════════════════════════════════════════════
  const wsL: AW = wb.addWorksheet("Lançamentos", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  wsL.columns = [
    { width: 13 }, // A — Data
    { width: 22 }, // B — Tipo
    { width: 18 }, // C — Devolvido
    { width: 18 }, // D — Total Rec.
    { width: 18 }, // E — Pendente
    { width: 12 }, // F — % Recuperado
    { width: 24 }, // G — Status
  ];

  wsL.mergeCells("A1:G1");
  const lT = wsL.getCell("A1");
  lT.value = `LANÇAMENTOS COMPLETOS — ${periodLabel(period)} · ${rows.length} registros`;
  lT.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  lT.fill  = fill(NAVY);
  lT.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsL.getRow(1).height = 26;

  [
    ["Data",           NAVY],
    ["Tipo",           NAVY],
    ["Devolvido",      RED_H],
    ["Total Rec.",     GRN_H],
    ["Pendente",       AMB_H],
    ["% Recup.",       TEL_H],
    ["Status",         NAVY],
  ].forEach(([h, bg], ci) => hdr(wsL.getCell(2, ci + 1), h as string, bg as string));
  wsL.getRow(2).height = 20;

  sorted.forEach((r, i) => {
    const dev   = Number(r.valor_devolvido    || 0);
    const rF    = Number(r.valor_rec_fornecedor || 0);
    const rE    = Number(r.valor_rec_empresa   || 0);
    const rec   = rF + rE;
    const pend  = dev - rec;
    const pct   = dev > 0 ? rec / dev : null;
    const avulsa = dev <= 0 && rec > 0;

    const status  = avulsa          ? "—"
                  : pend <= 0       ? "✓ Quitado"
                  : rec  >  0       ? "⏳ Parcial"
                                    : "❌ Sem recuperação";
    const statusC = avulsa    ? INK
                  : pend <= 0 ? GRN_T
                  : rec  >  0 ? AMB_T
                              : RED_T;
    const pctC    = pct === null ? INK : pct >= 1 ? GRN_T : pct >= 0.5 ? AMB_T : RED_T;
    const tipoC   = avulsa ? BLU_T : RED_T;

    const ri = 3 + i;
    const bg = zebra(i);
    wsL.getRow(ri).height = 17;

    dat(wsL.getCell(ri, 1), fmtDateBR(r.data),         undefined, INK,     bg, "left");
    dat(wsL.getCell(ri, 2), avulsa ? "Recuperação avulsa" : "Cheque devolvido", undefined, tipoC, bg, "left");
    dat(wsL.getCell(ri, 3), dev  > 0 ? dev  : null,    BRL,       RED_T,   bg, "right");
    dat(wsL.getCell(ri, 4), rec  > 0 ? rec  : null,    BRL,       GRN_T,   bg, "right");
    dat(wsL.getCell(ri, 5), !avulsa && pend > 0 ? pend : null, BRL, AMB_T, bg, "right");
    dat(wsL.getCell(ri, 6), pct,                        PCT,       pctC,    bg, "right");
    dat(wsL.getCell(ri, 7), status,                     undefined, statusC, bg, "left");
  });

  const lTot = 3 + sorted.length;
  wsL.getRow(lTot).height = 20;
  tot(wsL.getCell(lTot, 1), "TOTAL",  undefined, "left");
  emptyNav(wsL.getCell(lTot, 2));
  tot(wsL.getCell(lTot, 3), totDev,   BRL);
  tot(wsL.getCell(lTot, 4), totRec,   BRL);
  tot(wsL.getCell(lTot, 5), totPend > 0 ? totPend : 0, BRL);
  tot(wsL.getCell(lTot, 6), taxaRec,  PCT);
  emptyNav(wsL.getCell(lTot, 7));

  // ══════════════════════════════════════════════════════════════════════════
  //  ABA 4 — Pendências em Aberto
  // ══════════════════════════════════════════════════════════════════════════
  const pendentes = sorted
    .filter(r => {
      const d   = Number(r.valor_devolvido || 0);
      const rec = Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0);
      return d > 0 && d - rec > 0;
    })
    .sort((a, b) => a.data.localeCompare(b.data));

  const wsP: AW = wb.addWorksheet("Pendências", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  wsP.columns = [
    { width: 13 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 12 },
    { width: 24 },
  ];

  const pTitleBg = pendentes.length === 0 ? GRN_H : RED_H;
  const pTitleTx = pendentes.length === 0
    ? "✅  PENDÊNCIAS — TODOS OS CHEQUES QUITADOS"
    : `⚠️  PENDÊNCIAS EM ABERTO — ${pendentes.length} lançamento${pendentes.length !== 1 ? "s" : ""}`;

  wsP.mergeCells("A1:G1");
  const pT = wsP.getCell("A1");
  pT.value = pTitleTx;
  pT.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  pT.fill  = fill(pTitleBg);
  pT.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsP.getRow(1).height = 26;

  [
    ["Data Devolução",  NAVY],
    ["Dias em Aberto",  RED_H],
    ["Devolvido",       RED_H],
    ["Total Recuperado",GRN_H],
    ["Pendente",        RED_H],
    ["% Recup.",        TEL_H],
    ["Situação",        NAVY],
  ].forEach(([h, bg], ci) => hdr(wsP.getCell(2, ci + 1), h as string, bg as string));
  wsP.getRow(2).height = 20;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  if (pendentes.length === 0) {
    wsP.mergeCells("A3:G3");
    const nc = wsP.getCell("A3");
    nc.value = "Todos os cheques devolvidos estão quitados. Nenhuma pendência em aberto.";
    nc.font  = { size: 10, bold: true, color: { argb: GRN_T }, name: "Arial" };
    nc.fill  = fill(GOLD_LT);
    nc.alignment = { vertical: "middle", horizontal: "center" };
    nc.border = brd();
    wsP.getRow(3).height = 28;
  } else {
    pendentes.forEach((r, i) => {
      const dev  = Number(r.valor_devolvido    || 0);
      const rF   = Number(r.valor_rec_fornecedor || 0);
      const rE   = Number(r.valor_rec_empresa   || 0);
      const rec  = rF + rE;
      const pend = dev - rec;
      const pct  = dev > 0 ? rec / dev : 0;
      const dataDate = new Date(`${r.data}T00:00:00`);
      const dias = Math.floor((hoje.getTime() - dataDate.getTime()) / 86400000);
      const diasC = dias > 90 ? RED_T : dias > 30 ? AMB_T : INK;
      const pctC  = pct >= 0.5 ? AMB_T : RED_T;

      const situacao = rec === 0
        ? "❌ Sem nenhuma recuperação"
        : dias > 90
          ? `🔴 ${(pct * 100).toFixed(0)}% recup. — crítico (>90 dias)`
          : dias > 30
            ? `🟡 ${(pct * 100).toFixed(0)}% recup. — atenção (>30 dias)`
            : `⏳ ${(pct * 100).toFixed(0)}% recuperado`;
      const situacaoC = rec === 0 ? RED_T : dias > 90 ? RED_T : AMB_T;

      const ri = 3 + i;
      const bg = i % 2 === 0 ? "FFFFF5F5" : WHITE;
      wsP.getRow(ri).height = 17;

      dat(wsP.getCell(ri, 1), fmtDateBR(r.data), undefined, INK,      bg, "left");
      dat(wsP.getCell(ri, 2), dias,               undefined, diasC,    bg, "right", dias > 30);
      dat(wsP.getCell(ri, 3), dev,                BRL,       RED_T,    bg, "right");
      dat(wsP.getCell(ri, 4), rec > 0 ? rec : null, BRL,    GRN_T,    bg, "right");
      dat(wsP.getCell(ri, 5), pend,               BRL,       RED_T,    bg, "right", true);
      dat(wsP.getCell(ri, 6), pct,                PCT,       pctC,     bg, "right");
      dat(wsP.getCell(ri, 7), situacao,           undefined, situacaoC,bg, "left");
    });

    const pTotDev  = pendentes.reduce((s, r) => s + Number(r.valor_devolvido || 0), 0);
    const pTotRec  = pendentes.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0), 0);
    const pTotPend = pTotDev - pTotRec;
    const pTotTaxa = pTotDev > 0 ? pTotRec / pTotDev : 0;

    const pTotRow = 3 + pendentes.length;
    wsP.getRow(pTotRow).height = 20;
    tot(wsP.getCell(pTotRow, 1), "TOTAL",                      undefined, "left");
    emptyNav(wsP.getCell(pTotRow, 2));
    tot(wsP.getCell(pTotRow, 3), pTotDev,                      BRL);
    tot(wsP.getCell(pTotRow, 4), pTotRec > 0 ? pTotRec : null, BRL);
    tot(wsP.getCell(pTotRow, 5), pTotPend,                     BRL);
    tot(wsP.getCell(pTotRow, 6), pTotTaxa,                     PCT);
    emptyNav(wsP.getCell(pTotRow, 7));
  }

  wb.views = [{ activeTab: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
