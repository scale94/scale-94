// src/terminal/quintessence/observerStore.js — the eye's agency reducer (spec §5.1–§5.3, §5.5, §5.7, §5.8).
// Bus-adjacent store, same discipline as spineStore: no React,
// listener Sets, per-listener try/catch. Bus and spine activity become impulses
// (transient reactions); flash / glance / whisper / ignition / seal are state.
// Only a hand moves the eye: sim kinds are dropped, mixed kinds pass only with
// `payload.hand`. Every timed rule runs off ONE scheduler timeout, re-armed on
// each state change, so the store's clock is always the injected `now`.
import { subscribe, emit as emitBus } from '../../observatory/observatoryBus';
import { getSpine, subscribeSpine } from './spineStore';
import { loadSealedArtifact } from './sealedArtifact';
import { heldVolatile } from './volatileHold';
import { VERTEBRAE } from './vertebrae';
import { PIECE_TAB, RIDDLES } from './whispers';
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

// Glances (§5.7) and whispers (§5.8).
export const QUIET_MS          = 8000;
export const GLANCE_IN_MS      = 1200;
export const GLANCE_HOLD_MS    = 3000;
export const GLANCE_OUT_MS     = 1500;
export const GLANCE_GAP_MS     = 25000;
export const IDLE_MS           = 13000;
export const COOLDOWN_MIN_MS   = 60000;
export const COOLDOWN_MAX_MS   = 90000;
export const AFTER_REACTION_MS = 2500;
export const WHISPER_MS        = 6000;
export const PHRASE_BUSY_MS    = 5100;
export const MOBILE_HOLD_MS    = 30000;

const TRAIL_KEY = 'observer_trail_v1';
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
const INPUT_OPTS = { capture: true, passive: true };

// kernel.run keeps today's violet x lime "compiling" look (spec §5.2, §5.5), not the /KERNEL cyan.
const COMPILING_VIOLET = [167, 139, 250];
const COMPILING_LIME   = [122, 184, 0];

// Spec §5.2, keyed `category/kind`. `mixed` kinds need `payload.hand === true`.
// The ignition trio and tab_navigated are handled by name in onBus.
const RULES = {
  'transmissions/kernel_loaded':    { piece: 'kernel.load' },
  'transmissions/kernel_completed': { piece: 'kernel.run', tint: COMPILING_VIOLET, tint2: COMPILING_LIME },
  'edge/council_collision':         { piece: 'accretion.collide' }, // tier comes from the spine write
  'essences/collision_fired':       { piece: 'scent.collide' },
  'essences/crystallized':          { piece: 'scent.collide' },
  'gaze/art_resonance':             { piece: 'chaos.pick' },
  'gaze/art_node_selected':         { piece: 'chaos.pick' },
  'gaze/art_bifurcation':           { piece: 'chaos.fork', mixed: true },
  'gaze/art_orthogonal':            { piece: 'chaos.fork', mixed: true },   // right-click: + resonance
  'gaze/ecocide_growth_set':        { piece: 'ecocide.growth' },
  'ciphers/cipher_sealed':          { piece: 'crypto.seal' },
  'ciphers/unlock':                 { piece: 'crypto.seal' },
  'ciphers/key_generated':          { piece: 'crypto.seal', data: { keyed: true } },   // the eye: the held lattice locks
  'ciphers/verify':                 { piece: 'crypto.seal' },
  'transmissions/signal_marked':    { piece: 'transmission.mark' },
  // ledger_appended is left out: the eye wakes once the kernel has ruled (notifyLedger 'audit'),
  // so the murk can be as bad as the audit.
  // verdict_issued is left out: AuditCascade's timer fires it after the append (no hand).
  'gaze/sol_release':               { piece: 'sol.release', mixed: true },
  'gaze/mercury_flick':             { piece: 'mercury.flick' },
  'gaze/mercury_element':           { piece: 'mercury.element', mixed: true },   // a tap that lights an element node
};
// The kernel phrase owns the mei-phrase slot for a while: a whisper waits it out.
const PHRASE_KINDS = new Set(['transmissions/kernel_loaded', 'transmissions/kernel_completed']);

