// interceptLattice.js — the pure model behind the /SURVEILLANCE intercept lattice
// (docs/superpowers/specs/2026-09-25-surveillance-intercept-lattice-design.md).
// No React, no GL, no DOM. It reads the legislation corpus and never writes it;
// it never touches the panopticon store (spec §1).

// ── Nodes ────────────────────────────────────────────────────────────────────
// The EU is not a node: its laws apply to the member nodes (spec §2).
// lonlat + nudge are the positions the old threat map used; nudges spread the
// dense European cluster without distorting the projection.
export const NODES = [
  { id: 'US', name: 'united states',  location: 'United States',  lonlat: [-98, 38],   nudge: [0, 0] },
  { id: 'CA', name: 'canada',         location: 'Canada',         lonlat: [-96, 60],   nudge: [0, 0] },
  { id: 'UK', name: 'united kingdom', location: 'United Kingdom', lonlat: [-3, 54],    nudge: [-14, -16] },
  { id: 'IE', name: 'ireland',        location: 'Ireland',        lonlat: [-8, 53],    nudge: [-30, 2] },
  { id: 'FR', name: 'france',         location: 'France',         lonlat: [2, 46],     nudge: [-10, 22] },
  { id: 'BE', name: 'belgium',        location: 'Belgium',        lonlat: [4, 50.8],   nudge: [-2, 14] },
  { id: 'NL', name: 'netherlands',    location: 'Netherlands',    lonlat: [5.3, 52.1], nudge: [8, -18] },
  { id: 'DE', name: 'germany',        location: 'Germany',        lonlat: [10, 51],    nudge: [20, -8] },
  { id: 'SE', name: 'sweden',         location: 'Sweden',         lonlat: [15, 62],    nudge: [6, -22] },
  { id: 'AU', name: 'australia',      location: 'Australia',      lonlat: [134, -25],  nudge: [0, 0] },
  { id: 'NZ', name: 'new zealand',    location: 'New Zealand',    lonlat: [172, -41],  nudge: [0, 0] },
];
export const NODE_IDS = NODES.map((n) => n.id);
export const EU_MEMBERS = ['IE', 'FR', 'BE', 'NL', 'DE', 'SE'];

const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
const NODE_BY_LOCATION = Object.fromEntries(NODES.map((n) => [n.location, n.id]));

export const nodeName = (id) => NODE_BY_ID[id]?.name ?? String(id).toLowerCase();

// ── Trunks (spec §4) ─────────────────────────────────────────────────────────
// Two nodes are joined when they share a land border, a direct submarine cable
// landing, or connect only through countries outside the corpus
// (DE–SE through Denmark). Country pairs only — no cable data is copied.
export const TRUNKS = [
  ['US', 'CA'], ['US', 'UK'], ['US', 'IE'], ['US', 'FR'], ['US', 'DE'], ['US', 'NL'],
  ['US', 'AU'], ['US', 'NZ'], ['CA', 'UK'], ['CA', 'IE'], ['UK', 'IE'], ['UK', 'FR'],
  ['UK', 'BE'], ['UK', 'NL'], ['IE', 'FR'], ['FR', 'BE'], ['FR', 'DE'], ['BE', 'NL'],
  ['BE', 'DE'], ['NL', 'DE'], ['DE', 'SE'], ['AU', 'NZ'],
];

const ORDER = (id) => NODE_IDS.indexOf(id);
const ADJ = (() => {
  const m = Object.fromEntries(NODE_IDS.map((id) => [id, []]));
  for (const [a, b] of TRUNKS) { m[a].push(b); m[b].push(a); }
  for (const id of NODE_IDS) m[id].sort((x, y) => ORDER(x) - ORDER(y));
  return m;
})();

export const neighbors = (id) => ADJ[id] ?? [];

