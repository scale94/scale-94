// src/terminal/quintessence/guidanceStore.js — the yellow-prop picker (spec §3).
// Bus-adjacent store, same discipline as spineStore: no React, listener Set.
// Ambient mode teaches ONLY the four element houses. Eligibility = untouched
// spine and no sealed kernel; the store goes dormant the moment the journey
// starts and never nags — a mandatory rest interlude follows every suggestion.
import { getSpine, subscribeSpine } from './spineStore';
import { STORAGE_KEY } from './sealedArtifact';

// One hue vocabulary for the whole guidance layer (mirror-flash needs all tabs).
export const NAV_TINTS = {
  kernel: [6, 182, 212],    bsky: [56, 189, 248],     manifesto: [139, 92, 246],
  transmission: [168, 85, 247], scaling: [217, 70, 239], privacy: [244, 63, 94],
  surveillance: [239, 68, 68], cryptography: [249, 115, 22], art: [255, 176, 32],
  ecocide: [122, 184, 0],   lunar: [139, 92, 246],    ledger: [20, 184, 166],
  mercury: [192, 192, 192],
};

// The element curriculum (keystone): FIRE=art, AIR=transmission, WATER=ledger, EARTH=ecocide.
export const ELEMENT_HOUSES = ['art', 'transmission', 'ledger', 'ecocide'];

const INITIAL_REST_MS = 15000;
const SUGGEST_MS      = 20000;
const REST_MIN_MS     = 40000;
const REST_MAX_MS     = 70000;
const FLASH_MS        = 1500;

let suggestion = null;      // { tab, tint } | null
let flash = null;           // { tab, tint } | null
let activeTab = null;       // last navigated tab — never suggest where the visitor stands
let lastSuggested = null;   // no immediate repeats
let started = false;
let timer = 0, flashTimer = 0;
let unsubSpine = null;
let rng = Math.random;
const listeners = new Set();

function ping() {
  const snap = getGuidance();
  listeners.forEach(fn => { try { fn(snap); } catch (_) { /* noisy subscriber ≠ dead store */ } });
}

function eligible() {
  const s = getSpine();
  if (s.trend || s.council || s.phase || s.element) return false;
  try { if (globalThis.localStorage?.getItem(STORAGE_KEY)) return false; } catch (_) { /* volatile is fine */ }
  return true;
}

function pickHouse() {
  let pool = ELEMENT_HOUSES.filter(t => t !== activeTab && t !== lastSuggested);
  if (pool.length === 0) pool = ELEMENT_HOUSES.filter(t => t !== activeTab);
  return pool[Math.floor(rng() * pool.length)];
}

function scheduleRest(ms) {
  clearTimeout(timer);
  timer = setTimeout(beginSuggestion, ms);
}

function beginSuggestion() {
  if (!eligible()) { goDormant(); return; }
  const tab = pickHouse();
  lastSuggested = tab;
  suggestion = { tab, tint: NAV_TINTS[tab] };
  ping();
  clearTimeout(timer);
  timer = setTimeout(endSuggestion, SUGGEST_MS);
}

function endSuggestion() {
  suggestion = null;
  ping();
  scheduleRest(REST_MIN_MS + Math.floor(rng() * (REST_MAX_MS - REST_MIN_MS)));
}

function goDormant() {
  clearTimeout(timer);
  if (suggestion) { suggestion = null; ping(); }
}

function onSpine() {
  if (!eligible()) goDormant();
  else if (!suggestion) scheduleRest(INITIAL_REST_MS); // spine reset → re-enter gently
}

export function getGuidance() { return { suggestion, flash }; }

export function subscribeGuidance(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function startGuidance() {
  if (started) return;
  started = true;
  unsubSpine = subscribeSpine(onSpine);
  if (eligible()) scheduleRest(INITIAL_REST_MS);
}

export function notifyNav(tab) {
  activeTab = tab;
  clearTimeout(flashTimer);
  flash = { tab, tint: NAV_TINTS[tab] || NAV_TINTS.mercury };
  flashTimer = setTimeout(() => { flash = null; ping(); }, FLASH_MS);
  if (suggestion && suggestion.tab === tab) {
    // Invitation accepted — withdraw and rest. No ledger entry (fork-of-will is out of scope).
    suggestion = null;
    clearTimeout(timer);
    scheduleRest(REST_MIN_MS + Math.floor(rng() * (REST_MAX_MS - REST_MIN_MS)));
  }
  ping();
}

export function _resetGuidanceForTests({ random } = {}) {
  clearTimeout(timer); clearTimeout(flashTimer);
  if (unsubSpine) { unsubSpine(); unsubSpine = null; }
  suggestion = null; flash = null; activeTab = null; lastSuggested = null;
  started = false; listeners.clear();
  rng = random || Math.random;
}
