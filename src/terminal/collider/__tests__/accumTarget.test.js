import { describe, it, expect } from 'vitest';
import { createRecordingGL } from '../../gl/__tests__/recordingGL';
import { createAccumTarget, resizeAccumTarget, deleteAccumTarget } from '../accumTarget';

const HALF = ['EXT_color_buffer_float'];
const calls = (gl, name) => gl.__log.filter((e) => e[0] === name);

describe('accumTarget', () => {
  it('without EXT_color_buffer_float: screen mode, no GL objects', () => {
    const gl = createRecordingGL({ version: 2 });
    const A = createAccumTarget(gl, 900, 220);
    expect(A).toEqual({ mode: 'screen', fbo: null, tex: null, w: 900, h: 220 });
    expect(calls(gl, 'createFramebuffer')).toHaveLength(0);
    expect(calls(gl, 'createTexture')).toHaveLength(0);
  });

  it('with it: an RGBA16F / HALF_FLOAT texture attached to a framebuffer, unbound after', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    const A = createAccumTarget(gl, 900, 220);
    expect(A.mode).toBe('half-float');
    expect(A.fbo).not.toBeNull();
    const tex = calls(gl, 'texImage2D');
    expect(tex).toHaveLength(1);
    expect(tex[0]).toEqual(['texImage2D', gl.TEXTURE_2D, 0, gl.RGBA16F, 900, 220, 0, gl.RGBA, gl.HALF_FLOAT, null]);
    const binds = calls(gl, 'bindFramebuffer');
    expect(binds[binds.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });

  it('an incomplete framebuffer falls back to screen and frees what it made', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    gl.checkFramebufferStatus = () => 0;
    const A = createAccumTarget(gl, 900, 220);
    expect(A.mode).toBe('screen');
    expect(calls(gl, 'deleteFramebuffer')).toHaveLength(1);
    expect(calls(gl, 'deleteTexture')).toHaveLength(1);
  });

  it('resize reallocates only when the size changes', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    const A = createAccumTarget(gl, 900, 220);
    const before = calls(gl, 'texImage2D').length;
    resizeAccumTarget(gl, A, 900, 220);
    expect(calls(gl, 'texImage2D')).toHaveLength(before);
    resizeAccumTarget(gl, A, 1200, 440);
    expect(calls(gl, 'texImage2D')).toHaveLength(before + 1);
    expect([A.w, A.h]).toEqual([1200, 440]);
  });

  it('resize is a no-op in screen mode', () => {
    const gl = createRecordingGL({ version: 2 });
    const A = createAccumTarget(gl, 900, 220);
    resizeAccumTarget(gl, A, 1200, 440);
    expect(calls(gl, 'texImage2D')).toHaveLength(0);
  });

  it('delete frees both objects once and is idempotent', () => {
    const gl = createRecordingGL({ version: 2, extensions: HALF });
    const A = createAccumTarget(gl, 900, 220);
    deleteAccumTarget(gl, A);
    deleteAccumTarget(gl, A);
    expect(calls(gl, 'deleteFramebuffer')).toHaveLength(1);
    expect(calls(gl, 'deleteTexture')).toHaveLength(1);
    expect(A.mode).toBe('screen');
  });
});
