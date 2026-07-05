import { AxiosError } from "axios";

import { healthClient } from "./api.client";

export interface CdAccount {
  code: string;
  name: string;
  type?: string;
}
export interface CdTaxRate {
  code: string;
  name: string;
}
export interface CdDefaults {
  sales_account: string;
  sales_tax: string;
  purchases_account: string;
  purchases_tax: string;
}
export interface CdContact {
  contact_id: string;
  name: string;
  is_customer: boolean;
  is_supplier: boolean;
  current_defaults: CdDefaults;
  missing: string[];
  trapped_row_id?: string | null;
  dismissed?: boolean;
}
export interface ContactDefaultsResponse {
  connected: boolean;
  total: number;
  missing_count: number;
  contacts: CdContact[];
  accounts: CdAccount[];
  tax_rates: CdTaxRate[];
}

export type CdResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const fail = (err: unknown): { ok: false; error: string } => {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: string } | undefined)
      ?.detail;
    if (status === 409) return { ok: false, error: "Not connected to Xero." };
    if (status === 502)
      return { ok: false, error: "Xero unavailable — try again shortly." };
    return { ok: false, error: detail ?? err.message ?? "Request failed." };
  }
  return { ok: false, error: "Could not reach the service." };
};

export const fetchContactDefaults = async (
  companyId: string,
  missingOnly: boolean,
  includeDismissed = false,
): Promise<CdResult<ContactDefaultsResponse>> => {
  try {
    const { data } = await healthClient.get<ContactDefaultsResponse>(
      `/contact-defaults/?company_id=${encodeURIComponent(companyId)}` +
        `&missing_only=${missingOnly}&include_dismissed=${includeDismissed}`,
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
};

export const dismissContactDefault = async (
  companyId: string,
  contactId: string,
  reason = "",
): Promise<CdResult<{ contact_id: string }>> => {
  try {
    const { data } = await healthClient.post<{ contact_id: string }>(
      `/contact-defaults/${encodeURIComponent(contactId)}/dismiss/?company_id=${encodeURIComponent(companyId)}`,
      { dismissal_reason: reason },
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
};

export const reinstateContactDefault = async (
  companyId: string,
  contactId: string,
): Promise<CdResult<{ contact_id: string }>> => {
  try {
    const { data } = await healthClient.post<{ contact_id: string }>(
      `/contact-defaults/${encodeURIComponent(contactId)}/reinstate/?company_id=${encodeURIComponent(companyId)}`,
      {},
    );
    return { ok: true, data };
  } catch (err) {
    return fail(err);
  }
};

export const confirmContactDefault = async (
  companyId: string,
  contactId: string,
  changed: Partial<CdDefaults>,
): Promise<CdResult<{ contact_id: string; applied?: unknown }>> => {
  try {
    const { data } = await healthClient.post<{
      contact_id: string;
      ok: boolean;
      applied?: unknown;
      error?: string | null;
    }>(
      `/contact-defaults/${encodeURIComponent(contactId)}/confirm/?company_id=${encodeURIComponent(companyId)}`,
      changed,
    );
    if (data.ok === false || data.error)
      return {
        ok: false,
        error: data.error || "Couldn’t save to Xero — please try again.",
      };
    return { ok: true, data: { contact_id: data.contact_id, applied: data.applied } };
  } catch (err) {
    return fail(err);
  }
};
