import { useEffect, useMemo, useState } from "react";

import { fetchTrappedInvoices } from "../../services/audit.service";
import { dismissTrapped } from "../../services/document.service";
import {
  AiEnrichment,
  FlaggedIssue,
  HealthCheckResult,
  IssueType,
  Severity,
} from "../../types/audit.types";
import { ResolutionDrawer } from "@/features/checks/ResolutionDrawer";
import { SuggestFixModal } from "@/features/checks/SuggestFixModal";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

const SEVERITY_STYLES: Record<
  Severity,
  { badge: string; dot: string; label: string }
> = {
  critical: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    label: "Critical",
  },
  high: {
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    dot: "bg-orange-500",
    label: "High",
  },
  medium: {
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
    label: "Medium",
  },
};

const ISSUE_META: Record<
  IssueType,
  { label: string; icon: JSX.Element }
> = {
  unprocessed_bank: { label: "Unprocessed bank", icon: <ReceiptIcon /> },
  unreconciled_bank: { label: "Unreconciled bank", icon: <ReceiptIcon /> },
  bank_balance_check: { label: "Bank balance check", icon: <ReceiptIcon /> },
  opening_balance_difference: { label: "O/Bal differences", icon: <WarningIcon /> },
  duplicate_invoice: { label: "Duplicate invoice", icon: <CopyIcon /> },
  duplicate_bill: { label: "Duplicate bill", icon: <CopyIcon /> },
  duplicate_credit_note: { label: "Duplicate credit note", icon: <CopyIcon /> },
  duplicate_contact: { label: "Duplicate contact", icon: <BuildingIcon /> },
  duplicate_vendor: { label: "Duplicate vendor", icon: <BuildingIcon /> },
  missing_tax: { label: "Missing tax", icon: <ReceiptIcon /> },
  invalid_tax_code: { label: "Invalid tax code", icon: <ReceiptIcon /> },
  sales_tax_missing: { label: "Sales tax missing", icon: <ReceiptIcon /> },
  purchase_tax_missing: { label: "Purchase tax missing", icon: <ReceiptIcon /> },
  sales_tax_on_bills: { label: "Sales tax on bills", icon: <ReceiptIcon /> },
  purchase_tax_on_invoices: {
    label: "Purchase tax on invoices",
    icon: <ReceiptIcon />,
  },
  unexpected_tax_code: { label: "Unexpected tax code", icon: <ReceiptIcon /> },
  multi_tax_code_supplier: {
    label: "Multi-tax suppliers",
    icon: <BuildingIcon />,
  },
  wrong_category: { label: "Wrong category", icon: <FolderIcon /> },
  unexpected_account: { label: "Unexpected account", icon: <FolderIcon /> },
  multi_account_supplier: {
    label: "Multi-account suppliers",
    icon: <BuildingIcon />,
  },
  misallocated_item: {
    label: "Misallocated items",
    icon: <FolderIcon />,
  },
  invoice_or_direct: {
    label: "Invoice or direct booking",
    icon: <FolderIcon />,
  },
  bill_or_direct: {
    label: "Bill or direct booking",
    icon: <FolderIcon />,
  },
  bill_direct_payment: {
    label: "Bill or direct payment",
    icon: <FolderIcon />,
  },
  invoice_direct_deposit: {
    label: "Invoice or direct deposit",
    icon: <FolderIcon />,
  },
  anomaly: { label: "Anomaly", icon: <WarningIcon /> },
  amount_outlier: { label: "Amount outlier", icon: <WarningIcon /> },
  future_dated: { label: "Future-dated", icon: <CalendarIcon /> },
  old_unpaid_bill: { label: "Overdue bills (we owe)", icon: <ClockIcon /> },
  old_unpaid_invoice: {
    label: "Overdue invoices (we're owed)",
    icon: <ClockIcon />,
  },
  old_unsettled_sales_credit: {
    label: "Old sales credit",
    icon: <CreditNoteIcon />,
  },
  old_unsettled_purchase_credit: {
    label: "Old purchase credit",
    icon: <CreditNoteIcon />,
  },
  unapproved_invoice: { label: "Unapproved invoices", icon: <WarningIcon /> },
  unapproved_bill: { label: "Unapproved bills", icon: <WarningIcon /> },
  missing_vendor: { label: "Missing vendor", icon: <BuildingIcon /> },
  contact_defaults: {
    label: "Contact defaults missing",
    icon: <BuildingIcon />,
  },
  inactive_contact: {
    label: "Inactive contacts",
    icon: <BuildingIcon />,
  },
  missing_invoice_number: { label: "Missing invoice #", icon: <HashIcon /> },
  undocumented_bill: { label: "Undocumented bills", icon: <ReceiptIcon /> },
  low_cost_fixed_asset: {
    label: "Low-cost fixed asset",
    icon: <FixedAssetIcon />,
  },
  capital_item_review: {
    label: "Capital item review",
    icon: <FixedAssetIcon />,
  },
  currency_mismatch: { label: "Currency mismatch", icon: <SwapIcon /> },
};