// The three spine vertebrae (the element write belongs to the ignition, never here).
const SPINE_PIECES = { trend: 'bsky.trend', council: 'accretion.collide', phase: 'lunar.phase' };
const VERTEBRA_KEY = Object.fromEntries(Object.entries(SPINE_PIECES).map(([k, p]) => [p, k]));

// Whisper target order (§5.8, D6). altar.ignite is a target only once armed.
const TARGET_ORDER = [
  'mercury.flick',
  ...VERTEBRAE.map(v => SPINE_PIECES[v.key]),
  'scent.collide', 'chaos.pick', 'sol.release', 'crypto.seal', 'ledger.write',
  'transmission.mark', 'ecocide.growth', 'surveillance.privacy', 'kernel.run',
  'altar.ignite',
];

const PIECE_KICK = {
  'kernel.load': KICK.inhale, 'kernel.run': KICK.miosis, 'kernel.enter': KICK.miosis, 'scent.collide': KICK.merge,
  'chaos.pick': KICK.split, 'chaos.fork': KICK.split, 'crypto.seal': KICK.quantize,
  'sol.release': KICK.ring, 'ecocide.growth': KICK.sag, 'ledger.write': KICK.ripple,
  'transmission.mark': KICK.packet, 'surveillance.privacy': KICK.stare,
  'mercury.flick': KICK.shove, 'mercury.element': KICK.inhale, 'accretion.collide': KICK.spiral, 'accretion.infall': KICK.spiral, 'accretion.prime': KICK.spiral,
  'lunar.phase': KICK.sweep, 'bsky.trend': KICK.flutter,
};

// Pieces that react but are not whisper targets, so PIECE_TAB doesn't list them.
const EXTRA_TAB = { 'kernel.load': 'kernel', 'kernel.enter': 'kernel', 'accretion.infall': 'manifesto', 'accretion.prime': 'manifesto',
  'surveillance.lock': 'surveillance', 'surveillance.trace': 'surveillance',
  'crypto.keygen': 'cryptography', 'crypto.release': 'cryptography', 'chaos.fork': 'art',
  'ledger.clear': 'ledger', 'ledger.release': 'ledger', 'mercury.element': 'mercury' };

// A reaction that holds the eye longer than its tier: the whisper clock (forward whisper,
// compass quiet) counts from when the eye is clear again, not from the tier's end.
// ledger.write: murk in + the audit cascade (~3.8 s + the WASM load) + a clear that is slower
// the worse the water (clean water has settled by the time the verdict shows).
export const ledgerSettleMs = (severity) => 5000 + 9000 * (Number.isFinite(severity) ? severity : 0.5);
const PIECE_SETTLE_MS = { 'ledger.write': (imp) => ledgerSettleMs(imp.data?.severity) };

const TIER_RANK = { witness: 0, vertebra: 1, crescendo: 2 };
const TIER_MS = { witness: WITNESS_MS, vertebra: VERTEBRA_MS, crescendo: CRESCENDO_MS };

const emptyTrail = () => ({ touched: {}, spent: {}, idleSpent: {}, lastWhisperAt: null, actedOnce: false });

let flash = null;               // { tab, tint } | null
let flashUntil = 0;             // when the last nav flash ends (0: none yet this run)
let igniting = false;
let sealed = false;
let sealedAt = null;            // this visit's seal (a reload's seal plays no crescendo)
let remarkedSinceSeal = false;
let activeTab = null;           // the tab the visitor stands on
let spine = null;               // the spine as last seen
let active = null;              // { rank, until } of the reaction still playing
let pending = new Map();        // piece → impulse, flushed once per microtask
let flushQueued = false;
let started = false;
let flashTimer = 0;
let tickTimer = 0;              // the one scheduler timeout
let unsubBus = null, unsubSpine = null;
let now = Date.now;
let rng = Math.random;
let trail = emptyTrail();       // session trail; in memory when sessionStorage refuses
let cooldownMs = COOLDOWN_MIN_MS;
let lastInputAt = 0;
let quietFrom = 0;              // the compass quiet window counts from here
let compassEndAt = -Infinity;
let glance = null;              // { tab, tint, shimmer, reason, t0 }
let whisper = null;             // { id, text, piece, until }
let held = null;                // a whisper waiting for the chrome: { id, text, piece, idleTab, since }
let forwardAt = null;           // when the settled reaction may earn a forward whisper
let phraseBusyUntil = 0;
let chromeVisible = true;
let eyeHeld = false;            // a tab drives the eye live (holdEyeQuiet): no glance / whisper starts over it
let heldIdleOk = false;         // ...except that tab's own idle riddle (holdEyeQuiet(true, { idle: true }))
let snap = null;                // built lazily by the first getObserver() (no work at import)
const listeners = new Set();
const impulseListeners = new Set();

