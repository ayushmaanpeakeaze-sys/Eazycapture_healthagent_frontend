import { useEffect, useMemo, useState } from "react";

import {
  bulkTrappedAction,
  fetchTrappedInvoices,
  markOkTrapped,
  restoreTrapped,
} from "@/services/audit.service";
import { FlaggedIssue, HealthCheckResult } from "@/types/audit.types";

export type MultiCodeRuleId = "multi_account_supplier" | "multi_tax_code_supplier";

const CONFIG: Record<MultiCodeRuleId, { codeLabel: string; groupLabel: string; empty: string }> = {
  multi_account_supplier: {
    codeLabel: "Account code used",
    groupLabel: "Accounts used",
    empty: "No multi-account suppliers",
  },
  multi_tax_code_supplier: {
    codeLabel: "Tax code used",
    groupLabel: "Tax codes used",
    empty: "No multi-tax-code suppliers",
  },
};

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

const DOC_TYPE_LABEL: Record<string, string> = {
  ACCREC: "Invoice",
  ACCPAY: "Bill",
  RECEIVE: "Money In",
  SPEND: "Money Out",
};
const DOC_TYPE_CLS: Record<string, string> = {
  ACCREC: "bg-emerald-600 text-white",
  ACCPAY: "bg-amber-600 text-white",
  RECEIVE: "bg-sky-600 text-white",
  SPEND: "bg-rose-700 text-white",
};

const flagFor = (r: HealthCheckResult, kind: string): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === kind) ??
  r.result?.flagged?.[0];

const matchesRule = (r: HealthCheckResult, kind: string): boolean =>
  (r.result?.rule_ids ?? []).includes(kind) ||
  (r.result?.flagged ?? []).some((f) => f.issue_type === kind);

interface Group {
  name: string;
  rows: HealthCheckResult[];
}

