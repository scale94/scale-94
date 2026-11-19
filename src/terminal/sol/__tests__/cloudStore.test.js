import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_KEY, MAX_IN_FLIGHT, MAX_LOG,
  launchCloud, getClouds, markWitnessed, sweep, snapshotSol, subscribeClouds,
  _resetCloudsForTests,
} from '../cloudStore';
import { cloudStatus } from '../cloudClock';
import { forgeLedger, offerings } from '../forge';
import { getForgeArchive, _resetForgeArchiveForTests } from '../forgeArchive';

const H = 3600e3;
const t0 = Date.UTC(2026, 10, 17, 12, 0, 0);
const cw = (energyErg = 5e32, origin = 'hand') => ({ energyErg, handedness: 'cw', origin });

beforeEach(() => { _resetCloudsForTests(); _resetForgeArchiveForTests(); });
afterEach(() => vi.restoreAllMocks());

describe('cloudStore', () => {
  it('exports its limits', () => {
    expect(STORAGE_KEY).toBe('sol_clouds_v1');
    expect(MAX_IN_FLIGHT).toBe(16);
    expect(MAX_LOG).toBe(32);
  });

  it('persists a launch across a reload', () => {
    const c = launchCloud(cw(), t0);
    _resetCloudsForTests({ keepStorage: true });
    expect(getClouds()).toEqual([c]);
  });

  it('gives each cloud a distinct id, and getClouds returns a copy', () => {
    const a = launchCloud(cw(), t0);
    const b = launchCloud(cw(), t0);
    expect(a.id).not.toBe(b.id);
    const list = getClouds();
    list.pop();
    list[0].witnessed = true;
    expect(getClouds()).toHaveLength(2);
    expect(getClouds()[0].witnessed).toBe(false);
  });

  it('a 17th in-flight launch drops the weakest in flight and keeps 16', () => {
    for (let i = 0; i < 16; i++) launchCloud(cw(1e31 + i * 1e30), t0 + i);
    launchCloud(cw(5e32), t0 + 20);
    const left = getClouds();
    expect(left).toHaveLength(16);
    expect(left.some((c) => c.energyErg === 1e31)).toBe(false);
    expect(left.at(-1).energyErg).toBe(5e32);
  });

  it('landed clouds do not count against the in-flight limit', () => {
    for (let i = 0; i < 16; i++) launchCloud(cw(), t0);
    launchCloud(cw(), t0 + 200 * H);
    expect(getClouds()).toHaveLength(17);
  });

  it('sweep keeps every unlanded cloud plus the newest 32 landed', () => {
    // 40 h apart: each strong cloud (17.6 h transit + 12 h storm) has landed before the next
    for (let i = 0; i < 40; i++) launchCloud(cw(), t0 + i * 40 * H);
    const end = t0 + 2000 * H;
    const inFlight = launchCloud(cw(), end);
    expect(getClouds()).toHaveLength(41);
    sweep(end);
    const left = getClouds();
    expect(left).toHaveLength(33);
    expect(left.some((c) => c.id === inFlight.id)).toBe(true);
    // the eight oldest landings are gone
    expect(Math.min(...left.map((c) => c.launchedAt))).toBe(t0 + 8 * 40 * H);
    _resetCloudsForTests({ keepStorage: true });
    expect(getClouds()).toHaveLength(33);
  });

  it('markWitnessed persists and is idempotent', () => {
    const c = launchCloud(cw(), t0);
    const fn = vi.fn();
    subscribeClouds(fn);
    markWitnessed(c.id);
    markWitnessed(c.id);
    markWitnessed('nope');
    expect(fn).toHaveBeenCalledTimes(1);
    _resetCloudsForTests({ keepStorage: true });
    expect(getClouds()[0].witnessed).toBe(true);
  });

  it('subscribers fire on launch; a throwing one does not stop the next', () => {
    const bad = vi.fn(() => { throw new Error('x'); });
    const good = vi.fn();
    subscribeClouds(bad);
    const off = subscribeClouds(good);
    launchCloud(cw(), t0);
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
    off();
    launchCloud(cw(), t0);
    expect(good).toHaveBeenCalledTimes(1);
  });

  describe.each([
    ['{not json'],
    ['[]'],
    ['{"clouds":[{"id":1}]}'],
    ['{"clouds":"x"}'],
    ['null'],
  ])('restoring %s (Review Focus 2)', (raw) => {
    it('starts empty and still launches', () => {
      localStorage.setItem(STORAGE_KEY, raw);
      _resetCloudsForTests({ keepStorage: true });
      expect(getClouds()).toEqual([]);
      launchCloud(cw(), t0);
      expect(getClouds()).toHaveLength(1);
    });
  });

  it('keeps the valid clouds of a partly corrupt record', () => {
    const good = launchCloud(cw(), t0);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    stored.clouds.push({ id: 'b', launchedAt: 'soon' }, { ...good, id: 'c', handedness: 'left' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    _resetCloudsForTests({ keepStorage: true });
    expect(getClouds()).toEqual([good]);
  });

  it('survives storage that throws on read and write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    _resetCloudsForTests({ keepStorage: true });
    expect(getClouds()).toEqual([]);
    launchCloud(cw(), t0);
    expect(getClouds()).toHaveLength(1);
  });

  describe('snapshotSol', () => {
    it('is null for an empty store', () => {
      expect(snapshotSol(t0)).toBeNull();
    });

    it('hides the orientation before the read moment', () => {
      const c = launchCloud(cw(), t0);
      const s = cloudStatus(c, t0);
      const before = snapshotSol(s.readAt - 1);
      expect(before.inFlight).toEqual([{
        launchedAt: t0, arrivalAt: s.arrivalAt, energyErg: 5e32, origin: 'hand',
        mercuryPassed: true, orientation: null, neutrinos: 'undetected', xray: 'X45', protons: 'S5',
      }]);
      expect(before.landings).toEqual([]);
      expect(before.lastReleaseErg).toBe(5e32);
      expect(snapshotSol(s.readAt + 1).inFlight[0].orientation).toBe('southward');
    });

    it('snapshot carries messenger readings only after arrival, and the forge', () => {
      launchCloud(cw(5e32), t0);
      const early = snapshotSol(t0 + 1);
      expect(early.inFlight[0]).toMatchObject({ neutrinos: null, xray: null, protons: null });
      expect(early.forge.He).toBe(0);
      const later = snapshotSol(t0 + 3 * H);
      expect(later.inFlight[0]).toMatchObject({ neutrinos: 'undetected', xray: 'X45', protons: 'S5' });
      expect(later.forge.He).toBeGreaterThan(0);
    });

    it('reports landings with their fate and nT', () => {
      const coupled = launchCloud(cw(5e32), t0);
      launchCloud({ energyErg: 1e31, handedness: 'ccw', origin: 'star' }, t0 + 1);
      markWitnessed(coupled.id);
      const snap = snapshotSol(t0 + 200 * H);
      expect(snap.inFlight).toEqual([]);
      expect(snap.landings).toEqual([
        {
          launchedAt: t0, arrivedAt: cloudStatus(coupled, t0).arrivalAt, energyErg: 5e32, origin: 'hand',
          orientation: 'southward', fate: 'coupled', nT: -1200,
          neutrinos: 'undetected', xray: 'X45', protons: 'S5',
        },
        expect.objectContaining({ energyErg: 1e31, origin: 'star', orientation: 'northward', fate: 'passed', nT: null }),
      ]);
      expect(snap.lastReleaseErg).toBe(1e31);
    });
  });
});

describe('another tab writes the store', () => {
  it('re-reads it, notifies, and a later launch here keeps the other tab\'s clouds', () => {
    const mine = launchCloud(cw(), t0);
    const theirs = { ...mine, id: 'other-tab-cloud', launchedAt: t0 + 5 };
    const raw = JSON.stringify({ clouds: [mine, theirs] });
    localStorage.setItem(STORAGE_KEY, raw);
    const fn = vi.fn();
    subscribeClouds(fn);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: raw }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(getClouds().map((c) => c.id)).toEqual([mine.id, 'other-tab-cloud']);
    launchCloud(cw(), t0 + 10);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).clouds).toHaveLength(3);
  });

  it('ignores other keys', () => {
    const fn = vi.fn();
    subscribeClouds(fn);
    window.dispatchEvent(new StorageEvent('storage', { key: 'something_else', newValue: '1' }));
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('cloudStore forge folds', () => {
  it('sweep folds each removed landed cloud into the forge archive', () => {
    for (let i = 0; i < 40; i++) launchCloud(cw(), t0 + i * 40 * H);
    sweep(t0 + 2000 * H);
    expect(getForgeArchive().foldedIds).toHaveLength(8);
    expect(getForgeArchive().He).toBeGreaterThan(0);
  });

  it('a cap-dropped cloud folds C/O, and He only if its protons had arrived', () => {
    for (let i = 0; i < 16; i++) launchCloud(cw(1e31 + i * 1e30), t0);
    launchCloud(cw(5e32), t0 + 20);
    const a = getForgeArchive();
    expect(a.C).toBeGreaterThan(0);
    expect(a.He).toBe(0);
  });

  describe('archive conservation', () => {
    const ledger = (now) => forgeLedger(getClouds(), getForgeArchive(), now);
    const close = (a, b) => (a === 0 ? expect(b).toBe(0) : expect(Math.abs(a - b) / a).toBeLessThan(1e-9));

    it('sweep removing landed clouds leaves the ledger unchanged', () => {
      for (let i = 0; i < 40; i++) {
        launchCloud(cw(1e32 + i * 1e30), t0 + i * 1000);
      }
      const now = t0 + 100 * H;
      const before = ledger(now);
      sweep(now);
      expect(getClouds().length).toBeLessThan(40);
      const after = ledger(now);
      for (const k of ['H', 'He', 'heOwed', 'C', 'O']) close(before[k], after[k]);
    });

    it('a cap drop keeps C and O and releases the dropped cloud owed helium', () => {
      for (let i = 0; i < 16; i++) launchCloud(cw(2e32 + i * 1e30), t0 + i);
      const now = t0 + 20;
      const before = ledger(now);
      const weakest = getClouds().reduce((w, c) => (c.energyErg < w.energyErg ? c : w));
      const owed = offerings(weakest).He.kg;
      const mid = launchCloud(cw(5e32), now);
      const added = offerings(mid);
      const after = ledger(now);
      expect(getClouds().some((c) => c.id === weakest.id)).toBe(false);
      close(before.C + added.C.kg, after.C);
      close(before.O + added.O.kg, after.O);
      close(before.He + before.heOwed + added.He.kg - owed, after.He + after.heOwed);
      close(before.H, after.H);
    });
  });
});
