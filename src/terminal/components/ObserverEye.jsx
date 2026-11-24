// ── ObserverEye ──────────────────────────────────────────────────────────────
// The living eye: a thin hexagon lens over a WebGL nebula pupil. Ported from the
// user-approved mock (scratchpad/observer-eye-living.html, "socks/10"). The pupil
// swirls continuously (domain-warped fbm + differential rotation); `state` LOCKS
// its character — colour, speed, dilation/miosis, gaze — over that motion.
//
//   resting   golden-record quicksilver sheen, dilated + open
//   leaning   tints to the suggested tab's hue, gaze-drifts toward it
//   armed     gold/fuchsia, nebula tightening — the altar is lit
//   compiling violet × lime, miosis: collapses inward, slow + deep
//   complete  calm teal — the record remembers
//   aether    silver nebula in calm orbit, a star-core, pearl glints
//   charging  aether gathering itself: the core swells, the orbit tightens
//
// Reactions are imperative (forwardRef): `kick({kind,tint,dir,durationMs,strength})`
// plays one motion primitive (KICK in observerEyeShader.js) on an envelope, and
// `detonate()` plays the crescendo. Both write into curRef only — no re-render.
//
// Baked-in per spec §9: frames come from rAF with a setTimeout watchdog — rAF
// gives 60fps when the tab is visible; when a surface suppresses rAF while still
// compositing (embedded preview panes report `hidden` forever), the watchdog
// keeps the eye alive; when the tab is *genuinely* hidden the browser throttles
// the timer to ~1fps, which is the battery pause. Under prefers-reduced-motion
// the swirl freezes but state changes still snap to their locked colour, and a
// reaction is a brief static colour hold.
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { VS, FS, UNIFORMS, KICK } from './observerEyeShader';

const RESTING_COLS = [[210,220,232],[150,170,185],[120,200,220]];
const AETHER = { irid: 1, cols: RESTING_COLS, speed: 0.06, focus: 0.08, gaze: [0, 0], core: 0.85, orbit: 1, shimmer: 1 };

const STATES = {
  resting:   { irid: 1, cols: RESTING_COLS, speed: 0.05, focus: 0.00, gaze: [0, 0] },
  leaning:   { irid: 0, cols: [[56,189,248],[6,182,212],[170,235,255]],    speed: 0.11, focus: 0.34, gaze: [0.12, -0.08] },
  armed:     { irid: 0, cols: [[255,215,0],[217,70,239],[255,150,60]],     speed: 0.14, focus: 0.58, gaze: [0, 0] },
  compiling: { irid: 0, cols: [[167,139,250],[122,184,0],[205,180,255]],   speed: 0.20, focus: 0.86, gaze: [0, 0] },
  complete:  { irid: 0, cols: [[20,184,166],[185,240,228],[70,205,185]],   speed: 0.07, focus: 0.22, gaze: [0, 0] },
  aether:    AETHER,
  charging:  { ...AETHER, charge: true },
};

// charging: core 0.85→1.6 and orbit 1→1.4 over 5 s from entry.
const CHARGE_S = 5;
const CHARGE_CORE = [0.85, 1.6];
const CHARGE_ORBIT = [1, 1.4];

// Kick envelope: linear attack, then an exponential decay that lands on
// exactly 0 at durationMs.
const ATTACK_S = 0.12;
const DECAY_FLOOR = Math.exp(-4);

