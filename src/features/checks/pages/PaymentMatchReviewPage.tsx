import { useEffect, useMemo, useState } from "react";

import {
  bulkTrappedAction,
  fetchTrappedInvoices,
} from "@/services/audit.service";
import {
  FlaggedIssue,
  HealthCheckResult,
  MatchReasons,
} from "@/types/audit.types";

export type PaymentMatchRuleId = "bill_direct_payment" | "invoice_direct_deposit";

// Each check is a 2-row match: an unpaid document + a matching bank movement.
// The only differences between bill→payment and invoice→deposit are the field
// prefixes + the badge labels, so one config drives both.
interface Side {
  date?: string | null;
  desc?: string | null;
  amount?: string | null;
  txnId?: string;
}
interface RuleConfig {
  leftBadge: string;
  rightBadge: string;
  empty: string;
  left: (mr: MatchReasons) => Side; // the unpaid doc (View → row.xero_url)
  right: (mr: MatchReasons) => Side; // the bank movement (View → deep link)
}

const CONFIG: Record<PaymentMatchRuleId, RuleConfig> = {
  bill_direct_payment: {
    leftBadge: "Unpaid Bill",
    rightBadge: "Direct Payment",
    empty: "No bill / direct-payment matches 🎉",
    left: (mr) => ({
      date: mr.bill_date,
      desc: mr.bill_description,
      amount: mr.bill_amount ?? mr.amount_due,
      txnId: mr.bill_transaction_id,
    }),
    right: (mr) => ({
      date: mr.payment_date,
      desc: mr.payment_description,
      amount: mr.payment_amount,
      txnId: mr.payment_transaction_id,
    }),
  },
  invoice_direct_deposit: {
    leftBadge: "Unpaid Invoice",
    rightBadge: "Direct Deposit",
    empty: "No invoice / direct-deposit matches 🎉",
    left: (mr) => ({
      date: mr.invoice_date,
      desc: mr.invoice_description,
      amount: mr.invoice_amount ?? mr.amount_due,
      txnId: mr.invoice_transaction_id,
    }),
    right: (mr) => ({
      date: mr.deposit_date,
      desc: mr.deposit_description,
      amount: mr.deposit_amount,
      txnId: mr.deposit_transaction_id,
    }),
  },
};

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
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
};

