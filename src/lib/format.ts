export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const num = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Convert a free-typed BR-style string into a number. Accepts "1.234,56", "1234,56", "1234.56", "1234". */
export const parseBrlInput = (s: string): number => {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d,.-]/g, "");
  // If both . and , present, assume . = thousand sep, , = decimal
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (cleaned.includes(",")) return Number(cleaned.replace(",", ".")) || 0;
  return Number(cleaned) || 0;
};

/** Format a number for display inside a text input (no currency symbol). */
export const formatBrlInput = (n: number): string =>
  n === 0 ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