function wantsChromeAt(t) {
  // A held whisper asks for the masthead too (D16): App reveals it, setChromeVisible releases it.
  return !!whisper || !!held || igniting || (sealedAt !== null && t < sealedAt + CRESCENDO_MS);
}

function buildSnap() {
  return {
    flash,
    // No phase here: the ease is a pure function of time (glanceLevel), so the store pings
    // only when a glance starts or ends and the eye reads the level per frame.
    glance: glance && {
      tab: glance.tab, tint: glance.tint, shimmer: glance.shimmer, reason: glance.reason, startedAt: glance.t0,
    },
    whisper: whisper && { id: whisper.id, text: whisper.text, piece: whisper.piece },
    igniting, sealed, remarkedSinceSeal,
    wantsChrome: wantsChromeAt(now()),
  };
}

function ping() {
  snap = buildSnap();
  listeners.forEach(fn => { try { fn(snap); } catch (_) { /* noisy subscriber ≠ dead store */ } });
}

// ---- session trail ---------------------------------------------------------

function loadTrail() {
  try {
    const raw = globalThis.sessionStorage?.getItem(TRAIL_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === 'object') {
      const obj = v => (v && typeof v === 'object' ? v : {});
      return {
        touched: obj(saved.touched), spent: obj(saved.spent), idleSpent: obj(saved.idleSpent),
        lastWhisperAt: Number.isFinite(saved.lastWhisperAt) ? saved.lastWhisperAt : null,
        actedOnce: saved.actedOnce === true,
      };
    }
  } catch (_) { /* volatile trail */ }
  return null;
}

function saveTrail() {
  try { globalThis.sessionStorage?.setItem(TRAIL_KEY, JSON.stringify(trail)); }
  catch (_) { /* volatile trail: the in-memory copy still forbids repeats this run */ }
}

function drawCooldown() {
  return COOLDOWN_MIN_MS + rng() * (COOLDOWN_MAX_MS - COOLDOWN_MIN_MS);
}

// ---- pieces ---------------------------------------------------------------

const armed = () => VERTEBRAE.every(v => spine?.[v.key]);

function done(piece) {
  if (trail.touched[piece]) return true;
  const key = VERTEBRA_KEY[piece];
  if (key) return !!spine?.[key];                 // D10: a marked vertebra is never whispered
  if (piece === 'altar.ignite') return sealed;
  return false;
}

const unspent = piece => (RIDDLES[piece] || []).map((_, i) => i).filter(i => !trail.spent[`${piece}:${i}`]);

// The next whisper target: on `onlyTab` (idle) or anywhere but `skipTab` (forward).
function pickPiece({ onlyTab, skipTab }) {
  return TARGET_ORDER.find(piece => {
    const tab = PIECE_TAB[piece];
    if (onlyTab && tab !== onlyTab) return false;
    if (skipTab && tab === skipTab) return false;
    if (piece === 'altar.ignite' && !armed()) return false;
    return !done(piece) && unspent(piece).length > 0;
  }) || null;
}

function riddleFor(piece) {
  const free = unspent(piece);
  const i = free[Math.min(free.length - 1, Math.floor(rng() * free.length))];
  return { id: `${piece}:${i}`, text: RIDDLES[piece][i], piece };
}

