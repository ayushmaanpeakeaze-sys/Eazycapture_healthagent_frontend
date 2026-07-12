import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";

import {
  login,
  requestRegisterOtp,
  verifyRegisterOtp,
} from "../../services/auth.service";

interface AuthSliderProps {
  onLoggedIn: () => void;
}

export const AuthSlider = ({ onLoggedIn }: AuthSliderProps) => {
  const [rightActive, setRightActive] = useState(false);

  return (
    <div className="ec-auth-stage">
      <style>{SLIDER_CSS}</style>

      <div className={`ec-auth ${rightActive ? "active" : ""}`}>
        <div className="ec-form-c ec-signup-c">
          <SignUpForm onLoggedIn={onLoggedIn} />
        </div>

        <div className="ec-form-c ec-signin-c">
          <SignInForm onLoggedIn={onLoggedIn} />
        </div>

        <div className="ec-overlay-c">
          <div className="ec-overlay">
            <div className="ec-overlay-panel ec-overlay-left">
              <Ambient />
              <PanelChips />
              <div className="relative z-10 flex flex-col items-center text-center">
                <Wordmark />
                <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white">
                  Welcome{" "}
                  <span className="font-display font-normal italic text-white/85">
                    back
                  </span>
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
                  Already have an account? Sign in to pick up your clients’
                  ledgers right where you left off.
                </p>
                <button
                  type="button"
                  onClick={() => setRightActive(false)}
                  className="ec-ghost-btn"
                >
                  Sign in
                </button>
              </div>
              <OverlayArt />
            </div>

            <div className="ec-overlay-panel ec-overlay-right">
              <Ambient />
              <PanelChips />
              <div className="relative z-10 flex flex-col items-center text-center">
                <Wordmark />
                <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-white">
                  Hello,{" "}
                  <span className="font-display font-normal italic text-white/85">
                    bookkeeper
                  </span>
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
                  New here? Create your workspace and see every client’s books
                  in one healthy, audited view.
                </p>
                <button
                  type="button"
                  onClick={() => setRightActive(true)}
                  className="ec-ghost-btn"
                >
                  Create account
                </button>
              </div>
              <OverlayArt />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SignInForm = ({ onLoggedIn }: { onLoggedIn: () => void }) => {
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
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onLoggedIn();
  };

  return (
    <form onSubmit={handleSubmit} className="ec-form">
      <AuditSticker />
      <div className="ec-form-inner">
        <h1 className="font-display text-4xl tracking-tight text-ink-900">
          Sign in
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Enter your credentials to continue.
        </p>

        <div className="mt-7 w-full space-y-3">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="you@firm.com"
            className="ec-input"
          />
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Password"
              className="ec-input pr-10"
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

        {error && <p className="ec-error">{error}</p>}

        <button type="submit" disabled={loading} className="ec-solid-btn mt-6">
          {loading && <Spinner />}
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-6 text-center text-xs">
          <a
            href="/team-login"
            className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          >
            Log in as a team member →
          </a>
        </p>
      </div>
    </form>
  );
};

const SignUpForm = ({ onLoggedIn }: { onLoggedIn: () => void }) => {
  const [step, setStep] = useState<"form" | "code">("form");
  const [name, setName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendOtp = async () => {
    setError(null);
    setNotice(null);
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const res = await requestRegisterOtp({
      email: email.trim(),
      password,
      firmName,
      fullName: name,
    });
    setLoading(false);
    if (!res.ok) {
      setError(
        res.status === 409
          ? "An account with this email already exists — sign in instead."
          : res.status === 422
            ? "Use a valid email and a password of 8+ characters."
            : "Couldn’t send the code. Please try again.",
      );
      return;
    }
    if (!res.emailSent) {
      setNotice("We couldn’t email the code — please try Resend in a moment.");
    }
    setCode("");
    setStep("code");
    setCooldown(30);
  };

  const verify = async () => {
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    const res = await verifyRegisterOtp(email.trim(), code);
    setLoading(false);
    if (!res.ok) {
      if (res.status === 429) {
        setError("Too many incorrect codes — start signup again.");
        setStep("form");
        setCode("");
        return;
      }
      setError(
        res.status === 400
          ? "Incorrect or expired code. Check your email or resend."
          : res.status === 409
            ? "This email was just registered — sign in instead."
            : "Couldn’t verify the code. Please try again.",
      );
      return;
    }
    onLoggedIn();
  };

  if (step === "code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
        className="ec-form"
      >
        <AuditSticker />
        <div className="ec-form-inner">
          <h1 className="font-display text-4xl tracking-tight text-ink-900">
            Check your email
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-ink-700">{email}</span>. It expires
            in 10 minutes.
          </p>

          {notice && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {notice}
            </p>
          )}

          <div className="mt-7 w-full">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              disabled={loading}
              placeholder="000000"
              className="ec-input text-center text-lg tracking-[0.5em]"
            />
          </div>

          {error && <p className="ec-error">{error}</p>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="ec-solid-btn mt-6"
          >
            {loading && <Spinner />}
            {loading ? "Verifying…" : "Verify & create account"}
          </button>

          <div className="mt-4 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setError(null);
                setCode("");
              }}
              className="font-medium text-ink-500 transition hover:text-ink-800"
            >
              Wrong email? Go back
            </button>
            <button
              type="button"
              onClick={() => {
                if (cooldown === 0 && !loading) sendOtp();
              }}
              disabled={cooldown > 0 || loading}
              className="font-semibold text-brand-600 transition hover:text-brand-700 disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sendOtp();
      }}
      className="ec-form"
    >
      <AuditSticker />
      <div className="ec-form-inner">
        <h1 className="font-display text-4xl tracking-tight text-ink-900">
          Create account
        </h1>
        <p className="mt-1.5 text-sm text-ink-500">
          Set up your practice workspace.
        </p>

        <div className="mt-7 w-full space-y-3">
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            placeholder="Full name"
            className="ec-input"
          />
          <input
            type="text"
            autoComplete="organization"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            disabled={loading}
            placeholder="Firm / company name (optional)"
            className="ec-input"
          />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            placeholder="you@firm.com"
            className="ec-input"
          />
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="Password (8+ characters)"
            className="ec-input"
          />
        </div>

        {error && <p className="ec-error">{error}</p>}

        <button type="submit" disabled={loading} className="ec-solid-btn mt-6">
          {loading && <Spinner />}
          {loading ? "Sending code…" : "Create account"}
        </button>
      </div>
    </form>
  );
};