function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 3v18l3-2 3 2 3-2 3 2 3-2 1 2V3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h2a2 2 0 0 1 2 2v10" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </svg>
  );
}
function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
      <path d="M12 9v5M12 17.5v.1" />
    </svg>
  );
}
function HashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function SwapIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4 4 7l3 3" />
      <path d="M4 7h13a3 3 0 0 1 3 3" />
      <path d="m17 20 3-3-3-3" />
      <path d="M20 17H7a3 3 0 0 1-3-3" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="m13 14 2 2 4-4" />
    </svg>
  );
}
function CreditNoteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3v18l3-2 3 2 3-2 3 2 3-2V3" />
      <path d="M9 9h6" />
      <path d="m9 15 6-3" />
      <path d="m9 12 3-1.5" />
    </svg>
  );
}
function FixedAssetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Z" />
      <path d="m3 7.5 9 4.5 9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

const fmtRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const rowSeverity = (issues: FlaggedIssue[]): Severity | null => {
  let worst: Severity | null = null;
  for (const it of issues) {
    if (!worst || SEVERITY_RANK[it.severity] > SEVERITY_RANK[worst]) {
      worst = it.severity;
    }
  }
  return worst;
};

const splitErrors = (raw: string | null): string[] =>
  raw
    ? raw
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const flaggedFromRow = (row: HealthCheckResult): FlaggedIssue[] => {
  if (row.result?.flagged && row.result.flagged.length > 0) {
    return row.result.flagged;
  }
  return splitErrors(row.error_msgs).map<FlaggedIssue>((m) => ({
    transaction_id: row.document_id ?? row.id,
    issue_type: "anomaly",
    severity: "medium",
    message: m,
  }));
};

const CategoryDiff = ({ issue }: { issue: FlaggedIssue }) => {
  const fmtSide = (
    code: string | null | undefined,
    name: string | null | undefined,
  ) => {
    if (!code) return null;
    return (
      <>
        <code className="rounded bg-surface px-1 font-mono text-[11px]">
          {code}
        </code>
        {name && (
          <span className="ml-1.5 text-[11px] text-ink-600">({name})</span>
        )}
      </>
    );
  };

  const left = fmtSide(issue.current_code, issue.current_name);
  const right = fmtSide(issue.suggested_code, issue.suggested_name);

  return (
    <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-2.5 py-1.5 text-xs text-ink-700">
      {left ? (
        <span className="inline-flex items-center text-ink-500 line-through decoration-ink-300">
          {left}
        </span>
      ) : null}
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 shrink-0 text-brand-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
      <span className="inline-flex items-center font-medium text-brand-700">
        {right ?? <span className="italic text-ink-400">no suggestion</span>}
      </span>
    </div>
  );
};

