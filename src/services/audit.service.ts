import { AxiosError } from "axios";

import {
  BatchAsyncDispatchResponse,
  BatchHealthCheckRequest,
  BatchHealthCheckResponse,
  BatchProgressEvent,
  BatchTransaction,
  BankBalanceCheckResponse,
  CodingOptions,
  HealthCheckResult,
  LateTransactionsResponse,
  OpeningBalanceResponse,
  HealthStatsResponse,
  LedgerHealthSummary,
  OutboundDemoResponse,
  SuggestFixResponse,
  UnreconciledBankResponse,
} from "../types/audit.types";
import { apiClient, healthClient } from "./api.client";

export class AuditServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "AuditServiceError";
  }
}

const unwrap = (err: unknown): never => {
  if (err instanceof AxiosError) {
    throw new AuditServiceError(
      err.response?.data?.detail ?? err.message,
      err.response?.status,
      err.response?.data,
    );
  }
  throw err;
};

export const runBatchHealthCheck = async (
  payload: BatchHealthCheckRequest,
): Promise<BatchHealthCheckResponse> => {
  try {
    const { data } = await apiClient.post<BatchHealthCheckResponse>(
      "/api/v1/health-check/batch",
      payload,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

/**
 * Seed an instant demo batch for the Batch Inspector.
 * POST /api/v1/demo/run-outbound
 */
export const runOutboundDemo = async (): Promise<OutboundDemoResponse> => {
  try {
    const { data } = await apiClient.post<OutboundDemoResponse>(
      "/api/v1/demo/run-outbound",
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

/**
 * Kick off an async batch audit. Returns a batch_id immediately; consumer
 * should call subscribeBatchProgress() to stream stage updates over SSE.
 */
export const dispatchBatchAsync = async (
  payload: BatchHealthCheckRequest,
): Promise<BatchAsyncDispatchResponse | { error: string }> => {
  try {
    const { data } = await apiClient.post<BatchAsyncDispatchResponse>(
      "/api/v1/health-check/batch/async",
      payload,
    );
    return data;
  } catch (err) {
    if (err instanceof AxiosError) {
      return {
        error:
          err.response?.data?.detail ?? err.response?.data?.error ?? err.message,
      };
    }
    return { error: err instanceof Error ? err.message : "Request failed" };
  }
};

/**
 * Open an SSE stream on /api/v1/audit/progress/{batch_id} and dispatch each
 * event to the handler. EventSource auto-ignores `:` heartbeat comments, so
 * the handler only sees real events. Returns a close() to tear down early.
 */
export const subscribeBatchProgress = (
  batchId: string,
  handler: (evt: BatchProgressEvent) => void,
  onError?: () => void,
): (() => void) => {
  const url = `/api/v1/audit/progress/${encodeURIComponent(batchId)}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data) as BatchProgressEvent;
      handler(parsed);
      if (parsed.event === "end") {
        es.close();
      }
    } catch {
      // Skip non-JSON lines (shouldn't normally happen — heartbeats are
      // comment lines that EventSource never delivers as onmessage events).
    }
  };

  es.onerror = () => {
    // EventSource fires onerror for both transient drops (will auto-retry)
    // and for fatal failures. Treating any error as fatal for our UX —
    // tear down and surface to the caller.
    onError?.();
    es.close();
  };

  return () => es.close();
};

export const fetchTrappedTransactions = async (): Promise<BatchTransaction[]> => {
  try {
    const { data } = await apiClient.get<BatchTransaction[]>(
      "/api/v1/firewall/trapped",
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

/**
 * Per-client aggregate counts feeding the Insights dashboards.
 * GET /health/stats/?company_id=<id>
 */
// ── Audit config ─────────────────────────────────────────────────────────────

export interface AuditConfigRule {
  key: string;
  label: string;
  built: boolean;
  enabled: boolean;
}

export interface AuditConfigGroup {
  group: string;
  rules: AuditConfigRule[];
}

export interface SettingsField {
  key: string;
  label: string;
  type:
    | "int"
    | "bool"
    | "percent"
    | "amount"
    | "multiple"
    | "list"
    | "select"
    | string;
  help?: string | null;
  unit?: string | null;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  default?: unknown;
  /** Raw option values for type "select" (e.g. ["invoice_date","due_date"]). */
  options?: string[] | null;
}

export interface SettingsSchemaEntry {
  group: string;
  check: string;
  fields: SettingsField[];
}

export interface AuditConfigResponse {
  total_checks: number;
  enabled_checks: number;
  disabled_rules: string[];
  ignore_before: string | null;
  groups: AuditConfigGroup[];
  /** Per-client setting overrides + their defaults (e.g. duplicate_*). */
  settings?: Record<string, unknown>;
  settings_defaults?: Record<string, unknown>;
  /** Backend-driven field metadata per check (render controls from this). */
  settings_schema?: SettingsSchemaEntry[];
}

export const fetchAuditConfig = async (
  companyId: string,
): Promise<AuditConfigResponse | null> => {
  try {
    const { data } = await healthClient.get<AuditConfigResponse>(
      `/audit-config/?company_id=${encodeURIComponent(companyId)}`,
    );
    return data;
  } catch {
    return null;
  }
};

export const saveAuditConfig = async (
  companyId: string,
  disabledRules: string[],
  ignoreBefore: string | null,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.put(
      `/audit-config/?company_id=${encodeURIComponent(companyId)}`,
      { disabled_rules: disabledRules, ignore_before: ignoreBefore || null },
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
};

/** Save per-client check settings (e.g. duplicate_* overrides). */
export const saveAuditSettings = async (
  companyId: string,
  settings: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.put(
      `/audit-config/?company_id=${encodeURIComponent(companyId)}`,
      { settings },
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
};

/** PUT audit-config with any of disabled_rules / ignore_before / settings.
 *  Echoes the cleaned/persisted config back so the form can re-hydrate. */
export const saveAuditConfigFull = async (
  companyId: string,
  body: {
    disabled_rules?: string[];
    ignore_before?: string | null;
    settings?: Record<string, unknown>;
  },
): Promise<
  { ok: true; data: AuditConfigResponse } | { ok: false; error: string }
> => {
  try {
    const { data } = await healthClient.put<AuditConfigResponse>(
      `/audit-config/?company_id=${encodeURIComponent(companyId)}`,
      body,
    );
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed",
    };
  }
};

/** Poll a historical-audit batch until done. */
export const fetchSyncStatus = async (
  companyId: string,
  batchId: string,
): Promise<{ status?: string; [k: string]: unknown } | null> => {
  try {
    const { data } = await healthClient.get(
      `/sync-xero-history-status/${encodeURIComponent(batchId)}/?company_id=${encodeURIComponent(companyId)}`,
    );
    return data as { status?: string };
  } catch {
    return null;
  }
};

/** Void a trapped invoice/bill. 400 HAS_PAYMENT_OR_CREDIT if paid/allocated. */
export const voidTrapped = async (
  companyId: string,
  rowId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/void/?company_id=${encodeURIComponent(companyId)}`,
      {},
    );
    return { ok: true };
  } catch (err) {
    const data =
      err instanceof AxiosError
        ? (err.response?.data as { error_code?: string; detail?: string })
        : undefined;
    const msg =
      data?.error_code === "HAS_PAYMENT_OR_CREDIT"
        ? "Has a payment/credit — unallocate in Xero first."
        : data?.detail ?? "Couldn’t void in Xero.";
    return { ok: false, error: msg };
  }
};

/** Issue a credit note against a trapped invoice/bill (offsets a paid duplicate
 *  that can't be voided). Optional reason. */
export const creditNoteTrapped = async (
  companyId: string,
  rowId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/credit-note/?company_id=${encodeURIComponent(companyId)}`,
      reason ? { reason } : {},
    );
    return { ok: true };
  } catch (err) {
    const data =
      err instanceof AxiosError
        ? (err.response?.data as { detail?: string })
        : undefined;
    return {
      ok: false,
      error: data?.detail ?? "Couldn’t create the credit note in Xero.",
    };
  }
};

/** Approve a draft/submitted document in Xero (Status → AUTHORISED). */
export const approveTrapped = async (
  companyId: string,
  rowId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/approve/?company_id=${encodeURIComponent(companyId)}`,
      {},
    );
    return { ok: true };
  } catch (err) {
    const data =
      err instanceof AxiosError
        ? (err.response?.data as { detail?: string; error?: string })
        : undefined;
    return { ok: false, error: data?.error ?? data?.detail ?? "Approve failed" };
  }
};

/** Delete a draft document in Xero (Status → DELETED). */
export const deleteTrapped = async (
  companyId: string,
  rowId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/delete/?company_id=${encodeURIComponent(companyId)}`,
      {},
    );
    return { ok: true };
  } catch (err) {
    const data =
      err instanceof AxiosError
        ? (err.response?.data as { detail?: string; error?: string })
        : undefined;
    return { ok: false, error: data?.error ?? data?.detail ?? "Delete failed" };
  }
};

/** Mark a trapped row as OK (accept the current coding — not an issue). */
export const markOkTrapped = async (
  companyId: string,
  rowId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/mark-ok/?company_id=${encodeURIComponent(companyId)}`,
      reason ? { reason } : {},
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Mark OK failed",
    };
  }
};

