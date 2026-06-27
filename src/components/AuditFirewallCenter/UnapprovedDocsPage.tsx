import { useEffect, useMemo, useState } from "react";

import {
  approveTrapped,
  bulkTrappedAction,
  deleteTrapped,
  fetchTrappedInvoices,
} from "../../services/audit.service";
import { FlaggedIssue, HealthCheckResult } from "../../types/audit.types";
import { TablePager, useClientPagination } from "./paginate";

const money = (amt: number | string | null | undefined, cur?: string | null) => {
  const n = typeof amt === "string" ? parseFloat(amt) : (amt ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: cur || "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
};

const shortDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
};

export type UnapprovedRuleId = "unapproved_invoice" | "unapproved_bill";

const flagFor = (r: HealthCheckResult, ruleId: string): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === ruleId) ??
  r.result?.flagged?.[0];

const matchesRule = (r: HealthCheckResult, ruleId: string): boolean =>
  (r.result?.rule_ids ?? []).includes(ruleId) ||
  (r.result?.flagged ?? []).some((f) => f.issue_type === ruleId);

// Unapproved Invoices / Bills — draft/submitted docs not yet in the accounts.
// Approve / Delete / Ignore / Dismiss.
export const UnapprovedDocsPage = ({
  companyId,
  ruleId,
  refreshKey = 0,
}: {
  companyId: string;
  ruleId: UnapprovedRuleId;
  refreshKey?: number;
}) => {
  const [rows, setRows] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRemoved(new Set());
    setSelected(new Set());

    const byRule = (list: HealthCheckResult[]) =>
      list.filter((r) => matchesRule(r, ruleId));

    const load = async () => {
      if (showDismissed) {
        const [all, act] = await Promise.all([
          fetchTrappedInvoices({
            company_id: companyId,
            limit: 200,
            include_dismissed: true,
          }),
          fetchTrappedInvoices({ company_id: companyId, limit: 200 }),
        ]);
        if (!active) return;
        if ("error" in all) {
          setError(all.error);
          setRows([]);
        } else {
          const activeIds = new Set(
            "error" in act ? [] : (act.results ?? []).map((r) => r.id),
          );
          setRows(byRule((all.results ?? []).filter((r) => !activeIds.has(r.id))));
        }
      } else {
        const d = await fetchTrappedInvoices({ company_id: companyId, limit: 200 });
        if (!active) return;
        if ("error" in d) {
          setError(d.error);
          setRows([]);
        } else {
          setRows(byRule(d.results ?? []));
        }
      }
      if (active) setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [companyId, ruleId, showDismissed, refreshKey]);

  const noun = ruleId === "unapproved_bill" ? "bill" : "invoice";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !removed.has(r.id))
      .filter((r) => {
        if (!q) return true;
        const res = r.result;
        return [res?.vendor_name, res?.invoice_number, res?.details].some((v) =>
          (v || "").toString().toLowerCase().includes(q),
        );
      });
  }, [rows, removed, search]);

  const pg = useClientPagination(visible, `${search}|${showDismissed}`);

  // "Total potential errors" — sum of the visible docs' values.
  const total = useMemo(
    () =>
      visible.reduce((sum, r) => sum + (Number(r.result?.amount) || 0), 0),
    [visible],
  );
  const currency = visible[0]?.result?.currency_code ?? "GBP";

  const drop = (ids: string[]) =>
    setRemoved((p) => {
      const n = new Set(p);
      ids.forEach((id) => n.add(id));
      return n;
    });

  const run = async (
    r: HealthCheckResult,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    label: string,
  ) => {
    setBusyKey(r.id);
    const res = await fn();
    setBusyKey(null);
    if (res.ok) drop([r.id]);
    else setError(res.error ?? `${label} failed`);
  };

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = pg.paged.length > 0 && pg.paged.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pg.paged.map((r) => r.id)));

  const bulkDismiss = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    const res = await bulkTrappedAction(companyId, ids, "dismiss");
    setBulkBusy(false);
    if (res.ok) {
      drop(ids);
      setSelected(new Set());
    } else setError(res.error ?? "Bulk dismiss failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
          <button
            type="button"
            role="switch"
            aria-checked={showDismissed}
            onClick={() => setShowDismissed((v) => !v)}
            className={[
              "relative h-5 w-9 rounded-full transition",
              showDismissed ? "bg-brand-600" : "bg-ink-200",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                showDismissed ? "left-[18px]" : "left-0.5",
              ].join(" ")}
            />
          </button>
          Show dismissed items
        </label>
        <div className="flex items-center gap-3">
          {!loading && visible.length > 0 && (
            <span className="text-xs text-ink-500">
              Total potential errors:{" "}
              <span className="font-semibold text-ink-800">
                {money(total, currency)}
              </span>
            </span>
          )}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${noun}s…`}
            className="w-56 rounded-lg border border-ink-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs">
          <span className="font-semibold text-brand-700">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={bulkDismiss}
            className="rounded-md border border-ink-200 bg-white px-2.5 py-1 font-semibold text-ink-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-md px-2 py-1 font-medium text-ink-500 hover:text-ink-800"
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showDismissed
            ? "No dismissed items."
            : search
              ? "No matches for your search."
              : `No unapproved ${noun}s 🎉`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-brand-600"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-2 py-2.5">Contact</th>
                <th className="px-2 py-2.5">Date</th>
                <th className="px-2 py-2.5">Status</th>
                <th className="px-2 py-2.5">{noun === "bill" ? "Bill" : "Invoice"} ref</th>
                <th className="px-2 py-2.5">Details</th>
                <th className="px-2 py-2.5">Total</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {pg.paged.map((r) => {
                const res = r.result;
                const f = flagFor(r, ruleId);
                const status = (res?.invoice_status || "").toUpperCase();
                const canApprove = res?.editable !== false;
                const busy = busyKey === r.id;
                // Deep link: xero_url, else xero_reference when it's a URL.
                const editUrl =
                  r.xero_url ||
                  (res?.xero_reference?.startsWith("http")
                    ? res.xero_reference
                    : null);
                return (
                  <tr key={r.id} className="align-middle transition hover:bg-brand-50/20">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-3.5 w-3.5 accent-brand-600"
                        aria-label="Select row"
                      />
                    </td>
                    <td className="px-2 py-3 font-medium text-ink-900">
                      {res?.vendor_name || "—"}
                    </td>
                    <td className="px-2 py-3 text-ink-600">{shortDate(res?.invoice_date)}</td>
                    <td className="px-2 py-3">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          status === "SUBMITTED"
                            ? "bg-sky-50 text-sky-700"
                            : "bg-amber-50 text-amber-700",
                        ].join(" ")}
                      >
                        {status || "DRAFT"}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-ink-600">{res?.invoice_number || "—"}</td>
                    <td className="max-w-[220px] px-2 py-3 text-[12px] text-ink-500">
                      <span className="line-clamp-2">{res?.details || f?.message || "—"}</span>
                    </td>
                    <td className="px-2 py-3 font-semibold tabular-nums text-ink-900">
                      {money(res?.amount, res?.currency_code)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {editUrl && (
                          <a
                            href={editUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                          >
                            View / Edit
                          </a>
                        )}
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() => run(r, () => approveTrapped(companyId, r.id), "Approve")}
                            disabled={busy}
                            className="rounded-md bg-brand-gradient px-2.5 py-1 text-xs font-semibold text-white shadow-brand transition hover:brightness-110 disabled:opacity-60"
                          >
                            {busy ? "…" : "Approve"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => run(r, () => deleteTrapped(companyId, r.id), "Delete")}
                          disabled={busy}
                          className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            run(r, () => bulkTrappedAction(companyId, [r.id], "snooze", { days: 30 }), "Snooze")
                          }
                          disabled={busy}
                          className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
                        >
                          Ignore 30d
                        </button>
                        <button
                          type="button"
                          onClick={() => run(r, () => bulkTrappedAction(companyId, [r.id], "dismiss"), "Dismiss")}
                          disabled={busy}
                          className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePager page={pg.page} setPage={pg.setPage} limit={pg.limit} setLimit={pg.setLimit} total={pg.total} />
        </div>
      )}
    </div>
  );
};
