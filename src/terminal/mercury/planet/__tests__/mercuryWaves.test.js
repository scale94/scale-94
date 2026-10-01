import { describe, it, expect } from 'vitest';
import {
  MODE_OMEGA, MODE_GAMMA, MODE_WEIGHTS, rayleighOmega, capillaryOmega, DROP_R_M,
  WAVE_KR, WAVE_C_PHASE, WAVE_C_GROUP, IMPULSE_SLOTS, IMPULSE_LIFE_S, WAVE_DAMP_PER_S,
  legendre, dLegendre, modeResponse, createImpulses, addImpulse, createImpulseFrame, impulseFrame,
  spinBulge, BULGE_MAX, SHAPE_MAX, shapeHeight, createWake, wakeImpulse, WAKE_EVERY_S, LIQUID_TAU,
  RELEASE_MODE_AMP, WAKE_WAVE_AMP,
  WAKE_FULL_OMEGA, WAKE_SLIP, slipDirWorld, WAVE_C_FRONT, rippleSlope, WAVE_DIMPLE_S, WAVE_SHARP,
  WAVE_DIMPLE_RAD, WAVE_DIMPLE_GAIN, WAVE_DIMPLE_AA_LO, WAVE_DIMPLE_AA_HI, dimpleAA,
} from '../mercuryWaves';
import { MAX_OMEGA } from '../mercuryBody';

const fib = (n) => Array.from({ length: n }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const a = i * Math.PI * (3 - Math.sqrt(5));
  return [r * Math.cos(a), y, r * Math.sin(a)];
});

describe('Rayleigh body modes of the bead', () => {
  it('frequency ratios are 1 : 1.936 : 3 (ℓ = 2, 3, 4)', () => {
    expect(MODE_OMEGA[1] / MODE_OMEGA[0]).toBeCloseTo(Math.sqrt(30 / 8), 9);
    expect(MODE_OMEGA[1] / MODE_OMEGA[0]).toBeCloseTo(1.936, 3);
    expect(MODE_OMEGA[2] / MODE_OMEGA[0]).toBeCloseTo(3, 9);
  });

  it('damping ratios are 1 : 2.8 : 5.4 (Lamb)', () => {
    expect(MODE_GAMMA[1] / MODE_GAMMA[0]).toBeCloseTo(2.8, 9);
    expect(MODE_GAMMA[2] / MODE_GAMMA[0]).toBeCloseTo(5.4, 9);
  });

  it('a real 1 cm Hg bead rings at ~16.9 rad/s; shown slowed so ℓ=2 reads in 1.5–3 s', () => {
    expect(rayleighOmega(2, DROP_R_M)).toBeCloseTo(16.93, 1);
    const period = (2 * Math.PI) / MODE_OMEGA[0];
    expect(period).toBeGreaterThan(1.5);
    expect(period).toBeLessThan(3);
  });

  it('an impulse starts at rest, dents inward first, and has decayed by IMPULSE_LIFE_S', () => {
    expect(modeResponse(0, 0)).toBe(0);
    expect(modeResponse(0, 0.05)).toBeLessThan(0);
    expect(Math.abs(modeResponse(0, IMPULSE_LIFE_S))).toBeLessThan(0.01 * MODE_WEIGHTS[0]);
  });
});

