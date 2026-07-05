import { useEffect, useMemo, useState } from "react";

import { runOutboundDemo } from "../../services/audit.service";
import {
  fetchHealthCheckResults,
  precheckPublishingDocument,
} from "../../services/document.service";
import {
  BatchTransaction,
  FlaggedIssue,
  HealthCheckResult,
  PrecheckResponse,
  PublishingDocumentType,
} from "../../types/audit.types";

type Severity = "high" | "med" | "low";

interface TrappedInvoice {
  id: string;
  invoice_number: string;
  vendor: string;
  amount: number;
  date: string;
  trapped_at: string;
  errors: string[];
  severity: Severity;
  reasoning: string;
  suggested_category: string | null;
  document_url?: string;
  outcome: "blocked" | "passed" | "other";
}

const SEVERITY: Record<Severity, { label: string; badge: string; dot: string }> = {
  high: {
    label: "High",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
  },
  med: {
    label: "Medium",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
  },
  low: {
    label: "Low",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
  },
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const IssueExplainer = ({
  errors,
  reasoning,
  suggestion,
}: {
  errors: string[];
  reasoning: string;
  suggestion: string;
}) => (
  <div className="space-y-3">
    <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
        Issue
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-rose-900">
        {errors.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
            <span>{e}</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
        So what?
      </p>
      <p className="mt-2 text-sm text-amber-900">{reasoning}</p>
    </div>
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
        Solution
      </p>
      <p className="mt-2 text-sm text-emerald-900">{suggestion}</p>
    </div>
  </div>
);

interface PrecheckTesterState {
  id: string;
  type: PublishingDocumentType;
  loading: boolean;
  response: PrecheckResponse | null;
  error: string | null;
}

const PrecheckTester = ({
  onResult,
}: {
  onResult?: (res: PrecheckResponse) => void;
}) => {
  const [state, setState] = useState<PrecheckTesterState>({
    id: "",
    type: "invoice",
    loading: false,
    response: null,
    error: null,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.id.trim()) return;
    setState((s) => ({ ...s, loading: true, error: null, response: null }));
    try {
      const res = await precheckPublishingDocument({
        publishing_document_id: state.id.trim(),
        publishing_document_type: state.type,
      });
      setState((s) => ({ ...s, loading: false, response: res }));
      onResult?.(res);
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Request failed",
      }));
    }
  };

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-ink-900">
          Test Publish Precheck
        </h3>
      </div>

      <form
        onSubmit={submit}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Document ID
          </label>
          <input
            type="text"
            required
            value={state.id}
            onChange={(e) => setState((s) => ({ ...s, id: e.target.value }))}
            placeholder="e.g. abc-123"
            className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Type
          </label>
          <select
            value={state.type}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                type: e.target.value as PublishingDocumentType,
              }))
            }
            className="mt-1 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          >
            <option value="invoice">invoice</option>
            <option value="receipt">receipt</option>
            <option value="bill">bill</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={state.loading || !state.id.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.loading && (
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
          {state.loading ? "Checking…" : "Run precheck"}
        </button>
      </form>

      {state.error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span className="font-semibold">Request failed:</span> {state.error}
        </div>
      )}

      {state.response && (
        <div
          className={[
            "mt-4 rounded-lg border px-4 py-3",
            state.response.blocked
              ? "border-rose-200 bg-rose-50"
              : "border-emerald-200 bg-emerald-50",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <span
              className={[
                "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wider ring-1",
                state.response.blocked
                  ? "bg-rose-100 text-rose-800 ring-rose-300"
                  : "bg-emerald-100 text-emerald-800 ring-emerald-300",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  state.response.blocked ? "bg-rose-500" : "bg-emerald-500",
                ].join(" ")}
              />
              {state.response.blocked ? "Blocked" : "Cleared"}
            </span>
            {state.response.error_code && (
              <code className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-mono text-ink-700">
                {state.response.error_code}
              </code>
            )}
          </div>

          {state.response.error_msgs && (
            <p className="mt-2 text-sm text-rose-900">
              {state.response.error_msgs}
            </p>
          )}

          {state.response.result?.validation_errors &&
            state.response.result.validation_errors.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-rose-900">
                {state.response.result.validation_errors.map((m, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            )}

          {state.response.result?.suggested_category && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-ink-700 ring-1 ring-ink-200">
              AI suggests · {state.response.result.suggested_category}
              {state.response.result.confidence_score != null && (
                <span className="text-ink-400">
                  · {Math.round(state.response.result.confidence_score * 100)}%
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

const splitErrorMsgs = (raw: string | null): string[] => {
  if (!raw) return [];
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
};

const adaptHealthResult = (r: HealthCheckResult): TrappedInvoice => {
  const errors =
    r.result?.validation_errors?.length
      ? r.result.validation_errors
      : splitErrorMsgs(r.error_msgs);

  const severity: Severity =
    errors.length >= 3 ? "high" : errors.length === 2 ? "med" : "low";

  const docId = r.document_id ?? r.id;
  const outcome: "blocked" | "passed" | "other" =
    r.status === "blocked"
      ? "blocked"
      : r.status === "passed"
        ? "passed"
        : "other";
  return {
    id: r.id,
    invoice_number: docId.slice(0, 8),
    vendor: `${r.document_type} · ${docId.slice(0, 8)}`,
    amount: 0,
    date: r.ran_at,
    trapped_at: r.ran_at,
    errors,
    severity,
    reasoning: r.result?.reasoning ?? r.error_msgs ?? "",
    suggested_category: r.result?.suggested_category ?? null,
    outcome,
  };
};

const SEV_RANK: Record<Severity, number> = { high: 3, med: 2, low: 1 };

const flagSeverityToLocal = (s: FlaggedIssue["severity"]): Severity =>
  s === "critical" || s === "high" ? "high" : s === "medium" ? "med" : "low";

const adaptDemo = (
  transactions: BatchTransaction[],
  flagsByTxn: Record<string, FlaggedIssue[]>,
): TrappedInvoice[] =>
  transactions.map((tx) => {
    const flags = flagsByTxn[tx.transaction_id] ?? [];
    const blocked = flags.length > 0;
    let worst: Severity = "low";
    for (const f of flags) {
      const local = flagSeverityToLocal(f.severity);
      if (SEV_RANK[local] > SEV_RANK[worst]) worst = local;
    }
    const suggested = flags.find((f) => f.suggested_code)?.suggested_code;
    return {
      id: tx.transaction_id,
      invoice_number: tx.invoice_number || tx.transaction_id,
      vendor: tx.vendor_name,
      amount: typeof tx.amount === "number" ? tx.amount : Number(tx.amount) || 0,
      date: tx.date,
      trapped_at: new Date().toISOString(),
      errors: flags.map((f) => f.message),
      severity: worst,
      reasoning:
        flags.find((f) => f.reasoning)?.reasoning ??
        flags[0]?.message ??
        "",
      suggested_category: suggested ?? null,
      outcome: blocked ? "blocked" : "passed",
    };
  });

export const PreLedgerReviewCenter = ({
  companyId,
}: {
  companyId: string;
}) => {
  const [items, setItems] = useState<TrappedInvoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [demoLoading, setDemoLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHealthCheckResults({
        company_id: companyId,
        limit: 100,
      });
      const adapted = (res.results ?? [])
        .filter((r) => r.kind === "preview" || r.kind === "pre_ledger")
        .map(adaptHealthResult);
      setItems(adapted);
      setSelectedId((prev) => prev ?? adapted[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results");
    } finally {
      setLoading(false);
    }
  };

  const runDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const demo = await runOutboundDemo();
      const txs = demo.transactions ?? [];
      const byTxn: Record<string, FlaggedIssue[]> =
        demo.flags_by_txn ??
        (demo.flagged ?? demo.result?.flagged ?? []).reduce<
          Record<string, FlaggedIssue[]>
        >((acc, f) => {
          (acc[f.transaction_id] ??= []).push(f);
          return acc;
        }, {});
      if (txs.length === 0) {
        setError("Demo endpoint returned no transactions.");
        return;
      }
      const adapted = adaptDemo(txs, byTxn);
      setItems(adapted);
      setSelectedId(adapted.find((i) => i.outcome === "blocked")?.id ?? adapted[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo failed");
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const filtered = useMemo(
    () =>
      severityFilter === "all"
        ? items
        : items.filter((i) => i.severity === severityFilter),
    [items, severityFilter],
  );

  const selected =
    items.find((i) => i.id === selectedId) ?? items[0] ?? null;

  const counts = useMemo(() => {
    return {
      total: items.length,
      blocked: items.filter((i) => i.outcome === "blocked").length,
      passed: items.filter((i) => i.outcome === "passed").length,
      high: items.filter((i) => i.severity === "high").length,
      med: items.filter((i) => i.severity === "med").length,
      low: items.filter((i) => i.severity === "low").length,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            Pre-checks
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Outbound publish reviews — documents going from EazyCapture to your
            ledger, both passed and held.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={runDemo}
            disabled={demoLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 shadow-card transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {demoLoading ? (
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
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="currentColor"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            Run demo
          </button>
          <button
            type="button"
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 shadow-card transition hover:bg-ink-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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

      <PrecheckTester onResult={() => load()} />

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Could not load results</p>
          <p className="mt-0.5 text-xs">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-ink-500">
            Reviewed
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900">
            {counts.total}
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-ink-500">
            Passed
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {counts.passed}
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
          <p className="text-[11px] uppercase tracking-wider text-ink-500">
            Held
          </p>
          <p className="mt-1 text-2xl font-semibold text-rose-600">
            {counts.blocked}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">
              {loading
                ? "Loading…"
                : `${filtered.length} of ${items.length} reviewed`}
            </p>
            <div className="inline-flex rounded-md border border-ink-200 p-0.5 text-xs">
              {(["all", "high", "med", "low"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSeverityFilter(opt)}
                  className={[
                    "rounded px-2.5 py-1 font-medium transition",
                    severityFilter === opt
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-500 hover:text-ink-800",
                  ].join(" ")}
                >
                  {opt === "all" ? "All" : SEVERITY[opt].label}
                </button>
              ))}
            </div>
          </div>

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-ink-700">
                Nothing on hold
              </p>
              <p className="mt-1 text-xs text-ink-500">
                {items.length === 0
                  ? "No documents have been held back yet."
                  : "No items match the current severity filter."}
              </p>
            </div>
          )}

          <ul className="divide-y divide-ink-200">
            {filtered.map((inv) => {
              const sev = SEVERITY[inv.severity];
              const active = selected?.id === inv.id;
              return (
                <li key={inv.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(inv.id)}
                    className={[
                      "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition",
                      active ? "bg-brand-50/60" : "hover:bg-ink-50",
                    ].join(" ")}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink-900">
                          {inv.vendor}
                        </span>
                        <span
                          className={[
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
                            inv.outcome === "passed"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-rose-50 text-rose-700 ring-rose-200",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "h-1.5 w-1.5 rounded-full",
                              inv.outcome === "passed"
                                ? "bg-emerald-500"
                                : "bg-rose-500",
                            ].join(" ")}
                          />
                          {inv.outcome === "passed" ? "Passed" : "Held"}
                        </span>
                        {inv.outcome === "blocked" && (
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
                              sev.badge,
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "h-1.5 w-1.5 rounded-full",
                                sev.dot,
                              ].join(" ")}
                            />
                            {sev.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {inv.errors[0] ?? "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-ink-400">
                        {fmtRelative(inv.trapped_at)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-card">
                <p className="text-[11px] uppercase tracking-wider text-ink-500">
                  {selected.vendor}
                </p>
                <h3 className="mt-0.5 text-lg font-semibold text-ink-900">
                  Document {selected.invoice_number}
                </h3>
                <p className="mt-1 text-xs text-ink-500">
                  Held {fmtRelative(selected.trapped_at)} ·{" "}
                  {selected.errors.length} issue
                  {selected.errors.length === 1 ? "" : "s"}
                </p>

                {selected.suggested_category && (
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />
                    </svg>
                    AI suggests · {selected.suggested_category}
                  </div>
                )}
              </div>

              <IssueExplainer
                errors={selected.errors}
                reasoning={
                  selected.reasoning ||
                  "No additional reasoning was returned for this document."
                }
                suggestion="Open in EazyCapture, correct the flagged fields, and click Publish to re-attempt the push. The review will run again automatically."
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-brand-gradient px-3 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5"
                >
                  Open in EazyCapture
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium text-ink-700 shadow-card transition hover:bg-ink-50"
                >
                  Dismiss
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center">
              <p className="text-sm font-medium text-ink-700">
                Select a blocked document
              </p>
              <p className="mt-1 text-xs text-ink-500">
                Issue, reasoning, and suggested fix will appear here.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
