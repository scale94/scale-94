// Gas filaments in each flow (mirror-sky spec §3). Read from the sources.
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';

const STREAKED = {
  fluid: { src: particleSrc, core: 'vec3 knotPos(float ph, out vec3 center) {', stretch: 'STRETCH_MAX' },
  air: { src: atmoSrc, core: 'vec3 orbitPos(float ph, out float angle) {', stretch: 'STRETCH_MAX' },
};

describe('gas filaments', () => {
  for (const [el, { src, core, stretch }] of Object.entries(STREAKED)) {
    it(`${el}: core motion sampled twice, capsule sprite, lane mask, live knobs`, () => {
      expect(src).toContain('${GAS_STREAK_VS}');
      expect(src).toContain('${GAS_STREAK_FS}');
      expect(src.indexOf('${GAS_STREAK_VS}')).toBeGreaterThan(src.indexOf('float snoise('));
      expect(src).toContain(core);
      expect(src).toContain('uPhase - STREAK_DT * uPhaseRate');
      expect(src).toMatch(new RegExp(`gl_PointSize = gasStreak\\(gl_Position, projectionMatrix \\* mvPrev, size, ${stretch}\\);`));
      expect(src).toContain('vLane = gasLane(');
      expect(src).toContain('* vLane');
      expect(src).toMatch(/float d = gasStreakDist\(gl_PointCoord\);/);
      expect(src).toContain(`mat.uniforms.uPhaseRate.value = clk.rate.${el};`);
      expect(src).toContain('...GAS_TUNE_UNIFORMS(PLANET_TUNE),');
      expect(src).toContain('writeGasTune(mat.uniforms, PLANET_TUNE);');
      expect(src).toContain('uPhaseRate: { value: 0 },');
      expect(src).toContain('prev *= 1.0 - uCondense * uCondense;');
      expect(src).toContain('* uGasSize');
    });
  }
});