describe('capillary ripples', () => {
  it('obey ω² = σk³/ρ: doubling k multiplies ω by 2^1.5', () => {
    expect(capillaryOmega(2000) / capillaryOmega(1000)).toBeCloseTo(2 ** 1.5, 9);
  });

  it('group speed is 1.5 × phase speed; a ring reaches 90° of arc in 0.5–1.5 s', () => {
    expect(WAVE_C_GROUP / WAVE_C_PHASE).toBeCloseTo(1.5, 12);
    const t90 = (Math.PI / 2) / WAVE_C_GROUP;
    expect(t90).toBeGreaterThan(0.5);
    expect(t90).toBeLessThan(1.5);
    expect(WAVE_KR).toBeGreaterThan(8);
  });

  // Dense liquid with high surface tension: one dispersive train, not a groove.
  const zeros = (age, th0, th1) => {
    const z = []; let prev = rippleSlope(th0, age, 0);
    for (let th = th0 + 1e-4; th < th1; th += 1e-4) { const v = rippleSlope(th, age, 0); if (prev * v < 0) z.push(th); prev = v; }
    return z;
  };

  it('is chirped: crests bunch at the leading edge and widen behind it (shorter waves outrun longer ones)', () => {
    const age = 0.5;
    const z = zeros(age, 0.3, WAVE_C_FRONT * age);
    expect(z.length).toBeGreaterThan(6);
    const gapBehind = z[1] - z[0];
    const gapFront = z[z.length - 1] - z[z.length - 2];
    expect(gapFront).toBeLessThan(0.7 * gapBehind);
  });

  it('short waves die first (viscous damping ∝ k²): the front fades faster than the tail', () => {
    const peak = (age, lo, hi) => { let m = 0; for (let th = lo; th < hi; th += 2e-4) m = Math.max(m, Math.abs(rippleSlope(th, age, 0))); return m; };
    // the same k sits at the same th / age; compare a high-k and a low-k point a while apart
    // windows span several crests at both ages
    const hiK = (age) => peak(age, 1.2 * WAVE_C_GROUP * age, 1.45 * WAVE_C_GROUP * age);
    const loK = (age) => peak(age, 0.75 * WAVE_C_GROUP * age, 1.0 * WAVE_C_GROUP * age);
    expect(hiK(1.0) / hiK(0.5)).toBeLessThan(0.9 * (loK(1.0) / loK(0.5)));
  });

  it('has sharp troughs and round crests: the steepest slope beats a sine by WAVE_SHARP', () => {
    expect(WAVE_SHARP).toBeGreaterThan(0.1);
    let m = 0; for (let x = 0; x < Math.PI; x += 1e-3) m = Math.max(m, Math.sin(x) + 2 * WAVE_SHARP * Math.sin(2 * x));
    expect(m).toBeGreaterThan(1.15);
  });

  it('snaps: a sharp dimple at the origin that is gone in a few WAVE_DIMPLE_S', () => {
    expect(Math.abs(rippleSlope(0.035, 0.01, 0))).toBeGreaterThan(0.5);
    expect(Math.abs(rippleSlope(0.035, 5 * WAVE_DIMPLE_S, 0))).toBeLessThan(0.05);
  });

  it('the snap dimple fades out when sub-pixel instead of aliasing, and is untouched at splash scale', () => {
    expect(WAVE_DIMPLE_AA_LO).toBeLessThan(WAVE_DIMPLE_AA_HI);
    expect(dimpleAA(0)).toBe(1);
    // the dimple alone: at age 1 ms the train's wavenumbers sit far off its spectrum here
    const dimple = (px) => { let m = 0; for (let th = 5e-3; th < 3 * WAVE_DIMPLE_RAD; th += 1e-4) m = Math.max(m, Math.abs(rippleSlope(th, 1e-3, px))); return m; };
    const full = WAVE_DIMPLE_GAIN * Math.exp(-1e-3 / WAVE_DIMPLE_S);
    expect(dimple(0)).toBeCloseTo(full, 2);
    // sub-pixel: dimple radius ≤ WAVE_DIMPLE_AA_LO px → gone
    expect(dimple(WAVE_DIMPLE_RAD / WAVE_DIMPLE_AA_LO)).toBeLessThan(1e-3 * full);
    expect(dimple(2 * WAVE_DIMPLE_RAD)).toBeLessThan(1e-3 * full);
    // half-resolved: partly faded
    const mid = dimple(WAVE_DIMPLE_RAD / (0.5 * (WAVE_DIMPLE_AA_LO + WAVE_DIMPLE_AA_HI)));
    expect(mid).toBeGreaterThan(0.2 * full);
    expect(mid).toBeLessThan(0.8 * full);
    // a splash on the ~205 px rest disc (pxArc ≈ 0.0047), or closer: the fade is exactly 1, the splash unchanged
    for (const px of [0, 0.0047, 0.01, 0.02]) expect(dimpleAA(px)).toBe(1);
    expect(WAVE_DIMPLE_RAD / 0.0047).toBeGreaterThan(4 * WAVE_DIMPLE_AA_HI);
  });

  it('fades every crest finer than a few pixels (no limb aliasing)', () => {
    const age = 0.5;
    const peak = (px) => { let m = 0; for (let th = 0.3; th < 1.5; th += 1e-3) m = Math.max(m, Math.abs(rippleSlope(th, age, px))); return m; };
    expect(peak(0)).toBeGreaterThan(0.5);
    expect(peak(0.2)).toBeLessThan(1e-4);
  });
});

