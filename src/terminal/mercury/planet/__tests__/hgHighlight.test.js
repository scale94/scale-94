// src/terminal/mercury/planet/__tests__/hgHighlight.test.js
import { describe, it, expect } from 'vitest';
import { hgHighlight, HG_HIGHLIGHT_GLSL } from '../hgHighlight';
import { HG_ENV_GLSL } from '../hgMirrorGlsl';
import { HG_HIGHLIGHT_KNEE } from '../planetLook';
import { glf } from '../../../gl/glf';

const fnText = (src, sig) => { const i = src.indexOf(sig); if (i < 0) return null; const j = src.indexOf('\n}', i); return src.slice(i, j + 2); };
const bodyOf = (src, sig) => { const t = fnText(src, sig); return t && t.slice(t.indexOf('{\n') + 2, -2); };
const mx = (c) => Math.max(...c);

describe('hgHighlight — liquid Hg highlights roll off to white', () => {
  it('identity below the knee', () => {
    expect(HG_HIGHLIGHT_KNEE).toBe(0.6);
    expect(hgHighlight([0.5, 0.3, 0.1])).toEqual([0.5, 0.3, 0.1]);
    expect(hgHighlight([0.6, 0.6, 0.6])).toEqual([0.6, 0.6, 0.6]);
  });

  it('C1 at the knee', () => {
    const k = HG_HIGHLIGHT_KNEE, h = 1e-4;
    const slope = (mx(hgHighlight([k + h, 0, 0])) - mx(hgHighlight([k, 0, 0]))) / h;
    expect(Math.abs(slope - 1)).toBeLessThan(1e-3);
  });

  it('monotone and below 1', () => {
    let prev = -Infinity;
    for (let m = 0.6; m <= 50; m += 0.01) {
      const y = mx(hgHighlight([m, m * 0.5, m * 0.25]));
      // Strictly rising and strictly below 1 until double precision saturates next to 1 (1 - y < 1e-9 past m ≈ 9;
      // exp(-(m - k)/(1 - k)) underflows the last ulp of 1 past m ≈ 15): beyond that only rounding is left.
      if (prev < 1 - 1e-9) {
        expect(y).toBeGreaterThan(prev);
        expect(y).toBeLessThan(1);
      } else {
        expect(y).toBeGreaterThanOrEqual(prev - 1e-12);
        expect(y).toBeLessThanOrEqual(1);
      }
      prev = y;
    }
  });

  it('hue preserved', () => {
    const [r, g, b] = hgHighlight([3, 1.5, 0.75]);
    expect(r / g).toBeCloseTo(2, 10);
    expect(g / b).toBeCloseTo(2, 10);
  });

  it('Sun glint stays near white', () => {
    expect(hgHighlight([3, 3, 3])[0]).toBeGreaterThan(0.95); // SUN_SHOULDER 3
  });

  it('the GLSL is the JS replica', () => {
    expect(HG_HIGHLIGHT_GLSL).toContain('vec3 hgHighlight(vec3 x) {');
    expect(HG_HIGHLIGHT_GLSL).toContain(`const float HG_HIGHLIGHT_KNEE = ${glf(HG_HIGHLIGHT_KNEE)};`);
    expect(HG_HIGHLIGHT_GLSL).toContain('if (m <= HG_HIGHLIGHT_KNEE) return x;');
    expect(HG_HIGHLIGHT_GLSL).toContain('exp(-(m - HG_HIGHLIGHT_KNEE) / (1.0 - HG_HIGHLIGHT_KNEE))');
    expect(HG_HIGHLIGHT_GLSL).toContain('return x * (s / m);');
    expect(HG_ENV_GLSL).toContain(HG_HIGHLIGHT_GLSL);
    // the curve sits AFTER the Fresnel weight, so a displayed light can reach white (fix round 1)
    expect(bodyOf(HG_ENV_GLSL, 'vec3 hgLiquid(vec3 F, vec3 R, float rough, vec3 P, vec3 nW) {'))
      .toBe('  return hgHighlight(F * envRadianceLiquid(R, rough, P, nW));');
    expect(HG_ENV_GLSL.indexOf('vec3 hgHighlight(vec3 x) {')).toBeLessThan(HG_ENV_GLSL.indexOf('vec3 hgLiquid('));
    expect(HG_ENV_GLSL.indexOf('vec3 envRadianceLiquid(')).toBeLessThan(HG_ENV_GLSL.indexOf('vec3 hgLiquid('));
  });

  it('envRadianceLiquid is the uncurved liquid env; one curve definition, no Raw alias', () => {
    expect(bodyOf(HG_ENV_GLSL, 'vec3 envRadianceLiquid(vec3 R, float rough, vec3 P, vec3 nW) {'))
      .toBe('  return envLights(R, rough, P, nW) + aetherMirrorLiquid(R, rough, nW);');
    expect(HG_ENV_GLSL).not.toContain('envRadianceLiquidRaw');
    expect(HG_ENV_GLSL.match(/vec3 hgHighlight\(/g)).toHaveLength(1);
  });

  it('a lit liquid pixel can reach white: F ~ 0.8 times a bright env still rolls off to ~1', () => {
    expect(hgHighlight([0.8 * 3, 0.8 * 3, 0.8 * 3])[0]).toBeGreaterThan(0.99); // Sun at SUN_SHOULDER, Hg Fresnel ~0.8
  });
});
