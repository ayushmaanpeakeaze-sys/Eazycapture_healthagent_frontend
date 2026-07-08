import { useEffect, useMemo, useState } from "react";

import {
  dispatchHistoricalAudit,
  downloadHealthReportCsv,
  fetchHealthStats,
  fetchHistoricalAuditStatus,
  fetchLedgerHealthSummary,
} from "../../services/audit.service";
import { fetchAiStatus } from "../../services/document.service";
import {
  AiStatusResponse,
  AuditSummary,
  HealthStatsResponse,
} from "../../types/audit.types";
import { BatchSummaryCard } from "@/features/batch/BatchSummaryCard";
import { ChecksDirectory } from "@/features/checks/ChecksDirectory";
import {
  getActiveRuleKeys,
  getIgnoreBeforeDate,
  RuleSettingsDrawer,
} from "@/features/checks/RuleSettingsDrawer";

type PeriodKey =
  | "all"
  | "current_month"
  | "previous_month"
  | "rolling_12"
  | "rolling_24"
  | "quarter"
  | "year"
  | "custom";

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);
const endOfQuarter = (d: Date) => {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3 + 3, 0);
};

const periodToRange = (
  key: PeriodKey,
  customStart: string,
  customEnd: string,
): { start: string | null; end: string | null } => {
  const today = new Date();
  switch (key) {
    case "all":
      return { start: null, end: null };
    case "current_month":
      return {
        start: isoDate(startOfMonth(today)),
        end: isoDate(endOfMonth(today)),
      };
    case "previous_month": {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        start: isoDate(startOfMonth(prev)),
        end: isoDate(endOfMonth(prev)),
      };
    }
    case "rolling_12": {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 12);
      return { start: isoDate(start), end: isoDate(today) };
    }
    case "rolling_24": {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 24);
      return { start: isoDate(start), end: isoDate(today) };
    }
    case "quarter": {
      const q = Math.floor(today.getMonth() / 3);
      const start = new Date(today.getFullYear(), q * 3, 1);
      return { start: isoDate(start), end: isoDate(endOfQuarter(today)) };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return { start: isoDate(start), end: isoDate(end) };
    }
    case "custom":
      return { start: customStart || null, end: customEnd || null };
  }
};

