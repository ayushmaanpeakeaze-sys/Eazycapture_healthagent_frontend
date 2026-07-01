import { useEffect, useMemo, useState } from "react";

import {
  bulkTrappedAction,
  fetchTrappedInvoices,
} from "@/services/audit.service";
import {
  ContactHelper,
  FlaggedIssue,
  HealthCheckResult,
} from "@/types/audit.types";

const RULE = "duplicate_contact";

const contactFlag = (r: HealthCheckResult): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === RULE) ??
  r.result?.flagged?.[0];

const isContactRow = (r: HealthCheckResult): boolean =>
  (r.result?.rule_ids ?? []).includes(RULE) ||
  (r.result?.flagged ?? []).some((f) => f.issue_type === RULE);

interface ContactLine {
  id: string | null; // row id (for dismiss); null if partner not in the feed
  name: string;
  helper: ContactHelper | null;
  xeroUrl: string | null;
}

interface ContactMatch {
  key: string;
  sim: number; // 0..1
  vat: string; // vat_status
  isSplit: boolean;
  a: ContactLine;
  b: ContactLine;
}

// Two-line match blocks per duplicate pair. Fed by a full audit, not the
// duplicates-only run.
export const DuplicateContactsPage = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
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

    const byContact = (list: HealthCheckResult[]) => list.filter(isContactRow);

    const load = async () => {
      if (showDismissed) {
        // Dismissed-only = (everything incl. dismissed) − (currently active).
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
          setRows(
            byContact((all.results ?? []).filter((r) => !activeIds.has(r.id))),
          );
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
          setRows(byContact(d.results ?? []));
        }
      }
      if (active) setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [companyId, showDismissed, refreshKey]);

  // Backend emits two rows per match (A→B and B→A); pair them on the sorted key.
  const matches = useMemo<ContactMatch[]>(() => {
    // Index by both transaction_id and document_id so partner lookup is robust.
    const byId = new Map<string, HealthCheckResult>();
    for (const r of rows) {
      const f = contactFlag(r);
      if (f?.transaction_id) byId.set(f.transaction_id, r);
      if (r.document_id) byId.set(r.document_id, r);
    }
    const seen = new Set<string>();
    const out: ContactMatch[] = [];
    for (const r of rows) {
      const f = contactFlag(r);
      if (!f) continue;
      const myId = f.transaction_id || r.document_id || r.id;
      const partnerId = f.partner_id || f.duplicate_of_transaction_id || "";
      const key = [myId, partnerId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      // The partner row is only needed for its Xero link + dismiss id.
      const partnerRow = partnerId ? byId.get(partnerId) : undefined;
      out.push({
        key,
        sim: f.name_similarity ?? f.confidence ?? 0,
        vat: (f.vat_status ?? "unknown").toString(),
        isSplit: !!f.is_split,
        a: {
          id: r.id,
          name: f.contact_name || r.result?.vendor_name || "Contact",
          helper: f.helper ?? null,
          xeroUrl: r.xero_url ?? null,
        },
        b: {
          id: partnerRow?.id ?? null,
          name: f.partner_name || partnerRow?.result?.vendor_name || "Partner contact",
          helper:
            f.partner_helper ??
            (partnerRow ? contactFlag(partnerRow)?.helper ?? null : null),
          xeroUrl: partnerRow?.xero_url ?? null,
        },
      });
    }
    return out
      .filter((m) => !removed.has(m.key))
      .sort((x, y) => y.sim - x.sim);
  }, [rows, removed]);

  const onDismiss = async (m: ContactMatch) => {
    setBusyKey(m.key);
    const ids = [m.a.id, m.b.id].filter(Boolean) as string[];
    const r = await bulkTrappedAction(companyId, ids, "dismiss");
    setBusyKey(null);
    if (r.ok) setRemoved((p) => new Set(p).add(m.key));
    else setError(r.error ?? "Dismiss failed");
  };

  return (
    <div className="space-y-4">
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
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
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
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading matches…
        </p>
      ) : matches.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showDismissed ? "No dismissed matches." : "No duplicate contacts"}
        </p>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <MatchCard
              key={m.key}
              m={m}
              busy={busyKey === m.key}
              onDismiss={() => onDismiss(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const COLS: { key: keyof ContactHelper; label: string }[] = [
  { key: "has_invoices", label: "Invoices" },
  { key: "has_bills", label: "Bills" },
  { key: "has_person", label: "Person" },
  { key: "has_email", label: "Email" },
  { key: "has_address", label: "Address" },
  { key: "has_phone", label: "Tel" },
];

const MatchCard = ({
  m,
  busy,
  onDismiss,
}: {
  m: ContactMatch;
  busy: boolean;
  onDismiss: () => void;
}) => {
  const pct = Math.round(m.sim * 100);
  const simCls =
    pct >= 95
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : pct >= 80
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-ink-100 text-ink-600 ring-ink-200";

  return (
    <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink-100 bg-ink-50/50 px-4 py-2.5">
        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
            simCls,
          ].join(" ")}
        >
          {pct}% match
        </span>
        {m.vat === "match" && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            Same VAT
          </span>
        )}
        {m.vat === "mismatch" && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
            Different VAT — likely different businesses
          </span>
        )}
        {m.isSplit && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
            Customer/Supplier split — review, don’t merge
          </span>
        )}
        <button
          type="button"
          onClick={onDismiss}
          disabled={busy}
          className="ml-auto rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
        >
          {busy ? "…" : "Dismiss match"}
        </button>
      </header>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[1fr_repeat(6,3.25rem)_8rem] items-center gap-2 border-b border-ink-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            <span>Contact</span>
            {COLS.map((c) => (
              <span key={c.key} className="text-center">
                {c.label}
              </span>
            ))}
            <span className="text-right">Actions</span>
          </div>
          <ContactRow line={m.a} split={m.isSplit} busy={busy} />
          <ContactRow line={m.b} split={m.isSplit} busy={busy} />
        </div>
      </div>
    </section>
  );
};

const ContactRow = ({
  line,
  split,
  busy,
}: {
  line: ContactLine;
  split: boolean;
  busy: boolean;
}) => (
  <div className="grid grid-cols-[1fr_repeat(6,3.25rem)_8rem] items-center gap-2 px-4 py-2.5 transition hover:bg-brand-50/20">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-ink-900">{line.name}</p>
      {(line.helper?.email || line.helper?.tax_number) && (
        <p className="truncate text-[11px] text-ink-400">
          {line.helper?.email}
          {line.helper?.email && line.helper?.tax_number ? " · " : ""}
          {line.helper?.tax_number}
        </p>
      )}
    </div>
    {COLS.map((c) => (
      <div key={c.key} className="flex justify-center">
        {line.helper ? <Check on={!!line.helper[c.key]} /> : <span className="text-ink-300">–</span>}
      </div>
    ))}
    <div className="flex justify-end">
      {line.xeroUrl ? (
        <a
          href={line.xeroUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
            split
              ? "border-ink-200 text-ink-500 hover:border-brand-300 hover:text-brand-700"
              : "border-ink-200 text-ink-600 hover:border-brand-300 hover:text-brand-700",
          ].join(" ")}
          title={split ? "Review in Xero (don’t merge a split)" : "View / Merge & archive in Xero"}
        >
          {split ? "View" : "View / Merge"}
        </a>
      ) : (
        <span className="text-[11px] text-ink-400">not in feed</span>
      )}
    </div>
  </div>
);

const Check = ({ on }: { on: boolean }) =>
  on ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