/** Restore a previously marked-OK row back to the active list. */
export const restoreTrapped = async (
  companyId: string,
  rowId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/restore/?company_id=${encodeURIComponent(companyId)}`,
      {},
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Restore failed",
    };
  }
};

export type BulkTrappedAction = "dismiss" | "snooze" | "mark_ok" | "restore";

/** Apply an action to one or more trapped rows (a duplicate pair = both rows).
 *  dismiss → optional reason; snooze → days (+ optional reason); mark_ok → reason. */
export const bulkTrappedAction = async (
  companyId: string,
  rowIds: string[],
  action: BulkTrappedAction,
  opts?: { days?: number; reason?: string },
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/bulk/?company_id=${encodeURIComponent(companyId)}`,
      {
        row_ids: rowIds,
        action,
        ...(opts?.days != null ? { days: opts.days } : {}),
        ...(opts?.reason ? { reason: opts.reason } : {}),
      },
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : `Bulk ${action} failed`,
    };
  }
};

// ── Bank Balance Check (own endpoints, not the trapped feed) ─────────────────

export const fetchBankBalanceCheck = async (
  companyId: string,
  periodEnd: string,
  showAll: boolean,
): Promise<BankBalanceCheckResponse | null> => {
  try {
    const params = new URLSearchParams({ company_id: companyId });
    if (periodEnd) params.set("period_end", periodEnd);
    if (showAll) params.set("show_all", "true");
    const { data } = await healthClient.get<BankBalanceCheckResponse>(
      `/bank-balance-check/?${params.toString()}`,
    );
    return data;
  } catch {
    return null;
  }
};

