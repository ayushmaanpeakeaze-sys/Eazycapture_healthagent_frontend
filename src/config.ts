/**
 * Health-check endpoints. POC points at the standalone FastAPI service on :8001
 * (must serve CORS for http://localhost:3000); production swaps to the Django
 * proxy at /accounting/health. Override with VITE_HEALTHCHECK_API_BASE.
 */
export const HEALTHCHECK_API_BASE =
  import.meta.env.VITE_HEALTHCHECK_API_BASE ||
  "http://localhost:8001/api/v1/health";

/** Insights KPI endpoints — sibling `/insights` router; derived from HEALTHCHECK_API_BASE. Override with VITE_INSIGHTS_API_BASE. */
export const INSIGHTS_API_BASE =
  import.meta.env.VITE_INSIGHTS_API_BASE ||
  HEALTHCHECK_API_BASE.replace(/\/health$/, "/insights");

/** Integrations endpoints (Nango Connect for the Xero OAuth handshake) — sibling `/integrations` router; derived from HEALTHCHECK_API_BASE. Override with VITE_INTEGRATIONS_API_BASE. */
export const INTEGRATIONS_API_BASE =
  import.meta.env.VITE_INTEGRATIONS_API_BASE ||
  HEALTHCHECK_API_BASE.replace(/\/health$/, "/integrations");
