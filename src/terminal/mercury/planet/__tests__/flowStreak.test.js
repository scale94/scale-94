// Gas filaments in each flow (mirror-sky spec §3, Option A: fog + filament roles in one draw). Read from the sources.
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';
import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';
import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';
import canvasSrc from '../../MercuryCanvas.jsx?raw';
import fluidBufSrc from '../../../fluid/particleFlowBuffers.js?raw';
import airBufSrc from '../../../air/atmosphericFlowBuffers.js?raw';
import * as fluidBuf from '../../../fluid/particleFlowBuffers';
import * as airBuf from '../../../air/atmosphericFlowBuffers';
import { gasRoles, THREAD_CROSS_CLIP, GAS_STREAK_VS, GAS_STREAK_FS } from '../gasStreak';
import { measureThreads, spriteThread, proj, fluidFil } from './threadReplica';

const STREAKED = {
  fluid: {
    src: particleSrc,
    bufSrc: fluidBufSrc,
    core: 'vec3 knotPos(float ph, out vec3 center) {',
    fogSize: 'float fogSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPosition.z, aRadius, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSpriteThread(gl_Position, projectionMatrix * mvPrev, clipBack, clipAhead, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius), fray);',
  },
  air: {
    src: atmoSrc,
    bufSrc: airBufSrc,
    core: 'vec3 orbitPos(float ph, out float angle) {',
    fogSize: 'float fogSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPos.z, aSize, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSpriteThread(gl_Position, projectionMatrix * mvPrev, clipBack, clipAhead, aRole, size, AIR_FIL_ASPECT, gasHash(aPhase, aSeed), fray);',
  },
};

describe('gas filaments: two roles in one draw', () => {
  for (const [el, { src, bufSrc, core, fogSize, filW, sprite }] of Object.entries(STREAKED)) {
    it(`${el}: core sampled twice; fog = the old sprite, filament = thin capsule; role alpha; live knobs`, () => {
      expect(src).toContain('${GAS_STREAK_VS}');
      expect(src).toContain('${GAS_STREAK_FS}');
      expect(src.indexOf('${GAS_STREAK_VS}')).toBeGreaterThan(src.indexOf('float snoise('));
      expect(src).toContain(core);
      expect(src).toContain('uPhase - STREAK_DT * uPhaseRate');
      expect(src).toContain('prev *= 1.0 - uCondense * uCondense;');
      expect(src).toContain('attribute float aRole;');
      expect(src).toContain(fogSize);
      expect(src).toContain(filW);
      expect(src).toContain('float size = aRole < 0.5 ? fogSize : filW;');
      expect(src).toContain(sprite);
      expect(src).toContain('vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime)'); // Task 7d: lane id + along label (air: × uAirFilGain, 7e)
      expect(src).toContain('attribute float aLane;');
      expect(src).toContain('<bufferAttribute attach="attributes-aLane" array={buffers.lanes} count={PARTICLE_COUNT} itemSize={1} />');
      expect(src).toContain('* vLane');
      expect(src).toMatch(/float d = gasStreakDist\(gl_PointCoord\);/);
      expect(src).toContain(`mat.uniforms.uPhaseRate.value = clk.rate.${el};`);
      expect(src).toContain('...GAS_TUNE_UNIFORMS(PLANET_TUNE),');
      expect(src).toContain('writeGasTune(mat.uniforms, PLANET_TUNE, state.gl.getPixelRatio(), gasPointMax(state.gl));');
      expect(src).toContain('uPhaseRate: { value: 0 },');
      for (const gone of ['uGasSize', 'uGasAlpha', 'STRETCH_MAX', 'gasStreak(']) expect(src).not.toContain(gone);
    });

    it(`${el}: buffers carry the deterministic role split; the geometry remounts when the split changes`, () => {
      expect(src).toContain('fogCount = null,');
      expect(src).toContain('const N_FOG = fogCount ?? PARTICLE_COUNT;');
      expect(src).toContain('useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG])');
      expect(bufSrc).toContain('export function buildBuffers(count, nFog, seed = ');
      expect(bufSrc).toContain('const roles = gasRoles(count, nFog);');
      expect(src).toMatch(/import \{\s*buildBuffers[^}]*\} from '\.\/(particleFlowBuffers|atmosphericFlowBuffers)';/);
      expect(src).not.toContain('function buildBuffers(');
      expect(src).toContain('<bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>');
      expect(src).toContain('<bufferAttribute attach="attributes-aRole" array={buffers.roles} count={PARTICLE_COUNT} itemSize={1} />');
    });
  }

  it('canvas: counts from gasCounts (spec §3e): every flow x the tier multiplier, fire flagged', () => {
    expect(canvasSrc).toContain('const gasBase = params.density ?? (isMobile ? 600 : 1200);');
    expect(canvasSrc).toContain("const gasFor = (phase) => gasCounts(gasBase, TIERS[TIER].gasDensity, phase === 'thermal');");
    for (const el of ['fluid', 'thermal', 'earth', 'air']) {
      expect(canvasSrc).toContain(`density={gasFor('${el}').n}`);
      expect(canvasSrc).toContain(`fogCount={gasFor('${el}').fog}`);
    }
    expect(canvasSrc).not.toContain('densityFor');
  });
});