/** "Click to add balance" — save a manual per-bank-statement closing balance. */
export const setStatementBalance = async (
  companyId: string,
  accountCode: string,
  periodEnd: string,
  balance: number,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/bank-balance-check/statement-balance/?company_id=${encodeURIComponent(companyId)}`,
      { account_code: accountCode, period_end: periodEnd, balance },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Save failed" };
  }
};

/** ✕ — exclude / re-include a bank account from the check. */
export const excludeBankAccount = async (
  companyId: string,
  accountCode: string,
  excluded: boolean,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/bank-balance-check/${encodeURIComponent(accountCode)}/exclude/?company_id=${encodeURIComponent(companyId)}`,
      { excluded },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Exclude failed" };
  }
};

/** Mark "OK" — uncleared but correct; drop from the issue total. */
export const markBankBalanceOk = async (
  companyId: string,
  accountCode: string,
  periodEnd: string,
  ok: boolean,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/bank-balance-check/mark-ok/?company_id=${encodeURIComponent(companyId)}`,
      { account_code: accountCode, period_end: periodEnd, ok },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Mark OK failed" };
  }
};

// ── Unreconciled Bank Items (own endpoint, not the trapped feed) ─────────────

export const fetchUnreconciledBankItems = async (
  companyId: string,
): Promise<UnreconciledBankResponse | null> => {
  try {
    const { data } = await healthClient.get<UnreconciledBankResponse>(
      `/unreconciled-bank-items/?company_id=${encodeURIComponent(companyId)}`,
    );
    return data;
  } catch {
    return null;
  }
};

/** ✕ — exclude / reinstate a bank account from the unreconciled check. */
export const excludeUnreconciledBankAccount = async (
  companyId: string,
  accountCode: string,
  excluded: boolean,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/unreconciled-bank-items/${encodeURIComponent(accountCode)}/exclude/?company_id=${encodeURIComponent(companyId)}`,
      { excluded },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Exclude failed" };
  }
};

