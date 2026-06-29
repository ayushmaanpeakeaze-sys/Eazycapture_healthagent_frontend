import { useEffect, useMemo, useRef, useState } from "react";

import {
  bulkTrappedAction,
  fetchAuditConfig,
  fetchTrappedInvoices,
  recheckAttachment,
  saveAuditConfigFull,
  uploadAttachment,
} from "@/services/audit.service";
import { FlaggedIssue, HealthCheckResult } from "@/types/audit.types";
import { TablePager, useClientPagination } from "@/features/checks/paginate";

const RULE = "undocumented_bill";

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
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
};

const DOC_TYPE_LABEL: Record<string, string> = {
  ACCPAY: "Bill",
  SPEND: "Money Out",
  ACCREC: "Invoice",
  RECEIVE: "Money In",
};
const DOC_TYPE_CLS: Record<string, string> = {
  ACCPAY: "bg-amber-600 text-white",
  SPEND: "bg-rose-700 text-white",
  ACCREC: "bg-emerald-600 text-white",
  RECEIVE: "bg-sky-600 text-white",
};

const flagFor = (r: HealthCheckResult): FlaggedIssue | undefined =>
  (r.result?.flagged ?? []).find((f) => f.issue_type === RULE) ??
  r.result?.flagged?.[0];

