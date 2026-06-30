import { useEffect, useState } from "react";

import {
  ExcludedOrg,
  fetchExcludedOrgs,
  reAllowExcludedOrg,
} from "@/services/audit.service";

// Collapsible list of permanently-deleted orgs (excluded from re-creation).
// "Re-allow" clears one org's exclusion (per-org) so the next "Connect to Xero"
// re-creates it from a fresh sync. Unlike Disconnect, the old data is gone.
// `reloadKey` bumps to refetch; `onChanged` fires after a re-allow.
export const RemovedOrgs = ({
  reloadKey = 0,
  onChanged,
  defaultOpen = false,
}: {
  reloadKey?: number;
  onChanged?: () => void;
  defaultOpen?: boolean;
}) => {
  const [orgs, setOrgs] = useState<ExcludedOrg[]>([]);
  const [open, setOpen] = useState(defaultOpen);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchExcludedOrgs().then((list) => {
      if (active) setOrgs(list);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const onReAllow = async (org: ExcludedOrg) => {
    setBusyId(org.xero_tenant_id);
    setError(null);
    const res = await reAllowExcludedOrg(org.xero_tenant_id);
    setBusyId(null);
    if (res.ok) {
      setOrgs((prev) =>
        prev.filter((o) => o.xero_tenant_id !== org.xero_tenant_id),
      );
      setHint(
        `“${org.name}” re-allowed. Click “Connect to Xero” to restore it (no re-authorisation needed).`,
      );
      onChanged?.();
    } else {
      setError(res.error ?? "Re-allow failed.");
    }
  };

  if (orgs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-ink-100 bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-700">
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 text-ink-400 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          Removed organisations
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 ring-1 ring-rose-100">
            {orgs.length}
          </span>
        </span>
        <span className="text-[11px] text-ink-400">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-100">
          {hint && (
            <p className="mx-5 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-100">
              {hint}
            </p>
          )}
          {error && (
            <p className="mx-5 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
              {error}
            </p>
          )}
          <ul className="divide-y divide-ink-50">
            {orgs.map((o) => {
              const busy = busyId === o.xero_tenant_id;
              return (
                <li
                  key={o.xero_tenant_id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-800">
                      {o.name}
                    </span>
                    <span className="text-[11px] text-ink-400">
                      Deleted — re-allow, then reconnect for a fresh sync
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onReAllow(o)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-60"
                  >
                    {busy ? "Re-allowing…" : "Re-allow"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
