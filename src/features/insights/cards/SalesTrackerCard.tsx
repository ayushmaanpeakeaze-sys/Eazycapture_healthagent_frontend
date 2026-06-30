import { ApexOptions } from "apexcharts";
import { useEffect, useState } from "react";
import Chart from "react-apexcharts";

import {
  fetchSalesTarget,
  updateSalesTarget,
} from "../../../services/insights.service";
import {
  SalesTargetBasis,
  SalesTrackerResponse,
} from "../../../types/insights.types";
import { Card } from "../components/Card";
import { baseChart, gridStyle, miniAxisX, miniAxisY } from "../lib/charts";
import { COLOR, gbp } from "../lib/format";
import { formatMonthLabel, monthProgress } from "../lib/period";

const SALES_BASIS_LABELS: Record<string, string> = {
  none: "No target",
  previous_month: "Previous month",
  average_3: "3-month average",
  average_6: "6-month average",
  average_12: "12-month average",
  same_month_last_year: "Same month last year",
  xero_budget: "Xero budget",
  manual: "Manual target",
};
const basisLabel = (b: string) => SALES_BASIS_LABELS[b] ?? b;

export const SalesTrackerCard = ({
  data,
  companyId,
  onRefresh,
}: {
  data: SalesTrackerResponse;
  companyId: string;
  onRefresh: () => void;
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Chart: prefer the new chart{}; else fall back to legacy rows (oldest→newest).
  const reversedRows = [...(data.rows ?? [])].reverse();
  const cats = data.chart?.periods ?? reversedRows.map((r) => r.period);
  const actualArr = data.chart?.actual ?? reversedRows.map((r) => r.actual);
  const targetArr: (number | null)[] =
    data.chart?.target ?? reversedRows.map((r) => r.target ?? null);
  const hasChart = cats.length > 0;

  // Current-month panel: prefer the new current_month{}; else compute from legacy.
  const cm = data.current_month ?? null;
  const latestRow = (data.rows ?? [])[0];
  const monthLabel =
    cm?.period ?? (latestRow ? formatMonthLabel(latestRow.period) : "This month");
  const actualSoFar = cm?.actual ?? latestRow?.actual ?? 0;
  const target = cm
    ? cm.target
    : typeof data.target === "number"
      ? data.target
      : null;
  const pct = cm
    ? cm.pct_of_target
    : target && target > 0
      ? (actualSoFar / target) * 100
      : null;
  const remaining = cm
    ? cm.remaining_value
    : target != null
      ? Math.max(0, target - actualSoFar)
      : null;
  const met = cm?.met_target ?? (pct != null && pct >= 100);
  const noTarget = target == null || target <= 0 || pct == null;
  const salesBar = cm
    ? cm.sales_bar_pct
    : pct != null
      ? Math.min(100, Math.max(0, pct))
      : null;
  const lmp = !cm && latestRow ? monthProgress(latestRow.period) : null;
  const timeBar = cm ? cm.time_bar_pct : lmp?.known ? lmp.elapsedPct : null;
  const daysRemaining = cm?.days_remaining ?? lmp?.daysRemaining ?? null;
  const statusText = cm?.status ?? null;

  // Short status chip derived from pace (sales vs time).
  const tone: "emerald" | "amber" | "rose" | "ink" = noTarget
    ? "ink"
    : met
      ? "emerald"
      : salesBar != null && timeBar != null && salesBar >= timeBar + 10
        ? "emerald"
        : salesBar != null && timeBar != null && salesBar < timeBar - 10
          ? "rose"
          : "amber";
  const chipLabel = noTarget
    ? "No target"
    : met
      ? "Target met"
      : tone === "emerald"
        ? "Ahead of pace"
        : tone === "rose"
          ? "Behind pace"
          : "On track";
  const chipCls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "rose"
        ? "bg-rose-50 text-rose-700 ring-rose-200"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-ink-100 text-ink-600 ring-ink-200";

  // Combo: blue actual bars + green target line (null targets → gaps).
  const series = [
    { name: "Actual", type: "column", data: actualArr },
    { name: "Target", type: "line", data: targetArr },
  ];
  const options: ApexOptions = {
    chart: { ...baseChart(), type: "line" },
    colors: [COLOR.sky, COLOR.emerald],
    stroke: { width: [0, 2.5], curve: "straight" },
    plotOptions: {
      bar: { columnWidth: "55%", borderRadius: 3, borderRadiusApplication: "end" },
    },
    markers: { size: [0, 4], strokeColors: "#fff", strokeWidth: 1.5 },
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: miniAxisX(cats),
    yaxis: miniAxisY(),
    grid: gridStyle(),
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (v: number) => (v == null ? "—" : gbp(v)) },
    },
  };

  const gear = (
    <button
      type="button"
      onClick={() => setSettingsOpen(true)}
      title="Set the sales target"
      className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  return (
    <Card
      title="Sales Tracker"
      help="Actual monthly sales against your target."
      right={gear}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {monthLabel}
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
            {gbp(actualSoFar)}
            {pct != null && (
              <span className="text-sm font-medium text-ink-400">
                {" "}
                ({Math.round(pct)}%)
              </span>
            )}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-ink-400">
            Actual sales so far
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
            chipCls,
          ].join(" ")}
        >
          {chipLabel}
        </span>
      </div>

      {statusText && (
        <p className="mb-3 text-xs leading-snug text-ink-600">{statusText}</p>
      )}

      {noTarget ? (
        <div className="mb-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          No sales target set.{" "}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="font-semibold text-brand-700 hover:underline"
          >
            Set a target →
          </button>
        </div>
      ) : (
        <>
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
                {met
                  ? `+${gbp(actualSoFar - (target ?? 0))}`
                  : gbp(remaining ?? 0)}
                {daysRemaining != null && (
                  <span className="ml-1 text-[10px] font-medium text-ink-400">
                    · {daysRemaining}d left
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mb-2 space-y-1.5">
            {salesBar != null && (
              <div>
                <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium text-ink-500">
                  <span>Sales £</span>
                  <span className="tabular-nums">{Math.round(pct ?? 0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, salesBar))}%`,
                      background: met ? COLOR.emerald : COLOR.sky,
                    }}
                  />
                </div>
              </div>
            )}
            {timeBar != null && (
              <div>
                <div className="mb-0.5 flex items-center justify-between text-[10px] font-medium text-ink-500">
                  <span>Time</span>
                  <span className="tabular-nums">{Math.round(timeBar)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full bg-brand-400"
                    style={{ width: `${Math.min(100, Math.max(0, timeBar))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {hasChart ? (
        <Chart options={options} series={series} type="line" height={150} />
      ) : (
        <p className="py-6 text-center text-xs text-ink-400">
          No sales history yet.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: COLOR.sky }} />{" "}
          Actual
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-3 border-t-2 border-emerald-500" />{" "}
          Target
        </span>
        <span className="ml-auto">{basisLabel(data.target_basis)}</span>
      </div>

      {settingsOpen && (
        <SalesTargetSettings
          companyId={companyId}
          currentBasis={data.target_basis}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            onRefresh();
          }}
        />
      )}
    </Card>
  );
};

const SALES_BASIS_OPTIONS: { value: SalesTargetBasis; label: string }[] = [
  { value: "none", label: "No target" },
  { value: "previous_month", label: "Previous month's actual" },
  { value: "average_3", label: "3-month average" },
  { value: "average_6", label: "6-month average" },
  { value: "average_12", label: "12-month average" },
  { value: "same_month_last_year", label: "Same month last year" },
  { value: "manual", label: "Manual fixed value" },
];
// "xero_budget" is intentionally omitted — not wired on the backend yet.
const ADJUSTABLE_BASES = new Set([
  "previous_month",
  "average_3",
  "average_6",
  "average_12",
  "same_month_last_year",
]);

const SalesTargetSettings = ({
  companyId,
  currentBasis,
  onClose,
  onSaved,
}: {
  companyId: string;
  currentBasis: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [basis, setBasis] = useState<string>(currentBasis || "average_3");
  const [adjustment, setAdjustment] = useState("0");
  const [manualValue, setManualValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSalesTarget(companyId).then((r) => {
      if (!active) return;
      if (r.ok) {
        setBasis(r.data.basis || currentBasis || "average_3");
        setAdjustment(String(r.data.adjustment_pct ?? 0));
        setManualValue(
          r.data.manual_value != null ? String(r.data.manual_value) : "",
        );
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, currentBasis]);

  const save = async () => {
    if (
      basis === "manual" &&
      (manualValue.trim() === "" || Number.isNaN(Number(manualValue)))
    ) {
      setError("Enter a monthly target value.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateSalesTarget(companyId, {
      basis,
      adjustment_pct: ADJUSTABLE_BASES.has(basis) ? Number(adjustment) || 0 : 0,
      manual_value:
        basis === "manual" ? Number(manualValue) : null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn’t save the target.");
      return;
    }
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-900">Sales target</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          What should the monthly target be based on?
        </label>
        <select
          value={basis}
          disabled={loading || saving}
          onChange={(e) => setBasis(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
        >
          {SALES_BASIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {ADJUSTABLE_BASES.has(basis) && (
          <div className="mt-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Adjustment (%)
            </label>
            <input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              disabled={saving}
              placeholder="0"
              className="mt-1.5 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <p className="mt-1 text-[10px] text-ink-400">
              +10 → target × 1.10 · −10 → target × 0.90
            </p>
          </div>
        )}

        {basis === "manual" && (
          <div className="mt-3">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Monthly target (£)
            </label>
            <input
              type="number"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              disabled={saving}
              placeholder="15000"
              className="mt-1.5 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        )}

        {basis === "none" && (
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            No target will be tracked — the chart line and progress panel stay
            empty.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
            {error}
          </p>
        )}

        <p className="mt-3 text-[10px] text-ink-400">
          Saving recomputes the snapshot (~5s) — the chart updates automatically.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-4 py-1.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save & apply"}
          </button>
        </div>
      </div>
    </div>
  );
};