describe('Legendre polynomials', () => {
  it('match the closed forms and their derivatives match finite differences', () => {
    expect(legendre(2, 1)).toBe(1);
    expect(legendre(3, 1)).toBe(1);
    expect(legendre(4, 1)).toBe(1);
    expect(legendre(2, 0)).toBe(-0.5);
    for (const l of [2, 3, 4]) {
      for (const m of [-0.9, -0.3, 0.2, 0.7]) {
        const fd = (legendre(l, m + 1e-6) - legendre(l, m - 1e-6)) / 2e-6;
        expect(dLegendre(l, m)).toBeCloseTo(fd, 5);
      }
    }
  });
});

describe('impulse ring buffer', () => {
  it('holds IMPULSE_SLOTS impulses and overwrites the oldest', () => {
    const buf = createImpulses();
    expect(buf.slots).toHaveLength(IMPULSE_SLOTS);
    for (let i = 0; i < IMPULSE_SLOTS + 1; i++) addImpulse(buf, { dirBody: [0, 0, 1], tS: i, mode: 0.01 * (i + 1) });
    expect(buf.slots[0].t0).toBe(IMPULSE_SLOTS);
    expect(buf.slots[1].t0).toBe(1);
  });

  it('evicts the weakest impulse, not the oldest, so a splash outlives a drag of wakes', () => {
    const buf = createImpulses();
    const wake = (tS) => addImpulse(buf, { dirBody: [0, 0, 1], tS, wave: 0.01, kind: 'wake' });
    [0, 0.16, 0.32].forEach(wake);
    addImpulse(buf, { dirBody: [0, 0, 1], tS: 0.5, mode: 0.035, wave: 0.35, kind: 'splash' });
    [0.64, 0.8, 0.96, 0.96].forEach(wake);   // 7 weak wakes + the splash fill the ring; the splash sits mid-ring
    const splash = buf.slots.find((s) => s.kind === 'splash');
    for (let i = 0; i < 4; i++) wake(1.2 + 0.16 * i);
    const kept = buf.slots.filter((s) => s.kind === 'splash');
    expect(kept).toHaveLength(1);
    expect(kept[0]).toBe(splash);
    expect(kept[0].t0).toBe(0.5);
  });

  it('an unknown impulse kind decays like a splash instead of going NaN', () => {
    const buf = createImpulses();
    const out = createImpulseFrame();
    addImpulse(buf, { dirBody: [1, 0, 0], tS: 0, mode: 0.01, wave: 0.3, kind: 'bogus' });
    addImpulse(buf, { dirBody: [0, 1, 0], tS: 0, wave: 0.01, kind: 'wake' });
    addImpulse(buf, { dirBody: [0, 1, 0], tS: 0, wave: 0.01, kind: 'wake' });
    impulseFrame(buf, 0.5, {}, out);
    expect(Number.isFinite(out.wave[1])).toBe(true);
    expect(out.wave[1]).toBeGreaterThan(0);
    // eviction with a bogus slot present must not poison the comparison
    for (let i = 0; i < IMPULSE_SLOTS + 2; i++) addImpulse(buf, { dirBody: [0, 0, 1], tS: 0.6, wave: 0.2, kind: 'wake' });
    expect(buf.slots.every((s) => Number.isFinite(s.t0))).toBe(true);
  });

  it('impulseFrame scales, ages and retires; empty means any = false', () => {
    const buf = createImpulses();
    const out = createImpulseFrame();
    impulseFrame(buf, 0, {}, out);
    expect(out.any).toBe(false);
    addImpulse(buf, { dirBody: [1, 0, 0], tS: 10, mode: 0.03, wave: 0.3, kind: 'splash' });
    impulseFrame(buf, 10.1, { modeScale: 0.5, waveScale: 2 }, out);
    expect(out.any).toBe(true);
    // Float32 storage: compare to 6 digits.
    expect(out.mode[0]).toBeCloseTo(0.03 * 0.5 * modeResponse(0, 0.1), 6);
    expect(out.mode[2]).toBeCloseTo(0.03 * 0.5 * modeResponse(2, 0.1), 6);
    expect(out.wave[0]).toBeCloseTo(0.1, 6);
    expect(out.wave[1]).toBeCloseTo(0.3 * 2 * Math.exp(-WAVE_DAMP_PER_S.splash * 0.1), 6);
    impulseFrame(buf, 10 + IMPULSE_LIFE_S + 0.01, {}, out);
    expect(out.any).toBe(false);
    expect(buf.slots[0].active).toBe(false);
    expect(out.mode[0]).toBe(0);
    expect(out.wave[1]).toBe(0);
  });

  it('a ring on solid/boiling Hg is damped harder than a splash', () => {
    expect(WAVE_DAMP_PER_S.ring).toBeGreaterThan(WAVE_DAMP_PER_S.splash);
  });

  it('a wave packet fades out before it reaches the antipode', () => {
    const buf = createImpulses();
    const out = createImpulseFrame();
    addImpulse(buf, { dirBody: [1, 0, 0], tS: 0, wave: 1 });
    impulseFrame(buf, Math.PI / WAVE_C_GROUP, {}, out);
    expect(out.wave[1]).toBe(0);
    impulseFrame(buf, Math.PI / WAVE_C_FRONT, {}, out); // the faster front too
    expect(out.wave[1]).toBe(0);
  });

  it('an impulse keeps its emit-time world direction and slip (0 = rides the body)', () => {
    const buf = createImpulses();
    const a = addImpulse(buf, { dirBody: [1, 0, 0], tS: 0, wave: 1 });
    expect(a.slip).toBe(0);
    const b = addImpulse(buf, { dirBody: [1, 0, 0], dirWorld: [0, 0, 1], tS: 0, wave: 1, slip: 0.7 });
    expect(b.slip).toBe(0.7);
    expect(b.dirWorld0).toEqual([0, 0, 1]);
  });
});

