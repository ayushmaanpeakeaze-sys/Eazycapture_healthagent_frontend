import { useEffect, useMemo, useState } from "react";

import {
  fetchCompaniesPanorama,
  PanoramaClient,
} from "../../services/audit.service";
import { fetchHealthCheckResults } from "../../services/document.service";
import {
  HealthCheckKind,
  HealthCheckResult,
  HealthCheckStatus,
} from "../../types/audit.types";

const STATUS_META: Record<
  HealthCheckStatus,
  { label: string; badge: string; dot: string }
> = {
  blocked: {
    label: "Blocked",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
  },
  passed: {
    label: "Passed",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  unavailable: {
    label: "Unavailable",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  skipped: {
    label: "Skipped",
    badge: "bg-ink-100 text-ink-600 ring-ink-200",
    dot: "bg-ink-400",
  },
};

const KIND_META: Record<HealthCheckKind, { label: string }> = {
  preview: { label: "Preview" },
  pre_ledger: { label: "Pre-Ledger" },
  post_ledger: { label: "Post-Ledger" },
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

export const ActivityFeedView = ({
  companyId,
  onPickClient,
}: ActivityFeedViewProps) => {
  const isGlobal = !companyId;
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [total, setTotal] = useState(0);
  const [backendCounts, setBackendCounts] =
    useState<Record<HealthCheckStatus | "all", number> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<HealthCheckStatus | "all">(
    "all",
  );
  const [kindFilter, setKindFilter] = useState<HealthCheckKind | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Global tab: the client list to pick from, and which one is selected.
  const [companies, setCompanies] = useState<PanoramaClient[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [companiesLoading, setCompaniesLoading] = useState<boolean>(isGlobal);

  // /results/ is per-tenant, so we always resolve a single company_id to query:
  // the drilled-in client (companyId), or the one picked in the global tab.
  const targetCompanyId = companyId ?? picked ?? undefined;
  const pickedClient = companies.find((c) => c.company_id === picked) ?? null;

  // Global tab: load the client list once to populate the picker.
  useEffect(() => {
    if (!isGlobal) return;
    let active = true;
    setCompaniesLoading(true);
    fetchCompaniesPanorama(50)
      .then((data) => {
        if (!active) return;
        const list = data.results ?? [];
        setCompanies(list);
        // Default to the first client so the tab isn't empty on arrival.
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
      // Global tab with no client picked yet — nothing to query.
      setResults([]);
      setTotal(0);
      setBackendCounts(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHealthCheckResults({
        company_id: targetCompanyId,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(kindFilter !== "all" ? { kind: kindFilter } : {}),
        limit: 100,
      });
      setResults(res.results ?? []);
      setTotal(res.total ?? (res.results ?? []).length);
      setBackendCounts(
        res.counts
          ? {
              all: res.counts.all,
              blocked: res.counts.blocked,
              passed: res.counts.passed,
              unavailable: res.counts.unavailable,
              skipped: res.counts.skipped,
            }
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when the target company OR either filter changes.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCompanyId, statusFilter, kindFilter]);

  useEffect(() => {
    if (!autoRefresh || !targetCompanyId) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, statusFilter, kindFilter, targetCompanyId]);

  // Server already filtered, so the rendered list is just `results`.
  const filtered = results;

  const counts = useMemo(() => {
    if (backendCounts) return backendCounts;
    // Fallback: compute from the current page if backend didn't send counts.
    const out: Record<HealthCheckStatus | "all", number> = {
      all: results.length,
      blocked: 0,
      passed: 0,
      unavailable: 0,
      skipped: 0,
    };
    for (const r of results) out[r.status] += 1;
    return out;
  }, [backendCounts, results]);

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
              ? "Pick a client to see every health-check event recorded on their ledger."
              : "Every health-check event recorded for this client."}
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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          ["all", "blocked", "passed", "unavailable", "skipped"] as const
        ).map((s) => {
          const active = statusFilter === s;
          const label = s === "all" ? "All" : STATUS_META[s].label;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={[
                "rounded-xl border p-3 text-left shadow-card transition",
                active
                  ? "border-brand-400 bg-brand-50/40"
                  : "border-ink-200 bg-white hover:border-ink-300",
              ].join(" ")}
            >
              <p
                className={[
                  "text-[10px] font-semibold uppercase tracking-wider",
                  active ? "text-brand-700" : "text-ink-500",
                ].join(" ")}
              >
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
          Showing {filtered.length} of {total}
        </span>
      </div>

      <section className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
        {!loading && filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-ink-700">No matching rows</p>
            <p className="mt-1 text-xs text-ink-500">
              {results.length === 0
                ? "No health checks have been recorded yet — publish or precheck a document to populate the feed."
                : "Try a different filter combination."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-200">
            {filtered.map((r) => {
              const sev = STATUS_META[r.status];
              const errors = r.result?.validation_errors?.length
                ? r.result.validation_errors
                : splitErrors(r.error_msgs);
              const isOpen = expandedId === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : r.id)}
                    className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition hover:bg-ink-50"
                  >
                    <span
                      className={[
                        "mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1",
                        sev.badge,
                      ].join(" ")}
                    >
                      <span
                        className={["h-1.5 w-1.5 rounded-full", sev.dot].join(
                          " ",
                        )}
                      />
                      {sev.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-mono text-[11px] text-ink-500">
                          {r.document_type}/{(r.document_id ?? r.id).slice(0, 8)}
                        </span>
                        <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                          {KIND_META[r.kind]?.label ?? r.kind}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-ink-400">
                          → {r.target_ledger}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-ink-800">
                        {errors[0] ??
                          (r.status === "passed"
                            ? "Cleared. No issues detected."
                            : r.status === "skipped"
                              ? "Review skipped."
                              : r.error_msgs ?? "—")}
                      </p>
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
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50"
                          >
                            Open in Xero
                            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
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
                              ✓ None.
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
                                    ({Math.round(
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
    </div>
  );
};
