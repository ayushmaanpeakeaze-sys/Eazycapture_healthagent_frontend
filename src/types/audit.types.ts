export type IssueType =
  // Bank & reconciliation
  | "unprocessed_bank"
  | "unreconciled_bank"
  | "bank_balance_check"
  | "opening_balance_difference"
  // Duplicates
  | "duplicate_invoice"
  | "duplicate_bill"
  | "duplicate_credit_note"
  | "duplicate_contact"
  | "duplicate_vendor" // alias kept for legacy backend payloads
  // Tax & VAT
  | "missing_tax"
  | "invalid_tax_code"
  | "sales_tax_missing"
  | "purchase_tax_missing"
  | "sales_tax_on_bills"
  | "purchase_tax_on_invoices"
  | "unexpected_tax_code"
  | "multi_tax_code_supplier"
  // Categorisation & coding
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
  // Date & ageing
  | "future_dated"
  | "old_unpaid_bill"
  | "old_unpaid_invoice"
  | "old_unsettled_sales_credit"
  | "old_unsettled_purchase_credit"
  // Approval & status
  | "unapproved_invoice"
  | "unapproved_bill"
  // Contacts
  | "missing_vendor"
  | "contact_defaults"
  | "inactive_contact"
  // Document integrity
  | "missing_invoice_number"
  | "undocumented_bill"
  // Fixed assets
  | "low_cost_fixed_asset"
  | "capital_item_review"
  // Currency
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
  /** ACCPAY (bill / purchase) or ACCREC (invoice / sales). */
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
  /** Both rows carry the same own invoice/doc number. */
  same_invoice_number?: boolean;
  /** Everything matches but the two doc numbers differ → soft "2 docs?" hint. */
  distinct_documents_possible?: boolean;
  /** Matched across two merged contact records. */
  cross_contact: boolean;
  confidence: number;
  tier: "high" | "medium" | "low" | string;
  /** true = different reference → "user decides" (Low / Review). */
  review?: boolean;
  /** Per-signal score contribution — show why it scored what it did. */
  points?: {
    contact?: number | null;
    amount?: number | null;
    reference?: number | null;
    date?: number | null;
  } | null;
  /** true = cadence looks like a subscription → label & sort to the bottom. */
  recurring?: boolean;
  /** RISK: one side is paid while the other is still outstanding. */
  one_paid_one_outstanding?: boolean;
  /** RISK (stronger): one side is bank-reconciled while the other is outstanding. */
  one_reconciled_one_outstanding?: boolean;
  /** "high" = money already moved on one copy → flag urgency & sort to the top. */
  risk?: "high" | "normal" | string;
  // Old-unpaid invoices / bills
  /** Age at audit time (correct basis) → the "Age" column. */
  age_days?: number | null;
  age_basis?: "invoice_date" | "due_date" | string;
  /** Outstanding balance as a string. */
  outstanding?: string | null;
  // Bill or Direct Payment — the two sides of the match
  bill_transaction_id?: string;
  bill_date?: string | null;
  bill_amount?: string | null;
  amount_due?: string | null;
  bill_description?: string | null;
  payment_transaction_id?: string;
  payment_date?: string | null;
  payment_amount?: string | null;
  payment_description?: string | null;
  // Invoice or Direct Deposit — the two sides of the match
  invoice_transaction_id?: string;
  invoice_date?: string | null;
  invoice_amount?: string | null;
  invoice_description?: string | null;
  deposit_transaction_id?: string;
  deposit_date?: string | null;
  deposit_amount?: string | null;
  deposit_description?: string | null;
  // Low-cost fixed asset
  line_no?: number | null;
  account_code?: string | null;
  account_name?: string | null;
  line_amount?: string | null;
  threshold?: string | null;
  /** Preferred account type to re-code to (e.g. "EXPENSE") — highlight these. */
  recode_to_account_type?: string | null;
  // Wrong-tax-direction (sales tax on bills / purchase tax on invoices)
  net_amount?: string | null;
  tax_amount?: string | null;
  tax_code?: string | null;
}

