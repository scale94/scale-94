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
    expect(planetSrc).toContain('if (sim.hits[h + 5] !== HIT_FLUNG) continue;'); // the strongest flung pearl of the frame
    expect(planetSrc).toContain('const s = pearlStrike(sim.hits[h + 3], sim.hits[h + 4]);');
    // every visible trickle / spray pearl rings (fix/mercury-pearl-ripples), after the flung one so it never crowds it out
    expect(planetSrc).toContain('if (!trickleRings(sim.hits, h, beadCtx.pxPerUnit, cam.x, cam.y, cam.z, beadCtx.coreR)) continue;');
    expect(planetSrc.indexOf('bestS * PLANET_TUNE.pearlWaveGain')).toBeLessThan(planetSrc.indexOf('s * PLANET_TUNE.trickleWaveGain'));
    expect(planetSrc).not.toContain('RippleBudget');
    expect(planetSrc).not.toContain('pearlRipple');
    expect(planetSrc).toContain('beadCtx.pxPerUnit = drop.env.pxPerUnit;');
    expect(planetSrc).toContain('beadCtx.freezeIn = body.liquid ? Infinity : Math.max(0, (body.tau - LIQUID_TAU) * TRANSMUTE_S);');
    expect(planetSrc.indexOf('beadCtx.q[3] = body.q.w')).toBeLessThan(planetSrc.indexOf('stepBeads(beads.sim'));
    // a pearl rings the surface locally only: no body modes, whose even P2/P4 dent the antipode as hard as the hit
    // the ring carries the live pearlWaveGain (author dials it by eye), never past a full drop's splash
    expect(planetSrc).toContain('const pearlWave = Math.min(IMPACT_WAVE_AMP.splash, IMPACT_WAVE_AMP.splash * strength);');
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
    const fam = planetSrc.indexOf('drop.solver = catchUpFamily(drop.fam, drop.solver, drop.env, skippedS, crustNow);');
    const bds = planetSrc.indexOf('catchUpBeads(beads.sim, skippedS, beadCtx, crustNow);');
    expect(planetSrc).toContain('const crustNow = !body.liquid && body.tau <= LIQUID_TAU;');
    const step = planetSrc.indexOf('stepDrop(drop, da);');
    expect(cool).toBeGreaterThan(0);
    expect(fam).toBeGreaterThan(cool);
    expect(bds).toBeGreaterThan(fam);
    expect(step).toBeGreaterThan(bds);
    expect(planetSrc).toContain('if (!calm && skippedS > CATCHUP_MIN_S) {');
  });
});

describe('pearl ring gain (fix/mercury-motion)', () => {
  it('PLANET_TUNE.pearlWaveGain (flung pearls) defaults to 3: a mid-strength pearl rings like the drag wake (~0.12)', async () => {
    const { PLANET_TUNE } = await import('../planet/planetLook');
    const { IMPACT_WAVE_AMP } = await import('../planet/mercuryImpacts');
    const { WAKE_WAVE_AMP } = await import('../planet/mercuryWaves');
    expect(PLANET_TUNE.pearlWaveGain).toBe(3);
    const typical = IMPACT_WAVE_AMP.splash * 0.12 * PLANET_TUNE.pearlWaveGain; // measured idle mean strike 0.12
    expect(typical / WAKE_WAVE_AMP).toBeGreaterThan(0.9);
    expect(typical / WAKE_WAVE_AMP).toBeLessThan(1.25);
  });
});

describe('hyper landing ring gain (fix/mercury-motion)', () => {
  it('a hyper bead\'s landing ring carries PLANET_TUNE.hyperWaveGain (default 3), capped at a full splash; others as emitted', async () => {
    expect(planetSrc).toContain("const evWave = fam.hyper && ev.kind === 'splash' ? Math.min(IMPACT_WAVE_AMP.splash, ev.wave * PLANET_TUNE.hyperWaveGain) : ev.wave;");
    expect(planetSrc).toContain('addImpulse(surf.impulses, { dirBody: surf.b, tS: t, mode: ev.mode, wave: evWave, kind: ev.kind });');
    const { PLANET_TUNE } = await import('../planet/planetLook');
    expect(PLANET_TUNE.hyperWaveGain).toBe(3);
  });
});

describe('visible trickle pearl ripples (fix/mercury-pearl-ripples)', () => {
  it('a visible trickle pearl rings at the gentler trickleWaveGain (1.5), half a flung pearl ring', async () => {
    const { PLANET_TUNE } = await import('../planet/planetLook');
    expect(PLANET_TUNE.trickleWaveGain).toBe(1.5);
    expect(PLANET_TUNE.trickleWaveGain).toBeLessThan(PLANET_TUNE.pearlWaveGain);
    expect(planetSrc).toContain('if (s > 0) ringPearl(sim.hits, h, s * PLANET_TUNE.trickleWaveGain, body.q, surf, beadCtx.dirW, t);');
  });
});

describe('family freeze guard wiring (fix/mercury-motion)', () => {
  it('stepDrop hands the family the same refreeze clock as the beads; the hidden-tab replay runs unguarded', async () => {
    expect(planetSrc).toContain('env.freezeIn = body.liquid ? Infinity : Math.max(0, (body.tau - LIQUID_TAU) * TRANSMUTE_S);');
    expect(planetSrc.indexOf('env.freezeIn = body.liquid')).toBeLessThan(planetSrc.indexOf('stepFamily(fam, dropDt, env);'));
    const { default: catchSrc } = await import('../planet/airborneCatchUp.js?raw');
    expect(catchSrc).toContain('{ ...env, freezeIn: Infinity, planetRadiusAt: () => R_SCENE * coreScale(fam) }');
  });
});

describe('bead shadow edge (fix/mercury-motion)', () => {
  it('the beads take their own, softer shadow edge (beadPenumbra), uploaded live; the flows keep aetherPenumbra', async () => {
    expect(hookSrc).toContain('uLitPen: { value: Math.max(PLANET_TUNE.beadPenumbra, 1e-3) }');
    expect(hookSrc).toContain('u.uLitPen.value = Math.max(PLANET_TUNE.beadPenumbra, 1e-3);');
    expect(hookSrc).not.toContain('aetherPenumbra');
    const { PLANET_TUNE } = await import('../planet/planetLook');
    expect(PLANET_TUNE.beadPenumbra).toBe(0.3);
    expect(PLANET_TUNE.aetherPenumbra).toBe(0.08);
  });
});

describe('pearl rings stay where the pearl landed (fix/mercury-pearl-ripples)', () => {
  it('ringPearl hands the world centre with slip 1, so slipDirWorld pins it against body.q', async () => {
    expect(planetSrc).toContain('const PEARL_RING_SLIP = 1;');
    expect(planetSrc).toContain("addImpulseIfRoom(surf.impulses, { dirBody: surf.b, dirWorld: dirW, slip: PEARL_RING_SLIP, tS: t, mode: 0, wave: pearlWave, kind: 'splash' })");
    const { slipDirWorld } = await import('../planet/mercuryWaves');
    expect(slipDirWorld([1, 0, 0], [0, 0, 1], 1)).toEqual([0, 0, 1]); // the carried dir drops out entirely
  });
  it('the ripple sheen is a live knob, uploaded every frame', async () => {
    expect(planetSrc).toContain('uRippleSheen: { value: PLANET_TUNE.rippleSheen },');
    expect(planetSrc).toContain('u.uRippleSheen.value = PLANET_TUNE.rippleSheen;');
    const { PLANET_TUNE } = await import('../planet/planetLook');
    expect(PLANET_TUNE.rippleSheen).toBe(0.3);
  });
});
