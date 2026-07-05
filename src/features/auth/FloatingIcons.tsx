import { CSSProperties, ReactNode } from "react";

const S = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ICONS: Record<string, ReactNode> = {
  calc: (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <rect x="8" y="5.5" width="8" height="3.5" rx="0.6" />
      <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" />
    </svg>
  ),
  pen: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" />
      <path d="M14 7l3 3" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h6M9 19h4" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M6 3h12v18l-2-1.3L14 21l-2-1.3L10 21l-2-1.3L6 21z" />
      <path d="M9 8h6M9 11.5h6M9 15h4" />
    </svg>
  ),
  percent: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M19 5L5 19" />
      <circle cx="7" cy="7" r="2.4" />
      <circle cx="17" cy="17" r="2.4" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 4v16h16" />
      <rect x="7" y="12" width="2.6" height="5" rx="0.5" />
      <rect x="11.7" y="8" width="2.6" height="9" rx="0.5" />
      <rect x="16.4" y="14" width="2.6" height="3" rx="0.5" />
    </svg>
  ),
  coins: (
    <svg viewBox="0 0 24 24" {...S}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v4c0 1.66 2.7 3 6 3s6-1.34 6-3V7" />
      <path d="M9 14v3c0 1.66 2.7 3 6 3s6-1.34 6-3v-4c0-1.66-2.7-3-6-3" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M12 5v15" />
      <path d="M12 5C10.5 3.8 8.5 3.5 4 3.8V18c4.5-.3 6.5 0 8 1.2" />
      <path d="M12 5c1.5-1.2 3.5-1.5 8-1.2V18c-4.5-.3-6.5 0-8 1.2" />
    </svg>
  ),
};

const ITEMS = [
  { k: "calc", left: "7%", s: 36, dur: 20, delay: 0, r0: -12, r1: 6, op: 0.22 },
  { k: "doc", left: "19%", s: 26, dur: 15, delay: 4, r0: 8, r1: -6, op: 0.16 },
  { k: "percent", left: "30%", s: 22, dur: 13, delay: 7, r0: -6, r1: 10, op: 0.18 },
  { k: "pen", left: "43%", s: 34, dur: 22, delay: 2, r0: 14, r1: -8, op: 0.2 },
  { k: "coins", left: "55%", s: 30, dur: 17, delay: 6, r0: -8, r1: 8, op: 0.18 },
  { k: "receipt", left: "67%", s: 28, dur: 16, delay: 1, r0: 6, r1: -10, op: 0.18 },
  { k: "chart", left: "79%", s: 32, dur: 19, delay: 5, r0: -10, r1: 6, op: 0.2 },
  { k: "book", left: "90%", s: 26, dur: 14, delay: 8, r0: 10, r1: -6, op: 0.16 },
  { k: "doc", left: "49%", s: 20, dur: 12, delay: 9.5, r0: -4, r1: 8, op: 0.14 },
  { k: "calc", left: "84%", s: 22, dur: 18, delay: 11, r0: 8, r1: -8, op: 0.15 },
];

export const FloatingIcons = () => (
  <>
    <style>{FLOATING_ICONS_CSS}</style>
    <div className="ec-fi" aria-hidden>
      {ITEMS.map((it, i) => (
        <span
          key={i}
          className="ec-fi-item"
          style={
            {
              left: it.left,
              width: `${it.s}px`,
              height: `${it.s}px`,
              animationDuration: `${it.dur}s`,
              animationDelay: `${it.delay}s`,
              "--r0": `${it.r0}deg`,
              "--r1": `${it.r1}deg`,
              "--op": String(it.op),
            } as CSSProperties
          }
        >
          {ICONS[it.k]}
        </span>
      ))}
    </div>
  </>
);

const FLOATING_ICONS_CSS = `
.ec-fi {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.ec-fi-item {
  position: absolute;
  bottom: -140px;
  color: #ffffff;
  opacity: 0;
  animation-name: ec-fi-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
.ec-fi-item svg {
  display: block;
  width: 100%;
  height: 100%;
}
@keyframes ec-fi-rise {
  0%   { transform: translateY(0) rotate(var(--r0)); opacity: 0; }
  12%  { opacity: var(--op); }
  88%  { opacity: var(--op); }
  100% { transform: translateY(-122vh) rotate(var(--r1)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ec-fi-item { animation: none; display: none; }
}
`;
