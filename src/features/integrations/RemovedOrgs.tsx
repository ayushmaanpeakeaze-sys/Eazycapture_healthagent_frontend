import { useEffect, useState } from "react";

import {
  ExcludedOrg,
  fetchExcludedOrgs,
  forgetExcludedOrg,
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
  const [busy, setBusy] = useState<{
    id: string;
    kind: "reallow" | "forget";
  } | null>(null);
  const [confirmForgetId, setConfirmForgetId] = useState<string | null>(null);
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
    setBusy({ id: org.xero_tenant_id, kind: "reallow" });
    setError(null);
    const res = await reAllowExcludedOrg(org.xero_tenant_id);
    setBusy(null);
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

  const onForget = async (org: ExcludedOrg) => {
    setBusy({ id: org.xero_tenant_id, kind: "forget" });
    setError(null);
    const res = await forgetExcludedOrg(org.xero_tenant_id);
    setBusy(null);
    setConfirmForgetId(null);
    if (res.ok) {
      setOrgs((prev) =>
        prev.filter((o) => o.xero_tenant_id !== org.xero_tenant_id),
      );
      setHint(
        res.revoked === false
          ? `“${org.name}” forgotten — its Xero token was already expired, nothing to revoke.`
          : `“${org.name}” forgotten. Xero access revoked — it’s back in Xero’s allow-access list for a fresh reconnect.`,
      );
      onChanged?.();
    } else {
      setError(res.error ?? "Forget failed.");
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
              const anyBusy = busy?.id === o.xero_tenant_id;
              const reallowing = anyBusy && busy?.kind === "reallow";
              const forgetting = anyBusy && busy?.kind === "forget";
              const confirming = confirmForgetId === o.xero_tenant_id;
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
                      Deleted — re-allow to restore (keeps Xero), or forget to
                      revoke Xero access too
                    </span>
                  </span>
                  {confirming ? (
                    <span className="inline-flex shrink-0 items-center gap-2 text-xs">
                      <span className="text-ink-600">
                        Revoke Xero &amp; forget?
                      </span>
                      <button
                        type="button"
                        onClick={() => onForget(o)}
                        disabled={anyBusy}
                        className="font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-50"
                      >
                        {forgetting ? "Forgetting…" : "Yes"}
                      </button>
                      <span className="text-ink-300">·</span>
                      <button
                        type="button"
                        onClick={() => setConfirmForgetId(null)}
                        disabled={anyBusy}
                        className="font-medium text-ink-500 hover:text-ink-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onReAllow(o)}
                        disabled={anyBusy}
                        className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-60"
                      >
                        {reallowing ? "Re-allowing…" : "Re-allow"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setConfirmForgetId(o.xero_tenant_id);
                        }}
                        disabled={anyBusy}
                        title="Forget — revoke Xero access and remove from this list (reconnect fresh via Xero)"
                        className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-500 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
                      >
                        Forget
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
