import { useEffect, useState } from "react";

import {
  excludeBankAccount,
  fetchBankBalanceCheck,
  markBankBalanceOk,
  setStatementBalance,
} from "@/services/audit.service";
import { BankBalanceCheckResponse, BankBalanceItem } from "@/types/audit.types";

const money = (amt: number | string | null | undefined, cur?: string | null) => {
  const n = typeof amt === "string" ? parseFloat(amt) : (amt ?? 0);
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: cur || "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
};

const shortDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const endOfThisMonth = (): string => {
  const d = new Date();
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(
    e.getDate(),
  ).padStart(2, "0")}`;
};

// One card per account: ledger (Xero TB) vs the manually entered statement
// balance at a chosen period end.
export const BankBalanceCheckPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const [periodEnd, setPeriodEnd] = useState(endOfThisMonth());
  const [showAll, setShowAll] = useState(false);
  const [data, setData] = useState<BankBalanceCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRemoved(new Set());
    fetchBankBalanceCheck(companyId, periodEnd, showAll).then((d) => {
      if (!active) return;
      if (!d) setError("Couldn’t load bank balance check.");
      setData(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, periodEnd, showAll, nonce, refreshKey]);

  const refetch = () => setNonce((n) => n + 1);

  const items = (data?.items ?? []).filter((i) => !removed.has(i.account_code));

  const onSaveBalance = async (it: BankBalanceItem) => {
    const v = parseFloat(balanceInput);
    if (!Number.isFinite(v)) {
      setEditing(null);
      return;
    }
    setBusy(it.account_code);
    const res = await setStatementBalance(companyId, it.account_code, periodEnd, v);
    setBusy(null);
    setEditing(null);
    setBalanceInput("");
    if (res.ok) refetch();
    else setError(res.error ?? "Save failed");
  };

  const onMarkOk = async (it: BankBalanceItem) => {
    setBusy(it.account_code);
    const res = await markBankBalanceOk(companyId, it.account_code, periodEnd, true);
    setBusy(null);
    if (res.ok) setRemoved((p) => new Set(p).add(it.account_code));
    else setError(res.error ?? "Mark OK failed");
  };

  const onExclude = async (it: BankBalanceItem) => {
    setBusy(it.account_code);
    const res = await excludeBankAccount(companyId, it.account_code, true);
    setBusy(null);
    if (res.ok) setRemoved((p) => new Set(p).add(it.account_code));
    else setError(res.error ?? "Exclude failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
            Period end
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
            <button
              type="button"
              role="switch"
              aria-checked={showAll}
              onClick={() => setShowAll((v) => !v)}
              className={[
                "relative h-5 w-9 rounded-full transition",
                showAll ? "bg-brand-600" : "bg-ink-200",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                  showAll ? "left-[18px]" : "left-0.5",
                ].join(" ")}
              />
            </button>
            Show all bank accounts
          </label>
        </div>
        {!loading && (
          <span className="text-xs text-ink-500">
            {items.length} account{items.length === 1 ? "" : "s"} · Total potential
            errors:{" "}
            <span className="font-semibold text-ink-800">
              {money(data?.total_value, "GBP")}
            </span>
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          All bank balances reconcile
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => {
            const cur = it.currency_code;
            const hasStmt = it.per_bank_statement != null;
            const editingThis = editing === it.account_code;
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
                  className="absolute right-2 top-2 rounded p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>

                <h3 className="text-sm font-semibold text-brand-700">
                  {it.account_name}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  Closing balance at {shortDate(it.period_end || periodEnd)}
                </p>

                <dl className="mt-3 space-y-1.5 text-left text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-500">Per bank statement</dt>
                    <dd>
                      {editingThis ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={balanceInput}
                            onChange={(e) => setBalanceInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onSaveBalance(it);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="w-24 rounded-md border border-ink-200 px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                          />
                          <button
                            type="button"
                            onClick={() => onSaveBalance(it)}
                            disabled={itBusy}
                            className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                        </span>
                      ) : hasStmt ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(it.account_code);
                            setBalanceInput(String(it.per_bank_statement ?? ""));
                          }}
                          className="font-semibold tabular-nums text-ink-900 hover:text-brand-700"
                        >
                          {money(it.per_bank_statement, cur)}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(it.account_code);
                            setBalanceInput("");
                          }}
                          className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
                        >
                          Click to add balance
                        </button>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-500">Per Xero statement</dt>
                    <dd className="text-ink-400" title="Requires Xero Finance API">
                      —
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-ink-500">Per Xero TB</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">
                      {money(it.per_xero_tb, cur)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-1.5">
                    <dt className="font-semibold text-rose-600">Difference</dt>
                    <dd className="font-semibold tabular-nums text-rose-600">
                      {it.difference == null ? (
                        <span className="text-[11px] font-normal italic text-ink-400">
                          Add balance to compare
                        </span>
                      ) : (
                        money(it.difference, cur)
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {it.process_url && (
                    <a
                      href={it.process_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-brand transition hover:brightness-110"
                    >
                      Process
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onMarkOk(it)}
                    disabled={itBusy}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {itBusy ? "…" : 'Mark as "OK"'}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
