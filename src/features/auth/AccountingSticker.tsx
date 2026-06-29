/**
 * Hanging "ACCOUNTING — ACT. COUNT. THINK." sticker for the team-login page.
 *
 * Self-contained (markup + scoped <style>) so it doesn't depend on AuthSlider's
 * styles. Same staged entrance as the main-page sticker: a metal eyelet pops in,
 * the rope draws down, the card flies in from the side and clasps on, then it
 * swings like a pendulum. Drop it into AuthShell's `sticker` slot — it pins to
 * the top-centre of the white panel (which AuthShell makes `relative`).
 */
export const AccountingSticker = () => (
  <>
    <style>{ACCOUNTING_STICKER_CSS}</style>
    <div className="ec-as-hang" aria-hidden>
      <div className="ec-as-swing">
        <span className="ec-as-cap" />
        <span className="ec-as-rope" />
        <div className="ec-as-sticker">
          <div className="ec-as-inner">
            <span className="ec-as-title">Accounting</span>
            <span className="ec-as-sub">Act. Count. Think.</span>
          </div>
        </div>
      </div>
    </div>
  </>
);

const ACCOUNTING_STICKER_CSS = `
.ec-as-hang {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
}
.ec-as-swing {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform-origin: top center;
  will-change: transform;
  /* ease from rest into the first swing once, then a smooth alternating
     pendulum (2 keyframes + alternate = fastest at centre, no mid-swing stall) */
  animation:
    ec-as-swing-in 0.9s ease-in-out 1.85s both,
    ec-as-swing 1.8s ease-in-out 2.75s infinite alternate;
}
.ec-as-cap {
  /* metal eyelet pinned to the "ceiling" */
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
  animation: ec-as-cap-in 0.3s ease-out 0.2s both;
}
.ec-as-rope {
  display: block;
  width: 5px;
  height: 58px;
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
  /* GPU scale reveal — no layout reflow, so it stays smooth */
  animation: ec-as-rope-grow 0.9s ease-out 0.25s both;
}
.ec-as-sticker {
  /* white die-cut frame around the black card, with a 3D tilt + lift */
  padding: 4px;
  margin-top: -2px;
  background: #ffffff;
  border-radius: 14px;
  transform: perspective(720px) rotateX(8deg) rotateY(-12deg);
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.14),
    0 26px 40px -16px rgba(20, 8, 60, 0.5),
    0 10px 16px -10px rgba(20, 8, 60, 0.4);
  animation: ec-as-sticker-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) 1.05s both;
}
.ec-as-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 18px 14px;
  border-radius: 10px;
  /* beveled black face */
  background: linear-gradient(160deg, #232228 0%, #121116 60%, #0a0910 100%);
  box-shadow:
    inset 0 1.5px 0 rgba(255, 255, 255, 0.14),
    inset 0 -4px 10px rgba(0, 0, 0, 0.5);
  font-family: "Arial Black", "Arial Narrow", system-ui, sans-serif;
  text-transform: uppercase;
  color: #ffffff;
  line-height: 0.92;
}
.ec-as-title {
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.4px;
  /* raised-letter depth */
  text-shadow:
    0 1px 0 #45454d,
    0 2px 0 #34343c,
    0 3px 4px rgba(0, 0, 0, 0.5);
}
.ec-as-sub {
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 0.4px;
  margin-top: 3px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.55);
}
@keyframes ec-as-rope-grow {
  0%   { transform: scaleY(0); }
  100% { transform: scaleY(1); }
}
@keyframes ec-as-cap-in {
  0%   { opacity: 0; transform: translateX(-50%) scale(0.4); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}
@keyframes ec-as-sticker-in {
  0% {
    opacity: 0;
    transform: translateX(-180px) rotate(-15deg) perspective(720px) rotateX(8deg) rotateY(-12deg);
  }
  55% { opacity: 1; }
  100% {
    opacity: 1;
    transform: translateX(0) rotate(0deg) perspective(720px) rotateX(8deg) rotateY(-12deg);
  }
}
@keyframes ec-as-swing-in {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(-7deg); }
}
@keyframes ec-as-swing {
  0%   { transform: rotate(-7deg); }
  100% { transform: rotate(7deg); }
}
@media (max-width: 1023px) {
  .ec-as-hang { display: none; }
}
`;
