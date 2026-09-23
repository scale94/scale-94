import { describe, it, expect } from 'vitest';
import { createRecordingGL } from './recordingGL';

describe('recordingGL — instancing and float-target support', () => {
  it('reports no optional extension unless asked', () => {
    const gl = createRecordingGL({ version: 2 });
    expect(gl.getExtension('EXT_color_buffer_float')).toBeNull();
  });

  it('reports exactly the extensions it was given', () => {
    const gl = createRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
    expect(gl.getExtension('EXT_color_buffer_float')).not.toBeNull();
    expect(gl.getExtension('EXT_float_blend')).toBeNull();
    expect(gl.getExtension('WEBGL_lose_context')).toHaveProperty('loseContext');
  });

  it('records the instancing and separate-blend calls', () => {
    const gl = createRecordingGL({ version: 2 });
    gl.vertexAttribDivisor(0, 1);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 60);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    expect(gl.__log).toEqual([
      ['vertexAttribDivisor', 0, 1],
      ['drawArraysInstanced', 5, 0, 4, 60],
      ['blendFuncSeparate', 1, 1, 0, 1],
    ]);
  });

  it('says every framebuffer is complete, and logs the check', () => {
    const gl = createRecordingGL({ version: 2 });
    expect(gl.checkFramebufferStatus(gl.FRAMEBUFFER)).toBe(gl.FRAMEBUFFER_COMPLETE);
    expect(gl.__log).toEqual([['checkFramebufferStatus', 0x8d40]]);
  });

  it('has the half-float and screen-blend enums', () => {
    const gl = createRecordingGL({ version: 2 });
    expect([gl.RGBA16F, gl.HALF_FLOAT, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.NEAREST])
      .toEqual([0x881a, 0x140b, 0x0301, 0, 0x2600]);
  });
});
