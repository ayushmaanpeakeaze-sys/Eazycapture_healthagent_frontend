import { useEffect, useState } from "react";

import { fetchPrepaymentSchedule } from "@/services/audit.service";
import { PrepaymentScheduleResponse } from "@/types/audit.types";

const money = (v: string | number | null | undefined, cur = "GBP") => {
  if (v == null || v === "") return "";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n as number);
};

const shortDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const PrepaymentSchedulePage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const [data, setData] = useState<PrepaymentScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchPrepaymentSchedule(companyId)
      .then((res) => {
        if (!active) return;
        if ("error" in res) {
          setError(res.error);
          setData(null);
        } else {
          setData(res);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, refreshKey]);

  if (loading) {
    return (
      <p className="rounded-2xl border border-ink-100 bg-surface px-5 py-10 text-center text-sm text-ink-500 shadow-card">
        Loading…
      </p>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const { columns, rows, column_totals, total_balance, validation } = data;

  if (!data.prepayment_accounts || data.prepayment_accounts.length === 0) {
    return (
      <p className="rounded-2xl border border-ink-100 bg-surface px-5 py-10 text-center text-sm text-ink-500 shadow-card">
        This organisation has no account typed or named{" "}
        <span className="font-medium text-ink-700">Prepayments</span>. Add one in Xero
        to build the schedule.
      </p>
    );
  }

  if (data.item_count === 0) {
    return (
      <div className="space-y-3">
        <ScheduleHeader data={data} />
        <p className="rounded-2xl border border-ink-100 bg-surface px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          No items in the Prepayments account for this year.
        </p>
      </div>
    );
  }

  const estimated = validation.ledger_source === "posted_amounts";

  return (
    <div className="space-y-4">
      <ScheduleHeader data={data} />

      <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-surface shadow-card">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              <th className="whitespace-nowrap px-3 py-2.5">Date</th>
              <th className="whitespace-nowrap px-2 py-2.5">Invoice no.</th>
              <th className="whitespace-nowrap px-2 py-2.5">Supplier</th>
              <th className="min-w-[180px] px-2 py-2.5">Description</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right">Amount</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right">Months</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right">Per month</th>
              <th className="whitespace-nowrap px-2 py-2.5">Account</th>
              {columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-2 py-2.5 text-right">
                  {c}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {rows.map((r, ri) => (
              <tr key={`${r.invoice_no}-${ri}`} className="align-top hover:bg-brand-50/20">
                <td className="whitespace-nowrap px-3 py-2 text-ink-700">
                  {shortDate(r.date)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-ink-600">
                  {r.invoice_no || "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 font-medium text-ink-900">
                  {r.supplier || "—"}
                </td>
                <td className="px-2 py-2 text-ink-600">{r.description || "—"}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-ink-900">
                  {money(r.amount)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-600">
                  {r.total_months ?? "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-ink-600">
                  {r.monthly ? money(r.monthly) : "—"}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-ink-600">
                  {r.account_code}
                  <span className="block text-[10px] text-ink-400">{r.account_name}</span>
                </td>
                {r.unscheduled ? (
                  <td
                    colSpan={columns.length}
                    className="px-2 py-2 text-center text-[11px] italic text-amber-600"
                  >
                    Unscheduled — add a period to the description to amortise
                  </td>
                ) : (
                  r.cells.map((cell, ci) => (
                    <td
                      key={ci}
                      className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-ink-700"
                    >
                      {cell == null ? "" : money(cell)}
                    </td>
                  ))
                )}
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-ink-900">
                  {money(r.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink-200 bg-ink-50/50 font-semibold">
              <td
                colSpan={8}
                className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wider text-ink-500"
              >
                Total
              </td>
              {column_totals.map((t, i) => (
                <td
                  key={i}
                  className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-ink-800"
                >
                  {money(t)}
                </td>
              ))}
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-ink-900">
                {money(total_balance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="max-w-md rounded-2xl border border-ink-100 bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Reconciliation
          </p>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
              validation.reconciled
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-amber-50 text-amber-700 ring-amber-200",
            ].join(" ")}
          >
            {validation.reconciled ? "Reconciled ✓" : "Out by " + money(validation.difference)}
          </span>
        </div>
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-500">Schedule balance</dt>
            <dd className="tabular-nums font-medium text-ink-800">
              {money(validation.schedule_balance)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-500">
              Xero balance
              <span className="ml-1 text-[11px] text-ink-400">
                {estimated ? "(estimated from postings)" : "(Prepayments account)"}
              </span>
            </dt>
            <dd className="tabular-nums font-medium text-ink-800">
              {money(validation.ledger_balance)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-ink-100 pt-1.5">
            <dt className="text-ink-500">Difference</dt>
            <dd
              className={[
                "tabular-nums font-semibold",
                validation.reconciled ? "text-emerald-700" : "text-amber-700",
              ].join(" ")}
            >
              {money(validation.difference)}
            </dd>
          </div>
        </dl>
        {estimated && (
          <p className="mt-2 text-[11px] italic text-ink-400">
            Xero isn’t connected for the trial balance — this figure is estimated from
            postings, so treat the reconciliation as indicative.
          </p>
        )}
        {!validation.reconciled && !estimated && (
          <p className="mt-2 text-[11px] text-amber-600">
            A gap usually means a monthly release was never booked, or a journal / opening
            balance sits in the account that isn’t a bill.
          </p>
        )}
      </div>

      <p className="text-[11px] italic text-ink-400">
        Straight-line working paper — review only, nothing is posted. Confirm and post the
        month-end release in Xero.
      </p>
    </div>
  );
};

const ScheduleHeader = ({ data }: { data: PrepaymentScheduleResponse }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
    <span>
      As at{" "}
      <span className="font-semibold text-ink-800">{shortDate(data.year_end)}</span> ·{" "}
      {data.item_count} item{data.item_count === 1 ? "" : "s"} in Prepayments
      {data.prepayment_accounts.length > 0 && (
        <span className="text-ink-400"> ({data.prepayment_accounts.join(", ")})</span>
      )}
    </span>
  </div>
);
