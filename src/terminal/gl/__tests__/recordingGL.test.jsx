import { describe, it, expect } from 'vitest';
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
      ['uniform1f', 'uniform:u_time', 0.5],
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
});
