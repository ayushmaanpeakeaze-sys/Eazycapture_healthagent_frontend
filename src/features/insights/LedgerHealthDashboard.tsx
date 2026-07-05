import { useEffect, useMemo, useState } from "react";

import {
  dispatchHistoricalAudit,
  fetchHealthStats,
  fetchHistoricalAuditStatus,
  fetchLedgerHealthSummary,
  fetchTrappedInvoices,
} from "../../services/audit.service";
import { useDataSynced } from "../../hooks/useDataSynced";
import { fetchHealthCheckResults } from "../../services/document.service";
import {
  HealthStatsResponse,
  LedgerHealthSummary,
  Severity,
} from "../../types/audit.types";

type SeverityCounts = Record<Severity, number>;

const ZERO_SEV: SeverityCounts = { critical: 0, high: 0, medium: 0 };

const SeverityLegendRow = ({
  label,
  count,
  total,
  dotCls,
}: {
  label: string;
  count: number;
  total: number;
  dotCls: string;
}) => {
  if (count === 0) return null;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <li className="flex items-center justify-between gap-2 text-[11px]">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
        <span className="font-medium text-ink-700">{label}</span>
      </span>
      <span className="tabular-nums text-ink-500">
        <span className="font-semibold text-ink-800">{count}</span>
        <span className="ml-1 text-ink-400">· {pct}%</span>
      </span>
    </li>
  );
};

