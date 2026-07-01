import { useEffect, useState } from "react";

import {
  excludeUnreconciledBankAccount,
  fetchUnreconciledBankItems,
} from "@/services/audit.service";
import {
  UnreconciledBankItem,
  UnreconciledBankResponse,
} from "@/types/audit.types";

// We can only see the ledger side (Received + Spent); "Unexplained" needs Xero's
// Finance API, so it's null here rather than a misleadingly low 0.
export const UnreconciledBankItemsPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const [data, setData] = useState<UnreconciledBankResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRemoved(new Set());
    fetchUnreconciledBankItems(companyId).then((d) => {
      if (!active) return;
      if (!d) setError("Couldn’t load unreconciled bank items.");
      setData(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, refreshKey]);

  const items = (data?.items ?? []).filter((i) => !removed.has(i.account_code));
  const totalToReconcile = items.reduce(
    (s, i) => s + (Number(i.total_to_reconcile) || 0),
    0,
  );
  const unexplainedAvailable = data?.unexplained_available ?? false;

  const onExclude = async (it: UnreconciledBankItem) => {
    setBusy(it.account_code);
    const res = await excludeUnreconciledBankAccount(companyId, it.account_code, true);
    setBusy(null);
    if (res.ok) setRemoved((p) => new Set(p).add(it.account_code));
    else setError(res.error ?? "Exclude failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!loading && items.length > 0 && (
          <span className="text-xs text-ink-500">
            {items.length} account{items.length === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold text-ink-800">
              {totalToReconcile} item{totalToReconcile === 1 ? "" : "s"} to reconcile
            </span>
          </span>
        )}
      </div>

      {!loading && !unexplainedAvailable && items.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <span>
            The feed-side <strong>“Unexplained”</strong> count needs Xero’s Finance
            API, which isn’t available on this connection. Counts below are the
            ledger side only (Received + Spent) — the true total may be higher.
          </span>
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading…
        </p>
      ) : !data ? null : items.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          All bank accounts reconciled
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const itBusy = busy === it.account_code;
            return (
              <section
                key={it.account_code}
                className="relative rounded-2xl border border-ink-100 bg-white p-4 text-center shadow-card"
              >
                <button
                  type="button"
                  onClick={() => onExclude(it)}
                  disabled={itBusy}
                  aria-label="Exclude this account"
                  title="Exclude this account from the check"
                  className="absolute right-2 top-2 rounded p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>

                <h3 className="text-sm font-semibold text-brand-700">
                  {it.account_name}
                </h3>
                <p className="mt-1.5 text-base font-semibold text-ink-900">
                  {it.total_to_reconcile} item
                  {it.total_to_reconcile === 1 ? "" : "s"} to reconcile
                </p>

                <dl className="mt-3 space-y-1.5 text-left text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-500">Unexplained</dt>
                    <dd
                      className="italic text-ink-400"
                      title="Requires Xero Finance API"
                    >
                      {it.unexplained == null
                        ? "— (Finance API)"
                        : it.unexplained}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-500">Unreconciled (Received)</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">
                      {it.unreconciled_received}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-500">Unreconciled (Spent)</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">
                      {it.unreconciled_spent}
                    </dd>
                  </div>
                </dl>

                {it.process_url && (
                  <div className="mt-3">
                    <a
                      href={it.process_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      Process
                    </a>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
