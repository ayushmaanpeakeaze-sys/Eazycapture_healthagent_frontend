import { ApexOptions } from "apexcharts";
import { Component, ReactNode, useEffect, useRef, useState } from "react";
import Chart from "react-apexcharts";

import {
  fetchClientInsights,
  InsightsResult,
  refreshClientInsights,
} from "../../services/insights.service";
import {
  BankReconciliation,
  BookkeepingHealthSnapshot,
  ClientInsightsSnapshot,
  CorporationTaxResponse,
  DirectorsLoansResponse,
  FinancialPositionResponse,
  ProfitabilityResponse,
  SalesTrackerResponse,
} from "../../types/insights.types";

const COLOR = {
  brand: "#7142ee",
  emerald: "#10b981",
  rose: "#f43f5e",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  ink: "#94a3b8",
};

const gbp = (n: number | null | undefined, dp = 0): string =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(Number.isFinite(n as number) ? (n as number) : 0);

const axisMoney = (v: number): string => {
  const a = Math.abs(v);
  if (a >= 1000) return `£${(v / 1000).toFixed(0)}k`;
  return `£${Math.round(v)}`;
};

const relativeTime = (iso: string | null | undefined): string => {
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

const formatAsOf = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const DEFAULT_TAX_NOTE =
  "Estimate before tax adjustments (depreciation add-backs, capital allowances, losses). Confirm with accountant.";

type Tone = "green" | "amber" | "red";
const toneText: Record<Tone, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-rose-600",
};
const toneStroke: Record<Tone, string> = {
  green: COLOR.emerald,
  amber: COLOR.amber,
  red: COLOR.rose,
};

export const FinancialInsights = ({ companyId }: { companyId: string }) => {
  const [snap, setSnap] =
    useState<InsightsResult<ClientInsightsSnapshot> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSnap(null);
    fetchClientInsights(companyId).then((r) => {
      if (!active) return;
      setSnap(r);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId]);

  const refresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    const before = snap?.ok ? snap.data.computed_at : null;
    const queued = await refreshClientInsights(companyId);
    if (!queued.ok) {
      if (mounted.current) {
        setSnap(queued);
        setRefreshing(false);
      }
      return;
    }
    // Poll until the recompute finishes. Primary signal: the backend's
    // `refreshing` flag going false (reliable, ~5s). Fallback for older backends
    // without the flag: computed_at advancing. ~24s cap is a safety net.
    for (let i = 0; i < 12; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      if (!mounted.current) return;
      const r = await fetchClientInsights(companyId);
      if (!mounted.current) return;
      setSnap(r);
      if (!r.ok) continue;
      if (typeof r.data.refreshing === "boolean") {
        if (!r.data.refreshing) break; // exact: recompute finished
      } else if (r.data.status === "ok" && r.data.computed_at !== before) {
        break; // fallback: snapshot timestamp advanced
      }
    }
    if (mounted.current) setRefreshing(false);
  };

  const computedAt = snap?.ok ? snap.data.computed_at : null;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
            Financial insights
          </p>
          <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink-900">
            The numbers that matter.
          </h2>
          <p className="mt-1 text-xs text-ink-500">
            {computedAt
              ? `Snapshot · updated ${relativeTime(computedAt)} · GBP`
              : "Pre-computed snapshot · figures in GBP"}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            className={[
              "h-3.5 w-3.5",
              loading || refreshing ? "animate-spin" : "",
            ].join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <InsightsBody
        snap={snap}
        refreshing={refreshing}
        asOf={formatAsOf(computedAt)}
      />
    </section>
  );
};