function tintOf(piece) {
  if (PIECE_TAB[piece] === 'mercury') return null;   // silver on silver: the motion carries it
  return NAV_TINTS[PIECE_TAB[piece] || EXTRA_TAB[piece]] || null;
}

// ---- reactions -------------------------------------------------------------

// Queue an impulse. Same piece within one microtask → one impulse, highest tier
// (the /ACCRETION spine write + council_collision fire in the same handler).
// The act is recorded here, before the tier gate: a reaction drawn over by a
// higher tier still counts as the visitor's act.
function react(piece, tier, { kind = PIECE_KICK[piece], tint = tintOf(piece), tint2 = null, dir = 1, data = null } = {}) {
  const t = now();
  trail.touched[piece] = true;
  trail.actedOnce = true;
  saveTrail();
  lastInputAt = t;                                 // an act is deliberate input
  const imp = { piece, kind, tier, tint, tint2, dir, durationMs: TIER_MS[tier], at: t, data };
  const prev = pending.get(piece);
  if (!prev || TIER_RANK[tier] > TIER_RANK[prev.tier]) pending.set(piece, imp);
  if (!flushQueued) { flushQueued = true; queueMicrotask(flush); }
}

function flush() {
  flushQueued = false;
  const batch = [...pending.values()];
  pending = new Map();
  for (const imp of batch) publish(imp);
  if (!started || !batch.length) return;
  const settle = active ? active.until : now();
  quietFrom = Math.max(quietFrom, settle);
  forwardAt = settle + AFTER_REACTION_MS;
  if (glance) { endGlance(now()); ping(); }       // a reaction cancels any glance at once
  schedule();
}

function publish(imp) {
  const rank = TIER_RANK[imp.tier];
  // Tier order crescendo > vertebra > witness: a lower tier never interrupts a higher one.
  if (active && imp.at < active.until && rank < active.rank) return;
  const settle = PIECE_SETTLE_MS[imp.piece];
  active = { rank, until: imp.at + (settle ? settle(imp) : imp.durationMs) };
  impulseListeners.forEach(fn => { try { fn(imp); } catch (_) { /* isolated per listener */ } });
}

function onSpine(next) {
  const prev = spine;
  spine = { ...next };
  let remarked = false;
  for (const [key, piece] of Object.entries(SPINE_PIECES)) {
    if (!next[key] || next[key] === prev[key]) continue;
    // First mark of the visit is a vertebra; a re-mark (or one already in the spine, or one
    // the trail already holds from before a refresh) is a witness.
    react(piece, prev[key] || trail.touched[piece] ? 'witness' : 'vertebra');
    remarked = true;
  }
  if (remarked && sealed && !remarkedSinceSeal) { remarkedSinceSeal = true; ping(); }
  schedule();
}

// /SCENT carries the two colliding accords' colours: two [r, g, b] triples, 0..255.
const isRgb = c => Array.isArray(c) && c.length === 3 && c.every(x => Number.isFinite(x) && x >= 0 && x <= 255);
const isRgbPair = cs => Array.isArray(cs) && cs.length === 2 && isRgb(cs[0]) && isRgb(cs[1]);

function onBus({ category, kind, payload }) {
  const p = payload ?? {};
  const key = `${category}/${kind}`;
  if (key === 'edge/kernel_ignited') {
    trail.touched['altar.ignite'] = true;
    saveTrail();
    if (!igniting) { igniting = true; ping(); }
    return;
  }
  if (key === 'edge/kernel_sealed') {
    igniting = false; sealed = true; remarkedSinceSeal = false;
    sealedAt = now();
    ping();
    react('altar.seal', 'crescendo', { kind: 0, tint: null });
    schedule();
    return;
  }
  if (key === 'edge/kernel_ignite_ended') {
    if (igniting) { igniting = false; ping(); }
    publishDirect('altar.release', KICK.watch, null);   // an unsealed ignition lets the Aether go
    return;
  }
  if (key === 'gaze/tab_navigated') {
    // The privacy drawer emits this and never calls notifyNav: the eye looks back. The drawer
    // opens over /SURVEILLANCE, so it is not a place the visitor stands.
    if (p.tab === 'privacy') react('surveillance.privacy', 'witness');
    else if (typeof p.tab === 'string' && p.tab) { activeTab = p.tab; schedule(); }
    return;
  }
  const rule = RULES[key];
  if (!rule) return;
  if (rule.mixed && p.hand !== true) return;
  if (PHRASE_KINDS.has(key)) phraseBusyUntil = now() + PHRASE_BUSY_MS;
  const opts = rule.piece === 'mercury.flick' ? { dir: p.dir < 0 ? -1 : 1 }
    : rule.piece === 'mercury.element' ? { data: { phase: p.phase } }
    : rule.piece === 'scent.collide' && isRgbPair(p.colors) ? { tint: p.colors[0], tint2: p.colors[1] }
    : rule.tint ? { tint: rule.tint, tint2: rule.tint2 }
    : rule.data ? { data: rule.data } : undefined;
  react(rule.piece, 'witness', opts);
}

