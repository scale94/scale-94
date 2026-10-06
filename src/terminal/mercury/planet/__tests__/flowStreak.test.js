// Gas filaments in each flow (mirror-sky spec §3, Option A: fog + filament roles in one draw). Read from the sources.
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';
import canvasSrc from '../../MercuryCanvas.jsx?raw';

const STREAKED = {
  fluid: {
    src: particleSrc,
    core: 'vec3 knotPos(float ph, out vec3 center) {',
    fogSize: 'float fogSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPosition.z, aRadius, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius));',
  },
  air: {
    src: atmoSrc,
    core: 'vec3 orbitPos(float ph, out float angle) {',
    fogSize: 'float fogSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPos.z, aSize, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aSeed));',
  },
};

describe('gas filaments: two roles in one draw', () => {
  for (const [el, { src, core, fogSize, filW, sprite }] of Object.entries(STREAKED)) {
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
      expect(src).toContain('vLane = gasAlpha(aRole, ');
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
      expect(src).toContain('function buildBuffers(count, nFog) {');
      expect(src).toContain('roles: gasRoles(count, nFog)');
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
