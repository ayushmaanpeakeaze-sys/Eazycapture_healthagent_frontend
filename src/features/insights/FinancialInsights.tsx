import { useEffect, useRef, useState } from "react";

import {
  fetchClientInsights,
  InsightsResult,
  refreshClientInsights,
} from "../../services/insights.service";
import { ClientInsightsSnapshot } from "../../types/insights.types";
import { BankReconciliationCard } from "./cards/BankReconciliationCard";
import { BookkeepingHealthCard } from "./cards/BookkeepingHealthCard";
import { BusinessValuationCard } from "./cards/BusinessValuationCard";
import { CashHealthCard } from "./cards/CashHealthCard";
import { CorporationTaxCard } from "./cards/CorporationTaxCard";
import { DirectorsLoansCard } from "./cards/DirectorsLoansCard";
import { DividendCard } from "./cards/DividendCard";
import { ProfitabilityCard } from "./cards/ProfitabilityCard";
import { SalesTrackerCard } from "./cards/SalesTrackerCard";
import { WorkingCapitalCard } from "./cards/WorkingCapitalCard";
import { CardBoundary } from "./components/CardBoundary";
import { formatAsOf, relativeTime } from "./lib/format";

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
    for (let i = 0; i < 12; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      if (!mounted.current) return;
      const r = await fetchClientInsights(companyId);
      if (!mounted.current) return;
      setSnap(r);
      if (!r.ok) continue;
      if (typeof r.data.refreshing === "boolean") {
        if (!r.data.refreshing) break;
      } else if (r.data.status === "ok" && r.data.computed_at !== before) {
        break;
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
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        companyId={companyId}
        onRefresh={refresh}
      />
    </section>
  );
};

const InsightsBody = ({
  snap,
  refreshing,
  asOf,
  companyId,
  onRefresh,
}: {
  snap: InsightsResult<ClientInsightsSnapshot> | null;
  refreshing: boolean;
  asOf: string;
  companyId: string;
  onRefresh: () => void;
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
        <CardBoundary>
          <SalesTrackerCard
            data={payload.sales_tracker}
            companyId={companyId}
            onRefresh={onRefresh}
          />
        </CardBoundary>
        <CardBoundary>
          <CashHealthCard
            data={payload.cash_health_check}
            fallback={payload.financial_position}
            companyId={companyId}
            onRefresh={onRefresh}
          />
        </CardBoundary>
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

const Skeleton = () => (
  <div className="h-64 animate-pulse rounded-2xl border border-ink-100 bg-surface shadow-card" />
);

const GridSkeleton = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} />
    ))}
  </div>
);

const ErrorBox = ({ message }: { message: string }) => (
  <section className="rounded-2xl border border-ink-100 bg-surface p-6 shadow-card">
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
  <section className="rounded-2xl border border-ink-100 bg-surface p-8 text-center shadow-card">
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
