import { describe, it, expect } from 'vitest';
import { planetEphemerisUniforms } from '../MercuryPlanet';
import { mercuryEphemeris } from '../planet/mercuryEphemeris';
import { bodyYawFor } from '../planet/planetFrame';
import { subsolarTempK } from '../planet/mercuryThermal';
import { tailBrightness } from '../planet/mercuryExosphere';
import planetSrc from '../MercuryPlanet.jsx?raw';
import canvasSrc from '../MercuryCanvas.jsx?raw';
import tabSrc from '../../views/MercuryTab.jsx?raw';

describe('planetEphemerisUniforms', () => {
  const t = Date.UTC(2026, 9, 1);
  it('feeds yaw from the live subsolar longitude (Sun fixed in the world)', () => {
    const eph = mercuryEphemeris(t);
    const u = planetEphemerisUniforms(t);
    expect(u.yaw).toBeCloseTo(bodyYawFor(eph.subsolarLonDeg), 12);
    expect(u.subsolarLonDeg).toBe(eph.subsolarLonDeg);
  });
  it('irradiance is (MEAN_R/r)^2 and stays inside the orbital range 0.69–1.59', () => {
    const u = planetEphemerisUniforms(t);
    expect(u.irr).toBeCloseTo((0.387098 / mercuryEphemeris(t).r) ** 2, 12);
    expect(u.irr).toBeGreaterThan(0.68);
    expect(u.irr).toBeLessThan(1.6);
  });
  it('sinR is the sine of the Sun angular radius', () => {
    expect(planetEphemerisUniforms(t).sinR).toBeCloseTo(Math.sin(mercuryEphemeris(t).sunAngularRadiusRad), 12);
  });
  it('subsolarT comes from the thermal model at the live distance', () => {
    expect(planetEphemerisUniforms(t).subsolarT).toBe(subsolarTempK(mercuryEphemeris(t).r));
  });
  it('carries the tail brightness and radial velocity for the exosphere', () => {
    const tt = Date.UTC(2026, 9, 1, 12);
    const u = planetEphemerisUniforms(tt);
    expect(u.tailB).toBe(tailBrightness(tt));
    expect(u.vrKmS).toBe(mercuryEphemeris(tt).rdotKmS);
  });
});

describe('MercuryPlanet impulse wiring', () => {
  it('uImpWave carries (age, amplitude, dimple weight) per slot, preallocated, set from the frame', () => {
    expect(planetSrc).toContain('uImpWave: { value: Array.from({ length: IMPULSE_SLOTS }, () => new THREE.Vector3()) },');
    expect(planetSrc).toContain('u.uImpWave.value[j].set(surf.frame.wave[2 * i], surf.frame.wave[2 * i + 1], surf.frame.dimple[i]);');
  });
});

describe('THE SLOW NOON wiring', () => {
  it('MercuryPlanet owns uOverlay / uCaloris and eases the overlay every frame', () => {
    expect(planetSrc).toContain("import { CALORIS_DIR_BODY, stepOverlay } from './planet/slowNoon';");
    expect(planetSrc).toContain("export default function MercuryPlanet({ isMobile = false, tier = 'full', calm = false, emitters = {}, strikes = null, overlay = false }) {");
    expect(planetSrc).toContain('uOverlay: { value: 0 },');
    expect(planetSrc).toContain('uCaloris: { value: new THREE.Vector3(...CALORIS_DIR_BODY) },');
    expect(planetSrc).toContain('u.uOverlay.value = stepOverlay(u.uOverlay.value, overlay ? 1 : 0, delta, calm);');
  });

  it('MercuryCanvas passes overlay through', () => {
    expect(canvasSrc).toMatch(/overlay = false,/);
    expect(canvasSrc).toContain('overlay={overlay}');
  });
});

describe('THE SLOW NOON placement', () => {
  it('MercuryTab holds the overlay state, renders the dial under the controls, and feeds the canvas', () => {
    expect(tabSrc).toContain("import SlowNoonDial           from '../mercury/SlowNoonDial';");
    expect(tabSrc).toContain('const [slowNoonOverlay, setSlowNoonOverlay] = useState(false);');
    expect(tabSrc).toContain('<SlowNoonDial onOverlay={setSlowNoonOverlay} />');
    expect(tabSrc).toContain('overlay={slowNoonOverlay}');
    expect(tabSrc.indexOf('<SlowNoonDial')).toBeGreaterThan(tabSrc.indexOf('<MercuryControls'));
    expect(tabSrc.indexOf('<SlowNoonDial')).toBeLessThan(tabSrc.indexOf('<MercuryCanvas'));
  });
});