// ── Opening Balance Differences (own endpoints) ──────────────────────────────

export const fetchOpeningBalanceDiffs = async (
  companyId: string,
  includeDismissed: boolean,
): Promise<OpeningBalanceResponse | null> => {
  try {
    const params = new URLSearchParams({ company_id: companyId });
    if (includeDismissed) params.set("include_dismissed", "true");
    const { data } = await healthClient.get<OpeningBalanceResponse>(
      `/opening-balance-differences/?${params.toString()}`,
    );
    return data;
  } catch {
    return null;
  }
};

export const fetchLateTransactions = async (
  companyId: string,
  periodEnd: string,
  limit: number,
  offset: number,
): Promise<LateTransactionsResponse | null> => {
  try {
    const params = new URLSearchParams({
      company_id: companyId,
      limit: String(limit),
      offset: String(offset),
    });
    const { data } = await healthClient.get<LateTransactionsResponse>(
      `/opening-balance-differences/${encodeURIComponent(periodEnd)}/late-transactions/?${params.toString()}`,
    );
    return data;
  } catch {
    return null;
  }
};

const obalPost = async (
  url: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(url, body);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
};

export const setRegistrationNumber = (companyId: string, registration_number: string) =>
  obalPost(
    `/opening-balance-differences/registration-number/?company_id=${encodeURIComponent(companyId)}`,
    { registration_number },
  );

export const setFiledNetAssets = (
  companyId: string,
  periodEnd: string,
  net_assets: number,
) =>
  obalPost(
    `/opening-balance-differences/filed-net-assets/?company_id=${encodeURIComponent(companyId)}`,
    { period_end: periodEnd, net_assets },
  );

export const dismissOpeningBalance = (companyId: string, periodEnd: string) =>
  obalPost(
    `/opening-balance-differences/${encodeURIComponent(periodEnd)}/dismiss/?company_id=${encodeURIComponent(companyId)}`,
    {},
  );

export const restoreOpeningBalance = (companyId: string, periodEnd: string) =>
  obalPost(
    `/opening-balance-differences/${encodeURIComponent(periodEnd)}/restore/?company_id=${encodeURIComponent(companyId)}`,
    {},
  );

/** Account / tax-rate options for the "Change To" picker. Cache per company. */
export const fetchCodingOptions = async (
  companyId: string,
): Promise<CodingOptions | null> => {
  try {
    const { data } = await healthClient.get<CodingOptions>(
      `/coding-options/?company_id=${encodeURIComponent(companyId)}`,
    );
    return data;
  } catch {
    return null;
  }
};

/** Apply a coding change to Xero (Unexpected Account → AccountCode,
 *  Unexpected Tax → TaxType). Posts via the apply-ai-fix field_updates path. */
