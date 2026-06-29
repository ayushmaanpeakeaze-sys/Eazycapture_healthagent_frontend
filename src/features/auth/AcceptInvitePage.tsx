import { FormEvent, useEffect, useState } from "react";

import { acceptInvite, fetchInviteInfo } from "../../services/auth.service";
import { InviteInfoResponse } from "../../types/auth.types";
import { useAuth } from "./AuthProvider";
import { AuthShell } from "./AuthShell";

interface AcceptInvitePageProps {
  inviteToken: string;
  onAccepted: () => void;
}

// Read the current user's email straight from the stored JWT payload — available
// synchronously on first render (unlike getMe(), which resolves async), so the
// "wrong account" gate decides reliably without a flash of the password form.
const currentEmailFromToken = (): string | null => {
  try {
    const t = window.localStorage.getItem("eazy.auth.token");
    if (!t) return null;
    const payload = JSON.parse(atob(t.split(".")[1] ?? ""));
    return typeof payload?.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
};

export const AcceptInvitePage = ({
  inviteToken,
  onAccepted,
}: AcceptInvitePageProps) => {
  const { me, isLoggedIn, logout } = useAuth();
  const [info, setInfo] = useState<InviteInfoResponse | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve the token → invited email before showing the password form.
  useEffect(() => {
    let active = true;
    fetchInviteInfo(inviteToken)
      .then((data) => {
        if (!active) return;
        setInfo(data);
        if (data?.full_name) setFullName(data.full_name);
      })
      .finally(() => {
        if (active) setInfoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [inviteToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await acceptInvite(inviteToken, password, fullName);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onAccepted();
  };

  const goToSignIn = () => {
    window.location.href = `${window.location.origin}/`;
  };

  // ── Loading: checking the invite ──────────────────────────────────────────
  if (infoLoading) {
    return (
      <AuthShell
        title="Get your books audit-ready"
        subtitle="Confirming your invite…"
      >
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <svg className="h-5 w-5 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <circle cx="12" cy="12" r="9" opacity="0.25" />
            <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
          </svg>
          Checking your invite link…
        </div>
      </AuthShell>
    );
  }

  // ── Invalid / expired / already-used invite ───────────────────────────────
  if (info && !info.valid) {
    return (
      <AuthShell
        title="This invite can't be used"
        subtitle="Invite links are single-use and tied to one email address."
      >
        <h1 className="font-display text-3xl tracking-tight text-ink-900">
          Invite unavailable
        </h1>
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {info.reason ??
            (info.expired
              ? "This invite link has expired."
              : "This invite link is invalid or has already been used.")}
        </div>
        <p className="mt-4 text-sm text-ink-500">
          If you already activated your account, just sign in. Otherwise, ask
          your practice admin to send a fresh invite.
        </p>
        <button
          type="button"
          onClick={goToSignIn}
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5"
        >
          Go to sign in
        </button>
      </AuthShell>
    );
  }

  // ── Valid invite (or info unavailable → graceful fallback to the form) ─────
  const invitedEmail = info?.email ?? null;
  const sessionEmail = me?.email ?? currentEmailFromToken();
  // Someone is signed in, but this invite is for a different address. Don't let
  // them silently claim it — make them sign out and accept AS the invitee.
  const wrongAccount =
    isLoggedIn &&
    !!sessionEmail &&
    !!invitedEmail &&
    sessionEmail.toLowerCase() !== invitedEmail.toLowerCase();

  if (wrongAccount) {
    return (
      <AuthShell
        title="Get your books audit-ready"
        subtitle="An invite belongs to one specific email address. Sign in as that person to claim it."
      >
        <h1 className="font-display text-3xl tracking-tight text-ink-900">
          This invite isn't for your account
        </h1>
        <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p>
            This invite is for <strong>{invitedEmail}</strong>, but you're
            signed in as <strong>{sessionEmail}</strong>.
          </p>
          <p className="text-xs text-amber-800">
            To accept it, sign out first — then set a password and sign in as{" "}
            {invitedEmail}.
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5"
        >
          Sign out &amp; accept as {invitedEmail}
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = `${window.location.origin}/`;
          }}
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-ink-200 bg-white py-2.5 text-sm font-medium text-ink-600 transition hover:bg-ink-50"
        >
          Stay signed in as {sessionEmail}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Get your books audit-ready"
      subtitle="You've been invited to EazyCapture. Set a password to activate your account and start reviewing your assigned clients."
    >
      <h1 className="font-display text-3xl tracking-tight text-ink-900">
        Set your password
      </h1>
      <p className="mt-1 text-sm text-ink-500">
        {invitedEmail
          ? "You're claiming the account below — just choose a password."
          : "Choose a password to activate your invite."}
      </p>

      {invitedEmail && (
        <div className="mt-5">
          <label className="block text-xs font-medium text-ink-700">
            Your account
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <span className="truncate text-sm font-medium text-ink-800">
              {invitedEmail}
            </span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400 ring-1 ring-ink-200">
              Invited
            </span>
          </div>
          <p className="mt-1 text-[11px] text-ink-400">
            This is fixed by your invite and can't be changed.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink-700">
            Full name <span className="text-ink-400">(optional)</span>
          </label>
          <input
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
            placeholder="Jane Doe"
            className="mt-1 block w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-700">
            New password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="At least 8 characters"
            className="mt-1 block w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-700">
            Confirm password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={loading}
            placeholder="Repeat password"
            className="mt-1 block w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
          />
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
          {loading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <circle cx="12" cy="12" r="9" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
            </svg>
          )}
          {loading ? "Activating…" : "Activate account"}
        </button>
      </form>
    </AuthShell>
  );
};
