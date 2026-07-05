import { FormEvent, useState } from "react";

import { authStorage, login } from "../../services/auth.service";
import { AccountingSticker } from "./AccountingSticker";
import { AuthShell } from "./AuthShell";

interface TeamLoginPageProps {
  onLoggedIn: () => void;
}

export const TeamLoginPage = ({ onLoggedIn }: TeamLoginPageProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await login(email.trim(), password);
    if (!res.ok) {
      setLoading(false);
      setError(res.error);
      return;
    }
    if (res.data.role !== "team_member") {
      authStorage.clear();
      setLoading(false);
      setError(
        "This is the team-member login. If you're a practice admin, sign in on the main page.",
      );
      return;
    }
    setLoading(false);
    onLoggedIn();
  };

  return (
    <AuthShell
      title="Welcome back to your workspace"
      subtitle="Sign in to review the clients your practice has assigned to you — every ledger, audited and triaged in one place."
      sticker={<AccountingSticker />}
    >
      <a
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 transition hover:border-brand-300 hover:text-brand-700"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to main sign-in
      </a>

      <h1 className="font-display text-3xl tracking-tight text-ink-900">
        Team member sign in
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        Use the email your practice admin invited you with.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="tl-email" className="block text-xs font-medium text-ink-700">
            Email
          </label>
          <input
            id="tl-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="you@firm.com"
            className="mt-1 block w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
          />
        </div>

        <div>
          <label htmlFor="tl-password" className="block text-xs font-medium text-ink-700">
            Password
          </label>
          <div className="relative mt-1">
            <input
              id="tl-password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
              className="block w-full rounded-lg border border-ink-300 bg-white py-2.5 pl-3 pr-10 text-sm text-ink-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Spinner />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-500">
        First time here? Open the{" "}
        <span className="font-medium text-ink-700">invite link</span> from your
        email to set a password.
      </p>
      <p className="mt-2 text-center text-[11px] text-ink-400">
        Practice admin?{" "}
        <a href="/" className="font-medium text-brand-600 hover:underline">
          Sign in here
        </a>
      </p>
    </AuthShell>
  );
};

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a18.94 18.94 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M2 2l20 20" />
    <path d="M9.88 9.88A3 3 0 1 0 14.12 14.12" />
  </svg>
);

const Spinner = () => (
  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
    <circle cx="12" cy="12" r="9" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
  </svg>
);