// ---- glances + whispers ----------------------------------------------------

export const GLANCE_TOTAL_MS = GLANCE_IN_MS + GLANCE_HOLD_MS + GLANCE_OUT_MS;

const smooth01 = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// How far a glance leans in at `t` (D5's slow ease): 0→1 over GLANCE_IN_MS, 1 for the hold,
// 1→0 over GLANCE_OUT_MS, smoothstepped. Pure, so a consumer can evaluate it every frame.
export function glanceLevel(g, t) {
  if (!g || !Number.isFinite(g.startedAt)) return 0;
  const dt = t - g.startedAt;
  if (dt <= 0 || dt >= GLANCE_TOTAL_MS) return 0;
  if (dt < GLANCE_IN_MS) return smooth01(dt / GLANCE_IN_MS);
  if (dt < GLANCE_IN_MS + GLANCE_HOLD_MS) return 1;
  return smooth01(1 - (dt - GLANCE_IN_MS - GLANCE_HOLD_MS) / GLANCE_OUT_MS);
}

function endGlance(t) {
  if (glance?.reason === 'compass') compassEndAt = t;
  glance = null;
}

function startGlance(tab, tint, shimmer, reason, t) {
  if (glance) endGlance(t);
  glance = { tab, tint, shimmer, reason, t0: t };
}

const compassTarget = () => (sealed || armed() ? null : VERTEBRAE.find(v => !spine?.[v.key]) || null);
const cooldownEnd = () => (trail.lastWhisperAt === null ? -Infinity : trail.lastWhisperAt + cooldownMs);

function showWhisper(w, idleTab, t) {
  trail.spent[w.id] = true;
  trail.lastWhisperAt = t;
  if (idleTab) trail.idleSpent[idleTab] = true;
  saveTrail();
  cooldownMs = drawCooldown();
  whisper = { ...w, until: t + WHISPER_MS };
  // Telemetry (spec §5.9), once per shown whisper: from here, not from the indicator, so a
  // remount never re-emits. Deferred: never synchronous inside a caller's render or effect chain.
  const target = w.piece;
  setTimeout(() => emitBus('edge', 'eye_whisper', { target }), 0);
  const tab = PIECE_TAB[w.piece];
  const mercury = tab === 'mercury';
  startGlance(tab, mercury ? null : NAV_TINTS[tab] || null, mercury, 'whisper', t);
}

// A hidden document is treated like hidden chrome: nobody would see the whisper.
const docHidden = () => typeof document !== 'undefined' && document.hidden === true;
const canShow = () => chromeVisible && !docHidden();

function fireWhisper(piece, idleTab, t) {
  const w = riddleFor(piece);
  if (canShow()) showWhisper(w, idleTab, t);
  else held = { ...w, idleTab, since: t };       // wait for the masthead / the tab (not spent)
}

// The chrome or the document came back: a held whisper still in its window shows now.
function releaseHeld() {
  if (!held || !canShow()) return;
  const t = now();
  const w = held;
  held = null;
  if (t < w.since + MOBILE_HOLD_MS) {
    showWhisper({ id: w.id, text: w.text, piece: w.piece }, w.idleTab, t);
    ping();
  }
  schedule();
}

