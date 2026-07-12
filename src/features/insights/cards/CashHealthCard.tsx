import { useEffect, useState } from "react";

import {
  fetchCashHealthSettings,
  updateCashHealthSettings,
} from "../../../services/insights.service";
import {
  CashBankAccount,
  CashHealthCheckResponse,
  CashOutgoingCategory,
  FinancialPositionResponse,
} from "../../../types/insights.types";
import { ArcGauge } from "../components/ArcGauge";
import { Card } from "../components/Card";
import { gbp, Tone } from "../lib/format";

const ratingTone = (r: string): Tone =>
  r === "strong" ? "green" : r === "critical" ? "red" : "amber";

const monthOf = (p: string) =>
  p.split(" ").find((t) => /^[A-Za-z]/.test(t)) ?? p;

const PayMark = ({ v }: { v: boolean | null }) => {
  if (v === null) return <span className="text-ink-300">—</span>;
  return v ? (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-500 text-white">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ) : (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-rose-500 text-white">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </span>
  );
};

const Gear = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    title="Cash Health settings"
    className="flex h-6 w-6 items-center justify-center rounded-md text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
  >
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  </button>
);

export const CashHealthCard = ({
  data,
  fallback,
  companyId,
  onRefresh,
}: {
  data?: CashHealthCheckResponse | null;
  fallback?: FinancialPositionResponse;
  companyId: string;
  onRefresh: () => void;
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!data) {
    if (!fallback) {
      return (
        <Card title="Cash Health Check">
          <p className="py-6 text-center text-xs text-ink-400">
            Not available yet.
          </p>
        </Card>
      );
    }
    const ch = fallback.cash_health;
    const covPct = Math.round((ch.coverage_ratio ?? 0) * 100);
    const covered = ch.shortfall <= 0;
    const tone: Tone = covPct >= 70 ? "green" : covPct >= 40 ? "amber" : "red";
    return (
      <Card title="Cash Health" help="Cash on hand vs short-term liabilities.">
        <div className="flex items-center gap-4">
          <ArcGauge value={Math.min(covPct, 100)} tone={tone} center={`${covPct}%`} label="coverage" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              Current cash
            </p>
            <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
              {gbp(ch.cash)}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-500">
              vs {gbp(ch.current_liabilities)} due
            </p>
            <p className={["mt-1.5 text-[11px] font-medium", covered ? "text-emerald-600" : "text-rose-600"].join(" ")}>
              {covered ? "Liabilities covered" : `${gbp(ch.shortfall)} shortfall`}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const score = Math.round(data.health_score ?? 0);
  const tone = ratingTone(data.rating);
  const cats = data.outgoings?.categories ?? [];
  const movements = data.recent_movements ?? [];

  return (
    <Card
      title="Cash Health Check"
      help={
        data.indicator?.note ??
        "Whether cash on hand covers upcoming outgoings (short-term weighted heaviest)."
      }
      right={<Gear onClick={() => setSettingsOpen(true)} />}
    >
      <div className="flex items-center gap-4">
        <ArcGauge value={score} tone={tone} center={`${score}%`} label="health" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Current cash balance
          </p>
          <p className="font-display text-2xl font-semibold tabular-nums text-ink-900">
            {gbp(data.current_cash)}
          </p>
          <p className="mt-0.5 text-[11px] font-medium capitalize text-ink-500">
            {data.rating} cash health
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Enough cash to pay?
        </p>
        <ul className="space-y-1 text-xs">
          {cats.map((c) => (
            <li key={c.category} className="flex items-center gap-2">
              <span className={c.included ? "text-ink-700" : "text-ink-300"}>
                {c.label}
              </span>
              <span
                className={[
                  "ml-auto tabular-nums",
                  c.included ? "text-ink-500" : "text-ink-300",
                ].join(" ")}
                title={
                  c.overridden ? `auto: ${gbp(c.auto_amount)}` : undefined
                }
              >
                ({gbp(c.amount)}){c.overridden ? " ·m" : ""}
              </span>
              <PayMark v={c.can_pay} />
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 text-xs font-semibold text-ink-800">
          <span>Total expected outgoings</span>
          <span className="tabular-nums">
            {gbp(data.outgoings?.total_expected_outgoings)}
          </span>
        </div>
      </div>

      {movements.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Recent cash movements
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {movements.map((m) => (
              <span key={m.period} className="inline-flex items-center gap-1">
                <span className="text-ink-500">{monthOf(m.period)}</span>
                <span
                  className={
                    m.direction === "up"
                      ? "font-medium text-emerald-600"
                      : m.direction === "down"
                        ? "font-medium text-rose-600"
                        : "text-ink-400"
                  }
                >
                  {m.direction === "up" ? "▲" : m.direction === "down" ? "▼" : "—"}{" "}
                  {gbp(Math.abs(m.change))}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {settingsOpen && (
        <CashHealthSettings
          companyId={companyId}
          categories={cats}
          banks={data.bank_accounts ?? []}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            onRefresh();
          }}
        />
      )}
    </Card>
  );
};

const CashHealthSettings = ({
  companyId,
  categories,
  banks,
  onClose,
  onSaved,
}: {
  companyId: string;
  categories: CashOutgoingCategory[];
  banks: CashBankAccount[];
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [included, setIncluded] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [disregarded, setDisregarded] = useState<Set<string>>(new Set());
  const [accountOverrides, setAccountOverrides] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCashHealthSettings(companyId).then((r) => {
      if (!active) return;
      if (r.ok) {
        setIncluded(r.data.included ?? {});
        setOverrides(
          Object.fromEntries(
            Object.entries(r.data.overrides ?? {}).map(([k, v]) => [
              k,
              String(v),
            ]),
          ),
        );
        setDisregarded(new Set(r.data.disregarded_banks ?? []));
        setAccountOverrides(r.data.account_overrides ?? {});
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId]);

  const isIncluded = (cat: string) => included[cat] !== false;
  const toggleInclude = (cat: string) =>
    setIncluded((p) => ({ ...p, [cat]: !isIncluded(cat) }));
  const setOverride = (cat: string, v: string) =>
    setOverrides((p) => ({ ...p, [cat]: v }));
  const toggleBank = (code: string) =>
    setDisregarded((p) => {
      const n = new Set(p);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    const inc: Record<string, boolean> = {};
    for (const c of categories) if (!isIncluded(c.category)) inc[c.category] = false;
    const ovr: Record<string, number> = {};
    for (const [k, v] of Object.entries(overrides)) {
      if (v.trim() !== "" && !Number.isNaN(Number(v))) ovr[k] = Number(v);
    }
    const res = await updateCashHealthSettings(companyId, {
      included: inc,
      overrides: ovr,
      account_overrides: accountOverrides,
      disregarded_banks: Array.from(disregarded),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn’t save settings.");
      return;
    }
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40 p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-900">
            Cash Health settings
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Outgoings
        </p>
        <p className="mb-2 text-[11px] text-ink-400">
          Toggle a category off to ignore it, or override its value (blank =
          auto from Xero).
        </p>
        <div className="space-y-1.5">
          {categories.map((c) => {
            const inc = isIncluded(c.category);
            return (
              <div
                key={c.category}
                className="flex items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-1.5"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={inc}
                    disabled={saving}
                    onChange={() => toggleInclude(c.category)}
                    className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
                  />
                  <span className={inc ? "text-ink-800" : "text-ink-300"}>
                    {c.label}
                  </span>
                </label>
                <input
                  type="number"
                  value={overrides[c.category] ?? ""}
                  disabled={saving || !inc}
                  onChange={(e) => setOverride(c.category, e.target.value)}
                  placeholder={`auto ${gbp(c.auto_amount)}`}
                  className="w-28 rounded-md border border-ink-200 px-2 py-1 text-right text-xs tabular-nums text-ink-800 focus:border-brand-400 focus:outline-none disabled:bg-ink-50 disabled:opacity-60"
                />
              </div>
            );
          })}
        </div>

        {banks.length > 0 && (
          <>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Bank accounts
            </p>
            <p className="mb-2 text-[11px] text-ink-400">
              Tick to leave an account OUT of the current cash balance (e.g. a
              personal account).
            </p>
            <div className="space-y-1.5">
              {banks.map((b) => (
                <label
                  key={b.code}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={disregarded.has(b.code)}
                    disabled={saving}
                    onChange={() => toggleBank(b.code)}
                    className="h-3.5 w-3.5 rounded border-ink-300 text-rose-500 focus:ring-rose-200"
                  />
                  <span className="text-ink-700">{b.name}</span>
                  <span className="ml-auto text-xs tabular-nums text-ink-400">
                    {gbp(b.balance)}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
            {error}
          </p>
        )}

        <p className="mt-3 text-[10px] text-ink-400">
          Saving recomputes the snapshot (~5s) — the card updates automatically.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition hover:text-ink-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gradient px-4 py-1.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save & apply"}
          </button>
        </div>
      </div>
    </div>
  );
};
