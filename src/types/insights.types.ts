// Response shapes for the Insights snapshot API. The KPI shapes are sub-objects
// of a snapshot `payload`; fields only on the legacy live endpoints are optional here.

export interface ProfitabilityResponse {
  company_id?: string;
  kpi?: "profitability";
  report_name?: string;
  /** Human date the report was pulled, e.g. "12 June 2026". */
  report_date?: string;
  /** Newest-first month labels, e.g. ["30 Jun 26", "30 May 26", …]. */
  periods: string[];
  series: {
    sales: number[];
    gross_profit: number[];
    net_profit: number[];
  };
  totals: {
    sales: number;
    gross_profit: number;
    net_profit: number;
  };
}

/** The strategy a sales target is derived from. */
export type SalesTargetBasis =
  | "none"
  | "previous_month"
  | "average_3"
  | "average_6"
  | "average_12"
  | "same_month_last_year"
  | "xero_budget"
  | "manual";

export interface SalesTrackerRow {
  period: string;
  actual: number;
  /** null when there's insufficient history / basis=none / no budget. */
  target: number | null;
  variance: number | null;
  variance_pct: number | null;
  met_target: boolean | null;
}

/** Trailing-5-months chart: blue actual bars + green target line. */
export interface SalesTrackerChart {
  periods: string[];
  actual: number[];
  /** Per-month target; elements may be null → draw a gap, don't plot 0. */
  target: (number | null)[];
}

/** Current-month progress panel (all day maths computed at snapshot time). */
export interface SalesTrackerCurrentMonth {
  period: string | null;
  actual: number;
  target: number | null;
  /** % of target — can exceed 100. null when no target. */
  pct_of_target: number | null;
  /** Currency still needed to hit target; never negative. null when no target. */
  remaining_value: number | null;
  days_in_month: number;
  days_elapsed: number;
  days_remaining: number;
  /** Sales-bar fill, capped 0–100. null when no target. */
  sales_bar_pct: number | null;
  /** Time-bar fill (how far through the month), 0–100. */
  time_bar_pct: number;
  met_target: boolean;
  /** One of the five status narratives — render verbatim. */
  status: string;
}

export interface SalesTrackerResponse {
  company_id?: string;
  kpi?: "sales_tracker";
  /** Active strategy, e.g. "average_3" | "manual". */
  target_basis: string;
  adjustment_pct?: number;
  /** Newer snapshots carry these; guard for absence on older ones. */
  chart?: SalesTrackerChart;
  current_month?: SalesTrackerCurrentMonth;
  total_sales?: number;
  // --- legacy flat fields (older snapshots) ---
  periods?: string[];
  actual?: number[];
  /** Scalar (current month's target) on legacy snapshots — NOT an array. */
  target?: number | null;
  rows?: SalesTrackerRow[];
}

/** Sales-target settings (GET/PUT /insights/{cid}/sales-target/). */
export interface SalesTargetSettings {
  basis: SalesTargetBasis | string;
  adjustment_pct: number;
  manual_value: number | null;
}

export interface FinancialPositionResponse {
  company_id?: string;
  kpi?: "financial_position";
  report_date?: string;
  position: {
    total_assets: number;
    total_liabilities: number;
    net_assets: number;
    cash: number;
    current_assets: number;
    fixed_assets: number;
    current_liabilities: number;
  };
  cash_health: {
    cash: number;
    current_liabilities: number;
    coverage_ratio: number;
    shortfall: number;
  };
  working_capital: {
    current_assets: number;
    current_liabilities: number;
    working_capital: number;
    current_ratio: number;
    healthy: boolean;
  };
  dividend: {
    retained_earnings: number;
    current_year_earnings: number;
    distributable_reserves: number;
    basis: string;
  };
  valuation: {
    model: string;
    net_asset_value: number;
  };
}

export interface CorporationTaxResponse {
  company_id?: string;
  kpi?: "corporation_tax";
  /** e.g. "trailing 12 months". */
  period_basis: string;
  taxable_profit: number;
  tax_estimate: number;
  /** e.g. "small profits rate (19%)". */
  band: string;
  effective_rate: number;
  /** Disclaimer — provisional estimate. May be absent on the snapshot. */
  note?: string;
}

export interface DirectorsLoanAccount {
  account: string;
  code: string;
  balance: number;
  /** Overdrawn = director owes the company (possible s455 tax). */
  overdrawn: boolean;
  note?: string;
}

