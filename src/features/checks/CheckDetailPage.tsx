import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  dispatchHistoricalAudit,
  fetchAuditConfig,
  fetchSyncStatus,
} from "../../services/audit.service";
import { IssueType } from "../../types/audit.types";
import { BankBalanceCheckPage } from "@/features/checks/pages/BankBalanceCheckPage";
import { CapitalItemReviewPage } from "@/features/checks/pages/CapitalItemReviewPage";
import { CheckSettingsPanel, SETTINGS_ALIAS } from "@/features/checks/CheckSettingsPanel";
import { CHECK_BY_KEY } from "@/features/checks/checksCatalog";
import { ContactDefaultsPage } from "@/features/checks/pages/ContactDefaultsPage";
import { DuplicateContactsPage } from "@/features/checks/pages/DuplicateContactsPage";
import { InactiveContactsPage } from "@/features/checks/pages/InactiveContactsPage";
import { LowCostFixedAssetPage } from "@/features/checks/pages/LowCostFixedAssetPage";
import { MisallocatedItemsPage } from "@/features/checks/pages/MisallocatedItemsPage";
import {
  MultiCodeRuleId,
  MultiCodeSuppliersPage,
} from "@/features/checks/pages/MultiCodeSuppliersPage";
import { OldCreditRuleId, OldCreditsPage } from "@/features/checks/pages/OldCreditsPage";
import { OpeningBalanceDiffsPage } from "@/features/checks/pages/OpeningBalanceDiffsPage";
import { TaxMissingPage, TaxMissingRuleId } from "@/features/checks/pages/TaxMissingPage";
import { UndocumentedBillsPage } from "@/features/checks/pages/UndocumentedBillsPage";
import { UnreconciledBankItemsPage } from "@/features/checks/pages/UnreconciledBankItemsPage";
import {
  WrongTaxDirectionPage,
  WrongTaxRuleId,
} from "@/features/checks/pages/WrongTaxDirectionPage";
import {
  DuplicateInvoicesPage,
  DuplicateRuleId,
} from "@/features/checks/pages/DuplicateInvoicesPage";
import {
  OldUnpaidInvoicesPage,
  OldUnpaidRuleId,
} from "@/features/checks/pages/OldUnpaidInvoicesPage";
import {
  PaymentMatchReviewPage,
  PaymentMatchRuleId,
} from "@/features/checks/pages/PaymentMatchReviewPage";
import { TrappedInvoicesList } from "@/features/checks/TrappedInvoicesList";
import {
  UnapprovedDocsPage,
  UnapprovedRuleId,
} from "@/features/checks/pages/UnapprovedDocsPage";
import {
  UnexpectedCodingPage,
  UnexpectedRuleId,
} from "@/features/checks/pages/UnexpectedCodingPage";

const DONE = new Set(["completed", "complete", "done", "success", "finished"]);

