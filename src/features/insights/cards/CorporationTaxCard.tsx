import { CorporationTaxResponse } from "../../../types/insights.types";
import { Card } from "../components/Card";
import { DEFAULT_TAX_NOTE, gbp } from "../lib/format";

export const CorporationTaxCard = ({ data }: { data: CorporationTaxResponse }) => (
  <Card title="Corporation Tax Estimate" help="Provisional CT estimate.">
    <p className="font-display text-4xl font-semibold leading-none tabular-nums tracking-tight text-ink-900">
      {gbp(data.tax_estimate)}
    </p>
    <p className="mt-1.5 text-[11px] text-ink-500">
      on {gbp(data.taxable_profit)} taxable profit · {data.period_basis}
    </p>
    <span className="mt-2 inline-flex w-fit items-center rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
      {data.effective_rate}% · {data.band}
    </span>
    <p className="mt-auto flex gap-2 pt-3 text-[10px] leading-relaxed text-amber-700">
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-3 w-3 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 9v4M12 17h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      <span>{data.note ?? DEFAULT_TAX_NOTE}</span>
    </p>
  </Card>
);
