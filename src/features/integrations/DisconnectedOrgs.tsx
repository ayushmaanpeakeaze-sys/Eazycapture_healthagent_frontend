import { useEffect, useState } from "react";

import {
  DisconnectedCompany,
  fetchDisconnectedCompanies,
  reconnectCompany,
} from "@/services/audit.service";

export const DisconnectedOrgs = ({
  reloadKey = 0,
  onChanged,
  defaultOpen = false,
}: {
  reloadKey?: number;
  onChanged?: () => void;
  defaultOpen?: boolean;
}) => {
  const [orgs, setOrgs] = useState<DisconnectedCompany[]>([]);
  const [open, setOpen] = useState(defaultOpen);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDisconnectedCompanies().then((list) => {
      if (active) setOrgs(list);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const onReconnect = async (company: DisconnectedCompany) => {
    setReconnecting(company.company_id);
    setError(null);
    const res = await reconnectCompany(company.company_id);
    setReconnecting(null);
    if (res.ok) {
      setOrgs((prev) => prev.filter((o) => o.company_id !== company.company_id));
      onChanged?.();
    } else {
      setError(res.error ?? "Reconnect failed.");
    }
  };

  if (orgs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-ink-100 bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-700">
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 text-ink-400 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
          Disconnected
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-500">
            {orgs.length}
          </span>
        </span>
        <span className="text-[11px] text-ink-400">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-ink-100">
          {error && (
            <p className="mx-5 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
              {error}
            </p>
          )}
          <ul className="divide-y divide-ink-50">
            {orgs.map((o) => {
              const busy = reconnecting === o.company_id;
              return (
                <li
                  key={o.company_id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-800">
                      {o.name}
                    </span>
                    <span className="text-[11px] text-ink-400">
                      Disconnected — data kept, reconnect anytime
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onReconnect(o)}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#13B5EA] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                  >
                    {busy ? "Reconnecting…" : "Reconnect"}
                    {!busy && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
