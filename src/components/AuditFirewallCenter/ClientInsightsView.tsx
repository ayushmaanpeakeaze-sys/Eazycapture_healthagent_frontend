import { FinancialInsights } from "./FinancialInsights";

// Client insights = the live financial KPIs. The bookkeeping-health breakdown
// (health score, issues-by-type, severity, lifecycle) was removed from this
// page; it lives in BookkeepingHealthInsights.tsx if it's ever wanted back, and
// the same health score still shows on the Overview tab.
export const ClientInsightsView = ({ companyId }: { companyId: string }) => (
  <FinancialInsights companyId={companyId} />
);
