// src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js
import { describe, it, expect } from 'vitest';
import { PLANET_FS, PLANET_UNIFORMS } from '../mercuryPlanetShader';
import {
  HG_MIRROR_UNIFORMS, HG_MIRROR_DECLS_GLSL, HG_FRESNEL_GLSL, HG_ENV_GLSL,
} from '../hgMirrorGlsl';
import { AETHER_SKY_GLSL } from '../aetherSky';
import { AETHER_SHOULDER, PLANET_TUNE } from '../planetLook';

// One GLSL function, from its signature line to its closing brace at column 0.
const fnText = (src, sig) => { const i = src.indexOf(sig); if (i < 0) return null; const j = src.indexOf('\n}', i); return src.slice(i, j + 2); };
const bodyOf = (src, sig) => { const t = fnText(src, sig); return t && t.slice(t.indexOf('{\n') + 2, -2); };

// Captured from 8255e4c0 (before the liquid split): the frost rime, the quench core, evaporite, the visitor water/rock
// and the frozen Hg are ruled looks that still call these two, so their text must not move.
const ENV_RADIANCE_8255 = [
  'vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {',
  '  vec3 c = vec3(softShoulder(uSunGlint * uSunIrr * uExposure * lobe(dot(R, uSunDir), uSunSinR, rough), SUN_SHOULDER));',
  '  for (int i = 0; i < 4; i++) {',
  '    vec3 d = uEmitPos[i] - P;',
  '    float dist = max(length(d), 1e-3);',
  '    vec3 dir = d / dist;',
  '    float sinE = clamp(EMIT_RADIUS / dist, EMIT_MIN_SIN, 0.99);',
  '    float above = smoothstep(-EMIT_HORIZON_SOFT, EMIT_HORIZON_SOFT, dot(nW, dir));',
  '    c += uEmitCol[i] * (uEmitGain * above * lobe(dot(R, dir), sinE, rough));',
  '  }',
  '  return c + aetherMirror(R, rough, nW);',
  '}',
].join('\n');
const AETHER_MIRROR_8255 = [
  'vec3 aetherMirror(vec3 R, float rough, vec3 nW) {',
  '  return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(aetherSky(R, rough)));',
  '}',
].join('\n');
const AETHER_SHOULDER_8255 = [
  'vec3 aetherShoulder(vec3 x) {',
  '  float m = max(x.r, max(x.g, x.b));',
  '  if (m <= 1e-6) return x;',
  '  float s = softShoulder(m, AETHER_SHOULDER);',
  '  vec3 y = x * (s / m);',
  '  return mix(y, vec3(s), AETHER_PATH_WHITE * smoothstep(0.55, 0.95, s / AETHER_SHOULDER));',
  '}',
].join('\n');

