import { useEffect, useMemo, useState } from "react";

import { useDataSynced } from "../../hooks/useDataSynced";
import {
  fetchCompaniesPanorama,
  fetchTrappedInvoices,
  PanoramaClient,
} from "../../services/audit.service";
import {
  HealthCheckKind,
  HealthCheckResult,
  Severity,
} from "../../types/audit.types";

const SEVERITY_META: Record<
  Severity,
  { label: string; badge: string; dot: string; rank: number }
> = {
  critical: {
    label: "Critical",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    rank: 3,
  },
  high: {
    label: "High",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    rank: 2,
  },
  medium: {
    label: "Medium",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    rank: 1,
  },
};

const ISSUE_TYPE_META: Record<string, { label: string; group: string }> = {
  unprocessed_bank: { label: "Unprocessed bank items", group: "Bank" },
  unreconciled_bank: { label: "Unreconciled bank items", group: "Bank" },
  bank_balance_check: { label: "Bank balance mismatch", group: "Bank" },
  opening_balance_difference: {
    label: "Opening balance difference",
    group: "Bank",
  },
  duplicate_invoice: { label: "Duplicate invoice", group: "Duplicates" },
  duplicate_bill: { label: "Duplicate bill", group: "Duplicates" },
  duplicate_credit_note: {
    label: "Duplicate credit note",
    group: "Duplicates",
  },
  duplicate_contact: { label: "Duplicate contact", group: "Duplicates" },
  duplicate_vendor: { label: "Duplicate vendor", group: "Duplicates" },
  missing_tax: { label: "Missing tax code", group: "Tax coding" },
  invalid_tax_code: { label: "Invalid tax code", group: "Tax coding" },
  sales_tax_missing: { label: "Missing sales tax", group: "Tax coding" },
  purchase_tax_missing: { label: "Missing purchase tax", group: "Tax coding" },
  sales_tax_on_bills: { label: "Sales tax on a bill", group: "Tax coding" },
  purchase_tax_on_invoices: {
    label: "Purchase tax on an invoice",
    group: "Tax coding",
  },
  unexpected_tax_code: { label: "Unexpected tax code", group: "Tax coding" },
  multi_tax_code_supplier: {
    label: "Inconsistent tax codes",
    group: "Tax coding",
  },
  wrong_category: { label: "Unusual category", group: "Account coding" },
  unexpected_account: { label: "Unexpected account", group: "Account coding" },
  multi_account_supplier: {
    label: "Inconsistent accounts",
    group: "Account coding",
  },
  misallocated_item: { label: "Misallocated item", group: "Account coding" },
  wrong_direction_account: {
    label: "Wrong account direction",
    group: "Account coding",
  },
  anomaly: { label: "Anomaly", group: "Account coding" },
  amount_outlier: { label: "Unusual amount", group: "Amounts" },
  low_cost_fixed_asset: {
    label: "Low-cost fixed asset",
    group: "Account coding",
  },
  capital_item_review: { label: "Capital item review", group: "Account coding" },
  currency_mismatch: { label: "Currency mismatch", group: "Account coding" },
  invoice_or_direct: { label: "Invoice or direct booking", group: "Direct booking" },
  bill_or_direct: { label: "Bill or direct booking", group: "Direct booking" },
  invoice_or_direct_booking: {
    label: "Invoice or direct booking",
    group: "Direct booking",
  },
  bill_or_direct_booking: {
    label: "Bill or direct booking",
    group: "Direct booking",
  },
  bill_direct_payment: { label: "Bill paid directly", group: "Direct booking" },
  invoice_direct_deposit: {
    label: "Invoice settled directly",
    group: "Direct booking",
  },
  future_dated: { label: "Future-dated", group: "Ageing" },
  old_unpaid_bill: { label: "Old unpaid bill", group: "Ageing" },
  old_unpaid_invoice: { label: "Old unpaid invoice", group: "Ageing" },
  old_unsettled_sales_credit: {
    label: "Old unsettled sales credit",
    group: "Ageing",
  },
  old_unsettled_purchase_credit: {
    label: "Old unsettled purchase credit",
    group: "Ageing",
  },
  unapproved_invoice: { label: "Unapproved invoice", group: "Approval & status" },
  unapproved_bill: { label: "Unapproved bill", group: "Approval & status" },
  invalid_status_combo: { label: "Invalid status", group: "Approval & status" },
  missing_vendor: { label: "Missing vendor", group: "Contacts" },
  contact_defaults: { label: "Contact missing defaults", group: "Contacts" },
  inactive_contact: { label: "Inactive contact", group: "Contacts" },
  missing_invoice_number: {
    label: "Missing invoice number",
    group: "Documentation",
  },
  undocumented_bill: { label: "Missing attachment", group: "Documentation" },
};

