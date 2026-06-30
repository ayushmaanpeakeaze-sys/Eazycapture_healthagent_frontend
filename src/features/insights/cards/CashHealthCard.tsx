import { FinancialPositionResponse } from "../../../types/insights.types";
import { ArcGauge } from "../components/ArcGauge";
import { Card } from "../components/Card";
import { gbp, Tone } from "../lib/format";

export const CashHealthCard = ({ data }: { data: FinancialPositionResponse }) => {
  const ch = data.cash_health;
  const covPct = Math.round((ch.coverage_ratio ?? 0) * 100);
  const covered = ch.shortfall <= 0;
  const tone: Tone = covPct >= 70 ? "green" : covPct >= 40 ? "amber" : "red";
  return (
    <Card title="Cash Health" help="Cash on hand vs short-term liabilities.">
      <div className="flex items-center gap-4">
        <ArcGauge
          value={Math.min(covPct, 100)}
          tone={tone}
          center={`${covPct}%`}
          label="coverage"
        />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Current cash
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
            {gbp(ch.cash)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500">
            vs {gbp(ch.current_liabilities)} due
          </p>
          {covered ? (
            <p className="mt-1.5 text-[11px] font-medium text-emerald-600">
              Liabilities covered
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] font-medium text-rose-600">
              {gbp(ch.shortfall)} shortfall
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};
