import type { NFRecord, CaixaRecord } from "@/data/store";
import { isEnviado } from "@/data/painel";
import { supabase } from "@/integrations/supabase/client";

// @ts-ignore
const ExcelJS = () => import("exceljs");

// ── Palette ──────────────────────────────────────────────────────────────────
const BG    = "1E1E2E";
const CARD  = "252540";
const HDR   = "2A2A4A";
const ALT   = "22223A";
const GOLD  = "C9A84C";
const WHITE = "F0F0FF";
const GRAY  = "8080A0";
const GREEN = "388E3C";
const RED   = "C62828";
const AMBER = "E65100";
const TEAL  = "00796B";
const BLUE  = "1565C0";

const BRL  = '"R$" #,##0.00';
const PCT  = "0.0%";
const DATE = "DD/MM/YYYY";

type Cell = {
  value: string | number | null;
  fmt?: string;
  bold?: boolean;
  color?: string;
  bg?: string;
  align?: "left" | "center" | "right";
  italic?: boolean;
};

function applyCell(wsCell: any, c: Cell) {
  wsCell.value = c.value;
  if (c.fmt) wsCell.numFmt = c.fmt;
  wsCell.font = {
    name: "Arial",
    size: 10,
    bold: c.bold ?? false,
    color: { argb: "FF" + (c.color ?? WHITE) },
    italic: c.italic ?? false,
  };
  wsCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF" + (c.bg ?? BG) },
  };
  wsCell.alignment = {
    horizontal: c.align ?? "center",
    vertical: "middle",
    wrapText: false,
  };
  const border = { style: "thin" as const, color: { argb: "FF3A3A5A" } };
  wsCell.border = { top: border, bottom: border, left: border, right: border };
}

function title(ws: any, text: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols);
  const cell = ws.getCell(1, 1);
  cell.value = text;
  cell.font  = { name: "Arial", size: 16, bold: true, color: { argb: "FF" + GOLD } };
  cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 34;
  for (let c = 2; c <= cols; c++) {
    const bg = ws.getCell(1, c);
    bg.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
  }
}

function hdrRow(ws: any, row: number, labels: string[], cols?: number[]) {
  ws.getRow(row).height = 22;
  labels.forEach((label, i) => {
    const c: Cell = { value: label, bold: true, color: GOLD, bg: HDR, align: "center" };
    applyCell(ws.getCell(row, i + 1), c);
  });
}

function floodBg(ws: any, maxRow: number, maxCol: number) {
  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const cell = ws.getCell(r, c);
      if (!cell.fill || !cell.fill.fgColor) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
      }
    }
  }
}

