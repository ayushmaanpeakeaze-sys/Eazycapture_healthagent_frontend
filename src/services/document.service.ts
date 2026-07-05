import { AxiosError } from "axios";

import {
  AiStatusResponse,
  ApplyAiFixErrorCode,
  ApplyAiFixResult,
  DismissTrappedResponse,
  HealthCheckResultsQuery,
  HealthCheckResultsResponse,
  InvoicePayload,
  InvoiceValidationResponse,
  PrecheckRequest,
  PrecheckResponse,
  ResolveHealthCheckRequest,
  ResolveHealthCheckResponse,
  SuggestFixResponse,
  SuggestFixSuggestion,
  TaxRatesResponse,
  XeroPublishResponse,
} from "../types/audit.types";
import { apiClient, healthClient } from "./api.client";

const withCompany = (companyId: string) =>
  `?company_id=${encodeURIComponent(companyId)}`;

export class DocumentServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "DocumentServiceError";
  }
}

const formatDetail = (detail: unknown, fallback: string): string => {
  if (detail == null) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") {
          const o = d as Record<string, unknown>;
          const loc = Array.isArray(o.loc)
            ? o.loc.filter((p) => p !== "body").join(".")
            : "";
          const msg = (o.msg ?? o.message ?? o.error) as string | undefined;
          return msg ? (loc ? `${loc}: ${msg}` : msg) : JSON.stringify(d);
        }
        return String(d);
      })
      .filter(Boolean);
    return parts.length ? parts.join("; ") : fallback;
  }
  if (typeof detail === "object") {
    const o = detail as Record<string, unknown>;
    return (
      (o.message as string) ??
      (o.error as string) ??
      (o.detail as string) ??
      JSON.stringify(detail)
    );
  }
  return String(detail);
};

const unwrap = (err: unknown): never => {
  if (err instanceof AxiosError) {
    throw new DocumentServiceError(
      formatDetail(err.response?.data?.detail, err.message),
      err.response?.status,
      err.response?.data,
    );
  }
  throw err;
};

export const validateInvoice = async (
  payload: InvoicePayload,
): Promise<InvoiceValidationResponse> => {
  try {
    const { data } = await apiClient.post<InvoiceValidationResponse>(
      "/api/v1/validate-invoice",
      payload,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export const precheckPublishingDocument = async (
  payload: PrecheckRequest,
): Promise<PrecheckResponse> => {
  try {
    const { data } = await healthClient.post<PrecheckResponse>(
      "/precheck/",
      payload,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export const fetchHealthCheckResults = async (
  query: HealthCheckResultsQuery = {},
): Promise<HealthCheckResultsResponse> => {
  const params = new URLSearchParams();
  if (query.company_id) params.set("company_id", query.company_id);
  if (query.document_id) params.set("document_id", query.document_id);
  if (query.status) params.set("status", query.status);
  if (query.kind) params.set("kind", query.kind);
  if (query.severity) params.set("severity", query.severity);
  if (query.issue_type) params.set("issue_type", query.issue_type);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));

  const qs = params.toString();
  const url = qs ? `/results/?${qs}` : "/results/";

  try {
    const { data } = await healthClient.get<HealthCheckResultsResponse>(url);
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export const fetchTaxRates = async (
  companyId: string,
  limit = 100,
): Promise<TaxRatesResponse> => {
  try {
    const { data } = await apiClient.get<TaxRatesResponse>(
      `/accounting/tax-rate/list/?company_id=${encodeURIComponent(
        companyId,
      )}&page=1&limit=${limit}`,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export const fetchAiStatus = async (
  batchId: string,
): Promise<AiStatusResponse> => {
  try {
    const { data } = await healthClient.get<AiStatusResponse>(
      `/audit/${encodeURIComponent(batchId)}/ai-status`,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export const suggestFix = async (
  rowId: string,
  companyId: string,
): Promise<SuggestFixResponse> => {
  try {
    const { data } = await healthClient.post<SuggestFixResponse>(
      `/trapped/${encodeURIComponent(rowId)}/suggest-fix/${withCompany(companyId)}`,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

const KNOWN_ERROR_CODES: ApplyAiFixErrorCode[] = [
  "LINE_ITEM_FIX_NOT_SUPPORTED",
  "NO_FIELD_UPDATES",
  "NO_SUPPORTED_FIELDS",
  "MANUAL_FIX_REQUIRED",
  "AI_TARGET_NOT_TRAPPED",
  "XERO_REJECTED",
  "AI_UNAVAILABLE",
];

const normaliseErrorCode = (raw: unknown): ApplyAiFixErrorCode => {
  if (typeof raw === "string" && (KNOWN_ERROR_CODES as string[]).includes(raw)) {
    return raw as ApplyAiFixErrorCode;
  }
  return "UNKNOWN";
};

export const applyAiFix = async (
  rowId: string,
  companyId: string,
  suggestion?: SuggestFixSuggestion,
): Promise<ApplyAiFixResult> => {
  try {
    const { data } = await healthClient.post<{
      ai_applied?: boolean;
      applied_updates?: Record<string, unknown>;
      xero_response?: unknown;
    }>(
      `/trapped/${encodeURIComponent(rowId)}/apply-ai-fix/${withCompany(companyId)}`,
      suggestion ? { suggestion } : {},
    );
    return {
      ok: true,
      applied_updates: data.applied_updates ?? {},
      xero_response: data.xero_response ?? null,
    };
  } catch (err) {
    if (err instanceof AxiosError) {
      const body = err.response?.data ?? {};
      return {
        ok: false,
        error_code: normaliseErrorCode(body.error_code),
        error: body.error ?? body.detail ?? err.message,
        error_detail: body.error_detail,
        xero_url: body.xero_url,
        xero_response: body.xero_response,
      };
    }
    return {
      ok: false,
      error_code: "UNKNOWN",
      error: err instanceof Error ? err.message : "Apply failed",
    };
  }
};

export const resolveHealthCheckRow = async (
  rowId: string,
  companyId: string,
  payload: ResolveHealthCheckRequest,
): Promise<ResolveHealthCheckResponse> => {
  try {
    const { data } = await healthClient.post<ResolveHealthCheckResponse>(
      `/trapped/${encodeURIComponent(rowId)}/resolve/${withCompany(companyId)}`,
      payload,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export const dismissTrapped = async (
  rowId: string,
  companyId: string,
  dismissalReason?: string,
): Promise<DismissTrappedResponse> => {
  try {
    const { data } = await healthClient.post<DismissTrappedResponse>(
      `/trapped/${encodeURIComponent(rowId)}/dismiss/${withCompany(companyId)}`,
      dismissalReason ? { dismissal_reason: dismissalReason } : {},
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};

export const publishDocumentToXero = async (
  payload: InvoicePayload,
): Promise<XeroPublishResponse> => {
  try {
    const { data } = await apiClient.post<XeroPublishResponse>(
      "/api/v1/documents/outbound",
      payload,
    );
    return data;
  } catch (err) {
    return unwrap(err);
  }
};
