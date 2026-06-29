import { ReactNode, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  fetchCompaniesPanorama,
  PanoramaClient,
} from "@/services/audit.service";
import { useAuth } from "@/features/auth/AuthProvider";
import { ActivityFeedView } from "@/features/practice/ActivityFeedView";
import { TeamActivityView } from "@/features/practice/TeamActivityView";
import { AllClientsView } from "@/features/firm/AllClientsView";
import { BatchAuditInspector } from "@/features/batch/BatchAuditInspector";
import { BookkeepingChecksView } from "@/features/checks/BookkeepingChecksView";
import { CheckDetailPage } from "@/features/checks/CheckDetailPage";
import { ClientInsightsView } from "@/features/insights/ClientInsightsView";
import { ConnectXeroButton } from "@/features/integrations/ConnectXeroButton";
import { FirmOverview } from "@/features/firm/FirmOverview";
import { LedgerHealthDashboard } from "@/features/insights/LedgerHealthDashboard";
import { NotificationsView } from "@/features/practice/NotificationsView";
import { PreLedgerReviewCenter } from "@/features/checks/PreLedgerReviewCenter";
import { SettingsView } from "@/features/practice/SettingsView";
import { TeamView } from "@/features/practice/TeamView";

type ViewKey =
  | "firmOverview"
  | "clients"
  | "globalActivity"
  | "notifications"
  | "team"
  | "settings"
  | "overview"
  | "clientInsights"
  | "checks"
  | "activity"
  | "trapped"
  | "batch";

interface NavItem {
  key: ViewKey;
  label: string;
  description: string;
  icon: ReactNode;
  /** Practice items use an absolute path; client items use a segment relative to /clients/:companyId. */
  path: string;
}

const OverviewIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
const ChecksIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const TrappedIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3Z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const BatchIcon = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3 9 4-9 4-9-4 9-4Z" />
    <path d="m3 12 9 4 9-4" />
    <path d="m3 17 9 4 9-4" />
  </svg>
);
const LogoMark = (
  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
    {/* Falls back to the inline SVG below if the image is missing. */}
    <img
      src="/eazycapture-icon-white.png"
      alt="EazyCapture"
      className="h-7 w-7 object-contain"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
        if (fallback) fallback.style.display = "block";
      }}
    />
    <svg
      viewBox="0 0 48 48"
      className="absolute h-7 w-7"
      style={{ display: "none" }}
      fill="none"
      aria-hidden
    >
      <path d="M17 6 H10 a4 4 0 0 0-4 4 V17" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 6 H38 a4 4 0 0 1 4 4 V17" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 42 H10 a4 4 0 0 1-4-4 V31" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 42 H38 a4 4 0 0 0 4-4 V31" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 24 C11 17, 19 17, 24 24 C29 31, 37 31, 37 24" stroke="white" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M11 24 C11 31, 19 31, 24 24 C29 17, 37 17, 37 24" stroke="white" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M13 24 H20" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  </div>
);

const ActivityIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 8v5l3 2" />
  </svg>
);

const ClientsIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M14 20a5 5 0 0 1 8-3.8" />
  </svg>
);

const BellIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10 21a2 2 0 0 0 4 0" />
  </svg>
);

const InsightsIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 3v18h18" />
    <path d="M7 14l3-3 3 3 5-6" />
    <circle cx="7" cy="14" r="1.2" fill="currentColor" />
    <circle cx="10" cy="11" r="1.2" fill="currentColor" />
    <circle cx="13" cy="14" r="1.2" fill="currentColor" />
    <circle cx="18" cy="8" r="1.2" fill="currentColor" />
  </svg>
);

const TeamIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20a6 6 0 0 1 12 0" />
    <circle cx="17" cy="9" r="2.4" />
    <path d="M14 20a5 5 0 0 1 8-3.8" />
  </svg>
);

const GearIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);

const NAV_PRACTICE: NavItem[] = [
  {
    key: "firmOverview",
    label: "Overview",
    description: "Firm-wide financial triage",
    icon: OverviewIcon,
    path: "/overview",
  },
  {
    key: "clients",
    label: "Clients",
    description: "Connected ledgers · worst-first",
    icon: ClientsIcon,
    path: "/clients",
  },
  {
    key: "globalActivity",
    label: "Activity",
    description: "Health-check events across every client",
    icon: ActivityIcon,
    path: "/activity",
  },
  {
    key: "notifications",
    label: "Alerts",
    description: "Things needing attention",
    icon: BellIcon,
    path: "/alerts",
  },
  {
    key: "team",
    label: "Team",
    description: "Invite and manage team members",
    icon: TeamIcon,
    path: "/team",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Practice settings",
    icon: GearIcon,
    path: "/settings",
  },
];

