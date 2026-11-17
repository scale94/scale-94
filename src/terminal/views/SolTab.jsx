import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SolGlyph from '../components/icons/SolGlyph';
import SolCanvas from '../sol/SolCanvas';
import SolHud from '../sol/SolHud';
import { useSolStar } from '../sol/useSolStar';
import {
  createSnapFx, triggerSnap, stepSnapFx, snapUniforms, snapGeometry, stillSnapUniforms,
} from '../sol/snapFx';
import { strength01 } from '../sol/solPhysics';
import { cloudStatus } from '../sol/cloudClock';
import { launchCloud, getClouds, sweep, subscribeClouds, markWitnessed } from '../sol/cloudStore';
import { auroraUniforms } from '../sol/aurora';

const LIGHT_LINE_MS = 20000;   // the light line holds for 20 s after each snap
const HUD_POLL_MS = 100;       // tension readout; React state only when the integer changes
const STILL_SNAP_MS = 1200;     // reduced motion: how long the still snap frame holds
const CLOCK_TICK_MS = 1000;    // cloud statuses are re-read from the wall clock this often
const MAX_LANDING_LINES = 3;   // newest landings shown under the star
const AURORA_TAU_S = 2;        // the curtain eases toward its storm value: never pops in or out

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/** Every stored cloud with its status at `now`. */
const readClouds = (now) => getClouds().map((c) => ({ ...cloudStatus(c, now), id: c.id }));
const RM_QUERY = '(prefers-reduced-motion: reduce)';

const reducedMotionQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(RM_QUERY) || null
    : null;
const prefersReducedMotion = () => !!reducedMotionQuery()?.matches;

// Copies a snap-uniforms object into the stable effects object, in place.
function writeEffects(out, u) {
  for (let i = 0; i < 3; i++) {
    out.uFlashPos[i] = u.uFlashPos[i];
    out.uPlumeDir[i] = u.uPlumeDir[i];
  }
  out.uFlash = u.uFlash;
  out.uShock = u.uShock;
  out.uPlume = u.uPlume;
  out.uHalo = u.uHalo;
  out.shake[0] = 0;
  out.shake[1] = 0;
}