export function trunkIndex(a, b) {
  return TRUNKS.findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// ── Legislative time (spec §5) ───────────────────────────────────────────────
export const STEPS = [
  { id: 'before',       statuses: [] },
  { id: 'active',       statuses: ['ACTIVE'] },
  { id: 'implementing', statuses: ['ACTIVE', 'IMPLEMENTING'] },
  { id: 'now',          statuses: ['ACTIVE', 'IMPLEMENTING', 'PASSED'], flicker: 'CHALLENGED' },
  { id: 'upheld',       statuses: ['ACTIVE', 'IMPLEMENTING', 'PASSED', 'CHALLENGED'] },
  { id: 'proposed',     statuses: ['ACTIVE', 'IMPLEMENTING', 'PASSED', 'CHALLENGED', 'PROPOSED'] },
];
export const NOW_STEP = 3;

// ── Tap types (spec §5) ──────────────────────────────────────────────────────
// Array order is the tick angle order (index × 45°) and the fate-line order.
export const TAPS = [
  { key: 'scan',      tag: 'Platform Mandated Scanning', word: 'seen',     at: 'ends' },
  { key: 'backdoor',  tag: 'Encryption Backdoor',        word: 'read',     at: 'route' },
  { key: 'retain',    tag: 'Data Retention',             word: 'kept',     at: 'route' },
  { key: 'traffic',   tag: 'Traffic Retention',          word: 'traced',   at: 'route' },
  { key: 'digitalId', tag: 'Digital Id',                 word: 'named',    at: 'source' },
  { key: 'age',       tag: 'Age Verification',           word: 'proven',   at: 'destination' },
  { key: 'biometric', tag: 'Biometric Collection',       word: 'measured', at: 'source' },
  { key: 'worker',    tag: 'Worker Surveillance',        word: 'watched',  at: 'source' },
];

export function lawNodes(law) {
  if (law?.location === 'EU') return EU_MEMBERS;
  const id = NODE_BY_LOCATION[law?.location];
  return id ? [id] : [];
}

export function lawTaps(law) {
  const tags = Array.isArray(law?.tags) ? law.tags : [];
  return TAPS.filter((t) => tags.includes(t.tag));
}

export function lawsInForce(laws, step) {
  const { statuses } = STEPS[step];
  return (laws ?? []).filter((l) => statuses.includes(l.legislationStatus));
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// fnv1a's low bit only tracks the parity of the last character, so every law
// would flip in lockstep; the murmur3 finaliser mixes the high bits down.
function fmix32(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// A CHALLENGED law at `now` fires on some sends and not others — fixed per
// (law, send), never per frame.
export function challengedFires(lawId, sendSeq) {
  return (fmix32(fnv1a(`${lawId}:${sendSeq}`)) & 1) === 1;
}

export function lawsFiring(laws, step, sendSeq) {
  const steady = lawsInForce(laws, step);
  const { flicker } = STEPS[step];
  if (!flicker) return steady;
  const flickering = (laws ?? []).filter(
    (l) => l.legislationStatus === flicker && challengedFires(l.id, sendSeq),
  );
  return steady.concat(flickering);
}

function lawIdsWith(nodeId, laws, tap) {
  return laws
    .filter((l) => lawNodes(l).includes(nodeId) && Array.isArray(l.tags) && l.tags.includes(tap.tag))
    .map((l) => l.id);
}

export function tapsAt(nodeId, laws) {
  const out = {};
  for (const tap of TAPS) {
    const ids = lawIdsWith(nodeId, laws ?? [], tap);
    if (ids.length) out[tap.key] = ids;
  }
  return out;
}

export function nodeLoad(nodeId, laws) {
  return (laws ?? [])
    .filter((l) => lawNodes(l).includes(nodeId))
    .reduce((acc, l) => { const s = parseInt(l.severity, 10) || 0; return acc + s * s; }, 0);
}

// Tick state per tap type at a node: 'on' when a steady law carries it,
// 'flicker' when only a CHALLENGED law at `now` does, null otherwise.
export function tickStates(nodeId, laws, step) {
  const steady = tapsAt(nodeId, lawsInForce(laws, step));
  const { flicker } = STEPS[step];
  const flickering = flicker
    ? tapsAt(nodeId, (laws ?? []).filter((l) => l.legislationStatus === flicker))
    : {};
  return TAPS.map((t) => (steady[t.key] ? 'on' : flickering[t.key] ? 'flicker' : null));
}
