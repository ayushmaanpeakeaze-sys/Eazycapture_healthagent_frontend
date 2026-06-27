import { useEffect, useState } from "react";

import {
  disableUser,
  enableUser,
  inviteUser,
  listUsers,
  removeUser,
  resendInvite,
} from "../../services/auth.service";
import { fetchCompaniesPanorama } from "../../services/audit.service";
import { PanoramaClient } from "../../services/audit.service";
import { TeamUser } from "../../types/auth.types";

export const TeamView = () => {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [companies, setCompanies] = useState<PanoramaClient[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeLink, setNoticeLink] = useState<string | null>(null);
  const [noticeCopied, setNoticeCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingUsers(true);
    listUsers().then((u) => {
      if (!active) return;
      setUsers(u);
      setLoadingUsers(false);
    });
    fetchCompaniesPanorama(30).then((d) => {
      if (!active) return;
      setCompanies(d.results ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleDisable = async (userId: string) => {
    setBusyId(userId);
    setActionError(null);
    const res = await disableUser(userId);
    setBusyId(null);
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "disabled" } : u)),
      );
    } else {
      setActionError(res.error ?? "Could not disable user.");
    }
  };

  const handleEnable = async (userId: string) => {
    setBusyId(userId);
    setActionError(null);
    const res = await enableUser(userId);
    setBusyId(null);
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "active" } : u)),
      );
    } else {
      setActionError(res.error ?? "Could not enable user.");
    }
  };

  const handleRemove = async (userId: string, email: string) => {
    if (
      !window.confirm(
        `Remove ${email}? This deletes their account and all access. This can't be undone.`,
      )
    ) {
      return;
    }
    setBusyId(userId);
    setActionError(null);
    const res = await removeUser(userId);
    setBusyId(null);
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } else {
      setActionError(res.error ?? "Could not remove user.");
    }
  };

  const handleResend = async (userId: string, email: string) => {
    setBusyId(userId);
    setActionError(null);
    setNotice(null);
    setNoticeLink(null);
    setNoticeCopied(false);
    const res = await resendInvite(userId);
    setBusyId(null);
    if (res.ok) {
      const sent = res.data.email_sent;
      const channel = res.data.email_channel;
      setNotice(
        sent === false
          ? `Invite re-created, but email failed: ${res.data.email_error ?? "unknown error"}. Copy the link below to share it manually.`
          : channel === "console"
            ? `Invite re-created — email delivery isn't configured (logged to console). Copy the link below to share it.`
            : `Invite re-sent to ${email}.`,
      );
      // Fresh copy-link (prefer backend's accept_url) for manual sharing.
      setNoticeLink(
        res.data.accept_url ||
          `${window.location.origin}/accept-invite?token=${res.data.invite_token}`,
      );
    } else {
      setActionError(res.error ?? "Could not resend invite.");
    }
  };

  const copyNoticeLink = async () => {
    if (!noticeLink) return;
    try {
      await navigator.clipboard.writeText(noticeLink);
      setNoticeCopied(true);
      setTimeout(() => setNoticeCopied(false), 1500);
    } catch {
      /* clipboard blocked — link is still visible to copy manually */
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Team
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage who has access and which clients they can see.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6M22 11h-6" />
          </svg>
          Invite member
        </button>
      </header>

      {showInvite && (
        <InviteForm
          companies={companies}
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            listUsers().then(setUsers);
          }}
        />
      )}

      {actionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">
          {actionError}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          <p>{notice}</p>
          {noticeLink && (
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-emerald-200 bg-white px-2 py-1 font-mono text-[11px] text-ink-700">
                {noticeLink}
              </code>
              <button
                type="button"
                onClick={copyNoticeLink}
                className="shrink-0 rounded-md border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                {noticeCopied ? "Copied ✓" : "Copy link"}
              </button>
            </div>
          )}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-ink-50 text-[10px] uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Member</th>
              <th className="px-4 py-3 text-left font-semibold">Role</th>
              <th className="px-4 py-3 text-left font-semibold">Access</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {loadingUsers ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-500">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-ink-500">
                  No team members yet. Invite someone above.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="transition hover:bg-ink-50/50">
                  <td className="px-5 py-3.5 font-medium text-ink-900">
                    <div className="flex items-center gap-2">
                      <span>{u.email}</span>
                      {(u.email_status === "bounced" ||
                        u.email_status === "complained") && (
                        <span
                          title={
                            u.email_status === "bounced"
                              ? "Invite email bounced — the address looks wrong. Fix it and resend."
                              : "Invite email was marked as spam. Resend or share the link manually."
                          }
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200"
                        >
                          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                          </svg>
                          {u.email_status === "bounced" ? "Bounced" : "Spam"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                      u.role === "admin"
                        ? "bg-brand-50 text-brand-700 ring-brand-200"
                        : "bg-ink-100 text-ink-700 ring-ink-200",
                    ].join(" ")}>
                      {u.role === "admin" ? "Admin" : "Member"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-ink-600">
                    {u.access_mode === "all" || u.assigned_company_ids.length === 0
                      ? "All clients"
                      : `${u.assigned_company_ids.length} client${u.assigned_company_ids.length === 1 ? "" : "s"}`}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={[
                      "inline-flex items-center gap-1 text-[11px] font-medium",
                      u.status === "active" ? "text-emerald-700"
                        : u.status === "invited" ? "text-amber-700"
                        : "text-ink-400",
                    ].join(" ")}>
                      <span className={[
                        "h-1.5 w-1.5 rounded-full",
                        u.status === "active" ? "bg-emerald-500"
                          : u.status === "invited" ? "bg-amber-500"
                          : "bg-ink-300",
                      ].join(" ")} />
                      {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {u.role === "admin" ? (
                      <span className="text-[11px] text-ink-300">Owner</span>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        {/* active → Disable only (must disable before removing) */}
                        {u.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleDisable(u.id)}
                            disabled={busyId === u.id}
                            className="text-[11px] font-medium text-amber-600 hover:underline disabled:opacity-40"
                          >
                            Disable
                          </button>
                        )}
                        {/* disabled → Enable + Remove */}
                        {u.status === "disabled" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEnable(u.id)}
                              disabled={busyId === u.id}
                              className="text-[11px] font-medium text-emerald-600 hover:underline disabled:opacity-40"
                            >
                              Enable
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(u.id, u.email)}
                              disabled={busyId === u.id}
                              className="text-[11px] font-medium text-rose-600 hover:underline disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </>
                        )}
                        {/* invited → Resend invite + Remove */}
                        {u.status === "invited" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResend(u.id, u.email)}
                              disabled={busyId === u.id}
                              className="text-[11px] font-medium text-brand-600 hover:underline disabled:opacity-40"
                            >
                              Resend invite
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(u.id, u.email)}
                              disabled={busyId === u.id}
                              className="text-[11px] font-medium text-rose-600 hover:underline disabled:opacity-40"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};