export const applyCodingFix = async (
  companyId: string,
  rowId: string,
  fieldUpdates: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/apply-ai-fix/?company_id=${encodeURIComponent(companyId)}`,
      { suggestion: { field_updates: fieldUpdates } },
    );
    return { ok: true };
  } catch (err) {
    const data =
      err instanceof AxiosError
        ? (err.response?.data as {
            error?: string;
            detail?: string;
            error_detail?: string;
          })
        : undefined;
    return {
      ok: false,
      error:
        data?.error_detail ?? data?.error ?? data?.detail ?? "Couldn’t save to Xero.",
    };
  }
};

/** Re-code a trapped line to a chosen account via the resolve endpoint
 *  (apply_category). Used by Low Cost Fixed Assets "Save changes". */
export const recodeTrapped = async (
  companyId: string,
  rowId: string,
  accountCode: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/trapped/${encodeURIComponent(rowId)}/resolve/?company_id=${encodeURIComponent(companyId)}`,
      { action: "apply_category", category_code: accountCode },
    );
    return { ok: true };
  } catch (err) {
    const data =
      err instanceof AxiosError
        ? (err.response?.data as { detail?: string; error?: string })
        : undefined;
    return {
      ok: false,
      error: data?.error ?? data?.detail ?? "Couldn’t re-code in Xero.",
    };
  }
};

/** Upload a document attachment for an undocumented bill (base64 JSON body). */
export const uploadAttachment = async (
  companyId: string,
  rowId: string,
  file: { filename: string; content_type: string; content_base64: string },
): Promise<{ ok: boolean; resolved?: boolean; stub?: boolean; error?: string }> => {
  try {
    const { data } = await healthClient.post<{
      uploaded?: boolean;
      resolved?: boolean;
      stub?: boolean;
    }>(
      `/trapped/${encodeURIComponent(rowId)}/attachment/?company_id=${encodeURIComponent(companyId)}`,
      file,
    );
    return { ok: true, resolved: data.resolved, stub: data.stub };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
};

/** Re-check whether an undocumented bill now has an attachment in Xero. */
export const recheckAttachment = async (
  companyId: string,
  rowId: string,
): Promise<{ ok: boolean; attached?: boolean; resolved?: boolean; error?: string }> => {
  try {
    const { data } = await healthClient.post<{
      attached?: boolean;
      resolved?: boolean;
    }>(
      `/trapped/${encodeURIComponent(rowId)}/recheck-attachment/?company_id=${encodeURIComponent(companyId)}`,
      {},
    );
    return { ok: true, attached: data.attached, resolved: data.resolved };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Re-check failed",
    };
  }
};

/** One-click AI fix suggestion for a trapped row (void_duplicate etc.). */
export const fetchSuggestFix = async (
  companyId: string,
  rowId: string,
): Promise<SuggestFixResponse | ServiceErrorDict> => {
  try {
    const { data } = await healthClient.get<SuggestFixResponse>(
      `/trapped/${encodeURIComponent(rowId)}/suggest-fix/?company_id=${encodeURIComponent(companyId)}`,
    );
    return data;
  } catch (err) {
    return errorDict(err);
  }
};

export const fetchHealthStats = async (
  companyId: string,
): Promise<HealthStatsResponse | null> => {
  if (!companyId) return null;
  try {
    const { data } = await healthClient.get<HealthStatsResponse>(
      `/stats/?company_id=${encodeURIComponent(companyId)}`,
    );
    return data;
  } catch {
    return null;
  }
};