const AuditSticker = () => (
  <div className="ec-sticker-hang" aria-hidden>
    <div className="ec-sticker-swing">
      <span className="ec-rope-cap" />
      <span className="ec-rope" />
      <div className="ec-sticker">
        <div className="ec-sticker-inner">
          <span className="ec-acc-top">Don&apos;t worry</span>
          <span className="ec-acc-banner">You can</span>
          <span className="ec-acc-big">Ac-count</span>
          <span className="ec-acc-small">on me</span>
          <svg
            className="ec-acc-calc"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#15151c"
            strokeWidth="1.5"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="5" y="2.5" width="14" height="19" rx="2.4" />
            <rect x="7.6" y="5" width="8.8" height="3.6" rx="0.8" />
            <circle cx="8.4" cy="12.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="12" cy="12.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="15.6" cy="12.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="8.4" cy="15.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="12" cy="15.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="15.6" cy="15.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="8.4" cy="18.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="12" cy="18.2" r="0.85" fill="#15151c" stroke="none" />
            <circle cx="15.6" cy="18.2" r="0.85" fill="#15151c" stroke="none" />
          </svg>
        </div>
      </div>
    </div>
  </div>
);

const OverlayArt = () => {
  const [ok, setOk] = useState(true);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = wrapRef.current;
        if (!el) return;
        el.style.setProperty(
          "--px",
          `${(e.clientX / window.innerWidth - 0.5) * 18}px`,
        );
        el.style.setProperty(
          "--py",
          `${(e.clientY / window.innerHeight - 0.5) * 12}px`,
        );
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  if (!ok) return null;
  return (
    <div ref={wrapRef} className="ec-overlay-art-wrap">
      <img
        src="/auth-illustration-white.png"
        alt=""
        aria-hidden
        onError={() => setOk(false)}
        className="ec-overlay-art"
      />
    </div>
  );
};

const Ambient = () => (
  <>
    <span
      aria-hidden
      className="pointer-events-none absolute -right-16 top-12 h-64 w-64 rounded-full bg-surface/10 blur-3xl"
    />
    <span
      aria-hidden
      className="pointer-events-none absolute -bottom-16 -left-10 h-72 w-72 rounded-full bg-surface/10 blur-3xl"
    />
  </>
);

const Wordmark = () => (
  <img
    src="/eazycapture-logo-white.png"
    alt="EazyCapture"
    className="h-7 w-auto"
  />
);

