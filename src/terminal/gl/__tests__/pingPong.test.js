import { describe, it, expect } from 'vitest';
import { createRecordingGL } from './recordingGL';
import {
  probeFloatTargets, createFloatTarget, createPingPong, readTarget, readTexel,
} from '../pingPong';

const withFloat = () => createRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
const find = (log, name) => log.filter((e) => e[0] === name);

describe('probeFloatTargets', () => {
  it('needs WebGL2 and EXT_color_buffer_float', () => {
    expect(probeFloatTargets(createRecordingGL({ version: 2 }))).toBe(false);
    expect(probeFloatTargets(createRecordingGL({ version: 1, extensions: ['EXT_color_buffer_float'] }))).toBe(false);
    expect(probeFloatTargets(withFloat())).toBe(true);
    expect(probeFloatTargets(null)).toBe(false);
  });
});

describe('createFloatTarget', () => {
  it('builds a complete NEAREST RGBA32F target and unbinds', () => {
    const gl = withFloat();
    const t = createFloatTarget(gl, 8, 4);
    expect(t).toMatchObject({ w: 8, h: 4 });
    const log = gl.__log;
    expect(find(log, 'texImage2D')[0]).toEqual(
      ['texImage2D', gl.TEXTURE_2D, 0, gl.RGBA32F, 8, 4, 0, gl.RGBA, gl.FLOAT, null],
    );
    expect(log).toContainEqual(['texParameteri', gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST]);
    expect(log).toContainEqual(['texParameteri', gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST]);
    expect(find(log, 'framebufferTexture2D')).toHaveLength(1);
    expect(find(log, 'checkFramebufferStatus')).toHaveLength(1);
    expect(log[log.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });

  it('returns null and frees both objects when the attachment is incomplete', () => {
    const gl = withFloat();
    gl.checkFramebufferStatus = () => 0;
    expect(createFloatTarget(gl, 8, 4)).toBeNull();
    expect(find(gl.__log, 'deleteFramebuffer')).toHaveLength(1);
    expect(find(gl.__log, 'deleteTexture')).toHaveLength(1);
  });
});

describe('createPingPong', () => {
  it('swaps read and write', () => {
    const pp = createPingPong(withFloat(), 4, 2);
    const r = pp.read;
    const w = pp.write;
    expect(r).not.toBe(w);
    pp.swap();
    expect(pp.read).toBe(w);
    expect(pp.write).toBe(r);
  });
});

describe('readTarget', () => {
  it('reads RGBA floats from the target framebuffer', () => {
    const gl = withFloat();
    const t = createFloatTarget(gl, 8, 4);
    gl.__log.length = 0;
    const out = readTarget(gl, t);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out).toHaveLength(8 * 4 * 4);
    const rp = find(gl.__log, 'readPixels')[0];
    expect(rp.slice(0, 7)).toEqual(['readPixels', 0, 0, 8, 4, gl.RGBA, gl.FLOAT]);
    expect(gl.__log[gl.__log.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });
});

describe('readTexel', () => {
  it('reads one RGBA float texel from the target framebuffer and unbinds', () => {
    const gl = withFloat();
    const t = createFloatTarget(gl, 8, 4);
    const start = gl.__log.length;
    const out = readTexel(gl, t, 5, 2);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out).toHaveLength(4);
    expect(gl.__log.slice(start)).toEqual([
      ['bindFramebuffer', gl.FRAMEBUFFER, t.fbo.__tag],
      ['readPixels', 5, 2, 1, 1, gl.RGBA, gl.FLOAT, [0, 0, 0, 0]],
      ['bindFramebuffer', gl.FRAMEBUFFER, null],
    ]);
  });
});

