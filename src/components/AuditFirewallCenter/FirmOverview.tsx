import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchFirmSummary,
  InsightsResult,
} from "../../services/insights.service";
import {
  FirmSummaryClient,
  FirmSummaryResponse,
} from "../../types/insights.types";

const gbp = (n: number | null | undefined, dp = 0): string =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
      }).format(n);

const relativeTime = (iso: string | null | undefined): string => {
  if (!iso) return "Never";
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

const shortDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
};

type SortKey =
  | "name"
  | "net_profit"
  | "working_capital"
  | "cash_coverage"
  | "unreconciled_bank_items"
  | "last_bank_reconciled"
  | "most_recent_transaction"
  | "computed_at";

const DATE_KEYS: SortKey[] = [
  "computed_at",
  "last_bank_reconciled",
  "most_recent_transaction",
];

export const FirmOverview = () => {
  const navigate = useNavigate();
  const [res, setRes] = useState<InsightsResult<FirmSummaryResponse> | null>(
    null,
  );
  const [search, setSearch] = useState("");
  // Triage default: lowest cash coverage first.
  const [sortKey, setSortKey] = useState<SortKey>("cash_coverage");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    let active = true;
    setRes(null);
    fetchFirmSummary().then((r) => active && setRes(r));
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    if (!res?.ok) return [];
    const q = search.trim().toLowerCase();
    const list = res.data.clients.filter(
      (c) => !q || c.name.toLowerCase().includes(q),
    );
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (DATE_KEYS.includes(sortKey)) {
        const ad = a[sortKey] as string | null;
        const bd = b[sortKey] as string | null;
        if (ad == null && bd == null) return 0;
        if (ad == null) return 1;
        if (bd == null) return -1;
        return (new Date(ad).getTime() - new Date(bd).getTime()) * dir;
      }
      const av = a[sortKey] as number | null;
      const bv = b[sortKey] as number | null;
      // nulls always last regardless of direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [res, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "asc");
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-500">
          Firm overview
        </p>
        <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-ink-900">
          Your firm, triaged.
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Financial health across every client — sort by what needs attention
          first. Click a row for the full insights.
        </p>
      </header>

      {!res ? (
        <SummarySkeleton />
      ) : !res.ok ? (
        <div className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-600 shadow-card">
          {res.error}
        </div>
      ) : (
        <>
          <SummaryTiles data={res.data} />

          <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
              <div className="relative max-w-xs flex-1">
                <svg
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search client"
                  className="w-full rounded-lg border border-ink-200 bg-white py-1.5 pl-9 pr-3 text-sm text-ink-900 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <span className="shrink-0 text-xs text-ink-400">
                {rows.length} client{rows.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    <Th
                      label="Client"
                      k="name"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <Th
                      label="Net profit"
                      k="net_profit"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      right
                    />
                    <Th
                      label="Working capital"
                      k="working_capital"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      right
                    />
                    <Th
                      label="Cash coverage"
                      k="cash_coverage"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      right
                    />
                    <th className="px-4 py-2.5">DLA</th>
                    <Th
                      label="Unrec. bank"
                      k="unreconciled_bank_items"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      right
                    />
                    <Th
                      label="Last reconciled"
                      k="last_bank_reconciled"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      right
                    />
                    <Th
                      label="Recent txn"
                      k="most_recent_transaction"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      right
                    />
                    <Th
                      label="Updated"
                      k="computed_at"
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={toggleSort}
                      right
                    />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-sm italic text-ink-400"
                      >
                        No clients match.
                      </td>
                    </tr>
                  ) : (
                    rows.map((c) => (
                      <ClientRow
                        key={c.company_id}
                        c={c}
                        onOpen={() =>
                          navigate(`/clients/${c.company_id}/insights`)
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

// ── Summary tiles ──────────────────────────────────────────────────────────

const SummaryTiles = ({ data }: { data: FirmSummaryResponse }) => {
  const t = data.totals;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Total clients" value={t.total_clients} />
      <Tile
        label="Data synced"
        value={`${t.with_snapshot}/${t.total_clients}`}
        muted
      />
      <Tile label="In profit" value={t.in_profit} tone="emerald" />
      <Tile label="In loss" value={t.in_loss} tone={t.in_loss > 0 ? "rose" : "ink"} />
      <Tile
        label="Cash tight"
        value={t.cash_tight}
        tone={t.cash_tight > 0 ? "amber" : "ink"}
      />
      <Tile
        label="Working cap −ve"
        value={t.working_capital_negative}
        tone={t.working_capital_negative > 0 ? "amber" : "ink"}
      />
      <Tile
        label="DLA overdrawn"
        value={t.dla_overdrawn}
        tone={t.dla_overdrawn > 0 ? "rose" : "ink"}
      />
      <Tile
        label="Unreconciled items"
        value={t.unreconciled_bank_items}
        tone={t.unreconciled_bank_items > 0 ? "amber" : "ink"}
      />
    </div>
  );
};

const Tile = ({
  label,
  value,
  tone = "ink",
  muted,
}: {
  label: string;
  value: number | string;
  tone?: "ink" | "emerald" | "rose" | "amber";
  muted?: boolean;
}) => {
  const cls =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : tone === "amber"
          ? "text-amber-600"
          : muted
            ? "text-ink-500"
            : "text-ink-900";
  return (
    <div className="rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </p>
      <p
        className={[
          "mt-1 font-display text-2xl font-semibold leading-none tabular-nums tracking-tight",
          cls,
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
};

// ── Table bits ───────────────────────────────────────────────────────────

const Th = ({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  right,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  right?: boolean;
}) => {
  const active = sortKey === k;
  return (
    <th className={["px-4 py-2.5", right ? "text-right" : ""].join(" ")}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={[
          "inline-flex items-center gap-1 transition hover:text-ink-700",
          right ? "flex-row-reverse" : "",
          active ? "text-brand-600" : "",
        ].join(" ")}
      >
        {label}
        <span className="text-[8px]">
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
};

const ClientRow = ({
  c,
  onOpen,
}: {
  c: FirmSummaryClient;
  onOpen: () => void;
}) => {
  const noData = c.net_profit == null && c.working_capital == null;
  const covPct = c.cash_coverage == null ? null : Math.round(c.cash_coverage * 100);
  const covTone =
    covPct == null
      ? "text-ink-400"
      : covPct < 20
        ? "text-rose-600"
        : covPct < 50
          ? "text-amber-600"
          : "text-ink-700";
  return (
    <tr
      onClick={onOpen}
      className={[
        "cursor-pointer border-b border-ink-50 transition hover:bg-brand-50/40",
        noData ? "opacity-60" : "",
      ].join(" ")}
    >
      <td className="px-4 py-3">
        <span className="font-medium text-ink-900">{c.name}</span>
        {noData && (
          <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-400">
            no snapshot
          </span>
        )}
      </td>
      <td
        className={[
          "px-4 py-3 text-right tabular-nums font-medium",
          c.net_profit == null
            ? "text-ink-400"
            : c.net_profit < 0
              ? "text-rose-600"
              : "text-emerald-600",
        ].join(" ")}
      >
        {gbp(c.net_profit)}
      </td>
      <td
        className={[
          "px-4 py-3 text-right tabular-nums",
          c.working_capital != null && c.working_capital < 0
            ? "text-rose-600"
            : "text-ink-700",
        ].join(" ")}
      >
        {gbp(c.working_capital)}
      </td>
      <td className={["px-4 py-3 text-right tabular-nums", covTone].join(" ")}>
        {covPct == null ? "—" : `${covPct}%`}
      </td>
      <td className="px-4 py-3">
        {c.dla_overdrawn ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
            Overdrawn
          </span>
        ) : (
          <span className="text-ink-300">—</span>
        )}
      </td>
      <td
        className={[
          "px-4 py-3 text-right tabular-nums",
          c.unreconciled_bank_items != null && c.unreconciled_bank_items > 0
            ? "font-semibold text-amber-600"
            : "text-ink-700",
        ].join(" ")}
      >
        {c.unreconciled_bank_items ?? "—"}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-500">
        {shortDate(c.last_bank_reconciled)}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-500">
        {shortDate(c.most_recent_transaction)}
      </td>
      <td className="px-4 py-3 text-right text-xs text-ink-500">
        {relativeTime(c.computed_at)}
      </td>
    </tr>
  );
};

const SummarySkeleton = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[68px] animate-pulse rounded-xl border border-ink-100 bg-white shadow-card"
        />
      ))}
    </div>
    <div className="h-72 animate-pulse rounded-2xl border border-ink-100 bg-white shadow-card" />
  </div>
);