const DOCS = [
  { left: "9%", w: 46, dur: 18, delay: 0, rot: -8 },
  { left: "24%", w: 30, dur: 14, delay: 3.5, rot: 7 },
  { left: "41%", w: 60, dur: 21, delay: 1.2, rot: -4 },
  { left: "59%", w: 36, dur: 16, delay: 5, rot: 9 },
  { left: "75%", w: 50, dur: 19, delay: 2.2, rot: -7 },
  { left: "89%", w: 26, dur: 13, delay: 6.5, rot: 6 },
];

const Docs = () => (
  <div className="ec-docs" aria-hidden>
    {DOCS.map((d, i) => (
      <span
        key={i}
        className="ec-doc"
        style={
          {
            left: d.left,
            width: `${d.w}px`,
            height: `${Math.round(d.w * 1.32)}px`,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
            "--rot": `${d.rot}deg`,
          } as CSSProperties
        }
      />
    ))}
  </div>
);

const PanelChips = () => (
  <>
    <div className="ec-chip ec-chip-tl" aria-hidden>
      <HealthRing />
      <div className="text-left leading-tight">
        <div className="text-[13px] font-semibold text-white">92%</div>
        <div className="text-[9px] uppercase tracking-wide text-white/70">
          Ledger health
        </div>
      </div>
    </div>

    <div className="ec-chip ec-chip-tr" aria-hidden>
      <span className="ec-chip-badge">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <div className="text-left leading-tight">
        <div className="text-[13px] font-semibold text-white">1,284</div>
        <div className="text-[9px] uppercase tracking-wide text-white/70">
          Issues auto-flagged
        </div>
      </div>
    </div>
  </>
);

const HealthRing = () => (
  <svg width="27" height="27" viewBox="0 0 36 36" aria-hidden>
    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
    <circle
      cx="18"
      cy="18"
      r="15"
      fill="none"
      stroke="#ffffff"
      strokeWidth="4"
      strokeLinecap="round"
      strokeDasharray="94.25"
      strokeDashoffset="7.5"
      transform="rotate(-90 18 18)"
    />
  </svg>
);