describe('shear slip', () => {
  it('blends the body-carried direction toward the emit-time world direction, unit length', () => {
    const out = [0, 0, 0];
    expect(slipDirWorld([1, 0, 0], [0, 0, 1], 0, out)).toEqual([1, 0, 0]);
    expect(slipDirWorld([1, 0, 0], [0, 0, 1], 1, out)).toEqual([0, 0, 1]);
    slipDirWorld([1, 0, 0], [0, 0, 1], 0.5, out);
    expect(Math.hypot(...out)).toBeCloseTo(1, 12);
    expect(out[0]).toBeCloseTo(out[2], 12);
  });
});

describe('the bead keeps its volume', () => {
  it('modes and bulge integrate to zero over the sphere (ℓ ≥ 2)', () => {
    const dirs = [[1, 0, 0], [0, 0.6, 0.8], [0, 0, 1], [0, 1, 0], [0.6, 0, -0.8], [0, -1, 0], [-1, 0, 0], [0, 0, -1]];
    const modes = new Float32Array(IMPULSE_SLOTS * 3).map((_, i) => 0.004 * Math.sin(i + 1));
    const pts = fib(20000);
    const mean = pts.reduce((s, x) => s + shapeHeight(x, dirs, modes, [0, 1, 0, -0.01]), 0) / pts.length;
    // An ℓ = 0 (volume) term of this size would give a mean ~4e-3; quadrature noise is ~1e-5.
    expect(Math.abs(mean)).toBeLessThan(1e-4);
  });

  it('shapeHeight is clamped to ±SHAPE_MAX', () => {
    const dirs = Array.from({ length: IMPULSE_SLOTS }, () => [0, 0, 1]);
    const modes = new Float32Array(IMPULSE_SLOTS * 3).fill(1);
    expect(shapeHeight([0, 0, 1], dirs, modes, [0, 1, 0, 0])).toBe(SHAPE_MAX);
  });
});

