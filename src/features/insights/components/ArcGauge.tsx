import { Tone, toneStroke, toneText } from "../lib/format";

const Heart = ({ tone }: { tone: Tone }) => (
  <svg
    viewBox="0 0 24 24"
    className={["h-3.5 w-3.5", toneText[tone]].join(" ")}
    fill="currentColor"
    aria-hidden
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

export const ArcGauge = ({
  value,
  tone,
  center,
  label,
}: {
  value: number;
  tone: Tone;
  center: string;
  label: string;
}) => {
  const clamped = Math.max(0, Math.min(100, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  const track = 0.75 * c;
  const val = (clamped / 100) * track;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 110 110" className="h-full w-full">
        <g transform="rotate(135 55 55)">
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke="rgba(15,23,42,0.08)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${track} ${c}`}
          />
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke={toneStroke[tone]}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${val} ${c}`}
            style={{
              transition: "stroke-dasharray 800ms cubic-bezier(.2,.8,.2,1)",
            }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold leading-none tabular-nums text-ink-900">
          {center}
        </span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-ink-400">
          {label}
        </span>
        <span className="mt-1">
          <Heart tone={tone} />
        </span>
      </div>
    </div>
  );
};