const SeverityDonut = ({
  counts,
  score,
}: {
  counts: SeverityCounts;
  score: number | null;
}) => {
  const r = 36;
  const c = 2 * Math.PI * r;
  const total = counts.critical + counts.high + counts.medium;
  const hasScore = score !== null;
  const pct = hasScore ? Math.max(0, Math.min(100, score)) : 0;

  const segments = [
    { color: "stroke-rose-500", count: counts.critical, key: "critical" },
    { color: "stroke-orange-500", count: counts.high, key: "high" },
    { color: "stroke-sky-500", count: counts.medium, key: "medium" },
  ];

  let cumOffset = 0;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(15,23,42,0.07)"
          strokeWidth="8"
        />
        {total > 0 &&
          segments.map((seg) => {
            if (seg.count === 0) return null;
            const length = (seg.count / total) * c;
            const offset = -cumOffset;
            cumOffset += length;
            return (
              <circle
                key={seg.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                className={seg.color}
                strokeWidth="8"
                strokeLinecap="butt"
                strokeDasharray={`${length} ${c}`}
                strokeDashoffset={offset}
                style={{
                  transition:
                    "stroke-dasharray 700ms cubic-bezier(.2,.8,.2,1)",
                }}
              />
            );
          })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-display text-2xl font-semibold tabular-nums ${
            hasScore ? "text-ink-900" : "text-ink-400"
          }`}
        >
          {hasScore ? `${pct}%` : "—"}
        </span>
      </div>
    </div>
  );
};

const HealthGaugeRing = ({ score }: { score: number | null }) => {
  const r = 70;
  const c = 2 * Math.PI * r;
  const hasScore = score !== null;
  const pct = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  const offset = c - (pct / 100) * c;
  const tone = !hasScore
    ? "stroke-white/30"
    : pct >= 80
      ? "stroke-emerald-400"
      : pct >= 50
        ? "stroke-amber-300"
        : "stroke-rose-300";
  return (
    <div className="relative h-44 w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="12"
        />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          className={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        {hasScore ? (
          <>
            <span className="font-display text-6xl leading-none tracking-tight">
              {pct}
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              out of 100
            </span>
          </>
        ) : (
          <>
            <span className="font-display text-4xl leading-none tracking-tight text-white/85">
              —
            </span>
            <span className="mt-2 max-w-[7rem] text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              No data yet
            </span>
          </>
        )}
      </div>
    </div>
  );
};

type LaneTone = "ghost" | "warning" | "success";

const LANE_TONE: Record<LaneTone, string> = {
  ghost: "bg-white/70",
  warning: "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.7)]",
  success: "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.7)]",
};

const ArrowGlyph = ({ flip }: { flip?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-3.5 w-3.5 text-white/70 ${flip ? "scale-x-[-1]" : ""}`}
    fill="none"
    stroke="currentColor"
    strokeWidth={2.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

interface LaneStage {
  label: string;
  value: number | string;
  tone: LaneTone;
  sub?: string;
}

const FlowLane = ({
  direction,
  title,
  caption,
  stages,
}: {
  direction: "outbound" | "inbound";
  title: string;
  caption: string;
  stages: LaneStage[];
}) => (
  <div className="relative overflow-hidden rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-sm">
    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/75">
      {direction === "outbound" ? <ArrowGlyph /> : <ArrowGlyph flip />}
      <span>{title}</span>
    </div>
    <p className="mt-1 text-[11px] text-white/55">{caption}</p>
    <div className="mt-4 grid grid-cols-3 gap-2">
      {stages.map((s, i) => (
        <div key={i} className="text-white">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${LANE_TONE[s.tone]}`} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
              {s.label}
            </span>
          </div>
          <p className="mt-1 font-display text-3xl leading-none tracking-tight">
            {s.value}
          </p>
          {s.sub && (
            <p className="mt-0.5 text-[10px] text-white/55">{s.sub}</p>
          )}
        </div>
      ))}
    </div>
  </div>
);

const fmtAuditTime = (iso: string | null): string => {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const fmtRelative = (iso: string | null): string => {
  if (!iso) return "no audit yet";
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

const scoreGrade = (
  score: number | null,
): { label: string; tone: "good" | "warn" | "bad" | "muted" } => {
  if (score === null) return { label: "No data yet", tone: "muted" };
  if (score >= 90) return { label: "Excellent", tone: "good" };
  if (score >= 70) return { label: "Healthy", tone: "good" };
  if (score >= 50) return { label: "Needs attention", tone: "warn" };
  return { label: "At risk", tone: "bad" };
};

const TrendDot = ({ tone }: { tone: "good" | "warn" | "bad" | "muted" }) => {
  const cls = {
    good: "bg-emerald-500",
    warn: "bg-amber-500",
    bad: "bg-rose-500",
    muted: "bg-ink-400",
  }[tone];
  return (
    <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} />
  );
};

const MiniGauge = ({ score }: { score: number | null }) => {
  const hasScore = score !== null;
  const pct = hasScore ? Math.max(0, Math.min(100, score)) : 0;
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const tone = !hasScore
    ? "stroke-ink-300"
    : pct >= 80
      ? "stroke-emerald-500"
      : pct >= 50
        ? "stroke-amber-400"
        : "stroke-rose-500";
  return (
    <div className="relative h-24 w-24">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(15,23,42,0.08)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          className={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)",
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`font-display text-2xl font-semibold tabular-nums ${
            hasScore ? "text-ink-900" : "text-ink-400"
          }`}
        >
          {hasScore ? pct : "—"}
        </span>
      </div>
    </div>
  );
};

const SplitBar = ({
  blocked,
  passed,
}: {
  blocked: number;
  passed: number;
}) => {
  const total = Math.max(1, blocked + passed);
  const blockPct = (blocked / total) * 100;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink-100">
      {blockPct > 0 && (
        <div
          className="h-full bg-rose-500 transition-all duration-700"
          style={{ width: `${blockPct}%` }}
        />
      )}
      {blockPct < 100 && (
        <div
          className="h-full bg-emerald-500 transition-all duration-700"
          style={{ width: `${100 - blockPct}%` }}
        />
      )}
    </div>
  );
};

export const LedgerHealthDashboard = ({
  companyId,
}: {
  companyId: string;
}) => {
  const [summary, setSummary] = useState<LedgerHealthSummary | null>(null);
  const [stats, setStats] = useState<HealthStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [reauditing, setReauditing] = useState<boolean>(false);
  const [auditStage, setAuditStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityCounts, setSeverityCounts] =
    useState<SeverityCounts>(ZERO_SEV);
  const [prePublish, setPrePublish] = useState({ blocked: 0, passed: 0 });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, statsData] = await Promise.all([
        fetchLedgerHealthSummary(companyId),
        fetchHealthStats(companyId),
      ]);
      setSummary(data);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load summary");
      setSummary(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
    try {
      const [pre, prev] = await Promise.all([
        fetchHealthCheckResults({
          company_id: companyId,
          kind: "pre_ledger",
          limit: 200,
        }),
        fetchHealthCheckResults({
          company_id: companyId,
          kind: "preview",
          limit: 200,
        }),
      ]);
      const tally = (
        rows: { status: string }[],
      ): { blocked: number; passed: number } => {
        let blocked = 0;
        let passed = 0;
        for (const r of rows) {
          if (r.status === "blocked") blocked += 1;
          else if (r.status === "passed") passed += 1;
        }
        return { blocked, passed };
      };
      const a = tally(pre.results ?? []);
      const b = tally(prev.results ?? []);
      setPrePublish({
        blocked: a.blocked + b.blocked,
        passed: a.passed + b.passed,
      });
    } catch {
      setPrePublish({ blocked: 0, passed: 0 });
    }
  };

  const loadSeverity = async () => {
    try {
      const data = await fetchTrappedInvoices({
        company_id: companyId,
        limit: 200,
      });
      if ("error" in data) return;
      const next: SeverityCounts = { critical: 0, high: 0, medium: 0 };
      for (const r of data.results ?? []) {
        for (const f of r.result?.flagged ?? []) {
          if (f.severity in next) next[f.severity] += 1;
        }
      }
      setSeverityCounts(next);
    } catch {
      setSeverityCounts(ZERO_SEV);
    }
  };

  useEffect(() => {
    loadSeverity();
  }, [companyId]);

  useDataSynced(companyId, () => {
    load();
    loadSeverity();
  });

  const refreshOverview = async () => {
    setReauditing(true);
    setAuditStage("Starting re-audit…");
    setError(null);
    try {
      const res = await dispatchHistoricalAudit(companyId, { scope: "full" });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetchHistoricalAuditStatus(res.batch_id);
        if ("error" in st) continue;
        if (st.stage_label) setAuditStage(st.stage_label);
        if (st.status === "completed") break;
        if (st.status === "failed") {
          setError(st.error ?? "Re-audit failed");
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-audit failed");
    } finally {
      setAuditStage(null);
      setReauditing(false);
      await Promise.all([load(), loadSeverity()]);
    }
  };

  const severityTotal = useMemo(
    () =>
      severityCounts.critical +
      severityCounts.high +
      severityCounts.medium,
    [severityCounts],
  );

  const auditedDocs =
    stats?.audited_documents ?? summary?.post_audited_total ?? null;
  const docIssues =
    stats?.open_document_issues ?? summary?.trapped_count ?? null;
  const contactIssues = stats?.open_contact_issues ?? null;
  const auditedContacts = stats?.audited_contacts ?? null;
  const totalIssues =
    stats?.open_issues ??
    (docIssues !== null || contactIssues !== null
      ? (docIssues ?? 0) + (contactIssues ?? 0)
      : null);
  const totalAudited =
    auditedDocs !== null || auditedContacts !== null
      ? (auditedDocs ?? 0) + (auditedContacts ?? 0)
      : null;
  const topIssuesShownSum =
    summary?.top_issues.reduce((acc, i) => acc + i.count, 0) ?? 0;
  const topIssuesTotal = totalIssues ?? topIssuesShownSum;
  const topIssuesRemainder = Math.max(0, topIssuesTotal - topIssuesShownSum);

  useEffect(() => {
    load();
  }, [companyId]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          {summary && (
            <p className="text-xs text-ink-500">
              Last audit · {fmtAuditTime(summary.last_audit_at)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={refreshOverview}
          disabled={loading || reauditing}
          title="Re-audit already-synced data and refresh every KPI"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {(loading || reauditing) && (
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
          {reauditing
            ? (auditStage ?? "Re-auditing…")
            : loading
              ? "Loading…"
              : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-semibold">Could not load summary</p>
          <p className="mt-0.5 text-xs">{error}</p>
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-brand-gradient px-8 py-7 shadow-brand">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_50%)]"
        />
        <div className="relative">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                Bookkeeping health
              </p>
              <h2 className="mt-2 font-display text-4xl leading-tight tracking-tight text-white">
                Two-way check across your books
              </h2>
              <p className="mt-1.5 max-w-md text-sm text-white/75">
                Documents going to your ledger get reviewed before they post.
                What&apos;s already in the ledger is swept for issues. Same
                engine, both directions.
              </p>
            </div>
            <HealthGaugeRing score={summary?.health_score ?? null} />
          </div>

          <div className="relative mt-7 grid grid-cols-1 gap-3 text-white md:grid-cols-2">
            <FlowLane
              direction="outbound"
              title="EazyCapture → your ledger"
              caption="Reviewed before publish"
              stages={[
                {
                  label: "Reviewed",
                  value: prePublish.blocked + prePublish.passed,
                  tone: "ghost",
                },
                {
                  label: "Blocked",
                  value: prePublish.blocked,
                  tone: "warning",
                },
                {
                  label: "Cleared",
                  value: prePublish.passed,
                  tone: "success",
                },
              ]}
            />
            <FlowLane
              direction="inbound"
              title="Ledger sweep"
              caption="Audited after they're in"
              stages={[
                {
                  label: "Audited",
                  value: totalAudited ?? auditedDocs ?? "—",
                  tone: "ghost",
                  sub:
                    auditedContacts && auditedContacts > 0
                      ? `${auditedDocs ?? 0} docs · ${auditedContacts} contacts`
                      : undefined,
                },
                {
                  label: "Docs flagged",
                  value: docIssues ?? "—",
                  tone: "warning",
                  sub:
                    auditedDocs && auditedDocs > 0 ? `of ${auditedDocs}` : undefined,
                },
                {
                  label: "Contacts flagged",
                  value: contactIssues ?? "—",
                  tone: "warning",
                  sub:
                    auditedContacts && auditedContacts > 0
                      ? `of ${auditedContacts}`
                      : undefined,
                },
              ]}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rose-100/70 blur-2xl"
          />
          <div className="relative flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Flagged in ledger
            </p>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
              inbound
            </span>
          </div>
          <p className="relative mt-2 font-display text-5xl leading-none tracking-tight text-ink-900">
            {totalIssues ?? "—"}
          </p>
          <p className="relative mt-1 text-xs text-ink-500">
            {totalIssues !== null
              ? "issues to fix across documents + contacts"
              : "issues flagged in your books"}
          </p>
          <div className="relative mt-3 space-y-1.5">
            {docIssues !== null && (
              <p className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                {auditedDocs && auditedDocs > 0
                  ? `${docIssues} of ${auditedDocs} documents flagged`
                  : `${docIssues} documents flagged`}
              </p>
            )}
            {contactIssues !== null && (
              <p className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                {auditedContacts && auditedContacts > 0
                  ? `${contactIssues} of ${auditedContacts} contacts flagged`
                  : `${contactIssues} contacts flagged`}
              </p>
            )}
          </div>
          <div className="relative mt-5 flex items-center justify-between border-t border-ink-100 pt-3 text-[11px]">
            <span className="text-ink-500">Last audit</span>
            <span className="font-medium text-ink-700">
              {summary ? fmtRelative(summary.last_audit_at) : "—"}
            </span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-100/60 blur-2xl"
          />
          <div className="relative flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Pre-publish gate
            </p>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
              outbound
            </span>
          </div>
          <div className="relative mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600">
                Blocked
              </p>
              <p className="mt-1 font-display text-3xl leading-none tabular-nums text-ink-900">
                {prePublish.blocked}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                Cleared
              </p>
              <p className="mt-1 font-display text-3xl leading-none tabular-nums text-ink-900">
                {prePublish.passed}
              </p>
            </div>
          </div>
          <div className="relative mt-4">
            <SplitBar
              blocked={prePublish.blocked}
              passed={prePublish.passed}
            />
            <p className="mt-2 text-[11px] text-ink-500">
              {prePublish.blocked + prePublish.passed} document
              {prePublish.blocked + prePublish.passed === 1 ? "" : "s"} reviewed
              at publish
            </p>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-2xl border border-ink-200 bg-white p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-emerald-100/60 blur-2xl"
          />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                Health score
              </p>
              <p className="mt-0.5 text-[10px] text-ink-400">
                {docIssues !== null && contactIssues !== null
                  ? `${docIssues} doc + ${contactIssues} contact issues`
                  : "documents + contacts"}
              </p>
            </div>
            {summary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-700 ring-1 ring-ink-200">
                <TrendDot tone={scoreGrade(summary.health_score).tone} />
                {scoreGrade(summary.health_score).label}
              </span>
            )}
          </div>
          <div className="relative mt-3 flex items-center gap-4">
            <SeverityDonut
              counts={severityCounts}
              score={summary?.health_score ?? null}
            />
            <div className="min-w-0 flex-1">
              {summary && summary.health_score === null ? (
                <>
                  <p className="text-sm font-semibold text-ink-800">
                    No data yet
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-600">
                    Run an audit on the Checks tab to compute a score.
                  </p>
                </>
              ) : severityTotal === 0 ? (
                <p className="text-xs text-ink-500">
                  {summary
                    ? summary.post_audited_total > 0
                      ? `${summary.post_audited_total} audited · 0 flagged`
                      : "Awaiting data"
                    : "Awaiting data"}
                </p>
              ) : (
                <ul className="space-y-1">
                  <SeverityLegendRow
                    label="Critical"
                    count={severityCounts.critical}
                    total={severityTotal}
                    dotCls="bg-rose-500"
                  />
                  <SeverityLegendRow
                    label="High"
                    count={severityCounts.high}
                    total={severityTotal}
                    dotCls="bg-orange-500"
                  />
                  <SeverityLegendRow
                    label="Medium"
                    count={severityCounts.medium}
                    total={severityTotal}
                    dotCls="bg-sky-500"
                  />
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card">
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">
              Top issues this period
            </h3>
            <p className="text-xs text-ink-500">
              Most frequent findings across your latest audits.
            </p>
          </div>
          {summary && summary.top_issues.length > 0 && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              {topIssuesTotal} total
            </span>
          )}
        </header>

        {!summary || summary.top_issues.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-ink-700">
              {summary ? "No issues in this window" : "Awaiting summary data"}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              {summary
                ? "Books look clean."
                : "Select an org above to load data."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {summary.top_issues.map((issue, i) => {
              const sharePct = Math.round(
                (issue.count / Math.max(1, topIssuesTotal)) * 100,
              );
              const max = summary.top_issues[0]?.count ?? 1;
              const widthPct = Math.max(6, (issue.count / max) * 100);
              const label =
                issue.sample_msg ??
                issue.message ??
                issue.issue_type ??
                "—";
              return (
                <li
                  key={`${label}-${i}`}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-400">
                    {i + 1}.
                  </span>
                  <span className="inline-flex h-6 min-w-[2rem] shrink-0 items-center justify-center rounded-md bg-brand-50 px-1.5 text-xs font-semibold tabular-nums text-brand-700">
                    {issue.count}×
                  </span>
                  <div className="min-w-0 flex-1">
                    {issue.issue_type && (
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        {issue.issue_type.replace(/_/g, " ")}
                      </p>
                    )}
                    <p className="truncate text-sm text-ink-800">{label}</p>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-ink-500">
                    {sharePct}%
                  </span>
                </li>
              );
            })}
            {topIssuesRemainder > 0 && (
              <li className="flex items-center gap-4 px-5 py-3 text-xs text-ink-500">
                <span className="w-5 shrink-0" />
                <span className="inline-flex h-6 min-w-[2rem] shrink-0 items-center justify-center rounded-md bg-ink-100 px-1.5 font-semibold tabular-nums text-ink-600">
                  {topIssuesRemainder}×
                </span>
                <span className="min-w-0 flex-1">
                  more issues across smaller categories (not in the top list)
                </span>
                <span className="shrink-0 tabular-nums">
                  {Math.round((topIssuesRemainder / Math.max(1, topIssuesTotal)) * 100)}%
                </span>
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
};
