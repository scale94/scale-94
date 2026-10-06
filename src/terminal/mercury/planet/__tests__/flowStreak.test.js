// Gas filaments in each flow (mirror-sky spec §3, Option A: fog + filament roles in one draw). Read from the sources.
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';
import canvasSrc from '../../MercuryCanvas.jsx?raw';
import fluidBufSrc from '../../../fluid/particleFlowBuffers.js?raw';
import airBufSrc from '../../../air/atmosphericFlowBuffers.js?raw';
import * as fluidBuf from '../../../fluid/particleFlowBuffers';
import * as airBuf from '../../../air/atmosphericFlowBuffers';
import { gasRoles, THREAD_CROSS_CLIP } from '../gasStreak';
import { PLANET_TUNE } from '../planetLook';

const STREAKED = {
  fluid: {
    src: particleSrc,
    bufSrc: fluidBufSrc,
    core: 'vec3 knotPos(float ph, out vec3 center) {',
    fogSize: 'float fogSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPosition.z, aRadius, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSpriteGap(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius), gapPx);',
  },
  air: {
    src: atmoSrc,
    bufSrc: airBufSrc,
    core: 'vec3 orbitPos(float ph, out float angle) {',
    fogSize: 'float fogSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPos.z, aSize, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, AIR_FIL_ASPECT, gasHash(aPhase, aSeed));',
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
      expect(src).toContain('writeGasTune(mat.uniforms, PLANET_TUNE, state.gl.getPixelRatio());');
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

  it('canvas: counts from gasCounts (spec §3e): the active flow x the tier multiplier, ghosts x1, fire flagged', () => {
    expect(canvasSrc).toContain('const gasBase = params.density ?? (isMobile ? 600 : 1200);');
    expect(canvasSrc).toContain('? gasCounts(gasBase, TIERS[TIER].gasDensity, phase === \'thermal\')');
    expect(canvasSrc).toContain(': gasCounts(GHOST_DENSITY, 1, phase === \'thermal\');');
    for (const el of ['fluid', 'thermal', 'earth', 'air']) {
      expect(canvasSrc).toContain(`density={gasFor('${el}').n}`);
      expect(canvasSrc).toContain(`fogCount={gasFor('${el}').fog}`);
    }
    expect(canvasSrc).not.toContain('densityFor');
  });
});