export const fetchLedgerHealthSummary = async (
  companyId: string | null | undefined,
): Promise<LedgerHealthSummary | null> => {
  if (!companyId) return null;
  try {
    const { data } = await healthClient.get<LedgerHealthSummary>(
      `/summary/?company_id=${encodeURIComponent(companyId)}`,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export interface ServiceErrorDict {
  error: string;
}

const errorDict = (err: unknown): ServiceErrorDict => {
  if (err instanceof AxiosError) {
    const data = err.response?.data;
    return {
      error:
        (typeof data === "object" && data !== null
          ? (data.detail as string | undefined) ?? (data.error as string | undefined)
          : undefined) ?? err.message,
    };
  }
  return {
    error: err instanceof Error ? err.message : "Request failed",
  };
};

export interface HistoricalAuditDispatchResponse {
  batch_id: string;
  status: "in_progress";
}

export interface HistoricalAuditStatusResponse {
  batch_id: string;
  status: "in_progress" | "completed" | "failed";
  total?: number;
  trapped?: number;
  new_trapped?: number;
  stage_label?: string;
  started_at?: string | null;
  fetched_at?: string | null;
  completed_at?: string | null;
  error?: string;
}

export interface TrappedInvoicesQuery {
  company_id?: string;
  limit?: number;
  include_dismissed?: boolean;
  /** Include rows the user marked "OK" (multi-account/tax suppliers toggle). */
  include_marked_ok?: boolean;
  /** Hide Money In/Out bank items (wrong-tax "Show bank payments" toggle OFF). */
  exclude_bank_items?: boolean;
}

export interface TrappedInvoicesResponse {
  results: HealthCheckResult[];
}

export interface HistoricalAuditDispatchOptions {
  /** ISO date YYYY-MM-DD; omit for unbounded start. */
  date_from?: string | null;
  /** ISO date YYYY-MM-DD; omit for unbounded end. */
  date_to?: string | null;
  /**
   * "duplicates" runs only duplicate invoices + bills (~8s, no AI; refreshes
   * only the duplicate cards). "full" (or omitted) runs the whole audit (~60s).
   */
  scope?: "full" | "duplicates";
}

export const dispatchHistoricalAudit = async (
  companyId: string,
  range?: HistoricalAuditDispatchOptions,
): Promise<HistoricalAuditDispatchResponse | ServiceErrorDict> => {
  // Backend: POST /sync-xero-history/{id}/?date_from=&date_to=&scope= (all
  // optional; dates omitted → all transactions; scope omitted → full audit).
  const params = new URLSearchParams();
  if (range?.date_from) params.set("date_from", range.date_from);
  if (range?.date_to) params.set("date_to", range.date_to);
  if (range?.scope) params.set("scope", range.scope);
  const qs = params.toString();
  const url = qs
    ? `/sync-xero-history/${companyId}/?${qs}`
    : `/sync-xero-history/${companyId}/`;
  try {
    const { data } = await healthClient.post<HistoricalAuditDispatchResponse>(
      url,
    );
    return data;
  } catch (err) {
    return errorDict(err);
  }
};

export const fetchHistoricalAuditStatus = async (
  batchId: string,
): Promise<HistoricalAuditStatusResponse | ServiceErrorDict> => {
  try {
    const { data } = await healthClient.get<HistoricalAuditStatusResponse>(
      `/sync-xero-history-status/${batchId}/`,
    );
    return data;
  } catch (err) {
    return errorDict(err);
  }
};

export interface ConnectedCompany {
  id: string;
  integration_provider: string;
  company_profile_name: string;
  is_active: boolean;
}

export interface PanoramaClient {
  company_id: string;
  name: string;
  /** May be missing/null for never-connected orgs on the new FastAPI panorama. */
  integration_provider?: string | null;
  health_score: number | null;
  trapped_count: number;
  /** Documents audited. NOTE: contacts are NOT included here. */
  post_audited_total: number;
  /** Contacts audited — present once the backend adds it to the panorama row.
   *  The blended health_score already uses (post_audited_total + this). */
  audited_contacts?: number | null;
  /** Optional issue split, if the panorama exposes it. */
  open_document_issues?: number | null;
  open_contact_issues?: number | null;
  last_audit_at: string | null;
  top_issue: string | null;
  is_active?: boolean;
  nango_connection_id?: string | null;
  xero_tenant_id?: string | null;
}

export interface PanoramaResponse {
  results: PanoramaClient[];
  total: number;
  window_days: number;
  /** Set when the request failed (auth / network) so the UI can distinguish
   *  "couldn't load" from "genuinely zero clients". */
  error?: string;
  /** True for a 401 — caller should prompt for a token / sign-in. */
  authRequired?: boolean;
}

export const fetchCompaniesPanorama = async (
  days: number = 30,
  provider: string | null = null,
): Promise<PanoramaResponse> => {
  const params = new URLSearchParams();
  if (days) params.set("days", String(days));
  if (provider) params.set("provider", provider);
  try {
    const { data } = await healthClient.get<PanoramaResponse>(
      `/companies-panorama/?${params.toString()}`,
    );
    return data;
  } catch (err) {
    const status =
      err instanceof AxiosError ? err.response?.status : undefined;
    const message =
      err instanceof AxiosError
        ? (err.response?.data?.detail ?? err.message)
        : "Could not reach the health backend.";
    return {
      results: [],
      total: 0,
      window_days: days,
      error: message,
      authRequired: status === 401,
    };
  }
};

/**
 * Disconnect (deactivate) a connected org — sets is_active=false so it drops off
 * the dashboard and stops syncing/auditing. The Xero grant, Nango connection,
 * and already-synced data are kept; reconnecting via "Connect to Xero" flips it
 * back active with full history (no re-import).
 *   POST /api/v1/health/disconnect/{company_id}/
 */
export const disconnectCompany = async (
  companyId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/disconnect/${encodeURIComponent(companyId)}/`,
    );
    return { ok: true };
  } catch (err) {
    const error =
      err instanceof AxiosError
        ? (err.response?.data?.detail ?? err.message)
        : "Disconnect failed.";
    return { ok: false, error };
  }
};

/** A deactivated org — kept in our DB, hidden from the dashboard until reconnect. */
export interface DisconnectedCompany {
  company_id: string;
  name: string;
  xero_tenant_id?: string | null;
}

/** List orgs the user has disconnected (is_active=false) so they can reconnect. */
export const fetchDisconnectedCompanies = async (): Promise<
  DisconnectedCompany[]
> => {
  try {
    const { data } = await healthClient.get<{
      results: DisconnectedCompany[];
      total: number;
    }>(`/disconnected-companies/`);
    return data.results ?? [];
  } catch {
    return [];
  }
};

/**
 * One-click reconnect — flips is_active back to true and triggers an incremental
 * sync. No re-OAuth (the Xero grant was never revoked); the org returns with full
 * history. POST /api/v1/health/reconnect/{company_id}/
 */
export const reconnectCompany = async (
  companyId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(`/reconnect/${encodeURIComponent(companyId)}/`);
    return { ok: true };
  } catch (err) {
    const error =
      err instanceof AxiosError
        ? (err.response?.data?.detail ?? err.message)
        : "Reconnect failed.";
    return { ok: false, error };
  }
};

export const fetchConnectedCompanies = async (): Promise<ConnectedCompany[]> => {
  try {
    const { data } = await apiClient.get<{
      success: boolean;
      data: ConnectedCompany[];
    }>(
      "/accounting/find-companies-by-third-party-accounting-providers/?is_active_only=true&page=1&limit=50",
    );
    return data?.data ?? [];
  } catch {
    return [];
  }
};

export const fetchTrappedInvoices = async (
  query: TrappedInvoicesQuery = {},
): Promise<TrappedInvoicesResponse | ServiceErrorDict> => {
  const params = new URLSearchParams();
  if (query.company_id) params.set("company_id", query.company_id);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.include_dismissed) params.set("include_dismissed", "true");
  if (query.include_marked_ok) params.set("include_marked_ok", "true");
  if (query.exclude_bank_items) params.set("exclude_bank_items", "true");
  const qs = params.toString();
  const url = qs ? `/trapped-invoices/?${qs}` : "/trapped-invoices/";
  try {
    const { data } = await healthClient.get<TrappedInvoicesResponse>(url);
    return data;
  } catch (err) {
    return errorDict(err);
  }
};
