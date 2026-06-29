import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchHealthStats,
  fetchLedgerHealthSummary,
} from "../../services/audit.service";
import { HealthStatsResponse } from "../../types/audit.types";

// Severity palette — keep in sync with SEVERITY_STYLES in TrappedInvoicesList.
const COLOR = {
  critical: "#f43f5e", // rose-500
  high: "#f97316",     // orange-500
  medium: "#0ea5e9",   // sky-500
  ink: "#94a3b8",      // slate-400 — neutral fallback
  emerald: "#10b981",  // emerald-500 — only used in lifecycle "resolved"
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: COLOR.critical,
  high: COLOR.high,
  medium: COLOR.medium,
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
};

const humanIssueType = (t: string): string =>
  t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const scoreTone = (score: number | null) => {
  if (score === null)
    return { label: "No data", chip: "text-ink-500 ring-ink-200", ring: "stroke-ink-300" };
  if (score >= 80)
    return { label: "Healthy", chip: "text-emerald-700 ring-emerald-200", ring: "stroke-emerald-500" };
  if (score >= 60)
    return { label: "Watch", chip: "text-amber-700 ring-amber-200", ring: "stroke-amber-500" };
  return { label: "At risk", chip: "text-rose-700 ring-rose-200", ring: "stroke-rose-500" };
};