export interface DirectorsLoansResponse {
  company_id?: string;
  kpi?: "directors_loans";
  detected: boolean;
  accounts: DirectorsLoanAccount[];
  note: string;
}

export interface BookkeepingHealthSnapshot {
  health_score: number | null;
  open_issues: number;
  audited_documents: number;
  audited_contacts: number;
  last_audit_at: string | null;
}

// Display-only, derived from Xero's IsReconciled flag (not the raw feed); no reconcile action.
export interface BankReconciliation {
  total_transactions: number;
  unreconciled_count: number;
  unreconciled_value: number;
  /** ISO date (YYYY-MM-DD) of the most recent reconciled item; null if none. */
  last_reconciled_date: string | null;
  /** ISO date of the most recent bank transaction; null if none. */
  most_recent_transaction: string | null;
}

/** The 8 fixed outgoing categories, short-term (highest priority) first. */
export type CashCategory =
  | "suppliers"
  | "net_wages"
  | "paye_nic"
  | "pension"
  | "credit_cards"
  | "vat"
  | "corporation_tax"
  | "loans_other";

export interface CashOutgoingCategory {
  category: CashCategory | string;
  label: string;
  /** Value used (override if set, else auto). */
  amount: number;
  /** The auto Xero figure before any override. */
  auto_amount: number;
  included: boolean;
  overridden: boolean;
  /** Cumulative: true only if cash covers this + everything above. null = excluded. */
  can_pay: boolean | null;
}

export interface CashBankAccount {
  code: string;
  name: string;
  balance: number;
  disregarded: boolean;
}

export interface CashMovement {
  period: string;
  change: number;
  direction: "up" | "down" | "flat" | string;
}

export interface CashHealthCheckResponse {
  current_cash: number;
  /** 0–100 gauge %. */
  health_score: number;
  rating: "strong" | "moderate" | "weak" | "critical" | string;
  bank_accounts: CashBankAccount[];
  outgoings: {
    categories: CashOutgoingCategory[];
    total_expected_outgoings: number;
    all_covered: boolean;
  };
  recent_movements: CashMovement[];
  movement_points?: { period: string; balance: number }[];
  indicator?: {
    score: number;
    rating: string;
    weighted_outgoings: number;
    note: string;
  };
}

/** Cash Health settings (GET/PUT /insights/{cid}/cash-health-settings/). */
export interface CashHealthSettings {
  /** category → include? (missing = included). */
  included: Record<string, boolean>;
  /** category → manual £ value (replaces the auto figure). */
  overrides: Record<string, number>;
  /** account code → category (re-assign a nominal account). */
  account_overrides: Record<string, string>;
  /** bank account codes left OUT of current cash. */
  disregarded_banks: string[];
}

export interface InsightsPayload {
  profitability: ProfitabilityResponse;
  sales_tracker: SalesTrackerResponse;
  financial_position: FinancialPositionResponse;
  cash_health_check?: CashHealthCheckResponse | null;
  corporation_tax: CorporationTaxResponse;
  directors_loans: DirectorsLoansResponse;
  bookkeeping_health: BookkeepingHealthSnapshot;
  bank_reconciliation?: BankReconciliation | null;
}

export interface ClientInsightsSnapshot {
  company_id: string;
  /** ISO timestamp the snapshot was computed; null when never computed. */
  computed_at: string | null;
  /** "ok" = fresh payload present · "none" = never computed. */
  status: "ok" | "none" | string;
  stale: boolean;
  /** True while a recompute is in flight. Absent on older backends. */
  refreshing?: boolean;
  payload: InsightsPayload | null;
}

export interface FirmSummaryClient {
  company_id: string;
  name: string;
  computed_at: string | null;
  net_profit: number | null;
  working_capital: number | null;
  cash_coverage: number | null;
  dla_overdrawn: boolean | null;
  unreconciled_bank_items: number | null;
  last_bank_reconciled: string | null;
  most_recent_transaction: string | null;
}

export interface FirmSummaryTotals {
  total_clients: number;
  with_snapshot: number;
  in_profit: number;
  in_loss: number;
  cash_tight: number;
  working_capital_negative: number;
  dla_overdrawn: number;
  unreconciled_bank_items: number;
}

export interface FirmSummaryResponse {
  totals: FirmSummaryTotals;
  clients: FirmSummaryClient[];
}