describe('visitors: the screen-space fireworks are gone', () => {
  it('MercuryTab mounts no fireworks and passes no element-fired handler', () => {
    expect(tabSrc).not.toMatch(/MercuryFireworks|fireworksRef|handleElementFired|onElementFired/);
  });
  it('a node press still queues a strike for the planet, and only that', () => {
    expect(canvasSrc).toContain('if (strikesRef.current.length < 8) strikesRef.current.push(phase);');
    expect(canvasSrc).toContain('onElementFired={handleElementFired}');
    expect(canvasSrc).not.toMatch(/onElementFired\?\.\(/);
  });
  it('the fireworks modules are deleted', () => {
    const modules = Object.keys(import.meta.glob('../*.{js,jsx}'));
    expect(modules.some((p) => /ireworks/.test(p))).toBe(false);
  });
});

describe('visitors wiring', () => {
  it('a strike launches a visitor; the touchdown, not the tap, hits the surface', () => {
    expect(planetSrc).toContain('launchVisitor(vis.buf, phase, vc);');
    expect(planetSrc).toContain('stepVisitors(vis.buf, vc, vis.out);');
    expect(planetSrc).not.toMatch(/strikeDirWorld\(|impactKind\(/);
    expect(planetSrc).toContain('const a = VISITOR_IMPACT[ev.impulse];');
    expect(planetSrc).toContain('stampCrater(scar, ev.dirBody, surf.seed++);');
  });
  it('owns the surface-slot uniforms and gates them on live slots', () => {
    expect(planetSrc).toContain('uVisitOn: { value: 0 },');
    expect(planetSrc).toContain('u.uVisitOn.value = vis.frame.nSurf > 0 ? 1 : 0;');
    for (const n of ['uVisitDir', 'uVisitA', 'uVisitB']) expect(planetSrc).toContain(`u.${n}.value[j].fromArray(`);
  });
  it('mounts the body pass hidden; upload shows it', () => {
    expect(planetSrc).toContain('const visField = useVisitorField({ planetMaterial: material });');
    expect(planetSrc).toContain('<mesh ref={visField.meshRef} geometry={visField.geometry} material={visField.material} renderOrder={visField.renderOrder} frustumCulled={false} visible={false} />');
    expect(planetSrc).toContain('visField.upload(vis.frame, vis.shaderT, pxAngleOf(camera.fov, bufferH));');
  });
  it('reduced motion freezes the body pass clock (steam churn, gust shimmer)', () => {
    expect(planetSrc).toContain('if (!calm) vis.shaderT = t;');
    expect(planetSrc).toMatch(/clock: 0, exoPuff: 0, rigDetach: false, shaderT: 0,/);
  });
  it('a hard release or any hyper flings the residents; an ember on boiling Hg puffs the exosphere', () => {
    expect(planetSrc).toContain('vc.detach = (ds.released && body.omega.length() > DETACH_OMEGA) || vis.rigDetach;');
    expect(planetSrc).not.toMatch(/vc\.detach = [^;]*DEV_OVERRIDES/);
  });
  it('the dev rig flings on the spun ω: next frame, and only if stepDrop really spun the body', () => {
    const rig = planetSrc.indexOf('const rigFling = DEV_OVERRIDES.breakNow != null || DEV_OVERRIDES.hyperNow != null;');
    const step = planetSrc.indexOf('stepDrop(drop, da);');
    const arm = planetSrc.indexOf('if (rigFling && !calm && body.omega.length() > DETACH_OMEGA) vis.rigDetach = true;');
    expect(rig).toBeGreaterThan(0);
    expect(rig).toBeLessThan(step);
    expect(arm).toBeGreaterThan(step);
    expect(planetSrc).toContain('vis.rigDetach = false;');
  });
  it('under calm the rig is a no-op that clears its flags (no detach every frame)', () => {
    const calmBranch = planetSrc.slice(planetSrc.indexOf('function stepDrop('), planetSrc.indexOf('} else {', planetSrc.indexOf('function stepDrop(')));
    expect(calmBranch).toContain('DEV_OVERRIDES.breakNow = null; DEV_OVERRIDES.hyperNow = null;');
    expect(planetSrc).toContain("if (ev.phase === 'thermal' && ev.tempK > HG_BOIL_K) vis.exoPuff = EXO_PUFF;");
    expect(planetSrc).toContain('exo.coverage = Math.min(1, boilCoverage(body.tau, body.heatK, u.uSubsolarT.value) + vis.exoPuff);');
  });
});

describe('visitors matrix wiring', () => {
  it('drains the stamps into the scar map, under calm too', () => {
    const drain = planetSrc.indexOf('for (let k = 0; k < vis.out.nStamps; k++) {');
    expect(drain).toBeGreaterThan(planetSrc.indexOf('stepVisitors(vis.buf, vc, vis.out);'));
    expect(planetSrc).toContain("if (st.kind === 'frost') stampFrost(scar, st.dirBody, st.radius, st.seed);");
    expect(planetSrc).toContain("else if (st.kind === 'glaze') stampGlaze(scar, st.dirBody, st.radius);");
    expect(planetSrc).toContain("else if (st.kind === 'quench') stampQuench(scar, st.dirBody, st.radius, st.seed);");
    expect(planetSrc.indexOf('surf.marksLiquid = liquidNow;')).toBeLessThan(planetSrc.indexOf('if (scarDirty) scarTex.needsUpdate = true;'));
    expect(planetSrc).not.toContain('clearMarks(scar)');
    expect(planetSrc).toContain('else stampPit(scar, st.dirBody, st.radius, PIT_DEPTH_M);');
  });
  it('rings frost and the pool like solid Hg, sends nothing for a sink, puffs the exosphere for a strip', () => {
    expect(planetSrc).toContain("} else if (ev.impulse === 'ring') {");
    expect(planetSrc).toContain('} else if (ev.impulse) {');
    expect(planetSrc).toContain("if (ev.kind === 'strip') vis.exoPuff = EXO_PUFF;");
  });
  it('heals marks where the Hg melts on the scar tick, clears them on crust, and gates the shader on them', () => {
    expect(planetSrc).toContain('const liquidNow = body.tau >= LIQUID_TAU;');
    expect(planetSrc).toContain('if (crossMarks(scar, surf.marksLiquid, liquidNow)) scarDirty = true;');
    expect(planetSrc).toContain('surf.marksLiquid = liquidNow;');
    expect(planetSrc).toContain('marksLiquid: null,');
    expect(planetSrc).toContain('if (liquidNow && healMelted(scar, vc.q, SUN_DIR_WORLD, vc.subsolarT, body.heatK)) scarDirty = true;');
    expect(planetSrc).toContain('uMarksOn: { value: 0 },');
    expect(planetSrc).toContain('u.uMarksOn.value = scar.marksLive ? 1 : 0;');
  });
});
