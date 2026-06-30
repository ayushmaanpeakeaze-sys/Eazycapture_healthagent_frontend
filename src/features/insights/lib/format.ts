export const COLOR = {
  brand: "#7142ee",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  ink: "#94a3b8",
};

export const gbp = (n: number | null | undefined, dp = 0): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(Number.isFinite(n as number) ? (n as number) : 0);

export const axisMoney = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1000) return `£${(v / 1000).toFixed(0)}k`;
  return `£${Math.round(v)}`;
};

export const relativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const formatAsOf = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const DEFAULT_TAX_NOTE =
  "Estimate before tax adjustments (depreciation add-backs, capital allowances, losses). Confirm with accountant.";

export type Tone = "green" | "amber" | "red";
export const toneText: Record<Tone, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-rose-600",
};
export const toneStroke: Record<Tone, string> = {
  green: COLOR.emerald,
  amber: COLOR.amber,
  red: COLOR.rose,
};
