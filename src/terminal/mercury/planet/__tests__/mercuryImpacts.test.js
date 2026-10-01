import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  IMPACT_TILT_DEG, CRATER_DEPTH_M, CRATER_RIM_M, RAY_REACH, IMPACT_MODE_AMP, IMPACT_WAVE_AMP,
  strikeDirWorld, worldToBody, bodyToWorld, localTempK, impactKind, craterHeightM, makeRays, rayBrightness,
  RAY_COUNT_MIN, RAY_COUNT_MAX,
} from '../mercuryImpacts';
import { surfaceTempK } from '../mercuryThermal';

const DEG = Math.PI / 180;

describe('strikeDirWorld', () => {
  it('lands IMPACT_TILT_DEG from the node toward the viewer', () => {
    const cam = [0, 0, 3.6];
    const d = strikeDirWorld([1.4, 0, 0], cam);
    expect(d[0]).toBeCloseTo(Math.cos(IMPACT_TILT_DEG * DEG), 9);
    expect(d[1]).toBeCloseTo(0, 9);
    expect(d[2]).toBeCloseTo(Math.sin(IMPACT_TILT_DEG * DEG), 9);
    const up = strikeDirWorld([0, 1.4, 0], cam);
    expect(up[1]).toBeCloseTo(Math.cos(IMPACT_TILT_DEG * DEG), 9);
    expect(Math.hypot(...up)).toBeCloseTo(1, 12);
  });

  it('falls back to the node direction if the node is in line with the camera', () => {
    expect(strikeDirWorld([0, 0, 2], [0, 0, 3.6])).toEqual([0, 0, 1]);
  });
});

describe('frames', () => {
  it('worldToBody inverts bodyToWorld (and matches the shader: body = Mᵀ·world)', () => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -1.1, 0.7));
    const v = [0.2, -0.5, 0.84];
    const back = worldToBody(bodyToWorld(v, q), q);
    for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(v[i], 12);
    const M = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    const w = new THREE.Vector3(...v).applyMatrix3(M.clone().transpose());
    const b = worldToBody(v, q);
    expect(b[0]).toBeCloseTo(w.x, 12);
    expect(b[1]).toBeCloseTo(w.y, 12);
    expect(b[2]).toBeCloseTo(w.z, 12);
  });
});

describe('localTempK', () => {
  // The temperature belongs to where a point sits relative to the Sun about the
  // spin axis at rest (world Y), not to the body's own axes: a tumbled body
  // read in its own frame puts sunlit metal on the night branch (the frozen cap).
  it('is evaluated in the world frame: a tumble cannot freeze sunlit metal', () => {
    const sun = [-0.82, 0, 0.57];
    const p = [0.3, 0.35, 0.89]; // sunlit, toward the viewer
    const n = Math.hypot(...p); const w = p.map((v) => v / n);
    const tumble = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 80 * DEG);
    const heat = 80;
    const world = localTempK(w, sun, 600, heat);
    const body = localTempK(worldToBody(w, tumble), worldToBody(sun, tumble), 600, heat);
    expect(world).toBeGreaterThan(234.32);
    expect(body).toBeLessThan(234.32); // why the caller must pass world-frame inputs
  });

  it('is the subsolar temperature (plus spin heat) under the Sun', () => {
    const sun = [Math.cos(0.4), 0, -Math.sin(0.4)];
    expect(localTempK(sun, sun, 600, 20)).toBeCloseTo(surfaceTempK(1, 0, 1, 600, 20), 9);
  });

  it('is night-cold at the antisolar point', () => {
    expect(localTempK([-1, 0, 0], [1, 0, 0], 600, 0)).toBeLessThan(200);
  });
});

describe('impactKind', () => {
  it('crust → crater; liquid → splash; solid or boiling Hg → damped ring', () => {
    expect(impactKind(0.2, 400)).toBe('crater');
    expect(impactKind(1, 400)).toBe('splash');
    expect(impactKind(1, 150)).toBe('ring');
    expect(impactKind(1, 700)).toBe('ring');
    expect(IMPACT_MODE_AMP.crater).toBe(0);
    expect(IMPACT_WAVE_AMP.crater).toBe(0);
    expect(IMPACT_WAVE_AMP.splash).toBeGreaterThan(IMPACT_WAVE_AMP.ring);
  });
});

describe('crater profile', () => {
  it('a bowl CRATER_DEPTH_M deep, continuous at the rim, fading to zero far out', () => {
    expect(craterHeightM(0)).toBe(-CRATER_DEPTH_M);
    expect(craterHeightM(1 - 1e-9)).toBeCloseTo(CRATER_RIM_M, 3);
    expect(craterHeightM(1 + 1e-9)).toBeCloseTo(CRATER_RIM_M, 3);
    expect(Math.abs(craterHeightM(2.5))).toBeLessThan(0.01 * CRATER_RIM_M);
  });
});

describe('rays', () => {
  it('are deterministic per seed with RAY_COUNT_MIN..MAX rays', () => {
    expect(makeRays(7)).toEqual(makeRays(7));
    expect(makeRays(7)).not.toEqual(makeRays(8));
    for (let s = 0; s < 20; s++) {
      const n = makeRays(s).length;
      expect(n).toBeGreaterThanOrEqual(RAY_COUNT_MIN);
      expect(n).toBeLessThanOrEqual(RAY_COUNT_MAX);
    }
  });

  it('fresh inside, brighter along a ray than between rays, gone past RAY_REACH, never above 1', () => {
    const rays = [{ phi: 0, len: 1.5, gain: 1 }];
    expect(rayBrightness(0.5, 1, rays)).toBe(1);
    expect(rayBrightness(2.5, 0, rays)).toBeGreaterThan(rayBrightness(2.5, Math.PI, rays) + 0.2);
    expect(rayBrightness(RAY_REACH + 0.01, 0, rays)).toBe(0);
    for (let s = 0; s <= RAY_REACH; s += 0.1) {
      for (let p = -Math.PI; p < Math.PI; p += 0.2) expect(rayBrightness(s, p, makeRays(3))).toBeLessThanOrEqual(1);
    }
  });
});