const prettifyKey = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const getIssueMeta = (key: string): { label: string; group: string } =>
  ISSUE_TYPE_META[key] ?? { label: prettifyKey(key), group: "Other" };

const KIND_META: Record<HealthCheckKind, { label: string }> = {
  preview: { label: "Preview" },
  pre_ledger: { label: "Pre-Ledger" },
  post_ledger: { label: "Post-Ledger" },
};

const rowIssueType = (r: HealthCheckResult): string =>
  r.result?.rule_ids?.[0] ?? r.result?.flagged?.[0]?.issue_type ?? "other";

const rowSeverity = (r: HealthCheckResult): Severity => {
  let worst: Severity = "medium";
  for (const f of r.result?.flagged ?? []) {
    const sev = (f.severity ?? "medium") as Severity;
    if ((SEVERITY_META[sev]?.rank ?? 0) > SEVERITY_META[worst].rank) worst = sev;
  }
  return worst;
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay)
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const splitErrors = (raw: string | null): string[] =>
  raw
    ? raw
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

interface ActivityFeedViewProps {
  companyId?: string;
  onPickClient?: (client: PanoramaClient) => void;
}

interface IssueGroup {
  key: string;
  label: string;
  family: string;
  rows: HealthCheckResult[];
  severity: Severity;
}

