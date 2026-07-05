import { Component, ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.3l8-14Z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-ink-800">Something went wrong</p>
        <p className="max-w-sm text-xs text-ink-500">
          This view hit an unexpected error. Try reloading — the rest of the app
          is unaffected.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 rounded-lg bg-brand-gradient px-4 py-2 text-xs font-semibold text-white shadow-brand transition hover:brightness-110"
        >
          Reload
        </button>
      </div>
    );
  }
}
