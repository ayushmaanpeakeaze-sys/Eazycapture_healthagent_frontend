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

export interface SalesTrackerRow {
  period: string;
  actual: number;
  target: number;
  variance: number;
  variance_pct: number;
  met_target: boolean;
}

export interface SalesTrackerResponse {
  company_id?: string;
  kpi?: "sales_tracker";
  periods: string[];
  actual: number[];
  target: number;
  /** e.g. "auto (avg of active months)" or "manual". */
  target_basis: string;
  total_sales: number;
  rows: SalesTrackerRow[];
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

export interface InsightsPayload {
  profitability: ProfitabilityResponse;
  sales_tracker: SalesTrackerResponse;
  financial_position: FinancialPositionResponse;
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
