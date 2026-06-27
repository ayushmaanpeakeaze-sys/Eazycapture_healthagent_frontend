import { useEffect, useMemo, useState } from "react";

import {
  PanoramaClient,
  fetchCompaniesPanorama,
} from "../../services/audit.service";
import { listUsers } from "../../services/auth.service";
import { TeamUser } from "../../types/auth.types";
import { useAuth } from "@/components/Auth/AuthProvider";

interface TeamActivityViewProps {
  /** Drill into a client when its connection row is clicked. */
  onPickClient?: (client: PanoramaClient) => void;
}

type EventKind = "admin" | "invited" | "joined" | "revoked";

interface TeamEvent {
  id: string;
  kind: EventKind;
  who: string;
  email: string;
  detail: string;
  at: string | null;
}

const KIND_META: Record<
  EventKind,
  { label: string; badge: string; dot: string; icon: JSX.Element }
> = {
  admin: {
    label: "Owner",
    badge: "bg-brand-50 text-brand-700 ring-brand-200",
    dot: "bg-brand-500",
    icon: <ShieldIcon />,
  },
  joined: {
    label: "Joined",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    icon: <UserCheckIcon />,
  },
  invited: {
    label: "Invited",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    icon: <MailIcon />,
  },
  revoked: {
    label: "Revoked",
    badge: "bg-ink-100 text-ink-600 ring-ink-200",
    dot: "bg-ink-400",
    icon: <UserXIcon />,
  },
};

const effectiveProvider = (c: PanoramaClient): string | null => {
  if (c.integration_provider) return c.integration_provider;
  if (c.xero_tenant_id) return "XERO";
  return null;
};

const fmtWhen = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day) {
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) {
      const m = Math.floor(diff / 60_000);
      return m < 1 ? "just now" : `${m}m ago`;
    }
    return `${h}h ago`;
  }
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const accessLabel = (u: TeamUser): string =>
  u.access_mode === "all"
    ? "All clients"
    : `${u.assigned_company_ids.length} client${u.assigned_company_ids.length === 1 ? "" : "s"}`;

