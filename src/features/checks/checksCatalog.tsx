import { ReactNode } from "react";

import { IssueType } from "../../types/audit.types";

export interface CheckDef {
  key: IssueType;
  label: string;
  blurb: string;
}

export interface CheckGroup {
  group: string;
  icon: ReactNode;
  checks: CheckDef[];
}

const I = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);

const bankIcon = I(
  <>
    <path d="M3 21h18" />
    <path d="M5 21V10M19 21V10M9 21V10M15 21V10" />
    <path d="M12 3 21 8H3l9-5Z" />
  </>,
);
const dupIcon = I(
  <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>,
);
const clockIcon = I(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
const contactIcon = I(
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M14 20a5 5 0 0 1 8-3.8" />
  </>,
);
const folderIcon = I(
  <>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
  </>,
);
const taxIcon = I(
  <>
    <path d="M19 5 5 19" />
    <circle cx="7" cy="7" r="2.2" />
    <circle cx="17" cy="17" r="2.2" />
  </>,
);
const approveIcon = I(
  <>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </>,
);
const assetIcon = I(
  <>
    <path d="m12 3 9 4-9 4-9-4 9-4Z" />
    <path d="m3 12 9 4 9-4" />
    <path d="m3 17 9 4 9-4" />
  </>,
);

export const CHECK_GROUPS: CheckGroup[] = [
  {
    group: "Bank & reconciliation",
    icon: bankIcon,
    checks: [
      {
        key: "unreconciled_bank",
        label: "Unreconciled Bank Items",
        blurb: "Bank transactions not yet reconciled in the ledger.",
      },
      {
        key: "unprocessed_bank",
        label: "Unprocessed Bank Items",
        blurb: "Imported bank lines that haven’t been coded or matched.",
      },
      {
        key: "bank_balance_check",
        label: "Bank Balance Check",
        blurb: "Balance in Xero vs the calculated statement balance — the unreconciled difference per account.",
      },
      {
        key: "opening_balance_difference",
        label: "Opening Balance Differences",
        blurb: "Opening balances that don’t tie out.",
      },
    ],
  },
  {
    group: "Duplicates",
    icon: dupIcon,
    checks: [
      {
        key: "duplicate_invoice",
        label: "Duplicate Invoices",
        blurb: "Invoices that look like duplicates of each other.",
      },
      {
        key: "duplicate_bill",
        label: "Duplicate Bills",
        blurb: "Bills that look like duplicates of each other.",
      },
      {
        key: "duplicate_credit_note",
        label: "Duplicate Credit Notes",
        blurb: "Credit notes that look like duplicates of each other.",
      },
      {
        key: "duplicate_contact",
        label: "Duplicate Contacts",
        blurb: "Contacts that appear more than once.",
      },
    ],
  },
  {
    group: "Date & ageing",
    icon: clockIcon,
    checks: [
      {
        key: "old_unpaid_invoice",
        label: "Old Unpaid Invoices",
        blurb: "Sales invoices long overdue for payment.",
      },
      {
        key: "old_unpaid_bill",
        label: "Old Unpaid Bills",
        blurb: "Purchase bills long overdue for payment.",
      },
      {
        key: "old_unsettled_sales_credit",
        label: "Old Sales Credits",
        blurb: "Sales credit notes left unapplied.",
      },
      {
        key: "old_unsettled_purchase_credit",
        label: "Old Purchase Credits",
        blurb: "Purchase credit notes left unapplied.",
      },
      {
        key: "prepayment_review",
        label: "Prepayment Review",
        blurb: "Expenses that may cover a period beyond the year-end.",
      },
    ],
  },
  {
    group: "Contacts",
    icon: contactIcon,
    checks: [
      {
        key: "contact_defaults",
        label: "Contact Defaults",
        blurb: "Contacts missing default account / tax settings.",
      },
      {
        key: "inactive_contact",
        label: "Inactive Contacts",
        blurb: "Contacts with no recent transaction activity — consider archiving.",
      },
    ],
  },
  {
    group: "Categorisation & coding",
    icon: folderIcon,
    checks: [
      {
        key: "unexpected_account",
        label: "Unexpected Account Used",
        blurb: "Postings to an account that’s unusual for this contact.",
      },
      {
        key: "multi_account_supplier",
        label: "Multi-Account Suppliers",
        blurb: "Suppliers coded across several different accounts.",
      },
      {
        key: "misallocated_item",
        label: "Misallocated Items",
        blurb: "Lines that look posted to the wrong place.",
      },
      {
        key: "bill_direct_payment",
        label: "Bill or Direct Payment",
        blurb: "Unpaid bill with a matching direct bank payment — possibly paid twice.",
      },
      {
        key: "invoice_direct_deposit",
        label: "Invoice or Direct Deposit",
        blurb: "Unpaid invoice with a matching direct bank deposit — possibly paid twice.",
      },
    ],
  },
  {
    group: "Tax & VAT",
    icon: taxIcon,
    checks: [
      {
        key: "unexpected_tax_code",
        label: "Unexpected Tax Code Used",
        blurb: "Tax code that’s unusual for this contact / account.",
      },
      {
        key: "multi_tax_code_supplier",
        label: "Multi-Tax Code Suppliers",
        blurb: "Suppliers coded with several different tax codes.",
      },
      {
        key: "sales_tax_missing",
        label: "Sales Tax Missing",
        blurb: "Sales lines that should carry tax but don’t.",
      },
      {
        key: "purchase_tax_missing",
        label: "Purchase Tax Missing",
        blurb: "Purchase lines that should carry tax but don’t.",
      },
      {
        key: "sales_tax_on_bills",
        label: "Sales Tax on Bills",
        blurb: "Sales tax code applied to a purchase bill.",
      },
      {
        key: "purchase_tax_on_invoices",
        label: "Purchase Tax on Invoices",
        blurb: "Purchase tax code applied to a sales invoice.",
      },
    ],
  },
  {
    group: "Approval & status",
    icon: approveIcon,
    checks: [
      {
        key: "unapproved_invoice",
        label: "Unapproved Invoices",
        blurb: "Invoices still in draft / awaiting approval.",
      },
      {
        key: "unapproved_bill",
        label: "Unapproved Bills",
        blurb: "Bills still in draft / awaiting approval.",
      },
    ],
  },
  {
    group: "Fixed assets",
    icon: assetIcon,
    checks: [
      {
        key: "low_cost_fixed_asset",
        label: "Low Cost Fixed Assets",
        blurb: "Items capitalised that may be below the asset threshold.",
      },
      {
        key: "capital_item_review",
        label: "Capital Item Review",
        blurb: "Expense lines that may belong in fixed assets.",
      },
    ],
  },
  {
    group: "Document integrity",
    icon: I(
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />,
    ),
    checks: [
      {
        key: "undocumented_bill",
        label: "Undocumented Bills",
        blurb: "Supplier bills added with no file attachment.",
      },
    ],
  },
];

export const CHECK_BY_KEY: Record<string, CheckDef & { group: string }> = (() => {
  const map: Record<string, CheckDef & { group: string }> = {};
  for (const g of CHECK_GROUPS) {
    for (const c of g.checks) map[c.key] = { ...c, group: g.group };
  }
  return map;
})();

export const ALL_CHECKS: (CheckDef & { group: string })[] =
  CHECK_GROUPS.flatMap((g) => g.checks.map((c) => ({ ...c, group: g.group })));

export type Importance = "critical" | "high" | "medium";

const IMPORTANCE: Record<string, Importance> = {
  unreconciled_bank: "critical",
  unprocessed_bank: "high",
  bank_balance_check: "high",
  opening_balance_difference: "high",
  duplicate_invoice: "high",
  duplicate_bill: "high",
  duplicate_credit_note: "high",
  duplicate_contact: "high",
  old_unpaid_invoice: "high",
  old_unpaid_bill: "high",
  old_unsettled_sales_credit: "high",
  old_unsettled_purchase_credit: "high",
  unapproved_invoice: "high",
  unapproved_bill: "high",
};

export const importanceOf = (key: string): Importance => IMPORTANCE[key] ?? "medium";
