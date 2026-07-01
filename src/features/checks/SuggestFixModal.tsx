import { useEffect, useState } from "react";

import { applyAiFix, suggestFix } from "../../services/document.service";
import {
  ApplyAiFixResult,
  HealthCheckResult,
  SuggestFixResponse,
} from "../../types/audit.types";

interface SuggestFixModalProps {
  row: HealthCheckResult;
  onClose: () => void;
  /** Called after a successful "Fix in Xero" so the parent can refresh the list. */
  onResolved?: () => void;
}

export const SuggestFixModal = ({
  row,
  onClose,
  onResolved,
}: SuggestFixModalProps) => {
  const [data, setData] = useState<SuggestFixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyAiFixResult | null>(null);

  const handleApply = async () => {
    if (!data?.available) return;
    setApplying(true);
    setApplyResult(null);
    const res = await applyAiFix(row.id, row.company_id, data.suggestion);
    setApplyResult(res);
    setApplying(false);
    if (res.ok) {
      // Brief success state before the parent dismisses + refreshes
      setTimeout(() => {
        onResolved?.();
        onClose();
      }, 1200);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    suggestFix(row.id, row.company_id)
      .then((res) => {
        if (!active) return;
        setData(res);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message || "Could not draft a fix.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [row.id]);

  const docId = data?.document_id ?? row.document_id ?? row.id;
  const xeroUrl = data?.xero_url ?? row.xero_url ?? null;

  const [copied, setCopied] = useState(false);
  const copyDocId = async () => {
    try {
      await navigator.clipboard.writeText(docId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in restricted contexts — silent.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {row.document_type}
            </p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-ink-200 bg-ink-50 px-2 py-1 text-[11px] text-ink-700">
              <span className="font-semibold uppercase tracking-wider text-ink-400">
                ID
              </span>
              <code className="font-mono">{docId}</code>
              <button
                type="button"
                onClick={copyDocId}
                title="Copy document ID"
                className="ml-1 rounded p-0.5 text-ink-500 transition hover:bg-white hover:text-ink-800"
              >
                {copied ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
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

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50/40 px-3.5 py-3 text-sm text-brand-700">
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
              Asking the AI for a fix plan — usually 1–3 seconds.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
              <span className="font-semibold">Could not draft a fix:</span>{" "}
              {error}
            </div>
          )}

          {data && !data.available && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
              <p className="font-semibold">AI suggestion unavailable</p>
              <p className="mt-0.5 text-xs">
                The LLM couldn&apos;t draft a fix for this row right now. Open
                the document in your ledger and resolve manually, or try again
                in a few minutes.
              </p>
            </div>
          )}

          {applyResult && (
            <ApplyResultBanner result={applyResult} />
          )}

          {data && data.available && (
            <div className={applyResult?.ok ? "mt-4 space-y-4 opacity-60" : "space-y-4"}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  ~{data.suggestion.estimated_minutes} min
                </span>
              </div>

              {data.suggestion.human_steps.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Steps
                  </p>
                  <ol className="mt-2 space-y-2">
                    {data.suggestion.human_steps.map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white shadow-brand">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {data.suggestion.xero_action && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Xero action
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-ink-200 bg-ink-900 p-3 text-[11px] leading-relaxed text-emerald-200">
                    <code>{data.suggestion.xero_action}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ink-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading || applying}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applyResult?.ok ? "Done" : "Close"}
          </button>
          {xeroUrl && (
            <a
              href={xeroUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              Open in Xero
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
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
          )}
          {data?.available && !applyResult && (
            <button
              type="button"
              onClick={handleApply}
              disabled={applying || loading}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applying && (
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
              {applying ? "Applying…" : "Fix in Xero"}
              {!applying && (
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

const ApplyResultBanner = ({ result }: { result: ApplyAiFixResult }) => {
  if (result.ok) {
    const fieldList = Object.keys(result.applied_updates);
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
        <p className="font-semibold">Fix applied in Xero</p>
        <p className="mt-0.5 text-xs">
          Row marked resolved.
          {fieldList.length > 0 && (
            <>
              {" "}Updated: <code className="font-mono">{fieldList.join(", ")}</code>.
            </>
          )}
        </p>
      </div>
    );
  }

  if (
    result.error_code === "LINE_ITEM_FIX_NOT_SUPPORTED" ||
    result.error_code === "NO_FIELD_UPDATES" ||
    result.error_code === "NO_SUPPORTED_FIELDS" ||
    result.error_code === "MANUAL_FIX_REQUIRED" ||
    result.error_code === "AI_TARGET_NOT_TRAPPED"
  ) {
    const title =
      result.error_code === "LINE_ITEM_FIX_NOT_SUPPORTED"
        ? "Auto-fix not yet supported for this field"
        : result.error_code === "MANUAL_FIX_REQUIRED"
          ? "AI can't auto-fix this safely"
          : result.error_code === "AI_TARGET_NOT_TRAPPED"
            ? "AI wants to fix a different document"
            : "No safe auto-fix derivable";
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs">
          {result.error_detail ??
            "Follow the manual steps below to apply this change in Xero directly."}
        </p>
        {result.xero_url && (
          <a
            href={result.xero_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-300 transition hover:bg-amber-100"
          >
            Open this document in Xero
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
        )}
      </div>
    );
  }

  if (result.error_code === "XERO_REJECTED") {
    const xeroMessage =
      result.error_detail ??
      extractXeroMessage(result.xero_response) ??
      result.error;
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
        <p className="font-semibold">Xero rejected the change</p>
        <p className="mt-1 leading-relaxed">{xeroMessage}</p>
        <p className="mt-2 text-[11px] text-rose-700/80">
          Follow the manual steps below to resolve this in Xero directly.
        </p>
      </div>
    );
  }

  if (result.error_code === "AI_UNAVAILABLE") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
        <p className="font-semibold">AI unavailable</p>
        <p className="mt-0.5 text-xs">
          The LLM couldn&apos;t draft a fix this time. Try again or use the
          manual steps below.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
      <p className="font-semibold">Could not apply fix</p>
      <p className="mt-0.5 text-xs">{result.error}</p>
    </div>
  );
};

const extractXeroMessage = (resp: unknown): string | null => {
  if (!resp || typeof resp !== "object") return null;
  const r = resp as Record<string, unknown>;
  if (typeof r.Message === "string") return r.Message;
  if (Array.isArray(r.Elements) && r.Elements.length > 0) {
    const first = r.Elements[0] as Record<string, unknown>;
    const errs = first?.ValidationErrors;
    if (Array.isArray(errs) && errs.length > 0) {
      const m = (errs[0] as Record<string, unknown>)?.Message;
      if (typeof m === "string") return m;
    }
  }
  return null;
};
