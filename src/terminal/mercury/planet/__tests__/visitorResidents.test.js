import { describe, it, expect } from 'vitest';
import {
  createVisitors, createVisitorOut, launchVisitor, stepVisitors, residentHeight, filmRadius, filmThicknessNm,
  hotTempK, jetEnvelope, planckRGB, glowRGB, fadeAt, T_FLIGHT, RESIDENT_LIFE_S, BEAD_R, BEAD_SHRINK, ROCK_R,
  ROCK_SUBMERGED, ROCK_BOB_T, DETACH_FADE_S, CALM_LIFE, FILM_H0_NM, FILM_H1_NM, HOT_T0_K, FADE_S,
} from '../visitorSim';
import { ctxFor, runTo } from './visitorTestKit';

const angle = (a, b) => Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const landed = (phase, tempK, extra = 0) => {
  const buf = createVisitors();
  const ctx = ctxFor(phase, tempK);
  const v = launchVisitor(buf, phase, ctx);
  runTo(buf, ctx, createVisitorOut(), T_FLIGHT[phase] + ctx.dt + extra);
  return { buf, ctx, v };
};

describe('residents live, then fade, then free their slot', () => {
  it('each kind lives its RESIDENT_LIFE_S after touchdown', () => {
    for (const [phase, temp, kind] of [['fluid', 400, 'film'], ['fluid', 600, 'bead'], ['thermal', 400, 'ember'], ['earth', 400, 'rock'], ['air', 400, 'jet']]) {
      const { buf, ctx, v } = landed(phase, temp);
      expect(v.kind).toBe(kind);
      runTo(buf, ctx, createVisitorOut(), ctx.tS + RESIDENT_LIFE_S[kind] - 0.1);
      expect(v.live).toBe(true);
      runTo(buf, ctx, createVisitorOut(), ctx.tS + 0.2);
      expect(v.live).toBe(false);
      expect(buf.live).toBe(0);
    }
  });
  it('fade is 1 until the last second, then smoothly 0', () => {
    expect(fadeAt(0, 8)).toBe(1);
    expect(fadeAt(8 - FADE_S - 0.01, 8)).toBe(1);
    expect(fadeAt(8 - FADE_S / 2, 8)).toBeCloseTo(0.5, 6);
    expect(fadeAt(8, 8)).toBe(0);
  });
});

describe('water', () => {
  it('a film spreads as sqrt(t) and thins from 1 um to 80 nm', () => {
    expect(filmRadius(4) - filmRadius(0)).toBeCloseTo(2 * (filmRadius(1) - filmRadius(0)), 9);
    expect(filmThicknessNm(0)).toBe(FILM_H0_NM);
    expect(filmThicknessNm(RESIDENT_LIFE_S.film)).toBeCloseTo(FILM_H1_NM, 6);
    expect(filmThicknessNm(4)).toBeLessThan(filmThicknessNm(2));
  });
  it('a Leidenfrost bead skates along the surface, shrinking, and hovers on its gap', () => {
    const { buf, ctx, v } = landed('fluid', 600);
    const d0 = [...v.dirBody];
    runTo(buf, ctx, createVisitorOut(), ctx.tS + 3);
    expect(angle(d0, v.dirBody)).toBeGreaterThan(0.05);
    expect(v.r).toBeLessThan(BEAD_R);
    expect(v.r).toBeGreaterThan(BEAD_R * (1 - BEAD_SHRINK));
    expect(Math.hypot(...v.pos)).toBeGreaterThan(ctx.coreR + v.r * 0.9);
  });
  it('the skate is reproducible per seed', () => {
    const a = landed('fluid', 600, 2), b = landed('fluid', 600, 2);
    expect(a.v.dirBody).toEqual(b.v.dirBody);
  });
});

describe('earth, fire, air', () => {
  it('a rock plunges, pops up past its float line, and sinks at the end', () => {
    const rest = ROCK_R * (1 - 2 * ROCK_SUBMERGED);
    const rock = { kind: 'rock', r: ROCK_R };
    expect(residentHeight(rock, 0, 12, false)).toBeLessThan(rest);
    expect(residentHeight(rock, ROCK_BOB_T / 2, 12, false)).toBeGreaterThan(rest);
    expect(residentHeight(rock, 11.99, 12, false)).toBeLessThan(rest - ROCK_R);
    expect(residentHeight(rock, 0, 12, true)).toBeCloseTo(rest, 12);
  });
  it('the ember spot cools linearly from its touchdown temperature', () => {
    expect(hotTempK(0)).toBe(HOT_T0_K);
    expect(hotTempK(1) - hotTempK(2)).toBeCloseTo(hotTempK(0) - hotTempK(1), 9);
    expect(hotTempK(100)).toBe(0);
  });
  it('a gust stores a unit body-frame direction and a jet envelope that is 0 at both ends', () => {
    const { v } = landed('air', 400);
    expect(Math.hypot(...v.tan)).toBeCloseTo(1, 9);
    expect(jetEnvelope(0)).toBe(0);
    expect(jetEnvelope(RESIDENT_LIFE_S.jet)).toBe(0);
    expect(jetEnvelope(RESIDENT_LIFE_S.jet / 2)).toBeCloseTo(1, 9);
  });
});