// The star fills the stage panel; the HUD sits under it. Snap envelopes run
// on the star's own frame clock (SolCanvas onFrame) and reach the shader
// through one stable object mutated in place; the camera impulse is written
// straight onto the canvas wrapper's style. No React state changes per frame.
// Reduced motion is read here, once, and followed live (OS toggle): it goes
// to the hook (the pointer drives the simulation) and to the canvas (no loop,
// uStill). A snap under reduced motion is one still frame held 1.2 s, no shake.
const SolTab = () => {
  const fxRef = useRef(null);
  if (fxRef.current === null) {
    fxRef.current = createSnapFx();
    fxRef.current.out.uAurora = 0;
    fxRef.current.out.uAuroraRed = 0;
  }
  const starRef = useRef(null);
  const wrapRef = useRef(null);
  const shakeRef = useRef('');
  const lightTimerRef = useRef(0);
  const stillTimerRef = useRef(0);
  const requestDrawRef = useRef(null);

  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const stillRef = useRef(reducedMotion);
  stillRef.current = reducedMotion;

  const requestDraw = useCallback(() => requestDrawRef.current?.(), []);
  const onReady = useCallback(({ requestDraw: rd } = {}) => { requestDrawRef.current = rd || null; }, []);

  const clearShake = useCallback((el = wrapRef.current) => {
    if (el) el.style.transform = '';
    shakeRef.current = '';
  }, []);

  const [tensionG, setTensionG] = useState(0);
  const [lastReleaseErg, setLastReleaseErg] = useState(null);
  const [lightOn, setLightOn] = useState(false);

  const onSnap = useCallback((ev) => {
    const u = starRef.current?.uniforms();
    const geo = snapGeometry(ev.lat, ev.lon, { yaw: u?.uCamYaw, pitch: u?.uCamPitch }, u?.uRotLon);
    const snap = { ...geo, strength01: strength01(ev.energyErg), facing: ev.facing };
    const fx = fxRef.current;
    if (stillRef.current) {
      // One fixed moment, held, then cleared. A newer snap restarts the hold.
      fx.active = false;
      writeEffects(fx.out, stillSnapUniforms(snap));
      requestDraw();
      clearTimeout(stillTimerRef.current);
      stillTimerRef.current = setTimeout(() => {
        snapUniforms(fx); // inactive: zeroes the effects in place
        requestDraw();
      }, STILL_SNAP_MS);
    } else {
      triggerSnap(fx, snap);
    }
    if (Number.isFinite(ev.energyErg)) setLastReleaseErg(ev.energyErg);
    // Only a snap aimed at the viewer sends a cloud this way.
    if (ev.facing && Number.isFinite(ev.energyErg) && ev.energyErg > 0) {
      launchCloud({ energyErg: ev.energyErg, handedness: ev.handedness, origin: ev.origin }, Date.now());
    }
    setLightOn(true);
    clearTimeout(lightTimerRef.current);
    lightTimerRef.current = setTimeout(() => setLightOn(false), LIGHT_LINE_MS);
  }, [requestDraw]);

  // The pointer maps against the stage's padding box: the canvas fills it,
  // but the canvas's own rect carries the snap's shake translate.
  const stageRef = useRef(null);
  const getRect = useCallback(() => {
    const el = stageRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left + el.clientLeft, top: r.top + el.clientTop, width: el.clientWidth, height: el.clientHeight };
  }, []);

  const star = useSolStar({ onSnap, getRect, reducedMotion, requestDraw });
  starRef.current = star;

  const onFrame = useCallback((dt) => {
    const fx = fxRef.current;
    stepSnapFx(fx, dt, { still: stillRef.current });
    const out = fx.out;
    const target = auroraRef.current;
    const k = dt > 0 ? 1 - Math.exp(-dt / AURORA_TAU_S) : 0;
    out.uAurora += (target.uAurora - out.uAurora) * k;
    out.uAuroraRed += (target.uAuroraRed - out.uAuroraRed) * k;
    const [x, y] = snapUniforms(fx).shake;
    const t = x === 0 && y === 0 ? '' : `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    if (t !== shakeRef.current && wrapRef.current) {
      wrapRef.current.style.transform = t;
      shakeRef.current = t;
    }
  }, []);

  // Follow the OS setting live.
  useEffect(() => {
    const mql = reducedMotionQuery();
    if (!mql) return undefined;
    const onChange = () => setReducedMotion(!!mql.matches);
    onChange();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
    return undefined;
  }, []);

  // A pane hidden mid-shake stops the frame callback: never leave the offset frozen.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const el = wrapRef.current; // still the wrapper at unmount, when the ref is already detached
    const onVis = () => { if (document.hidden) clearShake(el); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      clearShake(el);
    };
  }, [clearShake]);

  // Turning reduced motion on mid-snap: drop the running snap (the loop that
  // would finish it has stopped) and show the still star.
  useEffect(() => {
    if (!reducedMotion) return;
    const fx = fxRef.current;
    if (!fx.active) return;
    fx.active = false;
    snapUniforms(fx);
    clearShake();
    requestDraw();
  }, [reducedMotion, clearShake, requestDraw]);

  // The clouds: statuses come from the wall clock, never from elapsed frames,
  // so a page hidden for hours shows each cloud where it truly is on return.
  // A storm in progress raises the aurora; seen on a visible page, it is witnessed.
  const auroraRef = useRef({ uAurora: 0, uAuroraRed: 0 });
  const [statuses, setStatuses] = useState(() => readClouds(Date.now()));
  const refreshClouds = useCallback(() => {
    const now = Date.now();
    sweep(now);
    const list = readClouds(now);
    setStatuses(list);
    const a = auroraUniforms(list);
    auroraRef.current = { uAurora: a.uAurora, uAuroraRed: a.uAuroraRed };
    const out = fxRef.current.out;
    if (stillRef.current && (out.uAurora !== a.uAurora || out.uAuroraRed !== a.uAuroraRed)) {
      out.uAurora = a.uAurora;
      out.uAuroraRed = a.uAuroraRed;
      requestDrawRef.current?.();
    }
    if (pageVisible()) for (const id of a.witnessIds) markWitnessed(id);
  }, []);

  useEffect(() => {
    const off = subscribeClouds(refreshClouds);
    refreshClouds();
    const id = setInterval(refreshClouds, CLOCK_TICK_MS);
    const onVis = () => { if (typeof document !== 'undefined' && !document.hidden) refreshClouds(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => {
      off();
      clearInterval(id);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshClouds]);

  const hudClouds = useMemo(() => statuses
    .filter((s) => s.phase === 'flight')
    .sort((a, b) => a.etaMs - b.etaMs)
    .map((s) => ({ id: s.id, etaMs: s.etaMs, orientation: s.orientation })), [statuses]);

  // A passed landing is its line and nothing else.
  const hudLandings = useMemo(() => statuses
    .filter((s) => s.phase !== 'flight')
    .sort((a, b) => b.arrivalAt - a.arrivalAt)
    .slice(0, MAX_LANDING_LINES)
    .map((s) => ({ id: s.id, fate: s.fate, nT: s.stormNt })), [statuses]);

  useEffect(() => {
    const read = () => {
      const g = Math.round(star.hud().tensionG);
      if (Number.isFinite(g)) setTensionG((prev) => (prev === g ? prev : g));
    };
    read();
    const id = setInterval(read, HUD_POLL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(lightTimerRef.current);
      clearTimeout(stillTimerRef.current);
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
        ref={stageRef}
        data-testid="sol-stage"
        className="relative w-full min-h-[60vh] border border-yellow-200/25 rounded-sm overflow-hidden"
      >
        <div ref={wrapRef} className="absolute inset-0">
          <SolCanvas
            star={star}
            effects={fxRef.current.out}
            onFrame={onFrame}
            reducedMotion={reducedMotion}
            onReady={onReady}
          />
        </div>
      </div>

      <SolHud
        tensionG={tensionG}
        lastReleaseErg={lastReleaseErg}
        lightDelayVisible={lightOn}
        clouds={hudClouds}
        landings={hudLandings}
      />
    </div>
  );
};

export default React.memo(SolTab);
