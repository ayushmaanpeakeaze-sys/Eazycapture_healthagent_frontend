import { AxiosError } from "axios";

import {
  ClientInsightsSnapshot,
  FirmSummaryResponse,
} from "../types/insights.types";
import { insightsClient } from "./api.client";

/** Discriminated result so callers can branch on ok without try/catch. */
export type InsightsResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

// Failure modes: 409 = not connected to Xero · 502 = Xero down/rate-limited
//   404 = unknown company. All return { detail }. Map to friendly copy.
const toError = (err: unknown): { ok: false; error: string; status?: number } => {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: string } | undefined)
      ?.detail;
    let error: string;
    if (status === 409) error = "This client isn’t connected to Xero yet.";
    else if (status === 502)
      error = "Xero is unavailable or rate-limited — try again in a moment.";
    else if (status === 404) error = "We couldn’t find this company.";
    else error = detail ?? err.message ?? "Request failed.";
    return { ok: false, error, status };
  }
  return { ok: false, error: "Could not reach the insights service." };
};

const get = async <T>(path: string): Promise<InsightsResult<T>> => {
  try {
    const { data } = await insightsClient.get<T>(path);
    return { ok: true, data };
  } catch (err) {
    return toError(err);
  }
};

/** One client — all 9 KPIs from the pre-computed snapshot (fast, DB-backed). */
export const fetchClientInsights = (companyId: string) =>
  get<ClientInsightsSnapshot>(`/${encodeURIComponent(companyId)}/`);

/** Firm overview roll-up across every client the user can see. */
export const fetchFirmSummary = () =>
  get<FirmSummaryResponse>(`/firm-summary/`);

/** Queue a recompute of one client's snapshot. Returns 202 {status:"queued"}. */
export const refreshClientInsights = async (
  companyId: string,
): Promise<InsightsResult<{ company_id: string; status: string }>> => {
  try {
    const { data } = await insightsClient.post<{
      company_id: string;
      status: string;
    }>(`/${encodeURIComponent(companyId)}/refresh/`);
    return { ok: true, data };
  } catch (err) {
    return toError(err);
  }
};
