import { describe, it, expect } from 'vitest';
import { buildExosphereShader, EXO_UNIFORMS, EXO_BUILTINS } from '../exosphereShader';
import { glf, v3 } from '../../../gl/glf';
import { R_SCENE } from '../planetLook';
import * as X from '../mercuryExosphere';
import { TIERS } from '../planetQuality';

const declared = (src) => [...src.matchAll(/^uniform\s+\w+\s+(\w+)(?:\[\d+\])?;/gm)].map((m) => m[1]);

describe('exosphereShader', () => {
  it('raw GLSL 3, exactly its uniforms', () => {
    const { vs, fs } = buildExosphereShader({ steps: 16 });
    for (const s of [vs, fs]) { expect(s).not.toMatch(/#version|#include/); }
    const names = declared(fs).filter((u) => !EXO_BUILTINS.includes(u));
    expect([...names].sort()).toEqual([...EXO_UNIFORMS].sort());
  });

  it('interpolates every constant from mercuryExosphere', () => {
    const { fs } = buildExosphereShader({ steps: 16 });
    for (const name of ['TAIL_W0', 'TAIL_SPREAD', 'H_NA', 'H_HG', 'NA_HALO_GAIN', 'NA_TAIL_GAIN', 'HG_GAIN',
      'STREAM_AMP', 'STREAM_FREQ_S', 'STREAM_FREQ_P', 'STREAM_SPEED']) {
      expect(fs).toContain(`const float ${name} = ${glf(X[name])};`);
    }
    expect(fs).toContain(`const float R_SCENE = ${glf(R_SCENE)};`);
    expect(fs).toContain(`const vec3 NA_COL = ${v3(X.NA_COL)};`);
    expect(fs).toContain(`const vec3 HG_COL = ${v3(X.HG_COL)};`);
  });

  it('march steps per tier; lite keeps only the closed-form halo', () => {
    for (const t of Object.values(TIERS)) expect(buildExosphereShader({ steps: t.exoSteps }).fs).toContain(`const int EXO_STEPS = ${t.exoSteps};`);
  });

  it('mirrors haloColumn and tailDensity, dithers its output', () => {
    const { fs } = buildExosphereShader({ steps: 8 });
    expect(fs).toContain('float haloColumn(float b, float H)');
    expect(fs).toContain('float tailDensity(vec3 P)');
    expect(fs).toMatch(/\/ 255\.0/);
  });
});
