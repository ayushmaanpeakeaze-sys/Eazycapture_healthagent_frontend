import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDataSyncStatus,
  maxSyncTime,
  triggerDataSync,
} from "../../services/audit.service";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fmtSynced = (ms: number | null): string => {
  if (!ms) return "Never synced";
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Pulls Xero → DB (data only, no audit) and shows when it last ran. Lives in the
 * client breadcrumb, so it's on every per-client page. Sync is separate from the
 * Overview re-audit and the Insights recompute — it only refreshes the raw data.
 */
export const SyncButton = ({ companyId }: { companyId: string }) => {
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Read the current "last synced" time when the client changes.
  useEffect(() => {
    if (!companyId) return;
    let active = true;
    fetchDataSyncStatus(companyId).then((s) => {
      if (active) setLastSynced(maxSyncTime(s));
    });
    return () => {
      active = false;
    };
  }, [companyId]);

  const onSync = useCallback(async () => {
    if (!companyId || syncing) return;
    setSyncing(true);
    setError(null);
    const before = lastSynced ?? 0;
    try {
      const res = await triggerDataSync(companyId);
      if (!res.ok) {
        setError(res.error ?? "Sync failed");
        setSyncing(false);
        return;
      }
      // The sync runs async on the backend with no "in progress" signal — the
      // only proof is last_sync_at advancing. Poll for it, but cap at ~36s and
      // always stop: a slow/idle worker (or a no-op incremental) must not leave
      // the button spinning forever. Whatever timestamp we end with, we show.
      let latest = before;
      for (let i = 0; i < 12; i++) {
        await sleep(3000);
        if (!mounted.current) return;
        latest = maxSyncTime(await fetchDataSyncStatus(companyId)) ?? latest;
        if (latest > before) break;
      }
      setLastSynced(latest > 0 ? latest : before);
    } catch (err) {
      if (mounted.current)
        setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      if (mounted.current) setSyncing(false);
    }
  }, [companyId, lastSynced, syncing]);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onSync}
        disabled={syncing || !companyId}
        title="Pull the latest data from Xero (no re-audit)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-card transition hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <svg
          viewBox="0 0 24 24"
          className={["h-3.5 w-3.5", syncing ? "animate-spin" : ""].join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
        {syncing ? "Syncing…" : "Sync"}
      </button>
      <span className="text-[11px] text-ink-400">
        {error ? (
          <span className="text-rose-600">{error}</span>
        ) : (
          <>Last synced: {fmtSynced(lastSynced)}</>
        )}
      </span>
    </div>
  );
};
