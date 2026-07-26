import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { createRecordingGL, installRecordingGL } from './recordingGL';
import { driveFrames } from './driveFrames';
import MercuryTerminator from '../../components/MercuryTerminator';

describe('recordingGL', () => {
  it('records calls in order with tagged handles', () => {
    const gl = createRecordingGL({ version: 1 });
    const p = gl.createProgram();
    const u = gl.getUniformLocation(p, 'u_time');
    gl.uniform1f(u, 0.5);
    expect(gl.__log).toEqual([
      ['createProgram'],
      ['getUniformLocation', 'program:0', 'u_time'],
      ['uniform1f', 'uniform:program:0:u_time', 0.5],
    ]);
  });

  it('hashes shader source instead of inlining it', () => {
    const gl = createRecordingGL({ version: 1 });
    const s = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(s, 'void main(){}');
    const entry = gl.__log.find(e => e[0] === 'shaderSource');
    expect(entry[2]).toMatch(/^src:13:[0-9a-f]{8}$/);
  });

  it('expands typed arrays to plain arrays', () => {
    const gl = createRecordingGL({ version: 1 });
    gl.uniform3fv({ __tag: 'uniform:c0' }, new Float32Array([1, 0, 0.5]));
    expect(gl.__log[0]).toEqual(['uniform3fv', 'uniform:c0', [1, 0, 0.5]]);
  });

  it('exposes webgl2-only methods only at version 2', () => {
    expect(createRecordingGL({ version: 1 }).createVertexArray).toBeUndefined();
    expect(createRecordingGL({ version: 2 }).createVertexArray).toBeTypeOf('function');
  });

  it('installRecordingGL intercepts the requested context type', () => {
    const { log, restore } = installRecordingGL({ version: 2 });
    const gl = document.createElement('canvas').getContext('webgl2');
    gl.createProgram();
    expect(log).toEqual([['createProgram']]);
    restore();
  });

  it('tags uniform locations by owning program, not name alone', () => {
    const gl = createRecordingGL({ version: 1 });
    const p0 = gl.createProgram();
    const p1 = gl.createProgram();
    const u0 = gl.getUniformLocation(p0, 'u_t');
    const u1 = gl.getUniformLocation(p1, 'u_t');
    expect(u0.__tag).not.toBe(u1.__tag);
    expect(u0.__tag).toBe('uniform:program:0:u_t');
    expect(u1.__tag).toBe('uniform:program:1:u_t');
  });

  it('returns a stable, distinct per-name index from getAttribLocation', () => {
    const gl = createRecordingGL({ version: 1 });
    const p = gl.createProgram();
    const a0 = gl.getAttribLocation(p, 'a_pos');
    const a1 = gl.getAttribLocation(p, 'a_uv');
    const a0Again = gl.getAttribLocation(p, 'a_pos');
    expect(a0).toBe(0);
    expect(a1).toBe(1);
    expect(a0Again).toBe(0);
  });
});

describe('driveFrames', () => {
  it('produces a non-empty, byte-identical log across two runs', () => {
    const mount = () => {
      const { unmount } = render(
        <MercuryTerminator twilight={0.3} day={0.1} flare={null} size={180} />
      );
      return unmount;
    };
    const a = driveFrames(mount, { version: 1 });
    const b = driveFrames(mount, { version: 1 });
    expect(a.init.length).toBeGreaterThan(10);
    expect(a.frames.length).toBeGreaterThan(10);
    expect(b).toEqual(a);
  });

  it('still restores getContext and real timers when unmount throws', () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const mount = () => () => { throw new Error('unmount boom'); };

    expect(() => driveFrames(mount, { version: 1, frames: 1 })).toThrow('unmount boom');

    expect(HTMLCanvasElement.prototype.getContext).toBe(originalGetContext);
    expect(vi.isFakeTimers()).toBe(false);
  });

  it('splits the log at the end of synchronous mount, not at the first drawArrays', () => {
    // Synthetic mount (not a real component): draws once synchronously during
    // mount (the "first paint"), then schedules further draws via rAF on
    // subsequent frames. A driver that split at the first drawArrays call
    // would misfile the mount-time draw into `frames`; the correct driver
    // (splitting at rec.log.length right after mount() returns) keeps it in
    // `init`.
    const mount = () => {
      const gl = document.createElement('canvas').getContext('webgl');
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // synchronous first paint, still mount-time
      const tick = () => {
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // frame-time draw
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return () => {};
    };

    const { init, frames } = driveFrames(mount, { version: 1, frames: 3 });
    const drawCount = (log) => log.filter(e => e.startsWith('drawArrays')).length;

    expect(drawCount(init)).toBe(1);
    expect(drawCount(frames)).toBeGreaterThan(0);
  });
});
