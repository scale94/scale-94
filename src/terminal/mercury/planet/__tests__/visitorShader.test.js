import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { glf, v3 } from '../../../gl/glf';
import {
  buildVisitorShader, VISITOR_UNIFORMS, VISITOR_MATERIAL, VISITOR_RENDER_ORDER, WATER_N, WATER_F0, WATER_TINT,
  ROCK_PLANES, ROCK_AA, GAP_DARK, STEAM_A, GUST_A,
} from '../visitorShader';
import { DROPLET_RENDER_ORDER, DROPLET_VS } from '../dropletShader';
import { HG_MIRROR_DECLS_GLSL } from '../hgMirrorGlsl';
import { VISIT_LIGHT_GLSL } from '../visitorGlsl';
import { VISITOR_SLOTS, EMBER_GAIN, EMBER_HALO, ROCK_BOUND } from '../visitorSim';
import { VIS_DROP, VIS_BEAD, VIS_EMBER, VIS_ROCK, VIS_GUST } from '../visitorFrame';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);
const { vs, fs } = buildVisitorShader();

describe('visitorShader — the visitors as analytic bodies', () => {
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
});
