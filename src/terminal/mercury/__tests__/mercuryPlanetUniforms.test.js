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
