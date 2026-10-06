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

const STREAKED = {
  fluid: {
    src: particleSrc,
    bufSrc: fluidBufSrc,
    core: 'vec3 knotPos(float ph, out vec3 center) {',
    fogSize: 'float fogSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPosition.z, aRadius, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius));',
  },
  air: {
    src: atmoSrc,
    bufSrc: airBufSrc,
    core: 'vec3 orbitPos(float ph, out float angle) {',
    fogSize: 'float fogSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPos.z, aSize, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aSeed));',
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
      expect(src).toContain('vLane = gasAlpha(aRole, gasThreadCoord(aLane, aPhase), uTime);'); // Task 7d: lane id + along label
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
      expect(src).toMatch(/import \{ buildBuffers \} from '\.\/(particleFlowBuffers|atmosphericFlowBuffers)';/);
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
    expect(L).toBeGreaterThanOrEqual(8);
    expect(L).toBeLessThanOrEqual(16);
    const lanes = filOf(b, b.lanes), offs = filOf(b, b.offsets), rads = filOf(b, b.radii);
    expect(new Set(lanes).size).toBe(L);
    expect(new Set(offs).size).toBe(L);
    for (let k = 0; k < L; k++) {
      const o = offs.filter((_, i) => lanes[i] === k), r = rads.filter((_, i) => lanes[i] === k);
      expect(new Set(o).size).toBe(1);
      const mid = (Math.max(...r) + Math.min(...r)) / 2;
      expect(Math.max(...r) - Math.min(...r)).toBeLessThanOrEqual(2 * THREAD_CROSS_CLIP * fluidBuf.FLUID_SIGMA_R + 1e-6);
      expect(mid).toBeGreaterThanOrEqual(0);
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
    expect(L).toBeGreaterThanOrEqual(8);
    expect(L).toBeLessThanOrEqual(18);
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
    expect(alt.every((x) => x >= 0 && x <= 1)).toBe(true);
  });
});