// Bank-transaction deep link for the movement side (§5). Org shortcode is
// embedded in the document's xero_url.
const shortcodeOf = (url?: string | null): string | null => {
  const m = (url || "").match(/[?&]shortcode=([^&]+)/i);
  return m ? m[1] : null;
};
const bankTxnUrl = (
  docUrl: string | null | undefined,
  txnId?: string,
): string | null => {
  if (!txnId) return null;
  const sc = shortcodeOf(docUrl);
  if (!sc) return null;
  return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${sc}&redirecturl=/Bank/ViewTransaction.aspx?bankTransactionID=${txnId}`;
};

const flagFor = (r: HealthCheckResult, ruleId: string): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === ruleId) ??
  r.result?.flagged?.[0];

const matchesRule = (r: HealthCheckResult, ruleId: string): boolean =>
  (r.result?.rule_ids ?? []).includes(ruleId) ||
  (r.result?.flagged ?? []).some((f) => f.issue_type === ruleId);

// Bill or Direct Payment / Invoice or Direct Deposit — read-only review. Each
// flag is a 2-row match block (unpaid doc + bank movement): View + Dismiss.
export const PaymentMatchReviewPage = ({
  companyId,
  ruleId,
  refreshKey = 0,
}: {
  companyId: string;
  ruleId: PaymentMatchRuleId;
  refreshKey?: number;
}) => {
  const cfg = CONFIG[ruleId];
  const [rows, setRows] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRemoved(new Set());
    setSelected(new Set());

    const byRule = (list: HealthCheckResult[]) =>
      list.filter((r) => matchesRule(r, ruleId));

    const load = async () => {
      if (showDismissed) {
        const [all, act] = await Promise.all([
          fetchTrappedInvoices({
            company_id: companyId,
            limit: 200,
            include_dismissed: true,
          }),
          fetchTrappedInvoices({ company_id: companyId, limit: 200 }),
        ]);
        if (!active) return;
        if ("error" in all) {
          setError(all.error);
          setRows([]);
        } else {
          const activeIds = new Set(
            "error" in act ? [] : (act.results ?? []).map((r) => r.id),
          );
          setRows(byRule((all.results ?? []).filter((r) => !activeIds.has(r.id))));
        }
      } else {
        const d = await fetchTrappedInvoices({ company_id: companyId, limit: 200 });
        if (!active) return;
        if ("error" in d) {
          setError(d.error);
          setRows([]);
        } else {
          setRows(byRule(d.results ?? []));
        }
      }
      if (active) setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [companyId, ruleId, showDismissed, refreshKey]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !removed.has(r.id))
      .filter((r) => {
        if (!q) return true;
        const mr = flagFor(r, ruleId)?.match_reasons;
        return [
          r.result?.vendor_name,
          mr && cfg.left(mr).desc,
          mr && cfg.right(mr).desc,
        ].some((v) => (v || "").toString().toLowerCase().includes(q));
      });
  }, [rows, removed, search, ruleId, cfg]);

  const drop = (ids: string[]) =>
    setRemoved((p) => {
      const n = new Set(p);
      ids.forEach((id) => n.add(id));
      return n;
    });

  const onDismiss = async (r: HealthCheckResult) => {
    setBusyKey(r.id);
    const res = await bulkTrappedAction(companyId, [r.id], "dismiss");
    setBusyKey(null);
    if (res.ok) drop([r.id]);
    else setError(res.error ?? "Dismiss failed");
  };

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)));

  const bulkDismiss = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    const res = await bulkTrappedAction(companyId, ids, "dismiss");
    setBulkBusy(false);
    if (res.ok) {
      drop(ids);
      setSelected(new Set());
    } else setError(res.error ?? "Bulk dismiss failed");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
          <button
            type="button"
            role="switch"
            aria-checked={showDismissed}
            onClick={() => setShowDismissed((v) => !v)}
            className={[
              "relative h-5 w-9 rounded-full transition",
              showDismissed ? "bg-brand-600" : "bg-ink-200",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                showDismissed ? "left-[18px]" : "left-0.5",
              ].join(" ")}
            />
          </button>
          Show dismissed items
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-56 rounded-lg border border-ink-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs">
          <span className="font-semibold text-brand-700">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={bulkDismiss}
            className="rounded-md border border-ink-200 bg-white px-2.5 py-1 font-semibold text-ink-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto rounded-md px-2 py-1 font-medium text-ink-500 hover:text-ink-800"
          >
            Clear
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading matches…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showDismissed
            ? "No dismissed matches."
            : search
              ? "No matches for your search."
              : cfg.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => {
            const f = flagFor(r, ruleId);
            const mr = f?.match_reasons;
            if (!mr) return null;
            const cur = mr.currency;
            const left = cfg.left(mr);
            const right = cfg.right(mr);
            const busy = busyKey === r.id;
            return (
              <section
                key={r.id}
                className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card"
              >
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-3.5 w-3.5 accent-brand-600"
                    aria-label="Select match"
                  />
                  <span className="text-sm font-semibold text-ink-900">
                    {r.result?.vendor_name || "Contact"}
                  </span>
                  {mr.days_apart != null && (
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                      {mr.days_apart} day{mr.days_apart === 1 ? "" : "s"} apart
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onDismiss(r)}
                    disabled={busy}
                    className="ml-auto rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                  >
                    {busy ? "…" : "Dismiss match"}
                  </button>
                </header>

                <div className="divide-y divide-ink-50">
                  <MatchRow
                    badge={cfg.leftBadge}
                    badgeCls="bg-sky-600 text-white"
                    side={left}
                    currency={cur}
                    url={r.xero_url}
                  />
                  <MatchRow
                    badge={cfg.rightBadge}
                    badgeCls="bg-ink-500 text-white"
                    side={right}
                    currency={cur}
                    url={bankTxnUrl(r.xero_url, right.txnId)}
                  />
                </div>

                {f?.message && (
                  <p className="border-t border-ink-50 bg-ink-50/30 px-4 py-2 text-[11px] text-ink-500">
                    {f.message}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

const MatchRow = ({
  badge,
  badgeCls,
  side,
  currency,
  url,
}: {
  badge: string;
  badgeCls: string;
  side: Side;
  currency?: string | null;
  url: string | null | undefined;
}) => (
  <div className="grid grid-cols-[8rem_5.5rem_1fr_auto_auto] items-center gap-3 px-4 py-3">
    <span
      className={[
        "inline-flex w-fit items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        badgeCls,
      ].join(" ")}
    >
      {badge}
    </span>
    <span className="text-[11px] text-ink-500">{shortDate(side.date)}</span>
    <span className="min-w-0 truncate text-sm text-ink-700">{side.desc || "—"}</span>
    <span className="text-right text-sm font-semibold tabular-nums text-ink-900">
      {money(side.amount, currency)}
    </span>
    {url ? (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
      >
        View
      </a>
    ) : (
      <span className="w-12" />
    )}
  </div>
);
