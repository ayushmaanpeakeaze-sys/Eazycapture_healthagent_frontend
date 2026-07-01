import { useEffect, useMemo, useState } from "react";

import {
  bulkTrappedAction,
  fetchTrappedInvoices,
} from "@/services/audit.service";
import { FlaggedIssue, HealthCheckResult } from "@/types/audit.types";
import { TablePager, useClientPagination } from "@/features/checks/paginate";

const RULE = "inactive_contact";

const flagFor = (r: HealthCheckResult): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === RULE) ??
  r.result?.flagged?.[0];

const matchesRule = (r: HealthCheckResult): boolean =>
  (r.result?.rule_ids ?? []).includes(RULE) ||
  (r.result?.flagged ?? []).some((f) => f.issue_type === RULE);

// null last_activity_date → never used.
const recentTxn = (r: HealthCheckResult): string => {
  const raw = flagFor(r)?.last_activity_date;
  if (!raw) return "Never";
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const ageText = (r: HealthCheckResult): string => {
  const a = flagFor(r)?.age_days;
  return a == null ? "Never" : `${a} days`;
};

// Contacts with no recent activity.
export const InactiveContactsPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
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

    const byRule = (list: HealthCheckResult[]) => list.filter(matchesRule);

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
  }, [companyId, showDismissed, refreshKey]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !removed.has(r.id))
      .filter((r) =>
        !q ? true : (r.result?.vendor_name || "").toLowerCase().includes(q),
      );
  }, [rows, removed, search]);

  const pg = useClientPagination(visible, `${search}|${showDismissed}`);

  const drop = (ids: string[]) =>
    setRemoved((p) => {
      const n = new Set(p);
      ids.forEach((id) => n.add(id));
      return n;
    });

  const onDismiss = async (r: HealthCheckResult) => {
    setBusyKey(r.id);
    const res = await bulkTrappedAction(companyId, [r.id], "dismiss");
    setBusyKey(null);
    if (res.ok) drop([r.id]);
    else setError(res.error ?? "Dismiss failed");
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
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="w-56 rounded-lg border border-ink-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
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
            ? "No dismissed contacts."
            : search
              ? "No matches for your search."
              : "No inactive contacts"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[640px] text-sm">
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
                <th className="w-10 px-2 py-2.5">#</th>
                <th className="px-2 py-2.5">Contact name</th>
                <th className="px-2 py-2.5">Most recent transaction</th>
                <th className="px-2 py-2.5">Age</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {pg.paged.map((r, i) => {
                const busy = busyKey === r.id;
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
                    <td className="px-2 py-3 text-ink-400">{i + 1}</td>
                    <td className="px-2 py-3 font-medium text-ink-900">
                      {r.result?.vendor_name || "—"}
                    </td>
                    <td className="px-2 py-3 text-ink-500">{recentTxn(r)}</td>
                    <td className="px-2 py-3 text-ink-500">{ageText(r)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {r.xero_url && (
                          <>
                            <a
                              href={r.xero_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                            >
                              View
                            </a>
                            <a
                              href={r.xero_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Archive this contact in Xero"
                              className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                            >
                              Archive in Xero
                            </a>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onDismiss(r)}
                          disabled={busy}
                          className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
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
