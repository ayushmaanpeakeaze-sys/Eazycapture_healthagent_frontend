import { ConnectXeroButton } from "./ConnectXeroButton";
import { DisconnectedOrgs } from "./DisconnectedOrgs";

// Empty state shown when the firm has no active orgs: a Connect-to-Xero CTA, plus a Disconnected section for returning users.
export const XeroOnboarding = ({
  reloadKey = 0,
  onChanged,
}: {
  reloadKey?: number;
  onChanged?: () => void;
}) => (
  <div className="space-y-5">
    <div className="rounded-2xl border border-ink-100 bg-white px-6 py-14 text-center shadow-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#13B5EA]/10 text-[#13B5EA]">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M3 10h18" />
        </svg>
      </div>
      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
        Welcome to EazyCapture
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-500">
        Connect your first Xero organisation to start auditing. We’ll import the
        ledger, run the first health check, and surface everything that needs
        attention.
      </p>
      <div className="mt-6 flex justify-center">
        <ConnectXeroButton size="lg" />
      </div>
      <p className="mt-3 text-[11px] text-ink-400">
        You’ll log in to Xero and pick which organisation(s) to link.
      </p>
    </div>

    <DisconnectedOrgs reloadKey={reloadKey} onChanged={onChanged} defaultOpen />
  </div>
);
