import { describe, it, expect } from 'vitest';
import {
  kd, kaRiver, manningVelocity, doSat, sstClimatology,
  sagStep, criticalTime, riverState, TAU_N_DAYS,
} from '../kinetics';

// Reference integrator: classical RK4 on dL/dt = -kd L, dD/dt = kd L - ka D.
function rk4Sag(L0, D0, kdv, kav, t, hTarget = 1e-3) {
  const n = Math.max(1, Math.round(t / hTarget));
  const h = t / n;
  const f = (L, D) => [-kdv * L, kdv * L - kav * D];
  let L = L0;
  let D = D0;
  for (let s = 0; s < n; s++) {
    const [a1, b1] = f(L, D);
    const [a2, b2] = f(L + (h / 2) * a1, D + (h / 2) * b1);
    const [a3, b3] = f(L + (h / 2) * a2, D + (h / 2) * b2);
    const [a4, b4] = f(L + h * a3, D + h * b3);
    L += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    D += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
  }
  return { L, D };
}

const close = (a, b, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));

describe('sagStep', () => {
  it.each([
    ['ka > kd', 30, 2, 0.23, 0.6, 5],
    ['ka = kd (degenerate)', 30, 2, 0.3, 0.3, 5],
    ['ka < kd', 30, 2, 0.5, 0.1, 10],
    ['no BOD, deficit only', 0, 4, 0.23, 0.2, 3],
  ])('matches RK4 (%s)', (_label, L0, D0, kdv, kav, t) => {
    const exact = sagStep(L0, D0, kdv, kav, t);
    const ref = rk4Sag(L0, D0, kdv, kav, t);
    expect(close(exact.L, ref.L)).toBe(true);
    expect(close(exact.D, ref.D)).toBe(true);
  });

  it('is continuous through the degenerate case and across the series switch', () => {
    // A 1e-7 relative change in ka genuinely moves D by ~1e-6 (smooth dependence);
    // a broken degenerate branch would give NaN or an O(1) jump instead.
    const at = sagStep(30, 2, 0.3, 0.3, 5).D;
    expect(Math.abs(sagStep(30, 2, 0.3, 0.3 * (1 + 1e-7), 5).D - at)).toBeLessThan(1e-5);
    expect(Math.abs(sagStep(30, 2, 0.3, 0.3 * (1 - 1e-7), 5).D - at)).toBeLessThan(1e-5);
    // Either side of the |x| = 1e-4 series threshold, both branches must match RK4.
    for (const x of [0.99e-4, 1.01e-4, -0.99e-4, -1.01e-4]) {
      const kav = 0.3 + x / 5;
      const ref = rk4Sag(30, 2, 0.3, kav, 5);
      expect(close(sagStep(30, 2, 0.3, kav, 5).D, ref.D)).toBe(true);
    }
  });

  it('stays finite for long times with ka << kd', () => {
    const s = sagStep(30, 2, 1, 0.2, 1000);
    expect(Number.isFinite(s.L)).toBe(true);
    expect(Number.isFinite(s.D)).toBe(true);
    expect(s.D).toBeCloseTo(0, 12);
  });
});

describe('criticalTime', () => {
  const numericArgmax = (L0, D0, kdv, kav) => {
    let best = 0;
    let bestD = -Infinity;
    for (let t = 0; t <= 60; t += 1e-3) {
      const { D } = sagStep(L0, D0, kdv, kav, t);
      if (D > bestD) { bestD = D; best = t; }
    }
    return best;
  };

  it.each([
    [30, 2, 0.23, 0.6],
    [30, 2, 0.3, 0.3],
    [30, 2, 0.5, 0.1],
    [1, 8, 0.23, 0.6],
  ])('matches the numerical maximum (L0=%s D0=%s kd=%s ka=%s)', (L0, D0, kdv, kav) => {
    expect(Math.abs(criticalTime(L0, D0, kdv, kav) - numericArgmax(L0, D0, kdv, kav))).toBeLessThan(2e-3);
  });

  it('is 0 without BOD', () => {
    expect(criticalTime(0, 3, 0.23, 0.6)).toBe(0);
  });
});

describe('rate helpers', () => {
  it('DO saturation follows Benson–Krause', () => {
    expect(doSat(0)).toBeCloseTo(14.62, 1);
    expect(doSat(20)).toBeCloseTo(9.09, 1);
    expect(doSat(30)).toBeCloseTo(7.56, 1);
  });

  it('BOD decay is theta-corrected', () => {
    expect(kd(20)).toBeCloseTo(0.23, 12);
    expect(kd(30)).toBeCloseTo(0.23 * 1.047 ** 10, 12);
  });

  it('Manning velocity and O\'Connor–Dobbins reaeration', () => {
    const v = manningVelocity({ n: 0.03, R: 6, S: 7e-5 });
    expect(v).toBeCloseTo(0.9208, 3);
    expect(kaRiver(v, 6, 20)).toBeCloseTo((3.93 * Math.sqrt(v)) / 6 ** 1.5, 12);
  });

  it('SST climatology spans tropical to polar', () => {
    expect(sstClimatology(0)).toBeCloseTo(28, 9);
    expect(sstClimatology(78)).toBeLessThan(5);
    expect(sstClimatology(-40)).toBeCloseTo(sstClimatology(40), 12);
  });
});

describe('riverState', () => {
  const kernel = { temp: 12, do: 9.5, bod: 6, dt: 3.5, nitrate: 18 };
  const hyd = { velocityMs: 1, depthM: 6 };

  it('starts at the kernel inputs', () => {
    const s = riverState(kernel, 0, hyd);
    expect(s.dT).toBe(3.5);
    expect(s.L).toBe(6);
    expect(s.N).toBe(18);
    expect(s.D).toBeCloseTo(Math.max(0, doSat(12) - 9.5), 12);
  });

  it('Danube worked example: ~25 d leaves a few % of BOD and ~2/3 of nitrate', () => {
    const s = riverState(kernel, 24.7, hyd);
    expect(s.L / kernel.bod).toBeLessThan(0.03);
    expect(s.N / kernel.nitrate).toBeCloseTo(Math.exp(-24.7 / TAU_N_DAYS), 12);
    expect(s.N / kernel.nitrate).toBeGreaterThan(0.6);
  });

  it('never reports a negative deficit for supersaturated input, never exceeds DO_sat', () => {
    expect(riverState({ ...kernel, do: 14 }, 0, hyd).D).toBe(0);
    const heavy = riverState({ ...kernel, bod: 100, do: 1 }, 10, { velocityMs: 0.1, depthM: 20 });
    expect(heavy.D).toBeLessThanOrEqual(doSat(12));
  });

  it('starts supersaturated water at zero deficit, not a negative one', () => {
    const hydT = { velocityMs: 1, depthM: 6 };
    const s = riverState({ ...kernel, do: 14, bod: 20 }, 3, hydT);
    const ref = sagStep(20, 0, kd(12), kaRiver(1, 6, 12), 3);
    expect(s.D).toBeCloseTo(ref.D, 12);
  });
});