describe('hgMirrorGlsl — one mirror for the planet and its droplets', () => {
  it('the planet shader is built from the shared chunks, verbatim', () => {
    expect(PLANET_FS).toContain(HG_FRESNEL_GLSL);
    expect(PLANET_FS).toContain(HG_ENV_GLSL);
  });

  it('every declaration the chunks need is a line of the planet shader (no drift)', () => {
    const lines = new Set(PLANET_FS.split('\n'));
    for (const l of HG_MIRROR_DECLS_GLSL.split('\n')) expect(lines.has(l), l).toBe(true);
  });

  it('the shared uniforms are planet uniforms (the droplets share their objects)', () => {
    for (const u of HG_MIRROR_UNIFORMS) expect(PLANET_UNIFORMS).toContain(u);
    for (const u of HG_MIRROR_UNIFORMS) expect(HG_MIRROR_DECLS_GLSL).toMatch(new RegExp(`uniform \\w+ ${u}[\\[;]`));
  });

  it('every uniform the declarations name is a shared uniform (the reverse: none is left unbound)', () => {
    const declared = [...HG_MIRROR_DECLS_GLSL.matchAll(/uniform \w+ (\w+)[[;]/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);
    for (const u of declared) expect(HG_MIRROR_UNIFORMS, u).toContain(u);
  });

  it('the mirror reflects the moving aether sky, through the shared chunk', () => {
    expect(HG_ENV_GLSL).toContain(AETHER_SKY_GLSL);
    expect(HG_ENV_GLSL).toContain('return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(aetherSky(R, rough)));');
    for (const u of ['uSkyT', 'uSkyPhase', 'uSkyW']) expect(HG_MIRROR_UNIFORMS).toContain(u);
    for (const gone of ['uAethDir', 'uAethCol', 'uAetherSinW', 'uAetherEdge', 'uAetherStretch', 'uAetherCurve', 'uAetherCore']) {
      expect(HG_MIRROR_UNIFORMS).not.toContain(gone);
    }
    expect(HG_ENV_GLSL).not.toMatch(/aetherStreak|AETHER_SHAPE|AETHER_LOBES/);
  });

  it('envRadiance and aetherMirror are unchanged', () => {
    expect(fnText(HG_ENV_GLSL, 'vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {')).toBe(ENV_RADIANCE_8255);
    expect(fnText(HG_ENV_GLSL, 'vec3 aetherMirror(vec3 R, float rough, vec3 nW) {')).toBe(AETHER_MIRROR_8255);
    expect(fnText(HG_ENV_GLSL, 'vec3 aetherShoulder(vec3 x) {')).toBe(AETHER_SHOULDER_8255);
  });

  it('the liquid mirror tints only the element sky', () => {
    expect(HG_ENV_GLSL).toContain('vec3 envRadianceLiquid(vec3 R, float rough, vec3 P, vec3 nW) {');
    expect(HG_ENV_GLSL).toContain('vec3 aetherMirrorLiquid(vec3 R, float rough, vec3 nW) {');
    const body = bodyOf(HG_ENV_GLSL, 'vec3 aetherMirrorLiquid(vec3 R, float rough, vec3 nW) {');
    expect(body.match(/aetherTint\(/g)).toHaveLength(1); // once,
    expect(body).toContain('vec3 elem = aetherSkySplit(R, rough, 1.0, neutral); // the liquid sees a rough studio blurred, not flattened');
    expect(body).toContain('return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(elem)) + studioShoulder(uAetherGain * aetherHue(neutral));'); // to the element term only
    expect(HG_MIRROR_UNIFORMS).toContain('uStudioLook2');
    expect(HG_MIRROR_DECLS_GLSL.split('\n')).toContain('uniform vec4 uStudioLook2;');
    // declared before use: the split sky, the studio roll-off and the lights all precede the liquid entry points
    const at = (s) => HG_ENV_GLSL.indexOf(s);
    expect(at('vec3 studioShoulder(vec3 x) {')).toBeLessThan(at('vec3 aetherMirrorLiquid('));
    expect(at('vec3 aetherSkySplit(')).toBeLessThan(at('vec3 aetherMirrorLiquid('));
    expect(at('vec3 aetherMirrorLiquid(')).toBeLessThan(at('vec3 envRadianceLiquid('));
  });

  it('envRadianceLiquid: the same Sun and emitters as envRadiance (one shared body), plus the liquid aether', () => {
    const lights = bodyOf(HG_ENV_GLSL, 'vec3 envLights(vec3 R, float rough, vec3 P, vec3 nW) {');
    const env = bodyOf(HG_ENV_GLSL, 'vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {');
    expect(lights).toBe(env.replace('  return c + aetherMirror(R, rough, nW);', '  return c;')); // can't drift
    expect(bodyOf(HG_ENV_GLSL, 'vec3 envRadianceLiquid(vec3 R, float rough, vec3 P, vec3 nW) {'))
      .toBe('  return envLights(R, rough, P, nW) + aetherMirrorLiquid(R, rough, nW);');
    expect(bodyOf(HG_ENV_GLSL, 'vec3 hgLiquid(vec3 F, vec3 R, float rough, vec3 P, vec3 nW) {'))
      .toBe('  return hgHighlight(F * envRadianceLiquid(R, rough, P, nW));'); // the highlight curve after the Fresnel
  });

  it('studioShoulder is aetherShoulder with its knee read live from uStudioLook2.x, guarded (knee 1 = today)', () => {
    const studio = fnText(HG_ENV_GLSL, 'vec3 studioShoulder(vec3 x) {');
    // one JS template makes both; the guard keeps a zero/unbound knee from dividing by zero
    expect(studio).toBe(AETHER_SHOULDER_8255.replace('aetherShoulder', 'studioShoulder').replaceAll('AETHER_SHOULDER', 'max(uStudioLook2.x, 1e-3)'));
    expect(AETHER_SHOULDER).toBe(1);
    expect(PLANET_TUNE.studioShoulder).toBe(AETHER_SHOULDER); // the default knee is today's
  });

  it('PLANET_TUNE: the studio look 2 knobs default to today\'s look', () => {
    expect([PLANET_TUNE.studioShoulder, PLANET_TUNE.studioFalloff, PLANET_TUNE.studioSeams, PLANET_TUNE.studioCard]).toEqual([1, 0, 0, 0]);
  });

  it('defines the two entry points', () => {
    expect(HG_FRESNEL_GLSL).toContain('vec3 fresnelHg(float cosI) {');
    expect(HG_ENV_GLSL).toContain('vec3 envRadiance(vec3 R, float rough, vec3 P, vec3 nW) {');
  });
});
