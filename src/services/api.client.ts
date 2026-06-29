import axios, { AxiosInstance } from "axios";

import {
  HEALTHCHECK_API_BASE,
  INSIGHTS_API_BASE,
  INTEGRATIONS_API_BASE,
} from "../config";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const buildClient = (
  baseURL: string,
  opts: { withCredentials?: boolean } = {},
): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: 30_000,
    headers: { "Content-Type": "application/json" },
    // cross-origin POC: no cookies (FastAPI uses Bearer JWT only)
    withCredentials: opts.withCredentials ?? true,
  });

  client.interceptors.request.use((config) => {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("eazy.auth.token")
        : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err?.response?.status === 401) {
        // Token expired or missing — clear session and reload to login.
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("eazy.auth.token");
          window.localStorage.removeItem("eazy.auth.role");
          window.localStorage.removeItem("eazy.company.id");
          window.location.reload();
        }
      }
      return Promise.reject(err);
    },
  );

  return client;
};

/** Default client — Vite proxy routes /accounting/* and /api/* paths. */
export const apiClient = buildClient(API_BASE_URL);

/** Health-check client — hits HEALTHCHECK_API_BASE cross-origin (CORS), Bearer JWT only. */
export const healthClient = buildClient(HEALTHCHECK_API_BASE, {
  withCredentials: false,
});

/** Insights KPI client — same FastAPI service as healthClient, different router. */
export const insightsClient = buildClient(INSIGHTS_API_BASE, {
  withCredentials: false,
});

/** Integrations client — opens a Nango Connect session for the Xero OAuth handshake. */
export const integrationsClient = buildClient(INTEGRATIONS_API_BASE, {
  withCredentials: false,
});
