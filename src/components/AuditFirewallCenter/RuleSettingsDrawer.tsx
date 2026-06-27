import { useEffect, useState } from "react";

import {
  AuditConfigGroup,
  fetchAuditConfig,
  saveAuditConfig,
} from "../../services/audit.service";

interface RuleSettingsDrawerProps {
  companyId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export const RuleSettingsDrawer = ({
  companyId,
  onClose,
  onSaved,
}: RuleSettingsDrawerProps) => {
  const [groups, setGroups] = useState<AuditConfigGroup[]>([]);
  const [disabledRules, setDisabledRules] = useState<Set<string>>(new Set());
  const [ignoreBefore, setIgnoreBefore] = useState<string>("");
  const [totalChecks, setTotalChecks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAuditConfig(companyId).then((cfg) => {
      if (!active || !cfg) return;
      setGroups(cfg.groups);
      setDisabledRules(new Set(cfg.disabled_rules));
      setIgnoreBefore(cfg.ignore_before ?? "");
      setTotalChecks(cfg.total_checks);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [companyId]);

  const enabledCount =
    groups
      .flatMap((g) => g.rules)
      .filter((r) => !disabledRules.has(r.key)).length;

  const toggle = (key: string) => {
    setDirty(true);
    setDisabledRules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: AuditConfigGroup, enable: boolean) => {
    setDirty(true);
    setDisabledRules((prev) => {
      const next = new Set(prev);
      for (const r of group.rules) {
        if (enable) next.delete(r.key);
        else next.add(r.key);
      }
      return next;
    });
  };

  const toggleAll = (enable: boolean) => {
    setDirty(true);
    if (enable) {
      setDisabledRules(new Set());
    } else {
      setDisabledRules(
        new Set(groups.flatMap((g) => g.rules.map((r) => r.key))),
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const res = await saveAuditConfig(
      companyId,
      Array.from(disabledRules),
      ignoreBefore || null,
    );
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "Save failed");
      return;
    }
    setDirty(false);
    onSaved?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
        onClick={saving ? undefined : onClose}
      />

      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Audit configuration
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink-900">
              Active rules
            </h2>
            {!loading && (
              <p className="mt-0.5 text-xs text-ink-500">
                {enabledCount} of {totalChecks} checks will run.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 disabled:cursor-not-allowed"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-ink-500">Loading config…</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/40 px-6 py-2.5">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="text-[11px] font-semibold text-brand-700 hover:underline"
              >
                Enable all
              </button>
              <span className="text-ink-300">·</span>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="text-[11px] font-semibold text-ink-600 hover:underline"
              >
                Disable all
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* General settings */}
              <section className="mb-6">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  General
                </h3>
                <div className="mt-3 rounded-lg border border-ink-200 bg-white p-3.5">
                  <label
                    htmlFor="ignore-before"
                    className="block text-xs font-medium text-ink-800"
                  >
                    Ignore transactions before
                  </label>
                  <p className="text-[11px] text-ink-500">
                    Documents dated earlier are skipped by every check.
                  </p>
                  <input
                    id="ignore-before"
                    type="date"
                    value={ignoreBefore}
                    onChange={(e) => {
                      setIgnoreBefore(e.target.value);
                      setDirty(true);
                    }}
                    className="mt-2 w-full rounded-md border border-ink-300 bg-white px-2.5 py-1.5 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
              </section>

              {/* Rule groups — straight from the backend catalog */}
              {groups.map((group) => {
                const builtRules = group.rules.filter((r) => r.built);
                const unbuiltRules = group.rules.filter((r) => !r.built);
                const allBuiltEnabled = builtRules.length > 0 &&
                  builtRules.every((r) => !disabledRules.has(r.key));
                // Groups where every rule is unbuilt → collapse by default
                const allUnbuilt = builtRules.length === 0;

                return (
                  <section key={group.group} className="mb-5">
                    <header className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className={[
                          "text-[11px] font-semibold uppercase tracking-wider",
                          allUnbuilt ? "text-ink-300" : "text-ink-500",
                        ].join(" ")}>
                          {group.group}
                        </h3>
                        {allUnbuilt && (
                          <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                            Coming soon
                          </span>
                        )}
                      </div>
                      {!allUnbuilt && (
                        <button
                          type="button"
                          onClick={() => toggleGroup(group, !allBuiltEnabled)}
                          className="text-[10px] font-semibold uppercase tracking-wider text-brand-700 hover:underline"
                        >
                          {allBuiltEnabled ? "Disable group" : "Enable group"}
                        </button>
                      )}
                    </header>

                    <ul className="overflow-hidden rounded-lg border border-ink-200 bg-white">
                      {/* Built rules — full interactive */}
                      {builtRules.map((rule, i) => {
                        const isOn = !disabledRules.has(rule.key);
                        return (
                          <li
                            key={rule.key}
                            className={[
                              "flex items-center justify-between gap-3 px-3.5 py-2.5",
                              i > 0 || unbuiltRules.length > 0
                                ? "border-t border-ink-100"
                                : "",
                            ].join(" ")}
                          >
                            <p className={[
                              "truncate text-sm font-medium",
                              isOn ? "text-ink-900" : "text-ink-400",
                            ].join(" ")}>
                              {rule.label}
                            </p>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isOn}
                              onClick={() => toggle(rule.key)}
                              className={[
                                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                                isOn ? "bg-brand-500" : "bg-ink-200",
                              ].join(" ")}
                            >
                              <span
                                className={[
                                  "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                                  isOn ? "translate-x-[18px]" : "translate-x-0.5",
                                ].join(" ")}
                              />
                            </button>
                          </li>
                        );
                      })}

                      {/* Unbuilt rules — no toggle, visually recessed */}
                      {unbuiltRules.map((rule, i) => (
                        <li
                          key={rule.key}
                          className={[
                            "flex items-center justify-between gap-3 bg-ink-50/40 px-3.5 py-2.5",
                            i > 0 || builtRules.length > 0
                              ? "border-t border-ink-100"
                              : "",
                          ].join(" ")}
                        >
                          <p className="truncate text-sm text-ink-300">
                            {rule.label}
                          </p>
                          <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-400">
                            Soon
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>

            <footer className="flex flex-col gap-2 border-t border-ink-200 px-6 py-4">
              {error && (
                <p className="text-xs text-rose-600">{error}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
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
                  {saving ? "Saving…" : "Save settings"}
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
};

// Keep these helpers exported for any remaining callers.
export const getActiveRuleKeys = (_companyId: string): string[] => [];
export const getIgnoreBeforeDate = (_companyId: string): string => "";
export const saveRuleSettings = (_companyId: string, _settings: unknown) => {};
