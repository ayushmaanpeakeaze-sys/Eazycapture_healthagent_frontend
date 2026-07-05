export interface ProfitabilityResponse {
  company_id?: string;
  kpi?: "profitability";
  report_name?: string;
  report_date?: string;
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
  target: number | null;
  variance: number | null;
  variance_pct: number | null;
  met_target: boolean | null;
}

export interface SalesTrackerChart {
  periods: string[];
  actual: number[];
  target: (number | null)[];
}

export interface SalesTrackerCurrentMonth {
  period: string | null;
  actual: number;
  target: number | null;
  pct_of_target: number | null;
  remaining_value: number | null;
  days_in_month: number;
  days_elapsed: number;
  days_remaining: number;
  sales_bar_pct: number | null;
  time_bar_pct: number;
  met_target: boolean;
  status: string;
}

export interface SalesTrackerResponse {
  company_id?: string;
  kpi?: "sales_tracker";
  target_basis: string;
  adjustment_pct?: number;
  chart?: SalesTrackerChart;
  current_month?: SalesTrackerCurrentMonth;
  total_sales?: number;
  periods?: string[];
  actual?: number[];
  target?: number | null;
  rows?: SalesTrackerRow[];
}

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
  period_basis: string;
  taxable_profit: number;
  tax_estimate: number;
  band: string;
  effective_rate: number;
  note?: string;
}

export interface DirectorsLoanAccount {
  account: string;
  code: string;
  balance: number;
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

export interface BankReconciliation {
  total_transactions: number;
  unreconciled_count: number;
  unreconciled_value: number;
  last_reconciled_date: string | null;
  most_recent_transaction: string | null;
}

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
  amount: number;
  auto_amount: number;
  included: boolean;
  overridden: boolean;
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

export interface CashHealthSettings {
  included: Record<string, boolean>;
  overrides: Record<string, number>;
  account_overrides: Record<string, string>;
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
  computed_at: string | null;
  status: "ok" | "none" | string;
  stale: boolean;
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
