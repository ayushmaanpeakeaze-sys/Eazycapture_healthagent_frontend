import { useEffect, useMemo, useState } from "react";

import {
  applyCodingFix,
  bulkTrappedAction,
  fetchCodingOptions,
  fetchTrappedInvoices,
} from "../../services/audit.service";
import {
  CodingOptions,
  FlaggedIssue,
  HealthCheckResult,
} from "../../types/audit.types";
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
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
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

// Xenon-style colour per document type.
const DOC_TYPE_CLS: Record<string, string> = {
  ACCREC: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ACCPAY: "bg-amber-50 text-amber-700 ring-amber-200",
  RECEIVE: "bg-sky-50 text-sky-700 ring-sky-200",
  SPEND: "bg-rose-50 text-rose-700 ring-rose-200",
};

// Paid / Unpaid from payment_status (fallback to invoice_status / amount_due).
const paidLabel = (r: HealthCheckResult): "Paid" | "Unpaid" | null => {
  const ps = (r.result?.payment_status || "").toLowerCase();
  if (ps === "paid") return "Paid";
  if (ps === "unpaid") return "Unpaid";
  if ((r.result?.invoice_status || "").toUpperCase() === "PAID") return "Paid";
  const due = r.result?.amount_due;
  if (due != null) return Number(due) === 0 ? "Paid" : "Unpaid";
  return null;
};

// "?" tooltip for read-only rows — why it can't be edited in-app.
const reasonText = (reason?: string | null): string => {
  switch (reason) {
    case "reconciled":
      return "Bank item reconciled — edit in Xero";
    case "payment_allocated":
      return "Payment allocated — edit in Xero";
    case "payment_or_credit_allocated":
      return "Payment / credit note allocated — edit in Xero";
    default:
      return "Locked — edit in Xero";
  }
};

export type UnexpectedRuleId = "unexpected_account" | "unexpected_tax_code";

const flagFor = (r: HealthCheckResult, ruleId: string): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === ruleId) ??
  r.result?.flagged?.[0];

const matchesRule = (r: HealthCheckResult, ruleId: string): boolean =>
  (r.result?.rule_ids ?? []).includes(ruleId) ||
  (r.result?.flagged ?? []).some((f) => f.issue_type === ruleId);

interface Opt {
  code: string;
  name: string;
}