export const ActivityFeedView = ({ companyId }: ActivityFeedViewProps) => {
  const isGlobal = !companyId;
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [kindFilter, setKindFilter] = useState<HealthCheckKind | "all">("all");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const [companies, setCompanies] = useState<PanoramaClient[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState<boolean>(isGlobal);

  const targetCompanyId = companyId ?? picked ?? undefined;
  const pickedClient = companies.find((c) => c.company_id === picked) ?? null;

  useEffect(() => {
    if (!isGlobal) return;
    let active = true;
    setCompaniesLoading(true);
    fetchCompaniesPanorama(50)
      .then((data) => {
        if (!active) return;
        const list = data.results ?? [];
        setCompanies(list);
        setPicked((prev) => prev ?? list[0]?.company_id ?? null);
      })
      .finally(() => {
        if (active) setCompaniesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isGlobal]);

  const load = async () => {
    if (!targetCompanyId) {
      setResults([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTrappedInvoices({
        company_id: targetCompanyId,
        limit: 200,
      });
      if ("error" in res) {
        setError(res.error);
        setResults([]);
        setTotal(0);
      } else {
        const list = res.results ?? [];
        setResults(list);
        setTotal(list.length);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [targetCompanyId]);

  useEffect(() => {
    if (!autoRefresh || !targetCompanyId) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [autoRefresh, targetCompanyId]);

  useDataSynced(targetCompanyId, () => load());

  const filtered = useMemo(
    () =>
      results.filter(
        (r) =>
          (severityFilter === "all" || rowSeverity(r) === severityFilter) &&
          (kindFilter === "all" || r.kind === kindFilter),
      ),
    [results, severityFilter, kindFilter],
  );

  const counts = useMemo(() => {
    const out: Record<Severity | "all", number> = {
      all: results.length,
      critical: 0,
      high: 0,
      medium: 0,
    };
    for (const r of results) out[rowSeverity(r)] += 1;
    return out;
  }, [results]);

  const groups = useMemo<IssueGroup[]>(() => {
    const byKey = new Map<string, HealthCheckResult[]>();
    for (const r of filtered) {
      const k = rowIssueType(r);
      const arr = byKey.get(k);
      if (arr) arr.push(r);
      else byKey.set(k, [r]);
    }
    const list: IssueGroup[] = [];
    for (const [key, rows] of byKey) {
      const meta = getIssueMeta(key);
      let severity: Severity = "medium";
      for (const r of rows) {
        const s = rowSeverity(r);
        if (SEVERITY_META[s].rank > SEVERITY_META[severity].rank) severity = s;
      }
      list.push({ key, label: meta.label, family: meta.group, rows, severity });
    }
    list.sort((a, b) => {
      const vol = b.rows.length - a.rows.length;
      return vol !== 0
        ? vol
        : SEVERITY_META[b.severity].rank - SEVERITY_META[a.severity].rank;
    });
    return list;
  }, [filtered]);

  const isGroupOpen = (key: string, index: number) =>
    openGroups[key] ?? index === 0;

  const toggleGroup = (key: string, index: number) =>
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? index === 0),
    }));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            {isGlobal
              ? pickedClient
                ? `Activity · ${pickedClient.name}`
                : "Activity"
              : "Audit logs"}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {isGlobal
              ? "Pick a client to see the issues currently trapped on their ledger, grouped by type."
              : "Issues currently trapped on this ledger, grouped by type."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isGlobal && (
            <label className="inline-flex items-center gap-2 text-xs text-ink-600">
              <span className="font-semibold uppercase tracking-wider text-ink-500">
                Client
              </span>
              <select
                value={picked ?? ""}
                onChange={(e) => setPicked(e.target.value || null)}
                disabled={companiesLoading || companies.length === 0}
                className="max-w-[200px] rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-800 shadow-card transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
              >
                {companiesLoading && <option value="">Loading…</option>}
                {!companiesLoading && companies.length === 0 && (
                  <option value="">No connected clients</option>
                )}
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-brand-500 focus:ring-brand-300"
            />
            Auto-refresh (4s)
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
              >
                <circle cx="12" cy="12" r="9" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
              </svg>
            )}
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Could not load results</p>
          <p className="mt-0.5 text-xs">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(["all", "critical", "high", "medium"] as const).map((s) => {
          const active = severityFilter === s;
          const label = s === "all" ? "All issues" : SEVERITY_META[s].label;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSeverityFilter(s)}
              className={[
                "rounded-xl border p-3 text-left shadow-card transition",
                active
                  ? "border-brand-400 bg-brand-50/40"
                  : "border-ink-200 bg-white hover:border-ink-300",
              ].join(" ")}
            >
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {s !== "all" && (
                  <span
                    className={[
                      "h-1.5 w-1.5 rounded-full",
                      SEVERITY_META[s].dot,
                    ].join(" ")}
                  />
                )}
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {counts[s]}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Kind
        </span>
        <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1 text-xs font-medium shadow-card">
          {(["all", "preview", "pre_ledger", "post_ledger"] as const).map(
            (k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={[
                  "rounded-md px-3 py-1.5 transition",
                  kindFilter === k
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-500 hover:text-ink-800",
                ].join(" ")}
              >
                {k === "all" ? "All" : KIND_META[k].label}
              </button>
            ),
          )}
        </div>
        <span className="ml-auto text-xs text-ink-500">
          {groups.length} issue {groups.length === 1 ? "type" : "types"} ·{" "}
          {filtered.length} of {total}
        </span>
      </div>

      {!loading && groups.length === 0 ? (
        <section className="overflow-hidden rounded-xl border border-ink-200 bg-white px-4 py-10 text-center shadow-card">
          <p className="text-sm font-medium text-ink-700">No matching issues</p>
          <p className="mt-1 text-xs text-ink-500">
            {results.length === 0
              ? "Nothing is trapped right now — this ledger is clean, or no audit has run yet."
              : "Try a different filter combination."}
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {groups.map((g, gi) => {
            const open = isGroupOpen(g.key, gi);
            const sev = SEVERITY_META[g.severity];
            return (
              <section
                key={g.key}
                className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(g.key, gi)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={[
                      "h-4 w-4 shrink-0 text-ink-400 transition-transform",
                      open ? "rotate-90" : "",
                    ].join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                  <span
                    className={["h-2 w-2 shrink-0 rounded-full", sev.dot].join(
                      " ",
                    )}
                  />
                  <span className="font-semibold text-ink-900">{g.label}</span>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    {g.family}
                  </span>
                  <span className="ml-auto rounded-full bg-ink-100 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-ink-700">
                    {g.rows.length}
                  </span>
                </button>
                {open && (
                  <ul className="divide-y divide-ink-200 border-t border-ink-200">
                    {g.rows.map((r) => {
                      const rsev = SEVERITY_META[rowSeverity(r)];
                      const errors = r.result?.validation_errors?.length
                        ? r.result.validation_errors
                        : splitErrors(r.error_msgs);
                      const headline =
                        r.title ?? errors[0] ?? r.error_msgs ?? "—";
                      const isOpen = expandedId === r.id;
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId(isOpen ? null : r.id)
                            }
                            className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition hover:bg-ink-50"
                          >
                            <span
                              className={[
                                "mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1",
                                rsev.badge,
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "h-1.5 w-1.5 rounded-full",
                                  rsev.dot,
                                ].join(" ")}
                              />
                              {rsev.label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink-900">
                                {headline}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-mono text-[11px] text-ink-500">
                                  {r.document_type}/
                                  {(r.document_id ?? r.id).slice(0, 8)}
                                </span>
                                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                                  {KIND_META[r.kind]?.label ?? r.kind}
                                </span>
                                <span className="text-[10px] uppercase tracking-wider text-ink-400">
                                  → {r.target_ledger}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-xs font-medium tabular-nums text-ink-700">
                                {fmtTime(r.ran_at)}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-ink-400">
                                {fmtRelative(r.ran_at)}
                              </p>
                            </div>
                          </button>
                          {isOpen && (
                            <div className="border-t border-ink-200 bg-ink-50/30 px-4 py-4">
                              {r.xero_url && (
                                <div className="mb-3 flex justify-end">
                                  <a
                                    href={r.xero_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50"
                                  >
                                    Open in Xero
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2.2}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M14 3h7v7" />
                                      <path d="M10 14 21 3" />
                                      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                                    </svg>
                                  </a>
                                </div>
                              )}
                              <div className="grid gap-3 md:grid-cols-2">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                                    Validation errors
                                  </p>
                                  {errors.length > 0 ? (
                                    <ul className="mt-2 space-y-1.5 text-sm text-rose-900">
                                      {errors.map((e, i) => (
                                        <li key={i} className="flex gap-2">
                                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                                          <span>{e}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mt-2 text-sm text-emerald-700">
                                      None.
                                    </p>
                                  )}
                                  {r.result?.reasoning && (
                                    <>
                                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                                        AI reasoning
                                      </p>
                                      <p className="mt-1 text-xs text-ink-700">
                                        {r.result.reasoning}
                                      </p>
                                    </>
                                  )}
                                  {r.result?.suggested_category && (
                                    <>
                                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                                        Suggested category
                                      </p>
                                      <p className="mt-1 text-xs text-ink-700">
                                        {r.result.suggested_category}
                                        {r.result.confidence_score != null && (
                                          <span className="ml-1 text-ink-500">
                                            (
                                            {Math.round(
                                              r.result.confidence_score * 100,
                                            )}
                                            %)
                                          </span>
                                        )}
                                      </p>
                                    </>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                                    Raw response
                                  </p>
                                  <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-ink-200 bg-white p-3 text-[11px] leading-relaxed text-ink-700">
                                    {JSON.stringify(
                                      {
                                        id: r.id,
                                        document_id: r.document_id,
                                        kind: r.kind,
                                        status: r.status,
                                        ran_at: r.ran_at,
                                        error_msgs: r.error_msgs,
                                        result: r.result,
                                      },
                                      null,
                                      2,
                                    )}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
