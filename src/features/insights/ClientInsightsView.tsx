import { FinancialInsights } from "@/features/insights/FinancialInsights";

export const ClientInsightsView = ({ companyId }: { companyId: string }) => (
  <FinancialInsights companyId={companyId} />
);
