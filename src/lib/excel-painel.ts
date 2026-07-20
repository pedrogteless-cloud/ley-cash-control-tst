// Exportação completa do Painel de Cheques — Grupo Ley
// Paleta visual alinhada com o design do software (navy + ouro + semáforo claro).

import type { NFRecord, CaixaRecord } from "@/data/store";
import { isAEnviar, isAguardando, isEnviado, isSeparado } from "@/data/painel";
import { supabase } from "@/integrations/supabase/client";

// ── Paleta ────────────────────────────────────────────────────────────────────
const NAVY    = "FF0D1117";
const GOLD    = "FFF0B429";
const RED_H   = "FF8B2000";
const GRN_H   = "FF1A5E35";
const TEL_H   = "FF0D4A5F";
const AMB_H   = "FF6B4200";
const BLU_H   = "FF0D3250";
const WHITE   = "FFFFFFFF";
const GOLD_LT = "FFFFF9EE";
const BORD    = "FFD4B483";
const INK     = "FF0D1117";
const RED_T   = "FF8B1A1A";
const GRN_T   = "FF1A5E35";
const AMB_T   = "FF8B5A00";
const BLU_T   = "FF0D3B73";
const GRAY_T  = "FF5A5A6E";

// ── Formatos numéricos ────────────────────────────────────────────────────────
const BRL  = '"R$" #,##0.00';
const PCT  = "0.0%";
const INT  = "#,##0";
const DELT = '+#,##0.00;-#,##0.00;"-"';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AW = any;

// ── Helpers visuais ───────────────────────────────────────────────────────────
function fill(argb: string) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } } as const;
}
function brd() {
  const t = (a: string) => ({ style: "thin", color: { argb: a } } as const);
  return { top: t(BORD), left: t(BORD), bottom: t(BORD), right: t(BORD) };
}

function hdr(cell: AC, text: string, bg: string, align: "left" | "center" | "right" = "center") {
  cell.value = text;
  cell.font  = { bold: true, size: 9, color: { argb: WHITE }, name: "Arial" };
  cell.fill  = fill(bg);
  cell.alignment = { vertical: "middle", horizontal: align, wrapText: true };
  cell.border = brd();
}

function dat(
  cell: AC, value: unknown, numFmt: string | undefined,
  textColor: string, bgColor: string, align: "left" | "center" | "right",
  bold = false,
) {
  cell.value = value ?? null;
  if (numFmt) cell.numFmt = numFmt;
  cell.font      = { size: 9, bold, color: { argb: textColor }, name: "Arial" };
  cell.fill      = fill(bgColor);
  cell.alignment = { vertical: "middle", horizontal: align, indent: align === "left" ? 1 : 0 };
  cell.border    = brd();
}