const InsightsBody = ({
  snap,
  refreshing,
  asOf,
}: {
  snap: InsightsResult<ClientInsightsSnapshot> | null;
  refreshing: boolean;
  asOf: string;
}) => {
  if (!snap) return <GridSkeleton />;
  if (!snap.ok) return <ErrorBox message={snap.error} />;

  const { status, payload, stale } = snap.data;
  if (status !== "ok" || !payload) return <NoSnapshot refreshing={refreshing} />;

  return (
    <>
      {stale && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-100">
          This snapshot is a little old — hit Refresh for the latest numbers.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardBoundary><SalesTrackerCard data={payload.sales_tracker} /></CardBoundary>
        <CardBoundary><CashHealthCard data={payload.financial_position} /></CardBoundary>
        <CardBoundary><BookkeepingHealthCard data={payload.bookkeeping_health} /></CardBoundary>
        <CardBoundary><ProfitabilityCard data={payload.profitability} asOf={asOf} /></CardBoundary>
        <CardBoundary><CorporationTaxCard data={payload.corporation_tax} /></CardBoundary>
        <CardBoundary><DirectorsLoansCard data={payload.directors_loans} /></CardBoundary>
        <CardBoundary><BusinessValuationCard data={payload.financial_position} /></CardBoundary>
        <CardBoundary><WorkingCapitalCard data={payload.financial_position} /></CardBoundary>
        <CardBoundary><DividendCard data={payload.financial_position} /></CardBoundary>
        {payload.bank_reconciliation && (
          <CardBoundary>
            <BankReconciliationCard data={payload.bank_reconciliation} />
          </CardBoundary>
        )}
      </div>
    </>
  );
};

// Isolates a single insight card: if it throws (e.g. a sparse snapshot is
// missing a section), show a small fallback instead of white-screening the page.
class CardBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <section className="flex items-center justify-center rounded-2xl border border-ink-100 bg-white p-5 text-center text-xs text-ink-400 shadow-card">
          This insight isn’t available yet.
        </section>
      );
    }
    return this.props.children;
  }
}

const HelpDot = ({ text }: { text: string }) => (
  <span
    title={text}
    className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-ink-100 text-[9px] font-bold text-ink-400"
  >
    ?
  </span>
);