const matchesRule = (r: HealthCheckResult): boolean =>
  (r.result?.rule_ids ?? []).includes(RULE) ||
  (r.result?.flagged ?? []).some((f) => f.issue_type === RULE);

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const UndocumentedBillsPage = ({
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
  const [showBank, setShowBank] = useState(false);
  const [taxOnly, setTaxOnly] = useState(false);
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

    const excludeBank = !showBank;
    const byRule = (list: HealthCheckResult[]) => list.filter(matchesRule);

    const load = async () => {
      if (showDismissed) {
        const [all, act] = await Promise.all([
          fetchTrappedInvoices({
            company_id: companyId,
            limit: 200,
            include_dismissed: true,
            exclude_bank_items: excludeBank,
          }),
          fetchTrappedInvoices({
            company_id: companyId,
            limit: 200,
            exclude_bank_items: excludeBank,
          }),
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
          exclude_bank_items: excludeBank,
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
  }, [companyId, showDismissed, showBank, refreshKey]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !removed.has(r.id))
      .filter((r) =>
        taxOnly ? Number(flagFor(r)?.match_reasons?.tax_amount) > 0 : true,
      )
      .filter((r) => {
        if (!q) return true;
        const res = r.result;
        return [res?.vendor_name, res?.reference, res?.details].some((v) =>
          (v || "").toString().toLowerCase().includes(q),
        );
      });
  }, [rows, removed, search, taxOnly]);

  const pg = useClientPagination(visible, `${search}|${showDismissed}|${showBank}|${taxOnly}`);

  const totalValue = useMemo(
    () =>
      visible.reduce(
        (s, r) =>
          s +
          (Number(flagFor(r)?.match_reasons?.net_amount) ||
            Number(r.result?.amount) ||
            0),
        0,
      ),
    [visible],
  );
  const currency = visible[0]?.result?.currency_code ?? "GBP";

  const drop = (ids: string[]) =>
    setRemoved((p) => {
      const n = new Set(p);
      ids.forEach((id) => n.add(id));
      return n;
    });

  const onUpload = async (r: HealthCheckResult, file: File) => {
    setBusyKey(r.id);
    try {
      const b64 = await fileToBase64(file);
      const res = await uploadAttachment(companyId, r.id, {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        content_base64: b64,
      });
      if (res.ok && res.resolved) drop([r.id]);
      else if (res.ok && res.stub)
        setError("Connect Xero to upload attachments.");
      else if (!res.ok) setError(res.error ?? "Upload failed");
    } catch {
      setError("Couldn’t read that file.");
    }
    setBusyKey(null);
  };

  const onRecheck = async (r: HealthCheckResult) => {
    setBusyKey(r.id);
    const res = await recheckAttachment(companyId, r.id);
    setBusyKey(null);
    if (res.ok && res.resolved) drop([r.id]);
    else if (res.ok) setError("Still no attachment found in Xero.");
    else setError(res.error ?? "Re-check failed");
  };

  const onDismiss = async (r: HealthCheckResult) => {
    setBusyKey(r.id);
    const res = await bulkTrappedAction(companyId, [r.id], "dismiss");
    setBusyKey(null);
    if (res.ok) drop([r.id]);
    else setError(res.error ?? "Dismiss failed");
  };

  const onIgnoreContact = async (r: HealthCheckResult) => {
    const cid = r.result?.contact_id ?? null;
    const name = r.result?.vendor_name ?? null;
    const value = cid || name;
    if (!value) return;
    setBusyKey(r.id);
    const cfg = await fetchAuditConfig(companyId);
    const list =
      (cfg?.settings?.undocumented_ignore_contacts as string[] | undefined) ?? [];
    const upper = value.toUpperCase();
    if (!list.some((x) => x.toUpperCase() === upper)) {
      const save = await saveAuditConfigFull(companyId, {
        settings: { undocumented_ignore_contacts: [...list, upper] },
      });
      if (!save.ok) {
        setBusyKey(null);
        setError(save.error);
        return;
      }
    }
    setBusyKey(null);
    drop(
      rows
        .filter(
          (x) =>
            (cid && x.result?.contact_id === cid) ||
            (name && x.result?.vendor_name === name),
        )
        .map((x) => x.id),
    );
  };

  const toggle = (id: string) =>
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = pg.paged.length > 0 && pg.paged.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pg.paged.map((r) => r.id)));

  const dismissMany = async (ids: string[]) => {
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
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
            <Switch on={showDismissed} onClick={() => setShowDismissed((v) => !v)} />
            Show dismissed
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
            <Switch on={taxOnly} onClick={() => setTaxOnly((v) => !v)} />
            Only with tax
          </label>
          <label
            className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600"
            title="Also include direct bank payments (Money Out) without an attachment"
          >
            <Switch on={showBank} onClick={() => setShowBank((v) => !v)} />
            Also show direct payments
          </label>
        </div>
        <div className="flex items-center gap-3">
          {!loading && visible.length > 0 && (
            <>
              <span className="text-xs text-ink-500">
                {visible.length} item{visible.length === 1 ? "" : "s"} · Total:{" "}
                <span className="font-semibold text-ink-800">
                  {money(totalValue, currency)}
                </span>
              </span>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => dismissMany(visible.map((r) => r.id))}
                className="rounded-md border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
              >
                Dismiss all {visible.length}
              </button>
            </>
          )}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-48 rounded-lg border border-ink-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs">
          <span className="font-semibold text-brand-700">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => dismissMany([...selected])}
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
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showDismissed
            ? "No dismissed items."
            : search
              ? "No matches for your search."
              : "No undocumented bills"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-card">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 accent-brand-600"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-2 py-2.5">Item</th>
                <th className="px-2 py-2.5">Details</th>
                <th className="px-2 py-2.5">Net</th>
                <th className="px-2 py-2.5">Tax</th>
                <th className="px-2 py-2.5">Tax code</th>
                <th className="px-2 py-2.5">Attach to bill</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {pg.paged.map((r) => {
                const res = r.result;
                const f = flagFor(r);
                const mr = f?.match_reasons;
                const busy = busyKey === r.id;
                return (
                  <tr key={r.id} className="align-top transition hover:bg-brand-50/20">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-3.5 w-3.5 accent-brand-600"
                        aria-label="Select row"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={[
                          "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          DOC_TYPE_CLS[r.document_type] ?? "bg-ink-500 text-white",
                        ].join(" ")}
                      >
                        {DOC_TYPE_LABEL[r.document_type] ?? r.document_type}
                      </span>
                      <p className="mt-1 font-medium text-ink-900">
                        {res?.vendor_name || "—"}
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {[shortDate(res?.invoice_date), res?.reference || res?.invoice_number]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <button
                        type="button"
                        onClick={() => onIgnoreContact(r)}
                        disabled={busy}
                        className="mt-0.5 text-[11px] font-medium text-rose-500 hover:text-rose-700 hover:underline disabled:opacity-60"
                      >
                        Ignore this contact
                      </button>
                    </td>
                    <td className="max-w-[180px] px-2 py-3 text-[12px] text-ink-500">
                      <span className="line-clamp-2">{res?.details || "—"}</span>
                    </td>
                    <td className="px-2 py-3 font-semibold tabular-nums text-ink-900">
                      {money(mr?.net_amount ?? res?.amount, res?.currency_code)}
                    </td>
                    <td className="px-2 py-3 tabular-nums text-ink-700">
                      {money(mr?.tax_amount, res?.currency_code)}
                    </td>
                    <td className="px-2 py-3 text-ink-700">
                      {res?.tax_code || mr?.tax_code || f?.current_code || "—"}
                    </td>
                    <td className="w-44 px-2 py-3">
                      <DropZone busy={busy} onFile={(file) => onUpload(r, file)} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRecheck(r)}
                          disabled={busy}
                          className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
                        >
                          {busy ? "…" : "Check again"}
                        </button>
                        {r.xero_url && (
                          <a
                            href={r.xero_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                          >
                            Edit in Xero
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onDismiss(r)}
                          disabled={busy}
                          className="rounded-md border border-ink-200 px-2 py-1 text-xs font-semibold text-ink-500 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-60"
                        >
                          Dismiss
                        </button>
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
    </div>
  );
};

const DropZone = ({
  busy,
  onFile,
}: {
  busy: boolean;
  onFile: (file: File) => void;
}) => {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={[
        "cursor-pointer rounded-md border border-dashed px-3 py-2 text-center text-[11px] transition",
        over
          ? "border-brand-400 bg-brand-50 text-brand-700"
          : "border-ink-300 text-ink-400 hover:border-brand-300 hover:text-brand-600",
      ].join(" ")}
    >
      {busy ? "Uploading…" : "Drop file here (or click)"}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
};

const Switch = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    className={[
      "relative h-5 w-9 rounded-full transition",
      on ? "bg-brand-600" : "bg-ink-200",
    ].join(" ")}
  >
    <span
      className={[
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
        on ? "left-[18px]" : "left-0.5",
      ].join(" ")}
    />
  </button>
);
