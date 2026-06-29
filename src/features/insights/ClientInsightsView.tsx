import { FinancialInsights } from "@/features/insights/FinancialInsights";

// Client insights surfaces the live financial KPIs; the health breakdown lives in BookkeepingHealthInsights.
export const ClientInsightsView = ({ companyId }: { companyId: string }) => (
  <FinancialInsights companyId={companyId} />
);
