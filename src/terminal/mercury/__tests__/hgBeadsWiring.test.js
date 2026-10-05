// src/terminal/mercury/__tests__/hgBeadsWiring.test.js — source-level wiring (the repo's idiom for r3f glue).
import { describe, it, expect } from 'vitest';
import hookSrc from '../useHgBeads.js?raw';
import planetSrc from '../MercuryPlanet.jsx?raw';
import canvasSrc from '../MercuryCanvas.jsx?raw';

describe('Hg beads wiring', () => {
  it('the hook shares the planet mirror uniforms and sets GLSL3', () => {
    expect(hookSrc).toContain('for (const name of HG_MIRROR_UNIFORMS) uniforms[name] = planetMaterial.uniforms[name];');
    expect(hookSrc).toContain('glslVersion: THREE.GLSL3');
    expect(hookSrc).toContain('...BEAD_MATERIAL');
    expect(hookSrc).toContain('TIERS[tier].beads');
    expect(hookSrc).toContain('setDrawRange(0, n)');
    expect(hookSrc).toContain('new THREE.BufferAttribute(sim.outBead, 3)');
  });
  it('the planet feeds all three sources and steps once per frame', () => {
    expect(planetSrc).toContain('useHgBeads({ tier, planetMaterial: material })');
    expect(planetSrc).toMatch(/spawnFling\(beads\.sim, /);
    expect(planetSrc).toContain('beadCtx.rateScale = TIERS[tier].beadRate;');
    expect(planetSrc).toMatch(/spawnSplash\(beads\.sim, /);
    expect(planetSrc).toMatch(/stepBeads\(beads\.sim, stepS, beadCtx\)/); // clamped dt, not raw delta
    expect(planetSrc).toContain('<points geometry={beads.geometry} material={beads.material} renderOrder={beads.renderOrder} frustumCulled={false} />');
  });
  it('the canvas tells the planet which element is active', () => {
    const planetTag = canvasSrc.slice(canvasSrc.indexOf('<MercuryPlanet'), canvasSrc.indexOf('<MercurySphere'));
    expect(planetTag).toContain('activePhase={activePhase}');
  });
  it('calm spawns no bursts: the splash sits after the calm arm (Option A)', () => {
    const calmArm = planetSrc.indexOf('} else if (calm) {');
    expect(calmArm).toBeGreaterThan(0);
    expect(planetSrc.indexOf('spawnSplash(beads.sim')).toBeGreaterThan(calmArm);
  });
  it('the hook uploads the bead sparkle gain', () => {
    expect(hookSrc).toContain('uBeadSparkle: { value: PLANET_TUNE.beadSparkle }');
    expect(hookSrc).toContain('u.uBeadSparkle.value = PLANET_TUNE.beadSparkle;');
    expect(hookSrc).toContain('uDustSparkle: { value: PLANET_TUNE.dustSparkle }');
    expect(hookSrc).toContain('u.uDustSparkle.value = PLANET_TUNE.dustSparkle;');
  });
});
