// Geometry replicas of the fluid + air FILAMENT chains (GLSL ports, shimmer and curl included) and of
// gasSpriteThread, for tests (not a test file itself). Desktop fit: camera z 4.43, vfov 42°, 1000 px tall (CSS px).
// Metrics per lane: neighbour-pair coverage (mean dash / on-screen gap; < 1 = a visible gap), dash-off-path
// (max distance of the true path from the dash, px) and step (Task 7g: the sideways jump where two dashes meet, px).
// The dash is bent like the GLSL (ahead half along dirA, back half along dirB); straight: true = the 7f straight dash.
import { snoise, curlFluid, curlAir } from './glslNoise';
import { FIL_ASPECT, FIL_JITTER, FIL_GAP_CLOSE, FIL_GAP_ASPECT, GAS_PX_FLOOR, GAS_Z_REF } from '../gasStreak';
import { PLANET_TUNE } from '../planetLook';
import { FLUID_FIL_SHIMMER } from '../../../fluid/particleFlowBuffers';
import { AIR_TILT_MIN, AIR_TILT_MAX, AIR_WANDER, AIR_WANDER_R, AIR_WANDER_RATE, AIR_FIL_CURL, AIR_FIL_ASPECT } from '../../../air/atmosphericFlowBuffers';

const fract = (x) => x - Math.floor(x);
export const gasHash = (a, b) => fract(Math.sin(a * 91.7 + b * 47.3) * 43758.5453);
const mix = (a, b, t) => a + (b - a) * t;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const CAM_Z = GAS_Z_REF;
const F = 500 / Math.tan((21 * Math.PI) / 180);
export const proj = (p) => { const z = CAM_Z - p[2]; return [(F * p[0]) / z, (F * p[1]) / z, z]; };

export const T = 37.0;
export const DT = 1 / 30;

