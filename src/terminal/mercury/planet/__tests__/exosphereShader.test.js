import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildExosphereShader, EXO_UNIFORMS, EXO_BUILTINS, EXO_MATERIAL } from '../exosphereShader';
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

describe('exosphere option 2: dims the backdrop along the tail, then adds amber', () => {
  it('premultiplied "over": src ONE, dst ONE_MINUS_SRC_ALPHA, additive equation, no depth write', () => {
    expect(EXO_MATERIAL.transparent).toBe(true);
    expect(EXO_MATERIAL.depthTest).toBe(true);
    expect(EXO_MATERIAL.depthWrite).toBe(false);
    expect(EXO_MATERIAL.side).toBe(THREE.BackSide);
    expect(EXO_MATERIAL.blending).toBe(THREE.CustomBlending);
    expect(EXO_MATERIAL.blendEquation).toBe(THREE.AddEquation);
    expect(EXO_MATERIAL.blendSrc).toBe(THREE.OneFactor);
    expect(EXO_MATERIAL.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });

  it('EXO_DIM is interpolated with glf; alpha comes from the tail radiance only (the halo stays additive)', () => {
    for (const t of Object.values(TIERS)) {
      const { fs } = buildExosphereShader({ steps: t.exoSteps });
      expect(fs).toContain(`const float EXO_DIM = ${glf(X.EXO_DIM)};`);
      expect(fs).toContain('float tailA = 1.0 - exp(-EXO_DIM * tailE);');
      expect(fs).toMatch(/fragColor = vec4\(srgb \+ dith, alpha\);/);
    }
    const { fs } = buildExosphereShader({ steps: 8 });
    // tail radiance is the same column that feeds the emission, × exoGain
    expect(fs).toContain('tailE = NA_TAIL_GAIN * acc * dt * uExoGain;');
    // the halo term never enters alpha
    expect(fs).not.toMatch(/tailE[^;]*haloColumn/);
  });

  it('lite (no march) keeps alpha 0: pure additive halo', () => {
    const { fs } = buildExosphereShader({ steps: 0 });
    expect(fs).toContain('const int EXO_STEPS = 0;');
    expect(fs).toContain('float tailE = 0.0;');
  });
});
