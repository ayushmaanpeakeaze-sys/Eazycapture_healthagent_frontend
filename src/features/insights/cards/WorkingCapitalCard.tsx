import { FinancialPositionResponse } from "../../../types/insights.types";
import { Card } from "../components/Card";
import { gbp } from "../lib/format";

export const WorkingCapitalCard = ({
  data,
}: {
  data: FinancialPositionResponse;
}) => {
  const wc = data.working_capital;
  return (
    <Card
      title="Working Capital"
      help="Current assets minus current liabilities."
      right={
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
            wc.healthy
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-rose-50 text-rose-700 ring-rose-200",
          ].join(" ")}
        >
          {wc.healthy ? "Healthy" : "Tight"}
        </span>
      }
    >
      <p
        className={[
          "font-display text-4xl font-semibold leading-none tabular-nums tracking-tight",
          wc.working_capital < 0 ? "text-rose-600" : "text-emerald-600",
        ].join(" ")}
      >
        {gbp(wc.working_capital)}
      </p>
      <p className="mt-2 text-[11px] text-ink-500">
        Current ratio{" "}
        <span className="font-semibold text-ink-700">
          {wc.current_ratio.toFixed(2)}×
        </span>
      </p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[11px]">
        <div>
          <span className="text-ink-400">Current assets</span>
          <p className="font-semibold tabular-nums text-ink-800">
            {gbp(wc.current_assets)}
          </p>
        </div>
        <div>
          <span className="text-ink-400">Current liabilities</span>
          <p className="font-semibold tabular-nums text-rose-600">
            {gbp(wc.current_liabilities)}
          </p>
        </div>
      </div>
    </Card>
  );
};
