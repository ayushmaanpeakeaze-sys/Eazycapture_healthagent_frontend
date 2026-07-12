import { useEffect, useMemo, useState } from "react";

import {
  deleteCompanyPermanently,
  disconnectCompany,
  fetchCompaniesPanorama,
  forgetCompany,
  PanoramaClient,
} from "../../services/audit.service";
import { fetchFirmSummary } from "../../services/insights.service";
import { ConnectXeroButton } from "@/features/integrations/ConnectXeroButton";
import { DisconnectedOrgs } from "@/features/integrations/DisconnectedOrgs";
import { ReconnectBanner } from "@/features/integrations/ReconnectBanner";
import { RemovedOrgs } from "@/features/integrations/RemovedOrgs";
import { XeroOnboarding } from "@/features/integrations/XeroOnboarding";

interface BankBits {
  unreconciled: number | null;
  lastReconciled: string | null;
  recentTxn: string | null;
}

const shortDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
};

type WindowDays = 7 | 30 | 90;
type ProviderFilter = "all" | "XERO" | "QBO";
type SortKey = "severity" | "name" | "trapped" | "score";

const fmtRelative = (iso: string | null): string => {
  if (!iso) return "Never";
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

const clientRef = (id: string, idx: number): string => {
  const hex = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  return hex.length === 4 ? hex : `C${String(idx + 1).padStart(3, "0")}`;
};

interface ScoreTone {
  text: string;
  dot: string;
  label: string;
}

const scoreTone = (score: number | null): ScoreTone => {
  if (score === null)
    return { text: "text-ink-400", dot: "bg-ink-300", label: "No data" };
  if (score >= 80)
    return { text: "text-emerald-700", dot: "bg-emerald-500", label: "Healthy" };
  if (score >= 60)
    return { text: "text-amber-700", dot: "bg-amber-500", label: "Watch" };
  return { text: "text-rose-700", dot: "bg-rose-500", label: "At risk" };
};

const effectiveProvider = (
  r: Pick<
    PanoramaClient,
    "integration_provider" | "xero_tenant_id" | "nango_connection_id"
  >,
): string | null => {
  if (r.integration_provider) return r.integration_provider;
  if (r.xero_tenant_id) return "XERO";
  return null;
};

const PROVIDER_STYLE: Record<
  string,
  { bg: string; text: string; ring: string; short: string }
> = {
  XERO: {
    bg: "bg-sky-100",
    text: "text-sky-700",
    ring: "ring-sky-200",
    short: "xero",
  },
  QBO: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    short: "qb",
  },
  QUICKBOOKS: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    short: "qb",
  },
};

const ProviderBadge = ({ provider }: { provider?: string | null }) => {
  if (!provider) {
    return (
      <span
        className="inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-full bg-ink-100 px-2.5 text-[10px] font-bold tracking-wider text-ink-500 ring-1 ring-ink-200"
        title="Not connected"
      >
        —
      </span>
    );
  }
  const upper = provider.toUpperCase();
  const s =
    PROVIDER_STYLE[upper] ?? {
      bg: "bg-ink-100",
      text: "text-ink-700",
      ring: "ring-ink-200",
      short: provider.slice(0, 4).toLowerCase(),
    };
  return (
    <span
      className={[
        "inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-full px-2.5 text-[10px] font-bold tracking-wider ring-1",
        s.bg,
        s.text,
        s.ring,
      ].join(" ")}
      title={provider}
    >
      {s.short}
    </span>
  );
};

const HeartIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M9 13a3 3 0 0 0 4.2 0l3-3a3 3 0 0 0-4.2-4.2l-1 1" />
    <path d="M15 11a3 3 0 0 0-4.2 0l-3 3a3 3 0 0 0 4.2 4.2l1-1" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

const BanIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </svg>
);