const ConfidenceBar = ({ value }: { value: number }) => {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const tone =
    value >= 0.9
      ? "bg-emerald-500"
      : value >= 0.7
        ? "bg-amber-400"
        : "bg-ink-300";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-100">
        <div
          className={`h-full rounded-full ${tone} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold tabular-nums text-ink-500">
        {Math.round(pct)}%
      </span>
    </div>
  );
};

const AIBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
    <svg
      viewBox="0 0 24 24"
      className="h-2.5 w-2.5"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />
    </svg>
    AI
  </span>
);

const SEVERITY_OPTIONS: Severity[] = ["critical", "high", "medium"];
interface IssueGroup {
  label: string;
  types: IssueType[];
}

const ISSUE_GROUPS: IssueGroup[] = [
  {
    label: "Bank & reconciliation",
    types: ["unprocessed_bank", "unreconciled_bank", "bank_balance_check", "opening_balance_difference"],
  },
  {
    label: "Duplicates",
    types: ["duplicate_invoice", "duplicate_bill", "duplicate_credit_note", "duplicate_contact", "duplicate_vendor"],
  },
  {
    label: "Tax & VAT",
    types: [
      "missing_tax", "invalid_tax_code", "sales_tax_missing", "purchase_tax_missing",
      "sales_tax_on_bills", "purchase_tax_on_invoices", "unexpected_tax_code", "multi_tax_code_supplier",
    ],
  },
  {
    label: "Categorisation & Coding",
    types: [
      "wrong_category", "unexpected_account", "multi_account_supplier",
      "misallocated_item", "invoice_or_direct", "bill_or_direct", "bill_direct_payment", "invoice_direct_deposit", "anomaly", "amount_outlier",
    ],
  },
  {
    label: "Date & ageing",
    types: [
      "future_dated", "old_unpaid_bill", "old_unpaid_invoice",
      "old_unsettled_sales_credit", "old_unsettled_purchase_credit",
    ],
  },
  {
    label: "Approval & status",
    types: ["unapproved_invoice", "unapproved_bill"],
  },
  {
    label: "Contacts",
    types: ["missing_vendor", "contact_defaults", "inactive_contact", "missing_invoice_number", "undocumented_bill"],
  },
  {
    label: "Fixed assets",
    types: ["low_cost_fixed_asset", "capital_item_review"],
  },
  {
    label: "Currency",
    types: ["currency_mismatch"],
  },
];

const ISSUE_TYPE_OPTIONS: IssueType[] = ISSUE_GROUPS.flatMap((g) => g.types);

interface FilterSidebarProps {
  severityCounts: Record<Severity, number>;
  issueCounts: Record<IssueType, number>;
  severityFilter: Severity | null;
  issueFilter: IssueType | null;
  onToggleSeverity: (s: Severity) => void;
  onToggleIssue: (t: IssueType) => void;
  hasFilters: boolean;
  onClear: () => void;
  totalRows: number;
}

const FilterSidebar = ({
  severityCounts,
  issueCounts,
  severityFilter,
  issueFilter,
  onToggleSeverity,
  onToggleIssue,
  hasFilters,
  onClear,
  totalRows,
}: FilterSidebarProps) => {
  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-card">
        <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Severity
          </p>
        </div>
        <ul className="p-1">
          {SEVERITY_OPTIONS.map((s) => {
            const meta = SEVERITY_STYLES[s];
            const active = severityFilter === s;
            const count = severityCounts[s] ?? 0;
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onToggleSeverity(s)}
                  disabled={count === 0 && !active}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition",
                    active
                      ? "bg-brand-50"
                      : "hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50",
                  ].join(" ")}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={[
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        meta.dot,
                      ].join(" ")}
                    />
                    <span
                      className={[
                        "truncate text-xs font-medium",
                        active ? "text-brand-700" : "text-ink-700",
                      ].join(" ")}
                    >
                      {meta.label}
                    </span>
                  </span>
                  <span
                    className={[
                      "shrink-0 text-[11px] font-semibold tabular-nums",
                      s === "critical"
                        ? "text-rose-500"
                        : s === "high"
                          ? "text-orange-500"
                          : "text-sky-500",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Improvement checklist
          </p>
          <span className="text-[10px] font-semibold tabular-nums text-ink-400">
            {totalRows}
          </span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {(() => {
            const knownTypes = new Set(ISSUE_GROUPS.flatMap((g) => g.types as string[]));
            const unknownTypes = Object.keys(issueCounts).filter(
              (t) => !knownTypes.has(t) && (issueCounts[t as IssueType] ?? 0) > 0,
            );
            const allGroups = [
              ...ISSUE_GROUPS,
              ...(unknownTypes.length > 0
                ? [{ label: "Other", types: unknownTypes as IssueType[] }]
                : []),
            ];
            return allGroups.map((group) => {
              const groupTotal = group.types.reduce(
                (acc, t) => acc + (issueCounts[t] ?? 0),
                0,
              );
              const hasActiveInGroup = group.types.includes(issueFilter as IssueType);
              if (groupTotal === 0 && !hasActiveInGroup) return null;
              return (
                <div key={group.label} className="border-b border-ink-100 last:border-0">
                  <p className="px-3.5 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-ink-400">
                    {group.label}
                  </p>
                  <ul className="pb-1.5">
                    {group.types.map((t) => {
                      const active = issueFilter === t;
                      const count = issueCounts[t] ?? 0;
                      const meta = ISSUE_META[t as IssueType] ?? ISSUE_META.anomaly;
                      if (count === 0 && !active) return null;
                      const label = meta?.label ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <li key={t}>
                          <button
                            type="button"
                            onClick={() => onToggleIssue(t as IssueType)}
                            className={[
                              "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition",
                              active ? "bg-brand-50" : "hover:bg-ink-50",
                            ].join(" ")}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={["shrink-0", active ? "text-brand-600" : "text-ink-400"].join(" ")}>
                                {meta?.icon ?? <WarningIcon />}
                              </span>
                              <span className={["truncate text-xs font-medium", active ? "text-brand-700" : "text-ink-700"].join(" ")}>
                                {label}
                              </span>
                            </span>
                            <span className={["shrink-0 text-[11px] font-semibold tabular-nums", active ? "text-brand-700" : "text-brand-500"].join(" ")}>
                              {count}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
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
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          Clear all filters
        </button>
      )}
    </aside>
  );
};

interface TrappedInvoicesListProps {
  companyId: string;
  refreshKey: number;
  aiSummaryReady?: boolean;
  showFilters?: boolean;
  onResolved?: () => void;
  initialIssueType?: IssueType | null;
}

const AI_SEVERITY_TONE: Record<
  AiEnrichment["severity_ai"],
  { badge: string; dot: string; label: string }
> = {
  critical: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    dot: "bg-rose-500",
    label: "Critical",
  },
  high: {
    badge: "bg-orange-50 text-orange-700 ring-orange-200",
    dot: "bg-orange-500",
    label: "High",
  },
  medium: {
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
    label: "Medium",
  },
  low: {
    badge: "bg-ink-100 text-ink-600 ring-ink-200",
    dot: "bg-ink-400",
    label: "Low",
  },
};

const AiRowPanel = ({
  ai,
  ruleSeverity,
  aiSummaryReady,
}: {
  ai: AiEnrichment | null | undefined;
  ruleSeverity: Severity | null;
  aiSummaryReady: boolean;
}) => {
  if (!ai) {
    if (!aiSummaryReady) {
      return (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2 text-[11px] text-brand-700">
          <svg
            className="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
          >
            <circle cx="12" cy="12" r="9" opacity="0.3" />
            <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
          </svg>
          AI insights pending…
        </div>
      );
    }
    return (
      <div className="mt-2 rounded-lg border border-ink-200 bg-ink-50/40 px-3 py-2 text-[11px] text-ink-500">
        AI enrichment unavailable for this row — showing rule-based output
        only.
      </div>
    );
  }

  const aiTone = AI_SEVERITY_TONE[ai.severity_ai];
  const confidencePct = Math.round(
    Math.max(0, Math.min(1, ai.confidence)) * 100,
  );
  const ruleLabel = ruleSeverity ? SEVERITY_STYLES[ruleSeverity].label : "—";

  return (
    <div
      className="relative mt-3 overflow-hidden rounded-lg border-2 px-4 py-3"
      style={{ animation: "ai-flag-pulse 2s ease-in-out infinite" }}
    >
      <style>{`
        @keyframes ai-flag-pulse {
          0%, 100% {
            background-color: rgb(var(--surface));
            border-color: rgb(var(--rose-300));
            box-shadow: 0 0 0 0   rgba(244, 63, 94, 0.00),
                        0 0 0 0   rgba(244, 63, 94, 0.00);
          }
          50% {
            background-color: rgb(var(--rose-50));
            border-color: rgb(var(--rose-500));
            box-shadow: 0 0 0 4px rgba(244, 63, 94, 0.18),
                        0 0 18px 2px rgba(244, 63, 94, 0.25);
          }
        }
        @keyframes ai-flag-stripe-pulse {
          0%, 100% {
            background-color: rgb(244, 63, 94);
            box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
          }
          50% {
            background-color: rgb(225, 29, 72);
            box-shadow: 0 0 10px 1px rgba(244, 63, 94, 0.65);
          }
        }
        @keyframes ai-flag-dot-pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.35); opacity: 1; }
        }
      `}</style>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5"
        style={{ animation: "ai-flag-stripe-pulse 2s ease-in-out infinite" }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
          <svg
            viewBox="0 0 24 24"
            className="h-2.5 w-2.5"
            fill="currentColor"
            aria-hidden
          >
            <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
            <path
              d="M12 9v5M12 17.5v.1"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          </svg>
          AI flagged
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-ink-500">
          Rule: <span className="text-ink-700">{ruleLabel}</span>
        </span>
        <span className="text-[10px] text-ink-300">·</span>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
            aiTone.badge,
          ].join(" ")}
          title="AI's severity opinion"
        >
          <span className={["h-1.5 w-1.5 rounded-full", aiTone.dot].join(" ")} />
          AI: {aiTone.label}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-rose-700 ring-1 ring-rose-200">
          {confidencePct}% confident
        </span>
      </div>
      <p className="mt-2.5 text-sm font-medium leading-relaxed text-ink-900">
        {ai.explanation}
      </p>
      {ai.regulatory_ref && (
        <p className="mt-2 text-[11px] text-ink-500">
          <span className="font-semibold text-rose-700">Ref · </span>
          {ai.regulatory_ref.startsWith("http") ? (
            <a
              href={ai.regulatory_ref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-700 underline-offset-2 hover:underline"
            >
              {ai.regulatory_ref}
            </a>
          ) : (
            <span>{ai.regulatory_ref}</span>
          )}
        </p>
      )}
    </div>
  );
};

interface ActiveResolve {
  row: HealthCheckResult;
  issue: FlaggedIssue;
  flaggedIndex: number;
}

const LATEST_RUN_WINDOW_MS = 5 * 60_000;

export const TrappedInvoicesList = ({
  companyId,
  refreshKey,
  aiSummaryReady = false,
  showFilters = true,
  onResolved,
  initialIssueType = null,
}: TrappedInvoicesListProps) => {
  const [rows, setRows] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<Severity | null>(null);
  const [issueFilter, setIssueFilter] = useState<IssueType | null>(
    initialIssueType,
  );

  useEffect(() => {
    setIssueFilter(initialIssueType);
  }, [initialIssueType]);
  const [search, setSearch] = useState("");
  const [resolving, setResolving] = useState<ActiveResolve | null>(null);
  const [suggestingFor, setSuggestingFor] = useState<HealthCheckResult | null>(
    null,
  );
  const [localRefresh, setLocalRefresh] = useState(0);
  const [latestOnly, setLatestOnly] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchTrappedInvoices({
      company_id: companyId.trim() || undefined,
      limit: 100,
    })
      .then((data) => {
        if (!active) return;
        if ("error" in data) {
          setError(data.error);
          setRows([]);
        } else {
          setRows(data.results ?? []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, refreshKey, localRefresh]);

  const enriched = useMemo(
    () =>
      rows.map((r) => {
        const issues = flaggedFromRow(r);
        return { row: r, issues, worst: rowSeverity(issues) };
      }),
    [rows],
  );

  const newestRanAtMs = useMemo(() => {
    if (enriched.length === 0) return null;
    return Math.max(...enriched.map((x) => new Date(x.row.ran_at).getTime()));
  }, [enriched]);

  const latestCutoffMs = useMemo(() => {
    if (!latestOnly || newestRanAtMs === null) return null;
    return newestRanAtMs - LATEST_RUN_WINDOW_MS;
  }, [latestOnly, newestRanAtMs]);

  type Enriched = (typeof enriched)[number];
  const q = search.trim().toLowerCase();
  const passSearch = (x: Enriched) => {
    if (!q) return true;
    return (x.row.document_id ?? x.row.id).toLowerCase().includes(q);
  };
  const passLatest = (x: Enriched) =>
    latestCutoffMs === null ||
    new Date(x.row.ran_at).getTime() >= latestCutoffMs;
  const passSeverity = (x: Enriched) =>
    !severityFilter || x.worst === severityFilter;
  const passIssue = (x: Enriched) =>
    !issueFilter || x.issues.some((i) => i.issue_type === issueFilter);

  const { severityCounts, issueCounts } = useMemo(() => {
    const sev: Record<Severity, number> = { critical: 0, high: 0, medium: 0 };
    const ity: Record<string, number> = {};
    for (const x of enriched) {
      if (!passSearch(x) || !passLatest(x)) continue;
      if (passIssue(x) && x.worst) sev[x.worst] += 1;
      if (passSeverity(x)) {
        const seen = new Set<string>();
        for (const i of x.issues) {
          if (!seen.has(i.issue_type)) {
            seen.add(i.issue_type);
            ity[i.issue_type] = (ity[i.issue_type] ?? 0) + 1;
          }
        }
      }
    }
    return { severityCounts: sev, issueCounts: ity as Record<IssueType, number> };
  }, [enriched, severityFilter, issueFilter, search, latestCutoffMs]);

  const filtered = useMemo(() => {
    return enriched
      .filter(
        (x) => passSeverity(x) && passIssue(x) && passSearch(x) && passLatest(x),
      )
      .sort((a, b) => {
        const sa = a.worst ? SEVERITY_RANK[a.worst] : 0;
        const sb = b.worst ? SEVERITY_RANK[b.worst] : 0;
        if (sb !== sa) return sb - sa;
        return new Date(b.row.ran_at).getTime() - new Date(a.row.ran_at).getTime();
      });
  }, [enriched, severityFilter, issueFilter, search, latestCutoffMs]);

  const latestCount = useMemo(() => {
    if (newestRanAtMs === null) return 0;
    const cutoff = newestRanAtMs - LATEST_RUN_WINDOW_MS;
    return enriched.filter(
      (x) => new Date(x.row.ran_at).getTime() >= cutoff,
    ).length;
  }, [enriched, newestRanAtMs]);

  const toggleSeverity = (s: Severity) => {
    setSeverityFilter((prev) => (prev === s ? null : s));
  };
  const toggleIssue = (t: IssueType) => {
    setIssueFilter((prev) => (prev === t ? null : t));
  };

  const handleResolved = () => {
    setResolving(null);
    setLocalRefresh((n) => n + 1);
    onResolved?.();
  };

  const isResolvable = (it: IssueType) =>
    it === "invalid_tax_code" ||
    it === "wrong_category" ||
    it === "missing_tax";

  const hasFilters =
    severityFilter !== null || issueFilter !== null || search.length > 0;

  const clearAll = () => {
    setSeverityFilter(null);
    setIssueFilter(null);
    setSearch("");
  };

  return (
    <>
      <div
        className={[
          "grid grid-cols-1 gap-4",
          showFilters ? "lg:grid-cols-[260px_1fr]" : "",
        ].join(" ")}
      >
        {showFilters && (
          <FilterSidebar
            severityCounts={severityCounts}
            issueCounts={issueCounts}
            severityFilter={severityFilter}
            issueFilter={issueFilter}
            onToggleSeverity={toggleSeverity}
            onToggleIssue={toggleIssue}
            hasFilters={hasFilters}
            onClear={clearAll}
            totalRows={enriched.length}
          />
        )}

      <section className="overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">
              Trapped documents
            </h3>
            <p className="text-xs text-ink-500">
              Invoices, bills and credit notes flagged by the latest audit.
              Highest severity first.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-ink-200 bg-surface p-0.5 text-[11px] font-medium text-ink-600 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setLatestOnly(false);
                  setSeverityFilter(null);
                  setIssueFilter(null);
                  setSearch("");
                }}
                className={[
                  "rounded-md px-2.5 py-1 transition",
                  !latestOnly
                    ? "bg-brand-50 text-brand-700"
                    : "hover:text-ink-900",
                ].join(" ")}
              >
                All trapped
                <span className="ml-1 text-ink-400">{enriched.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setLatestOnly(true)}
                className={[
                  "rounded-md px-2.5 py-1 transition",
                  latestOnly
                    ? "bg-brand-50 text-brand-700"
                    : "hover:text-ink-900",
                ].join(" ")}
                title="Only rows from the most recent audit run"
              >
                Latest run
                <span className="ml-1 text-ink-400">{latestCount}</span>
              </button>
            </div>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by document ID"
                className="w-56 rounded-lg border border-ink-200 bg-surface py-1.5 pl-8 pr-3 text-xs text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {loading
                ? "Loading…"
                : `${filtered.length} of ${enriched.length}`}
            </span>
          </div>
        </header>

        {error && (
          <div className="border-b border-rose-200 bg-rose-50 px-5 py-2.5 text-xs text-rose-800">
            <span className="font-semibold">Could not load:</span> {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink-700">
              {enriched.length === 0
                ? "No trapped documents yet"
                : "Nothing matches the current filters"}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {enriched.length === 0
                ? "Run a historical audit to surface findings from your ledger."
                : "Clear filters to see all trapped documents."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {filtered.map(({ row, issues, worst }) => {
              const isOpen = expandedId === row.id;
              const sev = worst ? SEVERITY_STYLES[worst] : null;
              const docId = row.document_id ?? row.id;
              const summary = issues
                .slice(0, 2)
                .map((i) => i.message)
                .join(" · ");
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isOpen ? null : row.id)
                    }
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-ink-50/50"
                  >
                    {sev ? (
                      <span
                        className={[
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1",
                          sev.badge,
                        ].join(" ")}
                        title={sev.label}
                      >
                        {issues.length}
                      </span>
                    ) : (
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-xs font-bold text-ink-600 ring-1 ring-ink-200">
                        —
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700">
                          {row.document_type}
                        </span>
                        <span className="font-mono text-[11px] text-ink-500">
                          {docId.slice(0, 12)}
                        </span>
                        {sev && (
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1",
                              sev.badge,
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "h-1.5 w-1.5 rounded-full",
                                sev.dot,
                              ].join(" ")}
                            />
                            {sev.label}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-wider text-ink-400">
                          {issues.length} issue
                          {issues.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-ink-800">
                        {summary || row.error_msgs || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-wider text-ink-400">
                        {fmtRelative(row.ran_at)}
                      </p>
                    </div>
                    <span
                      className={[
                        "shrink-0 text-ink-400 transition",
                        isOpen ? "rotate-180" : "",
                      ].join(" ")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-ink-100 bg-ink-50/40 px-5 py-4">
                      {row.xero_url && (
                        <div className="mb-3 flex items-center justify-end">
                          <a
                            href={row.xero_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-surface px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-50"
                            title="Deep-link to this document in Xero"
                          >
                            Open in Xero
                            <svg
                              viewBox="0 0 24 24"
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 3h7v7" />
                              <path d="M10 14 21 3" />
                              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                            </svg>
                          </a>
                        </div>
                      )}
                      <ul className="space-y-2">
                        {issues.map((issue, idx) => {
                          const issueSev = SEVERITY_STYLES[issue.severity];
                          const meta =
                            ISSUE_META[issue.issue_type] ??
                            ISSUE_META.anomaly;
                          const isAI =
                            issue.confidence !== null &&
                            issue.confidence !== undefined;
                          return (
                            <li
                              key={`${issue.transaction_id}-${idx}`}
                              className="rounded-lg border border-ink-200 bg-surface p-3.5"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={[
                                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                                    issueSev.badge,
                                  ].join(" ")}
                                >
                                  <span
                                    className={[
                                      "h-1.5 w-1.5 rounded-full",
                                      issueSev.dot,
                                    ].join(" ")}
                                  />
                                  {issueSev.label}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700">
                                  <span className="text-brand-500">
                                    {meta.icon}
                                  </span>
                                  {meta.label}
                                </span>
                                {isAI && <AIBadge />}
                                <button
                                  type="button"
                                  onClick={() => setSuggestingFor(row)}
                                  className="ml-auto inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:bg-brand-100"
                                  title="Get an AI-drafted fix plan"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-3 w-3"
                                    fill="currentColor"
                                    aria-hidden
                                  >
                                    <path d="M12 2 14 9l7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" />
                                  </svg>
                                  Suggest fix
                                </button>
                              </div>
                              <p className="mt-2 text-sm text-ink-800">
                                {issue.message}
                              </p>
                              {issue.issue_type === "wrong_category" &&
                                (issue.current_code ||
                                  issue.suggested_code) && (
                                  <CategoryDiff issue={issue} />
                                )}
                              {issue.reasoning && (
                                <p className="mt-1.5 text-xs italic text-ink-500">
                                  “{issue.reasoning}”
                                </p>
                              )}
                              {isAI && (
                                <div className="mt-2">
                                  <ConfidenceBar
                                    value={issue.confidence ?? 0}
                                  />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <AiRowPanel
                        ai={row.ai}
                        ruleSeverity={worst}
                        aiSummaryReady={aiSummaryReady}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </div>

      {suggestingFor && (
        <SuggestFixModal
          row={suggestingFor}
          onClose={() => setSuggestingFor(null)}
          onResolved={handleResolved}
        />
      )}

      {resolving && (
        <ResolutionDrawer
          companyId={companyId}
          row={resolving.row}
          issue={resolving.issue}
          flaggedIndex={resolving.flaggedIndex}
          onClose={() => setResolving(null)}
          onResolved={handleResolved}
        />
      )}
    </>
  );
};
