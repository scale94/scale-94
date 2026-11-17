import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_KEY, MAX_IN_FLIGHT, MAX_LOG,
  launchCloud, getClouds, markWitnessed, sweep, snapshotSol, subscribeClouds,
  _resetCloudsForTests,
} from '../cloudStore';
import { cloudStatus } from '../cloudClock';

const H = 3600e3;
const t0 = Date.UTC(2026, 10, 17, 12, 0, 0);
const cw = (energyErg = 5e32, origin = 'hand') => ({ energyErg, handedness: 'cw', origin });

beforeEach(() => _resetCloudsForTests());
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
        mercuryPassed: true, orientation: null,
      }]);
      expect(before.landings).toEqual([]);
      expect(before.lastReleaseErg).toBe(5e32);
      expect(snapshotSol(s.readAt + 1).inFlight[0].orientation).toBe('southward');
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
        },
        expect.objectContaining({ energyErg: 1e31, origin: 'star', orientation: 'northward', fate: 'passed', nT: null }),
      ]);
      expect(snap.lastReleaseErg).toBe(1e31);
    });
  });
});
