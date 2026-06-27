import { useEffect, useMemo, useState } from "react";

import {
  fetchTaxRates,
  resolveHealthCheckRow,
} from "../../services/document.service";
import {
  FlaggedIssue,
  HealthCheckResult,
  ResolveHealthCheckRequest,
  TaxRate,
} from "../../types/audit.types";

interface ResolutionDrawerProps {
  companyId: string;
  row: HealthCheckResult;
  issue: FlaggedIssue;
  flaggedIndex: number;
  onClose: () => void;
  onResolved: () => void;
}

const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v * 100)}%`;

export const ResolutionDrawer = ({
  companyId,
  row,
  issue,
  flaggedIndex,
  onClose,
  onResolved,
}: ResolutionDrawerProps) => {
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [selectedTaxCode, setSelectedTaxCode] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const needsTaxRates =
    issue.issue_type === "invalid_tax_code" ||
    issue.issue_type === "missing_tax";

  const isBill = row.document_type === "bill";

  useEffect(() => {
    if (!needsTaxRates) return;
    let active = true;
    setLoadingRates(true);
    setRatesError(null);
    fetchTaxRates(companyId)
      .then((data) => {
        if (!active) return;
        setTaxRates(data.tax_rates ?? []);
      })
      .catch((err: Error) => {
        if (!active) return;
        setRatesError(err.message);
      })
      .finally(() => {
        if (active) setLoadingRates(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, needsTaxRates]);

  const filteredRates = useMemo(() => {
    if (!needsTaxRates) return [];
    return taxRates.filter((r) => {
      if (r.status !== "active") return false;
      return isBill ? r.can_apply_to_expenses : r.can_apply_to_revenue;
    });
  }, [taxRates, needsTaxRates, isBill]);

  useEffect(() => {
    if (
      needsTaxRates &&
      !selectedTaxCode &&
      issue.suggested_code &&
      filteredRates.some((r) => r.tax_type === issue.suggested_code)
    ) {
      setSelectedTaxCode(issue.suggested_code);
    }
  }, [needsTaxRates, selectedTaxCode, issue.suggested_code, filteredRates]);

  const submit = async (payload: ResolveHealthCheckRequest) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await resolveHealthCheckRow(row.id, companyId, payload);
      if (res.ok || res.resolved) {
        onResolved();
      } else {
        setSubmitError(res.error ?? "Resolve failed");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onApplyTax = () => {
    if (!selectedTaxCode) {
      setSubmitError("Pick a tax rate first.");
      return;
    }
    submit({
      flagged_index: flaggedIndex,
      issue_type: issue.issue_type,
      action: "apply_tax_code",
      tax_code: selectedTaxCode,
      field_updates: { tax_code: selectedTaxCode },
    });
  };

  const onAcceptCategory = () => {
    if (!issue.suggested_code) {
      setSubmitError("No suggested category to accept.");
      return;
    }
    submit({
      flagged_index: flaggedIndex,
      issue_type: issue.issue_type,
      action: "accept_suggestion",
      category_code: issue.suggested_code,
    });
  };

  const title =
    issue.issue_type === "invalid_tax_code"
      ? "Set the correct tax code"
      : issue.issue_type === "missing_tax"
        ? "Add a tax code"
        : issue.issue_type === "wrong_category"
          ? "Accept suggested category"
          : "Resolve issue";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm transition"
        onClick={submitting ? undefined : onClose}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-ink-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {row.document_type} ·{" "}
              <span className="font-mono">
                {(row.document_id ?? row.id).slice(0, 12)}
              </span>
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink-900">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Issue
            </p>
            <p className="mt-1 text-sm text-ink-800">{issue.message}</p>
            {issue.reasoning && (
              <p className="mt-2 text-xs italic text-ink-600">
                “{issue.reasoning}”
              </p>
            )}
            {issue.confidence != null && (
              <p className="mt-2 text-[11px] font-medium text-ink-500">
                AI confidence · {fmtPct(issue.confidence)}
              </p>
            )}
          </div>

          {needsTaxRates && (
            <section className="mt-5">
              <label
                htmlFor="tax-rate-select"
                className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500"
              >
                Tax code
              </label>
              <p className="mt-0.5 text-xs text-ink-500">
                Showing active rates that apply to{" "}
                {isBill ? "expenses" : "revenue"}.
              </p>

              {loadingRates ? (
                <p className="mt-3 text-xs text-ink-500">
                  Loading tax rates…
                </p>
              ) : ratesError ? (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  Could not load tax rates: {ratesError}
                </div>
              ) : filteredRates.length === 0 ? (
                <p className="mt-3 text-xs text-ink-500">
                  No applicable tax rates returned for this org.
                </p>
              ) : (
                <select
                  id="tax-rate-select"
                  value={selectedTaxCode}
                  onChange={(e) => setSelectedTaxCode(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                >
                  <option value="">Select a tax rate…</option>
                  {filteredRates.map((r) => (
                    <option key={r.tax_type} value={r.tax_type}>
                      {r.name} ({r.tax_type}) · {r.effective_rate}%
                    </option>
                  ))}
                </select>
              )}

              {issue.suggested_code && (
                <p className="mt-2 text-[11px] text-ink-500">
                  AI suggested{" "}
                  <code className="rounded bg-brand-50 px-1 font-mono text-[11px] text-brand-700">
                    {issue.suggested_code}
                  </code>
                </p>
              )}
            </section>
          )}

          {issue.issue_type === "wrong_category" && (
            <section className="mt-5 space-y-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                {/* Currently */}
                <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Currently
                  </p>
                  {issue.current_code ? (
                    <>
                      <p className="mt-1 font-mono text-sm font-semibold text-ink-900">
                        {issue.current_code}
                      </p>
                      {issue.current_name && (
                        <p className="mt-0.5 text-xs text-ink-600">
                          {issue.current_name}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs italic text-ink-400">
                      No account code on the document
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 text-brand-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Suggested — dropdown pre-selected to suggested_code */}
                <div className="rounded-lg border border-brand-300 bg-brand-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
                    Move to
                  </p>
                  {issue.suggested_code ? (
                    <>
                      <select
                        defaultValue={issue.suggested_code}
                        className="mt-1 w-full appearance-none rounded-md border border-brand-200 bg-white px-2 py-1 font-mono text-sm font-semibold text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                        title="Full chart of accounts not exposed yet — only the AI suggestion is available."
                      >
                        <option value={issue.suggested_code}>
                          {issue.suggested_code}
                          {issue.suggested_name
                            ? ` · ${issue.suggested_name}`
                            : ""}
                        </option>
                      </select>
                      {issue.suggested_name && (
                        <p className="mt-1 text-xs text-brand-700">
                          {issue.suggested_name}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-1 text-xs italic text-ink-400">
                      No suggestion available
                    </p>
                  )}
                </div>
              </div>

              {(issue.confidence != null || issue.reasoning) && (
                <div className="rounded-lg border border-brand-100 bg-white px-3 py-2.5">
                  {issue.confidence != null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-2.5 w-2.5"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />
                      </svg>
                      AI · {fmtPct(issue.confidence)}
                    </span>
                  )}
                  {issue.reasoning && (
                    <p className="mt-1.5 text-xs italic leading-relaxed text-ink-700">
                      “{issue.reasoning}”
                    </p>
                  )}
                </div>
              )}

              <p className="text-[11px] text-ink-500">
                Full chart-of-accounts picker isn&apos;t exposed yet — for now
                you can only accept the AI suggestion, edit in your ledger, or
                dismiss.
              </p>
            </section>
          )}

          {submitError && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <span className="font-semibold">Could not apply:</span>{" "}
              {submitError}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ink-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          {needsTaxRates ? (
            <button
              type="button"
              onClick={onApplyTax}
              disabled={submitting || !selectedTaxCode}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Spinner />}
              {submitting ? "Applying…" : "Apply tax code"}
            </button>
          ) : issue.issue_type === "wrong_category" ? (
            <button
              type="button"
              onClick={onAcceptCategory}
              disabled={submitting || !issue.suggested_code}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Spinner />}
              {submitting ? "Applying…" : "Accept suggestion"}
            </button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
};

function Spinner() {
  return (
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
  );
}
