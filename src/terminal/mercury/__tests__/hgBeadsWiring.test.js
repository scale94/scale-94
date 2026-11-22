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
  it('beads land on the live surface and a landing pearl ripples it without evicting a stronger ring', () => {
    expect(planetSrc).toContain('beadCtx.planetRadiusAt = drop.env.planetRadiusAt;');
    expect(planetSrc.indexOf('beadCtx.planetRadiusAt')).toBeLessThan(planetSrc.indexOf('stepBeads(beads.sim'));
    expect(planetSrc).toContain('if (!sim.hits[h + 5]) continue;'); // refreeze-homing landings never ripple
    expect(planetSrc).toContain('const s = pearlStrike(sim.hits[h + 3], sim.hits[h + 4]);');
    expect(planetSrc).not.toContain('pearlRipple');
    expect(planetSrc).toContain('beadCtx.pxPerUnit = drop.env.pxPerUnit;');
    expect(planetSrc).toContain('beadCtx.freezeIn = body.liquid ? Infinity : Math.max(0, (body.tau - LIQUID_TAU) * TRANSMUTE_S);');
    expect(planetSrc.indexOf('beadCtx.q[3] = body.q.w')).toBeLessThan(planetSrc.indexOf('stepBeads(beads.sim'));
    expect(planetSrc).toMatch(/addImpulseIfRoom\(surf\.impulses, \{ dirBody: surf\.b, tS: t, mode: IMPACT_MODE_AMP\.splash \* bestS/);
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

describe('hidden-tab catch-up wiring (fix/mercury-motion)', () => {
  it('the airborne Hg flies through the skipped time after coolBody and before the drop step', () => {
    const cool = planetSrc.indexOf('coolBody(body, delta - stepS)');
    const fam = planetSrc.indexOf('drop.solver = catchUpFamily(drop.fam, drop.solver, drop.env, skippedS);');
    const bds = planetSrc.indexOf('catchUpBeads(beads.sim, skippedS, beadCtx);');
    const step = planetSrc.indexOf('stepDrop(drop, da);');
    expect(cool).toBeGreaterThan(0);
    expect(fam).toBeGreaterThan(cool);
    expect(bds).toBeGreaterThan(fam);
    expect(step).toBeGreaterThan(bds);
    expect(planetSrc).toContain('if (!calm && skippedS > CATCHUP_MIN_S) {');
  });
});
