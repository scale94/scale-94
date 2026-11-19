import { describe, it, expect, vi } from 'vitest';
import { formatKg, forgeRows, readHudView, writeHudView, HUD_VIEW_KEY, formatYear, formatClock, messengerValue, pickStackId, MESSENGER_LABEL } from '../hudFormat';

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

describe('hudFormat FORGE', () => {
  it('formatKg', () => {
    expect(formatKg(7.82e10)).toBe('7.8e10 kg');
    expect(formatKg(0)).toBe('—');
    expect(formatKg(NaN)).toBe('—');
    expect(formatKg(-3)).toBe('—');
  });
  it('forgeRows before any snap: five rows, dashes, Au dark and empty', () => {
    const rows = forgeRows(null);
    expect(rows.map((r) => r.symbol)).toEqual(['H', 'He', 'C', 'O', 'Au']);
    expect(rows[1].value).toBe('—');
    expect(rows[4]).toEqual({ symbol: 'Au', z: 79, label: '79', value: '', year: null, dark: true });
  });
  it('forgeRows with a ledger', () => {
    const rows = forgeRows({ H: 7.82e10, He: 7.76e10, heOwed: 0, C: 8.55e11, O: 1.16e12, cYear: 7590002026, oYear: 7700002026, any: true });
    expect(rows[0]).toMatchObject({ label: 'spent', value: '7.8e10 kg' });
    expect(rows[1]).toMatchObject({ label: '2', value: '7.8e10 kg' });
    expect(rows[3]).toMatchObject({ label: '8', value: '1.2e12 kg', year: formatYear(7700002026) });
    expect(rows[2]).toMatchObject({ value: '8.6e11 kg', year: 'CE 7 590 002 026' });
  });
  it('hud view storage: default clocks, round trip, unknown, throwing', () => {
    localStorage.removeItem(HUD_VIEW_KEY);
    expect(readHudView()).toBe('clocks');
    writeHudView('forge');
    expect(readHudView()).toBe('forge');
    localStorage.setItem(HUD_VIEW_KEY, 'bogus');
    expect(readHudView()).toBe('clocks');
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    expect(readHudView()).toBe('clocks');
    spy.mockRestore();
    const spy2 = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    expect(() => writeHudView('forge')).not.toThrow();
    spy2.mockRestore();
    localStorage.removeItem(HUD_VIEW_KEY);
  });
});
