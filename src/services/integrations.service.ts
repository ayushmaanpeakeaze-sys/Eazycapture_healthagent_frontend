import { AxiosError } from "axios";

import { integrationsClient } from "./api.client";

export interface NangoConnectSession {
  token: string;
  expires_at?: string;
  connect_link?: string;
}

export type ConnectSessionResult =
  | { ok: true; session: NangoConnectSession }
  | { ok: false; status?: number; error: string };

export const createNangoConnectSession = async (
  provider = "xero",
): Promise<ConnectSessionResult> => {
  try {
    const { data } = await integrationsClient.post<{
      data: NangoConnectSession;
    }>(`/nango/connect-session/?provider=${encodeURIComponent(provider)}`);
    const session = data?.data;
    if (!session?.token) {
      return { ok: false, error: "No session token returned by the server." };
    }
    return { ok: true, session };
  } catch (err) {
    const status =
      err instanceof AxiosError ? err.response?.status : undefined;
    const detail =
      err instanceof AxiosError
        ? (err.response?.data?.detail as string | undefined)
        : undefined;
    const error =
      status === 503
        ? detail || "Xero connection isn’t configured on this deployment."
        : status === 502
          ? detail || "Couldn’t reach Xero right now. Please try again."
          : status === 401
            ? "Your session expired — please sign in again."
            : detail || "Couldn’t start the Xero connection.";
    return { ok: false, status, error };
  }
};

export const syncNangoConnections = async (): Promise<{
  ok: boolean;
  error?: string;
}> => {
  try {
    await integrationsClient.post("/nango/sync-connections/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
};
