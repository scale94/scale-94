import { describe, it, expect } from 'vitest';
import { PLANET_WINDOW_GLSL, planetWindowJS } from '../planetWindow';

const C = [0, 0, -3.6]; // planet centre in view space (camera at origin looking −Z)
const R = 0.75;

describe('planetWindow', () => {
  // A particle at view-space depth `along` in front of the planet whose projected
  // lateral distance from the planet's centre is `k` planet radii.
  const at = (k, along = 2.5) => [k * R * along / 3.6, 0, -along];

  it('declares its uniforms and function', () => {
    expect(PLANET_WINDOW_GLSL).toMatch(/uniform float uPlanetWindow;/);
    expect(PLANET_WINDOW_GLSL).toMatch(/uniform float uPlanetRadius;/);
    expect(PLANET_WINDOW_GLSL).toMatch(/float planetWindow\(vec3 mv\)/);
  });
  it('is fully transparent for a particle in front of the planet face', () => {
    expect(planetWindowJS([0, 0, -2.5], C, R, 1)).toBe(0);
  });
  it('leaves particles beside the planet (the halo) untouched', () => {
    expect(planetWindowJS([2.0, 0, -2.5], C, R, 1)).toBe(1);
  });
  it('leaves particles behind the centre plane to the depth test', () => {
    expect(planetWindowJS([0, 0, -4.0], C, R, 1)).toBe(1);
  });
  it('is a no-op when strength is 0', () => {
    expect(planetWindowJS([0, 0, -2.5], C, R, 0)).toBe(1);
  });

  it('clears the face right up to the limb', () => {
    expect(planetWindowJS(at(0.95), C, R, 1)).toBe(0);
  });

  it('hugs the limb: haze just outside it is untouched, so there is no ghost shell', () => {
    expect(planetWindowJS(at(1.07), C, R, 1)).toBe(1);
    expect(planetWindowJS(at(1.15), C, R, 1)).toBe(1);
  });
});
