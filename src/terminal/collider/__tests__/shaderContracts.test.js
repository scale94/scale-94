import { describe, it, expect } from 'vitest';
import { STREAK_VS, STREAK_UNIFORMS } from '../streakShader';
import { RIBBON_FS } from '../ribbonShader';
import { glslFloat, glslFloatArray } from '../glsl';
import { CAGE_VS, CAGE_UNIFORMS } from '../cageShader';
import { COMPOSITE_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS } from '../compositeShader';
import { KNEE } from '../colliderPhases';

// Pulls every `uniform <type> <name>` declaration out of a GLSL source,
// dropping any `[n]` array suffix.
function declaredUniforms(src) {
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(\[\d+\])?\s*;/gm)].map((m) => m[1]);
}

const PROGRAMS = [
  ['streak', STREAK_VS, RIBBON_FS, STREAK_UNIFORMS],
  ['cage', CAGE_VS, RIBBON_FS, CAGE_UNIFORMS],
  ['composite', COMPOSITE_VS, COMPOSITE_FS, COMPOSITE_UNIFORMS],
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

describe('composite knee', () => {
  it('uses the tested knee constant', () => {
    expect(COMPOSITE_FS).toContain(`const float KNEE = ${KNEE}`);
  });
  it('compresses by the max channel, never by luminance', () => {
    expect(COMPOSITE_FS).toMatch(/max\(c\.r,\s*max\(c\.g,\s*c\.b\)\)/);
    expect(COMPOSITE_FS).not.toMatch(/0\.2126|0\.7152|0\.0722/);
  });
});

describe('cage vibration', () => {
  it('moves geometry only: the mode envelope never reaches alpha or colour', () => {
    // env.* are the modal displacements; if any appears on an alpha or vCol
    // line the cage would strobe.
    for (const line of CAGE_VS.split('\n')) {
      if (/alpha\s*=|vCol\s*=|col\s*=/.test(line)) expect(line).not.toMatch(/env\./);
    }
  });
});

describe('cage depth cue', () => {
  it('takes the depth channel from the unvibrated pose, not the ringdown-perturbed one', () => {
    // depth (the return's z) feeds depthA/wScale in main(), which are
    // brightness -- so it must read the unvibrated pose (rp.z), never the
    // modal()-perturbed r.z, or ringdown would modulate brightness.
    const body = CAGE_VS.match(/vec3 vertexScreen\([^]*?\n\}/)[0];
    const returnLine = body.split('\n').find((l) => l.trim().startsWith('return'));
    expect(returnLine).toMatch(/clamp\(\s*rp\.z/);
    expect(returnLine).not.toMatch(/clamp\(\s*r\.z/);
  });
});
