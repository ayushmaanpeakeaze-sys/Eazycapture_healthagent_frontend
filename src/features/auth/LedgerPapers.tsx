import { CSSProperties } from "react";

const PAPERS = [
  { left: "10%", w: 46, dur: 18, delay: 0, rot: -8 },
  { left: "26%", w: 30, dur: 14, delay: 3.5, rot: 7 },
  { left: "44%", w: 60, dur: 21, delay: 1.2, rot: -4 },
  { left: "62%", w: 36, dur: 16, delay: 5, rot: 9 },
  { left: "78%", w: 50, dur: 19, delay: 2.2, rot: -7 },
  { left: "90%", w: 26, dur: 13, delay: 6.5, rot: 6 },
];

export const LedgerPapers = () => (
  <>
    <style>{LEDGER_PAPERS_CSS}</style>
    <div className="ec-lp" aria-hidden>
      {PAPERS.map((p, i) => (
        <span
          key={i}
          className="ec-lp-sheet"
          style={
            {
              left: p.left,
              width: `${p.w}px`,
              height: `${Math.round(p.w * 1.32)}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              "--rot": `${p.rot}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  </>
);

const LEDGER_PAPERS_CSS = `
.ec-lp {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.ec-lp-sheet {
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
  animation-name: ec-lp-rise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
@keyframes ec-lp-rise {
  0%   { transform: translateY(0) rotate(var(--rot)); opacity: 0; }
  12%  { opacity: 0.5; }
  85%  { opacity: 0.4; }
  100% { transform: translateY(-122vh) rotate(var(--rot)); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ec-lp-sheet { animation: none; display: none; }
}
`;
