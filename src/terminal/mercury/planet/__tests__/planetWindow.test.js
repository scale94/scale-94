import { describe, it, expect } from 'vitest';
import { PLANET_WINDOW_GLSL, planetWindowJS } from '../planetWindow';

const C = [0, 0, -3.6]; // planet centre in view space (camera at origin looking −Z)
const R = 0.75;

describe('planetWindow', () => {
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
});
