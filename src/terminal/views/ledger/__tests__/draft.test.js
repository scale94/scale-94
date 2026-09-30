import { describe, it, expect, vi } from 'vitest';
import { validDraft, createFrameCoalescer } from '../draft';

const FORM = {
  lat: '48.31', lon: '14.29', siteName: 'Linz', temp: '12', do: '10.5', bod: '3', dt: '1.5',
  epi: '2.8', nitrate: '19', flow: '44', dependency: 'sovereign', notes: '',
};

describe('validDraft', () => {
  it('returns numeric params for a complete, in-range form', () => {
    expect(validDraft(FORM)).toEqual({
      lat: 48.31, lon: 14.29, siteName: 'Linz', temp: 12, do: 10.5, bod: 3, dt: 1.5, epi: 2.8, nitrate: 19, flow: 44,
    });
  });

  it('is null for a blank, non-numeric, out-of-range or off-globe field', () => {
    expect(validDraft({ ...FORM, bod: '' })).toBeNull();
    expect(validDraft({ ...FORM, lat: '' })).toBeNull();
    expect(validDraft({ ...FORM, flow: 'abc' })).toBeNull();
    expect(validDraft({ ...FORM, bod: '500' })).toBeNull();
    expect(validDraft({ ...FORM, lat: '95' })).toBeNull();
    expect(validDraft({ ...FORM, lon: '-181' })).toBeNull();
  });
});

describe('createFrameCoalescer', () => {
  it('delivers only the latest value, once per animation frame', () => {
    const frames = [];
    const raf = (cb) => { frames.push(cb); return frames.length; };
    const caf = (id) => { frames[id - 1] = null; };
    const fn = vi.fn();
    const c = createFrameCoalescer(fn, raf, caf);
    c.push(1);
    c.push(2);
    c.push(3);
    expect(frames).toHaveLength(1);
    expect(fn).not.toHaveBeenCalled();
    frames[0]();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
    c.push(4);
    expect(frames).toHaveLength(2);
    c.cancel();
    expect(frames[1]).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
    c.push(5);
    frames[2]();
    expect(fn).toHaveBeenLastCalledWith(5);
  });
});
