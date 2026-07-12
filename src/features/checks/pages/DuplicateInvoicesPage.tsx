import { useEffect, useMemo, useState } from "react";

import {
  bulkTrappedAction,
  BulkTrappedAction,
  fetchSuggestFix,
  fetchTrappedInvoices,
  voidTrapped,
} from "@/services/audit.service";
import {
  FlaggedIssue,
  HealthCheckResult,
  MatchReasons,
  SuggestFixResponse,
} from "@/types/audit.types";

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

const isPaid = (r: HealthCheckResult): boolean => {
  const s = (r.result?.invoice_status || "").toUpperCase();
  if (s === "PAID") return true;
  const due = r.result?.amount_due;
  return due != null && Number(due) === 0;
};

const dupFlag = (r: HealthCheckResult, ruleId: string): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === ruleId) ??
  r.result?.flagged?.[0];

interface MatchGroup {
  key: string;
  keep: HealthCheckResult;
  dup: HealthCheckResult | null;
  dupFromFlag?: { invoice_number?: string | null; date?: string | null };
  flag: FlaggedIssue;
  undecided: boolean;
}

export type DuplicateRuleId =
  | "duplicate_invoice"
  | "duplicate_bill"
  | "duplicate_credit_note";

export const DuplicateInvoicesPage = ({
  companyId,
  ruleId,
  refreshKey = 0,
}: {
  companyId: string;
  ruleId: DuplicateRuleId;
  refreshKey?: number;
}) => {
  const [rows, setRows] = useState<HealthCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setRemoved(new Set());

    const byRule = (list: HealthCheckResult[]) =>
      list.filter((r) => (r.result?.rule_ids ?? []).includes(ruleId));

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
        const d = await fetchTrappedInvoices({
          company_id: companyId,
          limit: 200,
        });
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

  const groups = useMemo<MatchGroup[]>(() => {
    const byTxn = new Map<string, HealthCheckResult>();
    for (const r of rows) {
      const f = dupFlag(r, ruleId);
      if (f?.transaction_id) byTxn.set(f.transaction_id, r);
    }
    const seen = new Set<string>();
    const out: MatchGroup[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      const f = dupFlag(r, ruleId);
      if (!f) continue;
      const partner = f.duplicate_of_transaction_id
        ? byTxn.get(f.duplicate_of_transaction_id)
        : undefined;
      seen.add(r.id);
      if (partner) seen.add(partner.id);
      const undecided = f.this_is_likely_original == null;
      const keepIsR = f.this_is_likely_original !== false;
      const keep = keepIsR ? r : (partner ?? r);
      const dup = keepIsR ? (partner ?? null) : r;
      out.push({
        key: r.id,
        keep,
        dup,
        dupFromFlag: partner
          ? undefined
          : {
              invoice_number: f.duplicate_of_invoice_number,
              date: f.duplicate_of_date,
            },
        flag: f,
        undecided,
      });
    }
    const rank = (g: MatchGroup) => {
      const m = g.flag.match_reasons;
      if (m?.risk === "high") return -1;
      if (m?.recurring) return 1;
      return 0;
    };
    return out
      .filter((g) => !removed.has(g.key))
      .sort((a, b) => rank(a) - rank(b));
  }, [rows, ruleId, removed]);

  const noun =
    ruleId === "duplicate_bill"
      ? "bill"
      : ruleId === "duplicate_credit_note"
        ? "credit note"
        : "invoice";

  const top = groups[0];
  const topAiText = top
    ? top.keep.ai?.explanation ||
      top.dup?.ai?.explanation ||
      top.flag.message ||
      ""
    : "";
  const topCross = !!top?.flag?.match_reasons?.cross_contact;

  const onVoid = async (g: MatchGroup) => {
    if (!g.dup) return;
    setBusyKey(g.key);
    const r = await voidTrapped(companyId, g.dup.id);
    setBusyKey(null);
    if (r.ok) setRemoved((p) => new Set(p).add(g.key));
    else setError(r.error ?? "Void failed");
  };

  const runPair = async (
    g: MatchGroup,
    action: BulkTrappedAction,
    opts?: { days?: number; reason?: string },
  ) => {
    setBusyKey(g.key);
    const ids = [g.keep.id, ...(g.dup ? [g.dup.id] : [])];
    const r = await bulkTrappedAction(companyId, ids, action, opts);
    setBusyKey(null);
    if (r.ok) setRemoved((p) => new Set(p).add(g.key));
    else setError(r.error ?? `${action} failed`);
  };

  return (
    <div className="space-y-4">
      {!loading && topAiText && (
        <div
          className={[
            "rounded-2xl border p-4 shadow-card",
            topCross
              ? "border-amber-200 animate-blink-amber"
              : "border-rose-200 animate-blink-red",
          ].join(" ")}
        >
          <p className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-brand">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
                <path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.8L12 15.6 6.4 19.6l2.1-6.8L3 8.8h6.8L12 2Z" />
              </svg>
              AI
            </span>
            {groups.length > 1 && (
              <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                +{groups.length - 1} more match
                {groups.length - 1 === 1 ? "" : "es"}
              </span>
            )}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-700">
            {topAiText}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
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
                "absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow transition",
                showDismissed ? "left-[18px]" : "left-0.5",
              ].join(" ")}
            />
          </button>
          Show dismissed matches
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-surface px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading matches…
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-surface px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showDismissed ? "No dismissed matches." : `No duplicate ${noun}s`}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <MatchCard
              key={g.key}
              g={g}
              busy={busyKey === g.key}
              companyId={companyId}
              onVoid={() => onVoid(g)}
              onDismiss={(reason) =>
                runPair(g, "dismiss", reason ? { reason } : undefined)
              }
              onSnooze={(days, reason) =>
                runPair(g, "snooze", { days, ...(reason ? { reason } : {}) })
              }
              onMarkOk={(reason) =>
                runPair(g, "mark_ok", reason ? { reason } : undefined)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

const MatchCard = ({
  g,
  busy,
  companyId,
  onVoid,
  onDismiss,
  onSnooze,
  onMarkOk,
}: {
  g: MatchGroup;
  busy: boolean;
  companyId: string;
  onVoid: () => void;
  onDismiss: (reason: string) => void;
  onSnooze: (days: number, reason?: string) => void;
  onMarkOk: (reason?: string) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [fixOpen, setFixOpen] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [fix, setFix] = useState<SuggestFixResponse | null>(null);
  const [fixErr, setFixErr] = useState<string | null>(null);

  const openSuggestFix = async () => {
    setMenuOpen(false);
    setFixOpen(true);
    setFix(null);
    setFixErr(null);
    setFixLoading(true);
    const r = await fetchSuggestFix(companyId, g.dup?.id ?? g.keep.id);
    setFixLoading(false);
    if ("error" in r) setFixErr(r.error);
    else setFix(r);
  };

  const mr = g.flag.match_reasons;
  const tl = (mr?.tier ?? g.flag.severity ?? "").toString().toLowerCase();
  const badge =
    tl === "high" || tl === "critical"
      ? {
          label: "Likely duplicate",
          cls: "bg-rose-50 text-rose-700 ring-rose-200",
        }
      : tl === "medium" || tl === "review"
        ? {
            label: "Possible — review",
            cls: "bg-amber-50 text-amber-700 ring-amber-200",
          }
        : {
            label: mr?.recurring ? "Review (recurring)" : "Review",
            cls: "bg-ink-100 text-ink-600 ring-ink-200",
          };
  const conf = g.flag.confidence ?? mr?.confidence;
  const confPct = typeof conf === "number" ? Math.round(conf * 100) : null;
  const highRisk = mr?.risk === "high";
  const isBill = g.flag.issue_type === "duplicate_bill";
  const contact = g.keep.result?.vendor_name || "Contact";

  return (
    <section
      className={[
        "overflow-hidden rounded-2xl border bg-surface shadow-card",
        highRisk ? "border-rose-300 ring-1 ring-rose-200" : "border-ink-100",
      ].join(" ")}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
        <span className="text-sm font-semibold text-ink-900">{contact}</span>
        {highRisk && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            One already paid — high risk
          </span>
        )}
        {badge && (
          <span
            className={[
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
              badge.cls,
            ].join(" ")}
          >
            {badge.label}
            {confPct != null && (
              <span className="font-semibold opacity-70">· {confPct}%</span>
            )}
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {!mr?.cross_contact && <Chip ok>Same contact</Chip>}
          {mr?.cross_contact && <PartyChip mr={mr} />}
          {isBill && mr && <RefChip mr={mr} bill />}
          <AmountChip g={g} mr={mr} />
          <DateChip g={g} mr={mr} />
          {!isBill && mr && <RefChip mr={mr} />}
          {mr?.cross_contact && mr.same_description && (
            <Chip ok>Same description</Chip>
          )}
          {mr?.recurring && <Chip warn>Could be recurring</Chip>}
        </div>
        <div className="relative ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDismissOpen((v) => !v)}
            disabled={busy}
            className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
          >
            Dismiss match
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy}
            aria-label="More actions"
            className="rounded-md border border-ink-200 px-2 py-1 text-xs font-bold leading-none text-ink-500 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-ink-100 bg-surface py-1 shadow-lg">
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    onSnooze(30);
                  }}
                >
                  Snooze 30 days
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkOk();
                  }}
                >
                  Mark OK (not a duplicate)
                </MenuItem>
                <MenuItem onClick={openSuggestFix}>Suggest fix</MenuItem>
              </div>
            </>
          )}
        </div>
      </header>

      {mr?.cross_contact && (mr.advisory || g.flag.message) && (
        <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-2 text-[11px] leading-relaxed text-amber-800">
          {mr.advisory || g.flag.message}
        </div>
      )}

      {dismissOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 bg-ink-50/40 px-4 py-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="min-w-0 flex-1 rounded-md border border-ink-200 px-2.5 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            type="button"
            onClick={() => onDismiss(reason)}
            disabled={busy}
            className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
          >
            {busy ? "…" : "Dismiss"}
          </button>
          <button
            type="button"
            onClick={() => setDismissOpen(false)}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:text-ink-800"
          >
            Cancel
          </button>
        </div>
      )}

      {mr?.distinct_documents_possible && (
        <div className="flex items-start gap-1.5 border-b border-amber-100 bg-amber-50/60 px-4 py-2 text-[11px] text-amber-800">
          <span>
            Different invoice numbers — could be 2 distinct documents. Please check.
          </span>
        </div>
      )}

      <div className="grid gap-px bg-ink-100 sm:grid-cols-2">
        <InvoiceCell
          r={g.keep}
          role={g.undecided ? "review" : "keep"}
          busy={busy}
        />
        {g.dup ? (
          <InvoiceCell
            r={g.dup}
            role={g.undecided ? "review" : "void"}
            busy={busy}
            onVoid={g.undecided ? undefined : onVoid}
          />
        ) : (
          <div className="bg-surface p-4">
            {!g.undecided && <RoleTag role="void" />}
            <p className="mt-1 text-sm font-medium text-ink-900">
              {g.dupFromFlag?.invoice_number ||
                (g.undecided ? "Possible match" : "Duplicate")}
            </p>
            <p className="text-[11px] text-ink-400">
              {shortDate(g.dupFromFlag?.date)} · not in current list
            </p>
          </div>
        )}
      </div>

      {fixOpen && (
        <SuggestFixModal
          loading={fixLoading}
          error={fixErr}
          fix={fix}
          target={{
            number:
              (g.dup ?? g.keep).result?.invoice_number ??
              g.dupFromFlag?.invoice_number ??
              null,
            id: (g.dup ?? g.keep).document_id ?? fix?.document_id ?? null,
            type: (g.dup ?? g.keep).document_type ?? fix?.document_type ?? null,
            amount: (g.dup ?? g.keep).result?.amount,
            currency: (g.dup ?? g.keep).result?.currency_code,
          }}
          keepNumber={
            g.undecided
              ? null
              : g.dup
                ? (g.keep.result?.invoice_number ?? null)
                : (g.flag.duplicate_of_invoice_number ?? null)
          }
          undecided={g.undecided}
          canVoid={!g.undecided && !!g.dup && !isPaid(g.dup)}
          busy={busy}
          onVoid={() => {
            setFixOpen(false);
            onVoid();
          }}
          onClose={() => setFixOpen(false)}
        />
      )}
    </section>
  );
};

