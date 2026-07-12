import { ReactNode, useState } from "react";

const PANEL_BG: React.CSSProperties = {
  backgroundColor: "#7d4ee0",
  backgroundImage:
    "radial-gradient(at 22% 16%, rgba(186,168,253,0.40) 0px, transparent 55%), radial-gradient(at 84% 88%, rgba(91,45,176,0.45) 0px, transparent 55%)",
};

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  sticker?: ReactNode;
}

export const AuthShell = ({
  title,
  subtitle,
  children,
  sticker,
}: AuthShellProps) => {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      <div
        className="relative hidden w-1/2 flex-col overflow-hidden p-10 text-white lg:flex"
        style={PANEL_BG}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-surface/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-surface/10 blur-3xl"
        />

        <img
          src="/eazycapture-logo-white.png"
          alt="EazyCapture"
          className="relative h-7 w-auto self-start"
        />

        <div className="relative mt-12 max-w-sm">
          <h2 className="font-display text-3xl leading-tight tracking-tight">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75">
            {subtitle}
          </p>
        </div>

        <div className="relative mt-auto flex items-end justify-center">
          {imgOk ? (
            <img
              src="/auth-illustration-white.png"
              alt=""
              onError={() => setImgOk(false)}
              className="w-auto max-h-[46vh] object-contain opacity-90"
            />
          ) : (
            <AuditArt />
          )}
        </div>
      </div>

      <div className="relative flex w-full items-start justify-center overflow-y-auto px-6 pb-10 pt-[200px] lg:w-1/2">
        {sticker}
        <div className="w-full max-w-sm">
          <img
            src="/eazycapture-logo.png"
            alt="EazyCapture"
            className="mb-6 h-6 w-auto lg:hidden dark:hidden"
          />
          <img
            src="/eazycapture-logo-white.png"
            alt="EazyCapture"
            className="mb-6 hidden h-6 w-auto dark:max-lg:block"
          />
          {children}
        </div>
      </div>
    </div>
  );
};

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

const AuditArt = () => (
  <svg
    viewBox="0 0 360 280"
    className="w-full max-w-md"
    fill="none"
    aria-hidden
  >
    <ellipse cx="180" cy="250" rx="150" ry="18" fill="rgba(255,255,255,0.08)" />

    <g transform="rotate(-6 120 140)">
      <rect x="48" y="70" width="150" height="190" rx="12" fill="rgba(255,255,255,0.12)" />
      <rect x="48" y="70" width="150" height="190" rx="12" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
    </g>

    <rect x="96" y="48" width="168" height="210" rx="14" fill="#ffffff" />
    <rect x="96" y="48" width="168" height="210" rx="14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
    <rect x="118" y="74" width="74" height="10" rx="5" fill="#7142ee" />
    {[110, 132, 154, 176].map((y) => (
      <g key={y}>
        <rect x="118" y={y} width="92" height="7" rx="3.5" fill="#e6dcff" />
        <rect x="222" y={y} width="24" height="7" rx="3.5" fill="#cdb8ff" />
      </g>
    ))}
    <rect x="118" y="200" width="60" height="9" rx="4.5" fill="#c4b5fd" />
    <rect x="206" y="198" width="40" height="13" rx="6" fill="#7142ee" />

    <circle cx="250" cy="206" r="34" fill="#10b981" />
    <circle cx="250" cy="206" r="34" stroke="rgba(255,255,255,0.5)" strokeWidth="3" />
    <path
      d="M236 206 l9 9 l19 -19"
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    <g transform="translate(60 150)">
      <circle cx="34" cy="34" r="30" fill="rgba(255,255,255,0.16)" />
      <circle cx="34" cy="34" r="30" stroke="#ffffff" strokeWidth="5" fill="none" />
      <line
        x1="56"
        y1="56"
        x2="80"
        y2="80"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <rect x="22" y="38" width="6" height="10" rx="2" fill="#ffffff" />
      <rect x="31" y="30" width="6" height="18" rx="2" fill="#ffffff" />
      <rect x="40" y="24" width="6" height="24" rx="2" fill="#ffffff" />
    </g>
  </svg>
);