/** The status columns for one contact in a duplicate-contact match. */
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
  confidence?: number | null;
  reasoning?: string | null;
  // Duplicate-invoice/bill specifics
  this_is_likely_original?: boolean;
  duplicate_of_transaction_id?: string | null;
  duplicate_of_invoice_number?: string | null;
  duplicate_of_date?: string | null;
  match_reasons?: MatchReasons | null;
  // Duplicate-contact specifics
  contact_name?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  /** "Similarity %" = name_similarity × 100. */
  name_similarity?: number | null;
  vat_status?: "match" | "mismatch" | "unknown" | string;
  /** Customer/Supplier split — review, don't merge. */
  is_split?: boolean;
  // Inactive contact
  /** ISO date of the contact's last activity, or null = never used. */
  last_activity_date?: string | null;
  /** Days since last activity, or null = never used. */
  age_days?: number | null;
  /** Status columns for the subject (this) contact. */
  helper?: ContactHelper | null;
  /** Status columns for the partner contact — render the 2nd line from this. */
  partner_helper?: ContactHelper | null;
}

export interface BatchHealthCheckResponse {
  flagged: FlaggedIssue[];
}

/** One bank account in the Bank Balance Check (card per account). */
export interface BankBalanceItem {
  id: string;
  account_code: string;
  account_name: string;
  period_end: string;
  /** Manual entry — null until the user adds the statement balance. */
  per_bank_statement: number | string | null;
  /** Finance-API gated → always null for now. */
  per_xero_statement: number | string | null;
  per_xero_tb: number | string | null;
  /** per_bank_statement − per_xero_tb; null until a statement balance exists. */
  difference: number | string | null;
  marked_ok: boolean;
  process_url: string | null;
  currency_code?: string | null;
  /** Count of notes attached to this (account_code, period_end). */
  notes_count?: number;
  /** Count of documents attached to this (account_code, period_end). */
  documents_count?: number;
}

/** A note on a bank account for one period end (with @mentions). */
export interface BankNote {
  id: string;
  account_code: string;
  period_end: string;
  author_user_id: string;
  body: string;
  tagged_user_ids: string[];
  created_at: string;
}

/** Uploaded-document metadata for a bank account / period end. */
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

/** One bank account with activity not yet reconciled in the ledger. */
export interface UnreconciledBankItem {
  account_id: string;
  account_code: string;
  account_name: string;
  /** RECEIVE money, IsReconciled = false. */
  unreconciled_received: number;
  /** SPEND money, IsReconciled = false. */
  unreconciled_spent: number;
  /** Feed-side count — Finance-API gated, so always null → render "—". */
  unexplained: number | null;
  /** received + spent (ledger-side). */
  total_to_reconcile: number;
  process_url: string | null;
}

export interface UnreconciledBankResponse {
  /** Σ total_to_reconcile across all accounts (header count). */
  total_to_reconcile: number;
  /** false → feed-side "Unexplained" count needs Xero's Finance API. */
  unexplained_available: boolean;
  items: UnreconciledBankItem[];
}

/** One unreconciled transaction under a bank account (View Details). */
export interface BankReconLine {
  date: string;
  contact: string;
  /** "Received" | "Spent". */
  type: string;
  /** Signed: + for received, − for spent. */
  amount: number;
}

/** One bank account in the Bank Reconciliation Summary. */
export interface BankReconAccount {
  account_id: string;
  account_code: string | null;
  account_name: string;
  /** Trial-balance GL balance (the books). */
  balance_in_xero: number;
  /** = balance_in_xero + unreconciled net (matches Xero's report). */
  statement_balance_calculated: number;
  /** Always null → render "Not available" (needs Xero Finance API). */
  imported_statement_balance: number | null;
  unreconciled_received: number;
  unreconciled_spent: number;
  /** NET difference (received − spent) — the amount still to reconcile. */
  unreconciled_lines_total: number;
  unreconciled_count: number;
  needs_reconciliation: boolean;
  /** Deep-link to Xero's reconciliation page. */
  process_url: string | null;
  lines: BankReconLine[];
}

export interface BankReconciliationSummaryResponse {
  total_unreconciled_count: number;
  /** false → the imported (feed) balance needs Xero's gated Finance API. */
  imported_statement_available: boolean;
  accounts: BankReconAccount[];
}

