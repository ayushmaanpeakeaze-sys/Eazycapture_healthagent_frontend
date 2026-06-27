import { useEffect, useMemo, useState } from "react";

import {
  fetchCompaniesPanorama,
  PanoramaClient,
} from "../../services/audit.service";

type AlertTone = "critical" | "warn" | "info";

interface Alert {
  id: string;
  tone: AlertTone;
  client: PanoramaClient;
  title: string;
  detail: string;
  when: string;
}

const TONE_STYLES: Record<
  AlertTone,
  { ring: string; iconBg: string; iconText: string; label: string }
> = {
  critical: {
    ring: "ring-rose-200",
    iconBg: "bg-rose-100",
    iconText: "text-rose-700",
    label: "Critical",
  },
  warn: {
    ring: "ring-amber-200",
    iconBg: "bg-amber-100",
    iconText: "text-amber-700",
    label: "Watch",
  },
  info: {
    ring: "ring-brand-200",
    iconBg: "bg-brand-100",
    iconText: "text-brand-700",
    label: "Info",
  },
};

const TONE_RANK: Record<AlertTone, number> = { critical: 3, warn: 2, info: 1 };

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

const BellIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
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

const WarnIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
    <path d="M12 9v5M12 17.5v.1" />
  </svg>
);

const ClockIcon = (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5l3 2" />
  </svg>
);

interface NotificationsViewProps {
  onPickClient?: (client: PanoramaClient) => void;
}

export const NotificationsView = ({ onPickClient }: NotificationsViewProps) => {
  const [panorama, setPanorama] = useState<PanoramaClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Alerts are derived entirely from the panorama (per-client score, trapped
    // count, top issue, last audit). The old global /results/ call can't work
    // on a per-tenant backend (company_id required) and is no longer used.
    fetchCompaniesPanorama(30)
      .then((p) => {
        if (active) setPanorama(p.results ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];

    // 1) Score-below-60 alerts
    for (const c of panorama) {
      if (c.health_score !== null && c.health_score < 60) {
        out.push({
          id: `score-${c.company_id}`,
          tone: "critical",
          client: c,
          title: `${c.name} score dropped to ${c.health_score}%`,
          detail:
            c.top_issue || "Multiple findings — open the panorama for detail.",
          when: c.last_audit_at ?? new Date().toISOString(),
        });
      } else if (
        c.health_score !== null &&
        c.health_score < 80 &&
        c.trapped_count > 0
      ) {
        out.push({
          id: `watch-${c.company_id}`,
          tone: "warn",
          client: c,
          title: `${c.name} has ${c.trapped_count} trapped invoice${
            c.trapped_count === 1 ? "" : "s"
          }`,
          detail: c.top_issue || "Findings pending review.",
          when: c.last_audit_at ?? new Date().toISOString(),
        });
      }
    }

    // 2) Stale-audit alerts (>14 days since last audit)
    const STALE_MS = 14 * 24 * 3600 * 1000;
    for (const c of panorama) {
      if (!c.last_audit_at) continue;
      const age = Date.now() - new Date(c.last_audit_at).getTime();
      if (age > STALE_MS) {
        out.push({
          id: `stale-${c.company_id}`,
          tone: "warn",
          client: c,
          title: `${c.name} hasn't been audited in ${Math.floor(
            age / (24 * 3600 * 1000),
          )} days`,
          detail: "Run an audit from the Checks tab to refresh findings.",
          when: c.last_audit_at,
        });
      }
    }

    out.sort((a, b) => {
      const ra = TONE_RANK[a.tone];
      const rb = TONE_RANK[b.tone];
      if (rb !== ra) return rb - ra;
      return new Date(b.when).getTime() - new Date(a.when).getTime();
    });
    return out;
  }, [panorama]);

  const counts = useMemo(() => {
    let critical = 0;
    let warn = 0;
    let info = 0;
    for (const a of alerts) {
      if (a.tone === "critical") critical += 1;
      else if (a.tone === "warn") warn += 1;
      else info += 1;
    }
    return { critical, warn, info };
  }, [alerts]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Things needing attention across all clients — derived from health
            scores, trapped counts, and audit recency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {counts.critical} critical
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {counts.warn} watch
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            {counts.info} info
          </span>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">
            Building alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-ink-800">
              Nothing needs attention
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Every connected client looks healthy in the last 30 days.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {alerts.map((a) => {
              const s = TONE_STYLES[a.tone];
              const icon =
                a.tone === "critical"
                  ? WarnIcon
                  : a.id.startsWith("stale")
                    ? ClockIcon
                    : BellIcon;
              return (
                <li
                  key={a.id}
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
                      {onPickClient ? (
                        <button
                          type="button"
                          onClick={() => onPickClient(a.client)}
                          className="text-sm font-semibold text-ink-900 hover:text-brand-700 hover:underline"
                        >
                          {a.title}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-ink-900">
                          {a.title}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-400">
                        {fmtRelative(a.when)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">{a.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