function fmt_date(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function statusColor(status: string): string {
  const s = status.toUpperCase();
  if (s.includes("ENVIADO")) return GREEN;
  if (s.includes("CHEGOU")) return TEAL;
  if (s.includes("NÃO") || s.includes("NAO")) return AMBER;
  return GRAY;
}

// ─── Sheet 1: Notas Fiscais ───────────────────────────────────────────────────
function buildNotasSheet(wb: any, notas: NFRecord[]) {
  const ws = wb.addWorksheet("📋 Notas Fiscais");
  ws.views = [{ showGridLines: false }];

  const COLS = [
    { header: "Data Cadastro", width: 16 },
    { header: "NF",            width: 14 },
    { header: "Fornecedor",    width: 28 },
    { header: "Filial",        width: 16 },
    { header: "Valor",         width: 16 },
    { header: "Status NF",     width: 18 },
    { header: "Entrega",       width: 22 },
    { header: "Status Envio",  width: 16 },
    { header: "Data Envio",    width: 16 },
  ];
  COLS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  // bg flood (approximate)
  for (let r = 1; r <= notas.length + 5; r++) {
    ws.getRow(r).height = r === 1 ? 34 : r === 2 ? 8 : 20;
    for (let c = 1; c <= COLS.length; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
    }
  }

  title(ws, `NOTAS FISCAIS — Grupo Ley  (${notas.length} registros)`, COLS.length);
  ws.getRow(2).height = 8;
  hdrRow(ws, 3, COLS.map((c) => c.header));

  notas.forEach((n, i) => {
    const r = i + 4;
    ws.getRow(r).height = 20;
    const bg = i % 2 === 0 ? CARD : ALT;
    const enviado = isEnviado(n);
    const row: Cell[] = [
      { value: fmt_date(n.createdAt),                    bg, color: GRAY },
      { value: n.nf,                                     bg, color: WHITE, align: "left" },
      { value: n.fornecedor,                             bg, color: WHITE, align: "left" },
      { value: n.filial,                                 bg, color: GRAY },
      { value: n.valor, fmt: BRL,                        bg, color: WHITE },
      { value: n.statusNf,                               bg, color: statusColor(n.statusNf) },
      { value: n.entrega,                                bg, color: GRAY, align: "left" },
      { value: enviado ? "ENVIADO" : "—",                bg, color: enviado ? GREEN : GRAY, bold: enviado },
      { value: fmt_date(n.chequeEnviadoEm),              bg, color: enviado ? WHITE : GRAY },
    ];
    row.forEach((c, ci) => applyCell(ws.getCell(r, ci + 1), c));
  });

  // total row
  const tr = notas.length + 4;
  ws.getRow(tr).height = 26;
  const totalVal = notas.reduce((s, n) => s + n.valor, 0);
  const totalEnv = notas.filter(isEnviado).reduce((s, n) => s + n.valor, 0);
  const totals: Cell[] = [
    { value: "TOTAL",                             bg: HDR, color: GOLD, bold: true },
    { value: `${notas.length} NFs`,               bg: HDR, color: GRAY },
    { value: "",                                  bg: HDR, color: WHITE },
    { value: "",                                  bg: HDR, color: WHITE },
    { value: totalVal, fmt: BRL,                  bg: HDR, color: GOLD, bold: true },
    { value: "",                                  bg: HDR, color: WHITE },
    { value: "",                                  bg: HDR, color: WHITE },
    { value: `${notas.filter(isEnviado).length} enviadas`, bg: HDR, color: GREEN },
    { value: `R$ ${totalEnv.toLocaleString("pt-BR",{minimumFractionDigits:2})} enviado`, bg: HDR, color: GREEN },
  ];
  totals.forEach((c, ci) => applyCell(ws.getCell(tr, ci + 1), c));
}

// ─── Sheet 2: Histórico de Envios ────────────────────────────────────────────
function buildEnviosSheet(wb: any, notas: NFRecord[]) {
  const enviadas = notas
    .filter(isEnviado)
    .sort((a, b) => (a.chequeEnviadoEm ?? "").localeCompare(b.chequeEnviadoEm ?? ""));

  const ws = wb.addWorksheet("🚚 Envios");
  ws.views = [{ showGridLines: false }];

  const COLS = [
    { header: "Data Envio",  width: 16 },
    { header: "Fornecedor",  width: 28 },
    { header: "NF",          width: 14 },
    { header: "Filial",      width: 16 },
    { header: "Valor",       width: 16 },
    { header: "Status NF",   width: 20 },
  ];
  COLS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  for (let r = 1; r <= enviadas.length + 5; r++) {
    ws.getRow(r).height = r === 1 ? 34 : r === 2 ? 8 : 20;
    for (let c = 1; c <= COLS.length; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
    }
  }

  title(ws, `HISTÓRICO DE ENVIOS DE CHEQUE — ${enviadas.length} NFs enviadas`, COLS.length);
  ws.getRow(2).height = 8;
  hdrRow(ws, 3, COLS.map((c) => c.header));

  enviadas.forEach((n, i) => {
    const r = i + 4;
    ws.getRow(r).height = 20;
    const bg = i % 2 === 0 ? CARD : ALT;
    const row: Cell[] = [
      { value: fmt_date(n.chequeEnviadoEm), bg, color: WHITE, bold: true },
      { value: n.fornecedor,                bg, color: WHITE, align: "left" },
      { value: n.nf,                        bg, color: GRAY, align: "left" },
      { value: n.filial,                    bg, color: GRAY },
      { value: n.valor, fmt: BRL,           bg, color: GREEN },
      { value: n.statusNf,                  bg, color: statusColor(n.statusNf), align: "left" },
    ];
    row.forEach((c, ci) => applyCell(ws.getCell(r, ci + 1), c));
  });

  const tr = enviadas.length + 4;
  ws.getRow(tr).height = 26;
  const tv = enviadas.reduce((s, n) => s + n.valor, 0);
  const totals: Cell[] = [
    { value: "TOTAL",                       bg: HDR, color: GOLD, bold: true },
    { value: `${enviadas.length} NFs`,      bg: HDR, color: GRAY },
    { value: "",                            bg: HDR, color: WHITE },
    { value: "",                            bg: HDR, color: WHITE },
    { value: tv, fmt: BRL,                  bg: HDR, color: GREEN, bold: true },
    { value: "",                            bg: HDR, color: WHITE },
  ];
  totals.forEach((c, ci) => applyCell(ws.getCell(tr, ci + 1), c));
}

// ─── Sheet 3: Por Fornecedor ─────────────────────────────────────────────────
function buildFornecedorSheet(wb: any, notas: NFRecord[]) {
  const ws = wb.addWorksheet("👥 Por Fornecedor");
  ws.views = [{ showGridLines: false }];

  // aggregate
  const map: Record<string, { total: number; enviado: number; carteira: number; qtdTotal: number; qtdEnviado: number }> = {};
  for (const n of notas) {
    if (!map[n.fornecedor]) map[n.fornecedor] = { total: 0, enviado: 0, carteira: 0, qtdTotal: 0, qtdEnviado: 0 };
    map[n.fornecedor].total += n.valor;
    map[n.fornecedor].qtdTotal += 1;
    if (isEnviado(n)) {
      map[n.fornecedor].enviado += n.valor;
      map[n.fornecedor].qtdEnviado += 1;
    } else {
      map[n.fornecedor].carteira += n.valor;
    }
  }
  const rows = Object.entries(map).sort((a, b) => b[1].total - a[1].total);

  const COLS = [
    { header: "Fornecedor",          width: 28 },
    { header: "Total Cadastrado",    width: 18 },
    { header: "Total Enviado",       width: 18 },
    { header: "Em Carteira",         width: 18 },
    { header: "% Enviado",           width: 14 },
    { header: "Lançamentos",         width: 14 },
    { header: "Enviados",            width: 12 },
  ];
  COLS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  for (let r = 1; r <= rows.length + 5; r++) {
    ws.getRow(r).height = r === 1 ? 34 : r === 2 ? 8 : 22;
    for (let c = 1; c <= COLS.length; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
    }
  }

  title(ws, `RESUMO POR FORNECEDOR — ${rows.length} fornecedores`, COLS.length);
  ws.getRow(2).height = 8;
  hdrRow(ws, 3, COLS.map((c) => c.header));

  rows.forEach(([forn, d], i) => {
    const r = i + 4;
    ws.getRow(r).height = 22;
    const bg = i % 2 === 0 ? CARD : ALT;
    const pct = d.total > 0 ? d.enviado / d.total : 0;
    const row: Cell[] = [
      { value: forn,              bg, color: WHITE, align: "left", bold: true },
      { value: d.total,     fmt: BRL, bg, color: WHITE },
      { value: d.enviado,   fmt: BRL, bg, color: d.enviado > 0 ? GREEN : GRAY },
      { value: d.carteira,  fmt: BRL, bg, color: d.carteira > 0 ? AMBER : GRAY },
      { value: pct,         fmt: PCT, bg, color: pct >= 0.8 ? GREEN : (pct >= 0.5 ? AMBER : RED), bold: true },
      { value: d.qtdTotal,          bg, color: GRAY },
      { value: d.qtdEnviado,        bg, color: d.qtdEnviado > 0 ? GREEN : GRAY },
    ];
    row.forEach((c, ci) => applyCell(ws.getCell(r, ci + 1), c));
  });

  const tr = rows.length + 4;
  ws.getRow(tr).height = 26;
  const ttotal = rows.reduce((s, [, d]) => s + d.total, 0);
  const tenv   = rows.reduce((s, [, d]) => s + d.enviado, 0);
  const tcart  = rows.reduce((s, [, d]) => s + d.carteira, 0);
  const totals: Cell[] = [
    { value: "TOTAL",                                bg: HDR, color: GOLD, bold: true, align: "left" },
    { value: ttotal, fmt: BRL,                       bg: HDR, color: GOLD, bold: true },
    { value: tenv,   fmt: BRL,                       bg: HDR, color: GREEN, bold: true },
    { value: tcart,  fmt: BRL,                       bg: HDR, color: AMBER, bold: true },
    { value: ttotal > 0 ? tenv / ttotal : 0, fmt: PCT, bg: HDR, color: GOLD, bold: true },
    { value: rows.reduce((s, [, d]) => s + d.qtdTotal, 0),   bg: HDR, color: GRAY },
    { value: rows.reduce((s, [, d]) => s + d.qtdEnviado, 0), bg: HDR, color: GREEN },
  ];
  totals.forEach((c, ci) => applyCell(ws.getCell(tr, ci + 1), c));
}

// ─── Sheet 4: Caixa ──────────────────────────────────────────────────────────
function buildCaixaSheet(wb: any, caixa: CaixaRecord[]) {
  const ws = wb.addWorksheet("💰 Caixa");
  ws.views = [{ showGridLines: false }];

  const COLS = [
    { header: "Data",            width: 14 },
    { header: "Saldo Anterior",  width: 18 },
    { header: "Entrada",         width: 16 },
    { header: "Saída",           width: 16 },
    { header: "Saldo Total",     width: 18 },
    { header: "Destino / Origem",width: 28 },
  ];
  COLS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  for (let r = 1; r <= caixa.length + 5; r++) {
    ws.getRow(r).height = r === 1 ? 34 : r === 2 ? 8 : 20;
    for (let c = 1; c <= COLS.length; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
    }
  }

  title(ws, `MOVIMENTOS DE CAIXA — ${caixa.length} registros`, COLS.length);
  ws.getRow(2).height = 8;
  hdrRow(ws, 3, COLS.map((c) => c.header));

  caixa.forEach((c, i) => {
    const r = i + 4;
    ws.getRow(r).height = 20;
    const bg = i % 2 === 0 ? CARD : ALT;
    const row: Cell[] = [
      { value: c.data,                    bg, color: GRAY },
      { value: c.saldoAnterior, fmt: BRL, bg, color: GRAY },
      { value: c.entrada,       fmt: BRL, bg, color: c.entrada > 0 ? GREEN : GRAY },
      { value: c.saida,         fmt: BRL, bg, color: c.saida   > 0 ? RED   : GRAY },
      { value: c.saldoTotal,    fmt: BRL, bg, color: c.saldoTotal >= 0 ? WHITE : RED, bold: true },
      { value: c.destino ?? c.origem ?? "—", bg, color: GRAY, align: "left" },
    ];
    row.forEach((ce, ci) => applyCell(ws.getCell(r, ci + 1), ce));
  });

  const tr = caixa.length + 4;
  ws.getRow(tr).height = 26;
  const last = caixa[caixa.length - 1];
  const totals: Cell[] = [
    { value: "SALDO ATUAL",                                   bg: HDR, color: GOLD, bold: true },
    { value: "",                                              bg: HDR, color: WHITE },
    { value: caixa.reduce((s, c) => s + c.entrada, 0), fmt: BRL, bg: HDR, color: GREEN, bold: true },
    { value: caixa.reduce((s, c) => s + c.saida, 0),   fmt: BRL, bg: HDR, color: RED,   bold: true },
    { value: last?.saldoTotal ?? 0, fmt: BRL,                 bg: HDR, color: GOLD, bold: true },
    { value: `${caixa.length} movimentos`,                    bg: HDR, color: GRAY },
  ];
  totals.forEach((c, ci) => applyCell(ws.getCell(tr, ci + 1), c));
}

// ─── Sheet 5: Devolvidos ─────────────────────────────────────────────────────
function buildDevolvidosSheet(wb: any, devs: any[]) {
  const ws = wb.addWorksheet("↩️ Devolvidos");
  ws.views = [{ showGridLines: false }];

  const COLS = [
    { header: "Data",           width: 14 },
    { header: "Valor Devolvido",width: 18 },
    { header: "Rec. Fornecedor",width: 18 },
    { header: "Rec. Empresa",   width: 18 },
    { header: "Total Recuperado",width:18 },
    { header: "Pendente",       width: 16 },
    { header: "% Recuperado",   width: 16 },
  ];
  COLS.forEach((col, i) => { ws.getColumn(i + 1).width = col.width; });

  for (let r = 1; r <= devs.length + 5; r++) {
    ws.getRow(r).height = r === 1 ? 34 : r === 2 ? 8 : 20;
    for (let c = 1; c <= COLS.length; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + BG } };
    }
  }

  title(ws, `CHEQUES DEVOLVIDOS — ${devs.length} lançamentos`, COLS.length);
  ws.getRow(2).height = 8;
  hdrRow(ws, 3, COLS.map((c) => c.header));

  devs.forEach((d, i) => {
    const r = i + 4;
    ws.getRow(r).height = 20;
    const bg = i % 2 === 0 ? CARD : ALT;
    const totalRec = (d.valor_rec_fornecedor ?? 0) + (d.valor_rec_empresa ?? 0);
    const pendente = Math.max(0, (d.valor_devolvido ?? 0) - totalRec);
    const pct      = d.valor_devolvido > 0 ? totalRec / d.valor_devolvido : 0;
    const pctColor = pct >= 1 ? GREEN : (pct > 0 ? AMBER : RED);
    const row: Cell[] = [
      { value: d.data,                              bg, color: WHITE, bold: true },
      { value: d.valor_devolvido,        fmt: BRL,  bg, color: RED },
      { value: d.valor_rec_fornecedor || null, fmt: BRL, bg, color: d.valor_rec_fornecedor ? GREEN : GRAY },
      { value: d.valor_rec_empresa    || null, fmt: BRL, bg, color: d.valor_rec_empresa    ? GREEN : GRAY },
      { value: totalRec > 0 ? totalRec : null, fmt: BRL, bg, color: GREEN },
      { value: pendente > 0 ? pendente : null,  fmt: BRL, bg, color: pendente > 0 ? RED : GRAY },
      { value: pct > 0 ? pct : null,        fmt: PCT, bg, color: pctColor, bold: true },
    ];
    row.forEach((c, ci) => applyCell(ws.getCell(r, ci + 1), c));
  });

  const tr = devs.length + 4;
  ws.getRow(tr).height = 26;
  const tDev = devs.reduce((s, d) => s + (d.valor_devolvido ?? 0), 0);
  const tRec = devs.reduce((s, d) => s + (d.valor_rec_fornecedor ?? 0) + (d.valor_rec_empresa ?? 0), 0);
  const totals: Cell[] = [
    { value: "TOTAL",               bg: HDR, color: GOLD,  bold: true },
    { value: tDev, fmt: BRL,        bg: HDR, color: RED,   bold: true },
    { value: "",                    bg: HDR, color: WHITE },
    { value: "",                    bg: HDR, color: WHITE },
    { value: tRec, fmt: BRL,        bg: HDR, color: GREEN, bold: true },
    { value: tDev - tRec, fmt: BRL, bg: HDR, color: RED,   bold: true },
    { value: tDev > 0 ? tRec / tDev : 0, fmt: PCT, bg: HDR, color: GOLD, bold: true },
  ];
  totals.forEach((c, ci) => applyCell(ws.getCell(tr, ci + 1), c));
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function buildPainelWorkbook(
  notas: NFRecord[],
  caixa: CaixaRecord[],
): Promise<Blob> {
  const { Workbook } = (await ExcelJS()).default ?? (await ExcelJS());

  // fetch devolvidos
  const { data: devsData } = await supabase
    .from("cheques_devolvidos")
    .select("id,data,valor_devolvido,valor_rec_fornecedor,valor_rec_empresa,created_at")
    .order("data", { ascending: false });
  const devs = devsData ?? [];

  const wb = new Workbook();
  wb.creator = "Painel Grupo Ley";
  wb.created = new Date();

  buildNotasSheet(wb, notas);
  buildEnviosSheet(wb, notas);
  buildFornecedorSheet(wb, notas);
  buildCaixaSheet(wb, caixa);
  buildDevolvidosSheet(wb, devs);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
