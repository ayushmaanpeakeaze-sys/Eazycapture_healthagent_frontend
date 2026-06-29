import { useEffect, useMemo, useState } from "react";

import {
  AuditConfigResponse,
  dispatchHistoricalAudit,
  fetchAuditConfig,
  fetchSyncStatus,
  saveAuditConfigFull,
  SettingsField,
} from "../../services/audit.service";

const DONE = new Set(["completed", "complete", "done", "success", "finished"]);

// Checks that can run via the fast duplicates-only scope (~8s vs ~60s full).
const DUP_CHECKS = new Set([
  "duplicate_invoice",
  "duplicate_bill",
  "duplicate_credit_note",
]);

// Checks that reuse another's schema: duplicate settings are stored globally by
// field key and drive one engine, so duplicate bills share the invoice knobs.
// The master on/off toggle still targets the scoped check (see re-key below).
export const SETTINGS_ALIAS: Record<string, string> = {
  duplicate_bill: "duplicate_invoice",
  duplicate_credit_note: "duplicate_invoice",
};

// When a check borrows another's schema, swap the noun so the copy reads right.
const SETTINGS_NOUN: Record<string, { from: RegExp; to: string }[]> = {
  duplicate_bill: [
    { from: /\bInvoices\b/g, to: "Bills" },
    { from: /\binvoices\b/g, to: "bills" },
    { from: /\bInvoice\b/g, to: "Bill" },
    { from: /\binvoice\b/g, to: "bill" },
  ],
  duplicate_credit_note: [
    { from: /\bInvoices\b/g, to: "Credit notes" },
    { from: /\binvoices\b/g, to: "credit notes" },
    { from: /\bInvoice\b/g, to: "Credit note" },
    { from: /\binvoice\b/g, to: "credit note" },
  ],
};

const relabel = (
  scopeCheck: string | undefined,
  text: string | null | undefined,
): string | null | undefined => {
  if (!text || !scopeCheck) return text;
  const subs = SETTINGS_NOUN[scopeCheck];
  if (!subs) return text;
  return subs.reduce((acc, s) => acc.replace(s.from, s.to), text);
};

