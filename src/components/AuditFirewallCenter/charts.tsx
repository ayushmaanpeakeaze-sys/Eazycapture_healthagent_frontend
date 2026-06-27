/**
 * Tiny in-house chart primitives. SVG-only, Tailwind-only, no deps.
 * Used by ClientInsightsView and PracticeInsightsView.
 */
import { ReactNode } from "react";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** Tailwind stroke-* class. */
  strokeCls: string;
  /** Tailwind bg-* class for the legend dot. */
  dotCls: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Number to render in the centre (e.g. health score, total). */
  centerValue?: ReactNode;
  /** Small caption below the centre number. */
  centerCaption?: string;
  /** Diameter in Tailwind sizing — default h-32 w-32. */
  sizeCls?: string;
}

export const DonutChart = ({
  segments,
  centerValue,
  centerCaption,
  sizeCls = "h-32 w-32",
}: DonutChartProps) => {
  const r = 36;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  let cumOffset = 0;

  return (
    <div className={`relative ${sizeCls} shrink-0`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(15,23,42,0.07)"
          strokeWidth="8"
        />
        {total > 0 &&
          segments.map((seg) => {
            if (seg.value === 0) return null;
            const length = (seg.value / total) * c;
            const offset = -cumOffset;
            cumOffset += length;
            return (
              <circle
                key={seg.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                className={seg.strokeCls}
                strokeWidth="8"
                strokeLinecap="butt"
                strokeDasharray={`${length} ${c}`}
                strokeDashoffset={offset}
                style={{
                  transition:
                    "stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1)",
                }}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-2xl font-semibold tabular-nums text-ink-900">
          {centerValue ?? (total > 0 ? total : "—")}
        </span>
        {centerCaption && (
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-400">
            {centerCaption}
          </span>
        )}
      </div>
    </div>
  );
};

export const DonutLegend = ({ segments }: { segments: DonutSegment[] }) => {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  return (
    <ul className="space-y-1.5">
      {segments.map((seg) => {
        const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
        return (
          <li
            key={seg.key}
            className="flex items-center justify-between gap-3 text-[11px]"
          >
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${seg.dotCls}`} />
              <span className="font-medium text-ink-700">{seg.label}</span>
            </span>
            <span className="tabular-nums text-ink-500">
              <span className="font-semibold text-ink-800">{seg.value}</span>
              <span className="ml-1 text-ink-400">· {pct}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Tailwind bg-* class for the bar fill. Default brand-gradient. */
  fillCls?: string;
}

interface BarChartProps {
  rows: BarRow[];
  /** Number of rows to show; rest are dropped. */
  limit?: number;
  /** Suffix after the value (e.g., "trapped"). */
  unit?: string;
  /** Empty-state copy. */
  emptyLabel?: string;
}

/**
 * Horizontal bar chart — one row per item, ranked by value desc.
 * Bar widths are proportional to the largest value in the set.
 */
export const BarChart = ({
  rows,
  limit,
  unit,
  emptyLabel = "No data yet",
}: BarChartProps) => {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const visible = limit ? sorted.slice(0, limit) : sorted;
  const max = sorted[0]?.value ?? 0;

  if (visible.length === 0 || max === 0) {
    return (
      <p className="py-6 text-center text-xs italic text-ink-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {visible.map((row, i) => {
        const widthPct = Math.max(4, (row.value / max) * 100);
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-xs font-medium text-ink-800">
                <span className="mr-1.5 text-[10px] font-semibold tabular-nums text-ink-400">
                  #{i + 1}
                </span>
                {row.label}
              </p>
              <p className="shrink-0 text-[11px] tabular-nums text-ink-500">
                <span className="font-semibold text-ink-800">{row.value}</span>
                {unit && <span className="ml-1 text-ink-400">{unit}</span>}
              </p>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className={`h-full rounded-full ${
                  row.fillCls ?? "bg-brand-gradient"
                } transition-all duration-500`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

interface BucketBarProps {
  /** Each bucket = a colored segment with a count. Render side-by-side. */
  buckets: { key: string; label: string; value: number; barCls: string }[];
}

/**
 * Single horizontal bar split into colored buckets.
 * Use for things like audit freshness (<7d / 7-30d / 30-90d / >90d / never).
 */
export const BucketBar = ({ buckets }: BucketBarProps) => {
  const total = buckets.reduce((acc, b) => acc + b.value, 0);
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink-100">
        {total > 0 &&
          buckets.map((b) => {
            if (b.value === 0) return null;
            const pct = (b.value / total) * 100;
            return (
              <div
                key={b.key}
                className={`h-full ${b.barCls} transition-all duration-500`}
                style={{ width: `${pct}%` }}
                title={`${b.label}: ${b.value}`}
              />
            );
          })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-5">
        {buckets.map((b) => (
          <li key={b.key} className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${b.barCls}`} />
            <span className="truncate text-ink-700">{b.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-ink-800">
              {b.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ChartCard = ({
  title,
  caption,
  right,
  children,
  span,
}: {
  title: string;
  caption?: string;
  right?: ReactNode;
  children: ReactNode;
  /** Tailwind col-span override, e.g. "lg:col-span-2". */
  span?: string;
}) => (
  <section
    className={[
      "rounded-2xl border border-ink-200 bg-white p-5 shadow-card",
      span ?? "",
    ].join(" ")}
  >
    <header className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {caption && <p className="mt-0.5 text-xs text-ink-500">{caption}</p>}
      </div>
      {right}
    </header>
    {children}
  </section>
);

/** Pretty label for a snake_case issue_type — "missing_tax" → "Missing tax". */
export const humanIssueType = (t: string): string =>
  t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
