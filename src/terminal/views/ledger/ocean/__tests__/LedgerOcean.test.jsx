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
});