// Backend-driven check settings rendered from audit-config `settings_schema` +
// `groups`. Used as the Checks-landing drawer or scoped to one check.
export const CheckSettingsPanel = ({
  companyId,
  onClose,
  onSaved,
  scopeCheck,
}: {
  companyId: string;
  onClose: () => void;
  /** Called after a save (and after a re-run completes). */
  onSaved?: () => void;
  /** Limit the panel to one check key (e.g. "duplicate_invoice"). */
  scopeCheck?: string;
}) => {
  const [cfg, setCfg] = useState<AuditConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hydrate = (c: AuditConfigResponse) => {
    setCfg(c);
    setDisabled(new Set(c.disabled_rules ?? []));
    const v: Record<string, unknown> = {};
    const set = (c.settings ?? {}) as Record<string, unknown>;
    for (const e of c.settings_schema ?? [])
      for (const f of e.fields)
        v[f.key] = set[f.key] ?? f.default ?? "";
    setValues(v);
  };

  useEffect(() => {
    let active = true;
    fetchAuditConfig(companyId).then((c) => {
      if (!active || !c) {
        if (active) {
          setError("Couldn't load settings.");
          setLoading(false);
        }
        return;
      }
      hydrate(c);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId]);

  // Master on/off label per check (from groups → rule label).
  const ruleLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const g of cfg?.groups ?? [])
      for (const r of g.rules) m[r.key] = r.label;
    return m;
  }, [cfg]);

  // Resolve any alias, then re-key the entry to the scoped check so the on/off
  // toggle targets the right rule while the fields stay the shared engine knobs.
  const resolved = scopeCheck ? SETTINGS_ALIAS[scopeCheck] ?? scopeCheck : null;
  const schema = (cfg?.settings_schema ?? [])
    .filter((e) => !resolved || e.check === resolved)
    .map((e) => {
      // Borrowed schema → re-key to the scoped check and relabel its copy.
      if (!scopeCheck || e.check === scopeCheck) return e;
      return {
        ...e,
        check: scopeCheck,
        fields: e.fields.map((f) => ({
          ...f,
          label: relabel(scopeCheck, f.label) as string,
          help: relabel(scopeCheck, f.help),
        })),
      };
    });

  const changedSettings = () => {
    const out: Record<string, unknown> = {};
    const def = (cfg?.settings_defaults ?? {}) as Record<string, unknown>;
    for (const e of schema)
      for (const f of e.fields) {
        const d = def[f.key] ?? f.default;
        if (values[f.key] !== d) out[f.key] = values[f.key];
      }
    return out;
  };

  const persist = async (): Promise<boolean> => {
    setError(null);
    const r = await saveAuditConfigFull(companyId, {
      disabled_rules: [...disabled],
      settings: changedSettings(),
    });
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    hydrate(r.data);
    return true;
  };

  const onSave = async () => {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (ok) onSaved?.();
  };

  const onSaveAndRun = async () => {
    setSaving(true);
    const ok = await persist();
    setSaving(false);
    if (!ok) return;
    setRunning(true);
    setStatus("Starting audit…");
    // Duplicate checks use the fast duplicates-only scope; others run full.
    const scope =
      scopeCheck && DUP_CHECKS.has(scopeCheck) ? "duplicates" : undefined;
    const d = await dispatchHistoricalAudit(companyId, { scope });
    if ("error" in d) {
      setError(d.error);
      setRunning(false);
      return;
    }
    const batchId = d.batch_id;
    setStatus("Auditing your ledger…");
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const s = await fetchSyncStatus(companyId, batchId);
      const st = (s?.status ?? "").toString().toLowerCase();
      if (s?.stage_label) setStatus(String(s.stage_label));
      if (st && DONE.has(st)) break;
      if (st === "failed" || st === "error") {
        setError("Audit failed — try again.");
        setRunning(false);
        return;
      }
    }
    setRunning(false);
    setStatus(null);
    onSaved?.();
    onClose();
  };

  const busy = saving || running;
  // Duplicate checks only update after a re-run, so a bare "Save" is pointless.
  const isDup = !!scopeCheck && DUP_CHECKS.has(scopeCheck);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              Check settings
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-ink-900">
              {scopeCheck ? ruleLabel[scopeCheck] || "Settings" : "Configure checks"}
            </h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md p-1 text-ink-400 hover:bg-ink-50 hover:text-ink-700 disabled:opacity-40">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">Loading…</p>
        ) : running ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            <p className="text-sm font-medium text-ink-700">
              {status || "Running the check…"}
            </p>
            <p className="text-[11px] text-ink-400">
              Re-running the audit with your settings — nothing you’ve already
              done is undone.
            </p>
          </div>
        ) : schema.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-400">
            No configurable settings for this check yet.
          </p>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            {schema.map((entry) => {
              const off = disabled.has(entry.check);
              return (
                <section key={entry.check} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900">
                      {ruleLabel[entry.check] || entry.check}
                    </p>
                    <Switch
                      checked={!off}
                      onChange={(on) =>
                        setDisabled((p) => {
                          const n = new Set(p);
                          if (on) n.delete(entry.check);
                          else n.add(entry.check);
                          return n;
                        })
                      }
                    />
                  </div>
                  <div
                    className={[
                      "space-y-4",
                      off ? "pointer-events-none opacity-40" : "",
                    ].join(" ")}
                  >
                    {entry.fields.map((f) => (
                      <FieldControl
                        key={f.key}
                        field={f}
                        value={values[f.key]}
                        onChange={(v) =>
                          setValues((p) => ({ ...p, [f.key]: v }))
                        }
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}
          </div>
        )}

        <p className="border-t border-ink-100 px-5 pt-2.5 text-[11px] text-ink-400">
          Changes apply after you run the check — saving alone won’t update the
          cards.
        </p>
        <footer className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:text-ink-900 disabled:opacity-40">
            Cancel
          </button>
          {!isDup && (
            <button type="button" onClick={onSave} disabled={busy || loading} className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50">
              {saving && !running ? "Saving…" : "Save"}
            </button>
          )}
          <button type="button" onClick={onSaveAndRun} disabled={busy || loading} className="rounded-lg bg-brand-gradient px-4 py-1.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:opacity-60">
            {running ? "Running…" : "Save & run check"}
          </button>
        </footer>
      </div>
    </div>
  );
};

const FieldControl = ({
  field,
  value,
  onChange,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (v: unknown) => void;
}) => {
  if (field.type === "bool") {
    return (
      <div className="flex items-start justify-between gap-3">
        <Label field={field} />
        <Switch checked={!!value} onChange={onChange} />
      </div>
    );
  }
  if (field.type === "percent") {
    const pct = Math.round((Number(value) || 0) * 100);
    return (
      <div>
        <Label field={field} suffix={`— ${pct}%`} />
        <input
          type="range"
          min={(field.min ?? 0) * 100}
          max={(field.max ?? 1) * 100}
          step={(field.step ?? 0.05) * 100}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full accent-brand-600"
        />
      </div>
    );
  }
  if (field.type === "select") {
    const opts = field.options ?? [];
    return (
      <div>
        <Label field={field} />
        <select
          value={String(value ?? field.default ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
        >
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (field.type === "int" || field.type === "multiple") {
    return (
      <div>
        <Label field={field} />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={field.min ?? undefined}
            max={field.max ?? undefined}
            step={field.step ?? 1}
            value={Number(value) || 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {(field.unit || field.type === "multiple") && (
            <span className="text-sm text-ink-500">
              {field.type === "multiple" ? "×" : field.unit}
            </span>
          )}
        </div>
      </div>
    );
  }
  // amount / list / fallback → text input
  return (
    <div>
      <Label field={field} />
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      />
    </div>
  );
};

const Label = ({ field, suffix }: { field: SettingsField; suffix?: string }) => (
  <div className="mb-1">
    <p className="text-sm font-medium text-ink-800">
      {field.label}
      {suffix && <span className="ml-1 font-normal text-ink-400">{suffix}</span>}
    </p>
    {field.help && <p className="mt-0.5 text-[11px] text-ink-400">{field.help}</p>}
  </div>
);

const Switch = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={[
      "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition",
      checked ? "bg-brand-600" : "bg-ink-200",
    ].join(" ")}
  >
    <span
      className={[
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
        checked ? "left-[18px]" : "left-0.5",
      ].join(" ")}
    />
  </button>
);
