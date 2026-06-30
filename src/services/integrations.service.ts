import { AxiosError } from "axios";

import { integrationsClient } from "./api.client";

/** Nango Connect session token — authorises the hosted OAuth modal. */
export interface NangoConnectSession {
  token: string;
  expires_at?: string;
  /** Hosted Nango Connect URL — fallback to open directly when the in-app
   *  modal is blocked (e.g. Safari pop-up blocking). */
  connect_link?: string;
}

export type ConnectSessionResult =
  | { ok: true; session: NangoConnectSession }
  | { ok: false; status?: number; error: string };

/** Fetch a Nango Connect session token to authorise the hosted OAuth modal — no Nango keys touch the client. */
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

/** After OAuth completes, tell the backend to create the org(s) from the new
 *  connection and kick off the initial sync + audit. */
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