export const BookkeepingHealthInsights = ({
  companyId,
  onDrillToIssueType,
}: {
  companyId: string;
  /** Jump to the trapped list filtered to one issue type (KPI drill-in). */
  onDrillToIssueType?: (issueType: string) => void;
}) => {
  const [stats, setStats] = useState<HealthStatsResponse | null>(null);
  const [summaryScore, setSummaryScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchHealthStats(companyId)
      .then((data) => {
        if (!active) return;
        setStats(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    // Real health score lives on /summary/ — stats returns null for it.
    fetchLedgerHealthSummary(companyId)
      .then((s) => {
        if (!active || !s) return;
        setSummaryScore(s.health_score);
      })
      .catch(() => {
        if (active) setSummaryScore(null);
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  const score = useMemo(() => {
    // Prefer the real backend score (summary → stats), fall back to derived.
    if (summaryScore !== null) return summaryScore;
    if (!stats) return null;
    if (stats.health_score !== null) return stats.health_score;
    const denom = stats.total_issues;
    if (denom === 0) return 100;
    const passed = stats.resolved_issues + stats.dismissed_issues;
    return Math.round((passed / denom) * 100);
  }, [summaryScore, stats]);

  const tone = scoreTone(score);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          Bookkeeping health
        </p>
        <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink-900">
          Findings, broken down.
        </h2>
      </header>

      {loading && !stats && (
        <p className="text-sm text-ink-500">Loading…</p>
      )}

      {!loading && !stats && (
        <p className="text-sm text-ink-500">
          No insights data yet. Run an audit on the Inbound tab to populate
          this view.
        </p>
      )}

      {stats && (
        <>
          <div className="grid shrink-0 grid-cols-1 gap-4 lg:grid-cols-[1.1fr_2fr]">
            <section className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-float-brand">
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-white/10 blur-2xl"
              />
              <div className="relative flex h-full flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Health score
                </p>
                <p className="mt-0.5 text-[9px] text-white/55">
                  documents + contacts
                </p>
                <div className="mt-2 flex flex-1 items-center justify-center">
                  <GaugeOnDark score={score} />
                </div>
                <div className="mt-3 flex items-center justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    {tone.label}
                  </span>
                </div>
              </div>
            </section>

            {/* Documents (score driver) and contacts (hygiene) are shown apart, never lumped. */}
            <div className="grid grid-cols-2 gap-4">
              {stats.open_document_issues !== undefined ? (
                <KpiCard
                  label="Document issues"
                  value={stats.open_document_issues}
                  ringPct={
                    stats.audited_documents && stats.audited_documents > 0
                      ? (stats.open_document_issues / stats.audited_documents) *
                        100
                      : 0
                  }
                  ringColor={COLOR.critical}
                  tone="rose"
                  sublabel={
                    stats.audited_documents
                      ? `of ${stats.audited_documents} audited`
                      : undefined
                  }
                />
              ) : (
                <KpiCard
                  label="Open"
                  value={stats.open_issues}
                  ringPct={
                    stats.total_issues > 0
                      ? (stats.open_issues / stats.total_issues) * 100
                      : 0
                  }
                  ringColor={COLOR.critical}
                  tone="rose"
                />
              )}
              {stats.open_contact_issues !== undefined ? (
                <KpiCard
                  label="Contact issues"
                  value={stats.open_contact_issues}
                  ringPct={
                    stats.audited_contacts && stats.audited_contacts > 0
                      ? (stats.open_contact_issues / stats.audited_contacts) *
                        100
                      : 100
                  }
                  ringColor={COLOR.high}
                  tone="ink"
                  sublabel={
                    stats.audited_contacts
                      ? `of ${stats.audited_contacts} contacts`
                      : "hygiene · separate"
                  }
                  onClick={
                    onDrillToIssueType
                      ? () => onDrillToIssueType("contact_defaults")
                      : undefined
                  }
                />
              ) : (
                <KpiCard
                  label="Total findings"
                  value={stats.total_issues}
                  ringPct={100}
                  ringColor={COLOR.medium}
                  tone="ink"
                />
              )}
              <KpiCard
                label="Resolved"
                value={stats.resolved_issues}
                ringPct={
                  stats.total_issues > 0
                    ? (stats.resolved_issues / stats.total_issues) * 100
                    : 0
                }
                ringColor={COLOR.emerald}
                tone="emerald"
              />
              <KpiCard
                label="Dismissed"
                value={stats.dismissed_issues}
                ringPct={
                  stats.total_issues > 0
                    ? (stats.dismissed_issues / stats.total_issues) * 100
                    : 0
                }
                ringColor={COLOR.ink}
                tone="ink"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
            <IssuesByTypeCard stats={stats} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <SeverityCard stats={stats} />
              <LifecycleCard stats={stats} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const BarTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { name: string } }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-ink-900">{p.payload.name}</p>
      <p className="text-ink-500">
        <span className="font-semibold text-ink-800">{p.value}</span> findings
      </p>
    </div>
  );
};

// Multi-line x-axis label so long category names don't clip (max 3 lines, ~12 chars each).
const WrapTick = ({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) => {
  if (x == null || y == null || !payload?.value) return null;
  const words = String(payload.value).split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > 12) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.slice(0, 3).map((ln, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={12 + i * 11}
          textAnchor="middle"
          fontSize={10}
          fontFamily="Inter, system-ui, sans-serif"
          fill="#64748b"
        >
          {ln}
        </text>
      ))}
    </g>
  );
};

const IssuesByTypeCard = ({ stats }: { stats: HealthStatsResponse }) => {
  const data = useMemo(
    () =>
      [...stats.by_issue_type]
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
        .map((r) => ({
          name: humanIssueType(r.issue_type),
          value: r.count,
          severity: r.severity,
          color: SEVERITY_COLOR[r.severity] ?? COLOR.ink,
        })),
    [stats.by_issue_type],
  );

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-float">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Issues by type
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink-900">
            Where the mistakes concentrate
          </h2>
        </div>
        <p className="text-[11px] text-ink-500">
          {data.length} categor{data.length === 1 ? "y" : "ies"} · colored by
          severity
        </p>
      </header>

      {data.length === 0 ? (
        <p className="py-10 text-center text-sm italic text-ink-400">
          No findings to break down.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            data={data}
            margin={{ top: 24, right: 16, left: 16, bottom: 0 }}
            barCategoryGap="22%"
          >
            <CartesianGrid vertical={false} stroke="#f1f3f7" />
            <XAxis
              dataKey="name"
              interval={0}
              height={62}
              tickMargin={6}
              padding={{ left: 8, right: 8 }}
              tick={<WrapTick />}
              stroke="#e2e8f0"
              tickLine={false}
            />
            {/* Hidden axis with headroom so the tallest column's label isn't clipped. */}
            <YAxis
              hide
              domain={[0, (max: number) => Math.ceil(max * 1.12)]}
            />
            <Tooltip
              cursor={{ fill: "rgba(113, 66, 238, 0.06)" }}
              content={<BarTooltip />}
            />
            <Bar
              dataKey="value"
              radius={[6, 6, 0, 0]}
              isAnimationActive
              animationDuration={500}
              label={{
                position: "top",
                fill: "#0f172a",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
};

const DonutTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload: { fill: string } }>;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs shadow-md">
      <p className="flex items-center gap-1.5 font-medium text-ink-900">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: p.payload.fill }}
        />
        {p.name}
      </p>
      <p className="mt-0.5 text-ink-500">
        <span className="font-semibold text-ink-800">{p.value}</span> findings
      </p>
    </div>
  );
};

const SeverityCard = ({ stats }: { stats: HealthStatsResponse }) => {
  const data = useMemo(
    () =>
      [...stats.by_severity]
        .filter((r) => SEVERITY_COLOR[r.severity])
        .sort((a, b) => b.count - a.count)
        .map((r) => ({
          name: SEVERITY_LABEL[r.severity] ?? r.severity,
          value: r.count,
          fill: SEVERITY_COLOR[r.severity],
        })),
    [stats.by_severity],
  );

  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-float">
      <header className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          Severity
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink-900">
          Risk profile
        </h2>
      </header>

      {data.length === 0 ? (
        <p className="py-10 text-center text-sm italic text-ink-400">
          No open findings.
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<DonutTooltip />} />
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive
                  animationDuration={500}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold tabular-nums text-ink-900">
                {total}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                findings
              </span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2.5">
            {data.map((d) => {
              const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
              return (
                <li
                  key={d.name}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.fill }}
                    />
                    <span className="font-medium text-ink-800">{d.name}</span>
                  </span>
                  <span className="tabular-nums">
                    <span className="font-semibold text-ink-900">{d.value}</span>
                    <span className="ml-1 text-[11px] text-ink-400">
                      · {pct}%
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

const LifecycleCard = ({ stats }: { stats: HealthStatsResponse }) => {
  const data = [
    { name: "Open", value: stats.open_issues, fill: COLOR.critical },
    { name: "Resolved", value: stats.resolved_issues, fill: COLOR.emerald },
    { name: "Dismissed", value: stats.dismissed_issues, fill: COLOR.ink },
  ];
  const total = stats.total_issues;
  const cleared = stats.resolved_issues + stats.dismissed_issues;
  const clearedPct = total > 0 ? Math.round((cleared / total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-float">
      <header className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          Resolution lifecycle
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink-900">
          Open · Resolved · Dismissed
        </h2>
      </header>

      {total === 0 ? (
        <p className="py-10 text-center text-sm italic text-ink-400">
          Nothing to lifecycle yet.
        </p>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<DonutTooltip />} />
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive
                  animationDuration={500}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold tabular-nums text-ink-900">
                {clearedPct}%
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                cleared
              </span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2.5">
            {data.map((d) => (
              <li
                key={d.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: d.fill }}
                  />
                  <span className="font-medium text-ink-800">{d.name}</span>
                </span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {d.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const GaugeOnDark = ({ score }: { score: number | null }) => {
  const hasScore = score !== null;
  const pct = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  const r = 58;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="11"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={hasScore ? offset : c}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[44px] font-semibold leading-none tabular-nums tracking-tight text-white">
          {hasScore ? pct : "—"}
        </span>
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
          out of 100
        </span>
      </div>
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  ringPct,
  ringColor,
  tone = "ink",
  sublabel,
  onClick,
}: {
  label: string;
  value: number;
  ringPct: number;
  ringColor: string;
  tone?: "ink" | "rose" | "emerald";
  sublabel?: string;
  onClick?: () => void;
}) => {
  const cls =
    tone === "rose"
      ? "text-rose-700"
      : tone === "emerald"
        ? "text-emerald-700"
        : "text-ink-900";
  const r = 16;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, ringPct));
  const offset = c - (pct / 100) * c;
  const baseCls =
    "relative flex w-full items-start justify-between gap-3 rounded-2xl border border-ink-100 bg-white px-5 py-4 text-left shadow-float transition hover:-translate-y-0.5 hover:shadow-float-lg";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick
        ? {
            type: "button" as const,
            onClick,
            className: `${baseCls} cursor-pointer hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200`,
          }
        : { className: baseCls })}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
          {label}
        </p>
        <p
          className={[
            "mt-2 font-display text-3xl font-semibold leading-none tabular-nums tracking-tight",
            cls,
          ].join(" ")}
        >
          {value}
        </p>
        {sublabel && (
          <p className="mt-1 text-[10px] text-ink-400">
            {sublabel}
            {onClick && <span className="text-brand-500"> · view →</span>}
          </p>
        )}
      </div>
      <div className="relative h-11 w-11 shrink-0">
        <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="rgba(15,23,42,0.06)"
            strokeWidth="5"
          />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[9px] font-bold tabular-nums text-ink-500">
            {Math.round(pct)}%
          </span>
        </div>
      </div>
    </Wrapper>
  );
};
