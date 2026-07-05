import { AxiosError } from "axios";

import {
  BatchAsyncDispatchResponse,
  BatchHealthCheckRequest,
  BatchHealthCheckResponse,
  BatchProgressEvent,
  BatchTransaction,
  BankBalanceCheckResponse,
  BankDocument,
  BankNote,
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
    }
  };

  es.onerror = () => {
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
  settings?: Record<string, unknown>;
  settings_defaults?: Record<string, unknown>;
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

export interface DataSyncStatusResponse {
  syncing?: boolean;
  entities: Record<
    string,
    { last_sync_at: string | null; [k: string]: unknown }
  >;
  [k: string]: unknown;
}

export const fetchDataSyncStatus = async (
  companyId: string,
): Promise<DataSyncStatusResponse | null> => {
  if (!companyId) return null;
  try {
    const { data } = await healthClient.get<DataSyncStatusResponse>(
      `/sync-status/${encodeURIComponent(companyId)}/`,
    );
    return data;
  } catch {
    return null;
  }
};

export const maxSyncTime = (s: DataSyncStatusResponse | null): number | null => {
  if (!s?.entities) return null;
  const times = Object.values(s.entities)
    .map((e) => (e?.last_sync_at ? Date.parse(e.last_sync_at) : NaN))
    .filter((n) => !Number.isNaN(n));
  return times.length ? Math.max(...times) : null;
};

export const triggerDataSync = async (
  companyId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.post(
      `/refresh-data/${encodeURIComponent(companyId)}/`,
      {},
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sync failed",
    };
  }
};

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

export const addBankNote = async (
  companyId: string,
  accountCode: string,
  payload: { period_end: string; body: string; tagged_user_ids: string[] },
): Promise<{ ok: true; note: BankNote } | { ok: false; error: string }> => {
  try {
    const { data } = await healthClient.post<BankNote>(
      `/bank-balance-check/${encodeURIComponent(accountCode)}/notes/?company_id=${encodeURIComponent(companyId)}`,
      payload,
    );
    return { ok: true, note: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Add note failed" };
  }
};

export const fetchBankNotes = async (
  companyId: string,
  accountCode: string,
  periodEnd: string,
): Promise<BankNote[]> => {
  try {
    const params = new URLSearchParams({ company_id: companyId, period_end: periodEnd });
    const { data } = await healthClient.get<{ results: BankNote[]; total: number }>(
      `/bank-balance-check/${encodeURIComponent(accountCode)}/notes/?${params.toString()}`,
    );
    return data.results ?? [];
  } catch {
    return [];
  }
};

export const deleteBankNote = async (
  companyId: string,
  noteId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.delete(
      `/bank-balance-check/notes/${encodeURIComponent(noteId)}/?company_id=${encodeURIComponent(companyId)}`,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
};

export const uploadBankDocument = async (
  companyId: string,
  accountCode: string,
  periodEnd: string,
  file: File,
): Promise<{ ok: true; document: BankDocument } | { ok: false; error: string }> => {
  try {
    const form = new FormData();
    form.append("period_end", periodEnd);
    form.append("file", file);
    const { data } = await healthClient.post<BankDocument>(
      `/bank-balance-check/${encodeURIComponent(accountCode)}/documents/?company_id=${encodeURIComponent(companyId)}`,
      form,
      { timeout: 120_000 },
    );
    return { ok: true, document: data };
  } catch (err) {
    const status = err instanceof AxiosError ? err.response?.status : undefined;
    if (status === 413) {
      return { ok: false, error: "File is too large — the limit is 10MB." };
    }
    const detail =
      err instanceof AxiosError
        ? (err.response?.data?.detail as string | undefined)
        : undefined;
    return { ok: false, error: detail ?? (err instanceof Error ? err.message : "Upload failed") };
  }
};

export const fetchBankDocuments = async (
  companyId: string,
  accountCode: string,
  periodEnd: string,
): Promise<BankDocument[]> => {
  try {
    const params = new URLSearchParams({ company_id: companyId, period_end: periodEnd });
    const { data } = await healthClient.get<{ results: BankDocument[]; total: number }>(
      `/bank-balance-check/${encodeURIComponent(accountCode)}/documents/?${params.toString()}`,
    );
    return data.results ?? [];
  } catch {
    return [];
  }
};

export const deleteBankDocument = async (
  companyId: string,
  docId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.delete(
      `/bank-balance-check/documents/${encodeURIComponent(docId)}/?company_id=${encodeURIComponent(companyId)}`,
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Delete failed" };
  }
};

export const downloadBankDocument = async (
  companyId: string,
  docId: string,
  filename: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { data } = await healthClient.get<Blob>(
      `/bank-balance-check/documents/${encodeURIComponent(docId)}/download/?company_id=${encodeURIComponent(companyId)}`,
      { responseType: "blob", timeout: 120_000 },
    );
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Download failed" };
  }
};

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
    return { ...data, top_issues: data?.top_issues ?? [] };
  } catch {
    return null;
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
  include_marked_ok?: boolean;
  exclude_bank_items?: boolean;
}

export interface TrappedInvoicesResponse {
  results: HealthCheckResult[];
}

export interface HistoricalAuditDispatchOptions {
  date_from?: string | null;
  date_to?: string | null;
  scope?: "full" | "duplicates";
}

