import { useEffect, useState } from "react";

import {
  clearNotifications,
  deleteNotification,
  fetchNotifications,
  NotificationItem,
} from "../../services/audit.service";

type Sev = "critical" | "watch" | "info";

const sevOf = (s: string): Sev =>
  s === "critical" || s === "watch" || s === "info" ? s : "info";

const SEV_STYLES: Record<
  Sev,
  { ring: string; iconBg: string; iconText: string; label: string; dot: string; text: string }
> = {
  critical: {
    ring: "ring-rose-200",
    iconBg: "bg-rose-100",
    iconText: "text-rose-700",
    label: "Critical",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
  watch: {
    ring: "ring-amber-200",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    label: "Watch",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  info: {
    ring: "ring-brand-200",
    iconBg: "bg-brand-100",
    iconText: "text-brand-700",
    label: "Info",
    dot: "bg-brand-500",
    text: "text-brand-700",
  },
};

const fmtRelative = (iso: string | null): string => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const prettyDetail = (d: string): string =>
  /^[a-z][a-z0-9_]*$/.test(d)
    ? d.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    : d;

const Glyph = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const AlertIcon = (
  <Glyph>
    <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
    <path d="M12 9v5M12 17.5v.1" />
  </Glyph>
);

const EventIcon = (
  <Glyph>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </Glyph>
);

const TYPE_ICON: Record<string, React.ReactNode> = {
  org_connected: (
    <Glyph>
      <path d="M9 7V4a3 3 0 0 1 6 0v3M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v4" />
    </Glyph>
  ),
  org_disconnected: (
    <Glyph>
      <path d="M9 6v12M15 6v12" />
    </Glyph>
  ),
  org_removed: (
    <Glyph>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
    </Glyph>
  ),
  org_forgotten: (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </Glyph>
  ),
  org_reallowed: (
    <Glyph>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
    </Glyph>
  ),
};

const iconFor = (it: NotificationItem): React.ReactNode =>
  it.kind === "alert" ? AlertIcon : (TYPE_ICON[it.type] ?? EventIcon);

interface NotificationsViewProps {
  onOpenCompany?: (companyId: string) => void;
}

export const NotificationsView = ({ onOpenCompany }: NotificationsViewProps) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState({ critical: 0, watch: 0, info: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = () => {
    setLoading(true);
    fetchNotifications()
      .then((res) => {
        setError(!res.ok);
        setItems(res.items);
        setCounts(res.counts);
      })
      .finally(() => setLoading(false));
  };

  const deletable = (it: NotificationItem): it is NotificationItem & { id: string } =>
    it.kind === "event" && !!it.id;
  const eventCount = items.filter(deletable).length;

  const onDelete = async (it: NotificationItem) => {
    if (!it.id) return;
    setBusyId(it.id);
    const res = await deleteNotification(it.id);
    setBusyId(null);
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      const sev = sevOf(it.severity);
      setCounts((prev) => ({ ...prev, [sev]: Math.max(0, prev[sev] - 1) }));
    } else {
      load();
    }
  };

  const onClearAll = async () => {
    setClearing(true);
    const res = await clearNotifications();
    setClearing(false);
    setConfirmClear(false);
    if (res.ok) load();
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchNotifications()
      .then((res) => {
        if (!active) return;
        setError(!res.ok);
        setItems(res.items);
        setCounts(res.counts);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Health alerts and team activity across all clients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {counts.critical} critical
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {counts.watch} watch
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            {counts.info} info
          </span>
          {eventCount > 0 &&
            (confirmClear ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold ring-1 ring-rose-200">
                <span className="text-ink-600">Clear {eventCount}?</span>
                <button
                  type="button"
                  onClick={onClearAll}
                  disabled={clearing}
                  className="text-rose-700 hover:text-rose-900 disabled:opacity-50"
                >
                  {clearing ? "Clearing…" : "Yes"}
                </button>
                <span className="text-ink-300">·</span>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  disabled={clearing}
                  className="text-ink-500 hover:text-ink-800 disabled:opacity-50"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                title="Clear all stored events (live alerts stay)"
                className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-ink-600 ring-1 ring-ink-200 transition hover:text-rose-700 hover:ring-rose-200"
              >
                Clear all
              </button>
            ))}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            title="Refresh notifications"
            className="inline-flex items-center justify-center rounded-full bg-surface p-1.5 text-ink-500 ring-1 ring-ink-200 transition hover:text-ink-800 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className={["h-3.5 w-3.5", loading ? "animate-spin" : ""].join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-card">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">
            Loading notifications…
          </div>
        ) : error ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-ink-800">
              Couldn’t load notifications
            </p>
            <button
              type="button"
              onClick={load}
              className="mt-2 text-xs font-semibold text-brand-700 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-ink-800">
              Nothing needs attention
            </p>
            <p className="mt-1 text-xs text-ink-500">
              No health alerts, and no recent team activity.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {items.map((it, idx) => {
              const sev = sevOf(it.severity);
              const s = SEV_STYLES[sev];
              const icon = iconFor(it);
              const canDelete = deletable(it);
              const clickable = !!it.company_id && !!onOpenCompany;
              return (
                <li
                  key={`${it.type}-${it.company_id ?? ""}-${it.at}-${idx}`}
                  className="flex items-start gap-4 px-5 py-4 transition hover:bg-ink-50/40"
                >
                  <span
                    className={[
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
                      s.iconBg,
                      s.iconText,
                      s.ring,
                    ].join(" ")}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                          s.iconBg,
                          s.iconText,
                          s.ring,
                        ].join(" ")}
                      >
                        {s.label}
                      </span>
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => onOpenCompany!(it.company_id!)}
                          className="text-sm font-semibold text-ink-900 hover:text-brand-700 hover:underline"
                        >
                          {it.title}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-ink-900">
                          {it.title}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-400">
                        {fmtRelative(it.at)}
                      </span>
                    </div>
                    {(it.detail || it.actor_email) && (
                      <p className="mt-1 text-xs text-ink-600">
                        {it.detail && prettyDetail(it.detail)}
                        {it.actor_email && (
                          <span className="text-ink-400">
                            {it.detail ? " · " : ""}by {it.actor_email}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(it)}
                      disabled={busyId === it.id}
                      title="Delete this notification"
                      className="mt-0.5 shrink-0 rounded-md p-1.5 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
