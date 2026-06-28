import { useRef, useState } from "react";
import Nango, { ConnectUIEvent } from "@nangohq/frontend";

import { fetchCompaniesPanorama } from "@/services/audit.service";
import { createNangoConnectSession } from "@/services/integrations.service";

type State = "idle" | "opening" | "importing" | "done" | "error" | "unavailable";

// Nango's hosted Connect modal handles the Xero login + org picker. The backend
// webhook (auth.creation) does the real work — creates a Company per org, runs
// the initial sync + first audit. The browser `connect` event is just our UI
// signal, so after it we poll companies-panorama until the org(s) land, then
// reload into the clients view. Reconnect (expired token) uses this same flow.
export const ConnectXeroButton = () => {
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
          // OAuth done — backend is now creating orgs + syncing. Close the
          // modal so our own "importing" state is visible, then poll.
          connectedRef.current = true;
          uiRef.current?.close();
          setState("importing");
          pollForOrgs().then(() => {
            setState("done");
            // Reflect the new org(s) — reload into the clients panorama.
            window.location.assign("/clients");
          });
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

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={busy}
      title={state === "error" ? (error ?? undefined) : "Connect a Xero organisation"}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition disabled:opacity-70",
        state === "error"
          ? "bg-rose-600 hover:bg-rose-700"
          : "bg-[#13B5EA] hover:brightness-110",
      ].join(" ")}
    >
      {busy ? (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
          <circle cx="12" cy="12" r="9" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
        </svg>
      ) : (
        <XeroGlyph className="h-3.5 w-3.5" />
      )}
      {label}
    </button>
  );
};

// Simple Xero-style disc mark (brand blue is applied by the button background).
const XeroGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.18" />
    <path
      d="M9.1 12 6.9 9.8a.9.9 0 1 1 1.27-1.27L10.37 10.73l2.2-2.2a.9.9 0 0 1 1.27 1.27L11.64 12l2.2 2.2a.9.9 0 1 1-1.27 1.27l-2.2-2.2-2.2 2.2A.9.9 0 0 1 6.9 14.2L9.1 12Z"
      fill="#fff"
    />
  </svg>
);
