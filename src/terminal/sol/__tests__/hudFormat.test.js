import { describe, it, expect } from 'vitest';
import { formatYear, formatClock, messengerValue, pickStackId, MESSENGER_LABEL } from '../hudFormat';

describe('hudFormat CLOCKS', () => {
  it('labels', () => {
    expect(MESSENGER_LABEL).toEqual({
      neutrinos: 'NEUTRINOS', light: 'LIGHT', protons: 'PROTONS', cloud: 'CLOUD', core: 'CORE LIGHT',
    });
  });
  it('formatYear groups with thin spaces', () => {
    expect(formatYear(172026)).toBe('CE 172 026');
    expect(formatYear(7590002026)).toBe('CE 7 590 002 026');
  });
  it('formatClock is local HH:MM:SS', () => {
    const d = new Date(2026, 10, 17, 9, 5, 7);
    expect(formatClock(d.getTime())).toBe('09:05:07');
  });
  it('messengerValue per state', () => {
    expect(messengerValue({ key: 'neutrinos', arrived: true, reading: { detected: false } })).toBe('arrived · undetected');
    expect(messengerValue({ key: 'light', arrived: true, reading: { ageS: 499, xray: 'X28' } })).toBe('arrived · 8 min 19 s old · X28');
    expect(messengerValue({ key: 'protons', arrived: true, reading: { pfu: 10, s: 'S1' } })).toBe('arrived · S1');
    expect(messengerValue({ key: 'protons', arrived: false, etaMs: 401e3, reading: null })).toBe('00:06:41');
    expect(messengerValue({ key: 'core', arrivesYear: 172026, arrived: false, reading: null })).toBe('surfaces CE 172 026');
    expect(messengerValue({ key: 'cloud', arrived: false, etaMs: 5000, reading: { phase: 'flight', orientation: null } })).toBe('00:00:05 · unread');
    expect(messengerValue({ key: 'cloud', arrived: false, etaMs: 5000, reading: { phase: 'flight', orientation: 'southward' } })).toBe('00:00:05 · southward');
    expect(messengerValue({ key: 'cloud', arrived: true, reading: { phase: 'landed', fate: 'passed', nT: null } })).toBe('arrived · northward · passed');
  });
  it('pickStackId falls back to the newest when the selection is gone', () => {
    const cs = [{ id: 'a', launchedAt: 1 }, { id: 'b', launchedAt: 3 }, { id: 'c', launchedAt: 2 }];
    expect(pickStackId(cs, 'c')).toBe('c');
    expect(pickStackId(cs, 'gone')).toBe('b');
    expect(pickStackId(cs, null)).toBe('b');
    expect(pickStackId([], 'gone')).toBeNull();
  });
});
