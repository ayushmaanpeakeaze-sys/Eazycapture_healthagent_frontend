import { AuditSummary } from "../../types/audit.types";

interface BatchSummaryCardProps {
  summary: AuditSummary | null;
  loading: boolean;
}

export const BatchSummaryCard = ({ summary, loading }: BatchSummaryCardProps) => {
  if (!summary && !loading) return null;

  if (loading && !summary) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/70 via-white to-brand-100/40 p-5 shadow-card">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 animate-spin"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
            >
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              AI insights pending…
            </p>
            <p className="text-xs text-ink-500">
              Enriching trapped rows with AI explanations and a triage plan.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!summary) return null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/70 via-white to-brand-100/40 shadow-card">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-200/40 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-brand-300/30 blur-3xl"
      />

      <div className="relative grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-700 shadow-sm ring-1 ring-brand-200">
            <svg
              viewBox="0 0 24 24"
              className="h-3 w-3"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />
            </svg>
            AI audit summary
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-800">
            {summary.summary}
          </p>

          {summary.top_themes.length > 0 && (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Top themes
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.top_themes.map((theme, i) => (
                  <span
                    key={`${theme}-${i}`}
                    className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand-700 shadow-sm ring-1 ring-brand-200"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-brand-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
            Suggested cleanup order
          </p>
          {summary.suggested_cleanup_order.length === 0 ? (
            <p className="mt-2 text-xs italic text-ink-500">
              No specific order suggested — work from highest severity down.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {summary.suggested_cleanup_order.map((step, i) => (
                <li
                  key={`${step}-${i}`}
                  className="flex items-start gap-2.5 text-xs text-ink-800"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-bold text-white shadow-brand">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
};