// ── fluid ─────────────────────────────────────────────────────────────────────
const knotCenter = (t) => {
  const p = t * 6.283185307, cq = Math.cos(3 * p);
  return [(1 + 0.4 * cq) * Math.cos(2 * p), (1 + 0.4 * cq) * Math.sin(2 * p), 0.4 * Math.sin(3 * p)];
};
function knotPos(ph, aPhase, aOffset, aRadius) {
  const t = fract(aPhase + ph * (0.6 + aOffset * 0.4));
  const center = knotCenter(t), tan = nrm(sub(knotCenter(t + 0.001), center));
  const up = Math.abs(tan[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  const n = nrm(cross(tan, up)), b = cross(tan, n);
  const gN = -n[1] * 0.015, gB = -b[1] * 0.015, ang = aOffset * 6.283185307, rad = aRadius * 0.32;
  return { base: center.map((x, i) => x + n[i] * (Math.cos(ang) * rad + gN) + b[i] * (Math.sin(ang) * rad + gB)), center };
}
// The filament's full position at knot phase ph (fluid VS: base + shimmer x FLUID_FIL_SHIMMER + curl drift).
export function fluidFil(ph, p, shimK = FLUID_FIL_SHIMMER) {
  const { base, center } = knotPos(ph, p.phase, p.offset, p.radius);
  const q = base.map((x) => x * 8);
  const j = [snoise([q[0] + T, q[1], q[2]]), snoise([q[0], q[1] + T, q[2]]), snoise([q[0], q[1], q[2] + T])].map((x) => x * 0.012 * shimK);
  const c = curlFluid(center.map((x) => x * 2 + T * 0.1)).map((x) => x * 0.02);
  return { pos: [base[0] + j[0] + c[0], base[1] + j[1] + c[1], base[2] + j[2] + c[2]], base };
}

// ── air ───────────────────────────────────────────────────────────────────────
function airRing(angle, p) {
  const eye = Math.sin(p.alt * 3.14159);
  const radius = mix(0.15 + eye * 1.1, 1.35, p.ion);
  let v = [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
  const th = mix(AIR_TILT_MIN, AIR_TILT_MAX, gasHash(p.lane, 0.71)), az = 6.283185307 * gasHash(p.lane, 0.13);
  const u = [Math.cos(az), 0, Math.sin(az)], c = Math.cos(th), s = Math.sin(th);
  const cr = cross(u, v), d = u[0] * v[0] + u[2] * v[2];
  v = v.map((x, k) => x * c + cr[k] * s + u[k] * d * (1 - c));
  return [v[0], v[1] - 1.2 + p.alt * 2.5, v[2]];
}
export function airRate(p) { return (0.4 + p.speed * 0.7) * (p.alt > 0.5 ? 1 : -0.85) * (p.ion ? 2.8 : 1); }
// Filament position at orbit angle (airDisplace for aRole 1: periodic y-noise, wander, damped curl, no shimmer).
export function airFilAt(angle, p, curlK = AIR_FIL_CURL) {
  const pos = airRing(angle, p);
  pos[1] += snoise([Math.cos(angle) * 0.25, Math.sin(angle) * 0.25 + T * 0.07, p.alt * 4]) * 0.15;
  pos[1] += snoise([Math.cos(angle) * AIR_WANDER_R + p.lane * 3.1, Math.sin(angle) * AIR_WANDER_R, T * AIR_WANDER_RATE]) * AIR_WANDER;
  const t = T * 0.08;
  const cu = curlAir([pos[0] * 0.9 + t, pos[1] * 0.9 + t * 0.6, pos[2] * 0.9 + t * 0.8]);
  return pos.map((x, k) => x + cu[k] * 0.18 * 0.3 * curlK);
}

// ── gasSpriteThread (JS mirror of the GLSL) ──────────────────────────────────
// now/prev/back/ahead: screen px. Returns the dash's total length and unit direction (screen, y up).
export function spriteThread(now, prev, back, ahead, w, jit, aspect, opts = {}) {
  const gain = opts.gain ?? PLANET_TUNE.streakGain, pointMax = opts.pointMax ?? 1e4;
  const vx = (now[0] - prev[0]) / DT, vy = (now[1] - prev[1]) / DT, sp = Math.hypot(vx, vy);
  const tx = ahead[0] - back[0], ty = ahead[1] - back[1], tl = Math.hypot(tx, ty);
  const gapPx = Math.max(Math.hypot(now[0] - back[0], now[1] - back[1]), Math.hypot(ahead[0] - now[0], ahead[1] - now[1]));
  const vdir = sp > 1e-3 ? [vx / sp, vy / sp] : [1, 0];
  const dir = opts.velocityDir ? vdir : tl > 1e-3 ? [tx / tl, ty / tl] : vdir;
  const Ls = Math.min(sp * gain, Math.max(aspect - 1, 0) * w) * (1 + FIL_JITTER * (2 * jit - 1));
  const Lg = opts.movingOnly && sp <= 1e-3 ? 0 : Math.min((opts.gapClose ?? FIL_GAP_CLOSE) * gapPx - w, ((opts.gapAspect ?? FIL_GAP_ASPECT) - 1) * w);
  const L = Math.min(Math.max(Ls, Lg, 0), Math.max(pointMax - w, 0));
  // bent dash (Task 7g): each half aims at its own lane-neighbour sample (ahead half at ahead, back half at back)
  const unit = (x, y, f) => { const l = Math.hypot(x, y); return l > 1e-3 ? [x / l, y / l] : f; };
  const bent = !opts.straight && tl > 1e-3;
  const dirA = bent ? unit(ahead[0] - now[0], ahead[1] - now[1], dir) : dir;
  const dirB = bent ? unit(now[0] - back[0], now[1] - back[1], dir) : dir;
  return { total: w + L, dir, dirA, dirB };
}

const q = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];

// One snapshot of a flow's filaments. flow = 'fluid' | 'air'; b = buildBuffers(); rate = the flow's phase rate;
// ph = clock phase. Returns { cov, dev } arrays plus their quantiles.
// legacy: true = the 828e26a0 rule (time-secant direction, gap minimum only while moving).
export function measureThreads(flow, b, { ph = 0, rate, shimK, curlK, aspect, gapClose = true, legacy = false, straight = false, gapAspect, closeK, lanes: laneIds = null, onSprite = null, step = 1, devSteps = 24 } = {}) {
  const cov = [], dev = [], covAlong = [], lat = [], latW = [], gapVis = [], stepPx = [];
  const lanes = new Map();
  b.lanes.forEach((k, i) => {
    if (k < 0 || (laneIds && !laneIds.includes(k))) return;
    if (!lanes.has(k)) lanes.set(k, []);
    lanes.get(k).push(i);
  });
  for (const idx of lanes.values()) {
    idx.sort((x, y) => b.phases[x] - b.phases[y]);
    const P = [], TT = [], DD = [], DB = [], WW = [];
    for (let jj = 0; jj < idx.length; jj++) {
      const i = idx[jj];
      let at, aspectMax, w, jit;
      if (flow === 'fluid') {
        const p = { phase: b.phases[i], offset: b.offsets[i], radius: b.radii[i] };
        const s = 0.6 + p.offset * 0.4;
        at = (d) => proj(fluidFil(ph + d / s, p, shimK).pos); // d: along offset in aPhase units
        const nowF = fluidFil(ph, p, shimK);
        const prevBase = knotPos(ph - DT * rate, p.phase, p.offset, p.radius).base;
        const prevPos = prevBase.map((x, k) => x + nowF.pos[k] - nowF.base[k]);
        at.prev = proj(prevPos);
        aspectMax = aspect ?? FIL_ASPECT;
        w = Math.max(PLANET_TUNE.filWidth * (GAS_Z_REF / proj(nowF.pos)[2]) * (0.75 + 0.5 * p.radius), GAS_PX_FLOOR);
        jit = gasHash(p.phase, p.radius);
      } else {
        const p = { alt: b.alts[i], ion: b.ions[i], speed: b.speeds[i], lane: b.lanes[i] };
        const ang0 = b.phases[i] * 6.28318 + ph * airRate(p);
        at = (d) => proj(airFilAt(ang0 + d * 6.28318, p, curlK));
        at.prev = proj(airFilAt(ang0 - DT * rate * airRate(p), p, curlK));
        aspectMax = aspect ?? AIR_FIL_ASPECT;
        w = Math.max(PLANET_TUNE.filWidth * (GAS_Z_REF / at(0)[2]) * (0.75 + 0.5 * b.sizes[i]), GAS_PX_FLOOR);
        jit = gasHash(b.phases[i], b.seeds[i]);
      }
      const now = at(0), g = b.gaps[i];
      const back = gapClose ? at(-g) : now, ahead = gapClose ? at(g) : now;
      const sprite = spriteThread(now, at.prev, back, ahead, w, jit, aspectMax, { velocityDir: legacy, movingOnly: legacy, straight: straight || legacy, gapAspect, gapClose: closeK });
      P.push(now); TT.push(sprite.total); DD.push(sprite.dirA); DB.push(sprite.dirB); WW.push(w);
      if (onSprite) onSprite({ now, back, ahead, w, sprite, at, g });
      if (jj % step === 0) {
        // dash-off-path: the true path near the particle vs the dash (centre now; the ahead half along dirA, the back
        // half along -dirB, each total / 2 long; a straight dash has dirA = dirB = dir)
        let dv = 0;
        const half = sprite.total / 2;
        const gpx = Math.max(Math.hypot(ahead[0] - back[0], ahead[1] - back[1]) / 2, 1e-3);
        const span = gapClose ? g * Math.max(1.6, (1.3 * half) / gpx) : Math.max(g, 1e-4) * 3;
        for (let e = -devSteps; e <= devSteps; e++) {
          const pt = at((e / devSteps) * span);
          const rx = pt[0] - now[0], ry = pt[1] - now[1];
          let best = Infinity;
          for (const [d, sg] of [[sprite.dirA, 1], [sprite.dirB, -1]]) {
            const al = sg * (rx * d[0] + ry * d[1]);
            if (al < 0 || al > half) continue;
            best = Math.min(best, Math.abs(rx * d[1] - ry * d[0]));
          }
          if (best < Infinity) dv = Math.max(dv, best);
        }
        dev.push(dv);
      }
    }
    for (let j = 0; j < P.length; j++) {
      const jn = (j + 1) % P.length, gp = Math.hypot(P[jn][0] - P[j][0], P[jn][1] - P[j][1]);
      if (gp > 0.5) cov.push((TT[j] + TT[jn]) / 2 / gp);
      // split the neighbour offset along j's ahead half (a gap) and across it (thread width / fray)
      const dx = P[jn][0] - P[j][0], dy = P[jn][1] - P[j][1];
      const al = Math.abs(dx * DD[j][0] + dy * DD[j][1]), la = Math.abs(dx * DD[j][1] - dy * DD[j][0]);
      if (al > 0.5) covAlong.push((TT[j] + TT[jn]) / 2 / al);
      gapVis.push(al - (TT[j] + TT[jn]) / 2); // > 1 px: a gap the eye sees between soft-edged dashes
      lat.push(la);
      latW.push(la / WW[j]);
      // step (Task 7g): the next particle off j's ahead-half line, and j off the next one's back-half line: the
      // sideways jump where two dashes meet (a staircase when > the core half-width)
      if (Math.hypot(dx, dy) > 0.5) stepPx.push(Math.max(la, Math.abs(dx * DB[jn][1] - dy * DB[jn][0])));
    }
  }
  for (const a of [cov, dev, covAlong, lat, latW, stepPx]) a.sort((x, y) => x - y);
  return {
    cov, dev, covAlong, lat, stepPx,
    stepP50: q(stepPx, 0.5), stepP95: q(stepPx, 0.95), stepMax: stepPx[stepPx.length - 1],
    openAlong: covAlong.filter((x) => x < 1).length / covAlong.length,
    openVis: gapVis.filter((x) => x > 1).length / gapVis.length,
    latP50: q(lat, 0.5), latP95: q(lat, 0.95), latOverW: latW.filter((x) => x > 1).length / latW.length,
    open: cov.filter((x) => x < 1).length / cov.length,
    covP5: q(cov, 0.05), covP1: q(cov, 0.01),
    devP50: q(dev, 0.5), devP95: q(dev, 0.95), devP99: q(dev, 0.99),
  };
}
