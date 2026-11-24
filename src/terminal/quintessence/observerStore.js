// src/terminal/quintessence/observerStore.js — the eye's agency reducer (spec §5.1, §5.2, §5.5).
// Bus-adjacent store, same discipline as spineStore / guidanceStore: no React,
// listener Sets, per-listener try/catch. Bus and spine activity become impulses
// (transient reactions); flash / ignition / seal are state. Only a hand moves
// the eye: sim kinds are dropped, mixed kinds pass only with `payload.hand`.
import { subscribe } from '../../observatory/observatoryBus';
import { getSpine, subscribeSpine } from './spineStore';
import { loadSealedArtifact } from './sealedArtifact';
import { heldVolatile } from './volatileHold';
import { PIECE_TAB } from './whispers';
import { KICK } from '../components/observerEyeShader';

// One hue vocabulary for the whole guidance layer (mirror-flash needs all tabs).
export const NAV_TINTS = {
  kernel: [6, 182, 212],    bsky: [56, 189, 248],     manifesto: [139, 92, 246],
  transmission: [168, 85, 247], scaling: [217, 70, 239], privacy: [244, 63, 94],
  surveillance: [239, 68, 68], cryptography: [249, 115, 22], art: [255, 176, 32],
  ecocide: [122, 184, 0],   lunar: [139, 92, 246],    ledger: [20, 184, 166],
  mercury: [192, 192, 192], sol: [254, 249, 195],   // sol: yellow-100, the nav's own /SOL hue
};

export const FLASH_MS     = 1500;
export const WITNESS_MS   = 1100;
export const VERTEBRA_MS  = 2200;
export const CRESCENDO_MS = 5600;

// Spec §5.2, keyed `category/kind`. `mixed` kinds need `payload.hand === true`.
// The ignition trio and tab_navigated are handled by name in onBus.
const RULES = {
  'transmissions/kernel_loaded':    { piece: 'kernel.load' },
  'transmissions/kernel_completed': { piece: 'kernel.run' },
  'edge/council_collision':         { piece: 'accretion.collide' }, // tier comes from the spine write
  'essences/collision_fired':       { piece: 'scent.collide' },
  'essences/crystallized':          { piece: 'scent.collide' },
  'gaze/art_resonance':             { piece: 'chaos.pick' },
  'gaze/art_node_selected':         { piece: 'chaos.pick' },
  'gaze/art_bifurcation':           { piece: 'chaos.fork', mixed: true },
  'gaze/ecocide_growth_set':        { piece: 'ecocide.growth' },
  'ciphers/cipher_sealed':          { piece: 'crypto.seal' },
  'ciphers/unlock':                 { piece: 'crypto.seal' },
  'ciphers/key_generated':          { piece: 'crypto.seal' },
  'ciphers/verify':                 { piece: 'crypto.seal' },
  'transmissions/signal_marked':    { piece: 'transmission.mark' },
  'transmissions/ledger_appended':  { piece: 'ledger.write' },
  'transmissions/verdict_issued':   { piece: 'ledger.write' },
  'gaze/sol_release':               { piece: 'sol.release', mixed: true },
  'gaze/mercury_flick':             { piece: 'mercury.flick' },
};

// The three spine vertebrae (the element write belongs to the ignition, never here).
const SPINE_PIECES = { trend: 'bsky.trend', council: 'accretion.collide', phase: 'lunar.phase' };

const PIECE_KICK = {
  'kernel.load': KICK.inhale, 'kernel.run': KICK.miosis, 'scent.collide': KICK.merge,
  'chaos.pick': KICK.split, 'chaos.fork': KICK.split, 'crypto.seal': KICK.quantize,
  'sol.release': KICK.ring, 'ecocide.growth': KICK.sag, 'ledger.write': KICK.ripple,
  'transmission.mark': KICK.packet, 'surveillance.privacy': KICK.stare,
  'mercury.flick': KICK.shove, 'accretion.collide': KICK.spiral,
  'lunar.phase': KICK.sweep, 'bsky.trend': KICK.flutter,
};

// Pieces that react but are not whisper targets, so PIECE_TAB doesn't list them.
const EXTRA_TAB = { 'kernel.load': 'kernel', 'chaos.fork': 'art' };

const TIER_RANK = { witness: 0, vertebra: 1, crescendo: 2 };
const TIER_MS = { witness: WITNESS_MS, vertebra: VERTEBRA_MS, crescendo: CRESCENDO_MS };

let flash = null;               // { tab, tint } | null
let igniting = false;
let sealed = false;
let remarkedSinceSeal = false;
let _activeTab = null;          // the tab the visitor stands on (glances read it in Task 5)
let marked = new Set();         // vertebra keys marked within this store's life (Task 5 → trail)
let prevSpine = null;
let active = null;              // { rank, until } of the reaction still playing
let pending = new Map();        // piece → impulse, flushed once per macrotask
let flushQueued = false;
let started = false;
let flashTimer = 0;
let unsubBus = null, unsubSpine = null;
let now = Date.now;
let _rng = Math.random;         // glance / whisper picks (Task 5)
let snap = buildSnap();
const listeners = new Set();
const impulseListeners = new Set();