function onVisibility() { if (started) releaseHeld(); }

// No whisper (and its hue) starts until AFTER_REACTION_MS past the last flash: the eye rests
// in silver between the nav hue and the whisper's, instead of jumping from one to the other.
const flashClearAt = () => (flashUntil ? flashUntil + AFTER_REACTION_MS : 0);

const idleEligible = () => !!activeTab && !trail.idleSpent[activeTab] && !!pickPiece({ onlyTab: activeTab });

// Run every rule that is due at `now()`, then re-arm the one timeout.
function tick() {
  tickTimer = 0;
  if (!started) return;
  const t = now();
  const wantedBefore = snap.wantsChrome;
  let changed = false;

  if (glance && t >= glance.t0 + GLANCE_TOTAL_MS) { endGlance(glance.t0 + GLANCE_TOTAL_MS); changed = true; }
  if (whisper && t >= whisper.until) { whisper = null; quietFrom = Math.max(quietFrom, t); changed = true; }
  if (held && t >= held.since + MOBILE_HOLD_MS) {
    held = null;                                   // dropped, never spent
    lastInputAt = t;                               // the idle clock starts over, no tight retry
  }

  // Never during a nav flash (a whisper glance would put a third hue up beside it), nor
  // straight after one.
  if ((!eyeHeld || heldIdleOk) && !whisper && !held && t >= phraseBusyUntil && t >= flashClearAt()) {
    if (!eyeHeld && forwardAt !== null && t >= forwardAt) {
      forwardAt = null;
      const piece = trail.actedOnce && t >= cooldownEnd() ? pickPiece({ skipTab: activeTab }) : null;
      if (piece) { fireWhisper(piece, null, t); changed = true; }
    }
    if (!whisper && !held && t >= lastInputAt + IDLE_MS && t >= cooldownEnd() && idleEligible()) {
      fireWhisper(pickPiece({ onlyTab: activeTab }), activeTab, t);
      changed = true;
    }
  }

  const target = compassTarget();
  if (!eyeHeld && target && !glance && !whisper && !flash
      && t >= quietFrom + QUIET_MS && t >= compassEndAt + GLANCE_GAP_MS) {
    startGlance(target.tab, NAV_TINTS[target.tab], false, 'compass', t);
    changed = true;
  }

  if (sealedAt !== null && t >= sealedAt + CRESCENDO_MS) sealedAt = null;   // the crescendo hold is over
  if (changed || wantsChromeAt(t) !== wantedBefore) ping();
  schedule();
}

function schedule() {
  if (!started) return;
  clearTimeout(tickTimer);
  tickTimer = 0;
  const t = now();
  const due = [];
  if (glance) due.push(glance.t0 + GLANCE_TOTAL_MS);
  if (whisper) due.push(whisper.until);
  if (held) due.push(held.since + MOBILE_HOLD_MS);
  if (sealedAt !== null) due.push(sealedAt + CRESCENDO_MS);
  if (!whisper && !held) {
    if (!eyeHeld && forwardAt !== null) due.push(Math.max(forwardAt, phraseBusyUntil, flashClearAt()));
    if ((!eyeHeld || heldIdleOk) && idleEligible()) due.push(Math.max(lastInputAt + IDLE_MS, cooldownEnd(), phraseBusyUntil, flashClearAt()));
  }
  if (!eyeHeld && compassTarget() && !glance && !whisper) due.push(Math.max(quietFrom + QUIET_MS, compassEndAt + GLANCE_GAP_MS));
  // Every deadline listed here is consumed or moved by tick, so an overdue one runs at 0 ms
  // and cannot spin.
  const next = Math.min(...due.filter(Number.isFinite));
  if (Number.isFinite(next)) tickTimer = setTimeout(tick, Math.max(0, next - t));
}

function onInput() {
  lastInputAt = now();
  schedule();
}

// ---- public ----------------------------------------------------------------

