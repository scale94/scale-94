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
import { eyeDrive, live } from './eyeDrive';

const RESTING_COLS = [[210,220,232],[150,170,185],[120,200,220]];
const AETHER = { irid: 1, cols: RESTING_COLS, speed: 0.06, focus: 0.08, gaze: [0, 0], core: 0.85, orbit: 1, shimmer: 1 };

const STATES = {
  resting:   { irid: 1, cols: RESTING_COLS, speed: 0.05, focus: 0.00, gaze: [0, 0] },
  leaning:   { irid: 0, cols: [[56,189,248],[6,182,212],[170,235,255]],    speed: 0.11, focus: 0.52, gaze: [0.12, -0.08] },
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
const WHITE_GOLD_COLS = deriveCols(WHITE_GOLD);
// Turbulence also speeds the swirl: phase rate = speed + TURB_SPEED·turb.
const TURB_SPEED = 0.25;
// Back-spin (the CDJ unwind): when the eye leaves a coloured state for silver, the
// swirl gets a reverse angular velocity that coasts out exponentially. Total reverse
// travel = BACKSPIN_TURN · (how coloured the eye was), here ~2/3 of a turn from full
// colour, launched at 17.5 rad/s and spent in ~τ. It is integrated off dt, so it is the same at any uptime (the old
// u_t·u_speed version made it, by accident, scale with how long the page was open).
const BACKSPIN_TURN = 4.2;     // rad of reverse travel from a fully coloured eye
const BACKSPIN_TAU = 0.24;     // s, the coast's time constant
// The colour bleeds back to silver slower than the other eases, so it runs under the spin.
const IRID_RETURN = 0.05;      // per-second residual (e = 1 - IRID_RETURN^dt), vs 0.004
// eyeDrive (live channels, `driven` eyes only) eases in and out at this residual.
const DRIVE_EASE = 0.002;
// Keyed kick fields (Phase 0d). `level` defaults to 1, the rest to 0 (additive).
const KEY_FIELDS = ['level', 'turn', 'focus', 'shapeK', 'shapeA', 'shapeB', 'shapeC', 'gazeX', 'gazeY', 'turb'];
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

// A reaction's palette: the tint's 3 shades, or (kernel run's violet x lime) the
// tint, a second colour, and the tint's pale shade.
function kickCols(tint, tint2) {
  const cols = deriveCols(tint);
  if (tint2) cols[1] = [tint2[0], tint2[1], tint2[2]];
  return cols;
}

// A keyed timeline -> per-field arrays over sorted times (allocated once, at kick time).
function normaliseKeys(keys) {
  const ks = keys.slice().sort((a, b) => a.t - b.t);
  const out = { t: ks.map(k => clamp01(k.t)), f: {} };
  for (const name of KEY_FIELDS) {
    if (!ks.some(k => k[name] != null)) continue;
    const dflt = name === 'level' ? 1 : 0;
    out.f[name] = ks.map(k => (k[name] == null ? dflt : k[name]));
  }
  return out;
}

// Sample a normalised timeline at x (0..1) into `dst`, smoothstep between keys.
// A field no key names samples as 0 (level: NaN, meaning "use the envelope").
function sampleKeys(K, x, dst) {
  const t = K.t;
  let i = 0;
  while (i < t.length - 1 && x > t[i + 1]) i++;
  const j = Math.min(i + 1, t.length - 1);
  const span = t[j] - t[i];
  const u = span > 0 ? smooth(Math.min(1, Math.max(0, (x - t[i]) / span))) : 0;
  for (const name of KEY_FIELDS) {
    const f = K.f[name];
    dst[name] = f ? lerp(f[i], f[j], u) : (name === 'level' ? NaN : 0);
  }
  return dst;
}

function kickLevel(k, tsec) {
  const age = tsec - k.t0;
  if (age < ATTACK_S) return lerp(k.from, k.peak, Math.max(0, age) / ATTACK_S);
  if (age >= k.dur) return 0;
  const x = (age - ATTACK_S) / (k.dur - ATTACK_S);
  return k.peak * (Math.exp(-4 * x) - DECAY_FLOOR) / (1 - DECAY_FLOOR);
}

// The crescendo's override for this frame, written into `o` (a per-eye scratch: no
// allocation per frame): values and their weight `o.w` over the baseline (w = 1 until
// the settle phase eases it back to 0).
function crescendoAt(c, tsec, o) {
  const age = tsec - c.t0;
  o.core = 0; o.focus = 0.95; o.turb = 0; o.speedMul = 1; o.jitter = 0; o.kick = 0; o.w = 1;
  if (age < IMPLODE_S) {
    const x = age / IMPLODE_S;
    o.core = c.core0 * Math.pow(1 - x, 3);               // the star-core collapses to a point
    o.focus = lerp(c.focus0, 0.95, smooth(x));
    return o;
  }
  const tDet = age - IMPLODE_S;
  if (tDet < DETONATE_S) {
    const y = tDet / DETONATE_S;
    o.focus = lerp(0.95, 0.3, smooth(y));                // the blast throws the iris open
    o.turb = 1; o.speedMul = 4;
    o.kick = 1 - y;                                      // a white-gold ring flies outward
    return o;
  }
  const tStorm = tDet - DETONATE_S;
  o.focus = 0.3;
  if (tStorm < STORM_S) {
    const z = tStorm / STORM_S;
    o.turb = lerp(1, 0.6, z); o.speedMul = lerp(4, 2, z); o.jitter = 1;
    return o;
  }
  const s = Math.min(1, (tStorm - STORM_S) / SETTLE_S);
  o.turb = 0.6; o.speedMul = 2; o.jitter = 1 - s;
  o.w = 1 - smooth(s);
  return o;
}

// Per-eye scratch for the frame loop: every per-frame value is written in place.
const cols3 = () => [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
function makeScratch() {
  return {
    o: {
      cols: cols3(), speed: 0, focus: 0, irid: 0, pulse: 0, gaze: [0, 0], core: 0, orbit: 0,
      shimmer: 0, thread: 0, turb: 0, kick: 0, kickKind: 0, kickDir: 0, phase: 0,
      shape: 0, shapeK: 0, shapeA: 0, shapeB: 0, shapeC: 0, turn: 0, rim: 0, rimCol: [0, 0, 0],
    },
    key: {},                                    // a keyed kick's sample this frame
    cres: { core: 0, focus: 0, turb: 0, speedMul: 1, jitter: 0, kick: 0, w: 1 },
    T: { tgt: null, tCols: null, tGaze: null, tCore: 0, tOrbit: 0, tShimmer: 0, tThread: 0, tPulse: 0 },
    leanTgt: { speed: 0, focus: 0, irid: 0 },
    leanCols: cols3(),
    leanGaze: [0, 0],
    derived: { tint: null, cols: null },        // deriveCols(tint), recomputed only on a new tint
    f3: [new Float32Array(3), new Float32Array(3), new Float32Array(3)],
    f2: new Float32Array(2),
  };
}

// lean (0..1, default 1) eases an overlay in: the leaning tint / gaze / pulse / shimmer blend
// toward `baseState` (the state without the overlay) by 1 - lean. `getLean`, when given, is read
// every frame instead (a glance's slow ease without a React render per frame). A flash passes 1.
function ObserverEye({ state = 'resting', size = 28, tint = null, gaze = null, pulse = false, lens = true, constrict = null, thread = 0, shimmer = 0, lean = 1, getLean = null, baseState = null, driven = false, onClick, title, className = '', ariaLabel }, ref) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(state);
  const tintRef   = useRef(tint);
  const gazeRef   = useRef(gaze);
  const pulseRef  = useRef(pulse);
  const constrictRef = useRef(constrict);
  const threadRef  = useRef(thread);
  const shimmerRef = useRef(shimmer);
  const leanRef = useRef(lean);
  const getLeanRef = useRef(getLean);
  const baseStateRef = useRef(baseState);
  const drivenRef = useRef(driven);
  const aliveRef = useRef(false);
  const holdTimerRef = useRef(0);

  const curRef = useRef(null);
  const scratchRef = useRef(null);
  if (!scratchRef.current) scratchRef.current = makeScratch();
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
        chargeT0: null, kick: null, cres: null, hold: null, kickOut: 0, shapeOutId: 0, shapeOutK: 0, phase: 0,
        spinV: 0, iridTgt: start.irid,
        // eased eyeDrive state: spin rad/s, palette weight + cols, gaze, mood, shape
        dv: { spin: 0, pal: 0, cols: cols3(), gx: 0, gy: 0, mood: 0, shapeK: 0, shapeId: 0, shapeA: 0, shapeB: 0, shapeC: 0, palLive: false, palQuiet: false, rim: 0, rimCol: [0, 0, 0] },
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
        const { tgt, tCols, tGaze, tCore, tOrbit, tShimmer, tThread, tPulse } = targets(chargeP, true);
        const e = 1 - Math.pow(0.004, dt);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          cur.cols[i][j] = lerp(cur.cols[i][j], tCols[i][j], e);
        }
        cur.speed = lerp(cur.speed, tgt.speed, e);
        const focusTarget = constrictRef.current != null
          ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
        cur.focus = lerp(cur.focus, focusTarget, e);
        // Crossing into silver (target irid up through 0.5) throws the back-spin,
        // scaled by how much colour there is to unwind.
        if (cur.iridTgt < 0.5 && tgt.irid >= 0.5) {
          cur.spinV = -(BACKSPIN_TURN / BACKSPIN_TAU) * clamp01(1 - cur.irid);
        }
        cur.iridTgt = tgt.irid;
        const eIrid = tgt.irid > cur.irid ? 1 - Math.pow(IRID_RETURN, dt) : e;
        cur.irid = lerp(cur.irid, tgt.irid, eIrid);
        cur.pulse = lerp(cur.pulse, tPulse, e);
        cur.gaze[0] = lerp(cur.gaze[0], tGaze[0], e);
        cur.gaze[1] = lerp(cur.gaze[1], tGaze[1], e);
        cur.core = lerp(cur.core, tCore, e);
        cur.orbit = lerp(cur.orbit, tOrbit, e);
        cur.shimmer = lerp(cur.shimmer, tShimmer, e);
        cur.thread = lerp(cur.thread, tThread, e);
        if (drivenRef.current) easeDrive(cur, dt);
      }
      // The swirl phase is integrated, so a speed change (state ease,
      // detonation ×4, storm turbulence) never jumps it by u_t·Δspeed.
      const o = overlay(cur, tsec);
      if (dt > 0) {
        // The back-spin coasts out exactly: ∫ v0·e^(-t/τ) over this dt.
        const decay = Math.exp(-dt / BACKSPIN_TAU);
        cur.phase += (o.speed + TURB_SPEED * o.turb + cur.dv.spin) * dt + cur.spinV * BACKSPIN_TAU * (1 - decay);
        cur.spinV *= decay;
        if (Math.abs(cur.spinV) < 1e-4) cur.spinV = 0;
      }
      o.phase = cur.phase + o.turn;
      paint(host, o, tsec);
    },

    onSnap(host) {
      // Reduced motion: no swirl, but a state change still locks in its colour,
      // and a reaction shows as a static colour hold (cur.hold).
      const cur = curRef.current;
      if (!cur) return;
      // Reduced motion snaps on prop changes only, so a slow lean would freeze at its first
      // value: the snap shows the overlay fully, as before.
      const { tgt, tCols, tGaze, tCore, tOrbit, tShimmer, tThread } = targets(1, false);
      const hold = cur.hold;
      cur.cols = (hold ? hold.cols : tCols).map(c => c.slice());
      cur.speed = tgt.speed;
      cur.focus = constrictRef.current != null
        ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
      cur.irid = hold ? 0 : tgt.irid;      // a held reaction's colour must show over silver
      cur.pulse = pulseRef.current ? 1 : 0;
      cur.gaze = tGaze.slice();
      cur.core = hold && hold.core != null ? hold.core : tCore;
      cur.orbit = tOrbit;
      cur.shimmer = tShimmer;
      cur.thread = tThread;
      paint(host, still(cur, scratchRef.current.o), 0);
    },
  });

  function currentLean() {
    const fn = getLeanRef.current;
    if (typeof fn === 'function') return clamp01(fn());
    return leanRef.current == null ? 1 : clamp01(leanRef.current);
  }

  // deriveCols for the leaning tint, cached per tint (a new array only when the tint changes).
  function derivedTint(tint) {
    const d = scratchRef.current.derived;
    if (d.tint !== tint) { d.tint = tint; d.cols = deriveCols(tint); }
    return d.cols;
  }

  // The targets the eye eases toward, written into a scratch (read before the next call).
  function targets(chargeP, useLean) {
    const S = scratchRef.current;
    const T = S.T;
    const tgt = STATES[stateRef.current] || STATES.resting;
    const tCols = (stateRef.current === 'leaning' && tintRef.current) ? derivedTint(tintRef.current) : tgt.cols;
    const tGaze = gazeRef.current || tgt.gaze;
    const tCore = tgt.charge ? lerp(CHARGE_CORE[0], CHARGE_CORE[1], chargeP) : (tgt.core || 0);
    const tOrbit = tgt.charge ? lerp(CHARGE_ORBIT[0], CHARGE_ORBIT[1], chargeP) : (tgt.orbit || 0);
    const tShimmer = Math.max(tgt.shimmer || 0, clamp01(shimmerRef.current));
    const tPulse = pulseRef.current ? 1 : 0;
    const w = useLean ? currentLean() : 1;
    T.tThread = clamp01(threadRef.current);
    // Fully leaned in: exactly today's targets (no lerp(a, b, 1) rounding).
    if (w >= 1) {
      T.tgt = tgt; T.tCols = tCols; T.tGaze = tGaze; T.tCore = tCore; T.tOrbit = tOrbit;
      T.tShimmer = tShimmer; T.tPulse = tPulse;
      return T;
    }
    const base = STATES[baseStateRef.current] || STATES[stateRef.current] || STATES.resting;
    const bCore = base.charge ? lerp(CHARGE_CORE[0], CHARGE_CORE[1], chargeP) : (base.core || 0);
    const bOrbit = base.charge ? lerp(CHARGE_ORBIT[0], CHARGE_ORBIT[1], chargeP) : (base.orbit || 0);
    const lt = S.leanTgt;
    lt.speed = lerp(base.speed, tgt.speed, w);
    lt.focus = lerp(base.focus, tgt.focus, w);
    lt.irid = lerp(base.irid, tgt.irid, w);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) S.leanCols[i][j] = lerp(base.cols[i][j], tCols[i][j], w);
    S.leanGaze[0] = lerp(base.gaze[0], tGaze[0], w);
    S.leanGaze[1] = lerp(base.gaze[1], tGaze[1], w);
    T.tgt = lt; T.tCols = S.leanCols; T.tGaze = S.leanGaze;
    T.tCore = lerp(bCore, tCore, w);
    T.tOrbit = lerp(bOrbit, tOrbit, w);
    T.tShimmer = lerp(base.shimmer || 0, tShimmer, w);
    T.tPulse = tPulse * w;
    return T;
  }

  // The eased baseline with no reaction on it, copied into `o` (the frame scratch).
  function still(cur, o) {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.cols[i][j] = cur.cols[i][j];
    o.gaze[0] = cur.gaze[0]; o.gaze[1] = cur.gaze[1];
    o.speed = cur.speed; o.focus = cur.focus; o.irid = cur.irid; o.pulse = cur.pulse;
    o.core = cur.core; o.orbit = cur.orbit; o.shimmer = cur.shimmer; o.thread = cur.thread;
    o.turb = 0; o.kick = 0; o.kickKind = 0; o.kickDir = 0; o.phase = 0;
    o.shape = 0; o.shapeK = 0; o.shapeA = 0; o.shapeB = 0; o.shapeC = 0; o.turn = 0; o.rim = 0;
    return o;
  }

  // eyeDrive -> cur.dv, eased; a channel past its hold eases back to rest. Releasing a
  // palette that had taken the eye over throws the back-spin, like any return to silver.
  function easeDrive(cur, dt) {
    const d = cur.dv;
    const D = eyeDrive;
    const t = performance.now();
    const e = 1 - Math.pow(DRIVE_EASE, dt);
    d.spin = lerp(d.spin, live(D.spin, t) ? D.spin.v : 0, e);
    const palLive = live(D.palette, t);
    if (palLive) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) d.cols[i][j] = D.palette.cols[i][j];
      d.palQuiet = D.palette.quiet;
    }
    // A reaction running at the release owns the unwind (e.g. /SOL's burst coasts forward).
    if (d.palLive && !palLive && d.pal > 0.5 && cur.irid > 0.5 && !cur.kick && !d.palQuiet) {
      cur.spinV = -(BACKSPIN_TURN / BACKSPIN_TAU) * d.pal;
    }
    d.palLive = palLive;
    d.pal = lerp(d.pal, palLive ? D.palette.w : 0, palLive ? e : 1 - Math.pow(IRID_RETURN, dt));
    const gLive = live(D.gaze, t);
    d.gx = lerp(d.gx, gLive ? D.gaze.x : 0, e);
    d.gy = lerp(d.gy, gLive ? D.gaze.y : 0, e);
    d.mood = lerp(d.mood, live(D.mood, t) ? D.mood.m : 0, e);
    const sLive = live(D.shape, t);
    if (sLive) { d.shapeId = D.shape.id; d.shapeA = D.shape.a; d.shapeB = D.shape.b; d.shapeC = D.shape.c; }
    d.shapeK = lerp(d.shapeK, sLive ? D.shape.k : 0, e);
    const rLive = live(D.rim, t);
    if (rLive) for (let i = 0; i < 3; i++) d.rimCol[i] = D.rim.col[i];   // the colour stays while it fades
    d.rim = lerp(d.rim, rLive ? D.rim.w : 0, e);
  }

  // The drive laid over the baseline (before any kick): palette takes the eye off silver,
  // mood contracts and agitates (+) or dilates and slows (-), gaze offsets, shape morphs.
  function applyDrive(cur, o) {
    const d = cur.dv;
    if (d.pal > 0.001) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.cols[i][j] = lerp(o.cols[i][j], d.cols[i][j], d.pal);
      o.irid *= 1 - d.pal;
    }
    const ang = Math.max(0, d.mood), calm = Math.max(0, -d.mood);
    o.focus = Math.min(1, Math.max(0, o.focus + 0.62 * ang - 0.25 * calm));   // a hard, angry stare
    o.speed *= 1 + 1.2 * ang - 0.5 * calm;
    o.turb = Math.max(o.turb, 0.85 * ang);
    o.gaze[0] += d.gx; o.gaze[1] += d.gy;
    if (d.rim > 0.001) { o.rim = d.rim; for (let i = 0; i < 3; i++) o.rimCol[i] = d.rimCol[i]; }
    if (d.shapeK > 0.001) { o.shape = d.shapeId; o.shapeK = d.shapeK; o.shapeA = d.shapeA; o.shapeB = d.shapeB; o.shapeC = d.shapeC; }
  }

  // The baseline with the crescendo, or else the live kick, laid over it.
  function overlay(cur, tsec) {
    const S = scratchRef.current;
    const o = still(cur, S.o);
    if (drivenRef.current) applyDrive(cur, o);
    let hue = null, level = 0;
    const c = cur.cres;
    if (c) {
      if (c.t0 == null) { c.t0 = tsec; c.core0 = cur.core; c.focus0 = cur.focus; }
      if (tsec - c.t0 >= CRESCENDO_S) cur.cres = null;
      else {
        const x = crescendoAt(c, tsec, S.cres);
        const w = x.w;
        o.core = lerp(cur.core, x.core, w);
        o.focus = lerp(cur.focus, x.focus, w);
        o.turb = x.turb * w;
        o.speed = cur.speed * lerp(1, x.speedMul, w);
        const j = 0.03 * x.jitter * w;     // storm: the gaze shakes, ±0.03
        o.gaze[0] = cur.gaze[0] + j * Math.sin(tsec * 47.3);
        o.gaze[1] = cur.gaze[1] + j * Math.sin(tsec * 39.1 + 1.3);
        if (x.kick > 0) {
          o.kick = x.kick; o.kickKind = KICK.ring; o.kickDir = 1;
          hue = WHITE_GOLD_COLS; level = x.kick;
        }
      }
    } else if (cur.kick) {
      const k = cur.kick;
      if (k.t0 == null) k.t0 = tsec;
      let v = kickLevel(k, tsec);
      if (tsec - k.t0 >= k.dur) {
        // A timeline may end turned: fold its last turn into the phase, so no snap back.
        cur.phase += k.endTurn * k.dir;
        cur.kick = null;
      } else {
        if (k.keys || k.curve) {
          const x = (tsec - k.t0) / k.dur;
          const s = k.curve ? k.curve(x, S.key) : sampleKeys(k.keys, x, S.key);
          // A graceful release (kick({ release, tag })): everything the timeline drives fades
          // out over rel.dur; the swirl keeps its current turn (folded in when it ends).
          let f = 1;
          if (k.rel) {
            if (k.rel.t0 == null) k.rel.t0 = tsec;
            f = 1 - smooth(clamp01((tsec - k.rel.t0) / k.rel.dur));
            if (f <= 0) { cur.phase += s.turn * k.dir; cur.kick = null; cur.kickOut = 0; return o; }
            s.level = (Number.isNaN(s.level) ? 1 : s.level) * f;
            s.shapeK *= f; s.focus *= f; s.turb *= f; s.gazeX *= f; s.gazeY *= f;
          }
          if (k.backspinAt != null && !k.spun && x >= k.backspinAt) {
            // A scripted brake: the reverse coast a return to silver gets, at the reaction's peak.
            k.spun = true;
            cur.spinV = -(BACKSPIN_TURN / BACKSPIN_TAU) * k.peak;
          }
          if (!Number.isNaN(s.level)) v = s.level * k.peak;
          o.turn = s.turn * k.dir;
          o.focus = Math.min(1, Math.max(0, o.focus + s.focus));
          o.gaze[0] += s.gazeX; o.gaze[1] += s.gazeY;
          o.turb = Math.max(o.turb, s.turb);
          if (k.shape) {
            o.shape = k.shape; o.shapeA = s.shapeA; o.shapeB = s.shapeB; o.shapeC = s.shapeC;
            // The same figure re-kicked mid-morph holds its form while the new timeline takes over.
            // Held whole until x 0.2, gone by 0.4 (every figure timeline has formed by then).
            o.shapeK = Math.max(s.shapeK, f * k.shapeFrom * (1 - smooth(clamp01((x - 0.2) / 0.2))));
          }
        } else if (k.cols && !k.spun && tsec - k.t0 > ATTACK_S && v < 0.5 * k.peak) {
          // The colour is unwinding back to silver: the same back-spin a state return gets.
          k.spun = true;
          if (cur.irid > 0.5) cur.spinV = -(BACKSPIN_TURN / BACKSPIN_TAU) * k.peak * cur.irid;
        }
        o.kick = v; o.kickKind = k.kind; o.kickDir = k.dir;
        hue = k.cols; level = v;
      }
    }
    if (hue && level > 0) {
      const kc = hue;
      const t = Math.min(1, level);
      for (let i = 0; i < 3; i++) for (let jj = 0; jj < 3; jj++) o.cols[i][jj] = lerp(o.cols[i][jj], kc[i][jj], t);
      // A tinted kick owns the colour: silver steps aside by its level, or the hue is
      // invisible on a resting eye (irid 1 replaces the nebula outright). The crescendo's
      // white-gold rides on its ring term, so aether keeps its silver.
      if (!c) o.irid *= 1 - t;
    }
    cur.kickOut = o.kick;
    cur.shapeOutId = o.shape; cur.shapeOutK = o.shapeK;
    return o;
  }

  // Single controller of the GL push, shared by the frame loop and the
  // reduced-motion snap — both must emit exactly the same call sequence.
  function paint(host, o, tsec) {
    const { gl, U } = host;
    const { f3, f2 } = scratchRef.current;
    const nrm = (c, f) => { f[0] = c[0] / 255; f[1] = c[1] / 255; f[2] = c[2] / 255; return f; };
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.u_t, tsec);
    gl.uniform1f(U.u_focus, o.focus);
    gl.uniform1f(U.u_irid, o.irid);
    gl.uniform1f(U.u_speed, o.speed);
    gl.uniform1f(U.u_pulse, o.pulse);
    gl.uniform3fv(U.c0, nrm(o.cols[0], f3[0]));
    gl.uniform3fv(U.c1, nrm(o.cols[1], f3[1]));
    gl.uniform3fv(U.c2, nrm(o.cols[2], f3[2]));
    f2[0] = o.gaze[0]; f2[1] = o.gaze[1];
    gl.uniform2fv(U.u_gaze, f2);
    gl.uniform1f(U.u_core, o.core);
    gl.uniform1f(U.u_orbit, o.orbit);
    gl.uniform1f(U.u_shimmer, o.shimmer);
    gl.uniform1f(U.u_thread, o.thread);
    gl.uniform1f(U.u_turb, o.turb);
    gl.uniform1f(U.u_kick, o.kick);
    gl.uniform1f(U.u_kickKind, o.kickKind);
    gl.uniform1f(U.u_kickDir, o.kickDir);
    gl.uniform1f(U.u_phase, o.phase);
    gl.uniform1f(U.u_shape, o.shape);
    gl.uniform1f(U.u_shapeK, o.shapeK);
    gl.uniform1f(U.u_shapeA, o.shapeA);
    gl.uniform1f(U.u_shapeB, o.shapeB);
    gl.uniform1f(U.u_shapeC, o.shapeC);
    gl.uniform1f(U.u_px, 2 / Math.max(1, gl.drawingBufferWidth || 1));
    gl.uniform1f(U.u_fore, 1);
    gl.uniform1f(U.u_rim, o.rim);
    gl.uniform3fv(U.u_rimCol, nrm(o.rimCol, f3[0]));
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
    // keys: optional timeline [{ t: 0..1, level, turn (rad), focus (+), shapeK, shapeA, shapeB,
    // gazeX, gazeY, turb }] for scripted multi-stage reactions (collapse -> rebound, 360 turns).
    // shape: the SHAPE id the keys' shapeK/A/B drive.
    // curve: instead of keys, a continuous (x 0..1, dst) => dst writing the same fields every
    // frame (for motion that must never stop at a key: a vortex, a flap). backspinAt: the x
    // at which the scripted brake fires the reverse coast.
    // tag: names a family of sustained kicks (a lifecycle). release: true fades out the
    // running kick of that tag over durationMs instead of starting a new one.
    kick({ kind, tint: kTint = null, tint2 = null, dir = 1, durationMs, strength = 1, keys = null, shape = 0, curve = null, backspinAt = null, tag = null, release = false } = {}) {
      const cur = curRef.current;
      if (!cur || !aliveRef.current) return;
      if (release) {
        const k = cur.kick;
        if (k && k.tag === tag && !k.rel) k.rel = { t0: null, dur: Math.max(0.1, (durationMs || 0) / 1000) };
        if (cur.hold && cur.holdTag === tag) {   // reduced motion: drop the static hold now
          clearTimeout(holdTimerRef.current); cur.hold = null; cur.holdTag = null; snap();
        }
        return;
      }
      if (prefersReducedMotion()) {
        if (kTint) { holdStatic({ cols: kickCols(kTint, tint2) }, durationMs); cur.holdTag = tag; }
        return;
      }
      if (cur.cres) return;   // the crescendo outranks every reaction
      const nk = !curve && Array.isArray(keys) && keys.length ? normaliseKeys(keys) : null;
      // The turn a timeline ends on, folded into the phase when it ends (sampled once, here).
      const endTurn = typeof curve === 'function' ? (curve(1, {}).turn || 0)
        : nk && nk.f.turn ? nk.f.turn[nk.f.turn.length - 1] : 0;
      // Newest signature wins; its attack starts from wherever the last one is.
      cur.kick = {
        kind, cols: kTint ? kickCols(kTint, tint2) : null, dir: dir < 0 ? -1 : 1, t0: null,
        dur: Math.max((durationMs || 0) / 1000, ATTACK_S + 0.05),
        peak: clamp01(strength), from: Math.min(1, cur.kickOut || 0),
        keys: nk, curve: typeof curve === 'function' ? curve : null, endTurn,
        backspinAt: backspinAt == null ? null : clamp01(backspinAt), shape: shape || 0, spun: false,
        shapeFrom: shape && cur.shapeOutId === shape ? clamp01(cur.shapeOutK) : 0,
        tag, rel: null,
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
    leanRef.current = lean; getLeanRef.current = getLean; baseStateRef.current = baseState;
    drivenRef.current = driven;
    snap();
  }, [state, tint, gaze, pulse, constrict, thread, shimmer, lean, getLean, baseState, driven]);

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
