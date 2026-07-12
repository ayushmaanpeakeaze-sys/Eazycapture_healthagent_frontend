import { useAuth } from "@/features/auth/AuthProvider";

export const SettingsView = () => {
  const { logout, role, me, isLoggedIn } = useAuth();

  const email = me?.email ?? "";
  const initial = (email.trim()[0] ?? "?").toUpperCase();
  const isAdmin = role === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-500">
          Settings
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-900">
          Practice configuration
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Manage your account and practice preferences. More controls land here
          as features ship.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-ink-200 bg-surface p-6 shadow-float">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-100/60 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-xl font-semibold text-white shadow-brand">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-ink-900">
              {email || "Not signed in"}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                  isAdmin
                    ? "bg-brand-50 text-brand-700 ring-brand-200"
                    : "bg-ink-100 text-ink-600 ring-ink-200",
                ].join(" ")}
              >
                {isAdmin ? <ShieldIcon /> : <UserIcon />}
                {isAdmin ? "Practice admin" : "Team member"}
              </span>
              {isLoggedIn && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Signed in
                </span>
              )}
            </div>
          </div>
          {isLoggedIn && (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-surface px-3.5 py-2 text-sm font-medium text-ink-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 sm:ml-auto"
            >
              <LogoutIcon />
              Sign out
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-ink-200 bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink-900">On the roadmap</h2>
        <p className="mt-1 text-xs text-ink-500">
          Configuration that will live here as the backend ships.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROADMAP.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-3 rounded-xl border border-dashed border-ink-200 bg-ink-50/40 p-3.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-ink-400 ring-1 ring-ink-200">
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink-700">
                    {item.title}
                  </p>
                  <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-500">
                    Soon
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const ROADMAP = [
  {
    title: "Rule defaults per client",
    desc: "Tune which checks run for whom.",
    icon: <SlidersIcon />,
  },
  {
    title: "Notification preferences",
    desc: "Email & in-app alert routing.",
    icon: <BellIcon />,
  },
  {
    title: "Audit schedules",
    desc: "Automatic recurring ledger sweeps.",
    icon: <CalendarIcon />,
  },
  {
    title: "Billing & plan",
    desc: "Manage your subscription.",
    icon: <CardIcon />,
  },
];

const ic = "h-4 w-4";
const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" {...stroke}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" {...stroke}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ic} {...stroke}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  );
}
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ic} {...stroke}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ic} {...stroke}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ic} {...stroke}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ic} {...stroke}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