describe('gas filaments glow over the fog: premultiplied one-draw blend (Task 7c)', () => {
  for (const [el, src] of [['fluid', particleSrc], ['air', atmoSrc], ['thermal', thermalSrc], ['earth', sedimentSrc]]) {
    it(`${el}: FS ends in gasOut(); no raw gl_FragColor vec4(color/col, ...) left; opt-in premultiplied prop`, () => {
      expect(src).toMatch(/gl_FragColor = gasOut\(/);
      if (el === 'fluid' || el === 'air') expect(src).toMatch(/col(or)? = gasFilTint\(col(or)?, d\);/);
      expect(src).not.toMatch(/gl_FragColor = vec4\(/);
      expect(src).toContain('premultiplied = false,');
      expect(src).toContain('uPremult: { value: premultiplied ? 1 : 0 },');
      expect(src).toContain('blending={premultiplied ? THREE.CustomBlending : blending}');
      expect(src).toContain('blendEquation={THREE.AddEquation}');
      expect(src).toContain('blendSrc={THREE.OneFactor}');
      expect(src).toContain('blendDst={THREE.OneMinusSrcAlphaFactor}');
      expect(src).toContain('blendSrcAlpha={THREE.OneFactor}');
      expect(src).toContain('blendDstAlpha={THREE.OneMinusSrcAlphaFactor}');
    });
  }

  it('canvas: all four flows premultiplied (CustomBlending path; Task 8 adds fire + earth), NormalBlending fallback prop kept', () => {
    const tag = (name) => canvasSrc.slice(canvasSrc.indexOf(`<${name}`), canvasSrc.indexOf('/>', canvasSrc.indexOf(`<${name}`)));
    for (const n of ['ParticleFlow', 'AtmosphericFlow', 'ThermalFlow', 'SedimentFlow']) {
      expect(tag(n)).toContain('premultiplied');
      expect(tag(n)).toContain('blending={THREE.NormalBlending}');
    }
  });
});

// Task 7d: filament particles placed on a few uneven lanes (threads); fog built exactly as before (Math.random).
const decileSpread = (xs) => {
  const bins = new Array(10).fill(0);
  for (const x of xs) bins[Math.min(9, Math.floor(x * 10))]++;
  return Math.max(...bins) / Math.min(...bins);
};
const fogOf = (b, a) => Array.from(a).filter((_, i) => b.roles[i] === 0);
const filOf = (b, a) => Array.from(a).filter((_, i) => b.roles[i] === 1);

describe('gas filament threads: buffers (Task 7d)', () => {
  it('fluid: roles unchanged; fog attributes uniform as before, lane -1; positions = knotPoint(phase) for every particle', () => {
    const b = fluidBuf.buildBuffers(3600, 1200);
    expect(b.roles).toEqual(gasRoles(3600, 1200));
    for (const a of [b.phases, b.radii, b.offsets]) {
      const f = fogOf(b, a);
      expect(f.length).toBe(1200);
      expect(new Set(f).size).toBeGreaterThan(1190);
      expect(decileSpread(f)).toBeLessThan(1.8);
    }
    expect(fogOf(b, b.lanes).every((x) => x === -1)).toBe(true);
    for (let i = 0; i < 3600; i += 7) {
      const [x, y, z] = fluidBuf.knotPoint(b.phases[i]);
      expect(b.positions[i * 3]).toBeCloseTo(x, 5);
      expect(b.positions[i * 3 + 1]).toBeCloseTo(y, 5);
      expect(b.positions[i * 3 + 2]).toBeCloseTo(z, 5);
    }
  });

  it('fluid: filaments cluster on FLUID_LANES streamlines: one shared aOffset (angle + knot speed) per lane, radius within the clipped σ', () => {
    const b = fluidBuf.buildBuffers(3600, 1200);
    const L = fluidBuf.FLUID_LANES;
    expect(L).toBe(8); // Task 7e: 6 → 8
    const lanes = filOf(b, b.lanes), offs = filOf(b, b.offsets), rads = filOf(b, b.radii);
    expect(new Set(lanes).size).toBe(L);
    expect(new Set(offs).size).toBe(L);
    for (let k = 0; k < L; k++) {
      const o = offs.filter((_, i) => lanes[i] === k), r = rads.filter((_, i) => lanes[i] === k);
      expect(new Set(o).size).toBe(1);
      const mid = (Math.max(...r) + Math.min(...r)) / 2;
      expect(Math.max(...r) - Math.min(...r)).toBeLessThanOrEqual(2 * THREAD_CROSS_CLIP * fluidBuf.FLUID_SIGMA_R + 1e-6);
      const slack = THREAD_CROSS_CLIP * fluidBuf.FLUID_SIGMA_R;
      expect(mid).toBeGreaterThanOrEqual(fluidBuf.FLUID_LANE_R[0] - slack);
      expect(mid).toBeLessThanOrEqual(fluidBuf.FLUID_LANE_R[1] + slack);
    }
    expect(rads.every((r) => r >= 0 && r <= 1)).toBe(true);
    // deterministic filaments (seeded), the fog keeps Math.random
    const b2 = fluidBuf.buildBuffers(3600, 1200);
    expect(filOf(b2, b2.phases)).toEqual(filOf(b, b.phases));
    expect(fogOf(b2, b2.phases)).not.toEqual(fogOf(b, b.phases));
  });

  it('fluid: all fog (standalone / ghosts / lite) = the old buffers, no lanes', () => {
    const b = fluidBuf.buildBuffers(1200, 1200);
    expect(b.lanes.every((x) => x === -1)).toBe(true);
    expect(new Set(b.offsets).size).toBeGreaterThan(1190);
  });

  it('air: roles unchanged; fog attributes as before (uniform, ion ~8 %), lane -1', () => {
    const b = airBuf.buildBuffers(3600, 1200);
    expect(b.roles).toEqual(gasRoles(3600, 1200));
    for (const a of [b.phases, b.speeds, b.seeds, b.alts]) {
      const f = fogOf(b, a);
      expect(new Set(f).size).toBeGreaterThan(1190);
      expect(decileSpread(f)).toBeLessThan(1.8);
    }
    const ion = fogOf(b, b.ions);
    expect(ion.every((x) => x === 0 || x === 1)).toBe(true);
    expect(ion.filter((x) => x === 1).length / ion.length).toBeGreaterThan(0.04);
    expect(ion.filter((x) => x === 1).length / ion.length).toBeLessThan(0.13);
    expect(fogOf(b, b.lanes).every((x) => x === -1)).toBe(true);
  });

  it('air: filaments cluster on AIR_LANES orbits: shared aSpeed + aIon per lane, aAlt within the clipped σ and never across the 0.5 flip', () => {
    const b = airBuf.buildBuffers(3600, 1200);
    const L = airBuf.AIR_LANES;
    expect(L).toBe(8); // fix wave: denser lanes
    const lanes = filOf(b, b.lanes), spd = filOf(b, b.speeds), alt = filOf(b, b.alts), ion = filOf(b, b.ions);
    expect(new Set(lanes).size).toBe(L);
    expect(new Set(spd).size).toBe(L);
    const ionLanes = new Set();
    for (let k = 0; k < L; k++) {
      const pick = (a) => a.filter((_, i) => lanes[i] === k);
      expect(new Set(pick(spd)).size).toBe(1);
      expect(new Set(pick(ion)).size).toBe(1);
      if (pick(ion)[0] === 1) ionLanes.add(k);
      const a = pick(alt);
      expect(Math.max(...a) - Math.min(...a)).toBeLessThanOrEqual(2 * THREAD_CROSS_CLIP * airBuf.AIR_SIGMA_ALT + 1e-6);
      expect(a.every((x) => x > 0.5) || a.every((x) => x <= 0.5)).toBe(true); // one rotation direction per lane
    }
    expect(ionLanes.size).toBe(Math.max(1, Math.round(airBuf.AIR_ION_SHARE * L)));
    // both rotation directions are represented, every lane centre clear of the flip
    const centre = (k) => { const a = alt.filter((_, i) => lanes[i] === k); return (Math.max(...a) + Math.min(...a)) / 2; };
    const cs = Array.from({ length: L }, (_, k) => centre(k));
    expect(cs.some((c) => c > 0.5)).toBe(true);
    expect(cs.some((c) => c <= 0.5)).toBe(true);
    expect(alt.every((x) => x >= 0 && x <= 1)).toBe(true);
  });
});

describe('gas threads fix wave (Task 7d review + look)', () => {
  const laneMean = (b, a) => {
    const per = new Map();
    b.lanes.forEach((k, i) => { if (k >= 0) per.set(k, a[i]); });
    return [[...per.values()].reduce((s, x) => s + x, 0) / per.size, per.size];
  };

  it('lane rates are stratified: the per-lane rate label mean is within 1/L of 0.5 (mirror-sky pace)', () => {
    for (const [buf, key] of [[fluidBuf, 'offsets'], [airBuf, 'speeds']]) {
      const b = buf.buildBuffers(3600, 1200);
      const [m, L] = laneMean(b, b[key]);
      expect(Math.abs(m - 0.5)).toBeLessThanOrEqual(1 / L);
    }
  });

  it('air: the filament y-noise is periodic in the orbit angle (no seam at aPhase 0/1); the fog path is byte-identical', () => {
    expect(atmoSrc).toContain('? vec3(angle * 0.25, uTime * 0.07, aAlt * 4.0)');               // fog: the old argument
    expect(atmoSrc).toContain(': vec3(cos(angle) * 0.25, sin(angle) * 0.25 + uTime * 0.07, aAlt * 4.0);');
    expect(atmoSrc).toContain('vec3 yArg = aRole < 0.5');
    expect(atmoSrc).toContain('pos.y += snoise(yArg) * 0.15;');
    expect(atmoSrc).not.toContain('pos.y += snoise(vec3(angle * 0.25');
    // the shimmer (keyed on aPhase, a seam) is fog-only since Task 7e fix 2: the old lines, byte-identical
    expect(atmoSrc).toContain('pos.x += snoise(pos * 5.0 + vec3(st, 0.0, aPhase)) * 0.03;');
    expect(atmoSrc).toContain('pos.z += snoise(pos * 5.0 + vec3(aPhase, 0.0, st * 1.1)) * 0.03;');
    expect(atmoSrc).not.toContain('shimKey');
  });

  it('fluid: filaments get a per-lane hue offset; fog hue unchanged', () => {
    expect(particleSrc).toContain('float laneHue = aRole < 0.5 ? 0.0 : gasHash(aLane, 0.37) * FLUID_LANE_HUE_SPREAD;');
    expect(fluidBuf.FLUID_LANE_HUE_SPREAD).toBe(0.25);
    expect(particleSrc).toContain('vHue = fract(aPhase + uTime * 0.05 + uChromatic * 0.33 + laneHue);');
  });
});

describe('gas threads look round 2 (Task 7e)', () => {
  it('weight-aware lane pace: the particle-weighted rate label mean is within 0.02 of 0.5 (fluid offsets, air speeds)', () => {
    for (const [buf, key] of [[fluidBuf, 'offsets'], [airBuf, 'speeds']]) {
      for (const [n, f] of [[3600, 1200], [1800, 600], [2400, 1200]]) {
        const b = buf.buildBuffers(n, f);
        // air: the sky's AIR_ORBIT_MEAN is the non-ion mean, so the ion lane (x2.8) is left out of the balance
        const ions = b.ions ? filOf(b, b.ions) : null;
        const xs = filOf(b, b[key]).filter((_, i) => !ions || ions[i] === 0);
        const m = xs.reduce((s, x) => s + x, 0) / xs.length;
        expect(Math.abs(m - 0.5)).toBeLessThanOrEqual(0.02);
      }
    }
  });

  it('air filaments: per-lane tilted orbit plane (seeded from aLane), gated on role; prev core shares it (same orbitPos)', () => {
    expect(atmoSrc).toContain('const float AIR_TILT_MIN = ${glf(AIR_TILT_MIN)};');
    expect(atmoSrc).toContain('const float AIR_TILT_MAX = ${glf(AIR_TILT_MAX)};');
    expect(atmoSrc).toContain('vec3 ring = vec3(cos(angle) * radius, 0.0, sin(angle) * radius);');
    expect(atmoSrc).toContain('if (aRole > 0.5) ring = airTilt(ring, aLane);');
    expect(atmoSrc).toContain('return vec3(0.0, orbitHeight, 0.0) + ring;');
    expect(atmoSrc).toContain('vec3 airTilt(vec3 v, float lane) {');
    expect(atmoSrc).toContain('float th = mix(AIR_TILT_MIN, AIR_TILT_MAX, gasHash(lane, 0.71));');
    expect(atmoSrc).toContain('float az = 6.283185307 * gasHash(lane, 0.13);');
    expect(atmoSrc).toContain('return v * c + cross(u, v) * s + u * dot(u, v) * (1.0 - c);'); // Rodrigues about a horizontal axis
    expect(atmoSrc).toContain('vec3 prevCore = orbitPos(uPhase - STREAK_DT * uPhaseRate, anglePrev);');
    expect(airBuf.AIR_TILT_MIN).toBeGreaterThanOrEqual((8 * Math.PI) / 180 - 1e-9);
    expect(airBuf.AIR_TILT_MAX).toBeLessThanOrEqual((20 * Math.PI) / 180 + 1e-9);
    expect(airBuf.AIR_TILT_MAX).toBeLessThan(Math.PI / 2); // never flips the rotation sense
  });

  it('air filaments: slow per-lane vertical wander, periodic in the angle, filaments only; fog y-noise unchanged', () => {
    expect(atmoSrc).toContain('? vec3(angle * 0.25, uTime * 0.07, aAlt * 4.0)');
    expect(atmoSrc).toContain('if (aRole > 0.5) pos.y += snoise(vec3(cos(angle) * AIR_WANDER_R + aLane * 3.1, sin(angle) * AIR_WANDER_R, uTime * AIR_WANDER_RATE)) * AIR_WANDER;');
    for (const c of ['AIR_WANDER', 'AIR_WANDER_R', 'AIR_WANDER_RATE']) expect(atmoSrc).toContain(`const float ${c} = \${glf(${c})};`);
    expect(airBuf.AIR_WANDER).toBeGreaterThan(0);
    expect(airBuf.AIR_WANDER_RATE).toBeLessThan(0.2);
  });

  it('air filaments: their own live gain knob (uAirFilGain), filaments only; fluid untouched', () => {
    expect(atmoSrc).toContain('vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime) * (aRole < 0.5 ? 1.0 : uAirFilGain) / fray;');
    expect(particleSrc).not.toContain('uAirFilGain');
  });
});

describe('air thread dashes follow the wavy tilted path (Task 7e fix)', () => {
  it('filaments: prev runs the same displacement chain at the prev angle; fog keeps prev = prevCore + (pos - core)', () => {
    expect(atmoSrc).toContain('vec3 airDisplace(vec3 core, float angle) {');
    expect(atmoSrc).toContain('vec3 pos = airDisplace(core, angle);');
    expect(atmoSrc).toContain('vec3 prev = aRole < 0.5 ? prevCore + (pos - core) : airDisplace(prevCore, anglePrev);');
    // the chain itself is unchanged (fog byte-identical): y-noise, wander (filaments), curl, shimmer, in that order
    const body = atmoSrc.slice(atmoSrc.indexOf('vec3 airDisplace(vec3 core, float angle) {'), atmoSrc.indexOf('void main(){'));
    const order = ['pos.y += snoise(yArg) * 0.15;', 'if (aRole > 0.5) pos.y += snoise(vec3(cos(angle) * AIR_WANDER_R',
      'vec3 curl = curlNoise(pos * 0.9 + vec3(t, t * 0.6, t * 0.8));', 'pos += curl * uTurbulence * 0.3 * (aRole < 0.5 ? 1.0 : AIR_FIL_CURL);',
      'if (aRole < 0.5) {', 'pos.x += snoise(pos * 5.0 + vec3(st, 0.0, aPhase)) * 0.03;', 'pos.z += snoise(pos * 5.0 + vec3(aPhase, 0.0, st * 1.1)) * 0.03;', 'return pos;'];
    let at = -1;
    for (const line of order) { const j = body.indexOf(line); expect(j).toBeGreaterThan(at); at = j; }
  });

  // Documents the geometry (a pure JS replica: it passes on any GLSL); the regression gate is the `prev` string pin above.
  // Its stand-ins keep the full-amplitude curl + shimmer (the 5f193536 worst case); since Task 7e fix 2 the filaments
  // have no shimmer and curl x AIR_FIL_CURL, which only makes the path smoother.
  it('geometry note (JS replica): a prev through the same chain tracks the trajectory tangent; the old prev missed it by up to ~90° at the limb', () => {
    // a tilted ring + smooth stand-ins for the angle-keyed y-noise/wander and the position-keyed curl/shimmer
    const th = 0.25, az = 0.8, r = 1.0, h = 0.3;
    const u = [Math.cos(az), 0, Math.sin(az)];
    const tilt = (v) => {
      const c = Math.cos(th), s = Math.sin(th), d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      return v.map((vi, i) => vi * c + x[i] * s + u[i] * d * (1 - c));
    };
    const core = (a) => { const g = tilt([Math.cos(a) * r, 0, Math.sin(a) * r]); return [g[0], g[1] + h, g[2]]; };
    const displace = (p, a) => {
      const q = [p[0], p[1] + 0.15 * Math.sin(1.3 * Math.cos(a) + 0.9 * Math.sin(a)) + 0.12 * Math.sin(2 * a + 1), p[2]];
      const c = [Math.sin(0.9 * q[1] + 1.1), Math.cos(0.9 * q[2] - 0.4), Math.sin(0.9 * q[0] + 2.0)].map((x) => x * 0.15);
      const w = q.map((x, i) => x + c[i]);
      return [w[0] + 0.03 * Math.sin(5 * w[2]), w[1], w[2] + 0.03 * Math.cos(5 * w[0])];
    };
    const scr = (p) => [p[0], p[1]]; // side-on view down z
    const ang = (v, w) => {
      const d = Math.atan2(v[1], v[0]) - Math.atan2(w[1], w[0]);
      return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 180 / Math.PI;
    };
    const da = 0.03; // ~ STREAK_DT x the air angular rate
    let worstNew = 0, worstOld = 0;
    for (let a = 0; a < 2 * Math.PI; a += 0.05) {
      const now = displace(core(a), a);
      const m = a - da / 2, e = 1e-4; // trajectory tangent at the dash midpoint (per radian)
      const fd = scr(displace(core(m + e), m + e)).map((x, i) => (x - scr(displace(core(m - e), m - e))[i]) / (2 * e));
      const pNew = displace(core(a - da), a - da);
      const pOld = core(a - da).map((x, i) => x + now[i] - core(a)[i]);
      const vNew = scr(now).map((x, i) => x - scr(pNew)[i]);
      const vOld = scr(now).map((x, i) => x - scr(pOld)[i]);
      if (Math.hypot(...fd) < 0.1) continue; // projected path nearly a point here: the dash is a dot
      // fold: a dash is a segment, its sign is irrelevant
      worstNew = Math.max(worstNew, Math.min(ang(vNew, fd), 180 - ang(vNew, fd)));
      worstOld = Math.max(worstOld, Math.min(ang(vOld, fd), 180 - ang(vOld, fd)));
    }
    expect(worstNew).toBeLessThan(3);
    expect(worstOld).toBeGreaterThan(30);
  });
});

describe('air threads as streamlines (Task 7e fix 2)', () => {
  it('filaments: no shimmer, curl x AIR_FIL_CURL, their own dash cap AIR_FIL_ASPECT (glf); fluid keeps FIL_ASPECT', () => {
    expect(airBuf.AIR_FIL_CURL).toBe(0.25);
    expect(airBuf.AIR_FIL_ASPECT).toBe(6);
    for (const c of ['AIR_FIL_CURL', 'AIR_FIL_ASPECT']) expect(atmoSrc).toContain(`const float ${c} = \${glf(${c})};`);
    expect(atmoSrc).toContain('pos += curl * uTurbulence * 0.3 * (aRole < 0.5 ? 1.0 : AIR_FIL_CURL);');
    expect(atmoSrc).toMatch(/if \(aRole < 0\.5\) \{\s*pos\.x \+= snoise\(pos \* 5\.0 \+ vec3\(st, 0\.0, aPhase\)\) \* 0\.03;\s*pos\.z \+= snoise\(pos \* 5\.0 \+ vec3\(aPhase, 0\.0, st \* 1\.1\)\) \* 0\.03;\s*\}/);
    expect(particleSrc).toContain('clipBack, clipAhead, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius), fray);');
  });

  it('air pace per hemisphere: upper and lower non-ion particle-weighted aSpeed each near 0.5 (the sky drives each at AIR_ORBIT_MEAN)', () => {
    for (const [n, f] of [[3600, 1200], [1800, 600]]) {
      const b = airBuf.buildBuffers(n, f);
      const spd = filOf(b, b.speeds), alt = filOf(b, b.alts), ion = filOf(b, b.ions);
      for (const upper of [true, false]) {
        const xs = spd.filter((_, i) => ion[i] === 0 && (alt[i] > 0.5) === upper);
        expect(xs.length).toBeGreaterThan(0);
        const m = xs.reduce((s, x) => s + x, 0) / xs.length;
        expect(Math.abs(m - 0.5)).toBeLessThanOrEqual(0.02);
      }
    }
  });
});


// Task 7f fix: threads hold their shape. Replicas (threadReplica.js: GLSL-ported chains incl. shimmer + curl) on the
// real lanes at the desktop fit; visible gap = along-axis gap > 1 px beyond the two dashes.
describe('threads hold their shape (Task 7f fix)', () => {
  it('fluid VS: damped filament shimmer (FLUID_FIL_SHIMMER via glf, fog x 1); lane-neighbour samples through the full chain', () => {
    expect(fluidBuf.FLUID_FIL_SHIMMER).toBeGreaterThanOrEqual(0);
    expect(fluidBuf.FLUID_FIL_SHIMMER).toBeLessThanOrEqual(0.25);
    expect(particleSrc).toContain('const float FLUID_FIL_SHIMMER = ${glf(FLUID_FIL_SHIMMER)};');
    expect(particleSrc).toContain('float shimK = aRole < 0.5 ? 1.0 : FLUID_FIL_SHIMMER;');
    expect(particleSrc).toContain('float jx = snoise(basePos * 8.0 + vec3(uTime, 0.0, 0.0)) * 0.012 * shimK;');
    expect(particleSrc).toContain('float jy = snoise(basePos * 8.0 + vec3(0.0, uTime, 0.0)) * 0.012 * shimK;');
    expect(particleSrc).toContain('float jz = snoise(basePos * 8.0 + vec3(0.0, 0.0, uTime)) * 0.012 * shimK;');
    expect(particleSrc).toContain('vec3 fluidFilAt(float ph) {');
    expect(particleSrc).toContain('return b + j + curlNoise(c * 2.0 + uTime * 0.1) * uCurlAmp;');
    expect(particleSrc).toContain('float dph = aGap / (0.6 + aOffset * 0.4);');
    expect(particleSrc).toContain('clipBack = projectionMatrix * (modelViewMatrix * vec4(fluidFilAt(uPhase - dph) * squash, 1.0));');
    expect(particleSrc).toContain('clipAhead = projectionMatrix * (modelViewMatrix * vec4(fluidFilAt(uPhase + dph) * squash, 1.0));');
    expect(particleSrc).toContain('float alpha = (vRole < 0.5 ? smoothstep(1.0, 0.3, d) : gasFilProfile(d)) * gasTaper(gl_PointCoord);');
  });

  it('air VS: aGap; neighbours through orbitAt + airDisplace at angle ± aGap·2π; taper; the orbit split keeps the fog ops', () => {
    expect(atmoSrc).toContain('attribute float aGap;');
    expect(atmoSrc).toContain('<bufferAttribute attach="attributes-aGap" array={buffers.gaps} count={PARTICLE_COUNT} itemSize={1} />');
    expect(atmoSrc).toContain('vec3 orbitAt(float angle) {');
    expect(atmoSrc).toContain('return orbitAt(angle);');
    expect(atmoSrc).toContain('clipBack = projectionMatrix * (modelViewMatrix * vec4(airDisplace(orbitAt(angle - dA), angle - dA) * squash, 1.0));');
    expect(atmoSrc).toContain('clipAhead = projectionMatrix * (modelViewMatrix * vec4(airDisplace(orbitAt(angle + dA), angle + dA) * squash, 1.0));');
    expect(atmoSrc).toContain('float alpha = (vRole < 0.5 ? smoothstep(1.0, 0.0, d) : gasFilProfile(d)) * gasTaper(gl_PointCoord);');
    const b = airBuf.buildBuffers(3600, 1200);
    expect(fogOf(b, b.gaps).every((g) => g === 0)).toBe(true);
    expect(filOf(b, b.gaps).every((g) => g > 0 && g < 0.05)).toBe(true);
    expect(airBuf.AIR_SIGMA_ALT).toBe(0.0015);
  });

  it('fluid replica (shimmer included): moving, visible gaps ≤ 1 % and dash-off-path p95 ≤ 1.5 px', () => {
    const m = measureThreads('fluid', fluidBuf.buildBuffers(3600, 1200), { rate: 0.1, step: 3, devSteps: 12 });
    expect(m.openVis).toBeLessThanOrEqual(0.01);
    expect(m.devP95).toBeLessThanOrEqual(1.5);
  });

  it('fluid replica: the shimmer at full amplitude would bend the path off the dash (the reviewer\'s 7f finding is visible here)', () => {
    const m = measureThreads('fluid', fluidBuf.buildBuffers(3600, 1200), { rate: 0.1, step: 3, devSteps: 12, shimK: 1 });
    expect(m.devP95).toBeGreaterThan(2); // 7g: the bent dash follows the wiggle a little better (was > 3 straight); still > the 1.5 bar
  });

  it('calm (rate 0): every filament keeps a dash (length > width) along the path tangent: frozen threads, few visible gaps', () => {
    const b = fluidBuf.buildBuffers(3600, 1200);
    const angErr = [];
    let held = 0, n = 0;
    const m = measureThreads('fluid', b, {
      rate: 0, step: 3, devSteps: 12,
      onSprite: ({ at, w, sprite, now, back, ahead }) => {
        const gapPx = Math.max(Math.hypot(now[0] - back[0], now[1] - back[1]), Math.hypot(ahead[0] - now[0], ahead[1] - now[1]));
        n++;
        if (sprite.total >= Math.min(1.3 * gapPx, 24 * w) - 1e-9 && sprite.total > 0) held++;
        const e = 1e-5, p1 = at(e), p0 = at(-e);
        const t = [p1[0] - p0[0], p1[1] - p0[1]], tl = Math.hypot(t[0], t[1]);
        if (tl < 1e-6) return;
        const c = Math.abs(t[0] * sprite.dir[0] + t[1] * sprite.dir[1]) / tl;
        angErr.push((Math.acos(Math.min(c, 1)) * 180) / Math.PI);
      },
    });
    expect(held).toBe(n); // the gap part holds at rate 0 for every filament: a dash, not a collapsed dot
    angErr.sort((x, y) => x - y);
    expect(angErr[Math.floor(angErr.length * 0.95)]).toBeLessThan(10);
    expect(m.openVis).toBeLessThanOrEqual(0.02);
    // the time secant is gone: same dash at rate 0 and at a moving rate with the speed part removed
    const now = [0, 0], back = [-5, -1], ahead = [5, 1];
    const calm = spriteThread(now, now, back, ahead, 2, 0.5, 16);
    expect(calm.total).toBeCloseTo(1.3 * Math.hypot(5, 1), 9);
    expect(calm.dir[1] / calm.dir[0]).toBeCloseTo(0.2, 9);
  });

  it('fluid buffers: aGap = the larger neighbour gap (in [(1 - J)/n, (1 + J)/n] per lane), fog 0; FLUID_ALONG_JITTER 0.3', () => {
    expect(fluidBuf.FLUID_ALONG_JITTER).toBe(0.3);
    const b = fluidBuf.buildBuffers(3600, 1200);
    expect(fogOf(b, b.gaps).every((g) => g === 0)).toBe(true);
    const J = fluidBuf.FLUID_ALONG_JITTER;
    for (let k = 0; k < fluidBuf.FLUID_LANES; k++) {
      const g = Array.from(b.gaps).filter((_, i) => b.lanes[i] === k);
      const n = g.length;
      expect(Math.min(...g)).toBeGreaterThanOrEqual((1 - J) / n - 1e-6);
      expect(Math.max(...g)).toBeLessThanOrEqual((1 + J) / n + 1e-6);
    }
  });

  it('air replica: gap-closed, visible gaps ≤ 1 % moving (were 14 % at fdd064f1), dash-off-path p95 ≤ 1.5 px', () => {
    const b = airBuf.buildBuffers(3600, 1200);
    const m = measureThreads('air', b, { rate: 1.2, step: 6, devSteps: 10, lanes: [0, 1, 2, 3, 4] });
    expect(m.openVis).toBeLessThanOrEqual(0.01);
    expect(m.devP95).toBeLessThanOrEqual(1.5);
  });

  it('calm freezes the whole gas: the neighbour samples read only uPhase / uTime (the clock zeroes their rates in calm)', () => {
    for (const src of [particleSrc, atmoSrc]) {
      const block = src.slice(src.indexOf('vec4 clipBack = gl_Position;'), src.indexOf('gl_PointSize = gasSpriteThread('));
      expect(block).not.toMatch(/uPhaseRate|elapsed|uClock/);
    }
    expect(typeof fluidFil).toBe('function');
    expect(typeof proj).toBe('function');
  });
});

describe('fluid calm threads are lines, not a staircase (Task 7g)', () => {
  // The 7f dash was straight, centred on the particle, along its OWN streamline's secant; neighbours sit at their own
  // cross-lane jitter, so neighbouring dashes were parallel but displaced sideways (calm fluid: step p50 2.0 px,
  // p95 6.5 px, max 15 px at a 2.3 px core). Fix: a bent dash (each half aims at its lane-neighbour sample: no chord
  // error on the knot's bends) + FLUID_SIGMA_R 0.03 → 0.0075 (the air precedent: σ cut ×4 in 7f).
  it('fluid replica, calm: the sideways step where two dashes meet is sub-core (p50 ≤ 0.6 px, p95 ≤ 2 px); no new gaps', () => {
    const m = measureThreads('fluid', fluidBuf.buildBuffers(3600, 1200), { rate: 0, step: 3, devSteps: 12 });
    expect(m.stepP50).toBeLessThanOrEqual(0.6);
    expect(m.stepP95).toBeLessThanOrEqual(2);
    expect(m.openVis).toBeLessThanOrEqual(0.012);
    expect(m.devP95).toBeLessThanOrEqual(1.5);
  });

  it('both halves of the fix are needed: the straight dash at the new σ, or the bent dash at the old σ, still steps', () => {
    const straight = measureThreads('fluid', fluidBuf.buildBuffers(3600, 1200), { rate: 0, step: 6, devSteps: 4, straight: true });
    expect(straight.stepP95).toBeGreaterThan(2.5); // chord error on the bends
    const b = fluidBuf.buildBuffers(3600, 1200);
    const cent = new Map();
    b.lanes.forEach((k, i) => { if (k >= 0) { const c = cent.get(k) || [0, 0]; c[0] += b.radii[i]; c[1]++; cent.set(k, c); } });
    const k4 = 0.03 / fluidBuf.FLUID_SIGMA_R;
    b.lanes.forEach((k, i) => { if (k >= 0) { const c = cent.get(k)[0] / cent.get(k)[1]; b.radii[i] = c + (b.radii[i] - c) * k4; } });
    const oldSigma = measureThreads('fluid', b, { rate: 0, step: 6, devSteps: 4 });
    expect(oldSigma.stepP95).toBeGreaterThan(4);
  });

  it('air is no worse (calm step p95 ≤ 3.4 px, visible gaps ≤ 2.5 %)', () => {
    const m = measureThreads('air', airBuf.buildBuffers(3600, 1200), { rate: 0, step: 6, devSteps: 6 });
    expect(m.stepP95).toBeLessThanOrEqual(3.4);
    expect(m.openVis).toBeLessThanOrEqual(0.025); // 0.0233 straight → 0.0242: the gap is now read along the ahead half (see report)
  });

  it('FLUID_SIGMA_R 0.0075', () => {
    expect(fluidBuf.FLUID_SIGMA_R).toBe(0.0075);
  });

  it('shared chunk: the dash bends (ahead half vStreakDir, back half vStreakDir2); no thread (gasSprite) = one straight dash', () => {
    const vs = GAS_STREAK_VS, fs = GAS_STREAK_FS;
    expect(vs).toMatch(/varying vec2 vStreakDir2;/);
    expect(fs).toMatch(/varying vec2 vStreakDir2;/);
    expect(vs).toMatch(/vec2 dA = pAhead - pNow;/);
    expect(vs).toMatch(/vec2 dB = pNow - pBack;/);
    expect(vs).toMatch(/vStreakDir2 = vec2\(dirB\.x, -dirB\.y\);/);
    expect(vs).toMatch(/gasSpriteCore\(clipNow, clipPrev, clipNow, clipNow,/); // tl = 0: dirA = dirB = dir
    expect(fs).toMatch(/clamp\(dot\(q, vStreakDir\), 0\.0, vStreakCap\.x\)/);
    expect(fs).toMatch(/clamp\(-dot\(q, vStreakDir2\), 0\.0, vStreakCap\.x\)/);
  });
});

// Task 8: fire + earth on the two-role gas. No threads (amendment A3): gasSprite, the old straight capsule.
describe('earth (spec §3f): dust fog + settling streaks', () => {
  it('core sampled twice; fog = the old dust sprite, filament = thin tapered capsule; live knobs', () => {
    expect(sedimentSrc).toContain('${GAS_STREAK_VS}');
    expect(sedimentSrc).toContain('${GAS_STREAK_FS}');
    expect(sedimentSrc.indexOf('${GAS_STREAK_VS}')).toBeGreaterThan(sedimentSrc.indexOf('float snoise('));
    expect(sedimentSrc).toContain('vec3 sedimentPos(float ph, out float age, out float sinkOffset) {');
    expect(sedimentSrc).toContain('uPhase - STREAK_DT * uPhaseRate');
    expect(sedimentSrc).toContain('vec3 prev = prevCore + (pos - core);');
    expect(sedimentSrc).toContain('prev *= 1.0 - uCondense * uCondense;');
    expect(sedimentSrc).toContain('attribute float aRole;');
    expect(sedimentSrc).toContain('float fogSize = baseSize * ageFactor * (280.0 / -mvPos.z) * bite;');
    expect(sedimentSrc).toContain('float filW = gasFilWidth(-mvPos.z, aSize, bite);');
    expect(sedimentSrc).toContain('float size = aRole < 0.5 ? fogSize : filW;');
    expect(sedimentSrc).toContain('gl_PointSize = gasSpriteGain(gl_Position, projectionMatrix * mvPrev, aRole, size, sedStretch, gasHash(aPhase, aSeed), uStreakGain * uEarthStreakGain);');
    expect(sedimentSrc).toContain('aetherLightVS(mvPos.xyz, size);');
    expect(sedimentSrc).toMatch(/float d = gasStreakDist\(gl_PointCoord\);/);
    expect(sedimentSrc).toContain('float alpha = smoothstep(1.0, 0.15, d) * gasTaper(gl_PointCoord);');
    expect(sedimentSrc).toContain('gl_FragColor = gasOut(col, (alpha * vAlpha * (0.5 + (1.0 - vStrata) * 0.4) * uOpacity * vLane) * planetWindow(), dither);');
    expect(sedimentSrc).toContain('mat.uniforms.uPhaseRate.value = clk.rate.earth;');
    expect(sedimentSrc).toContain('...GAS_TUNE_UNIFORMS(PLANET_TUNE),');
    expect(sedimentSrc).toContain('writeGasTune(mat.uniforms, PLANET_TUNE, state.gl.getPixelRatio(), gasPointMax(state.gl));');
    expect(sedimentSrc).toContain('uPhaseRate: { value: 0 },');
    expect(sedimentSrc).not.toContain('gasSpriteThread(');
    expect(sedimentSrc).not.toContain('aLane');
  });

  it('no streak across a sink or life respawn; lanes by spawn direction and mass', () => {
    expect(sedimentSrc).toContain('float sedStretch = (agePrev > age || sinkPrev > sinkOffset) ? 1.0 : FIL_ASPECT;');
    expect(sedimentSrc).toContain('vLane = gasAlpha(aRole, vec3(sin(theta) * cos(phi) * 2.0, cos(theta) * 2.0, aMass * 2.0), uTime);');
  });

  it('buffers carry the deterministic role split; the geometry remounts when the split changes', () => {
    expect(sedimentSrc).toContain('fogCount = null,');
    expect(sedimentSrc).toContain('const N_FOG = fogCount ?? PARTICLE_COUNT;');
    expect(sedimentSrc).toContain('function buildBuffers(count, nFog) {');
    expect(sedimentSrc).toContain('roles: gasRoles(count, nFog)');
    expect(sedimentSrc).toContain('useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG])');
    expect(sedimentSrc).toContain('<bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>');
    expect(sedimentSrc).toContain('<bufferAttribute attach="attributes-aRole" array={buffers.roles} count={PARTICLE_COUNT} itemSize={1} />');
  });
});

describe('fire ember + earth streak knobs reach only their own flow (Task 8b)', () => {
  it('ember knobs: fire only, on the ember width/alpha (the body fogSize is untouched); earth shutter: earth only', () => {
    expect(thermalSrc).toContain('float fogSize = min(baseSize * sizeFactor * (80.0 / depth), uPointSizeMax) * bite;');
    expect(thermalSrc).toContain('float size = aEmber < 0.5 ? fogSize : filW;');
    expect(thermalSrc).not.toContain('uEarthStreakGain');
    expect(sedimentSrc).not.toMatch(/uEmberSize|uEmberGain/);
    for (const src of [particleSrc, atmoSrc]) expect(src).not.toMatch(/uEmberSize|uEmberGain|uEarthStreakGain|gasSpriteGain/);
    expect(sedimentSrc).toContain('float sedStretch = (agePrev > age || sinkPrev > sinkOffset) ? 1.0 : FIL_ASPECT;');
  });
});

describe('fire (spec §3f): fog = the flame body, filament = embers only', () => {
  it('core sampled twice; the role IS aEmber, built by gasRoles (no random ember draw)', () => {
    expect(thermalSrc).toContain('${GAS_STREAK_VS}');
    expect(thermalSrc).toContain('${GAS_STREAK_FS}');
    expect(thermalSrc.indexOf('${GAS_STREAK_VS}')).toBeGreaterThan(thermalSrc.indexOf('float snoise('));
    expect(thermalSrc).toContain('vec3 flamePos(float ph, out float age) {');
    expect(thermalSrc).toContain('uPhase - STREAK_DT * uPhaseRate');
    expect(thermalSrc).toContain('vec3 prev = prevCore + (pos - core);');
    expect(thermalSrc).toContain('prev *= 1.0 - uCondense * uCondense;');
    expect(thermalSrc).toContain('function buildBuffers(count, nFog) {');
    expect(thermalSrc).toContain('const embers    = gasRoles(count, nFog);');
    for (const gone of ['emberCutoff', 'emberShrink', 'attribute float aRole;', 'uGasSize', 'STRETCH_MAX']) expect(thermalSrc).not.toContain(gone);
  });

  it('body: the old flame sprite; embers: small round dots ≤ 1.5x, never across a respawn, unmasked, boosted, no taper', () => {
    expect(thermalSrc).toContain('float fogSize = min(baseSize * sizeFactor * (80.0 / depth), uPointSizeMax) * bite;');
    expect(thermalSrc).toContain('float filW = gasFilWidth(depth, aSize, bite * sizeFactor) * uEmberSize;');
    expect(thermalSrc).toContain('float size = aEmber < 0.5 ? fogSize : filW;');
    expect(thermalSrc).toContain('float emberStretch = agePrev > age ? 1.0 : FIRE_EMBER_STRETCH;');
    expect(thermalSrc).toContain('gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aEmber, size, emberStretch, 0.5);');
    expect(thermalSrc).toContain('vLane = gasRoleAlpha(aEmber) * mix(1.0, FIRE_EMBER_GAIN * uEmberGain, aEmber);');
    expect(thermalSrc).not.toContain('gasLane(');
    expect(thermalSrc).not.toContain('gasAlpha(');
    expect(thermalSrc).not.toContain('gasTaper(');
    expect(thermalSrc).not.toContain('gasSpriteThread(');
    expect(thermalSrc).toMatch(/float d\s*= gasStreakDist\(pc\);/);
    expect(thermalSrc).toContain('gl_FragColor = gasOut(col, (finalAlpha * uOpacity * vLane) * planetWindow(), dither);');
  });

  it('fire: live knobs, fog count, remount key', () => {
    expect(thermalSrc).toContain('mat.uniforms.uPhaseRate.value = clk.rate.thermal;');
    expect(thermalSrc).toContain('...GAS_TUNE_UNIFORMS(PLANET_TUNE),');
    expect(thermalSrc).toContain('writeGasTune(mat.uniforms, PLANET_TUNE, state.gl.getPixelRatio(), gasPointMax(state.gl));');
    expect(thermalSrc).toContain('uPhaseRate: { value: 0 },');
    expect(thermalSrc).toContain('fogCount = null,');
    expect(thermalSrc).toContain('const N_FOG = fogCount ?? PARTICLE_COUNT - Math.round(PARTICLE_COUNT * FIRE_EMBER_SHARE);');
    expect(thermalSrc).toContain('useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG])');
    expect(thermalSrc).toContain('<bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>');
    expect(thermalSrc).toContain('<bufferAttribute attach="attributes-aEmber"   array={buffers.embers}    count={PARTICLE_COUNT} itemSize={1} />');
  });
});

describe('soft threads §2: flows opt in', () => {
  it('fluid + air: the fray widens the drawn filament and divides its alpha (light conserved); fog wk = 1', () => {
    for (const src of [particleSrc, atmoSrc]) {
      expect(src).toContain('float fray = aRole < 0.5 ? 1.0 : gasFray(gasThreadCoord(aLane, aPhase), uTime);');
      expect(src).toMatch(/gasHash\(aPhase, a(Radius|Seed)\), fray\);/);
      expect(src).toMatch(/\/ fray;/);
    }
  });
});