const NAV_CLIENT: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    description: "Health summary",
    icon: OverviewIcon,
    path: "overview",
  },
  {
    key: "clientInsights",
    label: "Insights",
    description: "Charts and breakdowns for this client",
    icon: InsightsIcon,
    path: "insights",
  },
  {
    key: "checks",
    label: "Checks",
    description: "All bookkeeping checks — one page each",
    icon: ChecksIcon,
    path: "checks",
  },
  {
    key: "trapped",
    label: "Outbound",
    description: "Outbound · pre-publish reviews",
    icon: TrappedIcon,
    path: "outbound",
  },
  {
    key: "activity",
    label: "Audit logs",
    description: "This client's health-check events",
    icon: ActivityIcon,
    path: "audit-logs",
  },
  {
    key: "batch",
    label: "Batch",
    description: "Bulk sync checks",
    icon: BatchIcon,
    path: "batch",
  },
];

const RailButton = ({
  item,
  active,
  onClick,
  disabled,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={
      disabled
        ? "Open a client first to see this view"
        : item.description
    }
    className={[
      "group relative flex w-14 flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 transition-all duration-150",
      disabled
        ? "cursor-not-allowed text-white/40"
        : active
          ? "bg-white/15 text-white shadow-sm ring-1 ring-white/20"
          : "text-white/70 hover:bg-white/10 hover:text-white",
    ].join(" ")}
  >
    {active && !disabled && (
      <span
        aria-hidden
        className="absolute -left-3 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]"
      />
    )}
    <span
      className={[
        "flex h-7 w-7 items-center justify-center transition",
        disabled
          ? "text-white/40"
          : active
            ? "text-white"
            : "text-white/85 group-hover:text-white",
      ].join(" ")}
    >
      {item.icon}
    </span>
    <span className="text-[11px] font-medium leading-tight">
      {item.label}
    </span>
  </button>
);

const PROVIDER_STYLE: Record<string, string> = {
  XERO: "bg-sky-50 text-sky-700 ring-sky-200",
  QBO: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  QUICKBOOKS: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const TopNavButton = ({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={item.description}
    className={[
      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-100",
      active
        ? "bg-brand-50 text-brand-700"
        : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
    ].join(" ")}
  >
    <span
      className={[
        "flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4",
        active ? "text-brand-600" : "text-ink-400",
      ].join(" ")}
    >
      {item.icon}
    </span>
    <span>{item.label}</span>
  </button>
);

const ClientBreadcrumb = ({
  client,
  companyId,
  onBack,
}: {
  /** Null while the client is still being resolved (e.g. on a hard refresh). */
  client: PanoramaClient | null;
  companyId: string;
  onBack: () => void;
}) => {
  const derivedProvider = client
    ? client.integration_provider ?? (client.xero_tenant_id ? "XERO" : null)
    : null;
  const providerKey = (derivedProvider ?? "").toUpperCase();
  const providerCls =
    PROVIDER_STYLE[providerKey] ?? "bg-ink-100 text-ink-700 ring-ink-200";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-2.5 shadow-card">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        All clients
      </button>
      <span className="text-ink-300">/</span>
      <span className="truncate text-sm font-semibold text-ink-900">
        {client ? client.name : "Loading…"}
      </span>
      {derivedProvider && (
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
            providerCls,
          ].join(" ")}
        >
          {derivedProvider}
        </span>
      )}
      <span className="ml-auto font-mono text-[10px] text-ink-400">
        {(client?.company_id ?? companyId).slice(0, 8)}…
      </span>
    </div>
  );
};

