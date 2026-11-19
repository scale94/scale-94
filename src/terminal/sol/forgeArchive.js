// forgeArchive.js — what the forge keeps of clouds cloudStore has removed.
// Same discipline as cloudStore: no React, listeners in a Set, whole-object
// persist, every storage call tolerant (refused storage = volatile store).
// Imports forge only; cloudStore imports this, never the reverse.

import { offerings, EMPTY_ARCHIVE } from './forge';

export const FORGE_STORAGE_KEY = 'sol_forge_v1';
export const MAX_FOLDED_IDS = 64;

const mass = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const yearOrNull = (x) => x === null || (typeof x === 'number' && Number.isFinite(x));

const fresh = () => ({ ...EMPTY_ARCHIVE, foldedIds: [] });

function restore() {
  try {
    const raw = globalThis.localStorage?.getItem(FORGE_STORAGE_KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw);
    if (p && typeof p === 'object'
      && mass(p.H) && mass(p.He) && mass(p.C) && mass(p.O)
      && yearOrNull(p.cYear) && yearOrNull(p.oYear)
      && Array.isArray(p.foldedIds) && p.foldedIds.every((s) => typeof s === 'string')) {
      return {
        H: p.H, He: p.He, C: p.C, O: p.O, cYear: p.cYear, oYear: p.oYear,
        foldedIds: p.foldedIds.slice(-MAX_FOLDED_IDS),
      };
    }
  } catch (_) { /* corrupt or unavailable: start empty */ }
  return fresh();
}

let archive = restore();
const listeners = new Set();

const copyOf = (a) => ({ ...a, foldedIds: [...a.foldedIds] });

function persist() {
  try { globalThis.localStorage?.setItem(FORGE_STORAGE_KEY, JSON.stringify(archive)); }
  catch (_) { /* volatile store is acceptable */ }
}

function notify() {
  const c = getForgeArchive();
  listeners.forEach((fn) => { try { fn(c); } catch (_) { /* isolated per listener */ } });
}

export function getForgeArchive() { return copyOf(archive); }

const later = (a, b) => (a === null ? b : Math.max(a, b));

/**
 * Keep what this removed cloud forged: C and O (with their years) always, He
 * and H only once its protons had arrived. Idempotent per cloud id.
 */
export function foldIntoArchive(cloud, now = Date.now()) {
  if (archive.foldedIds.includes(cloud.id)) return;
  const o = offerings(cloud);
  const delivered = Number.isFinite(now) && now >= o.He.deliveredAt;
  archive = {
    H: archive.H + (delivered ? o.H.kg : 0),
    He: archive.He + (delivered ? o.He.kg : 0),
    C: archive.C + o.C.kg,
    O: archive.O + o.O.kg,
    cYear: later(archive.cYear, o.C.year),
    oYear: later(archive.oYear, o.O.year),
    foldedIds: [...archive.foldedIds, cloud.id].slice(-MAX_FOLDED_IDS),
  };
  persist();
  notify();
}

export function subscribeForgeArchive(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function _resetForgeArchiveForTests(opts = {}) {
  if (opts.keepStorage) {
    archive = restore();
  } else {
    try { globalThis.localStorage?.removeItem(FORGE_STORAGE_KEY); }
    catch (_) { /* storage unavailable — nothing to clear */ }
    archive = fresh();
  }
  listeners.clear();
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key !== FORGE_STORAGE_KEY && e.key !== null) return;   // null: storage cleared
    archive = restore();
    notify();
  });
}
