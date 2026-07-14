// Geração de planilha Excel para Cheques Devolvidos — Grupo Ley
// Paleta visual alinhada com o design do software (navy + ouro + semáforo).

// ── Paleta ────────────────────────────────────────────────────────────────────
const NAVY    = "FF0D1117"; // #0D1117 — fundo escuro (título / total)
const GOLD    = "FFF0B429"; // #F0B429 — ouro primário (cabeçalhos)
const RED_H   = "FF8B2000"; // vermelho escuro — coluna "devolvido"
const GRN_H   = "FF1A5E35"; // verde escuro — colunas "recuperado"
const TEL_H   = "FF0D4A5F"; // teal — coluna "pendente"
const WHITE   = "FFFFFFFF";
const GOLD_LT = "FFFFF9EE"; // bege dourado — zebra par
const BORD    = "FFD4B483"; // borda dourada suave
const INK     = "FF0D1117"; // texto escuro
const RED_T   = "FF8B1A1A"; // texto vermelho — devolvido
const GRN_T   = "FF1A5E35"; // texto verde — recuperado
const AMB_T   = "FF8B5A00"; // texto âmbar — pendência parcial

const BRL = '"R$" #,##0.00';
const PCT = "0.0%";

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type DevolvidoRow = {
  id: string;
  data: string;                // YYYY-MM-DD
  valor_devolvido: number;
  valor_rec_fornecedor: number;
  valor_rec_empresa: number;
  created_at: string;
};

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

// ── Helpers ExcelJS (tipagem via any para não exigir @types/exceljs na build) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCell = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWS   = any;

function fill(argb: string) {
  return { type: "pattern", pattern: "solid", fgColor: { argb } } as const;
}
function border() {
  const t = (a: string) => ({ style: "thin", color: { argb: a } } as const);
  return { top: t(BORD), left: t(BORD), bottom: t(BORD), right: t(BORD) };
}
function hdrCell(cell: AnyCell, text: string, bg: string, align: "left"|"center"|"right" = "center") {
  cell.value = text;
  cell.font  = { bold: true, size: 10, color: { argb: WHITE }, name: "Arial" };
  cell.fill  = fill(bg);
  cell.alignment = { vertical: "middle", horizontal: align, wrapText: true };
  cell.border = border();
}
function dataCell(
  cell: AnyCell,
  value: unknown,
  numFmt: string | undefined,
  textColor: string,
  bgColor: string,
  align: "left"|"center"|"right",
) {
  cell.value = value ?? null;
  if (numFmt) cell.numFmt = numFmt;
  cell.font      = { size: 10, color: { argb: textColor }, name: "Arial" };
  cell.fill      = fill(bgColor);
  cell.alignment = { vertical: "middle", horizontal: align, indent: align === "left" ? 1 : 0 };
  cell.border    = border();
}
function totalCell(cell: AnyCell, value: unknown, numFmt: string | undefined, align: "left"|"center"|"right" = "right") {
  cell.value = value ?? null;
  if (numFmt) cell.numFmt = numFmt;
  cell.font      = { bold: true, size: 10, color: { argb: WHITE }, name: "Arial" };
  cell.fill      = fill(NAVY);
  cell.alignment = { vertical: "middle", horizontal: align, indent: align === "left" ? 1 : 0 };
  cell.border    = border();
}

function zebra(i: number): string { return i % 2 === 0 ? GOLD_LT : WHITE; }

