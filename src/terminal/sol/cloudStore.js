// cloudStore.js — the clouds that left the star, kept on this device.
// Bus-adjacent store in the discipline of quintessence/spineStore.js: no
// React, listeners in a Set, localStorage-persisted, and every storage call
// tolerant of storage being unavailable (the store is then volatile).
// Only launch facts are stored; everything else is read from the wall clock
// by cloudClock.cloudStatus.

import { makeCloud, cloudStatus } from './cloudClock';

export const STORAGE_KEY = 'sol_clouds_v1';
export const MAX_IN_FLIGHT = 16;
export const MAX_LOG = 32;

const HANDS = new Set(['cw', 'ccw']);
const ORIGINS = new Set(['hand', 'star']);
const posNum = (x) => typeof x === 'number' && Number.isFinite(x) && x > 0;

function validCloud(c) {
  return !!c && typeof c === 'object'
    && typeof c.id === 'string' && c.id.length > 0
    && posNum(c.launchedAt) && posNum(c.energyErg) && posNum(c.transitMs)
    && HANDS.has(c.handedness) && ORIGINS.has(c.origin);
}

function restore() {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.clouds)) return [];
    return parsed.clouds
      .filter(validCloud)
      .map((c) => ({
        id: c.id, launchedAt: c.launchedAt, energyErg: c.energyErg, transitMs: c.transitMs,
        handedness: c.handedness, origin: c.origin, witnessed: c.witnessed === true,
      }));
  } catch (_) { /* corrupt or unavailable: start empty */ }
  return [];
}

let clouds = restore();
let seq = 0;
const listeners = new Set();

function persist() {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ clouds })); }
  catch (_) { /* volatile store is acceptable */ }
}

function commit(next) {
  clouds = next;
  persist();
  const copy = getClouds();
  listeners.forEach((fn) => {
    // One throwing subscriber must not stop the rest from being notified.
    try { fn(copy); } catch (_) { /* isolated per listener */ }
  });
}

const landed = (c, now) => cloudStatus(c, now).phase === 'landed';

/** Launch order, as copies. */
export function getClouds() {
  return clouds.map((c) => ({ ...c }));
}

/**
 * A new cloud at `now`. Past MAX_IN_FLIGHT unlanded clouds the weakest in
 * flight is dropped (the oldest on a tie), which may be the new one.
 * `transitMs` overrides the energy's transit (DEV hatch only).
 */
export function launchCloud({ energyErg, handedness, origin, transitMs }, now = Date.now()) {
  seq += 1;
  const id = `${Math.round(now).toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const cloud = makeCloud({ energyErg, handedness, origin }, now, id);
  if (posNum(transitMs)) cloud.transitMs = Math.round(transitMs);

  let next = [...clouds, cloud];
  const flying = next.filter((c) => !landed(c, now));
  if (flying.length > MAX_IN_FLIGHT) {
    let weakest = flying[0];
    for (const c of flying) if (c.energyErg < weakest.energyErg) weakest = c;
    next = next.filter((c) => c !== weakest);
  }
  commit(next);
  return { ...cloud };
}

/** The visitor saw this cloud's storm. Persisted; a no-op when already marked or unknown. */
export function markWitnessed(id) {
  const i = clouds.findIndex((c) => c.id === id);
  if (i < 0 || clouds[i].witnessed) return;
  const next = clouds.slice();
  next[i] = { ...next[i], witnessed: true };
  commit(next);
}

/** Keeps every cloud not yet landed, plus the newest MAX_LOG landed (by arrival). */
export function sweep(now = Date.now()) {
  const done = clouds.filter((c) => landed(c, now));
  if (done.length <= MAX_LOG) return;
  const arrival = (c) => c.launchedAt + c.transitMs;
  const keep = new Set(done.sort((a, b) => arrival(b) - arrival(a)).slice(0, MAX_LOG));
  commit(clouds.filter((c) => !landed(c, now) || keep.has(c)));
}

/**
 * What the Altar may know at `now`; null when the store holds no cloud.
 * An unread cloud carries orientation null: nothing ahead of the clock leaks.
 */
export function snapshotSol(now = Date.now()) {
  if (clouds.length === 0) return null;
  const inFlight = [];
  const landings = [];
  for (const c of clouds) {
    const s = cloudStatus(c, now);
    if (s.phase === 'flight') {
      inFlight.push({
        launchedAt: c.launchedAt, arrivalAt: s.arrivalAt, energyErg: c.energyErg,
        origin: c.origin, mercuryPassed: s.mercuryPassed, orientation: s.orientation,
      });
    } else {
      landings.push({
        launchedAt: c.launchedAt, arrivedAt: s.arrivalAt, energyErg: c.energyErg, origin: c.origin,
        orientation: s.orientation, fate: s.fate, nT: s.fate === 'passed' ? null : s.stormNt,
      });
    }
  }
  return { inFlight, landings, lastReleaseErg: clouds[clouds.length - 1].energyErg };
}

export function subscribeClouds(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function _resetCloudsForTests(opts = {}) {
  if (opts.keepStorage) {
    clouds = restore();
  } else {
    try { globalThis.localStorage?.removeItem(STORAGE_KEY); }
    catch (_) { /* storage unavailable — nothing to clear */ }
    clouds = [];
  }
  listeners.clear();
}

// DEV escape hatch: without it a landing cannot be seen without waiting a
// day. Stripped from production builds.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__sol = {
    launchCloud,
    getClouds,
    launchTest: ({ transitMs = 20000, handedness = 'cw', energyErg = 5e32 } = {}) =>
      launchCloud({ energyErg, handedness, origin: 'hand', transitMs }),
  };
}