const fmtRelativeShort = (iso: string | null): string => {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

type AuditPhase =
  | "idle"
  | "in_progress"
  | "enriching"
  | "completed"
  | "failed";

const HistoricalAuditPanel = ({
  companyId,
  onComplete,
  onAiStatus,
}: {
  companyId: string;
  onComplete: () => void;
  onAiStatus: (status: AiStatusResponse | null) => void;
}) => {
  const [batchId, setBatchId] = useState<string | null>(null);
  const [phase, setPhase] = useState<AuditPhase>("idle");
  const [progress, setProgress] = useState<{
    total: number;
    trapped: number;
    newTrapped: number;
    stageLabel: string | null;
  }>({ total: 0, trapped: 0, newTrapped: 0, stageLabel: null });
  const [stats, setStats] = useState<HealthStatsResponse | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const onDownloadCsv = async () => {
    if (csvBusy) return;
    setCsvBusy(true);
    setCsvError(null);
    const res = await downloadHealthReportCsv(companyId);
    setCsvBusy(false);
    if (!res.ok) setCsvError(res.error ?? "Download failed");
  };

  useEffect(() => {
    let active = true;
    fetchLedgerHealthSummary(companyId)
      .then((s) => {
        if (!active || !s) return;
        setLastSyncAt(s.last_audit_at);
      })
      .catch(() => {
        if (active) setLastSyncAt(null);
      });
    return () => {
      active = false;
    };
  }, [companyId, phase]);

  const periodLabels = useMemo(() => {
    const today = new Date();
    const q = Math.floor(today.getMonth() / 3);
    const qEnd = new Date(today.getFullYear(), q * 3 + 3, 0);
    const yEnd = new Date(today.getFullYear(), 11, 31);
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    return {
      quarter: `Quarter ending ${fmt(qEnd)}`,
      year: `Year ending ${fmt(yEnd)}`,
    };
  }, []);
  const [error, setError] = useState<string | null>(null);

  const startAudit = async () => {
    setError(null);
    setPhase("in_progress");
    setProgress({ total: 0, trapped: 0, newTrapped: 0, stageLabel: null });
    setStats(null);
    setBatchId(null);
    const { start, end } = periodToRange(period, customStart, customEnd);
    const ignoreBefore = getIgnoreBeforeDate(companyId);
    const effectiveStart =
      ignoreBefore && (!start || ignoreBefore > start) ? ignoreBefore : start;
    const resp = await dispatchHistoricalAudit(companyId, {
      date_from: effectiveStart,
      date_to: end,
    });
    if ("error" in resp) {
      setError(resp.error);
      setPhase("failed");
      return;
    }
    setBatchId(resp.batch_id);
  };

  useEffect(() => {
    if (!batchId || phase !== "in_progress") return;
    const id = window.setInterval(async () => {
      const data = await fetchHistoricalAuditStatus(batchId);
      if (!("batch_id" in data)) {
        setError(data.error);
        setPhase("failed");
        return;
      }
      setProgress({
        total: data.total ?? 0,
        trapped: data.trapped ?? 0,
        newTrapped: data.new_trapped ?? 0,
        stageLabel: data.stage_label ?? null,
      });
      if (data.status === "completed" || data.status === "failed") {
        if (data.status === "failed") {
          setPhase("failed");
          if (data.error) setError(data.error);
        } else {
          setPhase("enriching");
          onComplete();
          fetchHealthStats(companyId).then((s) => s && setStats(s));
        }
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [batchId, phase, onComplete, companyId]);

  useEffect(() => {
    if (!batchId || phase !== "enriching") return;
    const startedAt = Date.now();
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await fetchAiStatus(batchId);
        onAiStatus(data);
        if (data.status === "complete" && data.ai_summary_ready) {
          setPhase("completed");
          return;
        }
      } catch {
      }
      if (Date.now() - startedAt > 60_000) {
        setPhase("completed");
        return;
      }
      window.setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [batchId, phase, onAiStatus]);

  const running = phase === "in_progress" || phase === "enriching";

  const docAudited = stats?.audited_documents ?? progress.total;
  const contactAudited = stats?.audited_contacts ?? null;
  const docFlagged = stats?.open_document_issues ?? progress.trapped;
  const contactFlagged = stats?.open_contact_issues ?? null;
  const totalFlagged =
    stats?.open_issues ??
    (contactFlagged !== null ? docFlagged + contactFlagged : progress.trapped);

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="period-select"
              className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500"
            >
              Period
            </label>
            <select
              id="period-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodKey)}
              disabled={running}
              className="mt-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="all">All transactions</option>
              <option value="current_month">Current month</option>
              <option value="previous_month">Previous month</option>
              <option value="rolling_12">Rolling 12 months</option>
              <option value="rolling_24">Rolling 24 months</option>
              <option value="quarter">{periodLabels.quarter}</option>
              <option value="year">{periodLabels.year}</option>
              <option value="custom">Custom date range…</option>
            </select>
          </div>

          {period === "custom" && (
            <>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  From
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  disabled={running}
                  className="mt-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  To
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  disabled={running}
                  className="mt-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-ink-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              <span>
                Last sync:{" "}
                <span className="font-medium text-ink-700">
                  {fmtRelativeShort(lastSyncAt)}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={onDownloadCsv}
              disabled={csvBusy}
              title="Download all check results as a CSV"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {csvBusy ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <circle cx="12" cy="12" r="9" opacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              )}
              {csvBusy ? "Preparing…" : "Download CSV"}
            </button>

            <button
              type="button"
              onClick={startAudit}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
            {running && (
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
            {phase === "enriching"
              ? "Enriching insights…"
              : running
                ? "Auditing…"
                : "Run Historical Ledger Audit"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 transition hover:bg-brand-50 hover:text-brand-700"
            title="Choose which checks the audit runs"
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8L4.2 7a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
            Rules
          </button>
          {csvError && (
            <span className="text-[11px] text-rose-600">{csvError}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span className="font-semibold">Audit failed:</span> {error}
        </div>
      )}

      {(running || phase === "completed") && (
        <div
          className={[
            "mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs",
            phase === "completed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-ink-200 bg-ink-50 text-ink-500",
          ].join(" ")}
        >
          {running ? (
            <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}

          {phase === "in_progress" ? (
            <span>
              Auditing ledger… <strong>{progress.total}</strong> document
              {progress.total === 1 ? "" : "s"} fetched
              {progress.trapped > 0 && (
                <>
                  , <strong>{progress.trapped}</strong> flagged
                </>
              )}
              <span className="text-ink-400"> · checking contacts too</span>
            </span>
          ) : (
            <>
              <span>
                {phase === "completed" ? "Audited " : "Audited "}
                <strong>{docAudited}</strong> docs
                {contactAudited !== null && (
                  <>
                    {" "}
                    + <strong>{contactAudited}</strong> contacts
                  </>
                )}
              </span>
              <span className="text-ink-300">·</span>
              <span>
                <strong>{docFlagged}</strong>
                {contactFlagged !== null && (
                  <>
                    {" "}
                    + <strong>{contactFlagged}</strong>
                  </>
                )}{" "}
                flagged (<strong>{totalFlagged}</strong> total)
              </span>
              {phase === "enriching" && (
                <span className="text-ink-400">· enriching insights with AI…</span>
              )}
              {progress.newTrapped > 0 && (
                <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
                  +{progress.newTrapped} new
                </span>
              )}
            </>
          )}
        </div>
      )}

      {settingsOpen && (
        <RuleSettingsDrawer
          companyId={companyId}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => setSettingsVersion((n) => n + 1)}
        />
      )}
    </section>
  );
};

export const BookkeepingChecksView = ({
  companyId,
}: {
  companyId: string;
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);

  useEffect(() => {
    setAiStatus(null);
  }, [companyId]);

  const auditSummary: AuditSummary | null = aiStatus?.audit_summary ?? null;
  const aiSummaryReady = aiStatus?.ai_summary_ready ?? false;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
          Bookkeeping Checks
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Inbound audit — pulls live data from your ledger and surfaces
          findings.
        </p>
      </header>

      <HistoricalAuditPanel
        companyId={companyId}
        onComplete={() => setRefreshKey((k) => k + 1)}
        onAiStatus={setAiStatus}
      />

      <BatchSummaryCard
        summary={auditSummary}
        loading={aiStatus !== null && !aiSummaryReady}
      />

      <ChecksDirectory companyId={companyId} refreshKey={refreshKey} />
    </div>
  );
};
