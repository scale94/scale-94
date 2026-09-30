// particleLayer.js — draws the river-stage parcels over the composite, in the
// ocean's own GL context (one canvas, the ocean's lifecycle). The CPU writes
// every parcel's position and colour (riverStage.fillParticles); this layer
// only rasterises them. Owns its program, VAO and buffer; the host's quad VAO
// is never touched (paint and step bind their own VAO every time).

import { buildProgram } from '../../../gl/glHost';
import { PARTICLE_VS, PARTICLE_FS, PARTICLE_AA_PX } from './particleShaders';
import { FLOATS_PER_PARTICLE } from '../riverStage';

export function createParticleLayer(gl) {
  // First, so a failed build has allocated nothing else.
  const prog = buildProgram(gl, PARTICLE_VS, PARTICLE_FS, { label: 'ocean:particles' });
  const uSize = gl.getUniformLocation(prog, 'uSize');
  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  const stride = FLOATS_PER_PARTICLE * 4;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 8);
  gl.bindVertexArray(null);
  return {
    upload(data, count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * FLOATS_PER_PARTICLE), gl.DYNAMIC_DRAW);
    },
    // sizePx: the visible dot diameter in device px. The sprite is
    // PARTICLE_AA_PX larger on each side for the FS's soft edge.
    draw(first, count, sizePx) {
      if (!(count > 0)) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform1f(uSize, sizePx + 2 * PARTICLE_AA_PX);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, first, count);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
    },
  };
}
