// The lit flows carry the aether light; fire stays emissive. Read from the sources (the dropletOrder.test.js idiom).
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';
import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';

const LIT = { fluid: [particleSrc, 'color'], earth: [sedimentSrc, 'col'], air: [atmoSrc, 'col'] };

describe('flows as sunlit matter', () => {
  for (const [el, [src, v]] of Object.entries(LIT)) {
    it(`${el}: vertex + fragment chunks, the multiply before gl_FragColor, live uniforms`, () => {
      expect(src).toContain('${AETHER_LIGHT_VS}');
      expect(src).toMatch(/aetherLightVS\(mv\w*\.xyz, gl_PointSize\);/);
      expect(src).toContain(`\${aetherLightFS('${el}')}`);
      const fs = src.slice(src.indexOf('const fragmentShader'));
      const mul = fs.indexOf(`${v} *= aetherLight();`);
      expect(mul).toBeGreaterThan(0);
      expect(mul).toBeLessThan(fs.indexOf('gl_FragColor'));
      expect(src).toContain('uSunDirW: { value: new THREE.Vector3(...SUN_DIR_WORLD) }');
      expect(src).toContain('mat.uniforms.uLitFloor.value = PLANET_TUNE.aetherFloor;');
      expect(src).toContain('mat.uniforms.uLitPen.value = PLANET_TUNE.aetherPenumbra;');
      expect(src).toMatch(/uPlanetRadius:\s*\{\s*value:/);
    });
  }
  it('fire is untouched: it makes its own light', () => {
    expect(thermalSrc).not.toMatch(/aetherLight/);
  });
});
