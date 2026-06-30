import { BookkeepingHealthSnapshot } from "../../../types/insights.types";
import { ArcGauge } from "../components/ArcGauge";
import { Card } from "../components/Card";
import { relativeTime, Tone } from "../lib/format";

export const BookkeepingHealthCard = ({
  data,
}: {
  data: BookkeepingHealthSnapshot;
}) => {
  const score = data.health_score ?? 0;
  const tone: Tone = score >= 80 ? "green" : score >= 60 ? "amber" : "red";
  return (
    <Card title="Bookkeeping Health" help="From the latest ledger audit.">
      <div className="flex items-center gap-4">
        <ArcGauge
          value={score}
          tone={tone}
          center={`${score}`}
          label="health"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Open issues
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-rose-600">
            {data.open_issues}
          </p>
          <p className="text-[11px] text-ink-500">
            {data.audited_documents} docs · {data.audited_contacts} contacts
            audited
          </p>
          <p className="text-[10px] text-ink-400">
            last audit {relativeTime(data.last_audit_at)}
          </p>
        </div>
      </div>
    </Card>
  );
};