describe('gas filaments glow over the fog: premultiplied one-draw blend (Task 7c)', () => {
  for (const [el, src] of [['fluid', particleSrc], ['air', atmoSrc]]) {
    it(`${el}: FS ends in gasOut(); no raw gl_FragColor vec4(color/col, ...) left; opt-in premultiplied prop`, () => {
      expect(src).toMatch(/gl_FragColor = gasOut\(/);
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

  it('canvas: fluid + air premultiplied (CustomBlending path); fire + earth still NormalBlending, not premultiplied', () => {
    const tag = (name) => canvasSrc.slice(canvasSrc.indexOf(`<${name}`), canvasSrc.indexOf('/>', canvasSrc.indexOf(`<${name}`)));
    for (const n of ['ParticleFlow', 'AtmosphericFlow']) expect(tag(n)).toContain('premultiplied');
    for (const n of ['ThermalFlow', 'SedimentFlow']) {
      expect(tag(n)).not.toContain('premultiplied');
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
    expect(particleSrc).toContain('float laneHue = aRole < 0.5 ? 0.0 : gasHash(aLane, 0.37);');
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
    expect(atmoSrc).toContain('vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime) * (aRole < 0.5 ? 1.0 : uAirFilGain);');
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
    expect(particleSrc).toContain('aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius), gapPx);');
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

// Task 7f: continuous fluid threads. A JS replica of the fluid knot chain (knotPos: Frenet frame, gravity bias, tube
// offset) at the desktop fit (camera 4.43, vfov 42 deg, 1000 px) checks the gap-closing rule on the real lanes.
const kFract = (x) => x - Math.floor(x);
const kHash = (a, b) => kFract(Math.sin(a * 91.7 + b * 47.3) * 43758.5453);
const kCenter = (t) => { const p = t * 6.283185307, cq = Math.cos(3 * p); return [(1 + 0.4 * cq) * Math.cos(2 * p), (1 + 0.4 * cq) * Math.sin(2 * p), 0.4 * Math.sin(3 * p)]; };
const kNorm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const kCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function kPos(ph, aPhase, aOffset, aRadius) {
  const t = kFract(aPhase + ph * (0.6 + aOffset * 0.4));
  const c = kCenter(t), c2 = kCenter(t + 0.001);
  const tan = kNorm(c2.map((x, i) => x - c[i]));
  const up = Math.abs(tan[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  const n = kNorm(kCross(tan, up)), b = kCross(tan, n);
  const gN = -n[1] * 0.015, gB = -b[1] * 0.015, ang = aOffset * 6.283185307, rad = aRadius * 0.32;
  return c.map((x, i) => x + n[i] * (Math.cos(ang) * rad + gN) + b[i] * (Math.sin(ang) * rad + gB));
}
const kF = 500 / Math.tan((21 * Math.PI) / 180);
const kProj = (p) => { const z = 4.43 - p[2]; return [kF * p[0] / z, kF * p[1] / z, z]; };

describe('continuous fluid threads (Task 7f)', () => {
  it('fluid VS: aGap attribute; the trailing gap neighbour runs the same knot chain + offsets; gap px feeds gasSpriteGap (filaments only)', () => {
    expect(particleSrc).toContain('attribute float aGap;');
    expect(particleSrc).toContain('<bufferAttribute attach="attributes-aGap" array={buffers.gaps} count={PARTICLE_COUNT} itemSize={1} />');
    expect(particleSrc).toContain('float gapPx = 0.0;');
    expect(particleSrc).toContain('vec3 gapPos = knotPos(uPhase - aGap / (0.6 + aOffset * 0.4), centerGap) + vec3(jx, jy, jz) + curl;');
    expect(particleSrc).toContain('gapPos *= 1.0 - uCondense * uCondense;');
    expect(particleSrc).toContain('gapPx = gasGapPx(gl_Position, projectionMatrix * (modelViewMatrix * vec4(gapPos, 1.0)));');
    expect(particleSrc).toMatch(/if \(aRole > 0\.5\) \{[^}]*vec3 gapPos = knotPos/);
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

  it('JS replica: with the gap-closing rule, >= 95 % of neighbouring filament pairs on a lane overlap on screen (dash/gap >= 1 at p5)', () => {
    const b = fluidBuf.buildBuffers(3600, 1200);
    const RATE = 0.1, DT = 1 / 30, GAIN = PLANET_TUNE.streakGain, W0 = PLANET_TUNE.filWidth;
    const cov = [];
    for (let k = 0; k < fluidBuf.FLUID_LANES; k++) {
      const idx = [];
      b.lanes.forEach((l, i) => { if (l === k) idx.push(i); });
      idx.sort((x, y) => b.phases[x] - b.phases[y]);
      for (const ph of [0, 2.7]) {
        const P = [], T = [];
        for (const i of idx) {
          const s = 0.6 + b.offsets[i] * 0.4;
          const now = kProj(kPos(ph, b.phases[i], b.offsets[i], b.radii[i]));
          const pr = kProj(kPos(ph - DT * RATE, b.phases[i], b.offsets[i], b.radii[i]));
          const gp = kProj(kPos(ph - b.gaps[i] / s, b.phases[i], b.offsets[i], b.radii[i]));
          const sp = Math.hypot(now[0] - pr[0], now[1] - pr[1]) / DT;
          const w = Math.max(W0 * (4.43 / now[2]) * (0.75 + 0.5 * b.radii[i]), 1.5);
          let L = Math.min(sp * GAIN, 15 * w) * (1 + 0.3 * (2 * kHash(b.phases[i], b.radii[i]) - 1));
          const gapPx = Math.hypot(now[0] - gp[0], now[1] - gp[1]);
          if (sp > 1e-3) L = Math.max(L, Math.min(1.15 * gapPx - w, (24 - 1) * w)); // = the GLSL line pinned in gasStreak.test
          P.push(now); T.push(w + L);
        }
        for (let j = 0; j < P.length; j++) {
          const jn = (j + 1) % P.length, g = Math.hypot(P[jn][0] - P[j][0], P[jn][1] - P[j][1]);
          if (g > 0.5) cov.push((T[j] + T[jn]) / 2 / g);
        }
      }
    }
    cov.sort((x, y) => x - y);
    expect(cov[Math.floor(cov.length * 0.05)]).toBeGreaterThanOrEqual(1);
  });
});
