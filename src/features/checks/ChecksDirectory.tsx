import { ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchAuditConfig,
  fetchHealthStats,
  fetchOpeningBalanceDiffs,
  fetchUnreconciledBankItems,
} from "../../services/audit.service";
import { fetchContactDefaults } from "../../services/contactDefaults.service";
import { HealthStatsResponse, IssueType } from "../../types/audit.types";
import { CheckSettingsPanel, SETTINGS_ALIAS } from "@/features/checks/CheckSettingsPanel";
import {
  ALL_CHECKS,
  CHECK_GROUPS,
  Importance,
  importanceOf,
} from "@/features/checks/checksCatalog";
import { BankBalanceCheckPage } from "@/features/checks/pages/BankBalanceCheckPage";
import { CapitalItemReviewPage } from "@/features/checks/pages/CapitalItemReviewPage";
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
import { PrepaymentReviewPage } from "@/features/checks/pages/PrepaymentReviewPage";
import { PaymentAnomaliesPage } from "@/features/checks/pages/PaymentAnomaliesPage";
import { PaymentsNonPayrollPage } from "@/features/checks/pages/PaymentsNonPayrollPage";
import { AccrualsPage } from "@/features/checks/pages/AccrualsPage";
import { TaxMissingPage, TaxMissingRuleId } from "@/features/checks/pages/TaxMissingPage";
import { UndocumentedBillsPage } from "@/features/checks/pages/UndocumentedBillsPage";
import { UnreconciledBankItemsPage } from "@/features/checks/pages/UnreconciledBankItemsPage";
import {
  WrongTaxDirectionPage,
  WrongTaxRuleId,
} from "@/features/checks/pages/WrongTaxDirectionPage";
import { DuplicateInvoicesPage, DuplicateRuleId } from "@/features/checks/pages/DuplicateInvoicesPage";
import {
  OldUnpaidInvoicesPage,
  OldUnpaidRuleId,
} from "@/features/checks/pages/OldUnpaidInvoicesPage";
import {
  PaymentMatchReviewPage,
  PaymentMatchRuleId,
} from "@/features/checks/pages/PaymentMatchReviewPage";
import {
  UnapprovedDocsPage,
  UnapprovedRuleId,
} from "@/features/checks/pages/UnapprovedDocsPage";
import {
  UnexpectedCodingPage,
  UnexpectedRuleId,
} from "@/features/checks/pages/UnexpectedCodingPage";
import { TrappedInvoicesList } from "@/features/checks/TrappedInvoicesList";

const IMP_STYLE: Record<Importance, { label: string; chip: string }> = {
  critical: { label: "Critical", chip: "bg-rose-50 text-rose-700 ring-rose-200" },
  high: { label: "High", chip: "bg-orange-50 text-orange-700 ring-orange-200" },
  medium: { label: "Medium", chip: "bg-amber-50 text-amber-700 ring-amber-200" },
};

const DUP_KEYS = new Set([
  "duplicate_invoice",
  "duplicate_bill",
  "duplicate_credit_note",
  "duplicate_contact",
]);
const issueCount = (key: string, rawRows: number) =>
  DUP_KEYS.has(key) ? Math.ceil(rawRows / 2) : rawRows;

type CheckFilter = "all" | "attention" | "critical" | "high" | "medium";

