export type IssueType =
  | "unprocessed_bank"
  | "unreconciled_bank"
  | "bank_balance_check"
  | "opening_balance_difference"
  | "duplicate_invoice"
  | "duplicate_bill"
  | "duplicate_credit_note"
  | "duplicate_contact"
  | "duplicate_vendor"
  | "missing_tax"
  | "invalid_tax_code"
  | "sales_tax_missing"
  | "purchase_tax_missing"
  | "sales_tax_on_bills"
  | "purchase_tax_on_invoices"
  | "unexpected_tax_code"
  | "multi_tax_code_supplier"
  | "wrong_category"
  | "unexpected_account"
  | "multi_account_supplier"
  | "misallocated_item"
  | "invoice_or_direct"
  | "bill_or_direct"
  | "bill_direct_payment"
  | "invoice_direct_deposit"
  | "anomaly"
  | "amount_outlier"
  | "future_dated"
  | "old_unpaid_bill"
  | "old_unpaid_invoice"
  | "old_unsettled_sales_credit"
  | "old_unsettled_purchase_credit"
  | "unapproved_invoice"
  | "unapproved_bill"
  | "missing_vendor"
  | "contact_defaults"
  | "inactive_contact"
  | "missing_invoice_number"
  | "undocumented_bill"
  | "low_cost_fixed_asset"
  | "capital_item_review"
  | "currency_mismatch";

export type Severity = "critical" | "high" | "medium";

export interface InvoicePayload {
  date: string;
  description: string;
  amount: number;
  vendor_name: string;
  invoice_number?: string | null;
  tax_code?: string | null;
}

export interface InvoiceValidationResponse {
  suggested_category: string | null;
  confidence_score: number;
  reasoning: string;
  validation_errors: string[];
}

export interface BatchTransaction {
  transaction_id: string;
  date: string;
  description: string;
  amount: number | string;
  vendor_name: string;
  type?: "ACCPAY" | "ACCREC" | string;
  tax_code?: string | null;
  invoice_number?: string | null;
  current_account_code?: string | null;
}

export interface BatchHealthCheckContext {
  chart_of_accounts?: Array<{ code: string; name?: string }>;
  tax_rates?: Array<{ tax_type: string; name?: string }>;
}

export interface BatchHealthCheckRequest {
  transactions: BatchTransaction[];
  context?: BatchHealthCheckContext;
}

export interface MatchReasons {
  same_contact: boolean;
  same_amount: boolean;
  amount?: string | null;
  other_amount?: string | null;
  currency?: string | null;
  days_apart: number;
  reference_match: "exact" | "none" | "different";
  same_invoice_number?: boolean;
  distinct_documents_possible?: boolean;
  cross_contact: boolean;
  /** How the two contacts were matched on a cross-contact flag. */
  party_by?: "vat" | "name" | string;
  /** 0..1 name similarity — only meaningful when party_by === "name". */
  name_similarity?: number | null;
  same_reference?: boolean;
  same_description?: boolean;
  advisory?: string | null;
  confidence: number;
  tier: "high" | "medium" | "low" | string;
  review?: boolean;
  points?: {
    contact?: number | null;
    amount?: number | null;
    reference?: number | null;
    date?: number | null;
  } | null;
  recurring?: boolean;
  one_paid_one_outstanding?: boolean;
  one_reconciled_one_outstanding?: boolean;
  risk?: "high" | "normal" | string;
  age_days?: number | null;
  age_basis?: "invoice_date" | "due_date" | string;
  outstanding?: string | null;
  bill_transaction_id?: string;
  bill_date?: string | null;
  bill_amount?: string | null;
  amount_due?: string | null;
  bill_description?: string | null;
  payment_transaction_id?: string;
  payment_date?: string | null;
  payment_amount?: string | null;
  payment_description?: string | null;
  invoice_transaction_id?: string;
  invoice_date?: string | null;
  invoice_amount?: string | null;
  invoice_description?: string | null;
  deposit_transaction_id?: string;
  deposit_date?: string | null;
  deposit_amount?: string | null;
  deposit_description?: string | null;
  line_no?: number | null;
  account_code?: string | null;
  account_name?: string | null;
  line_amount?: string | null;
  threshold?: string | null;
  recode_to_account_type?: string | null;
  net_amount?: string | null;
  tax_amount?: string | null;
  tax_code?: string | null;
}

export interface ContactHelper {
  has_invoices: boolean;
  has_bills: boolean;
  has_person: boolean;
  has_email: boolean;
  has_address: boolean;
  has_phone: boolean;
  email: string | null;
  phone: string | null;
  tax_number: string | null;
}

export interface FlaggedIssue {
  transaction_id: string;
  issue_type: IssueType;
  severity: Severity;
  message: string;
  suggested_code?: string | null;
  suggested_name?: string | null;
  current_code?: string | null;
  current_name?: string | null;
  accounts_used?: string[] | null;
  confidence?: number | null;
  reasoning?: string | null;
  this_is_likely_original?: boolean;
  duplicate_of_transaction_id?: string | null;
  duplicate_of_invoice_number?: string | null;
  duplicate_of_date?: string | null;
  match_reasons?: MatchReasons | null;
  contact_name?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  name_similarity?: number | null;
  vat_status?: "match" | "mismatch" | "unknown" | string;
  is_split?: boolean;
  last_activity_date?: string | null;
  age_days?: number | null;
  helper?: ContactHelper | null;
  partner_helper?: ContactHelper | null;
}