const Card = ({
  title,
  help,
  right,
  children,
}: {
  title: string;
  help?: string;
  right?: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex flex-col rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
    <header className="mb-3 flex items-center gap-2">
      <h3 className="text-base font-semibold tracking-tight text-brand-700">
        {title}
      </h3>
      {help && <HelpDot text={help} />}
      {right && <div className="ml-auto">{right}</div>}
    </header>
    <div className="flex flex-1 flex-col">{children}</div>
  </section>
);

const Heart = ({ tone }: { tone: Tone }) => (
  <svg
    viewBox="0 0 24 24"
    className={["h-3.5 w-3.5", toneText[tone]].join(" ")}
    fill="currentColor"
    aria-hidden
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

// 270° arc gauge with a gap at the bottom.
const ArcGauge = ({
  value,
  tone,
  center,
  label,
}: {
  value: number;
  tone: Tone;
  center: string;
  label: string;
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  const track = 0.75 * c; // 270°
  const val = (clamped / 100) * track;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 110 110" className="h-full w-full">
        <g transform="rotate(135 55 55)">
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke="rgba(15,23,42,0.08)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${track} ${c}`}
          />
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke={toneStroke[tone]}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${val} ${c}`}
            style={{
              transition: "stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)",
            }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold leading-none tabular-nums text-ink-900">
          {center}
        </span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-ink-400">
          {label}
        </span>
        <span className="mt-1">
          <Heart tone={tone} />
        </span>
      </div>
    </div>
  );
};

const Skeleton = () => (
  <div className="h-64 animate-pulse rounded-2xl border border-ink-100 bg-white shadow-card" />
);

const GridSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} />
    ))}
  </div>
);

const ErrorBox = ({ message }: { message: string }) => (
  <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
    <div className="flex items-center gap-3 text-sm text-ink-600">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>
      <span>{message}</span>
    </div>
  </section>
);

const NoSnapshot = ({ refreshing }: { refreshing: boolean }) => (
  <section className="rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-card">
    <p className="text-sm font-medium text-ink-800">No snapshot yet</p>
    <p className="mx-auto mt-1 max-w-sm text-xs text-ink-500">
      This client’s financial insights haven’t been computed. Hit{" "}
      <span className="font-semibold text-ink-700">Refresh</span> above to build
      one from the latest ledger data.
    </p>
    {refreshing && (
      <p className="mt-3 text-xs text-brand-600">Computing snapshot…</p>
    )}
  </section>
);

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Parse a period label into {year, month}. Handles "30 Jun 26", "Jun 26",
// "Jun-26", "June 2026" and "2026-06". Returns null if unrecognised.
const parsePeriodMonth = (
  period: string,
): { year: number; month: number } | null => {
  const iso = period.match(/(\d{4})-(\d{2})/);
  if (iso) return { year: +iso[1], month: +iso[2] - 1 };
  const m = period.match(/([A-Za-z]{3,})\.?\s*-?\s*(\d{2,4})/);
  if (!m) return null;
  const idx = MONTHS.findIndex(
    (x) => x.toLowerCase() === m[1].slice(0, 3).toLowerCase(),
  );
  if (idx < 0) return null;
  let y = +m[2];
  if (y < 100) y += 2000;
  return { year: y, month: idx };
};

const formatMonthLabel = (period: string): string => {
  const pm = parsePeriodMonth(period);
  if (!pm) return period;
  return new Date(pm.year, pm.month, 1).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
};

// How far through the month we are — honest about real time. For the current
// calendar month it's today's progress; past months are complete (100% / 0 days
// left), future months not started. `known` is false when the label won't parse.
const monthProgress = (
  period: string,
): {
  elapsedPct: number;
  daysRemaining: number;
  isCurrent: boolean;
  known: boolean;
} => {
  const pm = parsePeriodMonth(period);
  if (!pm)
    return { elapsedPct: 0, daysRemaining: 0, isCurrent: false, known: false };
  const now = new Date();
  const daysInMonth = new Date(pm.year, pm.month + 1, 0).getDate();
  const isCurrent =
    pm.year === now.getFullYear() && pm.month === now.getMonth();
  if (isCurrent) {
    const day = Math.min(now.getDate(), daysInMonth);
    return {
      elapsedPct: (day / daysInMonth) * 100,
      daysRemaining: daysInMonth - day,
      isCurrent: true,
      known: true,
    };
  }
  const isPast =
    pm.year < now.getFullYear() ||
    (pm.year === now.getFullYear() && pm.month < now.getMonth());
  return isPast
    ? { elapsedPct: 100, daysRemaining: 0, isCurrent: false, known: true }
    : {
        elapsedPct: 0,
        daysRemaining: daysInMonth,
        isCurrent: false,
        known: true,
      };
};

const SalesTrackerCard = ({ data }: { data: SalesTrackerResponse }) => {
  const rows = [...(data.rows ?? [])].reverse();
  const categories = rows.map((r) => r.period);
  const colors = rows.map((r) => (r.met_target ? COLOR.emerald : COLOR.rose));
  const series = [{ name: "Actual", data: rows.map((r) => r.actual) }];
  // "This month" = newest period (rows are newest-first before the reverse).
  const latest = (data.rows ?? [])[0];
  const actualSoFar = latest?.actual ?? 0;
  const target = data.target ?? 0;
  const pct = target > 0 ? (actualSoFar / target) * 100 : 0;
  const met = latest?.met_target ?? pct >= 100;
  const remaining = Math.max(0, target - actualSoFar);
  const mp = latest
    ? monthProgress(latest.period)
    : { elapsedPct: 0, daysRemaining: 0, isCurrent: false, known: false };
  const monthLabel = latest ? formatMonthLabel(latest.period) : "This month";
  const status = met
    ? "Target met!"
    : pct >= 50
      ? "Over halfway!"
      : "Behind target";

  const options: ApexOptions = {
    chart: baseChart(),
    colors,
    plotOptions: {
      bar: {
        columnWidth: "58%",
        borderRadius: 3,
        borderRadiusApplication: "end",
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: miniAxisX(categories),
    yaxis: miniAxisY(),
    grid: gridStyle(),
    annotations: {
      yaxis: [
        {
          y: data.target,
          borderColor: COLOR.brand,
          strokeDashArray: 5,
          label: {
            text: "Target",
            position: "right",
            style: { color: "#fff", background: COLOR.brand, fontSize: "9px" },
          },
        },
      ],
    },
    tooltip: {
      followCursor: true,
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const r = rows[dataPointIndex];
        const c = r.met_target ? COLOR.emerald : COLOR.rose;
        const sign = r.variance_pct >= 0 ? "+" : "";
        return (
          `<div style="padding:6px 9px;font-family:Inter,system-ui,sans-serif">` +
          `<div style="font-weight:600;color:#0f172a;font-size:11px">${r.period}</div>` +
          `<div style="color:#475569;font-size:11px">${gbp(r.actual)}</div>` +
          `<div style="color:${c};font-size:11px">${sign}${r.variance_pct.toFixed(1)}% vs target</div>` +
          `</div>`
        );
      },
    },
  };

  return (
    <Card
      title="Sales Tracker"
      help="Actual monthly sales against your target."
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {monthLabel}
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
            {gbp(actualSoFar)}{" "}
            <span className="text-sm font-medium text-ink-400">
              ({Math.round(pct)}%)
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-ink-400">
            Actual sales so far
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
            met
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : pct >= 50
                ? "bg-amber-50 text-amber-700 ring-amber-200"
                : "bg-rose-50 text-rose-700 ring-rose-200",
          ].join(" ")}
        >
          {status}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-ink-50 px-2.5 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
            Target sales
          </p>
          <p className="text-sm font-semibold tabular-nums text-ink-800">
            {gbp(target)}
          </p>
        </div>
        <div className="rounded-lg bg-ink-50 px-2.5 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-ink-400">
            {met ? "Surplus" : "To target"}
          </p>
          <p className="text-sm font-semibold tabular-nums text-ink-800">
            {met ? `+${gbp(actualSoFar - target)}` : gbp(remaining)}
            {mp.isCurrent && (
              <span className="ml-1 text-[10px] font-medium text-ink-400">
                · {mp.daysRemaining}d left
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mb-2 space-y-1.5">
        <div>
          <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium text-ink-500">
            <span>Sales £</span>
            <span className="tabular-nums">{Math.round(pct)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className={met ? "h-full bg-emerald-500" : "h-full bg-rose-400"}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>
        </div>
        {mp.known && (
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium text-ink-500">
              <span>Time</span>
              <span className="tabular-nums">{Math.round(mp.elapsedPct)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full bg-brand-400"
                style={{
                  width: `${Math.min(100, Math.max(0, mp.elapsedPct))}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <Chart options={options} series={series} type="bar" height={140} />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Met target
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-rose-400" /> Below target
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-3 border-t-2 border-dashed border-brand-500" />{" "}
          Target
        </span>
        <span className="ml-auto">{data.target_basis}</span>
      </div>
    </Card>
  );
};

const CashHealthCard = ({ data }: { data: FinancialPositionResponse }) => {
  const ch = data.cash_health;
  const covPct = Math.round((ch.coverage_ratio ?? 0) * 100);
  const covered = ch.shortfall <= 0;
  const tone: Tone = covPct >= 70 ? "green" : covPct >= 40 ? "amber" : "red";
  return (
    <Card title="Cash Health" help="Cash on hand vs short-term liabilities.">
      <div className="flex items-center gap-4">
        <ArcGauge
          value={Math.min(covPct, 100)}
          tone={tone}
          center={`${covPct}%`}
          label="coverage"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Current cash
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
            {gbp(ch.cash)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500">
            vs {gbp(ch.current_liabilities)} due
          </p>
          {covered ? (
            <p className="mt-1.5 text-[11px] font-medium text-emerald-600">
              Liabilities covered
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] font-medium text-rose-600">
              {gbp(ch.shortfall)} shortfall
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

const BookkeepingHealthCard = ({
  data,
}: {
  data: BookkeepingHealthSnapshot;
}) => {
  const score = data.health_score ?? 0;
  const tone: Tone = score >= 80 ? "green" : score >= 60 ? "amber" : "red";
  return (
    <Card title="Bookkeeping Health" help="From the latest ledger audit.">
      <div className="flex items-center gap-4">
        <ArcGauge
          value={score}
          tone={tone}
          center={`${score}`}
          label="health"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Open issues
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-rose-600">
            {data.open_issues}
          </p>
          <p className="text-[11px] text-ink-500">
            {data.audited_documents} docs · {data.audited_contacts} contacts
            audited
          </p>
          <p className="text-[10px] text-ink-400">
            last audit {relativeTime(data.last_audit_at)}
          </p>
        </div>
      </div>
    </Card>
  );
};

const ProfitabilityCard = ({
  data,
  asOf,
}: {
  data: ProfitabilityResponse;
  asOf: string;
}) => {
  const categories = [...(data.periods ?? [])].reverse();
  const series = [
    { name: "Sales", data: [...(data.series?.sales ?? [])].reverse() },
    { name: "Gross profit", data: [...(data.series?.gross_profit ?? [])].reverse() },
    { name: "Net profit", data: [...(data.series?.net_profit ?? [])].reverse() },
  ];
  const options: ApexOptions = {
    chart: baseChart(),
    colors: [COLOR.sky, COLOR.brand, COLOR.emerald],
    stroke: { width: 2, curve: "smooth" },
    fill: { type: "solid", opacity: 0.16 },
    dataLabels: { enabled: false },
    legend: {
      position: "bottom",
      fontSize: "10px",
      labels: { colors: "#475569" },
      itemMargin: { horizontal: 5, vertical: 0 },
      markers: { size: 5 },
    },
    xaxis: miniAxisX(categories),
    yaxis: miniAxisY(),
    grid: gridStyle(),
    tooltip: { shared: true, intersect: false, y: { formatter: (v) => gbp(v) } },
  };
  return (
    <Card
      title="Profitability"
      help="Sales, gross and net profit by month."
      right={
        <span
          className={[
            "font-display text-lg font-semibold tabular-nums",
            (data.totals?.net_profit ?? 0) < 0 ? "text-rose-600" : "text-emerald-600",
          ].join(" ")}
        >
          {gbp(data.totals?.net_profit)}
        </span>
      }
    >
      <Chart options={options} series={series} type="area" height={170} />
      <p className="mt-1 text-[10px] text-ink-400">
        Net profit · 12mo · {data.report_name ?? "P&L"} as at{" "}
        {data.report_date ?? asOf}
      </p>
    </Card>
  );
};

const CorporationTaxCard = ({ data }: { data: CorporationTaxResponse }) => (
  <Card title="Corporation Tax Estimate" help="Provisional CT estimate.">
    <p className="font-display text-4xl font-semibold leading-none tabular-nums tracking-tight text-ink-900">
      {gbp(data.tax_estimate)}
    </p>
    <p className="mt-1.5 text-[11px] text-ink-500">
      on {gbp(data.taxable_profit)} taxable profit · {data.period_basis}
    </p>
    <span className="mt-2 inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
      {data.effective_rate}% · {data.band}
    </span>
    <p className="mt-auto flex gap-2 pt-3 text-[10px] leading-relaxed text-amber-700">
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-3 w-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 9v4M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <span>{data.note ?? DEFAULT_TAX_NOTE}</span>
    </p>
  </Card>
);

const DirectorsLoansCard = ({ data }: { data: DirectorsLoansResponse }) => {
  const accounts = data.accounts ?? [];
  const owesCompany = accounts.filter((a) => a.overdrawn); // director owes co.
  const owedByCompany = accounts.filter((a) => !a.overdrawn);
  const empty = !data.detected || accounts.length === 0;

  return (
    <Card title="Directors’ Loan Accounts" help="Auto-detected by account name.">
      {empty ? (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-sm text-ink-600">No director’s-loan account mapped.</p>
          <p className="mt-1 text-[11px] text-ink-500">{data.note}</p>
          <span className="mt-3 w-fit rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-400 ring-1 ring-ink-200">
            Manual mapping coming soon
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <DlaGroup
            title="Director(s) owe the company"
            danger
            accounts={owesCompany}
          />
          <DlaGroup
            title="Company owes director(s)"
            accounts={owedByCompany}
          />
          <p className="text-[10px] italic text-ink-400">{data.note}</p>
        </div>
      )}
    </Card>
  );
};

const DlaGroup = ({
  title,
  accounts,
  danger,
}: {
  title: string;
  accounts: DirectorsLoansResponse["accounts"];
  danger?: boolean;
}) => (
  <div>
    <p className="text-[11px] font-medium text-ink-600">{title}</p>
    {accounts.length === 0 ? (
      <p className="text-[11px] text-ink-400">None.</p>
    ) : (
      <ul className="mt-1 space-y-1">
        {accounts.map((a) => (
          <li
            key={a.code || a.account}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="truncate text-ink-800">
              {a.account}
              {a.code && (
                <span className="ml-1 font-mono text-[10px] text-ink-400">
                  {a.code}
                </span>
              )}
            </span>
            <span
              className={[
                "shrink-0 font-semibold tabular-nums",
                danger ? "text-rose-600" : "text-ink-900",
              ].join(" ")}
            >
              {gbp(a.balance)}
            </span>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const BusinessValuationCard = ({
  data,
}: {
  data: FinancialPositionResponse;
}) => (
  <Card title="Business Valuation" help="Estimated value of the business.">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
      Valuation estimate
    </p>
    <p className="mt-1 font-display text-4xl font-semibold leading-none tabular-nums tracking-tight text-ink-900">
      {gbp(data.valuation.net_asset_value)}
    </p>
    <p className="mt-2 text-[11px] text-ink-500">
      {data.valuation.model === "net_asset"
        ? "Net-asset method — total assets less total liabilities."
        : data.valuation.model}
    </p>
    <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[11px]">
      <div>
        <span className="text-ink-400">Total assets</span>
        <p className="font-semibold tabular-nums text-ink-800">
          {gbp(data.position.total_assets)}
        </p>
      </div>
      <div>
        <span className="text-ink-400">Total liabilities</span>
        <p className="font-semibold tabular-nums text-rose-600">
          {gbp(data.position.total_liabilities)}
        </p>
      </div>
    </div>
  </Card>
);

const WorkingCapitalCard = ({
  data,
}: {
  data: FinancialPositionResponse;
}) => {
  const wc = data.working_capital;
  return (
    <Card
      title="Working Capital"
      help="Current assets minus current liabilities."
      right={
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
            wc.healthy
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-rose-200",
          ].join(" ")}
        >
          {wc.healthy ? "Healthy" : "Tight"}
        </span>
      }
    >
      <p
        className={[
          "font-display text-4xl font-semibold leading-none tabular-nums tracking-tight",
          wc.working_capital < 0 ? "text-rose-600" : "text-emerald-600",
        ].join(" ")}
      >
        {gbp(wc.working_capital)}
      </p>
      <p className="mt-2 text-[11px] text-ink-500">
        Current ratio{" "}
        <span className="font-semibold text-ink-700">
          {wc.current_ratio.toFixed(2)}×
        </span>
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[11px]">
        <div>
          <span className="text-ink-400">Current assets</span>
          <p className="font-semibold tabular-nums text-ink-800">
            {gbp(wc.current_assets)}
          </p>
        </div>
        <div>
          <span className="text-ink-400">Current liabilities</span>
          <p className="font-semibold tabular-nums text-rose-600">
            {gbp(wc.current_liabilities)}
          </p>
        </div>
      </div>
    </Card>
  );
};

const DividendCard = ({ data }: { data: FinancialPositionResponse }) => {
  const d = data.dividend;
  return (
    <Card
      title="Dividend Availability"
      help="Distributable reserves available to pay as dividends."
    >
      <dl className="space-y-1.5 text-[12px]">
        <LedgerRow label="Retained earnings (prior)" value={gbp(d.retained_earnings)} />
        <LedgerRow
          label="Add: profit this year"
          value={gbp(d.current_year_earnings)}
        />
        <div className="my-1 border-t border-ink-100" />
        <LedgerRow
          label="Distributable reserves"
          value={gbp(d.distributable_reserves)}
          strong
        />
      </dl>
      <div className="mt-auto pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Maximum dividend available
        </p>
        <p
          className={[
            "font-display text-3xl font-semibold leading-none tabular-nums tracking-tight",
            d.distributable_reserves > 0 ? "text-emerald-600" : "text-rose-600",
          ].join(" ")}
        >
          {gbp(d.distributable_reserves)}
        </p>
        <p className="mt-1 text-[10px] italic text-ink-400">{d.basis}</p>
      </div>
    </Card>
  );
};

const LedgerRow = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3">
    <dt className={strong ? "font-semibold text-ink-800" : "text-ink-500"}>
      {label}
    </dt>
    <dd
      className={[
        "tabular-nums",
        strong ? "font-semibold text-ink-900" : "text-ink-700",
      ].join(" ")}
    >
      {value}
    </dd>
  </div>
);

// Display-only — sourced from Xero's IsReconciled flag.
const BankReconciliationCard = ({ data }: { data: BankReconciliation }) => {
  const clean = data.unreconciled_count === 0;
  const reconciled = Math.max(0, data.total_transactions - data.unreconciled_count);
  return (
    <Card
      title="Bank Reconciliation"
      help="Unreconciled bank items from Xero’s IsReconciled flag. View-only — reconcile in Xero."
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Unreconciled items
          </p>
          <p
            className={[
              "font-display text-4xl font-semibold leading-none tabular-nums tracking-tight",
              clean ? "text-emerald-600" : "text-amber-600",
            ].join(" ")}
          >
            {data.unreconciled_count}
          </p>
          {!clean && (
            <p className="mt-1 text-[11px] text-ink-500">
              {gbp(data.unreconciled_value)} unreconciled value
            </p>
          )}
        </div>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
            clean
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-amber-200",
          ].join(" ")}
        >
          {reconciled}/{data.total_transactions} reconciled
        </span>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[11px]">
        <div>
          <span className="text-ink-400">Last reconciled</span>
          <p className="font-semibold text-ink-800">
            {formatAsOf(data.last_reconciled_date)}
          </p>
        </div>
        <div>
          <span className="text-ink-400">Most recent txn</span>
          <p className="font-semibold text-ink-800">
            {formatAsOf(data.most_recent_transaction)}
          </p>
        </div>
      </div>
    </Card>
  );
};

const baseChart = (): ApexOptions["chart"] => ({
  toolbar: { show: false },
  zoom: { enabled: false },
  fontFamily: "Inter, system-ui, sans-serif",
  animations: { enabled: true, speed: 450 },
  parentHeightOffset: 0,
});

const miniAxisX = (categories: string[]): ApexOptions["xaxis"] => ({
  categories,
  tickAmount: 6,
  labels: {
    rotate: -40,
    hideOverlappingLabels: true,
    style: { colors: "#94a3b8", fontSize: "9px" },
  },
  axisBorder: { color: "#e2e8f0" },
  axisTicks: { show: false },
  tooltip: { enabled: false },
});

const miniAxisY = (): ApexOptions["yaxis"] => ({
  labels: {
    formatter: (v: number) => axisMoney(v),
    style: { colors: "#94a3b8", fontSize: "9px" },
  },
});

const gridStyle = (): ApexOptions["grid"] => ({
  borderColor: "#f1f3f7",
  padding: { left: 4, right: 4 },
  xaxis: { lines: { show: false } },
});