const ProviderCircle = ({ provider }: { provider?: string | null }) => {
  const upper = (provider ?? "").toUpperCase();
  if (upper === "XERO")
    return (
      <span
        title="Xero"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white"
      >
        xero
      </span>
    );
  if (upper === "QBO" || upper === "QUICKBOOKS")
    return (
      <span
        title="QuickBooks"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white"
      >
        qb
      </span>
    );
  return (
    <span
      title="Not connected"
      className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-[10px] font-bold text-ink-400 ring-1 ring-ink-200"
    >
      —
    </span>
  );
};

const StatusIcons = ({ r }: { r: PanoramaClient }) => {
  const provider = effectiveProvider(r);
  const connected = !!provider;
  const dead = !!r.needs_reconnect;
  return (
    <div className="flex items-center gap-1.5">
      <ProviderCircle provider={provider} />
      {dead ? (
        <span
          title="Xero connection expired — data is no longer syncing"
          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Disconnected
        </span>
      ) : (
        <span
          title={connected ? "Connected" : "Not connected"}
          className={[
            "flex h-7 w-7 items-center justify-center rounded-full ring-1",
            connected
              ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
              : "bg-ink-50 text-ink-300 ring-ink-200",
          ].join(" ")}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
};

const HealthGauge = ({ score }: { score: number | null }) => {
  if (score === null)
    return (
      <div className="flex h-14 flex-col items-center justify-center">
        <span className="text-xs font-semibold text-ink-400">—</span>
        <span className="text-[9px] uppercase tracking-wider text-ink-300">
          no data
        </span>
      </div>
    );
  const tone = score >= 80 ? "emerald" : score >= 60 ? "amber" : "rose";
  const stroke =
    tone === "emerald" ? "#10b981" : tone === "amber" ? "#f59e0b" : "#f43f5e";
  const heartCls =
    tone === "emerald"
      ? "text-emerald-500"
      : tone === "amber"
        ? "text-amber-500"
        : "text-rose-500";
  const r = 18;
  const c = 2 * Math.PI * r;
  const track = 0.75 * c;
  const val = (Math.max(0, Math.min(100, score)) / 100) * track;
  return (
    <div className="relative h-14 w-14">
      <svg viewBox="0 0 48 48" className="h-full w-full">
        <g transform="rotate(135 24 24)">
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            style={{ stroke: "rgb(var(--ink-900) / 0.08)" }}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${track} ${c}`}
          />
          <circle
            cx="24"
            cy="24"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${val} ${c}`}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-bold leading-none tabular-nums text-ink-800">
          {score}%
        </span>
        <HeartIcon className={["mt-0.5 h-2.5 w-2.5", heartCls].join(" ")} />
      </div>
    </div>
  );
};

const Pill = ({
  children,
  tone = "neutral",
}: {
  children: string | number;
  tone?: "neutral" | "rose" | "amber";
}) => {
  const cls =
    tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-ink-50 text-ink-600 ring-ink-200";
  return (
    <span
      className={[
        "inline-flex min-w-[2.75rem] items-center justify-center rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums ring-1",
        cls,
      ].join(" ")}
    >
      {children}
    </span>
  );
};

const KpiStat = ({
  label,
  value,
  caption,
  valueTone = "ink",
}: {
  label: string;
  value: number;
  caption: string;
  valueTone?: "ink" | "rose" | "amber";
}) => {
  const valueCls =
    valueTone === "rose"
      ? "text-rose-700"
      : valueTone === "amber"
        ? "text-amber-700"
        : "text-ink-900";
  return (
    <div className="px-6 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-[28px] font-semibold leading-none tabular-nums tracking-tight",
          valueCls,
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-ink-500">{caption}</p>
    </div>
  );
};

interface AllClientsViewProps {
  onPick: (client: PanoramaClient) => void;
  restrictToIds?: string[];
}

export const AllClientsView = ({ onPick, restrictToIds }: AllClientsViewProps) => {
  const [rows, setRows] = useState<PanoramaClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [provider, setProvider] = useState<ProviderFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [bankByCompany, setBankByCompany] = useState<Record<string, BankBits>>(
    {},
  );
  const [nonce, setNonce] = useState(0);
  const [confirmTarget, setConfirmTarget] = useState<PanoramaClient | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PanoramaClient | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [forgetTarget, setForgetTarget] = useState<PanoramaClient | null>(null);
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [forgetError, setForgetError] = useState<string | null>(null);
  const [forgetConfirm, setForgetConfirm] = useState("");
  const [forgetHint, setForgetHint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchCompaniesPanorama(
      windowDays,
      provider === "all" ? null : provider,
    )
      .then((data) => {
        if (!active) return;
        setRows(data.results || []);
        setLoadError(data.error ?? null);
        setAuthRequired(!!data.authRequired);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [windowDays, provider, nonce]);

  const onConfirmDisconnect = async () => {
    const target = confirmTarget;
    if (!target) return;
    setDisconnecting(target.company_id);
    setDisconnectError(null);
    const res = await disconnectCompany(target.company_id);
    setDisconnecting(null);
    if (res.ok) {
      setConfirmTarget(null);
      setNonce((n) => n + 1);
    } else {
      setDisconnectError(res.error ?? "Disconnect failed.");
    }
  };

  const onConfirmDelete = async () => {
    const target = deleteTarget;
    if (!target || deleteConfirm.trim() !== target.name) return;
    setDeleting(target.company_id);
    setDeleteError(null);
    const res = await deleteCompanyPermanently(target.company_id);
    setDeleting(null);
    if (res.ok) {
      setDeleteTarget(null);
      setDeleteConfirm("");
      setNonce((n) => n + 1);
    } else {
      setDeleteError(res.error ?? "Delete failed.");
    }
  };

  const onConfirmForget = async () => {
    const target = forgetTarget;
    if (!target || forgetConfirm.trim() !== target.name) return;
    setForgetting(target.company_id);
    setForgetError(null);
    const res = await forgetCompany(target.company_id);
    setForgetting(null);
    if (res.ok) {
      setForgetTarget(null);
      setForgetConfirm("");
      setForgetHint(
        res.revoked === false
          ? `“${target.name}” removed — its Xero token was already expired, nothing to revoke.`
          : `“${target.name}” forgotten. Xero access revoked — it’s back in Xero’s allow-access list for a fresh reconnect.`,
      );
      setNonce((n) => n + 1);
    } else {
      setForgetError(res.error ?? "Forget failed.");
    }
  };

  useEffect(() => {
    let active = true;
    fetchFirmSummary().then((r) => {
      if (!active || !r.ok) return;
      const map: Record<string, BankBits> = {};
      for (const c of r.data.clients ?? []) {
        map[c.company_id] = {
          unreconciled: c.unreconciled_bank_items,
          lastReconciled: c.last_bank_reconciled,
          recentTxn: c.most_recent_transaction,
        };
      }
      setBankByCompany(map);
    });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const providerMatches = (p?: string | null): boolean => {
      if (provider === "all") return true;
      if (!p) return false;
      const norm = p.toUpperCase();
      if (provider === "QBO") return norm === "QBO" || norm === "QUICKBOOKS";
      return norm === provider;
    };

    const preFiltered = rows.filter((r) => {
      if (restrictToIds && !restrictToIds.includes(r.company_id)) return false;
      return providerMatches(effectiveProvider(r));
    });

    const list = q
      ? preFiltered.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.company_id.toLowerCase().includes(q) ||
            (effectiveProvider(r) ?? "").toLowerCase().includes(q),
        )
      : preFiltered;

    const sorted = [...list];
    if (sortKey === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortKey === "trapped") {
      sorted.sort((a, b) => b.trapped_count - a.trapped_count);
    } else if (sortKey === "score") {
      sorted.sort((a, b) => {
        const av = a.health_score ?? 101;
        const bv = b.health_score ?? 101;
        return av - bv;
      });
    } else {
      sorted.sort((a, b) => {
        const av = a.health_score ?? 999;
        const bv = b.health_score ?? 999;
        if (av !== bv) return av - bv;
        return b.trapped_count - a.trapped_count;
      });
    }
    return sorted;
  }, [rows, search, sortKey, provider, restrictToIds]);

  const counts = useMemo(() => {
    let risky = 0;
    let healthy = 0;
    let trapped = 0;
    for (const r of filtered) {
      if (r.health_score !== null && r.health_score < 60) risky += 1;
      if (r.health_score !== null && r.health_score >= 80) healthy += 1;
      trapped += r.trapped_count;
    }
    return { risky, healthy, trapped };
  }, [filtered]);

  if (!loading && !restrictToIds && rows.length === 0 && !loadError && !authRequired) {
    return (
      <XeroOnboarding reloadKey={nonce} onChanged={() => setNonce((n) => n + 1)} />
    );
  }

  return (
    <div className="space-y-5">
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4"
          onClick={() => {
            if (!disconnecting) setConfirmTarget(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink-900">
              Disconnect {confirmTarget.name}?
            </h3>
            <p className="mt-2 text-sm text-ink-500">
              This hides the org and stops syncing &amp; audits. Your Xero data
              stays safe — reconnect anytime with “Connect to Xero” and it
              returns with full history (no re-import).
            </p>
            {disconnectError && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                {disconnectError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={!!disconnecting}
                onClick={() => setConfirmTarget(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!disconnecting}
                onClick={onConfirmDisconnect}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4"
          onClick={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setDeleteConfirm("");
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                <TrashIcon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink-900">
                  Remove {deleteTarget.name}?
                </h3>
                <p className="mt-1.5 text-sm text-ink-500">
                  Deletes{" "}
                  <strong className="font-semibold text-ink-700">all</strong> its
                  synced data, audits and history. Your Xero connection is left
                  untouched — the org is parked in “Removed Organisations”, where
                  you can re-allow it later.{" "}
                  <strong className="font-semibold text-rose-700">
                    The data cannot be recovered.
                  </strong>
                </p>
              </div>
            </div>
            <label className="mt-4 block text-xs font-medium text-ink-600">
              Type{" "}
              <span className="font-semibold text-ink-900">
                {deleteTarget.name}
              </span>{" "}
              to confirm
            </label>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              disabled={!!deleting}
              autoFocus
              placeholder={deleteTarget.name}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50"
            />
            {deleteError && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={!!deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirm("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !!deleting || deleteConfirm.trim() !== deleteTarget.name
                }
                onClick={onConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
      {forgetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4"
          onClick={() => {
            if (!forgetting) {
              setForgetTarget(null);
              setForgetConfirm("");
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 ring-1 ring-rose-300">
                <BanIcon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-ink-900">
                  Permanently forget {forgetTarget.name}?
                </h3>
                <p className="mt-1.5 text-sm text-ink-500">
                  Deletes all data{" "}
                  <strong className="font-semibold text-ink-700">and</strong>{" "}
                  revokes this org’s Xero access (other orgs on the same login
                  stay connected). It’s gone everywhere — not even in “Removed
                  Organisations”. It returns to Xero’s allow-access list, so a
                  fresh reconnect is the only way back.{" "}
                  <strong className="font-semibold text-rose-700">
                    This cannot be undone.
                  </strong>
                </p>
              </div>
            </div>
            <label className="mt-4 block text-xs font-medium text-ink-600">
              Type{" "}
              <span className="font-semibold text-ink-900">
                {forgetTarget.name}
              </span>{" "}
              to confirm
            </label>
            <input
              value={forgetConfirm}
              onChange={(e) => setForgetConfirm(e.target.value)}
              disabled={!!forgetting}
              autoFocus
              placeholder={forgetTarget.name}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-900 shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50"
            />
            {forgetError && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                {forgetError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={!!forgetting}
                onClick={() => {
                  setForgetTarget(null);
                  setForgetConfirm("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !!forgetting || forgetConfirm.trim() !== forgetTarget.name
                }
                onClick={onConfirmForget}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forgetting ? "Forgetting…" : "Permanently forget"}
              </button>
            </div>
          </div>
        </div>
      )}
      {filtered.some((r) => r.needs_reconnect) && <ReconnectBanner plural />}
      <header className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_auto]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            </span>
            Practice panorama
          </div>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-tight text-ink-900">
            Your clients, triaged.
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-500">
            Every connected ledger, ranked worst-first. Click a row to drill
            into the full health report.
          </p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-ink-200 rounded-xl border border-ink-200 bg-surface">
          <KpiStat
            label="Connected"
            value={filtered.length}
            caption={(() => {
              const providers = new Set(
                filtered
                  .map((r) => effectiveProvider(r))
                  .filter((p): p is string => !!p),
              );
              return `across ${providers.size} provider${
                providers.size === 1 ? "" : "s"
              }`;
            })()}
          />
          <KpiStat
            label="At risk"
            value={counts.risky}
            caption={
              counts.risky === 0 ? "all above 60%" : "score below 60%"
            }
            valueTone={counts.risky > 0 ? "rose" : "ink"}
          />
          <KpiStat
            label="Trapped"
            value={counts.trapped}
            caption="across all clients"
            valueTone={counts.trapped > 0 ? "amber" : "ink"}
          />
        </div>
      </header>

      <div className="rounded-xl border border-ink-200 bg-surface shadow-card">
        <div className="flex flex-wrap items-end gap-4 border-b border-ink-100 px-5 py-3.5">
          <div className="min-w-[220px] flex-1">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Search client
            </label>
            <div className="relative mt-1">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3-3" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, ID, or provider"
                className="w-full rounded-lg border border-ink-200 bg-surface py-1.5 pl-8 pr-3 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Window
            </label>
            <div className="mt-1 inline-flex rounded-lg border border-ink-200 bg-surface p-0.5 text-xs font-medium text-ink-600 shadow-sm">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWindowDays(d)}
                  className={[
                    "rounded-md px-2.5 py-1 transition",
                    windowDays === d
                      ? "bg-brand-50 text-brand-700"
                      : "hover:text-ink-900",
                  ].join(" ")}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Provider
            </label>
            <div className="mt-1 inline-flex rounded-lg border border-ink-200 bg-surface p-0.5 text-xs font-medium text-ink-600 shadow-sm">
              {(["all", "XERO", "QBO"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={[
                    "rounded-md px-2.5 py-1 transition",
                    provider === p
                      ? "bg-brand-50 text-brand-700"
                      : "hover:text-ink-900",
                  ].join(" ")}
                >
                  {p === "all" ? "All" : p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Sort by
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="mt-1 rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="severity">Worst first</option>
              <option value="score">Score ↑</option>
              <option value="trapped">Most trapped</option>
              <option value="name">Name A→Z</option>
            </select>
          </div>

          <span className="ml-auto text-[11px] font-medium text-ink-500">
            {loading ? "Loading…" : `${filtered.length} client${filtered.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {forgetHint && (
          <div className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-100">
            <span>{forgetHint}</span>
            <button
              type="button"
              onClick={() => setForgetHint(null)}
              className="shrink-0 font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-ink-500">
            Loading panorama…
          </div>
        ) : loadError ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
                <path d="M12 9v5M12 17.5v.1" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-ink-800">
              {authRequired
                ? "Sign-in required"
                : "Couldn't load the panorama"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-500">
              {authRequired
                ? "The backend needs a valid token. Go to Settings → Developer access and paste your JWT, then refresh."
                : loadError}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-medium text-ink-800">
              {rows.length === 0
                ? "No clients connected"
                : "Nothing matches your filters"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-500">
              {rows.length === 0
                ? "Connect a Xero or QuickBooks org in EazyCapture, then refresh."
                : "Try clearing the search or switching the provider filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-ink-50/60 text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-5 py-2.5 text-left font-semibold">
                    Client ref.
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Business name
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    Status
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Bookkeeping health
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Issues
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Recent txn
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Last reconciled
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Unrec. bank
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold">
                    Last audit
                  </th>
                  <th className="px-5 py-2.5 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((r, idx) => {
                  const tone = scoreTone(r.health_score);
                  const ref = clientRef(r.company_id, idx);
                  const bank = bankByCompany[r.company_id];
                  const needsReconnect = !!r.needs_reconnect;
                  return (
                    <tr
                      key={r.company_id}
                      className={[
                        "group transition",
                        needsReconnect
                          ? "bg-rose-50/30"
                          : "cursor-pointer hover:bg-brand-50/30",
                      ].join(" ")}
                      onClick={needsReconnect ? undefined : () => onPick(r)}
                    >
                      <td className="px-5 py-3 font-mono text-[11px] text-ink-500">
                        {ref}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={[
                            "font-medium",
                            needsReconnect
                              ? "text-ink-900"
                              : "text-ink-900 group-hover:text-brand-700",
                          ].join(" ")}
                        >
                          {r.name}
                        </span>
                        {needsReconnect && (
                          <span className="mt-0.5 block text-[11px] font-medium text-rose-600">
                            Xero connection expired — data is no longer syncing.
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusIcons r={r} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-center">
                          <HealthGauge score={r.health_score} />
                          <span
                            className={`text-[10px] font-medium uppercase tracking-wider ${tone.text}`}
                          >
                            {tone.label}
                          </span>
                        </div>
                      </td>
                      <td
                        className="px-3 py-3 text-right"
                        title={
                          r.open_document_issues != null &&
                          r.open_contact_issues != null
                            ? `${r.open_document_issues} document + ${r.open_contact_issues} contact issues`
                            : undefined
                        }
                      >
                        <Pill tone={r.trapped_count > 0 ? "rose" : "neutral"}>
                          {r.trapped_count}
                        </Pill>
                        {r.trapped_count > 0 &&
                          r.open_document_issues != null &&
                          r.open_contact_issues != null && (
                            <span className="mt-1 block text-[10px] font-normal text-ink-400">
                              {r.open_document_issues} doc · {r.open_contact_issues} contact
                            </span>
                          )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Pill>{shortDate(bank?.recentTxn ?? null)}</Pill>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Pill>{shortDate(bank?.lastReconciled ?? null)}</Pill>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Pill
                          tone={
                            bank?.unreconciled != null && bank.unreconciled > 0
                              ? "amber"
                              : "neutral"
                          }
                        >
                          {bank?.unreconciled ?? "—"}
                        </Pill>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Pill>{fmtRelative(r.last_audit_at)}</Pill>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {needsReconnect ? (
                            <span onClick={(e) => e.stopPropagation()}>
                              <ConnectXeroButton size="sm" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPick(r);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                            >
                              Open
                              <svg
                                viewBox="0 0 24 24"
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12h14M13 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                          {(r.nango_connection_id || r.xero_tenant_id) && (
                            <button
                              type="button"
                              title="Disconnect this Xero organisation (data kept, reconnect anytime)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDisconnectError(null);
                                setConfirmTarget(r);
                              }}
                              className="inline-flex items-center rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600"
                            >
                              Disconnect
                            </button>
                          )}
                          <button
                            type="button"
                            title="Remove — delete all data but keep the Xero connection (parked in Removed Organisations, re-allow later)"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteError(null);
                              setDeleteConfirm("");
                              setDeleteTarget(r);
                            }}
                            className="inline-flex items-center rounded-md border border-ink-200 px-2 py-1 text-ink-400 transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                          {(r.nango_connection_id || r.xero_tenant_id) && (
                            <button
                              type="button"
                              title="Permanently forget — delete all data AND revoke Xero access (gone everywhere; reconnect fresh via Xero)"
                              onClick={(e) => {
                                e.stopPropagation();
                                setForgetError(null);
                                setForgetConfirm("");
                                setForgetTarget(r);
                              }}
                              className="inline-flex items-center rounded-md border border-ink-200 px-2 py-1 text-ink-400 transition hover:border-rose-500 hover:bg-rose-100 hover:text-rose-700"
                            >
                              <BanIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DisconnectedOrgs
        reloadKey={nonce}
        onChanged={() => setNonce((n) => n + 1)}
      />

      <RemovedOrgs reloadKey={nonce} onChanged={() => setNonce((n) => n + 1)} />
    </div>
  );
};
