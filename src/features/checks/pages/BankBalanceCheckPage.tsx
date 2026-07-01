import { useState } from "react";

import { BankReconciliationSummaryPage } from "@/features/checks/pages/BankReconciliationSummaryPage";
import { ManualBankBalanceCheck } from "@/features/checks/pages/ManualBankBalanceCheck";

type Tab = "summary" | "manual";

// Two related Bank Balance features under the same check:
//  • "Reconciliation Summary" (auto) — reproduces Xero's own report, no entry.
//  • "Bank Balance Check" (manual) — enter each statement balance per period end.
export const BankBalanceCheckPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const [tab, setTab] = useState<Tab>("summary");

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={[
        "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
        tab === t
          ? "bg-white text-brand-700 shadow-sm ring-1 ring-ink-100"
          : "text-ink-500 hover:text-ink-700",
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-xl bg-ink-50 p-1">
        {tabBtn("summary", "Reconciliation Summary")}
        {tabBtn("manual", "Bank Balance Check")}
      </div>

      {tab === "summary" ? (
        <BankReconciliationSummaryPage companyId={companyId} refreshKey={refreshKey} />
      ) : (
        <ManualBankBalanceCheck companyId={companyId} refreshKey={refreshKey} />
      )}
    </div>
  );
};