const humanize = (k: string): string =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// Dedicated page for a single check — the focused list of items it flagged.
export const CheckDetailPage = ({
  companyId,
  checkKey,
}: {
  companyId: string;
  checkKey: string;
}) => {
  const navigate = useNavigate();
  const def = CHECK_BY_KEY[checkKey];

  const isDuplicate =
    checkKey === "duplicate_invoice" ||
    checkKey === "duplicate_bill" ||
    checkKey === "duplicate_credit_note";
  // These come from a FULL audit, not the fast duplicates-only run.
  const isContact = checkKey === "duplicate_contact";
  const isOldUnpaid =
    checkKey === "old_unpaid_invoice" || checkKey === "old_unpaid_bill";
  const isCoding =
    checkKey === "unexpected_account" || checkKey === "unexpected_tax_code";
  const isPaymentMatch =
    checkKey === "bill_direct_payment" || checkKey === "invoice_direct_deposit";
  const isInactive = checkKey === "inactive_contact";
  const isLowCost = checkKey === "low_cost_fixed_asset";
  const isCapital = checkKey === "capital_item_review";
  const isMisallocated = checkKey === "misallocated_item";
  const isUndocumented = checkKey === "undocumented_bill";
  const isUnapproved =
    checkKey === "unapproved_invoice" || checkKey === "unapproved_bill";
  const isMultiCode =
    checkKey === "multi_account_supplier" ||
    checkKey === "multi_tax_code_supplier";
  const isOldCredit =
    checkKey === "old_unsettled_sales_credit" ||
    checkKey === "old_unsettled_purchase_credit";
  const isTaxMissing =
    checkKey === "sales_tax_missing" || checkKey === "purchase_tax_missing";
  const isWrongTax =
    checkKey === "sales_tax_on_bills" || checkKey === "purchase_tax_on_invoices";
  const fullRun =
    isContact ||
    isOldUnpaid ||
    isCoding ||
    isPaymentMatch ||
    isInactive ||
    isLowCost ||
    isCapital ||
    isMisallocated ||
    isUndocumented ||
    isUnapproved ||
    isMultiCode ||
    isOldCredit ||
    isTaxMissing ||
    isWrongTax;
  const showControls = isDuplicate || fullRun;

  const [refreshKey, setRefreshKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  // Which checks expose backend-driven settings → drives the Settings button.
  const [configurable, setConfigurable] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    fetchAuditConfig(companyId).then((c) => {
      if (!active || !c) return;
      const own = new Set((c.settings_schema ?? []).map((e) => e.check));
      const conf = new Set(own);
      for (const [alias, target] of Object.entries(SETTINGS_ALIAS))
        if (own.has(target)) conf.add(alias);
      setConfigurable(conf);
    });
    return () => {
      active = false;
    };
  }, [companyId]);
  const canConfigure = configurable.has(checkKey);

  // Run — contacts need a FULL audit; invoice/bill/credit-note use the fast scope.
  const onRunCheck = async () => {
    setRunErr(null);
    setRunning(true);
    setRunMsg("Starting audit…");
    const d = await dispatchHistoricalAudit(
      companyId,
      fullRun ? undefined : { scope: "duplicates" },
    );
    if ("error" in d) {
      setRunErr(d.error);
      setRunning(false);
      return;
    }
    setRunMsg(fullRun ? "Reanalysing your Xero data…" : "Checking for duplicates…");
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const s = await fetchSyncStatus(companyId, d.batch_id);
      const st = (s?.status ?? "").toString().toLowerCase();
      if (s?.stage_label) setRunMsg(String(s.stage_label));
      if (st && DONE.has(st)) break;
      if (st === "failed" || st === "error") {
        setRunErr("Audit failed — try again.");
        setRunning(false);
        return;
      }
    }
    setRunning(false);
    setRunMsg(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate(`/clients/${companyId}/checks`)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        All checks
      </button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {def?.group && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-500">
              {def.group}
            </p>
          )}
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink-900">
            {def?.label ?? humanize(checkKey)}
          </h1>
          {def?.blurb && <p className="mt-1 text-sm text-ink-500">{def.blurb}</p>}
        </div>

        {/* Per-check controls: configure (any check with settings) + run. */}
        {(showControls || canConfigure) && (
          <div className="flex items-center gap-2">
            {canConfigure && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                disabled={running}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </svg>
                Settings
              </button>
            )}
            {showControls && (
              <button
                type="button"
                onClick={onRunCheck}
                disabled={running}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-3.5 py-1.5 text-xs font-semibold text-white shadow-brand transition hover:brightness-110 disabled:opacity-60"
              >
                {running && (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                    <circle cx="12" cy="12" r="9" opacity="0.25" />
                    <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                  </svg>
                )}
                {running
                  ? "Running…"
                  : fullRun
                    ? "Reanalyse Xero data"
                    : "Run check"}
              </button>
            )}
          </div>
        )}
      </header>

      {runErr && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {runErr}
        </p>
      )}
      {running && runMsg && (
        <p className="flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
          {runMsg}
        </p>
      )}

      {/* Some checks get a dedicated editor; the rest show the focused list. */}
      {checkKey === "bank_balance_check" ? (
        <BankBalanceCheckPage companyId={companyId} refreshKey={refreshKey} />
      ) : checkKey === "unreconciled_bank" ? (
        <UnreconciledBankItemsPage companyId={companyId} refreshKey={refreshKey} />
      ) : checkKey === "opening_balance_difference" ? (
        <OpeningBalanceDiffsPage companyId={companyId} refreshKey={refreshKey} />
      ) : checkKey === "contact_defaults" ? (
        <ContactDefaultsPage companyId={companyId} />
      ) : isContact ? (
        <DuplicateContactsPage companyId={companyId} refreshKey={refreshKey} />
      ) : isInactive ? (
        <InactiveContactsPage companyId={companyId} refreshKey={refreshKey} />
      ) : isLowCost ? (
        <LowCostFixedAssetPage companyId={companyId} refreshKey={refreshKey} />
      ) : isCapital ? (
        <CapitalItemReviewPage companyId={companyId} refreshKey={refreshKey} />
      ) : isMisallocated ? (
        <MisallocatedItemsPage companyId={companyId} refreshKey={refreshKey} />
      ) : isUndocumented ? (
        <UndocumentedBillsPage companyId={companyId} refreshKey={refreshKey} />
      ) : isUnapproved ? (
        <UnapprovedDocsPage
          companyId={companyId}
          ruleId={checkKey as UnapprovedRuleId}
          refreshKey={refreshKey}
        />
      ) : isMultiCode ? (
        <MultiCodeSuppliersPage
          companyId={companyId}
          kind={checkKey as MultiCodeRuleId}
          refreshKey={refreshKey}
        />
      ) : isOldCredit ? (
        <OldCreditsPage
          companyId={companyId}
          issueType={checkKey as OldCreditRuleId}
          refreshKey={refreshKey}
        />
      ) : isTaxMissing ? (
        <TaxMissingPage
          companyId={companyId}
          ruleId={checkKey as TaxMissingRuleId}
          refreshKey={refreshKey}
        />
      ) : isWrongTax ? (
        <WrongTaxDirectionPage
          companyId={companyId}
          ruleId={checkKey as WrongTaxRuleId}
          refreshKey={refreshKey}
        />
      ) : isOldUnpaid ? (
        <OldUnpaidInvoicesPage
          companyId={companyId}
          ruleId={checkKey as OldUnpaidRuleId}
          refreshKey={refreshKey}
        />
      ) : isCoding ? (
        <UnexpectedCodingPage
          companyId={companyId}
          ruleId={checkKey as UnexpectedRuleId}
          refreshKey={refreshKey}
        />
      ) : isPaymentMatch ? (
        <PaymentMatchReviewPage
          companyId={companyId}
          ruleId={checkKey as PaymentMatchRuleId}
          refreshKey={refreshKey}
        />
      ) : isDuplicate ? (
        <DuplicateInvoicesPage
          companyId={companyId}
          ruleId={checkKey as DuplicateRuleId}
          refreshKey={refreshKey}
        />
      ) : (
        <TrappedInvoicesList
          companyId={companyId}
          refreshKey={0}
          showFilters={false}
          initialIssueType={checkKey as IssueType}
        />
      )}

      {settingsOpen && (
        <CheckSettingsPanel
          companyId={companyId}
          scopeCheck={checkKey}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
};
