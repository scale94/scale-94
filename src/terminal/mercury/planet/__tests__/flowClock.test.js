// The flows run on the shared aether clock (mirror-sky spec §1). Read from the sources (the flowLight.test idiom).
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';
import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';
import canvasSrc from '../../MercuryCanvas.jsx?raw';

const FLOWS = { fluid: particleSrc, thermal: thermalSrc, earth: sedimentSrc, air: atmoSrc };

describe('flows on the shared clock', () => {
  for (const [el, src] of Object.entries(FLOWS)) {
    it(`${el}: ticks the clock, reads t and its own phase, no private time`, () => {
      expect(src).toContain("from '../mercury/planet/aetherClock'");
      expect(src).toContain('tickAetherClock(clk, state.clock.elapsedTime, delta);');
      expect(src).toContain('mat.uniforms.uTime.value = clk.t;');
      expect(src).toContain(`mat.uniforms.uPhase.value = clk.phase.${el};`);
      expect(src).toContain('uniform float uPhase;');
      expect(src).toContain('uTime: { value: 0 },');
      expect(src).not.toMatch(/uTime\.value\s*\+=/);
      expect(src).not.toMatch(/uTime \* uSpeed|uTime \* orbitSpeed|uTime \* sinkRate/);
      expect(src).not.toMatch(/uTime:\s*\{\s*value:\s*Math\.random/);
      expect(src).toMatch(/const clk = aetherClock \?\? configureAetherClock\(ownClock, \{/);
    });
  }

  it('the rate literals the clock means are derived from are still in the flows', () => {
    expect(particleSrc).toContain('fract(aPhase + ph * (0.6 + aOffset * 0.4))');
    expect(atmoSrc).toContain('(0.4 + aSpeed * 0.7) * direction * ionSpeedMult');
    expect(atmoSrc).toContain('aAlt > 0.5 ? 1.0 : -0.85');
    expect(thermalSrc).toContain('float lifeMult = 0.4 + aSpeed * 0.6;');
    expect(thermalSrc).toContain('mix(2.4, 3.5, aTemp)');
    expect(thermalSrc).toContain('fract(aPhase + ph * lifeMult)');
    expect(sedimentSrc).toContain('float sinkRate   = aMass * 2.2;');
    expect(sedimentSrc).toContain('fract(aPhase + ph * sinkRate * 0.4)');
    expect(sedimentSrc).toContain('sinkOffset * 2.4');
    expect(sedimentSrc).toContain('masses[i]  = Math.random() < 0.2 ? Math.random() * 0.3 : 0.4 + Math.random() * 0.6;');
  });

  it('MercuryCanvas owns one clock, configures it in render, hands it to every flow', () => {
    expect(canvasSrc).toContain('const [aetherClock] = useState(createAetherClock);');
    expect(canvasSrc).toContain('configureAetherClock(aetherClock, { speed: params.speed ?? 0.1, orbitalSpeed: params.orbitalSpeed ?? 1.2, calm });');
    expect(canvasSrc.match(/aetherClock=\{aetherClock\}/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