// Unexpected Account / Tax Code — table with the editable "Change To" picker
// (Save) vs read-only "Edit in Xero", plus View / Dismiss / bulk / search.
export const UnexpectedCodingPage = ({
  companyId,
  ruleId,
  refreshKey = 0,
}: {
  companyId: string;
  ruleId: UnexpectedRuleId;
  refreshKey?: number;
}) => {
  const isTax = ruleId === "unexpected_tax_code";
  const [rows, setRows] = useState<HealthCheckResult[]>([]);
  const [options, setOptions] = useState<CodingOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  // "Change To" pick: default (= suggested) vs a custom account from the dropdown.
  const [mode, setMode] = useState<Record<string, "default" | "custom">>({});
  const [customCode, setCustomCode] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Coding options — loaded once per company, cached.
  useEffect(() => {
    let active = true;
    fetchCodingOptions(companyId).then((o) => active && setOptions(o));
    return () => {
      active = false;
    };
  }, [companyId]);

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

  // Code → name lookup + the option list for the picker.
  const { allOpts, nameByCode } = useMemo(() => {
    const src: Opt[] = isTax
      ? (options?.tax_rates ?? [])
      : (options?.accounts ?? []).map((a) => ({ code: a.code, name: a.name }));
    const map: Record<string, string> = {};
    for (const o of src) map[o.code] = o.name;
    return { allOpts: src, nameByCode: map };
  }, [options, isTax]);

  const noun = isTax ? "tax code" : "account";

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

  const drop = (ids: string[]) =>
    setRemoved((p) => {
      const n = new Set(p);
      ids.forEach((id) => n.add(id));
      return n;
    });

  const onSave = async (r: HealthCheckResult, f: FlaggedIssue) => {
    const suggested = f.suggested_code ?? "";
    const chosen =
      (mode[r.id] ?? "default") === "custom"
        ? customCode[r.id] ||
          allOpts.find((o) => o.code !== suggested)?.code ||
          suggested
        : suggested;
    if (!chosen) return;
    setBusyKey(r.id);
    const res = await applyCodingFix(
      companyId,
      r.id,
      isTax ? { TaxType: chosen } : { AccountCode: chosen },
    );
    setBusyKey(null);
    if (res.ok) drop([r.id]);
    else setError(res.error ?? "Save failed");
  };

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
          placeholder="Search…"
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

      {options && !options.connected && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
          Xero isn’t connected — you can review here but edits open in Xero.
        </p>
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
              : `No unexpected ${noun}s 🎉`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[900px] text-sm">
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
                <th className="px-2 py-2.5">Type</th>
                <th className="px-2 py-2.5">Item</th>
                <th className="px-2 py-2.5">Details</th>
                <th className="px-2 py-2.5">Net</th>
                <th className="px-2 py-2.5">{isTax ? "Tax used" : "Account used"}</th>
                <th className="px-2 py-2.5">Change to</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {pg.paged.map((r) => {
                const res = r.result;
                const f = flagFor(r, ruleId);
                if (!f) return null;
                const editable = res?.editable !== false;
                const busy = busyKey === r.id;
                const suggested = f.suggested_code ?? "";
                const m = mode[r.id] ?? "default";
                const usedName = f.current_name || nameByCode[f.current_code ?? ""];
                const sugName = f.suggested_name || nameByCode[suggested] || "";
                // dropdown = any account other than the suggested default
                const otherOpts: Opt[] = allOpts.filter((o) => o.code !== suggested);
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
                    <td className="px-2 py-3">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                          DOC_TYPE_CLS[r.document_type] ??
                            "bg-ink-100 text-ink-600 ring-ink-200",
                        ].join(" ")}
                      >
                        {DOC_TYPE_LABEL[r.document_type] ?? r.document_type}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink-900">
                          {res?.vendor_name || "—"}
                        </p>
                        {(() => {
                          const pay = paidLabel(r);
                          return pay ? (
                            <span
                              className={[
                                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                pay === "Paid"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700",
                              ].join(" ")}
                            >
                              {pay}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-[11px] text-ink-400">
                        {[shortDate(res?.invoice_date), res?.invoice_number]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="max-w-[200px] px-2 py-3 text-[12px] text-ink-500">
                      <span className="line-clamp-2">{res?.details || "—"}</span>
                    </td>
                    <td className="px-2 py-3 font-semibold tabular-nums text-ink-900">
                      {money(res?.amount, res?.currency_code)}
                    </td>
                    <td className="px-2 py-3 text-ink-700">
                      {f.current_code || "—"}
                      {usedName && (
                        <span className="block text-[11px] text-ink-400">{usedName}</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {editable ? (
                        <div className="space-y-1.5">
                          {/* Default = contact's expected account (suggested) */}
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="radio"
                              name={`ct-${r.id}`}
                              checked={m !== "custom"}
                              onChange={() =>
                                setMode((p) => ({ ...p, [r.id]: "default" }))
                              }
                              className="accent-brand-600"
                            />
                            <span className="font-medium text-ink-800">
                              {suggested || "—"}
                              {sugName ? ` – ${sugName}` : ""}
                            </span>
                          </label>
                          {/* Or pick any other account */}
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="radio"
                              name={`ct-${r.id}`}
                              checked={m === "custom"}
                              onChange={() =>
                                setMode((p) => ({ ...p, [r.id]: "custom" }))
                              }
                              className="accent-brand-600"
                            />
                            <select
                              value={customCode[r.id] ?? otherOpts[0]?.code ?? ""}
                              onChange={(e) => {
                                setCustomCode((p) => ({
                                  ...p,
                                  [r.id]: e.target.value,
                                }));
                                setMode((p) => ({ ...p, [r.id]: "custom" }));
                              }}
                              className={[
                                "w-40 rounded-md border border-ink-200 bg-white px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200",
                                m !== "custom" ? "opacity-50" : "",
                              ].join(" ")}
                            >
                              {otherOpts.length === 0 && (
                                <option value="">No other accounts</option>
                              )}
                              {otherOpts.map((o) => (
                                <option key={o.code} value={o.code}>
                                  {o.code}
                                  {o.name ? ` — ${o.name}` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : (
                        <span className="inline-flex items-start gap-1.5 text-ink-700">
                          <span>
                            {suggested || "—"}
                            {sugName && (
                              <span className="block text-[11px] text-ink-400">
                                {sugName}
                              </span>
                            )}
                          </span>
                          <span
                            title={reasonText(res?.editable_reason)}
                            className="mt-0.5 flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-500"
                          >
                            ?
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => onSave(r, f)}
                            disabled={busy}
                            className="rounded-md bg-brand-gradient px-2.5 py-1 text-xs font-semibold text-white shadow-brand transition hover:brightness-110 disabled:opacity-60"
                          >
                            {busy ? "…" : "Save changes"}
                          </button>
                        ) : (
                          r.xero_url && (
                            <a
                              href={r.xero_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                            >
                              Edit in Xero
                            </a>
                          )
                        )}
                        {r.xero_url && (
                          <a
                            href={r.xero_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                          >
                            View
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onDismiss(r)}
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