/** One period row in the Opening Balance Differences check. */
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

/** Dropdown options for the "Change To" picker on the coding checks. */
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

/** Response from the run-outbound demo batch. */
export interface OutboundDemoResponse {
  transactions?: BatchTransaction[];
  flagged?: FlaggedIssue[];
  flags_by_txn?: Record<string, FlaggedIssue[]>;
  summary?: OutboundDemoSummary;
  /** Legacy fallback shape. */
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
  // Trapped-invoice/bill row fields (present on duplicate & other doc checks)
  rule_ids?: string[];
  vendor_name?: string | null;
  /** Xero ContactID — stable key for ignore-this-contact whitelisting. */
  contact_id?: string | null;
  invoice_number?: string | null;
  /** Xero Reference — the field duplicate-matching keys on. */
  xero_reference?: string | null;
  /** Legacy/back-compat reference (same source as xero_reference). */
  reference?: string | null;
  /** Line-item description ("Details" column). */
  details?: string | null;
  /** The account the line is coded to (for tax-missing / coding checks). */
  current_account_code?: string | null;
  current_account_name?: string | null;
  /** Tax code on the document (e.g. "20% (VAT on Expenses)"). */
  tax_code?: string | null;
  amount?: number | string | null;
  currency_code?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  invoice_status?: string | null;
  amount_due?: number | string | null;
  amount_paid?: number | string | null;
  /** Bank-matched: the recorded payment was reconciled to a bank statement line
   *  (Xero Payments.IsReconciled). null when payments weren't fetched. */
  reconciled?: boolean | null;
  /** Whether the row can be edited in-app (not reconciled / paid / allocated).
   *  Drives "Change To" dropdown + Save vs a read-only "Edit in Xero". */
  editable?: boolean;
  /** Why it isn't editable — drives the "?" tooltip on read-only rows.
   *  reconciled | payment_allocated | payment_or_credit_allocated */
  editable_reason?: string | null;
  /** "paid" | "unpaid" — payment state for the row. */
  payment_status?: string | null;
  // Legacy fields kept for backwards-compat with PrecheckTester / older rows
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
  /** Human-readable summary of the issue (e.g. "ABC LIMITED is missing default account or tax settings"). */
  title?: string | null;
  error_msgs: string | null;
  result: HealthCheckResultPayload | null;
  ran_at: string;
  /** AI enrichment — one record per transaction_id (NOT per flagged issue); null until it lands. */
  ai?: AiEnrichment | null;
  /** Deep-link to this document in Xero — always present (manual fallback). */
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
  /** Xero's document ID (e.g. InvoiceID) — always present, even when AI is unavailable. */
  document_id: string;
  /** "accrec" | "accpay" | "accreccredit" | "accpaycredit" — always present. */
  document_type: string;
  /** Deep-link into Xero for this document — always present. */
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
  /** Human-friendly explanation from the backend; preferred over walking xero_response. */
  error_detail?: string;
  /** Deep-link to the document in Xero, so the UI can offer a guaranteed manual path. */
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

export interface DismissTrappedRequest {
  dismissal_reason?: string;
}

export interface DismissTrappedResponse {
  row_id: string;
  dismissed: boolean;
  error?: string;
}

export interface LedgerHealthSummaryTopIssue {
  /** New backend shape: `{ issue_type, count, sample_msg }`. */
  issue_type?: string;
  sample_msg?: string;
  count: number;
  /** Legacy shape — older backends sent the message directly. */
  message?: string;
}

/** Per-client aggregate counts for the Insights dashboard. */
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
  /** Documents drive the health score; contacts are a separate pool, NOT in audited_documents. */
  open_document_issues?: number;
  open_contact_issues?: number;
  /** Documents audited in the broadest completed audit. */
  audited_documents?: number;
  /** Contacts audited (the contact-pool denominator). */
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

export type FormFieldKey =
  | "vendor_name"
  | "invoice_number"
  | "amount"
  | "tax_code"
  | "category"
  | "date"
  | "description";

export interface FieldErrorMap {
  [key: string]: string | undefined;
}