// ─────────────────────────────────────────────────────────────────────────────
// buildDevolvidosWorkbook
// ─────────────────────────────────────────────────────────────────────────────
export async function buildDevolvidosWorkbook(rows: DevolvidoRow[]): Promise<Blob> {
  // exceljs precisa estar em package.json. Adicione via Lovable antes do deploy.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any
  // @ts-ignore
  const ExcelJS: any = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Painel Cheques — Grupo Ley";
  wb.created = new Date();

  const sorted = [...rows].sort((a, b) => b.data.localeCompare(a.data));

  // ── Totais globais ─────────────────────────────────────────────────────────
  const tot = {
    devolvido : rows.reduce((s, r) => s + Number(r.valor_devolvido || 0), 0),
    recForn   : rows.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0), 0),
    recEmp    : rows.reduce((s, r) => s + Number(r.valor_rec_empresa || 0), 0),
  };
  tot.recForn; // referenced below
  const totalRec    = tot.recForn + tot.recEmp;
  const totalPend   = tot.devolvido - totalRec;
  const taxaRec     = tot.devolvido > 0 ? totalRec / tot.devolvido : 0;
  const qtdDev      = rows.filter(r => Number(r.valor_devolvido) > 0).length;
  const qtdAvulsa   = rows.filter(r => Number(r.valor_devolvido) <= 0 && (Number(r.valor_rec_fornecedor) + Number(r.valor_rec_empresa)) > 0).length;
  const qtdPend     = rows.filter(r => {
    const d = Number(r.valor_devolvido || 0);
    return d > 0 && d - Number(r.valor_rec_fornecedor || 0) - Number(r.valor_rec_empresa || 0) > 0;
  }).length;

  // ── Agregação mensal ───────────────────────────────────────────────────────
  const mMap = new Map<string, { dev: number; rF: number; rE: number; ct: number }>();
  for (const r of rows) {
    const ym = ymKey(r.data);
    const e  = mMap.get(ym) ?? { dev: 0, rF: 0, rE: 0, ct: 0 };
    e.dev += Number(r.valor_devolvido || 0);
    e.rF  += Number(r.valor_rec_fornecedor || 0);
    e.rE  += Number(r.valor_rec_empresa || 0);
    e.ct  += Number(r.valor_devolvido || 0) > 0 ? 1 : 0;
    mMap.set(ym, e);
  }
  const months = [...mMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ym, v]) => ({
      label   : fmtMonthBR(ym),
      dev     : v.dev,
      rF      : v.rF,
      rE      : v.rE,
      rec     : v.rF + v.rE,
      pend    : v.dev - (v.rF + v.rE),
      taxa    : v.dev > 0 ? (v.rF + v.rE) / v.dev : null,
      ct      : v.ct,
    }));

  const now     = new Date();
  const todayBR = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;

  // ══════════════════════════════════════════════════════════════════════════
  //  ABA 1 — Resumo Executivo
  // ══════════════════════════════════════════════════════════════════════════
  const wsR: AnyWS = wb.addWorksheet("Resumo", { views: [{ showGridLines: false }] });
  wsR.columns = [
    { width: 32 }, // A — label / mês
    { width: 18 }, // B — valor / devolvido
    { width: 18 }, // C — rec fornecedor
    { width: 18 }, // D — rec empresa
    { width: 18 }, // E — total rec
    { width: 16 }, // F — pendente
    { width: 13 }, // G — taxa
  ];

  // Título principal
  wsR.mergeCells("A1:G1");
  const r1 = wsR.getCell("A1");
  r1.value = "CHEQUES DEVOLVIDOS — GRUPO LEY";
  r1.font  = { bold: true, size: 18, color: { argb: GOLD }, name: "Arial" };
  r1.fill  = fill(NAVY);
  r1.alignment = { vertical: "middle", horizontal: "center" };
  wsR.getRow(1).height = 38;

  wsR.mergeCells("A2:G2");
  const r2 = wsR.getCell("A2");
  r2.value = `Exportado em ${todayBR} · ${rows.length} lançamento${rows.length !== 1 ? "s" : ""}`;
  r2.font  = { size: 10, italic: true, color: { argb: "FF8B949E" }, name: "Arial" };
  r2.fill  = fill(NAVY);
  r2.alignment = { vertical: "middle", horizontal: "center" };
  wsR.getRow(2).height = 18;

  wsR.getRow(3).height = 10; // espaçador

  // Seção KPIs
  wsR.mergeCells("A4:G4");
  hdrCell(wsR.getCell("A4"), "📊  VISÃO GERAL — ACUMULADO", GOLD, "left");
  wsR.getRow(4).height = 22;

  // Cabeçalho da mini-tabela KPI
  hdrCell(wsR.getCell("A5"), "Indicador",  NAVY, "left");
  hdrCell(wsR.getCell("B5"), "Valor",      NAVY, "right");
  wsR.mergeCells("B5:G5");
  wsR.getRow(5).height = 18;

  const kpis: [string, number | string, string | undefined, string][] = [
    ["Total devolvido (histórico)",         tot.devolvido,  BRL, RED_T],
    ["Total recuperado",                    totalRec,       BRL, GRN_T],
    ["  → Recuperado pelo fornecedor",      tot.recForn,    BRL, GRN_T],
    ["  → Recuperado pela empresa (Ley)",   tot.recEmp,     BRL, GRN_T],
    ["Pendente acumulado",                  totalPend,      BRL, totalPend > 0 ? AMB_T : GRN_T],
    ["Taxa de recuperação geral",           taxaRec,        PCT, taxaRec >= 1 ? GRN_T : AMB_T],
    ["Qtd. devoluções lançadas",            qtdDev,         undefined, INK],
    ["Qtd. recuperações avulsas",           qtdAvulsa,      undefined, INK],
    ["Qtd. lançamentos ainda pendentes",    qtdPend,        undefined, qtdPend > 0 ? RED_T : GRN_T],
  ];

  kpis.forEach(([label, value, fmt, color], i) => {
    const ri = 6 + i;
    const bg = zebra(i);
    wsR.getRow(ri).height = 18;

    const la = wsR.getCell(ri, 1);
    la.value = label;
    la.font  = { size: 10, color: { argb: INK }, name: "Arial",
                 bold: !label.startsWith("  "), italic: label.startsWith("  ") };
    la.fill  = fill(bg);
    la.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    la.border = border();

    const va = wsR.getCell(ri, 2);
    va.value = value;
    if (fmt) va.numFmt = fmt;
    va.font  = { size: 11, bold: true, color: { argb: color }, name: "Arial" };
    va.fill  = fill(bg);
    va.alignment = { vertical: "middle", horizontal: "right" };
    va.border = border();
    wsR.mergeCells(ri, 2, ri, 7);
  });

  wsR.getRow(6 + kpis.length).height = 10; // espaçador

  // Seção mensal
  const mSec = 7 + kpis.length;
  wsR.mergeCells(mSec, 1, mSec, 7);
  hdrCell(wsR.getCell(mSec, 1), "📅  RESUMO MENSAL", GOLD, "left");
  wsR.getRow(mSec).height = 22;

  const mHdr = mSec + 1;
  [
    ["Mês",            NAVY],
    ["Devolvido",      RED_H],
    ["Rec. Forn.",     GRN_H],
    ["Rec. Empresa",   GRN_H],
    ["Total Rec.",     GRN_H],
    ["Pendente",       TEL_H],
    ["Taxa",           NAVY],
  ].forEach(([h, bg], ci) => {
    hdrCell(wsR.getCell(mHdr, ci + 1), h as string, bg as string);
  });
  wsR.getRow(mHdr).height = 20;

  months.forEach((m, i) => {
    const ri  = mHdr + 1 + i;
    const bg  = zebra(i);
    wsR.getRow(ri).height = 18;
    const pendColor = m.pend > 0 ? AMB_T : GRN_T;
    const taxaColor = m.taxa !== null ? (m.taxa >= 1 ? GRN_T : AMB_T) : INK;

    dataCell(wsR.getCell(ri, 1), m.label,                undefined, INK,       bg, "left");
    dataCell(wsR.getCell(ri, 2), m.dev   || null,         BRL,       RED_T,     bg, "right");
    dataCell(wsR.getCell(ri, 3), m.rF    || null,         BRL,       GRN_T,     bg, "right");
    dataCell(wsR.getCell(ri, 4), m.rE    || null,         BRL,       GRN_T,     bg, "right");
    dataCell(wsR.getCell(ri, 5), m.rec   || null,         BRL,       GRN_T,     bg, "right");
    dataCell(wsR.getCell(ri, 6), m.pend  >  0 ? m.pend : null, BRL, pendColor, bg, "right");
    dataCell(wsR.getCell(ri, 7), m.taxa,                  PCT,       taxaColor, bg, "right");
  });

  // Linha total mensal
  const mTot = mHdr + 1 + months.length;
  wsR.getRow(mTot).height = 20;
  totalCell(wsR.getCell(mTot, 1), "TOTAL",        undefined, "left");
  totalCell(wsR.getCell(mTot, 2), tot.devolvido,  BRL);
  totalCell(wsR.getCell(mTot, 3), tot.recForn,    BRL);
  totalCell(wsR.getCell(mTot, 4), tot.recEmp,     BRL);
  totalCell(wsR.getCell(mTot, 5), totalRec,       BRL);
  totalCell(wsR.getCell(mTot, 6), totalPend > 0 ? totalPend : 0, BRL);
  totalCell(wsR.getCell(mTot, 7), taxaRec,        PCT);

  wsR.views = [{ state: "frozen", ySplit: 2, showGridLines: false }];

  // ══════════════════════════════════════════════════════════════════════════
  //  ABA 2 — Lançamentos Completos
  // ══════════════════════════════════════════════════════════════════════════
  const wsL: AnyWS = wb.addWorksheet("Lançamentos", { views: [{ state: "frozen", ySplit: 2 }] });
  wsL.columns = [
    { width: 13 }, // Data
    { width: 22 }, // Tipo
    { width: 18 }, // Devolvido
    { width: 18 }, // Rec. Fornecedor
    { width: 18 }, // Rec. Empresa
    { width: 18 }, // Total Rec.
    { width: 18 }, // Pendente
    { width: 22 }, // Status
  ];

  wsL.mergeCells("A1:H1");
  const lT = wsL.getCell("A1");
  lT.value = `CHEQUES DEVOLVIDOS — LANÇAMENTOS COMPLETOS · ${rows.length} registros`;
  lT.font  = { bold: true, size: 14, color: { argb: GOLD }, name: "Arial" };
  lT.fill  = fill(NAVY);
  lT.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsL.getRow(1).height = 28;

  [
    ["Data",            NAVY],
    ["Tipo",            NAVY],
    ["Devolvido",       RED_H],
    ["Rec. Fornecedor", GRN_H],
    ["Rec. Empresa",    GRN_H],
    ["Total Recuperado",GRN_H],
    ["Pendente",        TEL_H],
    ["Status",          NAVY],
  ].forEach(([h, bg], ci) => hdrCell(wsL.getCell(2, ci + 1), h as string, bg as string));
  wsL.getRow(2).height = 20;

  sorted.forEach((r, i) => {
    const dev  = Number(r.valor_devolvido || 0);
    const rF   = Number(r.valor_rec_fornecedor || 0);
    const rE   = Number(r.valor_rec_empresa || 0);
    const rec  = rF + rE;
    const pend = dev - rec;
    const avulsa = dev <= 0 && rec > 0;

    const tipo   = avulsa ? "Recuperação avulsa" : "Cheque devolvido";
    const tipoC  = avulsa ? "FF0D3B73" : RED_T;
    const status = avulsa          ? "—"
                 : pend <= 0       ? "✓ Quitado"
                 : rec  >  0       ? "⏳ Parcial"
                                   : "❌ Sem recuperação";
    const statusC = avulsa    ? INK
                  : pend <= 0 ? GRN_T
                  : rec  >  0 ? AMB_T
                              : RED_T;

    const ri = 3 + i;
    const bg = zebra(i);
    wsL.getRow(ri).height = 18;

    dataCell(wsL.getCell(ri, 1), fmtDateBR(r.data),    undefined, INK,     bg, "left");
    dataCell(wsL.getCell(ri, 2), tipo,                  undefined, tipoC,   bg, "left");
    dataCell(wsL.getCell(ri, 3), dev  > 0 ? dev : null, BRL,       RED_T,   bg, "right");
    dataCell(wsL.getCell(ri, 4), rF   > 0 ? rF  : null, BRL,       GRN_T,   bg, "right");
    dataCell(wsL.getCell(ri, 5), rE   > 0 ? rE  : null, BRL,       GRN_T,   bg, "right");
    dataCell(wsL.getCell(ri, 6), rec  > 0 ? rec : null, BRL,       GRN_T,   bg, "right");
    dataCell(wsL.getCell(ri, 7), !avulsa && pend > 0 ? pend : null, BRL, AMB_T, bg, "right");
    dataCell(wsL.getCell(ri, 8), status,               undefined, statusC, bg, "left");
  });

  const lTot = 3 + sorted.length;
  wsL.getRow(lTot).height = 20;
  totalCell(wsL.getCell(lTot, 1), "TOTAL",       undefined, "left");
  wsL.getCell(lTot, 2).fill = fill(NAVY); wsL.getCell(lTot, 2).border = border();
  totalCell(wsL.getCell(lTot, 3), tot.devolvido, BRL);
  totalCell(wsL.getCell(lTot, 4), tot.recForn,   BRL);
  totalCell(wsL.getCell(lTot, 5), tot.recEmp,    BRL);
  totalCell(wsL.getCell(lTot, 6), totalRec,      BRL);
  totalCell(wsL.getCell(lTot, 7), totalPend > 0 ? totalPend : 0, BRL);
  wsL.getCell(lTot, 8).fill = fill(NAVY); wsL.getCell(lTot, 8).border = border();

  // ══════════════════════════════════════════════════════════════════════════
  //  ABA 3 — Pendências em Aberto
  // ══════════════════════════════════════════════════════════════════════════
  const pendentes = sorted
    .filter(r => {
      const d = Number(r.valor_devolvido || 0);
      return d > 0 && d - Number(r.valor_rec_fornecedor || 0) - Number(r.valor_rec_empresa || 0) > 0;
    })
    .sort((a, b) => a.data.localeCompare(b.data)); // mais antigos primeiro = mais urgentes

  const wsP: AnyWS = wb.addWorksheet("Pendências", { views: [{ state: "frozen", ySplit: 2 }] });
  wsP.columns = [
    { width: 13 }, // Data
    { width: 14 }, // Dias em aberto
    { width: 18 }, // Devolvido
    { width: 18 }, // Recuperado
    { width: 18 }, // Pendente
    { width: 12 }, // % Recup.
    { width: 24 }, // Situação
  ];

  const pTitleBg = pendentes.length === 0 ? GRN_H : RED_H;
  const pTitleTx = pendentes.length === 0
    ? `✅  PENDÊNCIAS — TODOS OS CHEQUES QUITADOS`
    : `⚠️  PENDÊNCIAS EM ABERTO — ${pendentes.length} lançamento${pendentes.length !== 1 ? "s" : ""}`;

  wsP.mergeCells("A1:G1");
  const pT = wsP.getCell("A1");
  pT.value = pTitleTx;
  pT.font  = { bold: true, size: 14, color: { argb: GOLD }, name: "Arial" };
  pT.fill  = fill(pTitleBg);
  pT.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  wsP.getRow(1).height = 28;

  [
    ["Data Devolução",  NAVY],
    ["Dias em Aberto",  RED_H],
    ["Devolvido",       RED_H],
    ["Total Recuperado",GRN_H],
    ["Pendente",        RED_H],
    ["% Recup.",        TEL_H],
    ["Situação",        NAVY],
  ].forEach(([h, bg], ci) => hdrCell(wsP.getCell(2, ci + 1), h as string, bg as string));
  wsP.getRow(2).height = 20;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  if (pendentes.length === 0) {
    wsP.mergeCells("A3:G3");
    const nc = wsP.getCell("A3");
    nc.value = "Todos os cheques devolvidos estão quitados. Nenhuma pendência em aberto.";
    nc.font  = { size: 11, bold: true, color: { argb: GRN_T }, name: "Arial" };
    nc.fill  = fill(GOLD_LT);
    nc.alignment = { vertical: "middle", horizontal: "center" };
    nc.border = border();
    wsP.getRow(3).height = 28;
  } else {
    pendentes.forEach((r, i) => {
      const dev  = Number(r.valor_devolvido || 0);
      const rF   = Number(r.valor_rec_fornecedor || 0);
      const rE   = Number(r.valor_rec_empresa || 0);
      const rec  = rF + rE;
      const pend = dev - rec;
      const taxa = dev > 0 ? rec / dev : 0;
      const dataDate = new Date(`${r.data}T00:00:00`);
      const dias = Math.floor((hoje.getTime() - dataDate.getTime()) / 86400000);
      const diasC = dias > 90 ? RED_T : dias > 30 ? AMB_T : INK;

      const situacao = rec === 0
        ? "❌ Sem nenhuma recuperação"
        : `⏳ ${(taxa * 100).toFixed(0)}% recuperado`;
      const situacaoC = rec === 0 ? RED_T : AMB_T;

      const ri = 3 + i;
      // Fundo levemente avermelhado para dar senso de urgência
      const bg = i % 2 === 0 ? "FFFFF5F5" : WHITE;
      wsP.getRow(ri).height = 18;

      dataCell(wsP.getCell(ri, 1), fmtDateBR(r.data), undefined, INK,       bg, "left");
      dataCell(wsP.getCell(ri, 2), dias,               undefined, diasC,     bg, "right");
      dataCell(wsP.getCell(ri, 3), dev,                BRL,       RED_T,     bg, "right");
      dataCell(wsP.getCell(ri, 4), rec > 0 ? rec : null, BRL,    GRN_T,     bg, "right");
      dataCell(wsP.getCell(ri, 5), pend,               BRL,       RED_T,     bg, "right");
      dataCell(wsP.getCell(ri, 6), taxa,               PCT,       taxa >= 0.5 ? AMB_T : RED_T, bg, "right");
      dataCell(wsP.getCell(ri, 7), situacao,           undefined, situacaoC, bg, "left");
    });

    // Total pendências
    const pTotDev  = pendentes.reduce((s, r) => s + Number(r.valor_devolvido || 0), 0);
    const pTotRec  = pendentes.reduce((s, r) => s + Number(r.valor_rec_fornecedor || 0) + Number(r.valor_rec_empresa || 0), 0);
    const pTotPend = pTotDev - pTotRec;
    const pTotTaxa = pTotDev > 0 ? pTotRec / pTotDev : 0;

    const pTotRow = 3 + pendentes.length;
    wsP.getRow(pTotRow).height = 20;
    totalCell(wsP.getCell(pTotRow, 1), "TOTAL",    undefined, "left");
    wsP.getCell(pTotRow, 2).fill = fill(NAVY); wsP.getCell(pTotRow, 2).border = border();
    totalCell(wsP.getCell(pTotRow, 3), pTotDev,   BRL);
    totalCell(wsP.getCell(pTotRow, 4), pTotRec  > 0 ? pTotRec : null, BRL);
    totalCell(wsP.getCell(pTotRow, 5), pTotPend,  BRL);
    totalCell(wsP.getCell(pTotRow, 6), pTotTaxa,  PCT);
    wsP.getCell(pTotRow, 7).fill = fill(NAVY); wsP.getCell(pTotRow, 7).border = border();
  }

  // ── Aba ativa = Resumo ────────────────────────────────────────────────────
  wb.views = [{ activeTab: 0 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
