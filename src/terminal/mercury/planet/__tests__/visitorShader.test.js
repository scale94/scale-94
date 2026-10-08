import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { glf, v3 } from '../../../gl/glf';
import {
  buildVisitorShader, VISITOR_UNIFORMS, VISITOR_MATERIAL, VISITOR_RENDER_ORDER, WATER_N, WATER_F0, WATER_TINT,
  ROCK_PLANES, ROCK_AA, GAP_DARK, STEAM_A, QUENCH_STEAM_A, QUENCH_STEAM_COL, GUST_A, PLUME_A, PLUME_COL,
} from '../visitorShader';
import { DROPLET_RENDER_ORDER, DROPLET_VS } from '../dropletShader';
import { HG_MIRROR_DECLS_GLSL } from '../hgMirrorGlsl';
import { VISIT_LIGHT_GLSL } from '../visitorGlsl';
import { VISITOR_SLOTS, EMBER_GAIN, EMBER_HALO, ROCK_BOUND } from '../visitorSim';
import { VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST, VIS_PLUME, PLUME_STEAM } from '../visitorFrame';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);
const { vs, fs } = buildVisitorShader();

describe('visitorShader — the visitors as analytic bodies', () => {
  it('declares highp samplerCube (the shared nebula map; default is lowp)', () => {
    expect(fs).toContain('precision highp samplerCube;');
  });
  it('shares the droplets\' rect vertex stage and draws after them', () => {
    expect(vs).toBe(DROPLET_VS);
    expect(VISITOR_RENDER_ORDER).toBe(DROPLET_RENDER_ORDER + 1);
  });
  it('blends (translucent glow, steam, shimmer: plan D-1), depth-tests, never writes depth', () => {
    expect(VISITOR_MATERIAL).toMatchObject({ transparent: true, blending: THREE.NormalBlending, depthTest: true, depthWrite: false });
    expect(fs).toContain('gl_FragDepth =');
  });
  it('declares exactly VISITOR_UNIFORMS plus the three built-ins', () => {
    const names = declared(fs).filter((u) => !['viewMatrix', 'projectionMatrix', 'cameraPosition'].includes(u));
    expect([...names].sort()).toEqual([...VISITOR_UNIFORMS].sort());
    expect(fs).toContain(`uniform vec4 uVis[${VISITOR_SLOTS}];`);
  });
  it('is the planet\'s own mirror and light', () => {
    expect(fs).toContain(HG_MIRROR_DECLS_GLSL);
    expect(fs).toContain(VISIT_LIGHT_GLSL);
    expect(fs).toMatch(/fresnelHg\(/);
    expect(fs).toMatch(/envRadiance\(/);
  });
  it('water: n 1.33 Fresnel, the bent ray meets the planet\'s mirror (no scene copy)', () => {
    expect(WATER_F0).toBeCloseTo(((WATER_N - 1) / (WATER_N + 1)) ** 2, 12);
    expect(fs).toContain(`const float WATER_F0 = ${glf(WATER_F0)};`);
    expect(fs).toContain(`const vec3 WATER_TINT = ${v3(WATER_TINT)};`);
    expect(fs).toMatch(/refract\(rd, n, 1\.0 \/ WATER_N\)/);
    expect(fs).toMatch(/uCoreR \* uCoreR/);
  });
  it('interpolates its constants', () => {
    for (const [name, value] of Object.entries({ EMBER_GAIN, EMBER_HALO, ROCK_BOUND, GAP_DARK, STEAM_A, GUST_A })) {
      expect(fs).toContain(`const float ${name} = ${glf(value)};`);
    }
    for (const [name, value] of Object.entries({ ROCK_PLANES, ROCK_AA, VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST })) {
      expect(fs).toContain(`const int ${name} = ${value};`);
    }
  });
  it('takes no screen derivatives anywhere (it discards per pixel)', () => {
    expect(fs).not.toMatch(/dFd[xy]|fwidth/);
    expect(fs).toMatch(/\bdiscard;/);
  });
  it('is GLSL 3 without #version / #include', () => {
    expect(fs).not.toMatch(/#version|#include/);
    expect(fs).toMatch(/out vec4 fragColor;/);
  });
  it('water that the bent ray passes by the planet sees the sky, not black', () => {
    expect(fs).toMatch(/vec3 behind = envRadiance\(bent, WATER_ROUGH, p, bent\);/);
  });
  it('silhouette AA: hitEll takes a tolerance so coverage spans the full pixel', () => {
    expect(fs).toMatch(/float hitEll\([^)]*float tol, out vec3 n, out float miss\)/);
    expect(fs.match(/hitEll\(ro, rd, c, r, [^;]*0\.5 \* px, nrm, miss\)/g)).toHaveLength(2);
  });
  it('a body covers the glow behind it by coverage, not all-or-nothing', () => {
    expect(fs).toContain('outA = alpha + gA * (1.0 - alpha);');
    expect(fs).toContain('outC = (col * alpha + gC * gA * (1.0 - alpha)) / max(outA, 1e-5);');
  });
});

describe('visitors matrix: the vapour plume', () => {
  it('draws VIS_PLUME as a translucent streamer with its own constants', () => {
    const { fs } = buildVisitorShader();
    expect(fs).toContain(`const int VIS_PLUME = ${VIS_PLUME};`);
    expect(fs).toContain(`const float PLUME_A = ${glf(PLUME_A)};`);
    expect(fs).toContain(`const vec3 PLUME_COL = ${v3(PLUME_COL)};`);
    expect(fs).toContain('} else if (kind == VIS_PLUME) {');
  });
  it('draws a PLUME_STEAM plume with the quench steam look, Hg vapour otherwise (plan Q-1, A7 knobs)', () => {
    const { fs } = buildVisitorShader();
    expect(fs).toContain(`const int PLUME_STEAM = ${PLUME_STEAM};`);
    expect(fs).toContain('bool steam = int(K.w + 0.5) == PLUME_STEAM;');
    expect(fs).toContain('steam ? QUENCH_STEAM_COL : PLUME_COL');
    expect(fs).toContain('steam ? QUENCH_STEAM_A : PLUME_A');
    expect(fs).toContain(`const float QUENCH_STEAM_A = ${glf(QUENCH_STEAM_A)};`);
    expect(fs).toContain(`const vec3 QUENCH_STEAM_COL = ${v3(QUENCH_STEAM_COL)};`);
  });
  it('the quench steam is a soft round puff lifted 0.6r plus its rise; an HDR white (A10 pick B4)', () => {
    expect(QUENCH_STEAM_A).toBe(1.2);
    expect(QUENCH_STEAM_COL).toEqual([1.3, 1.32, 1.35]);
    expect(Math.min(...QUENCH_STEAM_COL)).toBeGreaterThan(1);   // brighter than the lit crust
    const { fs } = buildVisitorShader();
    expect(fs).toContain('if (steam) { vec3 pc = c + X.xyz * (X.w + 0.6 * r); tr = max(dot(pc - ro, rd), 0.0); d = length(ro + rd * tr - pc); u = 0.0; wd = r; }');
    // the Hg-vapour strip keeps its segment maths
    expect(fs).toContain('float d = raySeg(ro, rd, c, b, u, tr);');
    expect(fs).toContain('float wd = r * (0.6 + 1.8 * u);');
    expect(fs).toContain('gP += STEAM_COL * a;');   // the bead's own steam is untouched
  });
});
