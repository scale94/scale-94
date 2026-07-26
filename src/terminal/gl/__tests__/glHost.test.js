import { describe, it, expect, vi } from 'vitest';
import { createRecordingGL } from './recordingGL';
import { createShaderHost } from '../glHost';

function canvasWith(gl) {
  return { getContext: () => gl, style: {}, width: 0, height: 0 };
}

const BASE = { vs: 'VS', fs: 'FS', uniforms: ['u_a'], pixelSize: 100 };

describe('createShaderHost', () => {
  it('returns null when the context is unavailable', () => {
    const canvas = { getContext: () => null, style: {} };
    expect(createShaderHost(canvas, { ...BASE, strategy: 'legacy' })).toBeNull();
  });

  it('sizes the backing store by DPR, clamped to 2', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const canvas = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(canvas, { ...BASE, version: 1, strategy: 'legacy' });
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(200);
    vi.unstubAllGlobals();
  });

  it('writes style size only when asked', () => {
    const a = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(a, { ...BASE, version: 1, strategy: 'legacy' });
    expect(a.style.width).toBeUndefined();

    const b = canvasWith(createRecordingGL({ version: 1 }));
    createShaderHost(b, { ...BASE, version: 1, strategy: 'legacy', setStyleSize: true });
    expect(b.style.width).toBe('100px');
  });

  it('harvests uniform locations into a keyed map', () => {
    const canvas = canvasWith(createRecordingGL({ version: 1 }));
    const host = createShaderHost(canvas, {
      ...BASE, version: 1, strategy: 'legacy', uniforms: ['u_a', 'u_b'],
    });
    // recordingGL tags uniform locations as `uniform:<programTag>:<name>` (see
    // recordingGL.js getUniformLocation) so the tag carries a program-id
    // segment, not just the bare name — assert on the structure that
    // actually matters here: each entry is keyed by its uniform name.
    expect(host.U.u_a.__tag).toMatch(/^uniform:program:\d+:u_a$/);
    expect(host.U.u_b.__tag).toMatch(/^uniform:program:\d+:u_b$/);
  });

  it("legacy strategy creates the program before compiling and never deletes shaders", () => {
    const gl = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(gl), { ...BASE, version: 1, strategy: 'legacy' });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('createProgram')).toBeLessThan(names.indexOf('createShader'));
    expect(names).not.toContain('deleteShader');
    expect(names).not.toContain('getProgramParameter');
  });

  it('lunar strategy compiles first, deletes shaders, and checks link status', () => {
    const gl = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(gl), { ...BASE, version: 2, strategy: 'lunar' });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('createShader')).toBeLessThan(names.indexOf('createProgram'));
    expect(names).toContain('deleteShader');
    expect(names).toContain('getProgramParameter');
  });

  it('lunar strategy throws with the driver log on compile failure', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.getShaderParameter = () => false;
    gl.getShaderInfoLog = () => 'BOOM';
    expect(() =>
      createShaderHost(canvasWith(gl), { ...BASE, version: 2, strategy: 'lunar', label: 'moon' })
    ).toThrow(/moon.*BOOM/s);
  });

  it('legacy strategy survives compile failure and returns a host', () => {
    const gl = createRecordingGL({ version: 1 });
    gl.getShaderParameter = () => false;
    const host = createShaderHost(canvasWith(gl), { ...BASE, version: 1, strategy: 'legacy' });
    expect(host).not.toBeNull();
  });

  it('uses a VAO at version 2 and a bare attribute at version 1', () => {
    const v2 = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(v2), { ...BASE, version: 2, strategy: 'lunar' });
    expect(v2.__log.map(e => e[0])).toContain('createVertexArray');

    const v1 = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(v1), { ...BASE, version: 1, strategy: 'legacy' });
    expect(v1.__log.map(e => e[0])).toContain('getAttribLocation');
  });

  it('runs onInit after quad setup and before main-program activation', () => {
    const gl = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(gl), {
      ...BASE, version: 2, strategy: 'lunar',
      onInit: () => { gl.__log.push(['MARK']); },
    });
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('bufferData')).toBeLessThan(names.indexOf('MARK'));
    expect(names.indexOf('MARK')).toBeLessThan(names.lastIndexOf('useProgram'));
  });

  it('calls onDispose before deleting the program', () => {
    const gl = createRecordingGL({ version: 2 });
    const host = createShaderHost(canvasWith(gl), {
      ...BASE, version: 2, strategy: 'lunar',
      onDispose: (g) => g.deleteTexture({ __tag: 'texture:x' }),
    });
    host.dispose();
    const names = gl.__log.map(e => e[0]);
    expect(names.indexOf('deleteTexture')).toBeLessThan(names.indexOf('deleteProgram'));
  });

  it('dispose calls loseContext only when asked', () => {
    const on = createRecordingGL({ version: 1 });
    createShaderHost(canvasWith(on), { ...BASE, version: 1, strategy: 'legacy' }).dispose();
    expect(on.__log.map(e => e[0])).toContain('loseContext');

    const off = createRecordingGL({ version: 2 });
    createShaderHost(canvasWith(off), {
      ...BASE, version: 2, strategy: 'lunar', loseContextOnDispose: false,
    }).dispose();
    expect(off.__log.map(e => e[0])).not.toContain('loseContext');
  });
});
