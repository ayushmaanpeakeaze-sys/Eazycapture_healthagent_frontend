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

export const apiClient = buildClient(API_BASE_URL);

export const healthClient = buildClient(HEALTHCHECK_API_BASE, {
  withCredentials: false,
});

export const insightsClient = buildClient(INSIGHTS_API_BASE, {
  withCredentials: false,
});

export const integrationsClient = buildClient(INTEGRATIONS_API_BASE, {
  withCredentials: false,
});
