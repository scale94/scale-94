import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { installRecordingGL } from '../../../../gl/__tests__/recordingGL';
import LedgerOcean from '../LedgerOcean';

let rec = null;
afterEach(() => {
  cleanup();
  rec?.restore();
  rec = null;
  vi.restoreAllMocks();
});

describe('LedgerOcean', () => {
  it('runs the GPU ocean when float targets exist', () => {
    rec = installRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByLabelText(/Ledger ocean/)).toBeTruthy();
    expect(screen.queryByText(/STATIC · NO FLOAT TARGETS/)).toBeNull();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(true);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('falls back to a static coastline without float targets', () => {
    rec = installRecordingGL({ version: 2 });
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText('STATIC · NO FLOAT TARGETS')).toBeTruthy();
    expect(rec.log.some((e) => e[0] === 'framebufferTexture2D')).toBe(false);
    expect(rec.log.some((e) => e[0] === 'drawArrays')).toBe(true);
  });

  it('says so when there is no WebGL2 at all', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<LedgerOcean width={512} height={256} />);
    expect(screen.getByText('OCEAN UNAVAILABLE · NO WEBGL2')).toBeTruthy();
  });

  it('falls back to the static coastline, with nothing leaked, when a sim program fails to build', () => {
    rec = installRecordingGL({ version: 2, extensions: ['EXT_color_buffer_float'] });
    let links = 0;
    // link 1 = the host's display program; 2..6 = the five sim programs. Fail the 3rd sim program.
    rec.gl.getProgramParameter = () => { links += 1; return links !== 4; };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<LedgerOcean width={512} height={256} />);
    const n = (name) => rec.log.filter((e) => e[0] === name).length;
    expect(screen.getByText('STATIC · SIM SHADERS FAILED')).toBeTruthy();
    expect(screen.queryByText('OCEAN UNAVAILABLE · NO WEBGL2')).toBeNull();
    expect(n('createProgram')).toBe(n('deleteProgram') + 1);   // only the display program lives
    expect(n('createFramebuffer')).toBe(n('deleteFramebuffer'));
    expect(n('createTexture')).toBe(n('deleteTexture') + 2);   // the static fallback's two textures
    expect(n('drawArrays')).toBe(1);                           // the static frame was painted
  });
});
