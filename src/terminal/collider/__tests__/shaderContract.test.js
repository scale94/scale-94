import { describe, it, expect } from 'vitest';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from '../fieldShader';
import { PARTICLE_VS, PARTICLE_FS, PARTICLE_UNIFORMS, MAX_POINT_SIZE } from '../particleShader';

// Pulls every `uniform <type> <name>` declaration out of a GLSL source,
// dropping any `[n]` array suffix.
function declaredUniforms(src) {
  return [...src.matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*(\[\d+\])?\s*;/gm)].map(m => m[1]);
}

describe.each([
  ['field', FIELD_VS, FIELD_FS, FIELD_UNIFORMS],
  ['particle', PARTICLE_VS, PARTICLE_FS, PARTICLE_UNIFORMS],
])('%s shader', (name, vs, fs, contract) => {
  it('declares #version 300 es as the very first characters', () => {
    // A leading newline or space makes the directive illegal and the shader
    // fails to compile with a message that does not mention whitespace.
    expect(vs.startsWith('#version 300 es\n')).toBe(true);
    expect(fs.startsWith('#version 300 es\n')).toBe(true);
  });

  it('declares exactly the uniforms the component will harvest', () => {
    const declared = new Set([...declaredUniforms(vs), ...declaredUniforms(fs)]);
    expect([...declared].sort()).toEqual([...contract].sort());
  });

  it('binds its attribute to location 0, which is what glHost enables', () => {
    expect(vs).toMatch(/layout\s*\(\s*location\s*=\s*0\s*\)\s+in\s/);
  });

  it('writes to a declared out, not the removed gl_FragColor', () => {
    expect(fs).not.toContain('gl_FragColor');
    expect(fs).toMatch(/^\s*out\s+vec4\s+\w+\s*;/m);
  });
});

describe('particle shader specifics', () => {
  it('clamps gl_PointSize to avoid ANGLE large-point quirks', () => {
    // Spec 5.3. Windows/ANGLE misrenders points above ~64px; 32 is the cap.
    expect(MAX_POINT_SIZE).toBe(32);
    expect(PARTICLE_VS).toContain('gl_PointSize');
    expect(PARTICLE_VS).toContain(`${MAX_POINT_SIZE}.0`);
  });

  it('fades particles in at ingress', () => {
    // Spec 5.3: gl.POINTS are culled on their centre, so a sprite entering at
    // x=0 pops in at full size unless its alpha ramps. Guard the marker
    // comment so the mitigation cannot be silently deleted.
    expect(PARTICLE_VS).toContain('INGRESS');
  });
});

describe('field shader specifics', () => {
  it('dithers the final colour', () => {
    // Spec 5.1: the radial falloffs band on OLED without this.
    expect(FIELD_FS).toContain('dither');
  });

  it('sizes its beam array to the 16 OCK dimensions', () => {
    expect(FIELD_FS).toMatch(/uniform\s+vec4\s+uBeams\s*\[\s*16\s*\]\s*;/);
  });
});
