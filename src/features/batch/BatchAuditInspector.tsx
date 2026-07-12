import { ChangeEvent, useMemo, useState } from "react";

import { buildDuplicateIndex, findDuplicateGroups } from "../../lib/duplicates";
import {
  downloadBatchTemplate,
  runBatchHealthCheck,
} from "../../services/audit.service";
import {
  BatchHealthCheckResponse,
  BatchTransaction,
  FlaggedIssue,
} from "../../types/audit.types";

const fmtMoney = (n: number | string) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(typeof n === "number" ? n : Number(n) || 0);

const SEV_STYLES: Record<FlaggedIssue["severity"], string> = {
  critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  high: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  medium: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
};

interface RowGroup {
  duplicateKey: string | null;
  transactions: BatchTransaction[];
}

const groupRows = (
  transactions: BatchTransaction[],
  dupeIndex: Map<string, string>,
): RowGroup[] => {
  const groups: RowGroup[] = [];
  const seenKeys = new Set<string>();
  for (const tx of transactions) {
    const key = dupeIndex.get(tx.transaction_id) ?? null;
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      const members = transactions.filter(
        (candidate) => dupeIndex.get(candidate.transaction_id) === key,
      );
      groups.push({ duplicateKey: key, transactions: members });
    } else if (!key) {
      groups.push({ duplicateKey: null, transactions: [tx] });
    }
  }
  return groups;
};

const splitCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((f) => f.trim());
};

const parseCsv = (raw: string): BatchTransaction[] => {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "_");
  const headers = splitCsvLine(lines[0]).map(norm);
  const col = (name: string) => headers.indexOf(name);

  const idxId = col("transaction_id");
  const idxDate = col("date");
  const idxDesc = col("description");
  const idxAmount = col("amount");
  const idxVendor = col("vendor_name");
  const idxType = col("type");
  const idxTax = col("tax_code");
  const idxInv = col("invoice_number");
  const idxAcct = col("current_account_code");

  if (idxId < 0 || idxDate < 0 || idxDesc < 0 || idxVendor < 0) return [];

  const txs: BatchTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (idx: number) => (idx >= 0 ? cells[idx] ?? "" : "");
    const id = get(idxId);
    const date = get(idxDate);
    const desc = get(idxDesc);
    const vendor = get(idxVendor);
    if (!id || !date || !desc || !vendor) continue;
    txs.push({
      transaction_id: id,
      date,
      description: desc,
      amount: get(idxAmount) || 0,
      vendor_name: vendor,
      type: get(idxType) || undefined,
      tax_code: idxTax >= 0 ? get(idxTax) || null : undefined,
      invoice_number: idxInv >= 0 ? get(idxInv) || null : undefined,
      current_account_code: idxAcct >= 0 ? get(idxAcct) || null : undefined,
    });
  }
  return txs;
};

const parseTransactionsInput = (raw: string): BatchTransaction[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const txs: BatchTransaction[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (
      typeof o.transaction_id !== "string" ||
      typeof o.date !== "string" ||
      typeof o.description !== "string" ||
      typeof o.vendor_name !== "string"
    ) {
      continue;
    }
    txs.push({
      transaction_id: o.transaction_id,
      date: o.date,
      description: o.description,
      amount:
        typeof o.amount === "number" || typeof o.amount === "string"
          ? o.amount
          : 0,
      vendor_name: o.vendor_name,
      type: typeof o.type === "string" ? o.type : undefined,
      tax_code:
        typeof o.tax_code === "string" || o.tax_code === null
          ? (o.tax_code as string | null)
          : undefined,
      invoice_number:
        typeof o.invoice_number === "string" || o.invoice_number === null
          ? (o.invoice_number as string | null)
          : undefined,
      current_account_code:
        typeof o.current_account_code === "string" ||
        o.current_account_code === null
          ? (o.current_account_code as string | null)
          : undefined,
    });
  }
  return txs;
};

