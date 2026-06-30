import { FinancialPositionResponse } from "../../../types/insights.types";
import { Card } from "../components/Card";
import { gbp } from "../lib/format";

export const BusinessValuationCard = ({
  data,
}: {
  data: FinancialPositionResponse;
}) => (
  <Card title="Business Valuation" help="Estimated value of the business.">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
      Valuation estimate
    </p>
    <p className="mt-1 font-display text-4xl font-semibold leading-none tabular-nums tracking-tight text-ink-900">
      {gbp(data.valuation.net_asset_value)}
    </p>
    <p className="mt-2 text-[11px] text-ink-500">
      {data.valuation.model === "net_asset"
        ? "Net-asset method — total assets less total liabilities."
        : data.valuation.model}
    </p>
    <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[11px]">
      <div>
        <span className="text-ink-400">Total assets</span>
        <p className="font-semibold tabular-nums text-ink-800">
          {gbp(data.position.total_assets)}
        </p>
      </div>
      <div>
        <span className="text-ink-400">Total liabilities</span>
        <p className="font-semibold tabular-nums text-rose-600">
          {gbp(data.position.total_liabilities)}
        </p>
      </div>
    </div>
  </Card>
);
