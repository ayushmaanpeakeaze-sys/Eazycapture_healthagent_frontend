import { useEffect, useMemo, useState } from "react";

import {
  CdDefaults,
  ContactDefaultsResponse,
  confirmContactDefault,
  dismissContactDefault,
  fetchContactDefaults,
  reinstateContactDefault,
} from "@/services/contactDefaults.service";

const PAGE_SIZE = 12;
const EMPTY: CdDefaults = {
  sales_account: "",
  sales_tax: "",
  purchases_account: "",
  purchases_tax: "",
};

// Editable contact-defaults table; Confirm writes the changed fields back to Xero.
export const ContactDefaultsPage = ({ companyId }: { companyId: string }) => {
  const [data, setData] = useState<ContactDefaultsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingOnly, setMissingOnly] = useState(true);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [edits, setEdits] = useState<Record<string, CdDefaults>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchContactDefaults(companyId, missingOnly, includeDismissed).then((r) => {
      if (!active) return;
      if (r.ok) {
        setData(r.data);
        const e: Record<string, CdDefaults> = {};
        for (const c of r.data.contacts) e[c.contact_id] = { ...c.current_defaults };
        setEdits(e);
        setConfirmed(new Set());
        setPage(0);
      } else {
        setError(r.error);
        setData(null);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, missingOnly, includeDismissed]);

  // "Show dismissed" ON → only the dismissed ones (empty if none yet).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.contacts ?? []).filter(
      (c) =>
        (includeDismissed ? c.dismissed : !c.dismissed) &&
        (!q || c.name.toLowerCase().includes(q)),
    );
  }, [data, search, includeDismissed]);

  // Flip dismissed locally so the row updates without a refetch (backend persists it).
  const setDismissedFlag = (id: string, val: boolean) =>
    setData((d) => {
      if (!d) return d;
      const delta = val ? -1 : 1; // dismiss removes from the active counts
      return {
        ...d,
        contacts: d.contacts.map((c) =>
          c.contact_id === id ? { ...c, dismissed: val } : c,
        ),
        missing_count: Math.max(0, d.missing_count + delta),
        total: Math.max(0, d.total + delta),
      };
    });

  const dismiss = async (id: string) => {
    setActioningId(id);
    setRowError((p) => ({ ...p, [id]: "" }));
    const r = await dismissContactDefault(companyId, id);
    setActioningId(null);
    if (r.ok) setDismissedFlag(id, true);
    else setRowError((p) => ({ ...p, [id]: r.error }));
  };

  const reinstate = async (id: string) => {
    setActioningId(id);
    setRowError((p) => ({ ...p, [id]: "" }));
    const r = await reinstateContactDefault(companyId, id);
    setActioningId(null);
    if (r.ok) setDismissedFlag(id, false);
    else setRowError((p) => ({ ...p, [id]: r.error }));
  };

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const setField = (id: string, field: keyof CdDefaults, value: string) =>
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? EMPTY), [field]: value },
    }));

  const confirm = async (id: string) => {
    // Send only the fields that actually changed vs current_defaults.
    const cur =
      data?.contacts.find((c) => c.contact_id === id)?.current_defaults ?? EMPTY;
    const ed = edits[id] ?? EMPTY;
    const changed: Partial<CdDefaults> = {};
    (Object.keys(ed) as (keyof CdDefaults)[]).forEach((k) => {
      if (ed[k] !== (cur[k] ?? "")) changed[k] = ed[k];
    });
    if (Object.keys(changed).length === 0) {
      setRowError((p) => ({ ...p, [id]: "Pick a value first." }));
      return;
    }
    setSavingId(id);
    setRowError((p) => ({ ...p, [id]: "" }));
    const r = await confirmContactDefault(companyId, id, changed);
    setSavingId(null);
    if (r.ok) setConfirmed((p) => new Set(p).add(id));
    else setRowError((p) => ({ ...p, [id]: r.error }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-ink-100 bg-brand-50/40 px-4 py-3 text-[12px] leading-relaxed text-ink-600">
        <span className="mr-1.5 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          Issue
        </span>
        One or more default account / tax codes aren’t set for these contacts.
        <span className="mx-1.5 rounded bg-ink-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          Fix
        </span>
        Pick the right accounts &amp; tax codes, then <strong>Confirm</strong> to
        save them back to Xero.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
            <button
              type="button"
              role="switch"
              aria-checked={!missingOnly}
              onClick={() => setMissingOnly((v) => !v)}
              className={[
                "relative h-5 w-9 rounded-full transition",
                !missingOnly ? "bg-brand-600" : "bg-ink-200",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                  !missingOnly ? "left-[18px]" : "left-0.5",
                ].join(" ")}
              />
            </button>
            Show all contacts
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
            <button
              type="button"
              role="switch"
              aria-checked={includeDismissed}
              onClick={() => setIncludeDismissed((v) => !v)}
              className={[
                "relative h-5 w-9 rounded-full transition",
                includeDismissed ? "bg-brand-600" : "bg-ink-200",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                  includeDismissed ? "left-[18px]" : "left-0.5",
                ].join(" ")}
              />
            </button>
            Show dismissed
          </label>
        </div>

        <div className="relative max-w-xs flex-1">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search contact"
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <span className="text-xs text-ink-400">
          {loading
            ? "Loading…"
            : `${data?.missing_count ?? 0} missing · ${data?.total ?? 0} total`}
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">
            Loading contacts…
          </p>
        ) : error ? (
          <p className="px-5 py-10 text-center text-sm text-rose-600">{error}</p>
        ) : data && !data.connected ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink-800">
              No Xero connection
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-500">
              Connect this client’s Xero org to review and set contact defaults.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm italic text-ink-400">
            {includeDismissed
              ? "Nothing dismissed yet."
              : missingOnly
                ? "No contacts missing defaults"
                : "No contacts."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-3 py-2.5 font-semibold">Sales account</th>
                  <th className="px-3 py-2.5 font-semibold">Sales tax</th>
                  <th className="px-3 py-2.5 font-semibold">Purchases account</th>
                  <th className="px-3 py-2.5 font-semibold">Purchases tax</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {pageItems.map((c, i) => {
                  const e = edits[c.contact_id] ?? EMPTY;
                  const done = confirmed.has(c.contact_id);
                  const saving = savingId === c.contact_id;
                  const acting = actioningId === c.contact_id;
                  const isDismissed = !!c.dismissed;
                  const err = rowError[c.contact_id];
                  const isMissing = (f: string) => c.missing.includes(f);
                  return (
                    <tr
                      key={c.contact_id}
                      className={[
                        done ? "bg-emerald-50/40" : "",
                        isDismissed ? "opacity-60" : "",
                      ].join(" ")}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-ink-300 tabular-nums">
                            {page * PAGE_SIZE + i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">
                              {c.name}
                            </p>
                            <p className="text-[10px] text-ink-400">
                              {[c.is_customer && "Customer", c.is_supplier && "Supplier"]
                                .filter(Boolean)
                                .join(" · ") || "Contact"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <AccountCell
                        accounts={data!.accounts}
                        value={e.sales_account}
                        missing={isMissing("sales_account")}
                        disabled={done || !c.is_customer}
                        onChange={(v) => setField(c.contact_id, "sales_account", v)}
                      />
                      <TaxCell
                        rates={data!.tax_rates}
                        value={e.sales_tax}
                        missing={isMissing("sales_tax")}
                        disabled={done || !c.is_customer}
                        onChange={(v) => setField(c.contact_id, "sales_tax", v)}
                      />
                      <AccountCell
                        accounts={data!.accounts}
                        value={e.purchases_account}
                        missing={isMissing("purchases_account")}
                        disabled={done || !c.is_supplier}
                        onChange={(v) =>
                          setField(c.contact_id, "purchases_account", v)
                        }
                      />
                      <TaxCell
                        rates={data!.tax_rates}
                        value={e.purchases_tax}
                        missing={isMissing("purchases_tax")}
                        disabled={done || !c.is_supplier}
                        onChange={(v) => setField(c.contact_id, "purchases_tax", v)}
                      />
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`https://go.xero.com/Contacts/View/${c.contact_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                          >
                            View
                          </a>
                          {isDismissed ? (
                            <>
                              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                                Dismissed
                              </span>
                              <button
                                type="button"
                                onClick={() => reinstate(c.contact_id)}
                                disabled={acting}
                                className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
                              >
                                {acting ? "…" : "Reinstate"}
                              </button>
                            </>
                          ) : done ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12l5 5L20 6" />
                              </svg>
                              Saved
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => confirm(c.contact_id)}
                                disabled={saving || acting}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                              >
                                {saving ? "Saving…" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                onClick={() => dismiss(c.contact_id)}
                                disabled={acting || saving}
                                className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                              >
                                {acting ? "…" : "Dismiss"}
                              </button>
                            </>
                          )}
                        </div>
                        {err && (
                          <p className="mt-1 text-right text-[10px] text-rose-600">
                            {err}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500">
            <span>
              Page {page + 1} of {pageCount}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-ink-200 px-2.5 py-1 font-medium transition hover:border-brand-300 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                className="rounded-md border border-ink-200 px-2.5 py-1 font-medium transition hover:border-brand-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

const selectCls = (missing: boolean) =>
  [
    "w-full min-w-[9rem] rounded-lg border bg-white px-2 py-1.5 text-xs text-ink-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200",
    missing ? "border-rose-300 bg-rose-50/40" : "border-ink-200",
  ].join(" ");

const AccountCell = ({
  accounts,
  value,
  missing,
  disabled,
  onChange,
}: {
  accounts: { code: string; name: string }[];
  value: string;
  missing: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
}) => (
  <td className="px-3 py-2.5">
    <select
      value={value}
      disabled={disabled}
      onChange={(ev) => onChange(ev.target.value)}
      className={selectCls(missing && !value)}
    >
      <option value="">— Select —</option>
      {accounts.map((a) => (
        <option key={a.code} value={a.code}>
          {a.code} – {a.name}
        </option>
      ))}
    </select>
  </td>
);

const TaxCell = ({
  rates,
  value,
  missing,
  disabled,
  onChange,
}: {
  rates: { code: string; name: string }[];
  value: string;
  missing: boolean;
  disabled: boolean;
  onChange: (v: string) => void;
}) => (
  <td className="px-3 py-2.5">
    <select
      value={value}
      disabled={disabled}
      onChange={(ev) => onChange(ev.target.value)}
      className={selectCls(missing && !value)}
    >
      <option value="">— Select —</option>
      {rates.map((t) => (
        <option key={t.code} value={t.code}>
          {t.name}
        </option>
      ))}
    </select>
  </td>
);
