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
  const [bgBusy, setBgBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  // Bumped on every tap so a fresh sync supersedes any in-flight background
  // watch — re-tapping is always responsive, never blocked by the last run.
  const runId = useRef(0);

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
    const myRun = ++runId.current; // supersede any background watch still running
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

    // The spinner is just a short acknowledgment that the sync was triggered —
    // it must NEVER hang. A consecutive tap the backend de-dupes (or an idle
    // worker) won't advance anything, so we don't keep the spinner hostage to
    // the backend finishing.
    await sleep(2000);
    if (!mounted.current) return;
    setSyncing(false);

    // Then watch quietly (no spinner, subtle "syncing…") for the result:
    // last_sync_at advancing, or the backend's `syncing` flag going true→idle.
    // Capped so it always ends; the displayed time refreshes to whatever is
    // current — if nothing changed (data already fresh) it stays put, honestly.
    setBgBusy(true);
    let latest = before;
    let sawSyncing = false;
    for (let i = 0; i < 18; i++) {
      if (!mounted.current || runId.current !== myRun) return; // unmounted or superseded
      const s = await fetchDataSyncStatus(companyId);
      latest = maxSyncTime(s) ?? latest;
      if (latest > before) break; // data refreshed — done
      if (typeof s?.syncing === "boolean") {
        if (s.syncing) sawSyncing = true;
        // Flag went idle: either the sync finished, or there was nothing to do
        // (give it a couple polls' grace so a just-started sync isn't missed).
        else if (sawSyncing || i >= 2) break;
      }
      await sleep(2000);
    }
    if (mounted.current && runId.current === myRun) {
      setLastSynced(latest > 0 ? latest : before);
      setBgBusy(false);
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
          <>
            Last synced: {fmtSynced(lastSynced)}
            {bgBusy && <span className="text-ink-400"> · syncing…</span>}
          </>
        )}
      </span>
    </div>
  );
};