describe('spin bulge', () => {
  it('is zero when still or solid', () => {
    expect(spinBulge([0, 0, 0], 1)[3]).toBe(0);
    expect(spinBulge([0, 3, 0], 0)[3]).toBe(0);
  });

  it('flattens along the spin axis (a2 < 0 ⇒ poles in, equator out) and saturates at BULGE_MAX', () => {
    const b = spinBulge({ x: 0, y: 2, z: 0 }, 1);
    expect(b.slice(0, 3)).toEqual([0, 1, 0]);
    expect(b[3]).toBeLessThan(0);
    expect(spinBulge([0, MAX_OMEGA, 0], 1)[3]).toBeGreaterThanOrEqual(-BULGE_MAX);
    expect(spinBulge([0, MAX_OMEGA, 0], 1)[3]).toBeLessThan(-0.99 * BULGE_MAX);
    const slow = spinBulge([0, 0.05, 0], 1)[3];
    expect(slow).toBeCloseTo(-(2 / 3) * (0.05 / MODE_OMEGA[0]) ** 2, 4);
  });
});

describe('drag wake', () => {
  it('emits nothing on a solid planet', () => {
    const w = createWake();
    expect(wakeImpulse(w, { tS: 1, dragging: true, released: false, ptrOmega: 5, bodyOmega: 5, tau: LIQUID_TAU - 0.01 })).toBeNull();
  });

  it('emits wake ripples at most every WAKE_EVERY_S while the pointer moves', () => {
    const w = createWake();
    const a = wakeImpulse(w, { tS: 1, dragging: true, released: false, ptrOmega: 100, bodyOmega: 5, tau: 1 });
    expect(a).toEqual({ kind: 'wake', mode: 0, wave: WAKE_WAVE_AMP, slip: WAKE_SLIP });
    expect(wakeImpulse(w, { tS: 1 + WAKE_EVERY_S / 2, dragging: true, released: false, ptrOmega: 5, bodyOmega: 5, tau: 1 })).toBeNull();
    expect(wakeImpulse(w, { tS: 1 + WAKE_EVERY_S + 1e-9, dragging: true, released: false, ptrOmega: 5, bodyOmega: 5, tau: 1 })).not.toBeNull();
    expect(wakeImpulse(w, { tS: 9, dragging: true, released: false, ptrOmega: 0, bodyOmega: 5, tau: 1 })).toBeNull();
  });

  it('a slow drag still shows: strength grows as √ω, not ω', () => {
    const w = createWake();
    const r = wakeImpulse(w, { tS: 1, dragging: true, released: false, ptrOmega: WAKE_FULL_OMEGA / 4, bodyOmega: 1, tau: 1 });
    expect(r.wave).toBeCloseTo(WAKE_WAVE_AMP / 2, 12);
    expect(WAKE_SLIP).toBeGreaterThan(0);
    expect(WAKE_SLIP).toBeLessThan(1);
  });

  it('a release sloshes the body modes in proportion to the spin', () => {
    const w = createWake();
    const r = wakeImpulse(w, { tS: 1, dragging: false, released: true, ptrOmega: 0, bodyOmega: MAX_OMEGA / 2, tau: 1 });
    expect(r).toEqual({ kind: 'ring', mode: RELEASE_MODE_AMP / 2, wave: 0 });
  });
});
