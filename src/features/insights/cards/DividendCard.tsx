import { FinancialPositionResponse } from "../../../types/insights.types";
import { Card } from "../components/Card";
import { gbp } from "../lib/format";

export const DividendCard = ({ data }: { data: FinancialPositionResponse }) => {
  const d = data.dividend;
  return (
    <Card
      title="Dividend Availability"
      help="Distributable reserves available to pay as dividends."
    >
      <dl className="space-y-1.5 text-[12px]">
        <LedgerRow label="Retained earnings (prior)" value={gbp(d.retained_earnings)} />
        <LedgerRow
          label="Add: profit this year"
          value={gbp(d.current_year_earnings)}
        />
        <div className="my-1 border-t border-ink-100" />
        <LedgerRow
          label="Distributable reserves"
          value={gbp(d.distributable_reserves)}
          strong
        />
      </dl>
      <div className="mt-auto pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Maximum dividend available
        </p>
        <p
          className={[
            "font-display text-3xl font-semibold leading-none tabular-nums tracking-tight",
            d.distributable_reserves > 0 ? "text-emerald-600" : "text-rose-600",
          ].join(" ")}
        >
          {gbp(d.distributable_reserves)}
        </p>
        <p className="mt-1 text-[10px] italic text-ink-400">{d.basis}</p>
      </div>
    </Card>
  );
};

const LedgerRow = ({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3">
    <dt className={strong ? "font-semibold text-ink-800" : "text-ink-500"}>
      {label}
    </dt>
    <dd
      className={[
        "tabular-nums",
        strong ? "font-semibold text-ink-900" : "text-ink-700",
      ].join(" ")}
    >
      {value}
    </dd>
  </div>
);