export const TeamActivityView = ({ onPickClient }: TeamActivityViewProps) => {
  const { me } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [clients, setClients] = useState<PanoramaClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, panorama] = await Promise.all([
        listUsers(),
        fetchCompaniesPanorama(60),
      ]);
      setUsers(u);
      setClients(panorama.results ?? []);
      if (panorama.error && (panorama.results ?? []).length === 0) {
        setError(panorama.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = useMemo<TeamEvent[]>(() => {
    const out: TeamEvent[] = [];
    for (const u of users) {
      const who = u.full_name?.trim() || u.email;
      if (u.status === "disabled") {
        out.push({
          id: `${u.id}-revoked`,
          kind: "revoked",
          who,
          email: u.email,
          detail: `Access revoked · was ${u.role === "admin" ? "admin" : "team member"}`,
          at: u.created_at ?? null,
        });
      } else if (u.role === "admin") {
        out.push({
          id: `${u.id}-admin`,
          kind: "admin",
          who,
          email: u.email,
          detail: "Practice admin · full access",
          at: u.created_at ?? null,
        });
      } else if (u.status === "invited") {
        out.push({
          id: `${u.id}-invited`,
          kind: "invited",
          who: u.email,
          email: u.email,
          detail: `Invitation sent · awaiting acceptance · ${accessLabel(u)}`,
          at: u.created_at ?? null,
        });
      } else {
        // active team member = accepted the invite
        out.push({
          id: `${u.id}-joined`,
          kind: "joined",
          who,
          email: u.email,
          detail: `Accepted invite · team member · ${accessLabel(u)}`,
          at: u.created_at ?? null,
        });
      }
    }
    return out.sort((a, b) => {
      if (!a.at) return 1;
      if (!b.at) return -1;
      return new Date(b.at).getTime() - new Date(a.at).getTime();
    });
  }, [users]);

  const connected = useMemo(
    () => clients.filter((c) => effectiveProvider(c) !== null),
    [clients],
  );

  const stats = useMemo(() => {
    let active = 0;
    let pending = 0;
    for (const u of users) {
      if (u.status === "invited") pending += 1;
      else if (u.status === "active") active += 1;
    }
    return { active, pending, connected: connected.length };
  }, [users, connected]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            Activity
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Who’s on your team, who you’ve invited, and which ledgers are
            connected to your practice right now.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Could not load activity</p>
          <p className="mt-0.5 text-xs">{error}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active members" value={stats.active} />
        <StatCard label="Pending invites" value={stats.pending} accent="amber" />
        <StatCard label="Connected ledgers" value={stats.connected} />
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-700">
            Signed in now
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-ink-900">
            {me?.email ?? "—"}
          </p>
          <p className="text-[11px] capitalize text-ink-500">
            {me?.role === "admin" ? "Admin" : "Team member"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Team & invitations */}
        <section className="lg:col-span-3">
          <h3 className="mb-2 text-sm font-semibold text-ink-700">
            Team &amp; invitations
          </h3>
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
            {loading && events.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-400">
                Loading team…
              </p>
            ) : events.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-400">
                No team members yet. Invite colleagues from the Team tab.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {events.map((e) => {
                  const meta = KIND_META[e.kind];
                  return (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1",
                          meta.badge,
                        ].join(" ")}
                      >
                        {meta.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {e.who}
                          </p>
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1",
                              meta.badge,
                            ].join(" ")}
                          >
                            <span
                              className={["h-1.5 w-1.5 rounded-full", meta.dot].join(
                                " ",
                              )}
                            />
                            {meta.label}
                          </span>
                        </div>
                        <p className="truncate text-xs text-ink-500">{e.detail}</p>
                      </div>
                      <span className="shrink-0 text-[11px] uppercase tracking-wider text-ink-400">
                        {fmtWhen(e.at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Connected ledgers */}
        <section className="lg:col-span-2">
          <h3 className="mb-2 text-sm font-semibold text-ink-700">
            Connected ledgers
          </h3>
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
            {loading && connected.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-400">
                Loading connections…
              </p>
            ) : connected.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-400">
                No ledgers connected yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {connected.map((c) => {
                  const provider = effectiveProvider(c);
                  const row = (
                    <>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                        <PlugIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">
                          {c.name}
                        </p>
                        <p className="truncate text-xs text-ink-500">
                          {provider} ·{" "}
                          {c.last_audit_at
                            ? `last audited ${fmtWhen(c.last_audit_at)}`
                            : "not audited yet"}
                        </p>
                      </div>
                    </>
                  );
                  return (
                    <li key={c.company_id}>
                      {onPickClient ? (
                        <button
                          type="button"
                          onClick={() => onPickClient(c)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-50"
                        >
                          {row}
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      <p className="text-xs text-ink-400">
        Note: sign-in history isn’t recorded by the backend yet — this feed
        shows invitations, acceptances, role changes, and live ledger
        connections. A login audit log would require a backend endpoint.
      </p>
    </div>
  );
};

/* -------------------------------- helpers -------------------------------- */

const StatCard = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "amber";
}) => (
  <div className="rounded-xl border border-ink-200 bg-white p-3 shadow-card">
    <p
      className={[
        "text-[10px] font-semibold uppercase tracking-wider",
        accent === "amber" && value > 0 ? "text-amber-600" : "text-ink-500",
      ].join(" ")}
    >
      {label}
    </p>
    <p className="mt-1 text-2xl font-semibold text-ink-900">{value}</p>
  </div>
);

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 11l2 2 4-4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function UserXIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m17 8 4 4M21 8l-4 4" />
    </svg>
  );
}

function PlugIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5" />
      <path d="M9 8V2M15 8V2" />
      <path d="M5 8h14v3a7 7 0 0 1-14 0V8Z" />
    </svg>
  );
}