const MenuItem = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="block w-full px-3 py-1.5 text-left text-xs font-medium text-ink-700 transition hover:bg-brand-50 hover:text-brand-700"
  >
    {children}
  </button>
);

const DOC_TYPE_LABEL: Record<string, string> = {
  ACCREC: "Sales invoice",
  ACCPAY: "Bill",
  ACCRECCREDIT: "Sales credit note",
  ACCPAYCREDIT: "Bill credit note",
};

interface FixTarget {
  number: string | null;
  id: string | null;
  type: string | null;
  amount?: number | string | null;
  currency?: string | null;
}

const SuggestFixModal = ({
  loading,
  error,
  fix,
  target,
  keepNumber,
  undecided,
  canVoid,
  busy,
  onVoid,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  fix: SuggestFixResponse | null;
  target: FixTarget;
  keepNumber: string | null;
  undecided: boolean;
  canVoid: boolean;
  busy: boolean;
  onVoid: () => void;
  onClose: () => void;
}) => {
  const s = fix?.suggestion;
  const typeLabel = target.type
    ? (DOC_TYPE_LABEL[target.type] ?? target.type)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-scrim/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-ink-100">
        <div className="relative bg-brand-gradient px-5 py-4 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-md p-1 text-white/80 transition hover:bg-surface/20 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            {undecided ? "AI review" : "Suggested fix"}
          </p>
          <h3 className="mt-1 text-lg font-semibold leading-tight">
            {undecided ? "Review this match" : "Void this duplicate"}
          </h3>
        </div>

        <div className="space-y-4 p-5">
          <div
            className={[
              "rounded-xl border p-3.5",
              undecided
                ? "border-ink-100 bg-ink-50/60"
                : "border-rose-100 bg-rose-50/60",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  undecided
                    ? "bg-ink-100 text-ink-600"
                    : "bg-rose-100 text-rose-700",
                ].join(" ")}
              >
                {typeLabel ?? (undecided ? "Invoice" : "Duplicate")}
              </span>
              {target.amount != null && (
                <span className="text-xs font-semibold text-ink-700">
                  {money(target.amount, target.currency)}
                </span>
              )}
            </div>
            <p className="mt-2 font-display text-xl font-semibold leading-none text-ink-900">
              {target.number ?? "—"}
            </p>
            {target.id && (
              <p className="mt-1.5 break-all font-mono text-[10px] leading-relaxed text-ink-400">
                <span className="font-sans font-semibold uppercase tracking-wider text-ink-400">
                  Invoice ID
                </span>{" "}
                {target.id}
              </p>
            )}
            {keepNumber && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Keep <span className="font-semibold">{keepNumber}</span>
              </p>
            )}
          </div>

          {loading ? (
            <p className="py-2 text-center text-sm text-ink-500">Thinking…</p>
          ) : error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
          ) : !fix?.available || !s ? (
            <p className="text-[13px] text-ink-500">
              No AI suggestion for this one — review the two documents and void the
              duplicate manually.
            </p>
          ) : (
            <div className="space-y-3 text-[13px] text-ink-700">
              {s.rationale && <p className="text-ink-800">{s.rationale}</p>}
              {s.human_steps?.length > 0 && (
                <ol className="list-decimal space-y-1 pl-5 text-ink-600">
                  {s.human_steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              )}
              {s.estimated_minutes != null && (
                <p className="inline-flex items-center gap-1 rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                  ~{s.estimated_minutes} min
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-3">
            {fix?.xero_url && (
              <a
                href={fix.xero_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
              >
                Open in Xero
              </a>
            )}
            {canVoid && (
              <button
                type="button"
                onClick={onVoid}
                disabled={busy}
                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
              >
                Void this one
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const InvoiceCell = ({
  r,
  role,
  busy,
  onVoid,
}: {
  r: HealthCheckResult;
  role: "keep" | "void" | "review";
  busy: boolean;
  onVoid?: () => void;
}) => {
  const res = r.result;
  const paid = isPaid(r);
  const ref = res?.xero_reference || res?.reference;
  return (
    <div className="bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <RoleTag role={role} />
          <dl className="mt-2 space-y-1 text-[11px]">
            <Field label="Contact" value={res?.vendor_name || "—"} strong />
            <Field label="Invoice no." value={res?.invoice_number || r.document_id || "—"} strong />
            <Field label="Issue date" value={shortDate(res?.invoice_date)} />
            <Field label="Amount" value={money(res?.amount, res?.currency_code)} />
            <Field
              label="Status"
              value={paid ? "Paid" : "Unpaid"}
              valueClass={
                paid
                  ? "font-semibold text-emerald-600"
                  : "font-semibold text-rose-600"
              }
            />
            {ref && <Field label="Reference" value={ref} />}
            {res?.details && <Field label="Description" value={res.details} />}
          </dl>
          {res?.reconciled === true && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Bank reconciled
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {r.xero_url && (
            <a
              href={r.xero_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              View
            </a>
          )}
          {role === "void" &&
            (paid ? (
              <span className="text-[10px] text-ink-400">Paid — unallocate to void</span>
            ) : (
              <button
                type="button"
                onClick={onVoid}
                disabled={busy}
                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
              >
                {busy ? "…" : "Void"}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  value,
  strong,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  valueClass?: string;
}) => (
  <div className="flex gap-2">
    <dt className="w-20 shrink-0 text-ink-400">{label}</dt>
    <dd
      className={[
        "min-w-0 break-words",
        strong ? "font-semibold text-ink-900" : "text-ink-700",
        valueClass ?? "",
      ].join(" ")}
    >
      {value}
    </dd>
  </div>
);

const RoleTag = ({ role }: { role: "keep" | "void" | "review" }) => {
  if (role === "review") return null;
  return roleTagInner(role);
};

const roleTagInner = (role: "keep" | "void") => (
  <span
    className={[
      "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
      role === "keep"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-rose-50 text-rose-700",
    ].join(" ")}
  >
    {role === "keep" ? "Keep · original" : "Duplicate"}
  </span>
);

const Chip = ({
  children,
  ok,
  bad,
  warn,
}: {
  children: React.ReactNode;
  ok?: boolean;
  bad?: boolean;
  warn?: boolean;
}) => (
  <span
    className={[
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
      warn
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : bad
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : ok
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : "bg-ink-50 text-ink-600 ring-ink-200",
    ].join(" ")}
  >
    {children}
  </span>
);

const AmountChip = ({
  g,
  mr,
}: {
  g: MatchGroup;
  mr?: MatchReasons | null;
}) => {
  if (mr) {
    return mr.same_amount ? (
      <Chip ok>Same {money(mr.amount, mr.currency)}</Chip>
    ) : (
      <Chip bad>
        {money(mr.amount, mr.currency)} vs {money(mr.other_amount, mr.currency)}
      </Chip>
    );
  }
  const a = g.keep.result?.amount;
  const b = g.dup?.result?.amount;
  if (a != null && b != null && Number(a) === Number(b))
    return <Chip ok>Same {money(a, g.keep.result?.currency_code)}</Chip>;
  return null;
};

const DateChip = ({ g, mr }: { g: MatchGroup; mr?: MatchReasons | null }) => {
  if (mr) {
    return mr.days_apart === 0 ? (
      <Chip ok>Same date</Chip>
    ) : (
      <Chip>
        {mr.days_apart} day{mr.days_apart === 1 ? "" : "s"} apart
      </Chip>
    );
  }
  return null;
};

const RefChip = ({ mr, bill = false }: { mr: MatchReasons; bill?: boolean }) => {
  const ref = bill ? "reference (bill no.)" : "reference";
  const same = mr.same_reference === true || mr.reference_match === "exact";
  const different =
    !same && (mr.reference_match === "different" || mr.same_reference === false);
  if (same) return <Chip ok>Same {ref}</Chip>;
  if (different) return <Chip bad>Different {ref}</Chip>;
  return <Chip>No {ref}</Chip>;
};

const PartyChip = ({ mr }: { mr: MatchReasons }) => {
  if (mr.party_by === "vat") return <Chip ok>Matched by VAT</Chip>;
  if (mr.party_by === "name") {
    const pct =
      mr.name_similarity != null ? Math.round(mr.name_similarity * 100) : null;
    return <Chip>Names {pct != null ? `${pct}% similar` : "compared"}</Chip>;
  }
  return null;
};