// The first read (a render, before the boot sequence starts the store) already knows a
// reload's seal, so the eye never shows the armed spine's Aether for a frame.
export function getObserver() {
  if (!snap) {
    if (!started) {
      sealed = !!(loadSealedArtifact() || heldVolatile());
      spine = getSpine();
    }
    snap = buildSnap();
  }
  return snap;
}

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
  activeTab = tab ?? null;
  spine = getSpine();
  trail = loadTrail() || trail;
  cooldownMs = drawCooldown();
  const t = now();
  lastInputAt = t;
  quietFrom = t;
  sealed = !!(loadSealedArtifact() || heldVolatile());   // a reload keeps the seal, without a crescendo
  unsubSpine = subscribeSpine(onSpine);
  unsubBus = subscribe(onBus);
  if (typeof window !== 'undefined') INPUT_EVENTS.forEach(ev => window.addEventListener(ev, onInput, INPUT_OPTS));
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  ping();
  schedule();
}

// tty0:~$ Enter with a command: the eye flicks its chip (eyeReactions 'kernel.enter').
// Direct, not via the bus: a keystroke is not telemetry (the journal never sees it).
// /ACCRETION lifecycle -> the eye (eyeReactions: prime / infall held through the flight; the
// synthesis landing, council_collision, is the eject). Off the bus, like tty0.
//   'prime'   first mind armed          (an act)
//   'infall'  second mind fired         (an act)
//   'release' disarm / reset / timeout / tab left: not an act, so it skips react() (no trail,
//             no whisper clock) and goes straight to the eye, which fades the held stage out.
export function notifyAccretion(stage) {
  if (stage === 'prime') return react('accretion.prime', 'witness');
  if (stage === 'infall') return react('accretion.infall', 'witness');
  if (stage === 'release') publishDirect('accretion.release', KICK.spiral, null);
}

// Straight to the eye: no trail, no whisper clock, no tier gate (not the visitor's act, or
// - /SURVEILLANCE - a lattice whose spec keeps every session out of storage).
function publishDirect(piece, kind, data) {
  const imp = { piece, kind, tier: 'witness', tint: tintOf(piece), tint2: null, dir: 1, durationMs: WITNESS_MS, at: now(), data };
  impulseListeners.forEach(fn => { try { fn(imp); } catch (_) { /* isolated per listener */ } });
}

// /CRYPTOGRAPHY: 'keygen' when the pool saturates and ML-KEM key generation starts (the eye
// holds a humming lattice until key_generated seals it); 'release' when the keygen is left
// unfinished. Straight to the eye: the hold is never an act, a release never moves whispers.
export function notifyCrypto(stage) {
  if (stage === 'keygen') publishDirect('crypto.keygen', KICK.watch, null);
  else if (stage === 'release') publishDirect('crypto.release', KICK.watch, null);
}

// /SURVEILLANCE: 'lock' when the visitor picks a source (the eye locks on and holds);
// 'release' when the route is cleared or the tab left;
// 'trace' when a packet is sent, with its route as compass headings + timing (eyeReactions
// builds the gaze path from it). Never react(): the lattice keeps its sessions out of storage.
export function notifySurveillance(stage, data = null) {
  if (stage === 'lock') publishDirect('surveillance.lock', KICK.stare, null);
  else if (stage === 'release') publishDirect('surveillance.release', KICK.stare, null);
  else if (stage === 'trace' && data) publishDirect('surveillance.trace', KICK.watch, data);
}

// /LEDGER: the eye takes the audit's pollution (eyeReactions 'ledger.write'). LedgerTab calls
//   'audit'   once the kernel has ruled on the hand's submit, with the audit's severity 0..1
//             (ledgerSeverity): the act, so it goes through react() (trail, whisper clock)
//   'clear'   when the cascade's verdict lands (the slow clear, slower the worse the water)
//   'release' when the run fails or the tab is left (quick)
// clear / release are not acts: straight to the eye, each only fading a murk that is up.
export function notifyLedger(stage, severity = null) {
  const s = Number.isFinite(severity) ? Math.min(1, Math.max(0, severity)) : null;
  if (stage === 'audit') react('ledger.write', 'witness', { data: { severity: s ?? 0.5 } });
  else if (stage === 'clear') publishDirect('ledger.clear', KICK.watch, { severity: s });
  else if (stage === 'release') publishDirect('ledger.release', KICK.watch, null);
}

