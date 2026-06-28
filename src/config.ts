/**
 * Where health-check endpoints live.
 *
 * POC: pointed at the standalone FastAPI service on :8001.
 *   Backend must serve CORS for http://localhost:3000 (`Access-Control-Allow-Origin`).
 *
 * Production (later): swap back to the Django proxy:
 *   "http://localhost:8000/accounting/health"
 *
 * Override at build time with VITE_HEALTHCHECK_API_BASE.
 */
export const HEALTHCHECK_API_BASE =
  import.meta.env.VITE_HEALTHCHECK_API_BASE ||
  "http://localhost:8001/api/v1/health";

/**
 * Where the Insights KPI endpoints live (profitability, sales tracker,
 * financial position, corporation tax, directors' loans). Same FastAPI service
 * as the health checks, just the sibling `/insights` router. Derived from
 * HEALTHCHECK_API_BASE so the two stay in sync; override with
 * VITE_INSIGHTS_API_BASE.
 */
export const INSIGHTS_API_BASE =
  import.meta.env.VITE_INSIGHTS_API_BASE ||
  HEALTHCHECK_API_BASE.replace(/\/health$/, "/insights");

/**
 * Where the integrations endpoints live (Nango Connect session for the Xero
 * OAuth handshake). Same FastAPI service as the health checks, the sibling
 * `/integrations` router (e.g. `/api/v1/integrations/nango/connect-session/`).
 * Derived from HEALTHCHECK_API_BASE so the host stays in sync; override with
 * VITE_INTEGRATIONS_API_BASE.
 */
export const INTEGRATIONS_API_BASE =
  import.meta.env.VITE_INTEGRATIONS_API_BASE ||
  HEALTHCHECK_API_BASE.replace(/\/health$/, "/integrations");