describe('the residents ride the body and leave on a fling', () => {
  it('a film keeps its body-frame spot while the planet turns under it', () => {
    const { buf, ctx, v } = landed('fluid', 400);
    const b0 = [...v.dirBody], w0 = [...v.dirWorld];
    ctx.q = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // 90 deg about world Y
    runTo(buf, ctx, createVisitorOut(), ctx.tS + 0.1);
    expect(v.dirBody).toEqual(b0);
    expect(angle(w0, v.dirWorld)).toBeGreaterThan(0.5);
  });
  it('a hard release flings a rock off with the surface velocity and frees it after DETACH_FADE_S', () => {
    const { buf, ctx, v } = landed('earth', 400, 1);
    ctx.omega = [0, 8, 0];
    ctx.detach = true;
    const p = [...v.pos];
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, createVisitorOut());
    expect(v.state).toBe('detached');
    expect(v.vel[0]).toBeCloseTo(8 * p[2], 9);
    expect(v.vel[2]).toBeCloseTo(-8 * p[0], 9);
    ctx.detach = false;
    runTo(buf, ctx, createVisitorOut(), ctx.tS + DETACH_FADE_S + 0.05);
    expect(buf.live).toBe(0);
  });
  it('a flung film stays in the liquid: its surface slot keeps tracking the spin (dirWorld = q·dirBody)', () => {
    const { buf, ctx, v } = landed('fluid', 400, 0.5);
    expect(v.kind).toBe('film');
    ctx.omega = [0, 12, 0];
    ctx.detach = true;
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, createVisitorOut());
    expect(v.state).toBe('detached');
    ctx.detach = false;
    ctx.q = [0, Math.SQRT1_2, 0, Math.SQRT1_2]; // the body has turned 90 deg about world Y since
    const b = v.dirBody, [x, y, z, w] = ctx.q;
    ctx.tS += ctx.dt;
    stepVisitors(buf, ctx, createVisitorOut());
    expect(v.state).toBe('detached');
    // q·b by hand (unit quaternion rotation)
    const ix = w * b[0] + y * b[2] - z * b[1], iy = w * b[1] + z * b[0] - x * b[2];
    const iz = w * b[2] + x * b[1] - y * b[0], iw = -x * b[0] - y * b[1] - z * b[2];
    const want = [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
    for (let k = 0; k < 3; k++) expect(v.dirWorld[k]).toBeCloseTo(want[k], 9);
  });
  it('reduced motion: the bead never moves and lives half as long', () => {
    const buf = createVisitors();
    const ctx = ctxFor('fluid', 600);
    ctx.calm = true;
    const v = launchVisitor(buf, 'fluid', ctx);
    runTo(buf, ctx, createVisitorOut(), 0.1);
    const d0 = [...v.dirBody];
    runTo(buf, ctx, createVisitorOut(), RESIDENT_LIFE_S.bead * CALM_LIFE - 0.1);
    expect(v.dirBody).toEqual(d0);
    runTo(buf, ctx, createVisitorOut(), RESIDENT_LIFE_S.bead * CALM_LIFE + 0.2);
    expect(v.live).toBe(false);
  });
});

describe('light', () => {
  it('Planck: red is 1 at 1300 K and a hotter body is bluer', () => {
    expect(planckRGB(1300)[0]).toBeCloseTo(1, 9);
    const c9 = planckRGB(900), c13 = planckRGB(1300);
    expect(c13[2] / c13[0]).toBeGreaterThan(c9[2] / c9[0]);
  });
  it('glow: 700 K is black, 900 K is dull red, 1300 K is full', () => {
    expect(glowRGB(700)[0]).toBeLessThan(0.01);
    const g9 = glowRGB(900);
    expect(g9[0]).toBeGreaterThan(0.3);
    expect(g9[0]).toBeLessThan(0.9);
    expect(g9[1]).toBeLessThan(g9[0] * 0.2);
    expect(glowRGB(1300)[0]).toBeCloseTo(1, 6);
  });
});
