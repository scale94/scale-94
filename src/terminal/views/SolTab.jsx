import React, { useCallback, useEffect, useRef, useState } from 'react';
import SolGlyph from '../components/icons/SolGlyph';
import SolCanvas from '../sol/SolCanvas';
import SolHud from '../sol/SolHud';
import { useSolStar } from '../sol/useSolStar';
import { createSnapFx, triggerSnap, stepSnapFx, snapUniforms, snapGeometry } from '../sol/snapFx';
import { strength01 } from '../sol/solPhysics';

const LIGHT_LINE_MS = 20000;   // the light line holds for 20 s after each snap
const HUD_POLL_MS = 100;       // tension readout; React state only when the integer changes
const NO_CLOUDS = [];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  !!window.matchMedia('(prefers-reduced-motion: reduce)')?.matches;

// The star fills the stage panel; the HUD sits under it. Snap envelopes run
// on the star's own frame clock (SolCanvas onFrame) and reach the shader
// through one stable object mutated in place; the camera impulse is written
// straight onto the canvas wrapper's style. No React state changes per frame.
const SolTab = () => {
  const fxRef = useRef(null);
  if (fxRef.current === null) fxRef.current = createSnapFx();
  const starRef = useRef(null);
  const wrapRef = useRef(null);
  const shakeRef = useRef('');
  const stillRef = useRef(false);
  const lightTimerRef = useRef(0);

  const [tensionG, setTensionG] = useState(0);
  const [lastReleaseErg, setLastReleaseErg] = useState(null);
  const [lightOn, setLightOn] = useState(false);

  const onSnap = useCallback((ev) => {
    const u = starRef.current?.uniforms();
    const geo = snapGeometry(ev.lat, ev.lon, { yaw: u?.uCamYaw, pitch: u?.uCamPitch }, u?.uRotLon);
    triggerSnap(fxRef.current, { ...geo, strength01: strength01(ev.energyErg), facing: ev.facing });
    if (Number.isFinite(ev.energyErg)) setLastReleaseErg(ev.energyErg);
    setLightOn(true);
    clearTimeout(lightTimerRef.current);
    lightTimerRef.current = setTimeout(() => setLightOn(false), LIGHT_LINE_MS);
  }, []);

  const star = useSolStar({ onSnap });
  starRef.current = star;

  const onFrame = useCallback((dt) => {
    const fx = fxRef.current;
    stepSnapFx(fx, dt, { still: stillRef.current });
    const [x, y] = snapUniforms(fx).shake;
    const t = x === 0 && y === 0 ? '' : `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    if (t !== shakeRef.current && wrapRef.current) {
      wrapRef.current.style.transform = t;
      shakeRef.current = t;
    }
  }, []);

  useEffect(() => {
    stillRef.current = prefersReducedMotion();
    const read = () => {
      const g = Math.round(star.hud().tensionG);
      if (Number.isFinite(g)) setTensionG((prev) => (prev === g ? prev : g));
    };
    read();
    const id = setInterval(read, HUD_POLL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(lightTimerRef.current);
    };
  }, [star]);

  return (
    <div className="tab-fade-v2 max-w-6xl mx-auto mt-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-yellow-200/25 pb-4 mb-8 gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3 mb-3 text-yellow-100 uppercase">
            <SolGlyph className="w-7 h-7 md:w-8 md:h-8 shrink-0" />
            <span>SOL</span>
          </h2>
          <div className="text-xs sm:text-sm font-bold tracking-widest text-yellow-100/70 uppercase">
            G2V · MAIN SEQUENCE
          </div>
        </div>
      </div>

      <div
        data-testid="sol-stage"
        className="relative w-full min-h-[60vh] border border-yellow-200/25 rounded-sm overflow-hidden"
      >
        <div ref={wrapRef} className="absolute inset-0">
          <SolCanvas star={star} effects={fxRef.current.out} onFrame={onFrame} />
        </div>
      </div>

      <SolHud
        tensionG={tensionG}
        lastReleaseErg={lastReleaseErg}
        lightDelayVisible={lightOn}
        clouds={NO_CLOUDS}
        landings={NO_CLOUDS}
      />
    </div>
  );
};

export default React.memo(SolTab);
