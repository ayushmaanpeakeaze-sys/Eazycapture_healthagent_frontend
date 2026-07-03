import { useCallback, useEffect, useRef, useState } from "react";

import { useDataSynced, notifyDataSynced } from "../../hooks/useDataSynced";
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
export const SyncButton = ({
  companyId,
  disabled = false,
}: {
  companyId: string;
  /** Gated off when the Xero grant is dead — reconnect first. */
  disabled?: boolean;
}) => {
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

  // If a sync finishes (e.g. triggered elsewhere), keep the timestamp fresh.
  useDataSynced(companyId, () => {
    fetchDataSyncStatus(companyId).then((s) => {
      if (mounted.current) setLastSynced(maxSyncTime(s));
    });
  });

  const onSync = useCallback(async () => {
    if (!companyId || syncing) return;
    setSyncing(true);
    setError(null);
    const before = lastSynced ?? 0;

    let res;
    try {
      res = await triggerDataSync(companyId);
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : "Sync failed");
        setSyncing(false);
      }
      return;
    }
    if (!res.ok) {
      if (mounted.current) {
        setError(res.error ?? "Sync failed");
        setSyncing(false);
      }
      return;
    }

    // Spin until the backend reports the sync finished: the `syncing` flag going
    // true→false (the reliable signal, ~5s). Fallback for older backends that
    // don't send the flag: last_sync_at advancing. The ~36s cap is a safety net
    // so it can never hang.
    let latest = before;
    let sawSyncing = false;
    for (let i = 0; i < 18; i++) {
      await sleep(2000);
      if (!mounted.current) return;
      const s = await fetchDataSyncStatus(companyId);
      latest = maxSyncTime(s) ?? latest;
      if (typeof s?.syncing === "boolean") {
        if (s.syncing) sawSyncing = true;
        // Flag idle → sync done (or there was nothing to do). One poll's grace
        // so a sync that hasn't flipped the flag true yet isn't missed.
        else if (sawSyncing || latest > before || i >= 1) break;
      } else if (latest > before) {
        break; // no flag: timestamp advanced
      }
    }
    if (mounted.current) {
      setLastSynced(latest > 0 ? latest : before);
      setSyncing(false);
      // Tell whichever data view is open to re-fetch the freshly synced data.
      notifyDataSynced(companyId);
    }
  }, [companyId, lastSynced, syncing]);

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onSync}
        disabled={syncing || !companyId || disabled}
        title={
          disabled
            ? "Reconnect to Xero to resume syncing"
            : "Pull the latest data from Xero (no re-audit)"
        }
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
        ) : disabled ? (
          <span className="text-rose-600">Reconnect to resume syncing</span>
        ) : (
          <>Last synced: {fmtSynced(lastSynced)}</>
        )}
      </span>
    </div>
  );
};