const BrandMark = ({
  size = 24,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    viewBox="0 0 48 48"
    width={size}
    height={size}
    className={color === "white" ? "text-white" : "text-brand-700"}
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M17 6 H10 a4 4 0 0 0-4 4 V17" />
    <path d="M31 6 H38 a4 4 0 0 1 4 4 V17" />
    <path d="M17 42 H10 a4 4 0 0 1-4-4 V31" />
    <path d="M31 42 H38 a4 4 0 0 0 4-4 V31" />
    <path d="M11 24 C11 17, 19 17, 24 24 C29 31, 37 31, 37 24" strokeWidth={2.6} />
    <path d="M11 24 C11 31, 19 31, 24 24 C29 17, 37 17, 37 24" strokeWidth={2.6} />
    <path d="M13 24 H20" strokeWidth={2.6} />
  </svg>
);

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

const SLIDER_CSS = `
.ec-auth-stage {
  height: 100vh;
  width: 100%;
  background: rgb(var(--surface));
}
.ec-auth {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgb(var(--surface));
  overflow: hidden;
}
.ec-form-c {
  position: absolute;
  top: 0;
  height: 100%;
  width: 50%;
  background: linear-gradient(155deg, rgb(var(--surface)) 0%, rgb(var(--surface-2)) 100%);
  transition: all 0.6s ease-in-out;
}
.ec-signin-c { left: 0; z-index: 2; }
.ec-signup-c { left: 0; opacity: 0; z-index: 1; }
.ec-auth.active .ec-signin-c { transform: translateX(100%); }
.ec-auth.active .ec-signup-c {
  transform: translateX(100%);
  opacity: 1;
  z-index: 5;
  animation: ec-show 0.6s;
}
@keyframes ec-show {
  0%, 49.99% { opacity: 0; z-index: 1; }
  50%, 100%  { opacity: 1; z-index: 5; }
}
.ec-form {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  height: 100%;
  padding: 200px 24px 32px;
  overflow-y: auto;
}
.ec-form::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(460px 340px at 86% 6%, rgba(113,66,238,0.10), transparent 62%);
  pointer-events: none;
}
.ec-form-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 380px;
}
.ec-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgb(var(--ink-200));
  background: rgb(var(--surface-2));
  padding: 14px 16px;
  font-size: 15px;
  color: rgb(var(--ink-900));
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.ec-input::placeholder { color: rgb(var(--ink-400)); }
.ec-input:focus {
  outline: none;
  background: rgb(var(--surface));
  border-color: #7142ee;
  box-shadow: 0 0 0 3px rgba(113,66,238,0.18);
}
.ec-input:disabled { opacity: 0.6; }
.ec-solid-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #8b5cf6 0%, #7142ee 50%, #5b21c9 100%);
  box-shadow: 0 12px 28px -8px rgba(113,66,238,0.55);
  transition: transform 0.15s, filter 0.15s;
}
.ec-solid-btn:hover { filter: brightness(1.07); transform: translateY(-1px); }
.ec-solid-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
.ec-error {
  margin-top: 16px;
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgb(var(--rose-200));
  background: rgb(var(--rose-50));
  padding: 10px 14px;
  font-size: 13px;
  color: rgb(var(--rose-800));
}
.ec-overlay-c {
  position: absolute;
  top: 0;
  left: 50%;
  width: 50%;
  height: 100%;
  overflow: hidden;
  transition: transform 0.6s ease-in-out;
  z-index: 100;
}
.ec-auth.active .ec-overlay-c { transform: translateX(-100%); }
.ec-overlay {
  position: relative;
  left: -100%;
  height: 100%;
  width: 200%;
  transform: translateX(0);
  transition: transform 0.6s ease-in-out;
  color: #ffffff;
  background-color: #7d4ee0;
  background-image:
    radial-gradient(at 22% 16%, rgba(186,168,253,0.40) 0px, transparent 55%),
    radial-gradient(at 84% 88%, rgba(91,45,176,0.45) 0px, transparent 55%);
}
.ec-docs {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.ec-doc {
  position: absolute;
  bottom: -180px;
  border-radius: 5px;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 6px,
      rgba(255, 255, 255, 0.16) 6px,
      rgba(255, 255, 255, 0.16) 7px
    ),
    rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 8px 20px rgba(20, 8, 60, 0.18);
  animation-name: ec-doc-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
@keyframes ec-doc-rise {
  0%   { transform: translateY(0) rotate(var(--rot)); opacity: 0; }
  12%  { opacity: 0.5; }
  85%  { opacity: 0.4; }
  100% { transform: translateY(-122vh) rotate(var(--rot)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ec-doc { animation: none; display: none; }
}
.ec-auth.active .ec-overlay { transform: translateX(50%); }
.ec-overlay-panel {
  position: absolute;
  top: 0;
  height: 100%;
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 48px 30vh;
  overflow: hidden;
  transition: transform 0.6s ease-in-out;
}
.ec-overlay-left { transform: translateX(-20%); }
.ec-auth.active .ec-overlay-left { transform: translateX(0); }
.ec-overlay-right { right: 0; transform: translateX(0); }
.ec-auth.active .ec-overlay-right { transform: translateX(20%); }
.ec-overlay-art-wrap {
  position: absolute;
  bottom: 5vh;
  left: 50%;
  width: 88%;
  display: flex;
  justify-content: center;
  transform: translateX(-50%) translate3d(var(--px, 0px), var(--py, 0px), 0);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
  z-index: 1;
}
.ec-overlay-art {
  width: auto;
  max-height: 40vh;
  max-width: 100%;
  object-fit: contain;
  opacity: 0.9;
  transform-origin: 50% 100%;
  animation: ec-art-float 7s ease-in-out infinite;
  will-change: transform;
}
@keyframes ec-art-float {
  0%   { transform: translateY(0) rotate(0deg); }
  28%  { transform: translateY(-7px) rotate(-1deg); }
  52%  { transform: translateY(-11px) rotate(0.5deg); }
  76%  { transform: translateY(-4px) rotate(1.1deg); }
  100% { transform: translateY(0) rotate(0deg); }
}
@media (prefers-reduced-motion: reduce) {
  .ec-overlay-art { animation: none; }
  .ec-overlay-art-wrap { transition: none; }
}
.ec-ghost-btn {
  margin-top: 28px;
  border-radius: 999px;
  border: 1.5px solid rgba(255,255,255,0.85);
  background: transparent;
  padding: 13px 48px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #ffffff;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}
.ec-ghost-btn:hover {
  background: rgba(255,255,255,0.14);
  transform: translateY(-1px);
}
.ec-chip {
  position: absolute;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 13px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.22);
  box-shadow: 0 16px 36px -14px rgba(20,8,60,0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.ec-chip-tl { top: 9%; left: 7%; animation: ec-float 3.4s ease-in-out infinite; }
.ec-chip-tr { top: 16%; right: 6%; animation: ec-float 4s ease-in-out infinite 0.5s; }
.ec-chip-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 27px;
  width: 27px;
  border-radius: 9px;
  background: rgba(16,185,129,0.92);
  color: #ffffff;
}
@keyframes ec-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-11px); }
}
@media (max-width: 900px) {
  .ec-chip { display: none; }
}
.ec-sticker-hang {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
.ec-sticker-swing {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: top center;
  will-change: transform;
  animation:
    ec-swing-in 0.9s ease-in-out 1.85s both,
    ec-swing 1.8s ease-in-out 2.75s infinite alternate;
}
.ec-rope {
  display: block;
  width: 5px;
  height: 42px;
  border-radius: 3px;
  background: repeating-linear-gradient(
    -52deg,
    #c79a5e 0px,
    #e6caa0 2px,
    #b07f3e 4px,
    #875b2a 5.5px,
    #c79a5e 7px
  );
  box-shadow:
    inset -1.2px 0 1px rgba(0, 0, 0, 0.28),
    inset 1.2px 0 1px rgba(255, 255, 255, 0.22);
  transform-origin: top center;
  will-change: transform;
  animation: ec-rope-grow 0.9s ease-out 0.25s both;
}
.ec-rope-cap {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 10px;
  height: 10px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(circle at 38% 30%, #9aa1ad, #4b515d 68%, #2f343d);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  z-index: 2;
  animation: ec-cap-in 0.3s ease-out 0.2s both;
}
.ec-sticker {
  padding: 4px;
  margin-top: -2px;
  transform: perspective(720px) rotateX(8deg) rotateY(-12deg);
  animation: ec-sticker-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) 1.05s both;
}
.ec-sticker-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: transparent;
  transform: scale(0.82);
  transform-origin: top center;
  font-family: "Arial Black", "Archivo Black", system-ui, sans-serif;
  font-weight: 900;
  text-transform: uppercase;
  line-height: 0.95;
  color: #16161d;
  text-shadow:
    0 1px 0 #d8d8df,
    0 2px 0 #c6c6cf,
    0 3px 2px rgba(20, 8, 60, 0.13);
}
.dark .ec-sticker-inner {
  color: #eef0f6;
  text-shadow:
    0 1px 0 #3b3b46,
    0 2px 0 #2a2a33,
    0 3px 3px rgba(0, 0, 0, 0.5);
}
.ec-acc-top {
  font-size: 17px;
  letter-spacing: 0.2px;
}
.ec-acc-big {
  font-size: 20px;
  letter-spacing: 0.2px;
  margin-top: 1px;
}
.ec-acc-small {
  font-size: 14px;
}
.ec-acc-banner {
  margin: 3px 0;
  padding: 3px 20px;
  font-size: 14px;
  letter-spacing: 0.3px;
  color: #ffffff;
  background: linear-gradient(#7d8af6 0%, #4450dd 55%, #3540bf 100%);
  clip-path: polygon(0 0, 100% 0, 91% 50%, 100% 100%, 0 100%, 9% 50%);
  box-shadow:
    inset 0 1.5px 0 rgba(255, 255, 255, 0.4),
    inset 0 0 0 2px #2c2ca0;
  filter: drop-shadow(0 3px 3px rgba(20, 8, 60, 0.4));
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);
}
.ec-acc-calc {
  width: 28px;
  height: 28px;
  margin-top: 5px;
  filter: drop-shadow(0 2px 2px rgba(20, 8, 60, 0.3));
}
@keyframes ec-rope-grow {
  0%   { transform: scaleY(0); }
  100% { transform: scaleY(1); }
}
@keyframes ec-cap-in {
  0%   { opacity: 0; transform: translateX(-50%) scale(0.4); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}
@keyframes ec-sticker-in {
  0% {
    opacity: 0;
    transform: translateX(-190px) rotate(-15deg) perspective(720px) rotateX(8deg) rotateY(-12deg);
  }
  55% { opacity: 1; }
  100% {
    opacity: 1;
    transform: translateX(0) rotate(0deg) perspective(720px) rotateX(8deg) rotateY(-12deg);
  }
}
@keyframes ec-swing-in {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(-7deg); }
}
@keyframes ec-swing {
  0%   { transform: rotate(-7deg); }
  100% { transform: rotate(7deg); }
}
@media (max-width: 900px) {
  .ec-sticker-hang { display: none; }
}
`;
