// Monta o SVG de uma tabela no visual do Painel de Cheques (tema escuro do app).
// Sem dependências: usado pela edge function tabela-png e testável fora do Deno.

/** Paleta do app (src/styles.css). */
export const THEME = {
  background: "#0D1117",
  surface: "#161B22",
  card: "#1C2330",
  border: "#2D3748",
  fg: "#E6EDF3",
  soft: "#C9D1D9",
  muted: "#8B949E",
  gold: "#F0B429",
  goldDim: "#3D2E09",
  green: "#3DDC84",
  red: "#FF6B6B",
  blue: "#58A6FF",
  orange: "#FF9F43",
} as const;

const COLOR_TOKENS: Record<string, string> = {
  fg: THEME.fg,
  soft: THEME.soft,
  muted: THEME.muted,
  gold: THEME.gold,
  green: THEME.green,
  red: THEME.red,
  blue: THEME.blue,
  orange: THEME.orange,
};

/** Célula: texto puro ou { v: texto, c: cor (token ou #RRGGBB), b: negrito, i: itálico }. */
export type Cell = string | { v: string; c?: string; b?: boolean | number; i?: boolean | number };

export type TableSpec = {
  /** Título */
  t: string;
  /** Subtítulo */
  s?: string;
  /** Cabeçalho das colunas */
  h: string[];
  /** Alinhamento por coluna: "l" | "c" | "r" (ex.: "lrr") */
  a?: string;
  /** Larguras relativas por coluna (ex.: [2,1,1.4]) */
  w?: number[];
  /** Linhas */
  r: Cell[][];
  /** Índices das linhas em destaque */
  hl?: number[];
  /** Rodapé */
  f?: string;
};

export class SpecError extends Error {}

const MAX_COLS = 6;
const MAX_ROWS = 30;
const MAX_TEXT = 80;

const str = (v: unknown, field: string, max = MAX_TEXT): string => {
  if (typeof v !== "string") throw new SpecError(`${field} deve ser texto`);
  if (v.length > max) throw new SpecError(`${field} excede ${max} caracteres`);
  return v;
};

