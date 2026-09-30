import { describe, it, expect } from 'vitest';
import { createRecordingGL } from '../../../gl/__tests__/recordingGL';
import { createParticleLayer } from '../gpu/particleLayer';
import { PARTICLE_VS, PARTICLE_FS } from '../gpu/particleShaders';

describe('createParticleLayer', () => {
  it('declares the parcel layout the buffer fill writes (clip xy at 0, RGBA at 1)', () => {
    expect(PARTICLE_VS).toMatch(/layout\(location = 0\) in vec2 aPos;/);
    expect(PARTICLE_VS).toMatch(/layout\(location = 1\) in vec4 aColor;/);
    expect(PARTICLE_VS).toMatch(/gl_PointSize = uSize;/);
    expect(PARTICLE_FS).toMatch(/gl_PointCoord/);
  });

  it('owns a VAO with two interleaved attributes (stride 24 bytes) and draws blended points', () => {
    const gl = createRecordingGL({ version: 2 });
    const layer = createParticleLayer(gl);
    expect(gl.__log).toContainEqual(['vertexAttribPointer', 0, 2, gl.FLOAT, false, 24, 0]);
    expect(gl.__log).toContainEqual(['vertexAttribPointer', 1, 4, gl.FLOAT, false, 24, 8]);
    const data = new Float32Array(3 * 6).fill(0.5);
    layer.upload(data, 2);
    expect(gl.__log.at(-1)).toEqual(['bufferData', gl.ARRAY_BUFFER, Array.from(data.subarray(0, 12)), gl.DYNAMIC_DRAW]);
    const mark = gl.__log.length;
    layer.draw(0, 2, 3);
    const calls = gl.__log.slice(mark).map((e) => e[0]);
    expect(calls).toEqual([
      'bindFramebuffer', 'useProgram', 'bindVertexArray', 'uniform1f', 'enable', 'blendFunc',
      'drawArrays', 'disable', 'bindVertexArray',
    ]);
    expect(gl.__log.find((e, i) => i >= mark && e[0] === 'drawArrays')).toEqual(['drawArrays', gl.POINTS, 0, 2]);
    const n = gl.__log.length;
    layer.draw(0, 0, 3);
    expect(gl.__log.length).toBe(n);   // nothing to draw: no GL calls
  });

  it('releases its program, VAO and buffer', () => {
    const gl = createRecordingGL({ version: 2 });
    createParticleLayer(gl).dispose();
    const count = (name) => gl.__log.filter((e) => e[0] === name).length;
    expect(count('deleteProgram')).toBe(count('createProgram'));
    expect(count('deleteVertexArray')).toBe(count('createVertexArray'));
    expect(count('deleteBuffer')).toBe(count('createBuffer'));
  });

  it('throws on a failed link having allocated nothing that outlives it', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.getProgramParameter = () => false;
    expect(() => createParticleLayer(gl)).toThrow(/failed to link/);
    expect(gl.__log.filter((e) => e[0] === 'createVertexArray')).toHaveLength(0);
    expect(gl.__log.filter((e) => e[0] === 'createBuffer')).toHaveLength(0);
  });
});