export const dispatchHistoricalAudit = async (
  companyId: string,
  range?: HistoricalAuditDispatchOptions,
): Promise<HistoricalAuditDispatchResponse | ServiceErrorDict> => {
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
  integration_provider?: string | null;
  health_score: number | null;
  trapped_count: number;
  post_audited_total: number;
  audited_contacts?: number | null;
  open_document_issues?: number | null;
  open_contact_issues?: number | null;
  last_audit_at: string | null;
  top_issue: string | null;
  is_active?: boolean;
  needs_reconnect: boolean;
  nango_connection_id?: string | null;
  xero_tenant_id?: string | null;
}

export interface PanoramaResponse {
  results: PanoramaClient[];
  total: number;
  window_days: number;
  error?: string;
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

export const deleteCompanyPermanently = async (
  companyId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.delete(`/company/${encodeURIComponent(companyId)}/`);
    return { ok: true };
  } catch (err) {
    const status = err instanceof AxiosError ? err.response?.status : undefined;
    const detail =
      err instanceof AxiosError
        ? (err.response?.data?.detail as string | undefined)
        : undefined;
    const error =
      status === 403
        ? detail || "You are not assigned to this company."
        : status === 404
          ? detail || "Company not found."
          : detail || "Delete failed.";
    return { ok: false, error };
  }
};

export const forgetCompany = async (
  companyId: string,
): Promise<{ ok: boolean; revoked?: boolean; error?: string }> => {
  try {
    const { data } = await healthClient.delete<{
      status: string;
      revoked?: boolean;
    }>(`/company/${encodeURIComponent(companyId)}/?forget=true`);
    return { ok: true, revoked: data?.revoked };
  } catch (err) {
    const status = err instanceof AxiosError ? err.response?.status : undefined;
    const detail =
      err instanceof AxiosError
        ? (err.response?.data?.detail as string | undefined)
        : undefined;
    const error =
      status === 403
        ? detail || "You are not assigned to this company."
        : status === 404
          ? detail || "Company not found."
          : detail || "Forget failed.";
    return { ok: false, error };
  }
};

export interface DisconnectedCompany {
  company_id: string;
  name: string;
  xero_tenant_id?: string | null;
}

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

export interface ExcludedOrg {
  xero_tenant_id: string;
  name: string;
}

export const fetchExcludedOrgs = async (): Promise<ExcludedOrg[]> => {
  try {
    const { data } = await healthClient.get<{ excluded: ExcludedOrg[] }>(
      `/excluded-orgs/`,
    );
    return data.excluded ?? [];
  } catch {
    return [];
  }
};

export const reAllowExcludedOrg = async (
  xeroTenantId: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.delete(
      `/excluded-org/${encodeURIComponent(xeroTenantId)}/`,
    );
    return { ok: true };
  } catch (err) {
    const error =
      err instanceof AxiosError
        ? (err.response?.data?.detail ?? err.message)
        : "Re-allow failed.";
    return { ok: false, error };
  }
};

export const forgetExcludedOrg = async (
  xeroTenantId: string,
): Promise<{ ok: boolean; revoked?: boolean; error?: string }> => {
  try {
    const { data } = await healthClient.delete<{ revoked?: boolean }>(
      `/excluded-org/${encodeURIComponent(xeroTenantId)}/?forget=true`,
    );
    return { ok: true, revoked: data?.revoked };
  } catch (err) {
    const error =
      err instanceof AxiosError
        ? (err.response?.data?.detail ?? err.message)
        : "Forget failed.";
    return { ok: false, error };
  }
};

export type NotificationKind = "alert" | "event";
export type NotificationSeverity = "critical" | "watch" | "info";

export interface NotificationItem {
  kind: NotificationKind;
  id?: string | null;
  type: string;
  severity: NotificationSeverity | string;
  title: string;
  detail?: string | null;
  actor_email?: string | null;
  company_id?: string | null;
  at: string;
}

export interface NotificationsResponse {
  counts: { critical: number; watch: number; info: number };
  items: NotificationItem[];
}

export const fetchNotifications = async (
  limit = 50,
): Promise<NotificationsResponse & { ok: boolean }> => {
  try {
    const { data } = await healthClient.get<NotificationsResponse>(
      `/notifications/?limit=${limit}`,
    );
    return {
      ok: true,
      counts: data.counts ?? { critical: 0, watch: 0, info: 0 },
      items: data.items ?? [],
    };
  } catch {
    return { ok: false, counts: { critical: 0, watch: 0, info: 0 }, items: [] };
  }
};

export const deleteNotification = async (
  id: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    await healthClient.delete(`/notifications/${encodeURIComponent(id)}/`);
    return { ok: true };
  } catch (err) {
    const error =
      err instanceof AxiosError
        ? (err.response?.data?.detail ?? err.message)
        : "Delete failed.";
    return { ok: false, error };
  }
};

export const clearNotifications = async (): Promise<{
  ok: boolean;
  deleted?: number;
  error?: string;
}> => {
  try {
    const { data } = await healthClient.delete<{ deleted: number }>(
      `/notifications/`,
    );
    return { ok: true, deleted: data?.deleted };
  } catch (err) {
    const error =
      err instanceof AxiosError
        ? (err.response?.data?.detail ?? err.message)
        : "Clear failed.";
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