export interface BatchHealthCheckResponse {
  flagged: FlaggedIssue[];
}

export interface BankBalanceItem {
  id: string;
  account_code: string;
  account_name: string;
  period_end: string;
  per_bank_statement: number | string | null;
  per_xero_statement: number | string | null;
  per_xero_tb: number | string | null;
  difference: number | string | null;
  marked_ok: boolean;
  process_url: string | null;
  currency_code?: string | null;
  notes_count?: number;
  documents_count?: number;
  statement_balance_calculated?: number | string | null;
  unreconciled_received?: number | null;
  unreconciled_spent?: number | null;
  unreconciled_lines_total?: number | null;
  unreconciled_count?: number;
  needs_reconciliation?: boolean;
  lines?: BankReconLine[];
}

export interface BankNote {
  id: string;
  account_code: string;
  period_end: string;
  author_user_id: string;
  body: string;
  tagged_user_ids: string[];
  created_at: string;
}

export interface BankDocument {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by: string;
  created_at: string;
}

export interface BankBalanceCheckResponse {
  period_end: string;
  total_value: number | string | null;
  items: BankBalanceItem[];
}

export interface UnreconciledBankItem {
  account_id: string;
  account_code: string;
  account_name: string;
  unreconciled_received: number;
  unreconciled_spent: number;
  unexplained: number | null;
  total_to_reconcile: number;
  process_url: string | null;
}

export interface UnreconciledBankResponse {
  total_to_reconcile: number;
  unexplained_available: boolean;
  items: UnreconciledBankItem[];
}

export interface BankReconLine {
  date: string;
  contact: string;
  type: string;
  amount: number;
}

export interface OpeningBalanceItem {
  id: string;
  period_end: string;
  net_assets_filed: number | string | null;
  net_assets_xero: number | string | null;
  difference: number | string | null;
  filed_source: "companies_house" | "manual" | string;
  filed_document_url: string | null;
  dismissed: boolean;
}
export interface OpeningBalanceResponse {
  total_value: number | string | null;
  ch_connected: boolean;
  registration_number: string | null;
  items: OpeningBalanceItem[];
}

export interface LateTransaction {
  transaction_id: string;
  type_label: string;
  amount: number | string | null;
  accounting_date: string | null;
  posted_date: string | null;
  xero_url: string | null;
}
export interface LateTransactionsResponse {
  period_end: string;
  total: number;
  items: LateTransaction[];
}

export interface CodingOptions {
  connected: boolean;
  accounts: { code: string; name: string; type: string }[];
  tax_rates: { code: string; name: string }[];
}

export interface OutboundDemoSummary {
  scanned: number;
  flagged_count: number;
  flagged_rows: number;
  duplicate_groups: number;
}

export interface OutboundDemoResponse {
  transactions?: BatchTransaction[];
  flagged?: FlaggedIssue[];
  flags_by_txn?: Record<string, FlaggedIssue[]>;
  summary?: OutboundDemoSummary;
  result?: BatchHealthCheckResponse;
}

export type BatchProgressEvent =
  | { event: "started"; total_txns: number }
  | {
      event: "categorize_started";
      unique_txns: number;
      total_txns: number;
      chunks: number;
    }
  | { event: "categorize_progress"; processed: number; unique_txns: number }
  | {
      event: "complete";
      flagged_count: number;
      result: BatchHealthCheckResponse;
    }
  | { event: "end" }
  | { event: "error"; error: string };

export interface BatchAsyncDispatchResponse {
  batch_id: string;
}

export interface XeroPublishResponse {
  task_id: string;
  status: "queued" | "completed" | "failed";
  external_ref?: string | null;
}

export type PublishingDocumentType = "invoice" | "receipt" | "bill";

export interface PrecheckRequest {
  publishing_document_id: string;
  publishing_document_type: PublishingDocumentType;
}

export interface PrecheckResponse {
  blocked: boolean;
  error_msgs?: string | null;
  error_code?: string | null;
  result: InvoiceValidationResponse | null;
}

export type HealthCheckKind = "preview" | "pre_ledger" | "post_ledger";

export type HealthCheckStatus =
  | "blocked"
  | "passed"
  | "unavailable"
  | "skipped";

export interface HealthCheckResultPayload {
  flagged?: FlaggedIssue[];
  resolved?: boolean;
  rule_ids?: string[];
  vendor_name?: string | null;
  contact_id?: string | null;
  invoice_number?: string | null;
  xero_reference?: string | null;
  reference?: string | null;
  details?: string | null;
  current_account_code?: string | null;
  current_account_name?: string | null;
  tax_code?: string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  invoice_status?: string | null;
  amount_due?: number | string | null;
  amount_paid?: number | string | null;
  reconciled?: boolean | null;
  editable?: boolean;
  editable_reason?: string | null;
  payment_status?: string | null;
  validation_errors?: string[];
  suggested_category?: string | null;
  confidence_score?: number;
  reasoning?: string;
}

