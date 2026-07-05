export const HEALTHCHECK_API_BASE =
  import.meta.env.VITE_HEALTHCHECK_API_BASE ||
  "http://localhost:8001/api/v1/health";

export const INSIGHTS_API_BASE =
  import.meta.env.VITE_INSIGHTS_API_BASE ||
  HEALTHCHECK_API_BASE.replace(/\/health$/, "/insights");

export const INTEGRATIONS_API_BASE =
  import.meta.env.VITE_INTEGRATIONS_API_BASE ||
  HEALTHCHECK_API_BASE.replace(/\/health$/, "/integrations");
