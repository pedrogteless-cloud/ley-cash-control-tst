import { ReactNode } from "react";

type Tone = "gold" | "green" | "red" | "blue" | "orange";

const toneMap: Record<Tone, { fg: string; bg: string }> = {
  gold: { fg: "text-gold", bg: "bg-gold-dim" },
  green: { fg: "text-green", bg: "bg-green-dim" },
  red: { fg: "text-red", bg: "bg-red-dim" },
  blue: { fg: "text-blue", bg: "bg-blue-dim" },
  orange: { fg: "text-orange", bg: "bg-orange-dim" },
};

export function KpiCard({
  label,
  value,
  hint,
  explain,
  tone = "gold",
}: {
  label: string;
  value: string;
  hint?: string;
  /** Frase curta em linguagem simples — aparece só no mobile, para ajudar quem é pouco digital */
  explain?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  const t = toneMap[tone] ?? toneMap.gold;
  return (
    <div className="rounded-md border border-border bg-card px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
      <div className={`mt-1 whitespace-nowrap text-lg font-semibold tabular-nums sm:text-xl ${t.fg}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-soft-foreground">{hint}</div>}
      {explain && (
        <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground sm:hidden">
          {explain}
        </div>
      )}
    </div>
  );
}