export interface AiEnrichment {
  explanation: string;
  severity_ai: "critical" | "high" | "medium" | "low";
  confidence: number;
  regulatory_ref?: string | null;
}

export interface HealthCheckResult {
  id: string;
  document_id: string | null;
  document_type: PublishingDocumentType | string;
  company_id: string;
  user_id: string | null;
  kind: HealthCheckKind;
  target_ledger: "xero" | string;
  status: HealthCheckStatus;
  title?: string | null;
  error_msgs: string | null;
  result: HealthCheckResultPayload | null;
  ran_at: string;
  ai?: AiEnrichment | null;
  xero_url?: string | null;
}

export interface AuditSummary {
  summary: string;
  top_themes: string[];
  suggested_cleanup_order: string[];
}

export type AiStatusPhase = "enriching" | "complete";

export interface AiStatusResponse {
  status: AiStatusPhase;
  ai_summary_ready: boolean;
  ai_enriched_count: number;
  total_trapped: number;
  audit_summary: AuditSummary | null;
}

export interface SuggestFixSuggestion {
  fix_strategy: string;
  xero_action: string;
  human_steps: string[];
  rationale: string;
  estimated_minutes: number;
  target_transaction_id?: string | null;
}

export interface SuggestFixResponse {
  row_id: string;
  document_id: string;
  document_type: string;
  xero_url: string;
  available: boolean;
  suggestion: SuggestFixSuggestion;
}

export type ApplyAiFixErrorCode =
  | "LINE_ITEM_FIX_NOT_SUPPORTED"
  | "NO_FIELD_UPDATES"
  | "NO_SUPPORTED_FIELDS"
  | "MANUAL_FIX_REQUIRED"
  | "AI_TARGET_NOT_TRAPPED"
  | "XERO_REJECTED"
  | "AI_UNAVAILABLE"
  | "UNKNOWN";

export interface ApplyAiFixSuccess {
  ok: true;
  applied_updates: Record<string, unknown>;
  xero_response: unknown;
}

export interface ApplyAiFixFailure {
  ok: false;
  error_code: ApplyAiFixErrorCode;
  error: string;
  error_detail?: string;
  xero_url?: string;
  xero_response?: unknown;
}

export type ApplyAiFixResult = ApplyAiFixSuccess | ApplyAiFixFailure;

export interface HealthCheckStatusCounts {
  all: number;
  blocked: number;
  passed: number;
  unavailable: number;
  skipped: number;
}

export interface HealthCheckResultsResponse {
  results: HealthCheckResult[];
  counts?: HealthCheckStatusCounts;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface HealthCheckResultsQuery {
  company_id?: string;
  document_id?: string;
  status?: HealthCheckStatus;
  kind?: HealthCheckKind;
  severity?: Severity;
  issue_type?: IssueType;
  limit?: number;
  offset?: number;
}

export interface TaxRate {
  id: string;
  name: string;
  tax_type: string;
  display_tax_rate: number;
  effective_rate: number;
  status: "active" | "deleted" | string;
  can_apply_to_expenses: boolean;
  can_apply_to_revenue: boolean;
}

export interface TaxRatesResponse {
  tax_rates: TaxRate[];
}

export interface ResolveHealthCheckRequest {
  flagged_index?: number;
  issue_type?: IssueType;
  action: "accept_suggestion" | "apply_tax_code" | "apply_category" | "acknowledge" | "dismiss";
  field_updates?: Record<string, unknown>;
  tax_code?: string;
  category_code?: string;
  note?: string;
}

export interface ResolveHealthCheckResponse {
  ok: boolean;
  resolved: boolean;
  error?: string;
}

export interface DismissTrappedResponse {
  row_id: string;
  dismissed: boolean;
  error?: string;
}

export interface LedgerHealthSummaryTopIssue {
  issue_type?: string;
  sample_msg?: string;
  count: number;
  message?: string;
}

export interface HealthStatsIssueTypeRow {
  issue_type: string;
  count: number;
  severity: string;
}

export interface HealthStatsSeverityRow {
  severity: string;
  count: number;
}

export interface HealthStatsResponse {
  company_id: string;
  health_score: number | null;
  total_issues: number;
  open_issues: number;
  open_document_issues?: number;
  open_contact_issues?: number;
  audited_documents?: number;
  audited_contacts?: number;
  resolved_issues: number;
  dismissed_issues: number;
  by_issue_type: HealthStatsIssueTypeRow[];
  by_severity: HealthStatsSeverityRow[];
  generated_at?: string;
}

export interface LedgerHealthSummary {
  company_id: string;
  last_audit_at: string | null;
  trapped_count: number;
  post_audited_total: number;
  pre_ledger_blocked: number;
  pre_ledger_passed: number;
  health_score: number | null;
  top_issues: LedgerHealthSummaryTopIssue[];
}