export const ChecksDirectory = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HealthStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CheckFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [configurable, setConfigurable] = useState<Set<string>>(new Set());
  const [settingsCheck, setSettingsCheck] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [extraCounts, setExtraCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchHealthStats(companyId)
      .then((s) => {
        if (active) setStats(s);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, refreshKey, nonce]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchUnreconciledBankItems(companyId),
      fetchOpeningBalanceDiffs(companyId, false),
      fetchContactDefaults(companyId, true, false),
    ]).then(([unrec, obal, cd]) => {
      if (!active) return;
      const next: Record<string, number> = {
        unreconciled_bank: unrec?.total_to_reconcile ?? 0,
        opening_balance_difference: obal?.items?.length ?? 0,
      };
      if (cd.ok && cd.data.connected)
        next.contact_defaults = cd.data.missing_count;
      setExtraCounts(next);
    });
    return () => {
      active = false;
    };
  }, [companyId, refreshKey, nonce]);

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

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of stats?.by_issue_type ?? []) m[r.issue_type] = r.count;
    return m;
  }, [stats]);

  const countFor = (key: string) =>
    extraCounts[key] ?? issueCount(key, byType[key] ?? 0);

  const rows = useMemo(
    () =>
      ALL_CHECKS.map((c) => ({
        ...c,
        count: countFor(c.key),
        importance: importanceOf(c.key),
      })),
    [byType, extraCounts],
  );

  const withIssues = rows.filter((r) => r.count > 0).length;
  const okCount = rows.length - withIssues;
  const checksHealth =
    loading || rows.length === 0
      ? null
      : Math.round((okCount / rows.length) * 100);
  const filtered = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "attention"
        ? r.count > 0
        : r.importance === filter,
  );
  const totalIssues = rows.reduce((a, r) => a + r.count, 0);
  const itemsChecked =
    (stats?.audited_documents ?? 0) + (stats?.audited_contacts ?? 0);

  const goToCheck = (key: string) =>
    navigate(`/clients/${companyId}/checks/${key}`);

  return (
    <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-2xl border border-ink-100 bg-surface p-5 text-center shadow-card">
          <Gauge score={checksHealth} />
          <p className="mt-1.5 text-[11px] text-ink-400">
            {loading ? "—" : `${okCount} of ${rows.length} checks clear`}
          </p>
          <div className="mt-3 border-t border-ink-100 pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
              Issues identified
            </p>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
              {loading ? "—" : totalIssues}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-surface p-4 shadow-card">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
            All checks
          </p>
          <div className="space-y-3">
            {CHECK_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                  <span className="text-brand-500">{g.icon}</span>
                  {g.group}
                </p>
                <ul className="space-y-0.5">
                  {g.checks.map((c) => {
                    const count = countFor(c.key);
                    return (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => goToCheck(c.key)}
                          title={c.blurb}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs text-ink-600 transition hover:bg-brand-50 hover:text-brand-700"
                        >
                          <span className="truncate">{c.label}</span>
                          {count > 0 && (
                            <span className="shrink-0 rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold tabular-nums text-rose-700">
                              {count}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <BasisTile label="Items checked" value={loading ? "—" : itemsChecked || "—"} />
          <BasisTile label="Number of checks" value={ALL_CHECKS.length} />
          <BasisTile
            label="Checks health"
            value={checksHealth != null ? `${checksHealth}%` : "—"}
            tone="brand"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            All <Num>{rows.length}</Num>
          </FilterPill>
          <FilterPill
            active={filter === "attention"}
            onClick={() => setFilter("attention")}
          >
            Needs attention <Num>{withIssues}</Num>
          </FilterPill>
          <FilterPill active={filter === "critical"} onClick={() => setFilter("critical")}>
            Critical
          </FilterPill>
          <FilterPill active={filter === "high"} onClick={() => setFilter("high")}>
            High
          </FilterPill>
          <FilterPill active={filter === "medium"} onClick={() => setFilter("medium")}>
            Medium
          </FilterPill>
        </div>

        <section className="overflow-hidden rounded-2xl border border-ink-100 bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-ink-900">Detailed results</h3>
            <span className="text-[11px] text-ink-400">
              {filtered.length} check{filtered.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-ink-50">
            {filtered.map((r) => (
              <CheckRow
                key={r.key}
                companyId={companyId}
                checkKey={r.key}
                label={r.label}
                blurb={r.blurb}
                count={r.count}
                importance={r.importance}
                loading={loading}
                configurable={configurable.has(r.key)}
                onSettings={() => setSettingsCheck(r.key)}
                expanded={expanded === r.key}
                onToggle={() =>
                  setExpanded((cur) => (cur === r.key ? null : r.key))
                }
                onOpenPage={() => goToCheck(r.key)}
              />
            ))}
            {filtered.length === 0 && (
              <li className="px-5 py-10 text-center text-sm italic text-ink-400">
                No checks match this filter.
              </li>
            )}
          </ul>
        </section>
      </div>

      {settingsCheck && (
        <CheckSettingsPanel
          companyId={companyId}
          scopeCheck={settingsCheck}
          onClose={() => setSettingsCheck(null)}
          onSaved={() => setNonce((n) => n + 1)}
        />
      )}
    </div>
  );
};

const CheckRow = ({
  companyId,
  checkKey,
  label,
  blurb,
  count,
  importance,
  loading,
  configurable,
  onSettings,
  expanded,
  onToggle,
  onOpenPage,
}: {
  companyId: string;
  checkKey: string;
  label: string;
  blurb: string;
  count: number;
  importance: Importance;
  loading: boolean;
  configurable: boolean;
  onSettings: () => void;
  expanded: boolean;
  onToggle: () => void;
  onOpenPage: () => void;
}) => {
  const ok = count === 0;
  const imp = IMP_STYLE[importance];
  return (
    <li>
      <div className="flex items-center gap-3 px-5 py-3 transition hover:bg-brand-50/30">
        <button
          type="button"
          onClick={ok ? undefined : onToggle}
          disabled={ok}
          className={[
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-400 transition",
            ok ? "opacity-0" : "hover:text-brand-600",
          ].join(" ")}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <svg
            viewBox="0 0 24 24"
            className={[
              "h-4 w-4 transition-transform",
              expanded ? "rotate-90" : "",
            ].join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={ok ? undefined : onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-medium text-ink-900">{label}</p>
          <p className="truncate text-[11px] text-ink-400">{blurb}</p>
        </button>
        <div className="hidden w-24 shrink-0 justify-center sm:flex">
          <span
            className={[
              "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
              imp.chip,
            ].join(" ")}
          >
            {imp.label}
          </span>
        </div>
        <div className="w-24 shrink-0 text-center text-sm font-semibold tabular-nums">
          {loading ? (
            <span className="text-ink-300">…</span>
          ) : ok ? (
            <span className="text-emerald-600">OK</span>
          ) : (
            <span className="text-rose-700">
              {count} {count === 1 ? "issue" : "issues"}
            </span>
          )}
        </div>
        <div className="flex w-7 shrink-0 justify-center">
          {!loading && (
            <span
              className={[
                "flex h-6 w-6 items-center justify-center rounded-md ring-1",
                ok
                  ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                  : "bg-amber-50 text-amber-600 ring-amber-200",
              ].join(" ")}
              title={ok ? "No findings" : "Needs attention"}
            >
              {ok ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 6" />
                </svg>
              ) : (
                <span className="text-sm font-bold leading-none">!</span>
              )}
            </span>
          )}
        </div>
        <div className="flex w-8 shrink-0 justify-center">
          {configurable && (
            <button
              type="button"
              onClick={onSettings}
              title={`Configure ${label}`}
              className="rounded-md p-1 text-ink-400 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
              </svg>
            </button>
          )}
        </div>
        <div className="w-24 shrink-0 text-right">
          <button
            type="button"
            onClick={ok ? onOpenPage : onToggle}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-semibold transition",
              ok
                ? "text-ink-400 hover:text-ink-600"
                : "text-brand-700 hover:bg-brand-50",
            ].join(" ")}
          >
            {ok ? "Open" : expanded ? "Hide" : "View issues"}
          </button>
        </div>
      </div>

      {expanded && !ok && (
        <div className="border-t border-ink-100 bg-ink-50/40 px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] text-ink-500">
              {count} issue{count === 1 ? "" : "s"} found
            </p>
            <button
              type="button"
              onClick={onOpenPage}
              className="text-[11px] font-semibold text-brand-700 hover:underline"
            >
              Open full page →
            </button>
          </div>
          {checkKey === "bank_balance_check" ? (
            <BankBalanceCheckPage companyId={companyId} />
          ) : checkKey === "unreconciled_bank" ? (
            <UnreconciledBankItemsPage companyId={companyId} />
          ) : checkKey === "opening_balance_difference" ? (
            <OpeningBalanceDiffsPage companyId={companyId} />
          ) : checkKey === "contact_defaults" ? (
            <ContactDefaultsPage companyId={companyId} />
          ) : checkKey === "duplicate_contact" ? (
            <DuplicateContactsPage companyId={companyId} />
          ) : checkKey === "inactive_contact" ? (
            <InactiveContactsPage companyId={companyId} />
          ) : checkKey === "old_unpaid_invoice" ||
            checkKey === "old_unpaid_bill" ? (
            <OldUnpaidInvoicesPage
              companyId={companyId}
              ruleId={checkKey as OldUnpaidRuleId}
            />
          ) : checkKey === "unexpected_account" ||
            checkKey === "unexpected_tax_code" ? (
            <UnexpectedCodingPage
              companyId={companyId}
              ruleId={checkKey as UnexpectedRuleId}
            />
          ) : checkKey === "bill_direct_payment" ||
            checkKey === "invoice_direct_deposit" ? (
            <PaymentMatchReviewPage
              companyId={companyId}
              ruleId={checkKey as PaymentMatchRuleId}
            />
          ) : checkKey === "low_cost_fixed_asset" ? (
            <LowCostFixedAssetPage companyId={companyId} />
          ) : checkKey === "capital_item_review" ? (
            <CapitalItemReviewPage companyId={companyId} />
          ) : checkKey === "prepayment_review" ? (
            <PrepaymentReviewPage companyId={companyId} />
          ) : checkKey === "unusual_payment" ? (
            <PaymentAnomaliesPage companyId={companyId} />
          ) : checkKey === "non_payroll_payment" ? (
            <PaymentsNonPayrollPage companyId={companyId} />
          ) : checkKey === "missing_accrual" ? (
            <AccrualsPage companyId={companyId} />
          ) : checkKey === "misallocated_item" ? (
            <MisallocatedItemsPage companyId={companyId} />
          ) : checkKey === "undocumented_bill" ? (
            <UndocumentedBillsPage companyId={companyId} />
          ) : checkKey === "sales_tax_missing" ||
            checkKey === "purchase_tax_missing" ? (
            <TaxMissingPage
              companyId={companyId}
              ruleId={checkKey as TaxMissingRuleId}
            />
          ) : checkKey === "sales_tax_on_bills" ||
            checkKey === "purchase_tax_on_invoices" ? (
            <WrongTaxDirectionPage
              companyId={companyId}
              ruleId={checkKey as WrongTaxRuleId}
            />
          ) : checkKey === "unapproved_invoice" ||
            checkKey === "unapproved_bill" ? (
            <UnapprovedDocsPage
              companyId={companyId}
              ruleId={checkKey as UnapprovedRuleId}
            />
          ) : checkKey === "multi_account_supplier" ||
            checkKey === "multi_tax_code_supplier" ? (
            <MultiCodeSuppliersPage
              companyId={companyId}
              kind={checkKey as MultiCodeRuleId}
            />
          ) : checkKey === "old_unsettled_sales_credit" ||
            checkKey === "old_unsettled_purchase_credit" ? (
            <OldCreditsPage
              companyId={companyId}
              issueType={checkKey as OldCreditRuleId}
            />
          ) : DUP_KEYS.has(checkKey) ? (
            <DuplicateInvoicesPage
              companyId={companyId}
              ruleId={checkKey as DuplicateRuleId}
            />
          ) : (
            <TrappedInvoicesList
              companyId={companyId}
              refreshKey={0}
              showFilters={false}
              initialIssueType={checkKey as IssueType}
            />
          )}
        </div>
      )}
    </li>
  );
};

const Num = ({ children }: { children: ReactNode }) => (
  <span className="ml-0.5 opacity-60">{children}</span>
);

const FilterPill = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 transition",
      active
        ? "bg-brand-600 text-white ring-brand-600"
        : "bg-surface text-ink-600 ring-ink-200 hover:border-brand-300 hover:text-brand-700",
    ].join(" ")}
  >
    {children}
  </button>
);

const BasisTile = ({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  tone?: "ink" | "brand";
}) => (
  <div className="rounded-xl border border-ink-100 bg-surface px-4 py-3 text-center shadow-card">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
      {label}
    </p>
    <p
      className={[
        "mt-1 font-display text-2xl font-semibold leading-none tabular-nums",
        tone === "brand" ? "text-brand-700" : "text-ink-900",
      ].join(" ")}
    >
      {value}
    </p>
  </div>
);

const Gauge = ({ score }: { score: number | null }) => {
  const has = score != null;
  const pct = has ? Math.max(0, Math.min(100, score)) : 0;
  const tone = !has ? "ink" : pct >= 80 ? "emerald" : pct >= 60 ? "amber" : "rose";
  const stroke =
    tone === "emerald"
      ? "#10b981"
      : tone === "amber"
        ? "#f59e0b"
        : tone === "rose"
          ? "#f43f5e"
          : "#94a3b8";
  const heart =
    tone === "emerald"
      ? "text-emerald-500"
      : tone === "amber"
        ? "text-amber-500"
        : tone === "rose"
          ? "text-rose-500"
          : "text-ink-300";
  const r = 40;
  const c = 2 * Math.PI * r;
  const track = 0.75 * c;
  const val = (pct / 100) * track;
  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 104 104" className="h-full w-full">
        <g transform="rotate(135 52 52)">
          <circle cx="52" cy="52" r={r} fill="none" style={{ stroke: "rgb(var(--ink-900) / 0.08)" }} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${track} ${c}`} />
          <circle cx="52" cy="52" r={r} fill="none" stroke={stroke} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${val} ${c}`} style={{ transition: "stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)" }} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold tabular-nums text-ink-900">
          {has ? `${pct}%` : "—"}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-wider text-ink-400">
          health
        </span>
        <svg viewBox="0 0 24 24" className={["mt-0.5 h-3.5 w-3.5", heart].join(" ")} fill="currentColor" aria-hidden>
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    </div>
  );
};