/** Valida o JSON recebido e devolve um TableSpec seguro. */
export function parseSpec(raw: unknown): TableSpec {
  if (!raw || typeof raw !== "object") throw new SpecError("JSON inválido");
  const o = raw as Record<string, unknown>;
  const h = o.h;
  if (!Array.isArray(h) || h.length === 0 || h.length > MAX_COLS) {
    throw new SpecError(`h deve ter de 1 a ${MAX_COLS} colunas`);
  }
  const r = o.r;
  if (!Array.isArray(r) || r.length > MAX_ROWS) throw new SpecError(`r deve ter até ${MAX_ROWS} linhas`);
  const rows: Cell[][] = r.map((row, ri) => {
    if (!Array.isArray(row) || row.length !== h.length) {
      throw new SpecError(`linha ${ri} deve ter ${h.length} células`);
    }
    return row.map((cell, ci) => {
      if (typeof cell === "string") return str(cell, `r[${ri}][${ci}]`);
      if (cell && typeof cell === "object") {
        const c = cell as Record<string, unknown>;
        return {
          v: str(c.v, `r[${ri}][${ci}].v`),
          c: c.c === undefined ? undefined : str(c.c, `r[${ri}][${ci}].c`, 16),
          b: !!c.b,
          i: !!c.i,
        };
      }
      throw new SpecError(`r[${ri}][${ci}] inválida`);
    });
  });
  const a = o.a === undefined ? undefined : str(o.a, "a", MAX_COLS);
  if (a && !/^[lcr]+$/.test(a)) throw new SpecError("a só aceita l, c, r");
  const w = o.w;
  if (w !== undefined && (!Array.isArray(w) || w.length !== h.length || w.some((x) => typeof x !== "number" || !(x > 0) || x > 20))) {
    throw new SpecError("w deve ter um número positivo por coluna");
  }
  const hl = o.hl;
  if (hl !== undefined && (!Array.isArray(hl) || hl.some((x) => !Number.isInteger(x)))) {
    throw new SpecError("hl deve ser lista de índices");
  }
  return {
    t: str(o.t, "t"),
    s: o.s === undefined ? undefined : str(o.s, "s"),
    h: h.map((x, i) => str(x, `h[${i}]`, 30)),
    a,
    w: w as number[] | undefined,
    r: rows,
    hl: hl as number[] | undefined,
    f: o.f === undefined ? undefined : str(o.f, "f"),
  };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const color = (c: string | undefined, fallback: string) => {
  if (!c) return fallback;
  if (COLOR_TOKENS[c]) return COLOR_TOKENS[c];
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
};

/** Gera o SVG (largura lógica 720px; renderizar com zoom 2 para o PNG). */
export function buildSvg(spec: TableSpec): string {
  const W = 720;
  const PAD = 24; // margem externa
  const IN = 24; // margem interna do cartão
  const cardX = PAD;
  const cardW = W - PAD * 2;
  const tableX = cardX + IN;
  const tableW = cardW - IN * 2;
  const headH = 40;
  const rowH = 54;
  const nCols = spec.h.length;
  const align = (ci: number) => (spec.a?.[ci] ?? (ci === 0 ? "l" : "r")) as "l" | "c" | "r";
  const weights = spec.w ?? spec.h.map((_, i) => (i === 0 ? 1.6 : 1));
  const totalW = weights.reduce((s, x) => s + x, 0);
  const colX: number[] = [];
  let acc = tableX;
  for (const wt of weights) {
    colX.push(acc);
    acc += (wt / totalW) * tableW;
  }
  const colW = (ci: number) => (weights[ci] / totalW) * tableW;
  const cellPad = 14;
  const textX = (ci: number) => {
    const al = align(ci);
    if (al === "l") return colX[ci] + cellPad;
    if (al === "c") return colX[ci] + colW(ci) / 2;
    return colX[ci] + colW(ci) - cellPad;
  };
  const anchor = (ci: number) => ({ l: "start", c: "middle", r: "end" })[align(ci)];
  const highlight = new Set(spec.hl ?? []);

  const brandY = PAD + IN + 10;
  const titleY = brandY + 32;
  const subY = spec.s ? titleY + 24 : titleY;
  const tableY = subY + 24;
  const bodyY = tableY + headH;
  const tableH = headH + spec.r.length * rowH;
  const footY = tableY + tableH + 28;
  const contentBottom = spec.f ? footY + 4 : tableY + tableH;
  const cardH = contentBottom + IN - PAD;
  const H = PAD + cardH + PAD;

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Roboto">`,
    `<rect width="${W}" height="${H}" fill="${THEME.background}"/>`,
    `<rect x="${cardX}" y="${PAD}" width="${cardW}" height="${cardH}" rx="16" fill="${THEME.card}" stroke="${THEME.border}"/>`,
    // Marca, como na tela de login do app
    // (o losango é desenhado: a Roboto não tem o caractere ◆)
    `<path d="M${tableX + 4} ${brandY - 8}l4 4l-4 4l-4 -4z" fill="${THEME.gold}"/>`,
    `<text x="${tableX + 14}" y="${brandY}" font-size="11" font-weight="700" letter-spacing="2" fill="${THEME.gold}">GRUPO LEY</text>`,
    `<text x="${tableX}" y="${titleY}" font-size="24" font-weight="700" fill="${THEME.fg}">${esc(spec.t)}</text>`,
  );
  if (spec.s) {
    out.push(`<text x="${tableX}" y="${subY}" font-size="14" fill="${THEME.muted}">${esc(spec.s)}</text>`);
  }

  // Tabela: moldura arredondada + cabeçalho
  out.push(
    `<clipPath id="tbl"><rect x="${tableX}" y="${tableY}" width="${tableW}" height="${tableH}" rx="12"/></clipPath>`,
    `<g clip-path="url(#tbl)">`,
    `<rect x="${tableX}" y="${tableY}" width="${tableW}" height="${headH}" fill="${THEME.surface}"/>`,
  );
  spec.h.forEach((h, ci) => {
    out.push(
      `<text x="${textX(ci)}" y="${tableY + headH / 2 + 4}" text-anchor="${anchor(ci)}" font-size="11" font-weight="500" letter-spacing="1" fill="${THEME.muted}">${esc(h.toUpperCase())}</text>`,
    );
  });

  // Linhas zebradas
  spec.r.forEach((row, ri) => {
    const y = bodyY + ri * rowH;
    const hl = highlight.has(ri);
    const bg = hl ? THEME.goldDim : ri % 2 === 0 ? THEME.card : THEME.surface;
    out.push(`<rect x="${tableX}" y="${y}" width="${tableW}" height="${rowH}" fill="${bg}"/>`);
    out.push(`<line x1="${tableX}" y1="${y}" x2="${tableX + tableW}" y2="${y}" stroke="${THEME.border}"/>`);
    row.forEach((cell, ci) => {
      const c = typeof cell === "string" ? { v: cell } : cell;
      const base = ci === 0 ? THEME.soft : THEME.fg;
      const size = hl ? 18 : 16;
      const weight = c.b || hl ? 700 : ci === 0 ? 500 : 400;
      out.push(
        `<text x="${textX(ci)}" y="${y + rowH / 2 + size * 0.36}" text-anchor="${anchor(ci)}" font-size="${size}" font-weight="${weight}"${c.i ? ' font-style="italic"' : ""} fill="${color(c.c, base)}">${esc(c.v)}</text>`,
      );
    });
  });
  out.push(`</g>`);
  out.push(
    `<rect x="${tableX}" y="${tableY}" width="${tableW}" height="${tableH}" rx="12" fill="none" stroke="${THEME.border}"/>`,
  );

  if (spec.f) {
    out.push(`<text x="${tableX}" y="${footY}" font-size="11" fill="${THEME.muted}">${esc(spec.f)}</text>`);
  }
  out.push(`</svg>`);
  return out.join("");
}

/** Decodifica base64url → string UTF-8. */
export function decodeBase64Url(d: string): string {
  const b64 = d.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((d.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
