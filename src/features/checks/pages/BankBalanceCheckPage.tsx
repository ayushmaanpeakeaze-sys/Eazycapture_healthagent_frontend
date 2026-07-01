import { ManualBankBalanceCheck } from "@/features/checks/pages/ManualBankBalanceCheck";

// Merged: one endpoint carries both the manual (statement vs Xero TB) and the
// auto reconciliation (calculated balance + unreconciled lines) per account.
export const BankBalanceCheckPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => <ManualBankBalanceCheck companyId={companyId} refreshKey={refreshKey} />;