// The quintessence compile: QuintessenceAltar calls this as each stage lands (0 SPINE READ …
// 5 SEALED); the eye clicks round like a vault dial and the Aether builds (eyeReactions
// 'altar.stage'). Not an act of its own (the ignition was), so straight to the eye. The seal's
// crescendo takes over from the last stage; an unsealed end (kernel_ignite_ended) releases it.
export function notifyAltarStage(stage) {
  if (!Number.isInteger(stage) || stage < 0 || stage > 5) return;
  publishDirect('altar.stage', KICK.watch, { stage });
}

// A tab driving the eye live (/LUNAR's moon: the scrub, the compile sweep) holds it quiet: a
// glance or whisper would tint and turn the eye over the tab's figure. A glance in progress
// ends at once; nothing new starts until the hold lifts, and then the usual gaps run from
// there (the compass's quiet window, AFTER_REACTION_MS before a forward whisper).
// { idle: true } still lets the held tab's own idle riddle through (/ECOCIDE holds the eye
// from the moment it opens, before the visitor has found the slider the riddle points at).
export function holdEyeQuiet(on, { idle = false } = {}) {
  const v = !!on;
  const idleOk = v && !!idle;
  if (v === eyeHeld && idleOk === heldIdleOk) return;
  const was = eyeHeld;
  eyeHeld = v;
  heldIdleOk = idleOk;
  if (v === was) { schedule(); return; }
  const t = now();
  if (v) {
    if (glance) { endGlance(t); ping(); }
  } else {
    quietFrom = Math.max(quietFrom, t);
    if (forwardAt !== null) forwardAt = Math.max(forwardAt, t + AFTER_REACTION_MS);
  }
  schedule();
}

export function notifyTtyEnter() {
  react('kernel.enter', 'witness');
}

export function notifyNav(tab) {
  const t = now();
  activeTab = tab;
  lastInputAt = t;                                 // a nav click is deliberate input (D11), not an act
  held = null;                                     // a whisper held for the old tab's chrome is moot
  clearTimeout(flashTimer);
  flash = { tab, tint: NAV_TINTS[tab] || NAV_TINTS.mercury };
  flashUntil = t + FLASH_MS;
  quietFrom = Math.max(quietFrom, flashUntil);
  if (forwardAt !== null) forwardAt = Math.max(forwardAt, flashClearAt());   // deferred past the flash, not lost
  if (glance) endGlance(t);                        // a flash cancels a glance, and nothing reasserts it
  flashTimer = setTimeout(() => { flash = null; ping(); }, FLASH_MS);
  ping();
  schedule();
}

// The masthead's visibility (mobile hides it): a held whisper shows when it returns.
export function setChromeVisible(v) {
  chromeVisible = !!v;
  releaseHeld();
}

export function _resetObserverForTests({ random, now: clock } = {}) {
  clearTimeout(flashTimer);
  clearTimeout(tickTimer);
  tickTimer = 0;
  if (unsubBus) { unsubBus(); unsubBus = null; }
  if (unsubSpine) { unsubSpine(); unsubSpine = null; }
  if (typeof window !== 'undefined') INPUT_EVENTS.forEach(ev => window.removeEventListener(ev, onInput, INPUT_OPTS));
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
  flash = null; flashUntil = 0; igniting = false; sealed = false; sealedAt = null; remarkedSinceSeal = false;
  activeTab = null; spine = null; active = null;
  pending = new Map(); flushQueued = false; started = false;
  trail = emptyTrail(); cooldownMs = COOLDOWN_MIN_MS;
  lastInputAt = 0; quietFrom = 0; compassEndAt = -Infinity;
  glance = null; whisper = null; held = null; forwardAt = null;
  phraseBusyUntil = 0; chromeVisible = true; eyeHeld = false; heldIdleOk = false;
  listeners.clear(); impulseListeners.clear();
  now = clock || Date.now;
  rng = random || Math.random;
  snap = null;
}