function tot(cell: AC, value: unknown, numFmt: string | undefined, align: "left" | "center" | "right" = "right") {
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

function fmtDateISO(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch { return "—"; }
}

function fmtMonthBR(ym: string): string {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [y, m] = ym.split("-");
  return `${meses[Number(m) - 1]}/${y}`;
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 1 — Resumo Executivo
// ══════════════════════════════════════════════════════════════════════════════
function buildResumoSheet(
  wb: AW,
  notas: NFRecord[],
  caixa: CaixaRecord[],
  devolvidos: DevRow[],
  todayBR: string,
) {
  const ws: AW = wb.addWorksheet("Resumo Executivo", { views: [{ showGridLines: false }] });
  ws.columns = [
    { width: 40 }, // A
    { width: 20 }, // B
    { width: 16 }, // C
    { width: 16 }, // D
    { width: 16 }, // E
    { width: 16 }, // F
  ];

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  ws.mergeCells("A1:F1");
  const t = ws.getCell("A1");
  t.value = "PAINEL DE CHEQUES — GRUPO LEY";
  t.font  = { bold: true, size: 18, color: { argb: GOLD }, name: "Arial" };
  t.fill  = fill(NAVY);
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 38;

  ws.mergeCells("A2:F2");
  const sub = ws.getCell("A2");
  sub.value = `Gerado em ${todayBR}  ·  ${notas.length} NFs  ·  ${caixa.length} movimentos de caixa  ·  ${devolvidos.length} devolvidos`;
  sub.font  = { size: 9, italic: true, color: { argb: "FF8B949E" }, name: "Arial" };
  sub.fill  = fill(NAVY);
  sub.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 10;

  // ── KPIs derivados ─────────────────────────────────────────────────────────
  const emAberto    = notas.filter((n) => !isEnviado(n));
  const emCarteira  = notas.filter(isAEnviar);
  const separados   = notas.filter(isSeparado);
  const aguardando  = notas.filter(isAguardando);
  const enviadas    = notas.filter(isEnviado);

  const valCarteira   = emCarteira.reduce((s, n) => s + n.valor, 0);
  const valSeparados  = separados.reduce((s, n) => s + n.valor, 0);
  const valAguardando = aguardando.reduce((s, n) => s + n.valor, 0);
  const valEnviado    = enviadas.reduce((s, n) => s + n.valor, 0);
  const valAberto     = emAberto.reduce((s, n) => s + n.valor, 0);

  const saldoAtual = caixa.length ? caixa[caixa.length - 1].saldoTotal : 0;
  const cobertura  = valAberto > 0 ? saldoAtual / valAberto : null;

  const totDevolvido  = devolvidos.reduce((s, r) => s + Number(r.valor_devolvido || 0), 0);
  const totRecuperado = devolvidos.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0), 0);
  const totPendDev    = totDevolvido - totRecuperado;
  const taxaRecDev    = totDevolvido > 0 ? totRecuperado / totDevolvido : null;

  const totalEntradas = caixa.reduce((s, c) => s + c.entrada, 0);
  const totalSaidas   = caixa.reduce((s, c) => s + c.saida, 0);

  // Fornecedor com maior valor em aberto
  const fornMap = new Map<string, number>();
  emCarteira.forEach((n) => fornMap.set(n.fornecedor, (fornMap.get(n.fornecedor) || 0) + n.valor));
  const maiorForn = [...fornMap.entries()].sort((a, b) => b[1] - a[1])[0];

  // ── Seção A: Posição Atual ─────────────────────────────────────────────────
  const A_ROW = 4;
  ws.mergeCells(A_ROW, 1, A_ROW, 6);
  hdr(ws.getCell(A_ROW, 1), "📊  POSIÇÃO ATUAL — CARTEIRA E CAIXA", GOLD, "left");
  ws.getRow(A_ROW).height = 22;

  type KpiEntry = [string, unknown, string | undefined, string, boolean?];
  const kpisA: KpiEntry[] = [
    ["Carteira de NFs em aberto (total)", valAberto,    BRL, INK, true],
    ["  ↳ Em carteira (prontas p/ cheque)", valCarteira, BRL, AMB_T],
    ["  ↳ Separadas para envio",            valSeparados, BRL, BLU_T],
    ["  ↳ Aguardando chegada de carga",      valAguardando,BRL, GRAY_T],
    ["Saldo em caixa de cheques",           saldoAtual,  BRL, GRN_T, true],
    [
      "Cobertura do caixa sobre a carteira",
      cobertura,
      PCT,
      cobertura === null ? GRAY_T : cobertura >= 1 ? GRN_T : cobertura >= 0.7 ? AMB_T : RED_T,
      true,
    ],
    ["Qtd. NFs em aberto", emAberto.length, INT, INK],
    ["Qtd. NFs prontas p/ cheque", emCarteira.length, INT, emCarteira.length > 0 ? AMB_T : GRN_T],
    ["Qtd. NFs já enviadas (histórico)", enviadas.length, INT, GRN_T],
    ["Total já enviado em cheques", valEnviado, BRL, GRN_T],
  ];

  kpisA.forEach(([label, value, fmt, color, bold], i) => {
    const ri = A_ROW + 1 + i;
    const bg = zebra(i);
    ws.getRow(ri).height = 17;

    const la = ws.getCell(ri, 1);
    la.value = label;
    la.font  = { size: 9, color: { argb: INK }, name: "Arial", bold: !!bold, italic: (label as string).startsWith("  ") };
    la.fill  = fill(bg);
    la.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    la.border = brd();

    const va = ws.getCell(ri, 2);
    va.value = value;
    if (fmt) va.numFmt = fmt;
    va.font  = { size: 10, bold: !!bold, color: { argb: color }, name: "Arial" };
    va.fill  = fill(bg);
    va.alignment = { vertical: "middle", horizontal: "right" };
    va.border = brd();
    ws.mergeCells(ri, 2, ri, 6);
  });

  // ── Seção B: Caixa ─────────────────────────────────────────────────────────
  const B_ROW = A_ROW + kpisA.length + 2;
  ws.getRow(B_ROW - 1).height = 8;
  ws.mergeCells(B_ROW, 1, B_ROW, 6);
  hdr(ws.getCell(B_ROW, 1), "💰  MOVIMENTOS DE CAIXA — RESUMO", NAVY, "left");
  ws.getRow(B_ROW).height = 22;

  const kpisB: KpiEntry[] = [
    ["Total de entradas no histórico", totalEntradas, BRL, GRN_T, true],
    ["Total de saídas no histórico", totalSaidas, BRL, RED_T, true],
    ["Resultado líquido (entradas − saídas)", totalEntradas - totalSaidas, DELT, (totalEntradas - totalSaidas) >= 0 ? GRN_T : RED_T, true],
    ["Qtd. movimentos cadastrados", caixa.length, INT, INK],
    ["Último movimento", caixa.length ? `${caixa[caixa.length - 1].data} — ${caixa[caixa.length - 1].destino ?? "Sem destino"}` : "—", undefined, GRAY_T],
  ];

  kpisB.forEach(([label, value, fmt, color, bold], i) => {
    const ri = B_ROW + 1 + i;
    const bg = zebra(i);
    ws.getRow(ri).height = 17;

    const la = ws.getCell(ri, 1);
    la.value = label;
    la.font  = { size: 9, color: { argb: INK }, name: "Arial", bold: !!bold };
    la.fill  = fill(bg);
    la.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    la.border = brd();

    const va = ws.getCell(ri, 2);
    va.value = value;
    if (fmt) va.numFmt = fmt;
    va.font  = { size: 10, bold: !!bold, color: { argb: color }, name: "Arial" };
    va.fill  = fill(bg);
    va.alignment = { vertical: "middle", horizontal: "right" };
    va.border = brd();
    ws.mergeCells(ri, 2, ri, 6);
  });

  // ── Seção C: Devolvidos ────────────────────────────────────────────────────
  const C_ROW = B_ROW + kpisB.length + 2;
  ws.getRow(C_ROW - 1).height = 8;
  ws.mergeCells(C_ROW, 1, C_ROW, 6);
  hdr(ws.getCell(C_ROW, 1), "↩️  CHEQUES DEVOLVIDOS — VISÃO GERAL", RED_H, "left");
  ws.getRow(C_ROW).height = 22;

  const pendDev = devolvidos.filter((r) => {
    const d = Number(r.valor_devolvido || 0);
    const rec = Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0);
    return d > 0 && d - rec > 0;
  });

  const kpisC: KpiEntry[] = [
    ["Total de cheques devolvidos (acumulado)", totDevolvido, BRL, RED_T, true],
    ["Total recuperado", totRecuperado, BRL, GRN_T, true],
    ["Pendente de recuperação", totPendDev, BRL, totPendDev > 0 ? AMB_T : GRN_T, true],
    ["Taxa de recuperação global", taxaRecDev, PCT, taxaRecDev === null ? GRAY_T : taxaRecDev >= 1 ? GRN_T : taxaRecDev >= 0.5 ? AMB_T : RED_T],
    ["Lançamentos com pendência em aberto", pendDev.length, INT, pendDev.length > 0 ? RED_T : GRN_T],
    ["Exposição total (devolvidos ainda pendentes)", totPendDev > 0 ? totPendDev : "✓ Zerado", BRL, totPendDev > 0 ? RED_T : GRN_T],
  ];

  kpisC.forEach(([label, value, fmt, color, bold], i) => {
    const ri = C_ROW + 1 + i;
    const bg = zebra(i);
    ws.getRow(ri).height = 17;

    const la = ws.getCell(ri, 1);
    la.value = label;
    la.font  = { size: 9, color: { argb: INK }, name: "Arial", bold: !!bold };
    la.fill  = fill(bg);
    la.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    la.border = brd();

    const va = ws.getCell(ri, 2);
    va.value = value;
    if (typeof value === "number" && fmt) va.numFmt = fmt;
    va.font  = { size: 10, bold: !!bold, color: { argb: color }, name: "Arial" };
    va.fill  = fill(bg);
    va.alignment = { vertical: "middle", horizontal: "right" };
    va.border = brd();
    ws.mergeCells(ri, 2, ri, 6);
  });

  // ── Seção D: Insights automáticos ─────────────────────────────────────────
  const D_ROW = C_ROW + kpisC.length + 2;
  ws.getRow(D_ROW - 1).height = 8;
  ws.mergeCells(D_ROW, 1, D_ROW, 6);
  hdr(ws.getCell(D_ROW, 1), "💡  ALERTAS E INSIGHTS AUTOMÁTICOS", TEL_H, "left");
  ws.getRow(D_ROW).height = 22;

  type InsightRow = [string, string, string]; // [label, valor/destaque, cor do texto]
  const insights: InsightRow[] = [];

  // Cobertura
  if (cobertura !== null) {
    if (cobertura < 0.5) {
      insights.push(["🔴 Caixa CRÍTICO — cobertura abaixo de 50%", `${(cobertura * 100).toFixed(1)}% de ${valAberto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em carteira`, RED_T]);
    } else if (cobertura < 0.7) {
      insights.push(["🟡 Caixa moderado — cobertura entre 50% e 70%", `${(cobertura * 100).toFixed(1)}%`, AMB_T]);
    } else if (cobertura >= 1) {
      insights.push(["✅ Caixa excelente — cobre 100% da carteira", `${(cobertura * 100).toFixed(1)}%`, GRN_T]);
    } else {
      insights.push(["✔ Caixa saudável — cobertura acima de 70%", `${(cobertura * 100).toFixed(1)}%`, GRN_T]);
    }
  }

  // NFs prontas não separadas
  if (emCarteira.length > 0) {
    insights.push([`⚠ ${emCarteira.length} NF(s) em carteira aguardando separação`, valCarteira.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), AMB_T]);
  }

  // Fornecedor com maior valor
  if (maiorForn) {
    insights.push([`Maior fornecedor em carteira: ${maiorForn[0]}`, maiorForn[1].toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), BLU_T]);
  }

  // Devolvidos pendentes
  if (totPendDev > 0) {
    insights.push([`↩ Devolvidos: ${pendDev.length} lançamento(s) com recuperação pendente`, totPendDev.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), RED_T]);
  } else if (devolvidos.length > 0) {
    insights.push(["✅ Devolvidos: todos os lançamentos estão quitados", "—", GRN_T]);
  }

  // Aguardando carga
  if (aguardando.length > 0) {
    insights.push([`⏳ ${aguardando.length} NF(s) aguardando chegada de carga`, valAguardando.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), GRAY_T]);
  }

  // Taxa de recuperação de devolvidos
  if (taxaRecDev !== null && totDevolvido > 0) {
    const nivel = taxaRecDev >= 1 ? "Excelente" : taxaRecDev >= 0.7 ? "Boa" : taxaRecDev >= 0.4 ? "Regular" : "Baixa";
    insights.push([`Taxa de recuperação de devolvidos — ${nivel}`, `${(taxaRecDev * 100).toFixed(1)}% recuperado`, taxaRecDev >= 0.7 ? GRN_T : taxaRecDev >= 0.4 ? AMB_T : RED_T]);
  }

  if (insights.length === 0) insights.push(["✅ Tudo no ritmo esperado. Nenhuma pendência crítica.", "—", GRN_T]);

  insights.forEach(([label, valor, color], i) => {
    const ri = D_ROW + 1 + i;
    const bg = zebra(i);
    ws.getRow(ri).height = 18;

    dat(ws.getCell(ri, 1), label, undefined, color, bg, "left", true);
    ws.mergeCells(ri, 2, ri, 4);
    dat(ws.getCell(ri, 2), valor, undefined, INK, bg, "right");
    ws.mergeCells(ri, 5, ri, 6);
    dat(ws.getCell(ri, 5), "", undefined, INK, bg, "right");
  });

  ws.views = [{ state: "frozen", ySplit: 2, showGridLines: false }];
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 2 — Carteira de NFs (detalhado)
// ══════════════════════════════════════════════════════════════════════════════
function buildCarteiraNFsSheet(wb: AW, notas: NFRecord[]) {
  const ws: AW = wb.addWorksheet("Carteira NFs", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  ws.columns = [
    { width: 28 }, // Fornecedor
    { width: 16 }, // NF
    { width: 16 }, // Filial
    { width: 16 }, // Valor
    { width: 22 }, // Entrega / Situação
    { width: 18 }, // Status
    { width: 18 }, // Data Cadastro
    { width: 18 }, // Data Envio
  ];

  ws.mergeCells("A1:H1");
  const t = ws.getCell("A1");
  t.value = `CARTEIRA DE NOTAS FISCAIS — ${notas.length} registros`;
  t.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  t.fill  = fill(NAVY);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;

  ([
    ["Fornecedor",     NAVY],
    ["NF",             NAVY],
    ["Filial",         NAVY],
    ["Valor",          RED_H],
    ["Entrega / Situação", AMB_H],
    ["Status",         TEL_H],
    ["Data Cadastro",  NAVY],
    ["Data Envio",     GRN_H],
  ] as [string, string][]).forEach(([h, bg], ci) => hdr(ws.getCell(2, ci + 1), h, bg));
  ws.getRow(2).height = 20;

  // Sort: primeiro os em aberto (por fornecedor), depois os enviados
  const sorted = [...notas].sort((a, b) => {
    const ae = isEnviado(a), be = isEnviado(b);
    if (ae !== be) return ae ? 1 : -1; // enviados por último
    return a.fornecedor.localeCompare(b.fornecedor);
  });

  sorted.forEach((n, i) => {
    const ri  = 3 + i;
    const bg  = zebra(i);
    ws.getRow(ri).height = 17;

    const enviado    = isEnviado(n);
    const separado   = isSeparado(n);
    const aguardando = isAguardando(n);
    const emCrt      = isAEnviar(n);

    const status = enviado ? "✓ Enviado"
                 : separado ? "Separado p/ Envio"
                 : emCrt    ? "Em Carteira"
                            : "Aguard. Carga";
    const statusC = enviado ? GRN_T
                 : separado ? BLU_T
                 : emCrt    ? AMB_T
                            : GRAY_T;

    dat(ws.getCell(ri, 1), n.fornecedor,                  undefined, INK,     bg, "left", true);
    dat(ws.getCell(ri, 2), n.nf,                          undefined, INK,     bg, "left");
    dat(ws.getCell(ri, 3), n.filial,                      undefined, GRAY_T,  bg, "left");
    dat(ws.getCell(ri, 4), n.valor,                       BRL,       enviado ? GRN_T : RED_T, bg, "right", true);
    dat(ws.getCell(ri, 5), n.entrega,                     undefined, GRAY_T,  bg, "left");
    dat(ws.getCell(ri, 6), status,                        undefined, statusC, bg, "center", !!enviado);
    dat(ws.getCell(ri, 7), fmtDateISO(n.createdAt),       undefined, GRAY_T,  bg, "center");
    dat(ws.getCell(ri, 8), fmtDateISO(n.chequeEnviadoEm), undefined, enviado ? GRN_T : GRAY_T, bg, "center");
  });

  // Totais por status
  const totRow = 3 + sorted.length;
  ws.getRow(totRow).height = 20;
  const tAberto  = notas.filter((n) => !isEnviado(n)).reduce((s, n) => s + n.valor, 0);
  const tEnviado = notas.filter(isEnviado).reduce((s, n) => s + n.valor, 0);
  tot(ws.getCell(totRow, 1), "TOTAL",   undefined, "left");
  tot(ws.getCell(totRow, 2), `${notas.length} NFs`, undefined, "left");
  emptyNav(ws.getCell(totRow, 3));
  tot(ws.getCell(totRow, 4), tAberto + tEnviado, BRL);
  emptyNav(ws.getCell(totRow, 5));
  tot(ws.getCell(totRow, 6), `${notas.filter(isEnviado).length} enviadas`, undefined, "center");
  emptyNav(ws.getCell(totRow, 7));
  tot(ws.getCell(totRow, 8), tEnviado, BRL);

  // Mini legenda abaixo
  const legRow = totRow + 2;
  ws.getRow(legRow).height = 14;
  ws.mergeCells(legRow, 1, legRow, 8);
  const leg = ws.getCell(legRow, 1);
  leg.value = "Status: ✓ Enviado = cheque saiu  ·  Em Carteira = carga chegou, aguardando separação  ·  Aguard. Carga = mercadoria ainda não chegou";
  leg.font  = { size: 8, italic: true, color: { argb: GRAY_T }, name: "Arial" };
  leg.fill  = fill(WHITE);
  leg.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 3 — Por Fornecedor (análise consolidada)
// ══════════════════════════════════════════════════════════════════════════════
function buildFornecedorSheet(wb: AW, notas: NFRecord[]) {
  const ws: AW = wb.addWorksheet("Por Fornecedor", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  ws.columns = [
    { width: 28 }, // Fornecedor
    { width: 16 }, // Em Carteira (val)
    { width: 16 }, // Separado (val)
    { width: 16 }, // Aguardando (val)
    { width: 16 }, // Já Enviado (val)
    { width: 16 }, // Total Geral (val)
    { width: 12 }, // % Enviado
    { width: 10 }, // Qtd NFs
    { width: 12 }, // Qtd Enviadas
  ];

  // Aggregation
  type FornData = {
    emCarteira: number; separado: number; aguardando: number;
    enviado: number; qtd: number; qtdEnv: number;
  };
  const map = new Map<string, FornData>();
  for (const n of notas) {
    const d = map.get(n.fornecedor) ?? { emCarteira: 0, separado: 0, aguardando: 0, enviado: 0, qtd: 0, qtdEnv: 0 };
    d.qtd++;
    if (isEnviado(n))        { d.enviado += n.valor; d.qtdEnv++; }
    else if (isSeparado(n))  { d.separado += n.valor; }
    else if (isAEnviar(n))   { d.emCarteira += n.valor; }
    else                     { d.aguardando += n.valor; }
    map.set(n.fornecedor, d);
  }
  const rows = [...map.entries()].sort((a, b) => {
    const totA = a[1].emCarteira + a[1].separado + a[1].aguardando;
    const totB = b[1].emCarteira + b[1].separado + b[1].aguardando;
    return totB - totA; // maior valor em aberto primeiro
  });

  ws.mergeCells("A1:I1");
  const t = ws.getCell("A1");
  t.value = `ANÁLISE POR FORNECEDOR — ${rows.length} fornecedores`;
  t.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  t.fill  = fill(NAVY);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;

  ([
    ["Fornecedor",   NAVY],
    ["Em Carteira",  AMB_H],
    ["Separado",     BLU_H],
    ["Aguard. Carga",NAVY],
    ["Já Enviado",   GRN_H],
    ["Total Geral",  RED_H],
    ["% Enviado",    TEL_H],
    ["Qtd NFs",      NAVY],
    ["Qtd Env.",     GRN_H],
  ] as [string, string][]).forEach(([h, bg], ci) => hdr(ws.getCell(2, ci + 1), h, bg));
  ws.getRow(2).height = 20;

  rows.forEach(([forn, d], i) => {
    const ri  = 3 + i;
    const bg  = zebra(i);
    ws.getRow(ri).height = 17;
    const total = d.emCarteira + d.separado + d.aguardando + d.enviado;
    const pct   = total > 0 ? d.enviado / total : 0;
    const aberto = d.emCarteira + d.separado + d.aguardando;

    dat(ws.getCell(ri, 1), forn,                   undefined, INK,     bg, "left", true);
    dat(ws.getCell(ri, 2), d.emCarteira || null,    BRL,       AMB_T,   bg, "right");
    dat(ws.getCell(ri, 3), d.separado   || null,    BRL,       BLU_T,   bg, "right");
    dat(ws.getCell(ri, 4), d.aguardando || null,    BRL,       GRAY_T,  bg, "right");
    dat(ws.getCell(ri, 5), d.enviado    || null,    BRL,       GRN_T,   bg, "right");
    dat(ws.getCell(ri, 6), total,                   BRL,       aberto > 0 ? RED_T : GRN_T, bg, "right", true);
    dat(ws.getCell(ri, 7), pct,                     PCT,       pct >= 0.8 ? GRN_T : pct >= 0.5 ? AMB_T : RED_T, bg, "right", true);
    dat(ws.getCell(ri, 8), d.qtd,                   INT,       INK,     bg, "right");
    dat(ws.getCell(ri, 9), d.qtdEnv || null,        INT,       GRN_T,   bg, "right");
  });

  const tr = 3 + rows.length;
  ws.getRow(tr).height = 20;
  const tt = (fn: (d: FornData) => number) => rows.reduce((s, [, d]) => s + fn(d), 0);
  tot(ws.getCell(tr, 1), "TOTAL", undefined, "left");
  tot(ws.getCell(tr, 2), tt((d) => d.emCarteira), BRL);
  tot(ws.getCell(tr, 3), tt((d) => d.separado),   BRL);
  tot(ws.getCell(tr, 4), tt((d) => d.aguardando), BRL);
  tot(ws.getCell(tr, 5), tt((d) => d.enviado),    BRL);
  const grand = tt((d) => d.emCarteira + d.separado + d.aguardando + d.enviado);
  const grandEnv = tt((d) => d.enviado);
  tot(ws.getCell(tr, 6), grand, BRL);
  tot(ws.getCell(tr, 7), grand > 0 ? grandEnv / grand : 0, PCT);
  tot(ws.getCell(tr, 8), tt((d) => d.qtd), INT);
  tot(ws.getCell(tr, 9), tt((d) => d.qtdEnv), INT);
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 4 — Histórico de Envios (cheques saídos)
// ══════════════════════════════════════════════════════════════════════════════
function buildEnviosSheet(wb: AW, notas: NFRecord[]) {
  const enviadas = notas.filter(isEnviado).sort((a, b) => {
    const da = a.chequeEnviadoEm ?? a.createdAt ?? "";
    const db = b.chequeEnviadoEm ?? b.createdAt ?? "";
    return da.localeCompare(db);
  });

  const ws: AW = wb.addWorksheet("Histórico Envios", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  ws.columns = [
    { width: 16 }, // Data Envio
    { width: 28 }, // Fornecedor
    { width: 16 }, // NF
    { width: 16 }, // Filial
    { width: 16 }, // Valor
    { width: 20 }, // Status NF
    { width: 18 }, // Acumulado
  ];

  ws.mergeCells("A1:G1");
  const t = ws.getCell("A1");
  t.value = `HISTÓRICO DE ENVIOS DE CHEQUE — ${enviadas.length} NFs enviadas`;
  t.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  t.fill  = fill(GRN_H);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;

  ([
    ["Data Envio",  GRN_H],
    ["Fornecedor",  NAVY],
    ["NF",          NAVY],
    ["Filial",      NAVY],
    ["Valor",       GRN_H],
    ["Status NF",   TEL_H],
    ["Acumulado",   GRN_H],
  ] as [string, string][]).forEach(([h, bg], ci) => hdr(ws.getCell(2, ci + 1), h, bg));
  ws.getRow(2).height = 20;

  let running = 0;
  enviadas.forEach((n, i) => {
    const ri  = 3 + i;
    const bg  = zebra(i);
    ws.getRow(ri).height = 17;
    running += n.valor;

    dat(ws.getCell(ri, 1), fmtDateISO(n.chequeEnviadoEm ?? n.createdAt), undefined, GRN_T, bg, "center", true);
    dat(ws.getCell(ri, 2), n.fornecedor, undefined, INK, bg, "left", true);
    dat(ws.getCell(ri, 3), n.nf,         undefined, INK, bg, "left");
    dat(ws.getCell(ri, 4), n.filial,     undefined, GRAY_T, bg, "center");
    dat(ws.getCell(ri, 5), n.valor,      BRL, GRN_T, bg, "right", true);
    dat(ws.getCell(ri, 6), n.statusNf,   undefined, GRAY_T, bg, "left");
    dat(ws.getCell(ri, 7), running,      BRL, GRN_T, bg, "right");
  });

  const tr = 3 + enviadas.length;
  ws.getRow(tr).height = 20;
  const tv = enviadas.reduce((s, n) => s + n.valor, 0);
  tot(ws.getCell(tr, 1), "TOTAL", undefined, "left");
  tot(ws.getCell(tr, 2), `${enviadas.length} NFs enviadas`, undefined, "left");
  emptyNav(ws.getCell(tr, 3)); emptyNav(ws.getCell(tr, 4));
  tot(ws.getCell(tr, 5), tv,  BRL);
  emptyNav(ws.getCell(tr, 6));
  tot(ws.getCell(tr, 7), tv,  BRL);
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 5 — Caixa de Cheques (histórico completo com análise)
// ══════════════════════════════════════════════════════════════════════════════
function buildCaixaSheet(wb: AW, caixa: CaixaRecord[]) {
  const ws: AW = wb.addWorksheet("Caixa de Cheques", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  ws.columns = [
    { width: 12 }, // Data
    { width: 16 }, // Saldo Anterior
    { width: 16 }, // Entrada
    { width: 16 }, // Saída
    { width: 16 }, // Saldo Total
    { width: 28 }, // Destino/Origem
    { width: 16 }, // Variação (Δ)
  ];

  ws.mergeCells("A1:G1");
  const t = ws.getCell("A1");
  t.value = `MOVIMENTOS DE CAIXA DE CHEQUES — ${caixa.length} lançamentos`;
  t.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  t.fill  = fill(NAVY);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;

  ([
    ["Data",           NAVY],
    ["Saldo Anterior", NAVY],
    ["Entrada",        GRN_H],
    ["Saída",          RED_H],
    ["Saldo Total",    TEL_H],
    ["Destino / Origem", NAVY],
    ["Δ Variação",     NAVY],
  ] as [string, string][]).forEach(([h, bg], ci) => hdr(ws.getCell(2, ci + 1), h, bg));
  ws.getRow(2).height = 20;

  caixa.forEach((c, i) => {
    const ri   = 3 + i;
    const bg   = zebra(i);
    ws.getRow(ri).height = 17;
    const delta = c.entrada - c.saida;
    const deltaC = delta > 0 ? GRN_T : delta < 0 ? RED_T : GRAY_T;

    dat(ws.getCell(ri, 1), c.data,                       undefined, INK,    bg, "center", true);
    dat(ws.getCell(ri, 2), c.saldoAnterior,               BRL,       GRAY_T, bg, "right");
    dat(ws.getCell(ri, 3), c.entrada > 0 ? c.entrada : null, BRL,   GRN_T,  bg, "right");
    dat(ws.getCell(ri, 4), c.saida   > 0 ? c.saida   : null, BRL,   RED_T,  bg, "right");
    dat(ws.getCell(ri, 5), c.saldoTotal,                  BRL,       c.saldoTotal >= 0 ? GRN_T : RED_T, bg, "right", true);
    dat(ws.getCell(ri, 6), c.destino ?? c.origem ?? "—",  undefined, GRAY_T, bg, "left");
    dat(ws.getCell(ri, 7), delta,                         DELT,      deltaC, bg, "right");
  });

  const tr = 3 + caixa.length;
  ws.getRow(tr).height = 20;
  const last = caixa[caixa.length - 1];
  const totEnt  = caixa.reduce((s, c) => s + c.entrada, 0);
  const totSai  = caixa.reduce((s, c) => s + c.saida, 0);
  tot(ws.getCell(tr, 1), "SALDO ATUAL", undefined, "left");
  emptyNav(ws.getCell(tr, 2));
  tot(ws.getCell(tr, 3), totEnt, BRL);
  tot(ws.getCell(tr, 4), totSai, BRL);
  tot(ws.getCell(tr, 5), last?.saldoTotal ?? 0, BRL);
  tot(ws.getCell(tr, 6), `${caixa.length} movimentos`, undefined, "left");
  tot(ws.getCell(tr, 7), totEnt - totSai, DELT);
}

// ══════════════════════════════════════════════════════════════════════════════
//  ABA 6 — Cheques Devolvidos (análise completa)
// ══════════════════════════════════════════════════════════════════════════════
type DevRow = {
  id: string;
  data: string;
  valor_devolvido: number;
  valor_rec_fornecedor: number;
  valor_rec_empresa: number;
  created_at: string;
};

function buildDevolvidosSheet(wb: AW, rows: DevRow[]) {
  const sorted = [...rows].sort((a, b) => b.data.localeCompare(a.data));
  const ws: AW = wb.addWorksheet("Devolvidos", { views: [{ state: "frozen", ySplit: 2, showGridLines: false }] });
  ws.columns = [
    { width: 13 }, // Data
    { width: 22 }, // Tipo
    { width: 16 }, // Devolvido
    { width: 16 }, // Total Rec.
    { width: 16 }, // Pendente
    { width: 12 }, // % Recuperado
    { width: 22 }, // Status
    { width: 14 }, // Dias em aberto
  ];

  const totDev  = rows.reduce((s, r) => s + Number(r.valor_devolvido    || 0), 0);
  const totRecF = rows.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0), 0);
  const totRecE = rows.reduce((s, r) => s + Number(r.valor_rec_empresa   || 0), 0);
  const totRec  = totRecF + totRecE;
  const totPend = totDev - totRec;
  const taxa    = totDev > 0 ? totRec / totDev : 0;

  const pendentes = rows.filter((r) => {
    const d = Number(r.valor_devolvido || 0);
    const rec = Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0);
    return d > 0 && d - rec > 0;
  });
  const titleBg = pendentes.length === 0 ? GRN_H : RED_H;

  ws.mergeCells("A1:H1");
  const t = ws.getCell("A1");
  t.value = pendentes.length === 0
    ? `✅  CHEQUES DEVOLVIDOS — ${rows.length} lançamentos · todos quitados`
    : `⚠️  CHEQUES DEVOLVIDOS — ${rows.length} lançamentos · ${pendentes.length} pendente(s)`;
  t.font  = { bold: true, size: 13, color: { argb: GOLD }, name: "Arial" };
  t.fill  = fill(titleBg);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 26;

  ([
    ["Data",          NAVY],
    ["Tipo",          NAVY],
    ["Devolvido",     RED_H],
    ["Total Rec.",    GRN_H],
    ["Pendente",      AMB_H],
    ["% Recup.",      TEL_H],
    ["Status",        NAVY],
    ["Dias Aberto",   RED_H],
  ] as [string, string][]).forEach(([h, bg], ci) => hdr(ws.getCell(2, ci + 1), h, bg));
  ws.getRow(2).height = 20;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  sorted.forEach((r, i) => {
    const dev    = Number(r.valor_devolvido    || 0);
    const rF     = Number(r.valor_rec_fornecedor || 0);
    const rE     = Number(r.valor_rec_empresa   || 0);
    const rec    = rF + rE;
    const pend   = dev - rec;
    const pct    = dev > 0 ? rec / dev : null;
    const avulsa = dev <= 0 && rec > 0;

    const dataDate = new Date(`${r.data}T00:00:00`);
    const dias = !avulsa && pend > 0
      ? Math.floor((hoje.getTime() - dataDate.getTime()) / 86400000)
      : null;
    const diasC = dias === null ? GRAY_T : dias > 90 ? RED_T : dias > 30 ? AMB_T : INK;

    const status  = avulsa ? "—"
                  : pend <= 0 ? "✓ Quitado"
                  : rec > 0   ? "⏳ Parcial"
                              : "❌ Sem recuperação";
    const statusC = avulsa ? GRAY_T
                  : pend <= 0 ? GRN_T
                  : rec > 0   ? AMB_T
                              : RED_T;

    const ri = 3 + i;
    const bg = avulsa ? zebra(i) : pend <= 0 ? "FFF0FFF4" : zebra(i);
    ws.getRow(ri).height = 17;

    dat(ws.getCell(ri, 1), fmtDateISO(r.data),                           undefined, INK,     bg, "left");
    dat(ws.getCell(ri, 2), avulsa ? "Recuperação avulsa" : "Devolvido",  undefined, avulsa ? BLU_T : RED_T, bg, "left");
    dat(ws.getCell(ri, 3), dev > 0 ? dev : null,                          BRL,       RED_T,   bg, "right");
    dat(ws.getCell(ri, 4), rec > 0 ? rec : null,                          BRL,       GRN_T,   bg, "right");
    dat(ws.getCell(ri, 5), !avulsa && pend > 0 ? pend : null,             BRL,       AMB_T,   bg, "right", true);
    dat(ws.getCell(ri, 6), pct,                                            PCT,       pct === null ? GRAY_T : pct >= 1 ? GRN_T : pct >= 0.5 ? AMB_T : RED_T, bg, "right");
    dat(ws.getCell(ri, 7), status,                                         undefined, statusC, bg, "left");
    dat(ws.getCell(ri, 8), dias,                                           INT,       diasC,   bg, "right", dias !== null && dias > 30);
  });

  const totR = 3 + sorted.length;
  ws.getRow(totR).height = 20;
  tot(ws.getCell(totR, 1), "TOTAL",   undefined, "left");
  emptyNav(ws.getCell(totR, 2));
  tot(ws.getCell(totR, 3), totDev,    BRL);
  tot(ws.getCell(totR, 4), totRec,    BRL);
  tot(ws.getCell(totR, 5), totPend > 0 ? totPend : 0, BRL);
  tot(ws.getCell(totR, 6), taxa,      PCT);
  emptyNav(ws.getCell(totR, 7));
  emptyNav(ws.getCell(totR, 8));
}

// ══════════════════════════════════════════════════════════════════════════════
//  Função principal
// ══════════════════════════════════════════════════════════════════════════════
export async function buildPainelWorkbook(
  notas: NFRecord[],
  caixa: CaixaRecord[],
): Promise<Blob> {
  // @ts-ignore
  const ExcelJS: any = (await import("exceljs")).default; // eslint-disable-line @typescript-eslint/no-explicit-any
  const wb = new ExcelJS.Workbook();
  wb.creator = "Painel Cheques — Grupo Ley";
  wb.created = new Date();

  // Busca devolvidos do banco
  const { data: devsData } = await supabase
    .from("cheques_devolvidos")
    .select("id,data,valor_devolvido,valor_rec_fornecedor,valor_rec_empresa,created_at")
    .order("data", { ascending: false });
  const devolvidos: DevRow[] = (devsData ?? []) as DevRow[];

  const now = new Date();
  const todayBR = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  buildResumoSheet(wb, notas, caixa, devolvidos, todayBR);
  buildCarteiraNFsSheet(wb, notas);
  buildFornecedorSheet(wb, notas);
  buildEnviosSheet(wb, notas);
  buildCaixaSheet(wb, caixa);
  buildDevolvidosSheet(wb, devolvidos);

  wb.views = [{ activeTab: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
