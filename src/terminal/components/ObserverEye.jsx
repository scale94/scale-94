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
//
// Baked-in per spec §9: frames come from rAF with a setTimeout watchdog — rAF
// gives 60fps when the tab is visible; when a surface suppresses rAF while still
// compositing (embedded preview panes report `hidden` forever), the watchdog
// keeps the eye alive; when the tab is *genuinely* hidden the browser throttles
// the timer to ~1fps, which is the battery pause. Under prefers-reduced-motion
// the swirl freezes but state changes still snap to their locked colour.
import { useEffect, useRef } from 'react';
import { useShaderCanvas } from '../gl/useShaderCanvas';
import { VS, FS, UNIFORMS } from './observerEyeShader';

const STATES = {
  resting:   { irid: 1, cols: [[210,220,232],[150,170,185],[120,200,220]], speed: 0.05, focus: 0.00, gaze: [0, 0] },
  leaning:   { irid: 0, cols: [[56,189,248],[6,182,212],[170,235,255]],    speed: 0.11, focus: 0.34, gaze: [0.12, -0.08] },
  armed:     { irid: 0, cols: [[255,215,0],[217,70,239],[255,150,60]],     speed: 0.14, focus: 0.58, gaze: [0, 0] },
  compiling: { irid: 0, cols: [[167,139,250],[122,184,0],[205,180,255]],   speed: 0.20, focus: 0.86, gaze: [0, 0] },
  complete:  { irid: 0, cols: [[20,184,166],[185,240,228],[70,205,185]],   speed: 0.07, focus: 0.22, gaze: [0, 0] },
};

// A leaning tint (the suggested tab's hue) → a 3-shade nebula palette.
function deriveCols(t) {
  return [
    [t[0], t[1], t[2]],
    [Math.round(t[0] * 0.5), Math.round(t[1] * 0.5), Math.round(t[2] * 0.62)],
    [Math.round((t[0] + 230) / 2), Math.round((t[1] + 240) / 2), Math.round((t[2] + 255) / 2)],
  ];
}

export default function ObserverEye({ state = 'resting', size = 28, tint = null, gaze = null, pulse = false, lens = true, constrict = null, onClick, title, className = '', ariaLabel }) {
  const canvasRef = useRef(null);
  const stateRef  = useRef(state);
  const tintRef   = useRef(tint);
  const gazeRef   = useRef(gaze);
  const pulseRef  = useRef(pulse);
  const constrictRef = useRef(constrict);

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
      };
    },

    draw(host, { dt, tsec }) {
      const cur = curRef.current;
      if (dt > 0) {
        const lerp = (a, b, t) => a + (b - a) * t;
        const { tgt, tCols, tGaze } = targets();
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
      }
      paint(host, cur, tsec);
    },

    onSnap(host) {
      // Reduced motion: no swirl, but a state change still locks in its colour.
      const cur = curRef.current;
      if (!cur) return;
      const { tgt, tCols, tGaze } = targets();
      cur.cols = tCols.map(c => c.slice());
      cur.speed = tgt.speed;
      cur.focus = constrictRef.current != null
        ? Math.max(tgt.focus, constrictRef.current) : tgt.focus;
      cur.irid = tgt.irid;
      cur.pulse = pulseRef.current ? 1 : 0;
      cur.gaze = tGaze.slice();
      paint(host, cur, 0);
    },
  });

  function targets() {
    const tgt = STATES[stateRef.current] || STATES.resting;
    const tCols = (stateRef.current === 'leaning' && tintRef.current) ? deriveCols(tintRef.current) : tgt.cols;
    const tGaze = gazeRef.current || tgt.gaze;
    return { tgt, tCols, tGaze };
  }

  // Single controller of the GL push, shared by the frame loop and the
  // reduced-motion snap — both must emit exactly the same call sequence.
  function paint(host, cur, tsec) {
    const { gl, U } = host;
    const nrm = c => new Float32Array([c[0] / 255, c[1] / 255, c[2] / 255]);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U.u_t, tsec);
    gl.uniform1f(U.u_focus, cur.focus);
    gl.uniform1f(U.u_irid, cur.irid);
    gl.uniform1f(U.u_speed, cur.speed);
    gl.uniform1f(U.u_pulse, cur.pulse);
    gl.uniform3fv(U.c0, nrm(cur.cols[0]));
    gl.uniform3fv(U.c1, nrm(cur.cols[1]));
    gl.uniform3fv(U.c2, nrm(cur.cols[2]));
    gl.uniform2fv(U.u_gaze, new Float32Array(cur.gaze));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  useEffect(() => {
    stateRef.current = state; tintRef.current = tint; gazeRef.current = gaze; pulseRef.current = pulse;
    constrictRef.current = constrict;
    snap();
  }, [state, tint, gaze, pulse, constrict]);

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
