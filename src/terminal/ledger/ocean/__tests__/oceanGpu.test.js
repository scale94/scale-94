import { describe, it, expect } from 'vitest';
import { createRecordingGL } from '../../../gl/__tests__/recordingGL';
import { makeGrid, DT_DAYS } from '../grid';
import { diffusionSchedule } from '../referenceStep';
import { createOceanGpu } from '../gpu/oceanGpu';

const grid = makeGrid(8, 4);
const staticData = new Float32Array(grid.n * 4);
const rowData = new Float32Array(grid.ny * 2 * 4);
const withFloat = () => createRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
const make = (gl, opts = {}) => createOceanGpu(gl, { grid, staticData, rowData, vao: { __tag: 'vao:test' }, ...opts });

// Replays the WHOLE log (FBO→texture links are made at creation time), and
// for every draw at index >= from checks that the texture attached to the
// bound FBO is not bound on any texture unit (a WebGL feedback loop).
function feedback(log, from) {
  const fboTex = new Map();
  const bound = new Map();
  let fbo = null;
  let unit = 0;
  let bad = 0;
  let draws = 0;
  log.forEach(([name, ...a], idx) => {
    if (name === 'bindFramebuffer') fbo = a[1];
    else if (name === 'framebufferTexture2D') fboTex.set(fbo, a[3]);
    else if (name === 'activeTexture') unit = a[0] - 0x84c0;
    else if (name === 'bindTexture') bound.set(unit, a[1]);
    else if (name === 'drawArrays' && idx >= from) {
      draws++;
      const t = fboTex.get(fbo);
      if (t && [...bound.values()].includes(t)) bad++;
    }
  });
  return { bad, draws };
}

describe('createOceanGpu', () => {
  it('returns null without float render targets', () => {
    expect(make(createRecordingGL({ version: 2 }))).toBeNull();
  });

  it('runs 3 BFECC passes, each diffusion substep, and one react pass per step', () => {
    const gl = withFloat();
    const gpu = make(gl, { diffusivity: 5e6 });
    const { sub } = diffusionSchedule(grid, DT_DAYS, 5e6);
    expect(sub).toBeGreaterThan(1);
    const start = gl.__log.length;
    gpu.step();
    const stepLog = gl.__log.slice(start);
    expect(stepLog.filter((e) => e[0] === 'drawArrays')).toHaveLength(3 + sub + 1);
    expect(stepLog).toContainEqual(['viewport', 0, 0, 8, 4]);
    expect(stepLog[stepLog.length - 1]).toEqual(['bindFramebuffer', gl.FRAMEBUFFER, null]);
  });

  it('skips diffusion entirely when D = 0', () => {
    const gl = withFloat();
    const gpu = make(gl, { diffusivity: 0 });
    const start = gl.__log.length;
    gpu.step();
    expect(gl.__log.slice(start).filter((e) => e[0] === 'drawArrays')).toHaveLength(4);
  });

  it('never renders into a texture it is sampling', () => {
    const gl = withFloat();
    const gpu = make(gl, { diffusivity: 5e6 });
    const start = gl.__log.length;
    for (let s = 0; s < 3; s++) gpu.step();
    const { bad, draws } = feedback(gl.__log, start);
    expect(draws).toBe(3 * (3 + diffusionSchedule(grid, DT_DAYS, 5e6).sub + 1));
    expect(bad).toBe(0);
  });

  it('reads back the current state', () => {
    const gl = withFloat();
    const gpu = make(gl);
    expect(gpu.readState()).toHaveLength(grid.n * 4);
    expect(gl.__log.some((e) => e[0] === 'readPixels')).toBe(true);
  });
});
