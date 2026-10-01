import { describe, it, expect } from 'vitest';
import { bindPlanetMaps } from '../planetMaps';

// A fresh material's map uniforms (MercuryPlanet's initial values).
const freshUniforms = () => ({
  uAlbedo: { value: null },
  uDem: { value: null },
  uHasMaps: { value: 0 },
  uDemTexel: { value: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } } },
});

describe('bindPlanetMaps', () => {
  it('a material recreated after the maps loaded (a live calm toggle) gets them at once: no flat fallback', () => {
    const maps = { albedo: { id: 'a' }, dem: { id: 'd' }, demSize: [2048, 1024] };
    const u = freshUniforms();
    bindPlanetMaps(u, maps);
    expect(u.uAlbedo.value).toBe(maps.albedo);
    expect(u.uDem.value).toBe(maps.dem);
    expect(u.uHasMaps.value).toBe(1);
    expect(u.uDemTexel.value.x).toBeCloseTo(1 / 2048, 12);
    expect(u.uDemTexel.value.y).toBeCloseTo(1 / 1024, 12);
  });

  it('before the maps decode (or after they are released) the flat fallback holds', () => {
    const u = freshUniforms();
    bindPlanetMaps(u, { albedo: {}, dem: {}, demSize: [4, 2] });
    bindPlanetMaps(u, null);
    expect(u.uAlbedo.value).toBe(null);
    expect(u.uDem.value).toBe(null);
    expect(u.uHasMaps.value).toBe(0);
  });
});
