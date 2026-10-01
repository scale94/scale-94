import { describe, it, expect } from 'vitest';
import {
  PLANET_WINDOW_VS, PLANET_WINDOW_FS, PLANET_WINDOW_EDGE_PX, planetDiscRadiusPx, planetWindowFragJS,
} from '../planetWindow';

// Desktop /mercury: camera 3.6 from the centre, fov 42°, planet radius 0.75.
const P11 = 1 / Math.tan((42 / 2) * Math.PI / 180);

describe('planetWindow (per fragment)', () => {
  it('vertex stage projects the planet disc; fragment stage clears inside it', () => {
    expect(PLANET_WINDOW_VS).toMatch(/uniform vec2 uViewportPx;/);
    expect(PLANET_WINDOW_VS).toMatch(/void planetWindowVS\(vec3 mv\)/);
    expect(PLANET_WINDOW_VS).toContain('vPlanetPx = vec3(centre, tanR * projectionMatrix[1][1] * 0.5 * uViewportPx.y);');
    expect(PLANET_WINDOW_FS).toMatch(/float planetWindow\(\)/);
    expect(PLANET_WINDOW_FS).toContain('gl_FragCoord.xy - vPlanetPx.xy');
    expect(PLANET_WINDOW_FS).not.toMatch(/\bhalf\b/);
  });

  it('the disc radius matches the perspective silhouette (~205 px on a 740 px canvas)', () => {
    expect(planetDiscRadiusPx(3.6, 0.75, P11, 740)).toBeCloseTo(205, 0);
  });

  it('a fragment over the face of a particle in front of the planet is cleared', () => {
    const disc = [500, 400, 205];
    expect(planetWindowFragJS([500 + 200, 400], disc, true, 1)).toBe(0);
  });

  it('hugs the limb: two pixels outside the disc the haze is untouched (no ghost ring)', () => {
    const disc = [500, 400, 205];
    expect(planetWindowFragJS([500 + 205 + PLANET_WINDOW_EDGE_PX + 0.5, 400], disc, true, 1)).toBe(1);
  });

  it('leaves particles behind the centre plane to the depth test', () => {
    expect(planetWindowFragJS([500, 400], [500, 400, 205], false, 1)).toBe(1);
  });

  it('is a no-op when strength is 0', () => {
    expect(planetWindowFragJS([500, 400], [500, 400, 205], true, 0)).toBe(1);
  });
});