const PracticeLayout = () => {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) =>
    location.pathname === path ||
    (path === "/clients" && location.pathname === "/");

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-ink-50 text-ink-900">
      <header className="shrink-0 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-5 px-8">
          <div className="flex items-center">
            <img
              src="/eazycapture-logo.png"
              alt="EazyCapture"
              className="h-7 w-auto"
            />
          </div>

          <nav className="ml-2 flex items-center gap-0.5">
            {NAV_PRACTICE.filter(
              (item) => item.key !== "team" || isAdmin,
            ).map((item) => (
              <TopNavButton
                key={item.key}
                item={item}
                active={isActive(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ConnectXeroButton />
            <div
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
              title="AI service online"
            >
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </div>
            {role && (
              <span className={[
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                isAdmin
                  ? "bg-brand-50 text-brand-700 ring-brand-200"
                  : "bg-ink-100 text-ink-600 ring-ink-200",
              ].join(" ")}>
                {isAdmin ? "Admin" : "Member"}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto w-full max-w-[1280px] space-y-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

// Client resolved from :companyId via panorama lookup so the breadcrumb survives a refresh or deep link.
const ClientLayout = () => {
  const { companyId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [client, setClient] = useState<PanoramaClient | null>(null);

  useEffect(() => {
    let active = true;
    setClient(null);
    fetchCompaniesPanorama(90)
      .then((res) => {
        if (!active) return;
        setClient(res.results?.find((c) => c.company_id === companyId) ?? null);
      })
      .catch(() => {
        /* breadcrumb falls back to the id if the lookup fails */
      });
    return () => {
      active = false;
    };
  }, [companyId]);

  const base = `/clients/${companyId}`;
  const current = location.pathname;
  const isActive = (seg: string) =>
    current === `${base}/${seg}` ||
    current.startsWith(`${base}/${seg}/`) || // keep parent active on sub-pages
    ((current === base || current === `${base}/`) && seg === "overview");

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-ink-50 text-ink-900">
      <aside className="fixed left-4 top-4 bottom-4 z-30 flex w-20 flex-col items-center rounded-3xl bg-nav-gradient py-4 text-white shadow-[0_20px_60px_-12px_rgba(74,35,184,0.55)]">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_60%)]"
        />
        <div className="relative mb-4">{LogoMark}</div>
        <div className="relative h-px w-8 bg-white/15" />
        <nav className="relative mt-4 flex flex-1 flex-col items-center gap-2">
          {NAV_CLIENT.map((item) => (
            <RailButton
              key={item.key}
              item={item}
              active={isActive(item.path)}
              onClick={() => navigate(`${base}/${item.path}`)}
            />
          ))}
        </nav>
        <div
          className="relative mt-2 flex h-10 w-10 items-center justify-center rounded-2xl"
          title="AI service online"
        >
          <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-300/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-300/30" />
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto pl-28 pr-8 py-6">
        <div className="mx-auto w-full max-w-[1280px] space-y-5">
          <ClientBreadcrumb
            client={client}
            companyId={companyId}
            onBack={() => navigate("/clients")}
          />
          <Outlet />
        </div>
      </main>
    </div>
  );
};

// Thin adapters: read route params and hand the views their props + navigation callbacks.
const useCompanyId = () => useParams().companyId ?? "";

const FirmOverviewPage = () => <FirmOverview />;

const ClientsPage = () => {
  const navigate = useNavigate();
  const { role, me } = useAuth();
  const isAdmin = role === "admin";
  return (
    <AllClientsView
      onPick={(c) => navigate(`/clients/${c.company_id}/overview`)}
      restrictToIds={
        me && !isAdmin && me.assigned_company_ids.length > 0
          ? me.assigned_company_ids
          : undefined
      }
    />
  );
};

const ActivityPage = () => {
  const navigate = useNavigate();
  return (
    <TeamActivityView
      onPickClient={(c) => navigate(`/clients/${c.company_id}/overview`)}
    />
  );
};

const AlertsPage = () => {
  const navigate = useNavigate();
  return (
    <NotificationsView
      onPickClient={(c) => navigate(`/clients/${c.company_id}/overview`)}
    />
  );
};

const TeamPage = () => {
  const { role } = useAuth();
  return role === "admin" ? <TeamView /> : <Navigate to="/clients" replace />;
};

const ClientOverview = () => <LedgerHealthDashboard companyId={useCompanyId()} />;

const ClientInsights = () => <ClientInsightsView companyId={useCompanyId()} />;

const ClientChecks = () => <BookkeepingChecksView companyId={useCompanyId()} />;

const ClientCheckDetail = () => {
  const { companyId = "", checkKey = "" } = useParams();
  return <CheckDetailPage companyId={companyId} checkKey={checkKey} />;
};

const ClientOutbound = () => <PreLedgerReviewCenter companyId={useCompanyId()} />;
const ClientAuditLogs = () => <ActivityFeedView companyId={useCompanyId()} />;

export const App = () => (
  <Routes>
    <Route element={<PracticeLayout />}>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<FirmOverviewPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/alerts" element={<AlertsPage />} />
      <Route path="/team" element={<TeamPage />} />
      <Route path="/settings" element={<SettingsView />} />
    </Route>
    <Route path="/clients/:companyId" element={<ClientLayout />}>
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<ClientOverview />} />
      <Route path="insights" element={<ClientInsights />} />
      <Route path="checks" element={<ClientChecks />} />
      <Route path="checks/:checkKey" element={<ClientCheckDetail />} />
      <Route path="inbound" element={<Navigate to="../checks" replace />} />
      <Route path="outbound" element={<ClientOutbound />} />
      <Route path="audit-logs" element={<ClientAuditLogs />} />
      <Route path="batch" element={<BatchAuditInspector />} />
    </Route>
    <Route path="*" element={<Navigate to="/overview" replace />} />
  </Routes>
);

export default App;
