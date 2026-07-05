import { useEffect, useMemo, useRef, useState } from "react";

import { listUsers } from "@/services/auth.service";
import {
  addBankNote,
  deleteBankDocument,
  deleteBankNote,
  downloadBankDocument,
  excludeBankAccount,
  fetchBankBalanceCheck,
  fetchBankDocuments,
  fetchBankNotes,
  markBankBalanceOk,
  setStatementBalance,
  uploadBankDocument,
} from "@/services/audit.service";
import {
  BankBalanceCheckResponse,
  BankBalanceItem,
  BankDocument,
  BankNote,
} from "@/types/audit.types";
import { TeamUser } from "@/types/auth.types";

const money = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : Number(n);
  const num = Number.isFinite(v) ? v : 0;
  return `${num < 0 ? "-" : ""}£${Math.abs(num).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fmtDateTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const fmtBytes = (n: number): string => {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const monthEnd = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const e = new Date(y, m, 0);
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(
    e.getDate(),
  ).padStart(2, "0")}`;
};

const toMonthValue = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})/.exec(iso || "");
  if (m) return `${m[1]}-${m[2]}`;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const thisMonthEnd = (): string => {
  const d = new Date();
  const e = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(
    e.getDate(),
  ).padStart(2, "0")}`;
};

const userLabel = (id: string, users: TeamUser[]): string => {
  const u = users.find((x) => x.id === id);
  return u?.full_name || u?.email || id;
};

const NotesPanel = ({
  companyId,
  item,
  periodEnd,
  users,
  onChanged,
}: {
  companyId: string;
  item: BankBalanceItem;
  periodEnd: string;
  users: TeamUser[];
  onChanged: () => void;
}) => {
  const [notes, setNotes] = useState<BankNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [tagged, setTagged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchBankNotes(companyId, item.account_code, periodEnd).then((n) => {
      setNotes(n);
      setLoading(false);
    });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBankNotes(companyId, item.account_code, periodEnd).then((n) => {
      if (!active) return;
      setNotes(n);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, item.account_code, periodEnd]);

  const onAdd = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    const res = await addBankNote(companyId, item.account_code, {
      period_end: periodEnd,
      body: text,
      tagged_user_ids: tagged,
    });
    setBusy(false);
    if (res.ok) {
      setBody("");
      setTagged([]);
      load();
      onChanged();
    } else {
      setError(res.error);
    }
  };

  const onDelete = async (noteId: string) => {
    const res = await deleteBankNote(companyId, noteId);
    if (res.ok) {
      setNotes((p) => p.filter((n) => n.id !== noteId));
      onChanged();
    } else {
      setError(res.error ?? "Delete failed");
    }
  };

  return (
    <div className="mt-3 border-t border-ink-100 pt-3 text-left">
      {error && (
        <p className="mb-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[11px] italic text-ink-400">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-[11px] italic text-ink-400">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-ink-100 bg-ink-50/40 px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-[12px] text-ink-800">
                  {n.body}
                </p>
                <button
                  type="button"
                  onClick={() => onDelete(n.id)}
                  aria-label="Delete note"
                  className="flex-shrink-0 rounded p-0.5 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-[10px] text-ink-400">
                {userLabel(n.author_user_id, users)} · {fmtDateTime(n.created_at)}
              </p>
              {n.tagged_user_ids.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-1">
                  {n.tagged_user_ids.map((uid) => (
                    <span
                      key={uid}
                      className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700"
                    >
                      @{userLabel(uid, users)}
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-[12px] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        {users.length > 0 && (
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Mention
            <select
              multiple
              value={tagged}
              onChange={(e) =>
                setTagged(
                  Array.from(e.target.selectedOptions).map((o) => o.value),
                )
              }
              className="mt-1 block w-full rounded-lg border border-ink-200 px-2 py-1 text-[12px] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={onAdd}
          disabled={busy || !body.trim()}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add note"}
        </button>
      </div>
    </div>
  );
};

const DocumentsPanel = ({
  companyId,
  item,
  periodEnd,
  onChanged,
}: {
  companyId: string;
  item: BankBalanceItem;
  periodEnd: string;
  onChanged: () => void;
}) => {
  const [docs, setDocs] = useState<BankDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = () => {
    setLoading(true);
    fetchBankDocuments(companyId, item.account_code, periodEnd).then((d) => {
      setDocs(d);
      setLoading(false);
    });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBankDocuments(companyId, item.account_code, periodEnd).then((d) => {
      if (!active) return;
      setDocs(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, item.account_code, periodEnd]);

  const onUpload = async (file: File) => {
    setBusy(true);
    setError(null);
    const res = await uploadBankDocument(companyId, item.account_code, periodEnd, file);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      load();
      onChanged();
    } else {
      setError(res.error);
    }
  };

  const onDownload = async (d: BankDocument) => {
    const res = await downloadBankDocument(companyId, d.id, d.filename);
    if (!res.ok) setError(res.error ?? "Download failed");
  };

  const onDelete = async (docId: string) => {
    const res = await deleteBankDocument(companyId, docId);
    if (res.ok) {
      setDocs((p) => p.filter((d) => d.id !== docId));
      onChanged();
    } else {
      setError(res.error ?? "Delete failed");
    }
  };

  return (
    <div className="mt-3 border-t border-ink-100 pt-3 text-left">
      {error && (
        <p className="mb-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[11px] italic text-ink-400">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-[11px] italic text-ink-400">No documents yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 bg-ink-50/40 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-ink-800">
                  {d.filename}
                </p>
                <p className="text-[10px] text-ink-400">
                  {fmtBytes(d.size_bytes)} · {d.uploaded_by} ·{" "}
                  {fmtDateTime(d.created_at)}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onDownload(d)}
                  className="rounded-lg border border-ink-200 px-2 py-1 text-[11px] font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(d.id)}
                  aria-label="Delete document"
                  className="rounded p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
          disabled={busy}
          className="block w-full text-[11px] text-ink-600 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-50 file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
        />
        {busy && <span className="text-[11px] text-ink-400">Uploading…</span>}
      </div>
      <p className="mt-1 text-[10px] text-ink-400">Max file size 10MB.</p>
    </div>
  );
};

const AccountCard = ({
  companyId,
  item,
  periodEnd,
  showAll,
  users,
  onWrite,
}: {
  companyId: string;
  item: BankBalanceItem;
  periodEnd: string;
  showAll: boolean;
  users: TeamUser[];
  onWrite: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "notes" | "docs" | "recon">(
    "none",
  );
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");

  const cur = periodEnd;
  const hasStmt = item.per_bank_statement != null;
  const diff = item.difference;
  const diffNonZero =
    diff != null && Math.abs(typeof diff === "string" ? parseFloat(diff) : diff) > 0.005;

  const onSaveBalance = async () => {
    const v = parseFloat(balanceInput);
    if (!Number.isFinite(v)) {
      setEditingBalance(false);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await setStatementBalance(companyId, item.account_code, cur, v);
    setBusy(false);
    setEditingBalance(false);
    setBalanceInput("");
    if (res.ok) onWrite();
    else setError(res.error ?? "Save failed");
  };

  const onMarkOk = async () => {
    setBusy(true);
    setError(null);
    const res = await markBankBalanceOk(companyId, item.account_code, cur, !item.marked_ok);
    setBusy(false);
    if (res.ok) onWrite();
    else setError(res.error ?? "Mark OK failed");
  };

  const onExclude = async (excluded: boolean) => {
    setBusy(true);
    setError(null);
    const res = await excludeBankAccount(companyId, item.account_code, excluded);
    setBusy(false);
    if (res.ok) onWrite();
    else setError(res.error ?? "Update failed");
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
      <button
        type="button"
        onClick={() => onExclude(true)}
        disabled={busy}
        aria-label="Ignore this account"
        title="Ignore this account for this period"
        className="absolute right-2 top-2 rounded p-1 text-ink-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-wrap items-center gap-2 pr-6">
        <h3 className="text-sm font-semibold text-brand-700">
          {item.account_name}
          {item.account_code && (
            <span className="ml-1 font-normal text-ink-400">
              ({item.account_code})
            </span>
          )}
        </h3>
        {item.marked_ok && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
            Marked OK
          </span>
        )}
        {item.needs_reconciliation && !item.marked_ok && (
          <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
            Needs reconciliation
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-left text-[12px] sm:grid-cols-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Balance in Xero
          </p>
          <p className="mt-0.5 font-semibold tabular-nums text-ink-900">
            {money(item.per_xero_tb)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Per Bank Statement
          </p>
          {editingBalance ? (
            <span className="mt-0.5 flex items-center gap-1">
              <input
                type="number"
                autoFocus
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveBalance();
                  if (e.key === "Escape") setEditingBalance(false);
                }}
                className="w-24 rounded-md border border-ink-200 px-1.5 py-0.5 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <button
                type="button"
                onClick={onSaveBalance}
                disabled={busy}
                className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
            </span>
          ) : hasStmt ? (
            <button
              type="button"
              onClick={() => {
                setEditingBalance(true);
                setBalanceInput(String(item.per_bank_statement ?? ""));
              }}
              className="mt-0.5 font-semibold tabular-nums text-ink-900 hover:text-brand-700"
            >
              {money(item.per_bank_statement)}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingBalance(true);
                setBalanceInput("");
              }}
              className="mt-0.5 font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              Add balance
            </button>
          )}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Imported Statement Balance
          </p>
          <p
            className="mt-0.5 italic text-ink-400"
            title="Requires Xero's gated Finance API"
          >
            Not available
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Difference
          </p>
          <p
            className={[
              "mt-0.5 font-semibold tabular-nums",
              diffNonZero ? "text-rose-600" : "text-ink-900",
            ].join(" ")}
          >
            {diff == null ? "—" : money(diff)}
          </p>
        </div>
      </div>

      {(item.statement_balance_calculated != null ||
        (item.unreconciled_count ?? 0) > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 pt-2 text-[11px] text-ink-500">
          <span>
            Statement balance (calculated):{" "}
            <span className="font-semibold tabular-nums text-ink-800">
              {money(item.statement_balance_calculated)}
            </span>
          </span>
          {(item.unreconciled_count ?? 0) > 0 && (
            <span className="tabular-nums">
              {item.unreconciled_count} unreconciled item
              {item.unreconciled_count === 1 ? "" : "s"}
            </span>
          )}
          {(item.lines?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p === "recon" ? "none" : "recon"))}
              className="font-semibold text-brand-700 hover:underline"
            >
              {panel === "recon" ? "Hide details" : "View details"}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(item.notes_count ?? 0) > 0 && (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600">
            {item.notes_count} note{item.notes_count === 1 ? "" : "s"}
          </span>
        )}
        {(item.documents_count ?? 0) > 0 && (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600">
            {item.documents_count} doc{item.documents_count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.process_url && (
          <a
            href={item.process_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Process
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
          </a>
        )}
        <button
          type="button"
          onClick={() => setPanel((p) => (p === "notes" ? "none" : "notes"))}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          Add note
        </button>
        <button
          type="button"
          onClick={() => setPanel((p) => (p === "docs" ? "none" : "docs"))}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          Documents
        </button>
        <button
          type="button"
          onClick={onMarkOk}
          disabled={busy}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
        >
          {item.marked_ok ? "Un-mark OK" : "Mark OK"}
        </button>
        {showAll && (
          <button
            type="button"
            onClick={() => onExclude(false)}
            disabled={busy}
            className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-60"
          >
            Reinstate
          </button>
        )}
      </div>

      {panel === "recon" && item.lines && item.lines.length > 0 && (
        <div className="mt-3 border-t border-ink-100 pt-3">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="py-1 pr-3 font-semibold">Date</th>
                <th className="py-1 pr-3 font-semibold">Contact</th>
                <th className="py-1 pr-3 font-semibold">Type</th>
                <th className="py-1 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {item.lines.map((l, i) => (
                <tr key={`${l.date}-${i}`}>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-600">
                    {fmtDate(l.date)}
                  </td>
                  <td className="py-1.5 pr-3 text-ink-800">{l.contact}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={[
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        l.type === "Received"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      ].join(" ")}
                    >
                      {l.type}
                    </span>
                  </td>
                  <td
                    className={[
                      "py-1.5 text-right font-semibold tabular-nums",
                      l.amount >= 0 ? "text-emerald-700" : "text-rose-700",
                    ].join(" ")}
                  >
                    {l.amount >= 0 ? "+" : ""}
                    {money(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {panel === "notes" && (
        <NotesPanel
          companyId={companyId}
          item={item}
          periodEnd={periodEnd}
          users={users}
          onChanged={onWrite}
        />
      )}
      {panel === "docs" && (
        <DocumentsPanel
          companyId={companyId}
          item={item}
          periodEnd={periodEnd}
          onChanged={onWrite}
        />
      )}
    </section>
  );
};

export const ManualBankBalanceCheck = ({
  companyId,
  refreshKey = 0,
}: {
  companyId: string;
  refreshKey?: number;
}) => {
  const [monthValue, setMonthValue] = useState(toMonthValue(thisMonthEnd()));
  const [showAll, setShowAll] = useState(false);
  const [data, setData] = useState<BankBalanceCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [nonce, setNonce] = useState(0);

  const periodEnd = useMemo(() => monthEnd(monthValue), [monthValue]);

  useEffect(() => {
    listUsers().then(setUsers);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchBankBalanceCheck(companyId, periodEnd, showAll).then((d) => {
      if (!active) return;
      if (!d) setError("Couldn’t load the bank balance check.");
      setData(d);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId, periodEnd, showAll, nonce, refreshKey]);

  const refetch = () => setNonce((n) => n + 1);

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
            Period end
            <input
              type="month"
              value={monthValue}
              onChange={(e) => setMonthValue(e.target.value)}
              className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-300 text-brand-500 focus:ring-brand-300"
            />
            Show all bank accounts
          </label>
        </div>
        {!loading && data && (
          <span className="text-xs text-ink-500">
            {items.length} account{items.length === 1 ? "" : "s"} · Total{" "}
            <span className="font-semibold text-ink-800">
              {money(data.total_value)}
            </span>
          </span>
        )}
      </div>

      <p className="text-[11px] text-ink-400">
        Enter each bank account’s closing balance from the paper/PDF statement,
        then compare it to the Xero trial-balance figure for the chosen period
        end. Add notes, attach the statement, and mark reconciled accounts OK.
      </p>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm text-ink-500 shadow-card">
          Loading…
        </p>
      ) : error ? null : items.length === 0 ? (
        <p className="rounded-2xl border border-ink-100 bg-white px-5 py-10 text-center text-sm italic text-ink-400 shadow-card">
          {showAll
            ? "No bank accounts found."
            : "All bank accounts reconciled ✓"}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <AccountCard
              key={`${it.account_code}-${it.period_end}`}
              companyId={companyId}
              item={it}
              periodEnd={periodEnd}
              showAll={showAll}
              users={users}
              onWrite={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
};
