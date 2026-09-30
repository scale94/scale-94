import { describe, it, expect, vi } from 'vitest';
import { validDraft, createFrameCoalescer, coordErrors, isNullIsland } from '../draft';

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

  it('is null for whitespace-only lat or lon', () => {
    expect(validDraft({ ...FORM, lat: '  ' })).toBeNull();
    expect(validDraft({ ...FORM, lon: ' \t' })).toBeNull();
  });
});

describe('coordErrors', () => {
  const at = (lat, lon) => coordErrors({ lat, lon });
  const msgs = (lat, lon) => at(lat, lon).map((e) => `${e.field}: ${e.message}`);

  it('accepts plain decimals, negatives, exponents and the bounds themselves', () => {
    for (const [lat, lon] of [['52.52', '13.405'], ['-52.52', '-13.405'], ['1e1', '1e1'], [52.52, 13.405],
      ['90', '180'], ['-90', '-180'], [' 48.2 ', '16.37']]) {
      expect(at(lat, lon)).toEqual([]);
    }
  });

  it('calls a blank or whitespace coordinate required', () => {
    expect(msgs('', '')).toEqual(['lat: Latitude is required', 'lon: Longitude is required']);
    expect(msgs('  ', ' \t')).toEqual(['lat: Latitude is required', 'lon: Longitude is required']);
    expect(msgs(undefined, null)).toEqual(['lat: Latitude is required', 'lon: Longitude is required']);
  });

  it('calls a non-finite coordinate not a number', () => {
    expect(msgs('abc', '13.4')).toEqual(['lat: Latitude must be a number']);
    expect(msgs('52.5', 'NaN')).toEqual(['lon: Longitude must be a number']);
    expect(msgs('Infinity', '-Infinity')).toEqual(['lat: Latitude must be a number', 'lon: Longitude must be a number']);
  });

  it('rejects anything past ±90 / ±180, bounds inclusive', () => {
    expect(msgs('90.0001', '0')).toEqual(['lat: Latitude must be between -90 and 90']);
    expect(msgs('-95', '13.4')).toEqual(['lat: Latitude must be between -90 and 90']);
    expect(msgs('52.52', '373.4')).toEqual(['lon: Longitude must be between -180 and 180']);
    expect(msgs('52.52', '-180.0001')).toEqual(['lon: Longitude must be between -180 and 180']);
  });

  it('validDraft uses the same rule', () => {
    expect(validDraft({ ...FORM, lat: '90', lon: '-180' })).toEqual(expect.objectContaining({ lat: 90, lon: -180 }));
    expect(validDraft({ ...FORM, lat: '90.0001' })).toBeNull();
    expect(validDraft({ ...FORM, lon: 'Infinity' })).toBeNull();
  });

  it('knows exactly 0°, 0° and nothing near it', () => {
    expect(isNullIsland(0, 0)).toBe(true);
    expect(isNullIsland('0', '-0')).toBe(true);
    expect(isNullIsland('0.0', '0')).toBe(true);
    expect(isNullIsland(0.5, 0)).toBe(false);
    expect(isNullIsland(0, 0.0001)).toBe(false);
    expect(isNullIsland('', '')).toBe(false);
    expect(isNullIsland(null, undefined)).toBe(false);
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