// ── InviteForm ───────────────────────────────────────────────────────────────

const InviteForm = ({
  companies,
  onClose,
  onInvited,
}: {
  companies: PanoramaClient[];
  onClose: () => void;
  onInvited: () => void;
}) => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailChannel, setEmailChannel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleCompany = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (mode === "selected" && selectedIds.size === 0) {
      setError("Select at least one client.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await inviteUser({
      email: email.trim(),
      full_name: fullName.trim() || undefined,
      access_mode: mode,
      company_ids: mode === "selected" ? Array.from(selectedIds) : [],
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Prefer the backend's ready-made link (matches the emailed one); fall back
    // to building it from the current origin (safer in local dev).
    const link =
      res.data.accept_url ||
      `${window.location.origin}/accept-invite?token=${res.data.invite_token}`;
    setInviteLink(link);
    setEmailSent(res.data.email_sent ?? null);
    setEmailError(res.data.email_error ?? null);
    setEmailChannel(res.data.email_channel ?? null);
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-900">Invite team member</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!inviteLink ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@firm.com"
                className="mt-1 block w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Full name <span className="text-ink-400">(optional)</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="mt-1 block w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Client access
            </label>
            <div className="mt-2 flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
                <input
                  type="radio"
                  name="access_mode"
                  value="all"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                  className="h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-200"
                />
                All companies
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
                <input
                  type="radio"
                  name="access_mode"
                  value="selected"
                  checked={mode === "selected"}
                  onChange={() => setMode("selected")}
                  className="h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-200"
                />
                Selected companies
              </label>
            </div>

            {mode === "selected" && (
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {companies.length === 0 ? (
                  <p className="text-xs italic text-ink-400">No companies loaded.</p>
                ) : (
                  companies.map((c) => (
                    <label
                      key={c.company_id}
                      className={[
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition",
                        selectedIds.has(c.company_id)
                          ? "border-brand-300 bg-brand-50 text-brand-800"
                          : "border-ink-200 bg-white text-ink-700 hover:border-brand-200",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.company_id)}
                        onChange={() => toggleCompany(c.company_id)}
                        className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-200"
                      />
                      {c.name}
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-brand transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <circle cx="12" cy="12" r="9" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
              </svg>
            )}
            {loading ? "Sending…" : "Send invite"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {emailSent === true && emailChannel === "console" ? (
            <p className="text-sm font-medium text-amber-800">
              ℹ️ Invite created, but email delivery isn't configured (logged to
              console). Share the link below.
            </p>
          ) : emailSent === true ? (
            <p className="text-sm font-medium text-emerald-800">
              ✅ Invite emailed to <strong>{email}</strong>.
            </p>
          ) : emailSent === false ? (
            <p className="text-sm font-medium text-amber-800">
              ⚠️ Invite created, but the email failed
              {emailError ? `: ${emailError}` : ""}. It's still valid — share
              the link below or hit Resend later.
            </p>
          ) : (
            <p className="text-sm font-medium text-emerald-800">
              ✅ Invite created for <strong>{email}</strong>.
            </p>
          )}
          <p className="text-xs text-ink-500">
            Share this link — it's single-use and never expires until accepted.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border border-ink-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-ink-800">
              {inviteLink}
            </code>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={onInvited}
            className="text-xs font-medium text-ink-500 hover:text-ink-800 hover:underline"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};
