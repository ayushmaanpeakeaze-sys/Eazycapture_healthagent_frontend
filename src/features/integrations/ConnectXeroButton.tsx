import { useRef, useState } from "react";
import Nango, { ConnectUIEvent } from "@nangohq/frontend";

import { fetchCompaniesPanorama } from "@/services/audit.service";
import {
  createNangoConnectSession,
  syncNangoConnections,
} from "@/services/integrations.service";

type State = "idle" | "opening" | "importing" | "done" | "error" | "unavailable";

// The backend webhook (auth.creation) creates orgs and runs the first sync; the browser `connect` event is
// only a UI signal, so we poll companies-panorama until the org(s) land. Reconnect uses the same flow.
export const ConnectXeroButton = ({
  size = "sm",
}: {
  /** "sm" = compact nav pill (default); "lg" = prominent onboarding CTA. */
  size?: "sm" | "lg";
}) => {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const connectedRef = useRef(false);
  const uiRef = useRef<ReturnType<Nango["openConnectUI"]> | null>(null);

  const pollForOrgs = async (): Promise<boolean> => {
    for (let i = 0; i < 20; i++) {
      // ~60s max
      const data = await fetchCompaniesPanorama(30);
      if (data.results?.length) return true;
      await new Promise((r) => setTimeout(r, 3000));
    }
    return false;
  };

  const handleConnect = async () => {
    setError(null);
    setState("opening");
    connectedRef.current = false;

    const res = await createNangoConnectSession("xero");
    if (!res.ok) {
      // 401 already triggers a reload-to-login via the axios interceptor.
      setState(res.status === 503 ? "unavailable" : "error");
      setError(res.error);
      return;
    }

    const nango = new Nango();
    const ui = nango.openConnectUI({
      onEvent: (event: ConnectUIEvent) => {
        if (event.type === "connect") {
          // OAuth done; close the modal, ask the backend to create + sync the
          // org(s) from the new connection, then poll until they land.
          connectedRef.current = true;
          uiRef.current?.close();
          setState("importing");
          (async () => {
            await syncNangoConnections();
            await pollForOrgs();
            setState("done");
            window.location.assign("/clients");
          })();
        } else if (event.type === "close") {
          // User backed out before authorising → nothing was created.
          if (!connectedRef.current) setState("idle");
        } else if (event.type === "error") {
          setState("error");
          setError("Xero authorisation failed. Please try again.");
        }
      },
    });
    uiRef.current = ui;
    ui.setSessionToken(res.session.token);
  };

  if (state === "unavailable") {
    return (
      <span
        title={error ?? "Xero connection isn’t configured on this deployment."}
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1.5 text-[11px] font-semibold text-ink-400 ring-1 ring-ink-200"
      >
        <XeroGlyph className="h-3.5 w-3.5 opacity-50" />
        Xero unavailable
      </span>
    );
  }

  const busy = state === "opening" || state === "importing";
  const label =
    state === "importing"
      ? "Importing your Xero data…"
      : state === "opening"
        ? "Connecting…"
        : state === "done"
          ? "Connected"
          : state === "error"
            ? "Try again"
            : "Connect to Xero";

  const lg = size === "lg";
  const iconCls = lg ? "h-5 w-5" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={busy}
      title={state === "error" ? (error ?? undefined) : "Connect a Xero organisation"}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold text-white shadow-sm transition disabled:opacity-70",
        lg ? "px-6 py-3 text-base shadow-brand" : "px-3 py-1.5 text-[11px]",
        state === "error"
          ? "bg-rose-600 hover:bg-rose-700"
          : "bg-[#13B5EA] hover:brightness-110",
      ].join(" ")}
    >
      {busy ? (
        <svg className={`${iconCls} animate-spin`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
          <circle cx="12" cy="12" r="9" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
        </svg>
      ) : (
        <XeroGlyph className={iconCls} />
      )}
      {label}
    </button>
  );
};

const XeroGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.18" />
    <path
      d="M9.1 12 6.9 9.8a.9.9 0 1 1 1.27-1.27L10.37 10.73l2.2-2.2a.9.9 0 0 1 1.27 1.27L11.64 12l2.2 2.2a.9.9 0 1 1-1.27 1.27l-2.2-2.2-2.2 2.2A.9.9 0 0 1 6.9 14.2L9.1 12Z"
      fill="#fff"
    />
  </svg>
);
