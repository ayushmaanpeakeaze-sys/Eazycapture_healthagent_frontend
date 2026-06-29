# EazyCapture — Frontend

Bookkeeping-audit dashboard for accounting practices. Connect a client's **Xero**
ledger, run automated **health checks** (duplicates, unreconciled bank items,
miscoded transactions, missing tax, old unpaid invoices, …), and triage what
needs attention — one focused page per check.

This is the **web frontend only**. It talks to a separate FastAPI backend
(the health-check / audit service) over HTTP.

---

## Tech stack

| | |
|---|---|
| Framework | React 18 + TypeScript |
| Build / dev | Vite 5 |
| Routing | react-router-dom v6 |
| Styling | Tailwind CSS (custom `brand-*` / `ink-*` tokens, `bg-brand-gradient`, `shadow-card`) |
| HTTP | axios (with Bearer-JWT interceptor) |
| Charts | apexcharts / react-apexcharts, @tremor/react |
| Xero OAuth | @nangohq/frontend (Nango Connect modal) |

> No StrictMode — `react-apexcharts` throws under StrictMode's dev double-invoke.
> It has no effect on production builds. (See `src/main.tsx`.)

---

## Quick start

**Prerequisites:** Node 18+ and npm. The **backend must be running** (see below) —
the app loads to a login screen but can't do anything useful without it.

```bash
npm install
npm run dev          # → http://localhost:3000  (Vite, strict port 3000)
```

Log in with the dev backend's seeded admin:

```
admin@firm.com  /  AdminPass123
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on :3000 (HMR) |
| `npm run build` | `tsc -b` typecheck/build, then `vite build` → `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Backend dependency

The frontend expects a FastAPI service on **`http://localhost:8001`**. Default base
URLs (overridable via env, see below):

| Concern | Path |
|---|---|
| Health checks / audit | `/api/v1/health` |
| Insights KPIs | `/api/v1/insights` |
| Integrations (Nango/Xero) | `/api/v1/integrations` |
| Auth | `/api/v1/auth` |

Auth is **Bearer JWT** (stored in `localStorage` as `eazy.auth.token`); a request
interceptor attaches it and a `401` clears the session and bounces to login.
The backend must serve **CORS** for `http://localhost:3000`.

### Environment variables

All optional — sensible localhost defaults exist (`src/config.ts`). Create a
`.env.local` to override:

| Var | Default | Purpose |
|---|---|---|
| `VITE_HEALTHCHECK_API_BASE` | `http://localhost:8001/api/v1/health` | Health/audit API base |
| `VITE_INSIGHTS_API_BASE` | derived → `/api/v1/insights` | Insights API base |
| `VITE_INTEGRATIONS_API_BASE` | derived → `/api/v1/integrations` | Nango connect-session, etc. |
| `VITE_API_URL` | `""` (uses Vite proxy for `/api`, `/accounting`) | Default axios client base |

> No Nango keys live on the client — the **connect-session token** (fetched from
> our backend) authorises the OAuth modal.

---

## Project structure

Path alias **`@/` → `src/`** (configured in `tsconfig.json` `paths` and
`vite.config.ts` `resolve.alias`). Prefer `@/features/...` over deep relative imports.