function buildSnap() {
  return { flash, glance: null, whisper: null, igniting, sealed, remarkedSinceSeal, wantsChrome: false };
}

function ping() {
  snap = buildSnap();
  listeners.forEach(fn => { try { fn(snap); } catch (_) { /* noisy subscriber ≠ dead store */ } });
}

function tintOf(piece) {
  if (piece === 'mercury.flick') return null;   // silver on silver: the motion carries it
  return NAV_TINTS[PIECE_TAB[piece] || EXTRA_TAB[piece]] || null;
}

// Queue an impulse. Same piece within one macrotask → one impulse, highest tier
// (the /ACCRETION spine write + council_collision fire in the same handler).
function react(piece, tier, { kind = PIECE_KICK[piece], tint = tintOf(piece), dir = 1 } = {}) {
  const imp = { piece, kind, tier, tint, dir, durationMs: TIER_MS[tier], at: now() };
  const prev = pending.get(piece);
  if (!prev || TIER_RANK[tier] > TIER_RANK[prev.tier]) pending.set(piece, imp);
  if (!flushQueued) { flushQueued = true; queueMicrotask(flush); }
}

function flush() {
  flushQueued = false;
  const batch = [...pending.values()];
  pending = new Map();
  for (const imp of batch) publish(imp);
}

function publish(imp) {
  const rank = TIER_RANK[imp.tier];
  // Tier order crescendo > vertebra > witness: a lower tier never interrupts a higher one.
  if (active && imp.at < active.until && rank < active.rank) return;
  active = { rank, until: imp.at + imp.durationMs };
  impulseListeners.forEach(fn => { try { fn(imp); } catch (_) { /* isolated per listener */ } });
}

function onSpine(spine) {
  const prev = prevSpine;
  prevSpine = { ...spine };
  let remarked = false;
  for (const [key, piece] of Object.entries(SPINE_PIECES)) {
    if (!spine[key] || spine[key] === prev[key]) continue;
    react(piece, marked.has(key) ? 'witness' : 'vertebra');
    marked.add(key);
    remarked = true;
  }
  if (remarked && sealed && !remarkedSinceSeal) { remarkedSinceSeal = true; ping(); }
}

function onBus({ category, kind, payload = {} }) {
  const key = `${category}/${kind}`;
  if (key === 'edge/kernel_ignited') { igniting = true; ping(); return; }
  if (key === 'edge/kernel_sealed') {
    igniting = false; sealed = true; remarkedSinceSeal = false;
    ping();
    react('altar.seal', 'crescendo', { kind: 0, tint: null });
    return;
  }
  if (key === 'edge/kernel_ignite_ended') { if (igniting) { igniting = false; ping(); } return; }
  if (key === 'gaze/tab_navigated') {
    // The privacy drawer emits this and never calls notifyNav: the eye looks back.
    if (payload.tab === 'privacy') react('surveillance.privacy', 'witness');
    return;
  }
  const rule = RULES[key];
  if (!rule) return;
  if (rule.mixed && payload.hand !== true) return;
  react(rule.piece, 'witness', rule.piece === 'mercury.flick' ? { dir: payload.dir < 0 ? -1 : 1 } : undefined);
}

export function getObserver() { return snap; }

export function subscribeObserver(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function subscribeImpulse(fn) {
  impulseListeners.add(fn);
  return () => impulseListeners.delete(fn);
}

export function startObserver({ tab } = {}) {
  if (started) return;
  started = true;
  _activeTab = tab ?? null;
  prevSpine = getSpine();
  // Vertebrae already in the spine are not first marks: re-marking them is a witness.
  for (const key of Object.keys(SPINE_PIECES)) if (prevSpine[key]) marked.add(key);
  sealed = !!(loadSealedArtifact() || heldVolatile());   // a reload keeps the seal, without a crescendo
  unsubSpine = subscribeSpine(onSpine);
  unsubBus = subscribe(onBus);
  ping();
}

export function notifyNav(tab) {
  _activeTab = tab;
  clearTimeout(flashTimer);
  flash = { tab, tint: NAV_TINTS[tab] || NAV_TINTS.mercury };
  flashTimer = setTimeout(() => { flash = null; ping(); }, FLASH_MS);
  ping();
}

export function _resetObserverForTests({ random, now: clock } = {}) {
  clearTimeout(flashTimer);
  if (unsubBus) { unsubBus(); unsubBus = null; }
  if (unsubSpine) { unsubSpine(); unsubSpine = null; }
  flash = null; igniting = false; sealed = false; remarkedSinceSeal = false;
  _activeTab = null; marked = new Set(); prevSpine = null; active = null;
  pending = new Map(); flushQueued = false; started = false;
  listeners.clear(); impulseListeners.clear();
  now = clock || Date.now;
  _rng = random || Math.random;
  snap = buildSnap();
}
