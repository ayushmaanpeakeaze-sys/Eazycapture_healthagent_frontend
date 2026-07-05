import { ManualBankBalanceCheck } from "@/features/checks/pages/ManualBankBalanceCheck";

export const BankBalanceCheckPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => <ManualBankBalanceCheck companyId={companyId} refreshKey={refreshKey} />;