export const BatchAuditInspector = () => {
  const [transactions, setTransactions] = useState<BatchTransaction[]>([]);
  const [response, setResponse] = useState<BatchHealthCheckResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);

  const onDownloadTemplate = async () => {
    if (templateBusy) return;
    setTemplateBusy(true);
    setError(null);
    const res = await downloadBatchTemplate();
    setTemplateBusy(false);
    if (!res.ok) setError(res.error ?? "Couldn’t download the template.");
  };

  const duplicateIndex = useMemo(
    () => buildDuplicateIndex(transactions),
    [transactions],
  );
  const duplicateGroups = useMemo(
    () => findDuplicateGroups(transactions),
    [transactions],
  );
  const rowGroups = useMemo(
    () => groupRows(transactions, duplicateIndex),
    [transactions, duplicateIndex],
  );

  const flagsByTx = useMemo(() => {
    const map = new Map<string, FlaggedIssue[]>();
    response?.flagged?.forEach((issue) => {
      const existing = map.get(issue.transaction_id) ?? [];
      existing.push(issue);
      map.set(issue.transaction_id, existing);
    });
    return map;
  }, [response]);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runBatchHealthCheck({ transactions });
      setResponse(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isCsv = /\.csv$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? "");
      const txs = isCsv ? parseCsv(text) : parseTransactionsInput(text);
      if (txs.length === 0) {
        setError(
          isCsv
            ? "Couldn't parse that CSV. It needs a header row with at least transaction_id, date, description, vendor_name columns."
            : "Couldn't parse that file. It must be a JSON array of transactions with at least transaction_id, date, description, vendor_name.",
        );
        return;
      }
      setTransactions(txs);
      setResponse(null);
      setError(null);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const applyPaste = () => {
    const txs = parseTransactionsInput(pasteDraft);
    if (txs.length === 0) {
      setError(
        "Paste must be a JSON array of transactions with transaction_id, date, description, vendor_name.",
      );
      return;
    }
    setTransactions(txs);
    setResponse(null);
    setError(null);
    setPasteOpen(false);
    setPasteDraft("");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
            Batch Inspector
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Paste or upload a batch of transactions, run them through the rule
            engine, see flags per row.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-500">
            {transactions.length} transactions · {duplicateGroups.length}{" "}
            duplicate group{duplicateGroups.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={onDownloadTemplate}
            disabled={templateBusy}
            title="Download a CSV with the expected columns to fill in"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-xs font-semibold text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {templateBusy ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <circle cx="12" cy="12" r="9" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            )}
            {templateBusy ? "Preparing…" : "Download template"}
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-xs font-semibold text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m17 8-5-5-5 5" />
              <path d="M12 3v12" />
            </svg>
            Upload CSV / JSON
            <input
              type="file"
              accept="application/json,.json,text/csv,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={() => setPasteOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-xs font-semibold text-ink-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            Paste JSON
          </button>
          <button
            type="button"
            onClick={runAudit}
            disabled={loading || transactions.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
              >
                <circle cx="12" cy="12" r="9" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
              </svg>
            )}
            {loading ? "Auditing…" : "Run audit"}
          </button>
        </div>
      </header>

      <p className="rounded-lg border border-ink-100 bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
        CSV needs a header row:{" "}
        <span className="font-semibold text-ink-700">
          transaction_id, date, description, vendor_name, amount
        </span>{" "}
        (required) + optional{" "}
        <span className="text-ink-600">
          type, reference, contact_id, current_account_code, tax_code
        </span>
        . Dates as YYYY-MM-DD.{" "}
        <button
          type="button"
          onClick={onDownloadTemplate}
          disabled={templateBusy}
          className="font-semibold text-brand-700 hover:underline disabled:opacity-60"
        >
          Download a template →
        </button>
      </p>

      {pasteOpen && (
        <div className="rounded-xl border border-ink-200 bg-surface p-4 shadow-card">
          <label
            htmlFor="paste-json"
            className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500"
          >
            Paste a JSON array of transactions
          </label>
          <textarea
            id="paste-json"
            rows={8}
            value={pasteDraft}
            onChange={(e) => setPasteDraft(e.target.value)}
            placeholder={`[
  {
    "transaction_id": "tx-001",
    "date": "2026-05-12",
    "description": "AWS — production workloads",
    "amount": 2480.55,
    "vendor_name": "Amazon Web Services",
    "type": "ACCPAY",
    "tax_code": "GST-STD",
    "current_account_code": "485"
  }
]`}
            className="mt-2 block w-full resize-y rounded-md border border-ink-300 bg-surface px-3 py-2 font-mono text-[11px] text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPasteOpen(false);
                setPasteDraft("");
              }}
              className="rounded-md border border-ink-200 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyPaste}
              disabled={!pasteDraft.trim()}
              className="rounded-md bg-brand-gradient px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Load transactions
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-ink-50 text-[10px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Txn ID</th>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Vendor</th>
              <th className="px-4 py-3 text-left font-semibold">Description</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-left font-semibold">Type</th>
              <th className="px-4 py-3 text-left font-semibold">Tax</th>
              <th className="px-4 py-3 text-left font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {rowGroups.map((group, idx) => {
              if (group.duplicateKey) {
                return (
                  <tr key={`dupe-${group.duplicateKey}`}>
                    <td colSpan={8} className="p-0">
                      <div className="border-y border-rose-200 bg-rose-50/50">
                        <div className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5"
                            fill="currentColor"
                            aria-hidden
                          >
                            <path d="M12 2 1 21h22L12 2Zm0 6 7.5 13h-15L12 8Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
                          </svg>
                          Potential duplicate · {group.transactions.length}{" "}
                          matching rows
                        </div>
                        <table className="w-full">
                          <tbody>
                            {group.transactions.map((tx) => (
                              <Row
                                key={tx.transaction_id}
                                transaction={tx}
                                flags={flagsByTx.get(tx.transaction_id) ?? []}
                                inDuplicate
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                );
              }
              const tx = group.transactions[0];
              return (
                <Row
                  key={tx.transaction_id ?? idx}
                  transaction={tx}
                  flags={flagsByTx.get(tx.transaction_id) ?? []}
                />
              );
            })}
            {rowGroups.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-ink-500"
                >
                  No transactions loaded. Paste JSON or upload a file to begin.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface RowProps {
  transaction: BatchTransaction;
  flags: FlaggedIssue[];
  inDuplicate?: boolean;
}

const Row = ({ transaction, flags, inDuplicate }: RowProps) => (
  <tr
    className={[
      "transition",
      inDuplicate ? "bg-transparent" : "hover:bg-ink-50/60",
    ].join(" ")}
  >
    <td className="px-4 py-3 font-mono text-[11px] text-ink-500">
      {transaction.transaction_id}
    </td>
    <td className="px-4 py-3 text-ink-700">{transaction.date}</td>
    <td className="px-4 py-3 font-medium text-ink-900">
      {transaction.vendor_name}
    </td>
    <td className="px-4 py-3 text-ink-600">{transaction.description}</td>
    <td className="px-4 py-3 text-right font-medium tabular-nums text-ink-900">
      {fmtMoney(transaction.amount)}
    </td>
    <td className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
      {transaction.type ?? "—"}
    </td>
    <td className="px-4 py-3 text-ink-600">
      {transaction.tax_code ?? (
        <span className="text-orange-700">— missing</span>
      )}
    </td>
    <td className="px-4 py-3">
      {flags.length === 0 ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Clean
        </span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {flags.map((flag, i) => (
            <span
              key={`${flag.transaction_id}-${i}`}
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                SEV_STYLES[flag.severity],
              ].join(" ")}
              title={flag.message}
            >
              {flag.issue_type.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </td>
  </tr>
);
