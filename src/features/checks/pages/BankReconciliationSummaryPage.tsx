import { useEffect, useState } from "react";

import { fetchBankReconciliationSummary } from "@/services/audit.service";
import {
  BankReconAccount,
  BankReconciliationSummaryResponse,
} from "@/types/audit.types";

// Signed GBP, 2dp. Negative → "-£1,234.56".
const money = (n: number | null | undefined): string => {
  const v = Number(n) || 0;
  return `${v < 0 ? "-" : ""}£${Math.abs(v).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const Figure = ({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string;
  tone?: "ink" | "rose";
}) => (
  <div className="px-4 py-3">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
      {label}
    </p>
    <p
      className={[
        "mt-0.5 text-sm font-semibold tabular-nums",
        tone === "rose" ? "text-rose-600" : "text-ink-900",
      ].join(" ")}
    >
      {value}
    </p>
  </div>
);

const AccountCard = ({ a }: { a: BankReconAccount }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-brand-700">
            {a.account_name}
            {a.account_code && (
              <span className="ml-1 font-normal text-ink-400">
                ({a.account_code})
              </span>
            )}
          </h3>
        </div>
        {a.needs_reconciliation && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
            Needs reconciliation
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {a.lines.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              {open ? "Hide details" : `View details (${a.unreconciled_count})`}
            </button>
          )}
          {a.process_url && (
            <a
              href={a.process_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Process
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
              </svg>
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 divide-x divide-y divide-ink-100 border-t border-ink-100 sm:grid-cols-4 sm:divide-y-0">
        <Figure label="Balance in Xero" value={money(a.balance_in_xero)} />
        <Figure
          label="Statement Balance (calculated)"
          value={money(a.statement_balance_calculated)}
        />
        <Figure
          label="Difference"
          value={money(a.unreconciled_lines_total)}
          tone={a.needs_reconciliation ? "rose" : "ink"}
        />
        <Figure
          label="Unreconciled items"
          value={String(a.unreconciled_count)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400">
        <span title="Needs Xero's gated Finance API">
          Imported statement balance:{" "}
          <span className="italic">Not available</span>
        </span>
        <span className="tabular-nums">
          Received {money(a.unreconciled_received)} · Spent{" "}
          {money(a.unreconciled_spent)}
        </span>
      </div>

      {open && a.lines.length > 0 && (
        <div className="border-t border-ink-100 bg-ink-50/40 px-4 py-3">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="py-1 pr-3 font-semibold">Date</th>
                <th className="py-1 pr-3 font-semibold">Contact</th>
                <th className="py-1 pr-3 font-semibold">Type</th>
                <th className="py-1 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {a.lines.map((l, i) => (
                <tr key={`${l.date}-${i}`}>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-600">
                    {fmtDate(l.date)}
                  </td>
                  <td className="py-1.5 pr-3 text-ink-800">{l.contact}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={[
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        l.type === "Received"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      ].join(" ")}
                    >
                      {l.type}
                    </span>
                  </td>
                  <td
                    className={[
                      "py-1.5 text-right font-semibold tabular-nums",
                      l.amount >= 0 ? "text-emerald-700" : "text-rose-700",
                    ].join(" ")}
                  >
                    {l.amount >= 0 ? "+" : ""}
                    {money(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export const BankReconciliationSummaryPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const [data, setData] = useState<BankReconciliationSummaryResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchBankReconciliationSummary(companyId, showAll).then((d) => {
      if (!active) return;
      if (!d) setError("Couldn’t load the bank reconciliation summary.");
      setData(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, refreshKey, showAll]);

  const accounts = data?.accounts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!loading && data && (
          <span className="text-xs text-ink-500">
            {accounts.length} account{accounts.length === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-ink-800">
              {data.total_unreconciled_count} unreconciled item
              {data.total_unreconciled_count === 1 ? "" : "s"}
            </span>
          </span>
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-600">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-ink-300 text-brand-500 focus:ring-brand-300"
          />
          Show all bank accounts
        </label>
      </div>

      <p className="text-[11px] text-ink-400">
        Balance in Xero vs the statement balance Xero calculates from
        unreconciled lines — the difference is still to reconcile. Matches Xero’s
        own report; no manual entry needed.
      </p>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading…
        </p>
      ) : accounts.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showAll
            ? "No bank accounts found."
            : "All bank accounts reconciled ✓"}
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <AccountCard key={a.account_id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
};
