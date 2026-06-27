import { useEffect, useState } from "react";

import {
  dismissOpeningBalance,
  fetchLateTransactions,
  fetchOpeningBalanceDiffs,
  restoreOpeningBalance,
  setFiledNetAssets,
  setRegistrationNumber,
} from "../../services/audit.service";
import {
  LateTransaction,
  OpeningBalanceItem,
  OpeningBalanceResponse,
} from "../../types/audit.types";
import { TablePager, useClientPagination } from "@/features/checks/paginate";

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

// Opening Balance Differences — Xero net assets vs filed (Companies House /
// manual) at each period end, with a late-transactions drill-down.
export const OpeningBalanceDiffsPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const [data, setData] = useState<OpeningBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [regInput, setRegInput] = useState("");
  const [editingFiled, setEditingFiled] = useState<string | null>(null);
  const [filedInput, setFiledInput] = useState("");
  const [modalPeriod, setModalPeriod] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRemoved(new Set());
    fetchOpeningBalanceDiffs(companyId, showAll).then((d) => {
      if (!active) return;
      if (!d) setError("Couldn’t load opening balance differences.");
      setData(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, showAll, nonce, refreshKey]);

  const refetch = () => setNonce((n) => n + 1);
  const items = (data?.items ?? []).filter((i) => !removed.has(i.period_end));
  const pg = useClientPagination(items, `${showAll}`);

  const onSaveReg = async () => {
    if (!regInput.trim()) return;
    setBusy("reg");
    const res = await setRegistrationNumber(companyId, regInput.trim());
    setBusy(null);
    if (res.ok) {
      setRegInput("");
      refetch();
    } else setError(res.error ?? "Save failed");
  };

  const onSaveFiled = async (it: OpeningBalanceItem) => {
    const v = parseFloat(filedInput);
    setEditingFiled(null);
    if (!Number.isFinite(v)) return;
    setBusy(it.period_end);
    const res = await setFiledNetAssets(companyId, it.period_end, v);
    setBusy(null);
    if (res.ok) refetch();
    else setError(res.error ?? "Save failed");
  };

  const onDismiss = async (it: OpeningBalanceItem) => {
    setBusy(it.period_end);
    const res = await dismissOpeningBalance(companyId, it.period_end);
    setBusy(null);
    if (res.ok) setRemoved((p) => new Set(p).add(it.period_end));
    else setError(res.error ?? "Dismiss failed");
  };

  const onRestore = async (it: OpeningBalanceItem) => {
    setBusy(it.period_end);
    const res = await restoreOpeningBalance(companyId, it.period_end);
    setBusy(null);
    if (res.ok) setRemoved((p) => new Set(p).add(it.period_end));
    else setError(res.error ?? "Restore failed");
  };

  const needsSetup = data && !data.ch_connected && !data.registration_number;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          Show all results
        </label>
        {!loading && (
          <span className="text-xs text-ink-500">
            {items.length} period{items.length === 1 ? "" : "s"} · Total potential
            errors:{" "}
            <span className="font-semibold text-ink-800">
              {money(data?.total_value, "GBP")}
            </span>
          </span>
        )}
      </div>

      {/* Companies House setup prompt */}
      {needsSetup && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">Companies House not connected</p>
          <p className="mt-0.5 text-amber-800">
            Add your company registration number to auto-pull the filed accounts,
            or enter the filed Net Assets manually in the table below.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={regInput}
              onChange={(e) => setRegInput(e.target.value)}
              placeholder="Registration number"
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button
              type="button"
              onClick={onSaveReg}
              disabled={busy === "reg"}
              className="rounded-md bg-brand-gradient px-3 py-1 text-xs font-semibold text-white shadow-brand transition hover:brightness-110 disabled:opacity-60"
            >
              {busy === "reg" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
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
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showAll ? "No dismissed periods." : "Opening balances tie out 🎉"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="w-10 px-3 py-2.5">#</th>
                <th className="px-2 py-2.5">Period ended</th>
                <th className="px-2 py-2.5">Net assets (filed)</th>
                <th className="px-2 py-2.5">Net assets (per Xero)</th>
                <th className="px-2 py-2.5">Difference</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {pg.paged.map((it, i) => {
                const itBusy = busy === it.period_end;
                const editing = editingFiled === it.period_end;
                return (
                  <tr key={it.period_end} className="align-middle transition hover:bg-brand-50/20">
                    <td className="px-3 py-3 text-ink-400">
                      {pg.page * pg.limit + i + 1}
                    </td>
                    <td className="px-2 py-3 font-medium text-ink-900">
                      {shortDate(it.period_end)}
                    </td>
                    <td className="px-2 py-3">
                      {editing ? (
                        <span className="flex items-center gap-1">
                          <input
                            type="number"
                            autoFocus
                            value={filedInput}
                            onChange={(e) => setFiledInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onSaveFiled(it);
                              if (e.key === "Escape") setEditingFiled(null);
                            }}
                            className="w-24 rounded-md border border-ink-200 px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
                          />
                          <button
                            type="button"
                            onClick={() => onSaveFiled(it)}
                            className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
                          >
                            Save
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {it.net_assets_filed != null ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFiled(it.period_end);
                                setFiledInput(String(it.net_assets_filed ?? ""));
                              }}
                              className="font-semibold tabular-nums text-ink-900 hover:text-brand-700"
                            >
                              {money(it.net_assets_filed)}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFiled(it.period_end);
                                setFiledInput("");
                              }}
                              className="text-[11px] font-medium text-brand-600 hover:underline"
                            >
                              Add filed figure
                            </button>
                          )}
                          <span
                            title={
                              it.filed_source === "companies_house"
                                ? "From Companies House filed accounts"
                                : "Manually entered"
                            }
                            className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full bg-ink-100 text-[9px] font-bold text-ink-500"
                          >
                            ?
                          </span>
                          {it.filed_document_url && (
                            <a
                              href={it.filed_document_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Download filed accounts"
                              className="text-ink-400 hover:text-brand-600"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                              </svg>
                            </a>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 font-semibold tabular-nums text-ink-900">
                      {money(it.net_assets_xero)}
                    </td>
                    <td className="px-2 py-3">
                      {it.difference == null ? (
                        <span className="text-[11px] italic text-ink-400">
                          Add filed figure to compare
                        </span>
                      ) : (
                        <span className="font-semibold tabular-nums text-rose-600">
                          {money(it.difference)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setModalPeriod(it.period_end)}
                          className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                        >
                          Late transactions
                        </button>
                        {it.dismissed ? (
                          <button
                            type="button"
                            onClick={() => onRestore(it)}
                            disabled={itBusy}
                            className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
                          >
                            Add back
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onDismiss(it)}
                            disabled={itBusy}
                            className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <TablePager
            page={pg.page}
            setPage={pg.setPage}
            limit={pg.limit}
            setLimit={pg.setLimit}
            total={pg.total}
          />
        </div>
      )}

      {modalPeriod && (
        <LateTxnModal
          companyId={companyId}
          periodEnd={modalPeriod}
          onClose={() => setModalPeriod(null)}
        />
      )}
    </div>
  );
};

// ── Late transactions modal (lazy-loaded, "Show more" paged) ─────────────────

const PAGE = 5;

const LateTxnModal = ({
  companyId,
  periodEnd,
  onClose,
}: {
  companyId: string;
  periodEnd: string;
  onClose: () => void;
}) => {
  const [items, setItems] = useState<LateTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLateTransactions(companyId, periodEnd, PAGE, 0).then((d) => {
      if (!active) return;
      setItems(d?.items ?? []);
      setTotal(d?.total ?? 0);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, periodEnd]);

  const showMore = async () => {
    setLoadingMore(true);
    const d = await fetchLateTransactions(companyId, periodEnd, PAGE, items.length);
    setLoadingMore(false);
    if (d) {
      setItems((p) => [...p, ...(d.items ?? [])]);
      setTotal(d.total ?? total);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink-100">
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Late transactions</h3>
            <p className="text-[11px] text-ink-400">
              Posted after the period — up to {shortDate(periodEnd)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm italic text-ink-400">
            No late transactions for this period.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400 backdrop-blur">
                <tr>
                  <th className="w-8 px-3 py-2">#</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2">Accounting date</th>
                  <th className="px-2 py-2">Posted date</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {items.map((t, i) => (
                  <tr key={t.transaction_id} className="hover:bg-brand-50/20">
                    <td className="px-3 py-2 text-ink-400">{i + 1}</td>
                    <td className="px-2 py-2 text-ink-700">{t.type_label}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-ink-900">
                      {money(t.amount)}
                    </td>
                    <td className="px-2 py-2 text-ink-600">{shortDate(t.accounting_date)}</td>
                    <td className="px-2 py-2 text-ink-600">{shortDate(t.posted_date)}</td>
                    <td className="px-3 py-2 text-right">
                      {t.xero_url && (
                        <a
                          href={t.xero_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-ink-200 px-2 py-0.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                        >
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex items-center justify-between border-t border-ink-100 px-5 py-2.5 text-[11px] text-ink-500">
          <span>
            Showing {items.length} of {total}
          </span>
          {items.length < total && (
            <button
              type="button"
              onClick={showMore}
              disabled={loadingMore}
              className="rounded-md border border-ink-200 px-2.5 py-1 font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
