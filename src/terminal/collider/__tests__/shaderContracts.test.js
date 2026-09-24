import { describe, it, expect } from 'vitest';
import { STREAK_VS, STREAK_UNIFORMS } from '../streakShader';
import { RIBBON_FS } from '../ribbonShader';
import { glslFloat, glslFloatArray } from '../glsl';

// Pulls every `uniform <type> <name>` declaration out of a GLSL source,
// dropping any `[n]` array suffix.
function declaredUniforms(src) {
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(\[\d+\])?\s*;/gm)].map((m) => m[1]);
}

const PROGRAMS = [
  ['streak', STREAK_VS, RIBBON_FS, STREAK_UNIFORMS],
];

describe.each(PROGRAMS)('%s program', (name, vs, fs, contract) => {
  it('starts both stages with #version 300 es', () => {
    expect(vs.startsWith('#version 300 es\n')).toBe(true);
    expect(fs.startsWith('#version 300 es\n')).toBe(true);
  });

  it('declares exactly the uniforms the chamber harvests', () => {
    const declared = new Set([...declaredUniforms(vs), ...declaredUniforms(fs)]);
    expect([...declared].sort()).toEqual([...contract].sort());
  });

  it('binds its attribute at location 0', () => {
    expect(vs).toMatch(/layout\s*\(\s*location\s*=\s*0\s*\)\s+in\s/);
  });

  it('writes a declared out, never gl_FragColor', () => {
    expect(fs).not.toContain('gl_FragColor');
    expect(fs).toMatch(/^\s*out\s+vec4\s+\w+\s*;/m);
  });

  it('never uses gl_PointSize — the chamber has no points', () => {
    expect(vs).not.toContain('gl_PointSize');
  });

  it('interpolated every constant', () => {
    for (const s of [vs, fs]) expect(s).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe('glslFloat', () => {
  it('always emits a float literal', () => {
    expect(glslFloat(2)).toBe('2.0');
    expect(glslFloat(-1)).toBe('-1.0');
    expect(glslFloat(0.06)).toBe('0.06');
    expect(glslFloat(1e-7)).toBe('1e-7');
  });
  it('refuses non-finite values, so a missing constant fails at import', () => {
    expect(() => glslFloat(NaN)).toThrow();
    expect(() => glslFloat(undefined)).toThrow();
  });
  it('builds a GLSL float array constructor', () => {
    expect(glslFloatArray([0.22, 1])).toBe('float[2](0.22, 1.0)');
  });
});