// Crescendo phases (seconds), spec §5.5.
const IMPLODE_S = 0.25, DETONATE_S = 0.35, STORM_S = 2.0, SETTLE_S = 3.0;
const CRESCENDO_S = IMPLODE_S + DETONATE_S + STORM_S + SETTLE_S;
const WHITE_GOLD = [255, 236, 180];
// Reduced motion: how long the crescendo's static flash holds.
const RM_FLASH_MS = (IMPLODE_S + DETONATE_S + STORM_S) * 1000;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.min(1, Math.max(0, x || 0));
const smooth = x => x * x * (3 - 2 * x);
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A leaning tint (the suggested tab's hue) → a 3-shade nebula palette.
function deriveCols(t) {
  return [
    [t[0], t[1], t[2]],
    [Math.round(t[0] * 0.5), Math.round(t[1] * 0.5), Math.round(t[2] * 0.62)],
    [Math.round((t[0] + 230) / 2), Math.round((t[1] + 240) / 2), Math.round((t[2] + 255) / 2)],
  ];
}

function kickLevel(k, tsec) {
  const age = tsec - k.t0;
  if (age < ATTACK_S) return lerp(k.from, k.peak, Math.max(0, age) / ATTACK_S);
  if (age >= k.dur) return 0;
  const x = (age - ATTACK_S) / (k.dur - ATTACK_S);
  return k.peak * (Math.exp(-4 * x) - DECAY_FLOOR) / (1 - DECAY_FLOOR);
}

// The crescendo's override for this frame: values `o` and their weight `w`
// over the baseline (w = 1 until the settle phase eases it back to 0).
function crescendoAt(c, tsec) {
  const age = tsec - c.t0;
  const o = { core: 0, focus: 0.95, turb: 0, speedMul: 1, jitter: 0, kick: 0 };
  if (age < IMPLODE_S) {
    const x = age / IMPLODE_S;
    o.core = c.core0 * Math.pow(1 - x, 3);               // the star-core collapses to a point
    o.focus = lerp(c.focus0, 0.95, smooth(x));
    return { o, w: 1 };
  }
  const tDet = age - IMPLODE_S;
  if (tDet < DETONATE_S) {
    const y = tDet / DETONATE_S;
    o.focus = lerp(0.95, 0.3, smooth(y));                // the blast throws the iris open
    o.turb = 1; o.speedMul = 4;
    o.kick = 1 - y;                                      // a white-gold ring flies outward
    return { o, w: 1 };
  }
  const tStorm = tDet - DETONATE_S;
  o.focus = 0.3;
  if (tStorm < STORM_S) {
    const z = tStorm / STORM_S;
    o.turb = lerp(1, 0.6, z); o.speedMul = lerp(4, 2, z); o.jitter = 1;
    return { o, w: 1 };
  }
  const s = Math.min(1, (tStorm - STORM_S) / SETTLE_S);
  o.turb = 0.6; o.speedMul = 2; o.jitter = 1 - s;
  return { o, w: 1 - smooth(s) };
}

function ObserverEye({ state = 'resting', size = 28, tint = null, gaze = null, pulse = false, lens = true, constrict = null, thread = 0, shimmer = 0, onClick, title, className = '', ariaLabel }, ref) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(state);
  const tintRef   = useRef(tint);
  const gazeRef   = useRef(gaze);
  const pulseRef  = useRef(pulse);
  const constrictRef = useRef(constrict);
  const threadRef  = useRef(thread);
  const shimmerRef = useRef(shimmer);
  const aliveRef = useRef(false);
  const holdTimerRef = useRef(0);

  const curRef = useRef(null);
  const { snap } = useShaderCanvas(canvasRef, {
    version: 1,
    contextOptions: { alpha: true, premultipliedAlpha: false, antialias: true },
    strategy: 'legacy',
    blend: 'straight',
    vs: VS,
    fs: FS,
    uniforms: UNIFORMS,
    pixelSize: size,
    label: 'ObserverEye',
    dtClamp: 0.05,
    seedLast: 'now',
    watchdogMs: 40,
    haltOnReducedMotion: true,
    initialDraw: true,
    deps: [size],

    // Today's effect recreates `cur` every time it re-runs. onInit fires on the
    // same schedule, so the easing state and the GL host are rebuilt together.
    onInit() {
      const start = STATES[stateRef.current] || STATES.resting;
      curRef.current = {
        cols: start.cols.map(c => c.slice()),
        speed: start.speed, focus: start.focus, irid: start.irid,
        gaze: start.gaze.slice(), pulse: 0,
        core: start.charge ? CHARGE_CORE[0] : (start.core || 0),
        orbit: start.charge ? CHARGE_ORBIT[0] : (start.orbit || 0),
        shimmer: Math.max(start.shimmer || 0, clamp01(shimmerRef.current)),
        thread: clamp01(threadRef.current),
        chargeT0: null, kick: null, cres: null, hold: null, kickOut: 0,
      };
    },

    draw(host, { dt, tsec }) {
      const cur = curRef.current;
      const charging = !!(STATES[stateRef.current] || STATES.resting).charge;
      // The charge clock starts on the first real frame (initialDraw runs at tsec 0).
      if (!charging) cur.chargeT0 = null;
      else if (cur.chargeT0 == null && dt > 0) cur.chargeT0 = tsec;
      if (dt > 0) {
        const chargeP = cur.chargeT0 == null ? 0 : Math.min(1, (tsec - cur.chargeT0) / CHARGE_S);
        const { tgt, tCols, tGaze, tCore, tOrbit, tShimmer, tThread } = targets(chargeP);
        const e = 1 - Math.pow(0.004, dt);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          cur.cols[i][j] = lerp(cur.cols[i][j], tCols[i][j], e);
        }
        cur.speed = lerp(cur.speed, tgt.speed, e);
        const focusTarget = constrictRef.current != null
          ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
        cur.focus = lerp(cur.focus, focusTarget, e);
        cur.irid = lerp(cur.irid, tgt.irid, e);
        cur.pulse = lerp(cur.pulse, pulseRef.current ? 1 : 0, e);
        cur.gaze[0] = lerp(cur.gaze[0], tGaze[0], e);
        cur.gaze[1] = lerp(cur.gaze[1], tGaze[1], e);
        cur.core = lerp(cur.core, tCore, e);
        cur.orbit = lerp(cur.orbit, tOrbit, e);
        cur.shimmer = lerp(cur.shimmer, tShimmer, e);
        cur.thread = lerp(cur.thread, tThread, e);
      }
      paint(host, overlay(cur, tsec), tsec);
    },

    onSnap(host) {
      // Reduced motion: no swirl, but a state change still locks in its colour,
      // and a reaction shows as a static colour hold (cur.hold).
      const cur = curRef.current;
      if (!cur) return;
      const { tgt, tCols, tGaze, tCore, tOrbit, tShimmer, tThread } = targets(1);
      const hold = cur.hold;
      cur.cols = (hold ? hold.cols : tCols).map(c => c.slice());
      cur.speed = tgt.speed;
      cur.focus = constrictRef.current != null
        ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
      cur.irid = tgt.irid;
      cur.pulse = pulseRef.current ? 1 : 0;
      cur.gaze = tGaze.slice();
      cur.core = hold && hold.core != null ? hold.core : tCore;
      cur.orbit = tOrbit;
      cur.shimmer = tShimmer;
      cur.thread = tThread;
      paint(host, still(cur), 0);
    },
  });

  function targets(chargeP) {
    const tgt = STATES[stateRef.current] || STATES.resting;
    const tCols = (stateRef.current === 'leaning' && tintRef.current) ? deriveCols(tintRef.current) : tgt.cols;
    const tGaze = gazeRef.current || tgt.gaze;
    const tCore = tgt.charge ? lerp(CHARGE_CORE[0], CHARGE_CORE[1], chargeP) : (tgt.core || 0);
    const tOrbit = tgt.charge ? lerp(CHARGE_ORBIT[0], CHARGE_ORBIT[1], chargeP) : (tgt.orbit || 0);
    const tShimmer = Math.max(tgt.shimmer || 0, clamp01(shimmerRef.current));
    const tThread = clamp01(threadRef.current);
    return { tgt, tCols, tGaze, tCore, tOrbit, tShimmer, tThread };
  }

  // The eased baseline with no reaction on it.
  function still(cur) {
    return {
      cols: cur.cols, speed: cur.speed, focus: cur.focus, irid: cur.irid, pulse: cur.pulse,
      gaze: cur.gaze, core: cur.core, orbit: cur.orbit, shimmer: cur.shimmer, thread: cur.thread,
      turb: 0, kick: 0, kickKind: 0, kickDir: 0,
    };
  }

  // The baseline with the crescendo, or else the live kick, laid over it.
  function overlay(cur, tsec) {
    const o = still(cur);
    let hue = null, level = 0;
    const c = cur.cres;
    if (c) {
      if (c.t0 == null) { c.t0 = tsec; c.core0 = cur.core; c.focus0 = cur.focus; }
      if (tsec - c.t0 >= CRESCENDO_S) cur.cres = null;
      else {
        const { o: x, w } = crescendoAt(c, tsec);
        o.core = lerp(cur.core, x.core, w);
        o.focus = lerp(cur.focus, x.focus, w);
        o.turb = x.turb * w;
        o.speed = cur.speed * lerp(1, x.speedMul, w);
        const j = 0.03 * x.jitter * w;     // storm: the gaze shakes, ±0.03
        o.gaze = [cur.gaze[0] + j * Math.sin(tsec * 47.3), cur.gaze[1] + j * Math.sin(tsec * 39.1 + 1.3)];
        if (x.kick > 0) {
          o.kick = x.kick; o.kickKind = KICK.ring; o.kickDir = 1;
          hue = WHITE_GOLD; level = x.kick;
        }
      }
    } else if (cur.kick) {
      const k = cur.kick;
      if (k.t0 == null) k.t0 = tsec;
      const v = kickLevel(k, tsec);
      if (tsec - k.t0 >= k.dur) cur.kick = null;
      else {
        o.kick = v; o.kickKind = k.kind; o.kickDir = k.dir;
        hue = k.tint; level = v;
      }
    }
    if (hue && level > 0) {
      const kc = deriveCols(hue);
      const t = Math.min(1, level);
      o.cols = cur.cols.map((col, i) => col.map((x, jj) => lerp(x, kc[i][jj], t)));
    }
    cur.kickOut = o.kick;
    return o;
  }

  // Single controller of the GL push, shared by the frame loop and the
  // reduced-motion snap — both must emit exactly the same call sequence.
  function paint(host, o, tsec) {
    const { gl, U } = host;
    const nrm = c => new Float32Array([c[0] / 255, c[1] / 255, c[2] / 255]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.u_t, tsec);
    gl.uniform1f(U.u_focus, o.focus);
    gl.uniform1f(U.u_irid, o.irid);
    gl.uniform1f(U.u_speed, o.speed);
    gl.uniform1f(U.u_pulse, o.pulse);
    gl.uniform3fv(U.c0, nrm(o.cols[0]));
    gl.uniform3fv(U.c1, nrm(o.cols[1]));
    gl.uniform3fv(U.c2, nrm(o.cols[2]));
    gl.uniform2fv(U.u_gaze, new Float32Array(o.gaze));
    gl.uniform1f(U.u_core, o.core);
    gl.uniform1f(U.u_orbit, o.orbit);
    gl.uniform1f(U.u_shimmer, o.shimmer);
    gl.uniform1f(U.u_thread, o.thread);
    gl.uniform1f(U.u_turb, o.turb);
    gl.uniform1f(U.u_kick, o.kick);
    gl.uniform1f(U.u_kickKind, o.kickKind);
    gl.uniform1f(U.u_kickDir, o.kickDir);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Reduced motion: a reaction is a static hold that snaps back after `ms`.
  function holdStatic(hold, ms) {
    const cur = curRef.current;
    clearTimeout(holdTimerRef.current);
    cur.hold = hold;
    snap();
    holdTimerRef.current = setTimeout(() => {
      if (!aliveRef.current) return;
      cur.hold = null;
      snap();
    }, ms);
  }

  // Imperative reactions write into curRef only: no React render.
  useImperativeHandle(ref, () => ({
    kick({ kind, tint: kTint = null, dir = 1, durationMs, strength = 1 } = {}) {
      const cur = curRef.current;
      if (!cur || !aliveRef.current) return;
      if (prefersReducedMotion()) {
        if (kTint) holdStatic({ cols: deriveCols(kTint) }, durationMs);
        return;
      }
      if (cur.cres) return;   // the crescendo outranks every reaction
      // Newest signature wins; its attack starts from wherever the last one is.
      cur.kick = {
        kind, tint: kTint, dir: dir < 0 ? -1 : 1, t0: null,
        dur: Math.max((durationMs || 0) / 1000, ATTACK_S + 0.05),
        peak: clamp01(strength), from: Math.min(1, cur.kickOut || 0),
      };
    },
    detonate() {
      const cur = curRef.current;
      if (!cur || !aliveRef.current) return;
      if (prefersReducedMotion()) {
        holdStatic({ cols: deriveCols(WHITE_GOLD), core: CHARGE_CORE[1] }, RM_FLASH_MS);
        return;
      }
      cur.kick = null;
      cur.cres = { t0: null };
    },
  }));

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      clearTimeout(holdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    stateRef.current = state; tintRef.current = tint; gazeRef.current = gaze; pulseRef.current = pulse;
    constrictRef.current = constrict; threadRef.current = thread; shimmerRef.current = shimmer;
    snap();
  }, [state, tint, gaze, pulse, constrict, thread, shimmer]);

  // The lens viewBox is 280 wide, so a stroke in user units shrinks with `size`
  // (1.3 → 0.3px at 64px: paper thin, pixelated on 1440p). Non-scaling px strokes
  // keep the hex line crisp at any size. One frame only: the inner ~1px ring
  // was retired so the eye reads inside a single hexagon.
  const lensOuter = Math.max(1.25, size * 0.02);

  return (
    <div
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={ariaLabel}
      title={title}
      style={{ width: size, height: size, position: 'relative', display: 'grid', placeItems: 'center', cursor: onClick ? 'pointer' : 'default', flexShrink: 0 }}
    >
      {lens && (
        <svg viewBox="0 0 280 280" aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <linearGradient id="oe-hex" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e8edf2" stopOpacity=".85" />
              <stop offset="0.5" stopColor="#7d8b94" stopOpacity=".5" />
              <stop offset="1" stopColor="#cfd8de" stopOpacity=".75" />
            </linearGradient>
          </defs>
          <polygon points="140,30 236,85 236,195 140,250 44,195 44,85" fill="none" stroke="url(#oe-hex)" strokeWidth={lensOuter} vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <canvas ref={canvasRef} style={{ position: 'relative', zIndex: 2, width: Math.round(size * (lens ? 0.58 : 0.94)), height: Math.round(size * (lens ? 0.58 : 0.94)), display: 'block' }} />
    </div>
  );
}

export default forwardRef(ObserverEye);
