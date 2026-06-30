import { BankReconciliation } from "../../../types/insights.types";
import { Card } from "../components/Card";
import { formatAsOf, gbp } from "../lib/format";

// Display-only — sourced from Xero's IsReconciled flag.
export const BankReconciliationCard = ({ data }: { data: BankReconciliation }) => {
  const clean = data.unreconciled_count === 0;
  const reconciled = Math.max(0, data.total_transactions - data.unreconciled_count);
  return (
    <Card
      title="Bank Reconciliation"
      help="Unreconciled bank items from Xero’s IsReconciled flag. View-only — reconcile in Xero."
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Unreconciled items
          </p>
          <p
            className={[
              "font-display text-4xl font-semibold leading-none tabular-nums tracking-tight",
              clean ? "text-emerald-600" : "text-amber-600",
            ].join(" ")}
          >
            {data.unreconciled_count}
          </p>
          {!clean && (
            <p className="mt-1 text-[11px] text-ink-500">
              {gbp(data.unreconciled_value)} unreconciled value
            </p>
          )}
        </div>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
            clean
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-amber-50 text-amber-700 ring-amber-200",
          ].join(" ")}
        >
          {reconciled}/{data.total_transactions} reconciled
        </span>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-3 text-[11px]">
        <div>
          <span className="text-ink-400">Last reconciled</span>
          <p className="font-semibold text-ink-800">
            {formatAsOf(data.last_reconciled_date)}
          </p>
        </div>
        <div>
          <span className="text-ink-400">Most recent txn</span>
          <p className="font-semibold text-ink-800">
            {formatAsOf(data.most_recent_transaction)}
          </p>
        </div>
      </div>
    </Card>
  );
};