// A contact coded across several accounts/tax codes, grouped by contact.
export const MultiCodeSuppliersPage = ({
  companyId,
  kind,
  refreshKey = 0,
}: {
  companyId: string;
  kind: MultiCodeRuleId;
  refreshKey?: number;
}) => {
  const cfg = CONFIG[kind];
  const [rows, setRows] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOk, setShowOk] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRemoved(new Set());

    const byKind = (list: HealthCheckResult[]) =>
      list.filter((r) => matchesRule(r, kind));

    const load = async () => {
      if (showOk) {
        // Marked-OK only = (incl. marked-ok) − (currently active).
        const [all, act] = await Promise.all([
          fetchTrappedInvoices({
            company_id: companyId,
            limit: 200,
            include_marked_ok: true,
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
          setRows(byKind((all.results ?? []).filter((r) => !activeIds.has(r.id))));
        }
      } else {
        const d = await fetchTrappedInvoices({ company_id: companyId, limit: 200 });
        if (!active) return;
        if ("error" in d) {
          setError(d.error);
          setRows([]);
        } else {
          setRows(byKind(d.results ?? []));
        }
      }
      if (active) setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [companyId, kind, showOk, refreshKey]);

  const groups = useMemo<Group[]>(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, HealthCheckResult[]>();
    for (const r of rows) {
      if (removed.has(r.id)) continue;
      const name = r.result?.vendor_name || "Contact";
      if (q && !name.toLowerCase().includes(q)) continue;
      (map.get(name) ?? map.set(name, []).get(name)!).push(r);
    }
    return [...map.entries()].map(([name, rs]) => ({ name, rows: rs }));
  }, [rows, removed, search]);

  const drop = (ids: string[]) =>
    setRemoved((p) => {
      const n = new Set(p);
      ids.forEach((id) => n.add(id));
      return n;
    });

  const act = async (
    key: string,
    ids: string[],
    fn: () => Promise<{ ok: boolean; error?: string }>,
    label: string,
  ) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.ok) drop(ids);
    else setError(res.error ?? `${label} failed`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
          <button
            type="button"
            role="switch"
            aria-checked={showOk}
            onClick={() => setShowOk((v) => !v)}
            className={[
              "relative h-5 w-9 rounded-full transition",
              showOk ? "bg-brand-600" : "bg-ink-200",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                showOk ? "left-[18px]" : "left-0.5",
              ].join(" ")}
            />
          </button>
          Show items marked as “OK”
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contact…"
          className="w-56 rounded-lg border border-ink-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading…
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showOk
            ? "Nothing marked as OK."
            : search
              ? "No matches for your search."
              : cfg.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const ids = g.rows.map((r) => r.id);
            // Prefer accounts_used (every code); fall back to per-row codes.
            const codes = (() => {
              const set = new Set<string>();
              for (const r of g.rows) {
                const f = flagFor(r, kind);
                const used =
                  f?.accounts_used ??
                  ([f?.suggested_code, f?.current_code].filter(
                    Boolean,
                  ) as string[]);
                used.forEach((c) => c && set.add(c));
              }
              return [...set];
            })();
            const groupKey = `g:${g.name}`;
            const groupBusy = busy === groupKey;
            return (
              <section
                key={g.name}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card"
              >
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
                  <span className="text-sm font-semibold text-ink-900">{g.name}</span>
                  <span className="text-[11px] text-ink-400">
                    {cfg.groupLabel}: {codes.join(", ") || "—"}
                  </span>
                  <button
                    type="button"
                    disabled={groupBusy}
                    onClick={() =>
                      showOk
                        ? act(groupKey, ids, () => bulkTrappedAction(companyId, ids, "restore"), "Restore")
                        : act(groupKey, ids, () => bulkTrappedAction(companyId, ids, "mark_ok"), "Mark OK")
                    }
                    className="ml-auto rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
                  >
                    {groupBusy
                      ? "…"
                      : showOk
                        ? "Mark all as Not OK"
                        : 'Mark all items as "OK"'}
                  </button>
                </header>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <tbody className="divide-y divide-ink-50">
                      {g.rows.map((r) => {
                        const res = r.result;
                        const f = flagFor(r, kind);
                        const codeName = f?.current_name || f?.suggested_name;
                        const rowBusy = busy === r.id;
                        return (
                          <tr key={r.id} className="align-middle hover:bg-brand-50/20">
                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  DOC_TYPE_CLS[r.document_type] ?? "bg-ink-500 text-white",
                                ].join(" ")}
                              >
                                {DOC_TYPE_LABEL[r.document_type] ?? r.document_type}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-[11px] text-ink-500">
                              {shortDate(res?.invoice_date)}
                            </td>
                            <td className="px-2 py-3 text-[11px] text-ink-500">
                              {res?.invoice_number || res?.reference || "—"}
                            </td>
                            <td className="px-2 py-3 font-semibold tabular-nums text-ink-900">
                              {money(res?.amount, res?.currency_code)}
                            </td>
                            <td className="px-2 py-3" title={f?.message ?? undefined}>
                              <p className="font-medium text-ink-800">
                                {f?.current_code || "—"}
                                {codeName ? ` – ${codeName}` : ""}
                              </p>
                              {f?.suggested_code &&
                                f.suggested_code !== f.current_code && (
                                  <p className="text-[11px] font-medium text-emerald-600">
                                    usually {f.suggested_code}
                                  </p>
                                )}
                              {res?.details && (
                                <p className="text-[11px] text-ink-400">{res.details}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {showOk ? (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      act(r.id, [r.id], () => restoreTrapped(companyId, r.id), "Restore")
                                    }
                                    className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
                                  >
                                    {rowBusy ? "…" : 'Mark as "Not OK"'}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      act(r.id, [r.id], () => markOkTrapped(companyId, r.id), "Mark OK")
                                    }
                                    className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                  >
                                    {rowBusy ? "…" : 'Mark as "OK"'}
                                  </button>
                                )}
                                {r.xero_url && (
                                  <a
                                    href={r.xero_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                                  >
                                    View / Edit
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
