import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FORGE_STORAGE_KEY, MAX_FOLDED_IDS, getForgeArchive, foldIntoArchive,
  subscribeForgeArchive, _resetForgeArchiveForTests,
} from '../forgeArchive';
import { offerings, EMPTY_ARCHIVE } from '../forge';

const t0 = Date.UTC(2026, 10, 19, 12);
const mk = (erg, launchedAt = t0, id = 'x') => ({
  id, launchedAt, energyErg: erg, transitMs: 20 * 3600e3, handedness: 'cw', origin: 'hand', witnessed: false,
});

beforeEach(() => _resetForgeArchiveForTests());
afterEach(() => vi.restoreAllMocks());

describe('forgeArchive', () => {
  it('exports its key and bound', () => {
    expect(FORGE_STORAGE_KEY).toBe('sol_forge_v1');
    expect(MAX_FOLDED_IDS).toBe(64);
  });
  it('starts equal to EMPTY_ARCHIVE without sharing it', () => {
    const a = getForgeArchive();
    expect(a).toEqual(EMPTY_ARCHIVE);
    expect(a.foldedIds).not.toBe(EMPTY_ARCHIVE.foldedIds);
  });
  it('fold adds C/O always and He/H only after the protons', () => {
    foldIntoArchive(mk(5e32), t0 + 1);
    const a = getForgeArchive();
    expect(a.He).toBe(0); expect(a.H).toBe(0);
    expect(a.C).toBeGreaterThan(0); expect(a.cYear).toBe(7590002026);
  });
  it('adds He and H once delivered', () => {
    foldIntoArchive(mk(5e32), t0 + 3 * 3600e3);
    const a = getForgeArchive();
    expect(a.He).toBeGreaterThan(0); expect(a.H).toBeGreaterThan(0);
  });
  it('the same cloud folds once, across tabs (Review Focus 1)', () => {
    const c = mk(5e32);
    foldIntoArchive(c, t0 + 3 * 3600e3);
    _resetForgeArchiveForTests({ keepStorage: true });
    foldIntoArchive(c, t0 + 3 * 3600e3);
    expect(getForgeArchive().He).toBeCloseTo(offerings(c).He.kg, -3);
  });
  it('foldedIds keep the newest 64', () => {
    for (let i = 0; i < 70; i++) foldIntoArchive(mk(1e30, t0, `c${i}`), t0);
    expect(getForgeArchive().foldedIds).toHaveLength(64);
    expect(getForgeArchive().foldedIds.at(-1)).toBe('c69');
  });
  it('a corrupt payload restores as empty, never NaN (Review Focus 3)', () => {
    for (const raw of ['{', '"x"', JSON.stringify({ He: 'a', C: NaN, O: -5, foldedIds: 3 }), JSON.stringify(null)]) {
      localStorage.setItem(FORGE_STORAGE_KEY, raw);
      _resetForgeArchiveForTests({ keepStorage: true });
      expect(getForgeArchive()).toEqual(EMPTY_ARCHIVE);
    }
  });
  it('one bad field voids the whole payload', () => {
    localStorage.setItem(FORGE_STORAGE_KEY, JSON.stringify({
      H: 1, He: 1, C: 1, O: 1, cYear: 'x', oYear: null, foldedIds: [],
    }));
    _resetForgeArchiveForTests({ keepStorage: true });
    expect(getForgeArchive()).toEqual(EMPTY_ARCHIVE);
  });
  it('refused storage keeps a volatile archive', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    foldIntoArchive(mk(5e32), t0);
    foldIntoArchive(mk(5e32, t0, 'y'), t0);
    expect(getForgeArchive().foldedIds).toEqual(['x', 'y']);
    expect(getForgeArchive().C).toBeGreaterThan(0);
  });
  it('notifies listeners, isolating a throwing one', () => {
    const seen = vi.fn();
    subscribeForgeArchive(() => { throw new Error('boom'); });
    subscribeForgeArchive(seen);
    foldIntoArchive(mk(5e32), t0);
    expect(seen).toHaveBeenCalledTimes(1);
  });
  it('reloads on a storage event for its key', () => {
    localStorage.setItem(FORGE_STORAGE_KEY, JSON.stringify({
      H: 1, He: 2, C: 3, O: 4, cYear: 5, oYear: 6, foldedIds: ['z'],
    }));
    window.dispatchEvent(new StorageEvent('storage', { key: FORGE_STORAGE_KEY }));
    expect(getForgeArchive().He).toBe(2);
  });
});
