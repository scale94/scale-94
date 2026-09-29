import { describe, it, expect } from 'vitest';
import {
  SIM_VS, SIM_PROGRAMS, SHARED_UNIFORMS, COMPOSITE_FS, COMPOSITE_UNIFORMS,
} from '../gpu/shaders';

const declares = (src, name) => new RegExp(`uniform\\s+\\w+\\s+${name}\\s*;`).test(src);

describe('ocean shaders', () => {
  it('are GLSL ES 3.00 with the quad on location 0', () => {
    expect(SIM_VS.startsWith('#version 300 es')).toBe(true);
    expect(SIM_VS).toContain('layout(location = 0) in vec2 a;');
  });

  it.each(Object.entries(SIM_PROGRAMS))('%s declares every uniform the runner sets', (_name, prog) => {
    expect(prog.fs.startsWith('#version 300 es')).toBe(true);
    for (const u of [...SHARED_UNIFORMS, ...prog.uniforms]) expect(declares(prog.fs, u)).toBe(true);
  });

  it('composite declares every uniform the view sets', () => {
    for (const u of COMPOSITE_UNIFORMS) expect(declares(COMPOSITE_FS, u)).toBe(true);
  });

  it('never samples with hardware filtering', () => {
    for (const src of [...Object.values(SIM_PROGRAMS).map((p) => p.fs), COMPOSITE_FS]) {
      expect(/\btexture\s*\(/.test(src)).toBe(false);
    }
  });
});
