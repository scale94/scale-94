import { describe, it, expect } from 'vitest';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS, glf } from '../councilFieldShader';
import { B_C, LUT_W, X_MIN, X_MAX, PHI_MAX, D_X_MAX, FAR } from '../councilGeodesics';
import { COS_I, SIN_I, SPIN_SIGN, F_MAX, T_PEAK, T_EXP, COUNTER_JET } from '../councilFieldPhysics';
import { OMEGA_ISCO_VIS } from '../councilMatter';
import { SPIRAL_DEG, ARM_POINTS, DELAY_MAX, WOBBLE_DEG } from '../councilFieldUniforms';

// Array uniforms (`uniform vec2 u_armA[25];`) are harvested by their bare name:
// getUniformLocation(prog, 'u_armA') is element 0, and uniform2fv fills the array.
const declared = [...FIELD_FS.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);

describe('councilFieldShader contract (spec §5, §7)', () => {
  it('is GLSL ES 3.00 in both stages', () => {
    expect(FIELD_VS.startsWith('#version 300 es\n')).toBe(true);
    expect(FIELD_FS.startsWith('#version 300 es\n')).toBe(true);
  });

  it('declares exactly the uniforms the host harvests, once each', () => {
    expect([...declared].sort()).toEqual([...FIELD_UNIFORMS].sort());
    expect(new Set(declared).size).toBe(declared.length);
  });

  it('interpolates every physical constant from its JS owner', () => {
    for (const [name, value] of Object.entries({
      B_C, LUT_W, X_MIN, X_MAX, PHI_MAX, D_X_MAX, FAR,
      COS_I, SIN_I, SPIN: SPIN_SIGN, F_MAX, T_PEAK, T_EXP, COUNTER_JET,
      OMEGA_ISCO_VIS, SPIRAL_DEG, DELAY_MAX, WOBBLE_DEG,
    })) {
      expect(FIELD_FS).toContain(`const float ${name} = ${glf(value)};`);
    }
  });

  it('sizes the arm uniform arrays and the arm loop from ARM_POINTS', () => {
    expect(FIELD_FS).toContain(`uniform vec2 u_armA[${ARM_POINTS}];`);
    expect(FIELD_FS).toContain(`uniform vec2 u_armB[${ARM_POINTS}];`);
    expect(FIELD_FS).toContain(`const int ARM_POINTS = ${ARM_POINTS};`);
  });

  it('formats GLSL float literals with a decimal point or exponent', () => {
    expect(glf(1000)).toBe('1000.00000');
    expect(glf(0.5)).toBe('0.500000000');
    expect(glf(-266123900)).toBe('-266123900.0');
    expect(glf(-3.0258469e9)).toMatch(/e\+9$/);
  });
});