```
src/
  main.tsx                      App entry → BrowserRouter + AuthProvider + <App/>
  App.tsx                       App shell: top nav + all routes
  config.ts                     API base URLs (env-overridable)

  features/                     Code grouped by domain (a new dev finds things here)
    auth/                       Login, invite/accept, AuthProvider (session context)
    checks/                     Check infrastructure (the dispatcher + shared parts):
                                  ChecksDirectory, CheckDetailPage, CheckSettingsPanel,
                                  checksCatalog, TrappedInvoicesList, paginate, drawers,
                                  SuggestFixModal, BookkeepingChecksView
      pages/                    One component per check: DuplicateInvoicesPage,
                                  UnreconciledBankItemsPage, CapitalItemReviewPage,
                                  OldUnpaidInvoicesPage, TaxMissingPage, … (19)
    insights/                   Dashboards (LedgerHealthDashboard, FinancialInsights, …)
    firm/                       Firm-level views (FirmOverview, AllClientsView)
    practice/                   Team, activity, notifications, settings
    batch/                      Batch audit inspector + summary
    integrations/               Xero: ConnectXeroButton, DisconnectedOrgs, XeroOnboarding

  services/                     One file per API domain (*.service.ts) + api.client.ts
  types/                        Shared TypeScript types (*.types.ts)
  hooks/                        Reusable hooks (e.g. useSelectedCompany)
  lib/                          Framework-agnostic helpers (e.g. duplicates)
```

### How the checks work

- `checksCatalog.tsx` is the source of truth: each check has a `key`, `label`,
  `blurb`, group, and severity. The catalog drives both the side list and the
  "Detailed results" table in `ChecksDirectory`.
- A check's route is `/clients/:companyId/checks/:checkKey`. `CheckDetailPage`
  maps `checkKey` → the right page component (or a generic trapped-feed list).
- Most checks read the shared **trapped-invoices feed** and filter client-side by
  `issue_type`. A few (bank balance, opening balance, unreconciled bank) have
  **dedicated endpoints** instead.
- **Settings gear** is backend-driven: it appears only for checks the backend
  lists in `audit-config.settings_schema` — no per-check hardcoding.

### Xero connect / disconnect

- **Connect** (`ConnectXeroButton`, top nav): fetches a Nango connect-session,
  opens the hosted OAuth modal, then polls `companies-panorama` until the
  backend webhook has created the org(s).
- **Disconnect** (per-org, clients table): `POST /health/disconnect/{id}` —
  deactivates (hides, keeps data). Reversible.
- **Reconnect** (`DisconnectedOrgs`): `POST /health/reconnect/{id}` — re-activates,
  no re-OAuth.
- **Onboarding** (`XeroOnboarding`): when a firm has 0 active orgs, the landing
  shows a big "Connect to Xero" empty state instead of an empty dashboard.

---

## Conventions

- **No TypeScript `enum`s.** Use string-literal union types (`type Severity =
  "critical" | "high" | "medium"`) — zero runtime cost, safe under
  `isolatedModules`, and they match the backend's raw string payloads. `as const`
  for value lists.
- **Layering:** components call `services/*` (which own the axios calls + error
  shaping); shared shapes live in `types/*`. Components don't call axios directly.
- **Imports:** `@/...` absolute alias for cross-feature; relative is fine within a
  feature folder.
- **Naming:** `PascalCase.tsx` for components, `*.service.ts`, `*.types.ts`.

---

## Deploy (Vercel)

The frontend deploys to Vercel as a static Vite build; the API is reached
same-origin through `vercel.json` rewrites that proxy to the Railway backend
(no CORS, and the SSE progress stream works unchanged).

- `vercel.json` — rewrites `/api/*` and `/accounting/*` to the backend, and
  falls back to `index.html` for client-side routes (SPA).
- `.env.production` — sets `VITE_HEALTHCHECK_API_BASE=/api/v1/health` (relative)
  so every client uses same-origin paths through the proxy. Vite loads it
  automatically during `vite build`, so no Vercel dashboard env vars are needed.

To deploy: push to GitHub, import the repo in Vercel (it auto-detects Vite),
and deploy. To point at a different backend, edit the rewrite destinations in
`vercel.json`.

---

## Gotchas

- The app needs the **backend on :8001 and CORS for :3000** — without it you'll
  see the login screen but calls fail.
- `import.meta.env` typing comes from `src/vite-env.d.ts` (`vite/client`).
- Port 3000 is **strict** (`vite.config.ts`) — free it if something else holds it.
- There is **no test suite** in this repo yet.
