import { ConnectXeroButton } from "@/features/integrations/ConnectXeroButton";

export const ReconnectBanner = ({
  orgName,
  plural = false,
}: {
  orgName?: string;
  plural?: boolean;
}) => (
  <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-4 border-rose-500 bg-rose-50 px-4 py-3 ring-1 ring-rose-100">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
        <path d="M12 9v5M12 17.5v.1" />
      </svg>
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-rose-800">
        {plural
          ? "One or more orgs are disconnected from Xero"
          : `${orgName ?? "This organisation"} is disconnected from Xero`}
      </p>
      <p className="text-xs text-rose-600">
        Xero connection expired — data is no longer syncing. Tap “Connect to
        Xero” to re-authorise and resume.
      </p>
    </div>
    <ConnectXeroButton size="sm" />
  </div>
);
