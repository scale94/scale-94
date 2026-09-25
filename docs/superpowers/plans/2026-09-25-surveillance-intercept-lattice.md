# /SURVEILLANCE Intercept Lattice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/SURVEILLANCE` from a catalogue into a network the visitor sends a packet through. The laws in force act on the packet, a ratchet moves through legislative time, and the law grid stays below as a linked ledger.

**Architecture:** There are three layers.
- **Pure model** in `src/terminal/lib/`: `interceptLattice.js` (nodes, trunks, statuses, taps, routing, fate, readout) and `interceptPacket.js` (the packet timeline).
- **Hybrid view** in `src/terminal/components/intercept/`: a WebGL2 field on the shared GL harness draws the glow, beads and packet; an SVG overlay handles every interaction and all text; a session hook owns the state.
- **`SurveillanceTab.jsx`** composes them and gets its broken field reads fixed.

The quintessence compile path is never written to.

**Tech Stack:** React 19, Vite, Vitest + jsdom + @testing-library/react, WebGL2 through `src/terminal/gl/useShaderCanvas.js`, d3-geo projection via `src/terminal/data/worldMapPolys.js`.

**Spec:** `docs/superpowers/specs/2026-09-25-surveillance-intercept-lattice-design.md`

## Global Constraints

- Work on the existing branch `feature/surveillance-inversion` in `F:\scale_9.4`. **Never push.** Commit after every task, and stage **only the files that task names**. The tree holds unrelated untracked `baseline/*` dirs and two unrelated modified files (`.import-cache.json` and `councilField.test.jsx.snap`) that must never be staged.
- Commit messages end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Compile invariant (spec §1):**
  - Nothing may import `setPanopticonCorpus`, write to `src/terminal/lib/panopticon.js` or `src/terminal/lib/sovereignty.js`, or touch `localStorage` / `sessionStorage`.
  - The header score stays `computePanopticonIndex(legislationArticles)`, which is `61` on the sealed corpus.
- **Voice:**
  - Lowercase mono, `·` separators, the past-participle tap words exactly: `seen · read · kept · traced · named · proven · measured · watched`.
  - No HUD/status copy ("ACTIVE", "ENGAGED", "ONLINE").
- **Lint:** `npm run lint` must stay at 0 errors and ≤ 153 warnings. Never silence `react-hooks/exhaustive-deps` except with the harness's documented `deps` pattern.
- **Snapshots:**
  - Never run vitest with `-u` against existing snapshots. The only snapshot this plan creates is the new InterceptField GL call log (Task 6), which is written once on first run.
  - `src/terminal/gl/__tests__/glParity.test.jsx` must never be touched.
- Test command: `npx vitest run <path>`. Full suite: `npm test`.
- The corpus fixture is a byte copy of `public/kernel/legislation.16e791d6.json` (44 laws, sealed 2026-03-09). Every pinned number below comes from it.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/lib/__tests__/fixtures/legislation-sealed-2026-03-09.json` | frozen corpus for tests |
| `src/terminal/lib/interceptLattice.js` | pure model: nodes, trunks, steps, taps, routing, fate, readout |
| `src/terminal/lib/interceptPacket.js` | pure packet timeline: position over time, word cues |
| `src/terminal/components/intercept/interceptGeometry.js` | node map positions, EU membrane path |
| `src/terminal/components/intercept/interceptFieldShader.js` | GLSL sources + uniform list |
| `src/terminal/components/intercept/interceptFieldUniforms.js` | preallocated uniform buffers + fillers |
| `src/terminal/components/intercept/InterceptField.jsx` | WebGL2 canvas on the shared harness |
| `src/terminal/components/intercept/useInterceptSession.js` | route/step/send state, timers, sediment |
| `src/terminal/components/intercept/InterceptOverlay.jsx` | SVG nodes, ticks, filament, words, fallback |
| `src/terminal/components/intercept/InterceptLattice.jsx` | composition: map ghost + field + overlay + ratchet + readouts |
| `src/terminal/views/SurveillanceTab.jsx` | field-bug fixes, sealed copy, lattice + linked ledger |

---

### Task 1: Corpus fixture and the lattice model

**Files:**
- Create: `src/terminal/lib/__tests__/fixtures/legislation-sealed-2026-03-09.json` (copy)
- Create: `src/terminal/lib/interceptLattice.js`
- Test: `src/terminal/lib/__tests__/interceptLattice.test.js`

**Interfaces:**
- Produces:
  - `NODES: {id, name, location, lonlat:[lon,lat], nudge:[dx,dy]}[]` (11 entries), `NODE_IDS: string[]`, `EU_MEMBERS: string[]`, `TRUNKS: [string,string][]` (22 entries).
  - `STEPS: {id, statuses:string[], flicker?:'CHALLENGED'}[]` (6 entries), `NOW_STEP = 3`.
  - `TAPS: {key, tag, word, at:'ends'|'route'|'source'|'destination'}[]` (8 entries).
  - `nodeName(id) → string`, `neighbors(id) → string[]`, `trunkIndex(a,b) → number` (-1 when there is none).
  - `lawNodes(law) → string[]`, `lawTaps(law) → TAP[]`, `lawsInForce(laws, step) → law[]`, `challengedFires(lawId, sendSeq) → boolean`, `lawsFiring(laws, step, sendSeq) → law[]`.
  - `tapsAt(nodeId, laws) → {[tapKey]: lawId[]}`, `nodeLoad(nodeId, laws) → number` (Σsev²), `tickStates(nodeId, laws, step) → ('on'|'flicker'|null)[8]`.

- [ ] **Step 1: Copy the corpus fixture**

Run:
```bash
mkdir -p src/terminal/lib/__tests__/fixtures && cp public/kernel/legislation.16e791d6.json src/terminal/lib/__tests__/fixtures/legislation-sealed-2026-03-09.json
```
Expected: the file exists and `node -e "console.log(require('./src/terminal/lib/__tests__/fixtures/legislation-sealed-2026-03-09.json').length)"` prints `44`.

- [ ] **Step 2: Write the failing test**

Create `src/terminal/lib/__tests__/interceptLattice.test.js`:

```js
import { describe, it, expect } from 'vitest';
import laws from './fixtures/legislation-sealed-2026-03-09.json';
import {
  NODES, NODE_IDS, EU_MEMBERS, TRUNKS, STEPS, NOW_STEP, TAPS,
  nodeName, neighbors, trunkIndex, lawNodes, lawTaps, lawsInForce,
  challengedFires, lawsFiring, tapsAt, nodeLoad, tickStates,
} from '../interceptLattice';

describe('intercept lattice model (spec §2–§5)', () => {
  it('has 11 country nodes and no EU node', () => {
    expect(NODES).toHaveLength(11);
    expect(NODE_IDS).not.toContain('EU');
  });

  it('maps every corpus law to at least one node', () => {
    for (const law of laws) expect(lawNodes(law).length).toBeGreaterThan(0);
  });

  it('fans the five EU laws out to exactly the six member nodes', () => {
    const eu = laws.filter((l) => l.location === 'EU');
    expect(eu).toHaveLength(5);
    for (const law of eu) expect(lawNodes(law)).toEqual(['IE', 'FR', 'BE', 'NL', 'DE', 'SE']);
    expect(EU_MEMBERS).not.toContain('UK');
  });

  it('has 22 distinct trunks between known nodes, no self-loops', () => {
    expect(TRUNKS).toHaveLength(22);
    const keys = TRUNKS.map(([a, b]) => [a, b].sort().join('-'));
    expect(new Set(keys).size).toBe(22);
    for (const [a, b] of TRUNKS) {
      expect(NODE_IDS).toContain(a);
      expect(NODE_IDS).toContain(b);
      expect(a).not.toBe(b);
    }
  });

  it('reaches every node from every node', () => {
    for (const start of NODE_IDS) {
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length) for (const n of neighbors(queue.shift())) if (!seen.has(n)) { seen.add(n); queue.push(n); }
      expect(seen.size).toBe(11);
    }
  });

  it('has no direct Canada–New Zealand trunk (spec §4)', () => {
    expect(trunkIndex('CA', 'NZ')).toBe(-1);
    expect(trunkIndex('CA', 'US')).toBe(trunkIndex('US', 'CA'));
    expect(trunkIndex('US', 'CA')).toBe(0);
  });

  it('counts laws in force per detent: 0 / 18 / 28 / 30 / 34 / 44', () => {
    expect(STEPS.map((_, i) => lawsInForce(laws, i).length)).toEqual([0, 18, 28, 30, 34, 44]);
    expect(STEPS[NOW_STEP].id).toBe('now');
    expect(STEPS.map((s) => s.id)).toEqual(['before', 'active', 'implementing', 'now', 'upheld', 'proposed']);
  });

  it('gives every law a tap type and matches the corpus tag counts', () => {
    for (const law of laws) expect(lawTaps(law).length).toBeGreaterThan(0);
    const counts = Object.fromEntries(TAPS.map((t) => [t.key, laws.filter((l) => l.tags.includes(t.tag)).length]));
    expect(counts).toEqual({ scan: 8, backdoor: 8, retain: 16, traffic: 9, digitalId: 18, age: 9, biometric: 21, worker: 14 });
    expect(TAPS.map((t) => t.word)).toEqual(['seen', 'read', 'kept', 'traced', 'named', 'proven', 'measured', 'watched']);
  });

  it('fires CHALLENGED laws deterministically, and not in lockstep', () => {
    const challenged = laws.filter((l) => l.legislationStatus === 'CHALLENGED').map((l) => l.id);
    expect(challenged).toHaveLength(4);
    const pattern = (id) => Array.from({ length: 16 }, (_, s) => (challengedFires(id, s) ? 1 : 0)).join('');
    for (const id of challenged) {
      expect(pattern(id)).toMatch(/0/);
      expect(pattern(id)).toMatch(/1/);
    }
    expect(new Set(challenged.map(pattern)).size).toBeGreaterThan(1);
    expect(pattern('LAW-CA-2025-C2-001')).toBe('1110010010101011');
    expect(pattern('LAW-EU-2025-CHAT-001')).toBe('0101011100010101');
    expect(pattern('LAW-IE-2011-PSC')).toBe('1111110111011001');
    expect(pattern('LAW-US-2025-STATE-001')).toBe('0101000101100111');
  });

  it('adds only the firing CHALLENGED laws, and only at now', () => {
    for (let seq = 0; seq < 8; seq++) {
      const n = lawsFiring(laws, NOW_STEP, seq).length;
      expect(n).toBeGreaterThanOrEqual(30);
      expect(n).toBeLessThanOrEqual(34);
      expect(lawsFiring(laws, 2, seq)).toHaveLength(28);
      expect(lawsFiring(laws, 4, seq)).toHaveLength(34);
    }
  });

  it('groups the taps in force at a node', () => {
    expect(Object.keys(tapsAt('UK', lawsInForce(laws, NOW_STEP)))).toEqual(
      ['scan', 'backdoor', 'retain', 'traffic', 'digitalId', 'age', 'worker'],
    );
    expect(tapsAt('CA', [])).toEqual({});
  });

  it('sums severity squared per node', () => {
    expect(nodeLoad('UK', lawsInForce(laws, NOW_STEP))).toBe(57);
    expect(nodeLoad('SE', laws)).toBe(143);
    expect(nodeLoad('NZ', [])).toBe(0);
  });

  it('marks ticks steady, flickering or absent', () => {
    expect(tickStates('CA', laws, NOW_STEP)).toEqual([null, 'flicker', 'flicker', null, 'on', null, 'on', 'flicker']);
    expect(tickStates('UK', laws, NOW_STEP)).toEqual(['on', 'on', 'on', 'on', 'on', 'on', null, 'on']);
    expect(tickStates('CA', laws, 0)).toEqual([null, null, null, null, null, null, null, null]);
  });

  it('names nodes in lowercase', () => {
    expect(nodeName('NZ')).toBe('new zealand');
    expect(nodeName('UK')).toBe('united kingdom');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/terminal/lib/__tests__/interceptLattice.test.js`
Expected: FAIL, with "Failed to resolve import "../interceptLattice"".

- [ ] **Step 4: Write the model**

Create `src/terminal/lib/interceptLattice.js`:

```js
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/terminal/lib/__tests__/interceptLattice.test.js`
Expected: PASS (14 tests).

- [ ] **Step 6: Commit**

```bash
git add src/terminal/lib/__tests__/fixtures/legislation-sealed-2026-03-09.json src/terminal/lib/interceptLattice.js src/terminal/lib/__tests__/interceptLattice.test.js
git commit -m "feat(surveillance): intercept lattice model — nodes, trunks, legislative time, taps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Routing, fate and the family readout

**Files:**
- Modify: `src/terminal/lib/interceptLattice.js` (append)
- Test: `src/terminal/lib/__tests__/interceptRouting.test.js`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `route(src, dst, waypoints=[]) → string[] | null`, where `[src]` means src === dst and `null` means an unknown node.
  - `packetFate(path, laws) → {phase:'source'|'transit'|'destination', hop, node, key, word, lawIds}[]`.
  - `fateLine(path, events) → string`.
  - `familyReadout(laws, step) → {unread, unkept, unnamed}`.
  - `formatCount(n) → 'none' | string`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lib/__tests__/interceptRouting.test.js`:

```js
import { describe, it, expect } from 'vitest';
import laws from './fixtures/legislation-sealed-2026-03-09.json';
import {
  NOW_STEP, STEPS, lawsInForce, route, packetFate, fateLine, familyReadout, formatCount,
} from '../interceptLattice';

describe('routing (spec §3, §4)', () => {
  it('takes the fewest hops: Canada reaches New Zealand only through the US', () => {
    expect(route('CA', 'NZ')).toEqual(['CA', 'US', 'NZ']);
  });

  it('breaks hop ties by geography, keeping European routes in Europe', () => {
    expect(route('UK', 'DE')).toEqual(['UK', 'NL', 'DE']);
    expect(route('IE', 'SE')).toEqual(['IE', 'FR', 'DE', 'SE']);
  });

  it('bends through waypoints in order', () => {
    expect(route('CA', 'NZ', ['AU'])).toEqual(['CA', 'US', 'AU', 'NZ']);
    expect(route('UK', 'AU', ['DE'])).toEqual(['UK', 'NL', 'DE', 'US', 'AU']);
  });

  it('handles a zero-length route and unknown nodes', () => {
    expect(route('CA', 'CA')).toEqual(['CA']);
    expect(route('CA', 'XX')).toBeNull();
  });
});

describe('packet fate (spec §5, §6)', () => {
  const ukAu = route('UK', 'AU');
  const events = packetFate(ukAu, lawsInForce(laws, NOW_STEP));

  it('places each tap where the spec says it fires', () => {
    expect(events.map((e) => [e.phase, e.hop, e.node, e.key])).toEqual([
      ['source', 0, 'UK', 'scan'],
      ['source', 0, 'UK', 'digitalId'],
      ['source', 0, 'UK', 'worker'],
      ['transit', 0, 'UK', 'backdoor'],
      ['transit', 0, 'UK', 'retain'],
      ['transit', 0, 'UK', 'traffic'],
      ['transit', 1, 'US', 'retain'],
      ['transit', 2, 'AU', 'backdoor'],
      ['transit', 2, 'AU', 'retain'],
      ['destination', 2, 'AU', 'age'],
    ]);
  });

  it('carries the law ids behind each word', () => {
    expect(events[0].lawIds).toEqual(['LAW-UK-2023-OSA-001']);
  });

  it('writes the fate line in the lattice voice', () => {
    expect(fateLine(ukAu, events)).toBe(
      'united kingdom → australia · 2 hops · seen, named, watched before leaving · read at united kingdom, australia · kept at united kingdom, united states, australia · traced at united kingdom · proven on arrival',
    );
  });

  it('lets a packet arrive unseen before any law is in force', () => {
    const p = route('CA', 'NZ');
    expect(fateLine(p, packetFate(p, lawsInForce(laws, 0)))).toBe('canada → new zealand · 2 hops · arrived. unseen.');
  });

  it('marks the same crossing once every proposal passes', () => {
    const p = route('CA', 'NZ');
    expect(fateLine(p, packetFate(p, lawsInForce(laws, 5)))).toBe(
      'canada → new zealand · 2 hops · seen, named, measured, watched before leaving · read at canada, united states · kept at canada, united states · traced at canada',
    );
  });

  it('returns nothing for a route that goes nowhere', () => {
    expect(packetFate(['CA'], laws)).toEqual([]);
    expect(fateLine(['CA'], [])).toBe('');
  });
});

describe('family readout (spec §6 table)', () => {
  it('pins the unread / unkept / unnamed counts per detent', () => {
    expect(STEPS.map((_, i) => familyReadout(laws, i))).toEqual([
      { unread: 55, unkept: 55, unnamed: 55 },
      { unread: 3, unkept: 6, unnamed: 18 },
      { unread: 1, unkept: 0, unnamed: 0 },
      { unread: 1, unkept: 0, unnamed: 0 },
      { unread: 0, unkept: 0, unnamed: 0 },
      { unread: 0, unkept: 0, unnamed: 0 },
    ]);
  });

  it('formats zero as none', () => {
    expect(formatCount(0)).toBe('none');
    expect(formatCount(18)).toBe('18');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/lib/__tests__/interceptRouting.test.js`
Expected: FAIL, with "route is not a function" (or an undefined-export error).

- [ ] **Step 3: Append routing, fate and readout to the model**

Append to the end of `src/terminal/lib/interceptLattice.js`:

```js
// ── Routing (spec §3) ────────────────────────────────────────────────────────
// Fewest hops first; ties go to the geographically shorter path, so a UK →
// Germany packet crosses the North Sea rather than the Atlantic twice.
function geoDist(a, b) {
  const [lon1, lat1] = NODE_BY_ID[a].lonlat;
  const [lon2, lat2] = NODE_BY_ID[b].lonlat;
  const dLon = Math.abs(lon1 - lon2) > 180 ? 360 - Math.abs(lon1 - lon2) : Math.abs(lon1 - lon2);
  const x = dLon * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.hypot(x, lat1 - lat2);
}

function shortest(src, dst) {
  if (!ADJ[src] || !ADJ[dst]) return null;
  const cost = { [src]: 0 };
  const parent = { [src]: null };
  const done = new Set();
  for (;;) {
    let cur = null;
    for (const id of NODE_IDS) {
      if (id in cost && !done.has(id) && (cur === null || cost[id] < cost[cur])) cur = id;
    }
    if (cur === null) return null;
    if (cur === dst) break;
    done.add(cur);
    for (const n of ADJ[cur]) {
      const c = cost[cur] + 1 + geoDist(cur, n) / 1e4;
      if (!(n in cost) || c < cost[n]) { cost[n] = c; parent[n] = cur; }
    }
  }
  const path = [];
  for (let c = dst; c != null; c = parent[c]) path.unshift(c);
  return path;
}

export function route(src, dst, waypoints = []) {
  const stops = [src, ...waypoints, dst].filter((id, i, arr) => i === 0 || id !== arr[i - 1]);
  if (stops.length < 2) return stops.slice(0, 1);
  const out = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const leg = shortest(stops[i - 1], stops[i]);
    if (!leg) return null;
    out.push(...leg.slice(1));
  }
  return out;
}

// ── Fate (spec §5, §6) ───────────────────────────────────────────────────────
export function packetFate(path, laws) {
  if (!path || path.length < 2) return [];
  const src = path[0];
  const dstHop = path.length - 1;
  const dst = path[dstHop];
  const events = [];
  const push = (phase, hop, node, tap) => {
    const lawIds = lawIdsWith(node, laws ?? [], tap);
    if (lawIds.length) events.push({ phase, hop, node, key: tap.key, word: tap.word, lawIds });
  };
  for (const tap of TAPS) if (tap.at === 'source' || tap.at === 'ends') push('source', 0, src, tap);
  path.forEach((node, hop) => {
    for (const tap of TAPS) if (tap.at === 'route') push('transit', hop, node, tap);
  });
  for (const tap of TAPS) if (tap.at === 'destination' || tap.at === 'ends') push('destination', dstHop, dst, tap);
  return events;
}

export function fateLine(path, events) {
  if (!path || path.length < 2) return '';
  const hops = path.length - 1;
  const head = `${nodeName(path[0])} → ${nodeName(path[hops])} · ${hops} ${hops === 1 ? 'hop' : 'hops'}`;
  if (!events.length) return `${head} · arrived. unseen.`;
  const phaseWords = (phase) =>
    TAPS.filter((t) => events.some((e) => e.phase === phase && e.key === t.key)).map((t) => t.word);
  const parts = [head];
  const before = phaseWords('source');
  if (before.length) parts.push(`${before.join(', ')} before leaving`);
  for (const tap of TAPS) {
    const at = [...new Set(events.filter((e) => e.phase === 'transit' && e.key === tap.key).map((e) => nodeName(e.node)))];
    if (at.length) parts.push(`${tap.word} at ${at.join(', ')}`);
  }
  const arrival = phaseWords('destination');
  if (arrival.length) parts.push(`${arrival.join(', ')} on arrival`);
  return parts.join(' · ');
}

// ── Family readout (spec §6) ─────────────────────────────────────────────────
// Unordered pairs (of 55) where at least one sending direction has some route
// free of the family's taps. Counts the steady laws of the detent only.
const CONTENT_ROUTE = ['Encryption Backdoor'];
const CONTENT_ENDS = ['Platform Mandated Scanning'];
const METADATA_ROUTE = ['Data Retention', 'Traffic Retention'];
const IDENTITY_SOURCE = ['Digital Id', 'Biometric Collection', 'Worker Surveillance'];
const IDENTITY_DESTINATION = ['Age Verification'];

function hasTag(nodeId, laws, tags) {
  return laws.some((l) => lawNodes(l).includes(nodeId) && Array.isArray(l.tags) && l.tags.some((t) => tags.includes(t)));
}

function reachable(src, dst, ok) {
  if (!ok(src) || !ok(dst)) return false;
  const seen = new Set([src]);
  const queue = [src];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === dst) return true;
    for (const n of ADJ[cur]) if (!seen.has(n) && ok(n)) { seen.add(n); queue.push(n); }
  }
  return false;
}

export function familyReadout(laws, step) {
  const live = lawsInForce(laws, step);
  const out = { unread: 0, unkept: 0, unnamed: 0 };
  const noBackdoor = (n) => !hasTag(n, live, CONTENT_ROUTE);
  const noRetention = (n) => !hasTag(n, live, METADATA_ROUTE);
  const unnamedDir = (a, b) => !hasTag(a, live, IDENTITY_SOURCE) && !hasTag(b, live, IDENTITY_DESTINATION);
  for (let i = 0; i < NODE_IDS.length; i++) {
    for (let j = i + 1; j < NODE_IDS.length; j++) {
      const a = NODE_IDS[i];
      const b = NODE_IDS[j];
      if (!hasTag(a, live, CONTENT_ENDS) && !hasTag(b, live, CONTENT_ENDS) && reachable(a, b, noBackdoor)) out.unread++;
      if (reachable(a, b, noRetention)) out.unkept++;
      if (unnamedDir(a, b) || unnamedDir(b, a)) out.unnamed++;
    }
  }
  return out;
}

export const formatCount = (n) => (n === 0 ? 'none' : String(n));
```

- [ ] **Step 4: Run both model tests to verify they pass**

Run: `npx vitest run src/terminal/lib/__tests__/interceptLattice.test.js src/terminal/lib/__tests__/interceptRouting.test.js`
Expected: PASS (all tests in both files).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/interceptLattice.js src/terminal/lib/__tests__/interceptRouting.test.js
git commit -m "feat(surveillance): lattice routing, packet fate and family readout" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The packet timeline

**Files:**
- Create: `src/terminal/lib/interceptPacket.js`
- Test: `src/terminal/lib/__tests__/interceptPacket.test.js`

**Interfaces:**
- Consumes: the event shape from `packetFate` (Task 2).
- Produces:
  - `HOP_MS = 700`, `INSPECT_MS = 450`, `GATE_MS = 500`, `FADE_MS = 400`.
  - `buildTimeline(path, events, xyOf) → {pts, srcDwell, travel, gate, durationMs, cues:{t,node,key,word}[], hopTimes:number[], open, named, measured}`.
  - `packetAt(timeline, ms) → {x, y, alive, open} | null`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lib/__tests__/interceptPacket.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildTimeline, packetAt, HOP_MS, INSPECT_MS, GATE_MS, FADE_MS } from '../interceptPacket';

const XY = { A: [0, 0], B: [100, 0], C: [100, 50] };
const xyOf = (id) => XY[id];
const EVENTS = [
  { phase: 'source', hop: 0, node: 'A', key: 'scan', word: 'seen' },
  { phase: 'transit', hop: 1, node: 'B', key: 'retain', word: 'kept' },
  { phase: 'destination', hop: 2, node: 'C', key: 'age', word: 'proven' },
];

describe('packet timeline (spec §5)', () => {
  const tl = buildTimeline(['A', 'B', 'C'], EVENTS, xyOf);

  it('dwells for inspection, travels one HOP_MS per trunk, holds at the gate', () => {
    expect([HOP_MS, INSPECT_MS, GATE_MS, FADE_MS]).toEqual([700, 450, 500, 400]);
    expect(tl.srcDwell).toBe(450);
    expect(tl.travel).toBe(1400);
    expect(tl.gate).toBe(500);
    expect(tl.durationMs).toBe(2350);
    expect(tl.hopTimes).toEqual([450, 1150, 1850]);
  });

  it('cues each word when the packet reaches its node', () => {
    expect(tl.cues).toEqual([
      { t: 0, node: 'A', key: 'scan', word: 'seen' },
      { t: 1150, node: 'B', key: 'retain', word: 'kept' },
      { t: 1850, node: 'C', key: 'age', word: 'proven' },
    ]);
  });

  it('leaves open during inspection, then travels sealed with eased hops', () => {
    expect(packetAt(tl, 0)).toEqual({ x: 0, y: 0, alive: 1, open: 1 });
    expect(packetAt(tl, 800)).toEqual({ x: 50, y: 0, alive: 1, open: 0 });
    expect(packetAt(tl, 1150)).toEqual({ x: 100, y: 0, alive: 1, open: 0 });
    expect(packetAt(tl, 1500)).toEqual({ x: 100, y: 25, alive: 1, open: 0 });
  });

  it('waits at the gate, then fades out', () => {
    expect(packetAt(tl, 2349)).toEqual({ x: 100, y: 50, alive: 1, open: 0 });
    expect(packetAt(tl, 2550)).toEqual({ x: 100, y: 50, alive: 0.5, open: 0 });
    expect(packetAt(tl, 2750)).toEqual({ x: 100, y: 50, alive: 0, open: 0 });
  });

  it('skips the dwell and gate when nothing fires there', () => {
    const quiet = buildTimeline(['A', 'B'], [], xyOf);
    expect(quiet.durationMs).toBe(700);
    expect(quiet.open).toBe(false);
    expect(packetAt(quiet, 0)).toEqual({ x: 0, y: 0, alive: 1, open: 0 });
  });

  it('marks named and measured packets', () => {
    const marked = buildTimeline(['A', 'B'], [
      { phase: 'source', hop: 0, node: 'A', key: 'digitalId', word: 'named' },
      { phase: 'source', hop: 0, node: 'A', key: 'biometric', word: 'measured' },
    ], xyOf);
    expect([marked.named, marked.measured]).toEqual([true, true]);
  });

  it('has no packet for a route that goes nowhere', () => {
    expect(packetAt(buildTimeline(['A'], [], xyOf), 0)).toBeNull();
    expect(packetAt(null, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/lib/__tests__/interceptPacket.test.js`
Expected: FAIL, with "Failed to resolve import "../interceptPacket"".

- [ ] **Step 3: Write the timeline**

Create `src/terminal/lib/interceptPacket.js`:

```js
// interceptPacket.js — the packet's timeline: when it leaves, where it is at
// any moment, and when each word fires (spec §5). Pure; positions are in map
// units (the 800 × 400 WorldMap viewBox).

export const HOP_MS = 700;       // one trunk
export const INSPECT_MS = 450;   // dwell at the source when anything fires before leaving
export const GATE_MS = 500;      // hold at the destination for 'proven'
export const FADE_MS = 400;      // the bead fades out after arrival

const smooth = (f) => f * f * (3 - 2 * f);

export function buildTimeline(path, events, xyOf) {
  const pts = (path ?? []).map(xyOf);
  const srcDwell = events.some((e) => e.phase === 'source') ? INSPECT_MS : 0;
  const travel = Math.max(0, pts.length - 1) * HOP_MS;
  const gate = events.some((e) => e.phase === 'destination' && e.key === 'age') ? GATE_MS : 0;
  const cueAt = (e) => {
    if (e.phase === 'source') return 0;
    if (e.phase === 'destination') return srcDwell + travel;
    return srcDwell + e.hop * HOP_MS;
  };
  return {
    pts,
    srcDwell,
    travel,
    gate,
    durationMs: srcDwell + travel + gate,
    cues: events.map((e) => ({ t: cueAt(e), node: e.node, key: e.key, word: e.word })),
    hopTimes: pts.map((_, h) => srcDwell + h * HOP_MS),
    open: events.some((e) => e.phase === 'source' && e.key === 'scan'),
    named: events.some((e) => e.key === 'digitalId'),
    measured: events.some((e) => e.key === 'biometric'),
  };
}

// → { x, y, alive (0..1), open (0|1) } or null when there is no packet.
export function packetAt(tl, ms) {
  if (!tl || tl.pts.length < 2) return null;
  const last = tl.pts[tl.pts.length - 1];
  if (ms >= tl.durationMs) {
    const alive = Math.max(0, 1 - (ms - tl.durationMs) / FADE_MS);
    return { x: last[0], y: last[1], alive, open: 0 };
  }
  const t = ms - tl.srcDwell;
  if (t <= 0) return { x: tl.pts[0][0], y: tl.pts[0][1], alive: 1, open: tl.open ? 1 : 0 };
  const hopF = Math.min(t / HOP_MS, tl.pts.length - 1);
  const i = Math.min(Math.floor(hopF), tl.pts.length - 2);
  const f = smooth(hopF - i);
  const [x0, y0] = tl.pts[i];
  const [x1, y1] = tl.pts[i + 1];
  return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, alive: 1, open: 0 };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/lib/__tests__/interceptPacket.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/interceptPacket.js src/terminal/lib/__tests__/interceptPacket.test.js
git commit -m "feat(surveillance): packet timeline — inspection dwell, eased hops, gate hold" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Fix the ledger's field reads and seal the corpus copy

This task stands alone: it fixes the existing tab before any lattice UI arrives.

The current code reads `law.categories` and `law.legalName`, and neither field exists. Its region matcher runs substring tests over country names: "US" matches "AUSTRALIA", "DE" matches "SWEDEN", and UK/SE/IE/NL/NZ never match at all.

**Files:**
- Modify: `src/terminal/views/SurveillanceTab.jsx`
- Test: `src/terminal/views/__tests__/SurveillanceTab.test.jsx`

**Interfaces:**
- Consumes: `lawNodes`, `lawTaps`, `TAPS` from `src/terminal/lib/interceptLattice.js`.
- Produces (used in Task 8):
  - `data-testid="law-card"` on each card and `data-testid="panopticon-score"` on the score;
  - selects with `id="sv-region"` / `id="sv-category"` and matching `<label htmlFor>`;
  - region values = node ids plus `'EU'` (EU-level laws only) and `'ALL'`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/views/__tests__/SurveillanceTab.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import laws from '../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import SurveillanceTab from '../SurveillanceTab';

const renderTab = () => render(<SurveillanceTab legislationArticles={laws} onOpenLaw={() => {}} />);
const cards = () => screen.queryAllByTestId('law-card');

describe('SurveillanceTab ledger (spec §2 bug, §8)', () => {
  it('shows all 44 laws and the sealed index of 61', () => {
    renderTab();
    expect(cards()).toHaveLength(44);
    expect(screen.getByTestId('panopticon-score').textContent).toBe('61');
  });

  it.each([
    ['Encryption Backdoor', 8], ['Data Retention', 16], ['Traffic Retention', 9],
    ['Platform Mandated Scanning', 8], ['Digital Id', 18], ['Age Verification', 9],
    ['Biometric Collection', 21], ['Worker Surveillance', 14],
  ])('filters category %s to %i laws', (tag, n) => {
    renderTab();
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: tag } });
    expect(cards()).toHaveLength(n);
  });

  it.each([['UK', 4], ['US', 6], ['AU', 4], ['SE', 9], ['DE', 8], ['NZ', 3], ['EU', 5]])(
    'filters region %s to %i laws (EU laws count for members)',
    (region, n) => {
      renderTab();
      fireEvent.change(screen.getByLabelText(/region/i), { target: { value: region } });
      expect(cards()).toHaveLength(n);
    },
  );

  it('renders the subtitle and the surveillance tags on a card', () => {
    renderTab();
    expect(screen.getByText('Telecommunications and Other Legislation Amendment (Assistance and Access) Act 2018')).toBeTruthy();
    const tola = cards().find((c) => c.textContent.includes('ASSISTANCE AND ACCESS ACT (TOLA)'));
    expect(tola.textContent).toContain('Encryption Backdoor');
  });

  it('says the corpus is sealed, not live', () => {
    renderTab();
    expect(screen.getByText(/sealed 2026-03-09/i)).toBeTruthy();
    expect(screen.queryByText('INDEXING ACTIVE')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/views/__tests__/SurveillanceTab.test.jsx`
Expected: FAIL. The tests fail on missing `data-testid`s and labels, category filters return 0, and region counts are wrong.

- [ ] **Step 3: Fix imports and the category list**

In `src/terminal/views/SurveillanceTab.jsx`, replace line 1:

```jsx
import React, { useState, useMemo, useCallback } from 'react';
```
with:
```jsx
import React, { useState, useMemo } from 'react';
```

After the line `import { computePanopticonIndex } from '../lib/panopticon';`, add:

```jsx
import { lawNodes, lawTaps, TAPS } from '../lib/interceptLattice';
```

Replace the whole `const CATS = [ ... ];` block (the `// Category codes match category_code param in lib.rs` comment plus the array) with:

```jsx
// Category values are the corpus tag strings (the records carry `tags`, not
// `categories` — spec §2).
const CATS = [['ALL', 'All Categories'], ...TAPS.map((t) => [t.tag, t.tag])];
```

Delete the `parseCats` helper (the `// Parse categories field …` comment and the `const parseCats = …` function).

Replace the `REGIONS` comment line `// Region codes match run_surveillance_index() region_code param in lib.rs` with:

```jsx
// Region values are lattice node ids; 'EU' selects EU-level laws only
// (member-node filters include them — spec §2, §8).
```
and change the EU entry label `['EU',  'European Union'],` to `['EU',  'European Union (EU-level)'],`.

- [ ] **Step 4: Fix the filter and the threat-map grouping**

Replace the body of the `filtered` useMemo's `.filter(a => { ... })` callback with:

```jsx
      .filter(a => {
        const sev = parseInt(a.severity, 10) || 0;
        if (sev < minSev) return false;
        if (region !== 'ALL') {
          if (region === 'EU' ? a.location !== 'EU' : !lawNodes(a).includes(region)) return false;
        }
        if (category !== 'ALL') {
          if (!(Array.isArray(a.tags) && a.tags.includes(category))) return false;
        }
        return true;
      })
```

Replace the `regionThreats` useMemo body with:

```jsx
  const regionThreats = useMemo(() => {
    const map = {};
    for (const a of legislationArticles) {
      const sev = parseInt(a.severity, 10) || 0;
      const codes = a.location === 'EU' ? ['EU'] : lawNodes(a);
      for (const code of codes) map[code] = Math.max(map[code] || 0, sev);
    }
    return map;
  }, [legislationArticles]);
```

- [ ] **Step 5: Seal the copy and add test hooks**

Replace `SURVEILLANCE LEGISLATION TRACKER // ACTIVE CORPUS` with `SURVEILLANCE LEGISLATION TRACKER // SEALED CORPUS`.

Replace the badge block:

```jsx
          <div className="flex items-center gap-2 text-xs border border-red-500/30 px-3 py-1 bg-red-900/10 text-red-400 rounded-sm">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
            INDEXING ACTIVE
          </div>
```
with:
```jsx
          <div className="flex items-center gap-2 text-xs border border-red-500/30 px-3 py-1 bg-red-900/10 text-red-400/80 rounded-sm lowercase font-mono">
            <div className="w-2 h-2 rounded-full bg-red-400/60" />
            sealed 2026-03-09
          </div>
```

On the score `<div className="text-5xl font-bold font-mono tabular-nums"`, add the attribute `data-testid="panopticon-score"`.

On the Region `<label …>`, add `htmlFor="sv-region"`, and on its `<select>` add `id="sv-region"`. On the Category `<label …>`, add `htmlFor="sv-category"`, and on its `<select>` add `id="sv-category"`.

- [ ] **Step 6: Fix the card**

In the card map, replace:
```jsx
            const cats  = parseCats(law.categories);
```
with:
```jsx
            const cats  = lawTaps(law).map((t) => t.tag);
```

On the card's outer `<div key={law.id} …>`, add `data-testid="law-card"`.

Replace the legal-name block:
```jsx
                {law.legalName && (
                  <div className="text-[9px] text-orange-400/40 font-mono mb-2 leading-snug break-words line-clamp-1">
                    {law.legalName}
                  </div>
                )}
```
with:
```jsx
                {law.subtitle && (
                  <div className="text-[9px] text-orange-400/40 font-mono mb-2 leading-snug break-words line-clamp-1">
                    {law.subtitle}
                  </div>
                )}
```

In the chip, replace `{c.replace(/_/g, ' ')}` with `{c}`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/terminal/views/__tests__/SurveillanceTab.test.jsx`
Expected: PASS (3 + 8 + 7 = 18 tests).

- [ ] **Step 8: Lint the file**

Run: `npx eslint src/terminal/views/SurveillanceTab.jsx`
Expected: no output (the earlier unused-`useCallback` warning is gone).

- [ ] **Step 9: Commit**

```bash
git add src/terminal/views/SurveillanceTab.jsx src/terminal/views/__tests__/SurveillanceTab.test.jsx
git commit -m "fix(surveillance): read tags/subtitle, match regions by node, seal the corpus copy" -m "The tab read nonexistent categories/legalName fields, so every category filter was empty, and its substring region matcher sent US to Australia and DE to Sweden." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Geometry, shader source and uniform buffers

**Files:**
- Create: `src/terminal/components/intercept/interceptGeometry.js`
- Create: `src/terminal/components/intercept/interceptFieldShader.js`
- Create: `src/terminal/components/intercept/interceptFieldUniforms.js`
- Test: `src/terminal/components/intercept/__tests__/interceptFieldPure.test.js`

**Interfaces:**
- Consumes: `NODES`, `EU_MEMBERS`, `TRUNKS` (Task 1); `toMapXY` from `src/terminal/data/worldMapPolys.js`.
- Produces:
  - `nodeXY(id) → [x, y]` in WorldMap viewBox units, `convexHull(points)`, `membranePath(points, pad) → string`, `EU_MEMBRANE_PATH: string`.
  - `FIELD_UNIFORMS: string[]`, `FIELD_VS`, `FIELD_FS`.
  - `N_TRUNKS`, `N_NODES`, `createFieldBuffers() → {trunks, trunkState, nodes, packet, marks}` (Float32Arrays), `fillStatic(buf, xyOf)`, `fillScene(buf, {loads, kept, traced})`, `fillPacket(buf, state, timeline)`.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/components/intercept/__tests__/interceptFieldPure.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { NODE_IDS, TRUNKS } from '../../../lib/interceptLattice';
import { nodeXY, convexHull, membranePath, EU_MEMBRANE_PATH } from '../interceptGeometry';
import { FIELD_UNIFORMS, FIELD_VS, FIELD_FS } from '../interceptFieldShader';
import {
  N_TRUNKS, N_NODES, createFieldBuffers, fillStatic, fillScene, fillPacket,
} from '../interceptFieldUniforms';

describe('intercept geometry', () => {
  it('places every node inside the 800 × 400 map', () => {
    for (const id of NODE_IDS) {
      const [x, y] = nodeXY(id);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(800);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(400);
    }
  });

  it('keeps hull corners and drops interior points', () => {
    const hull = convexHull([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual([5, 5]);
  });

  it('draws a closed, padded membrane', () => {
    const d = membranePath([[0, 0], [10, 0], [0, 10]], 2);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(EU_MEMBRANE_PATH.length).toBeGreaterThan(10);
  });
});

describe('intercept field shader', () => {
  it('is GLSL ES 3.00 and declares every harvested uniform', () => {
    expect(FIELD_VS.startsWith('#version 300 es')).toBe(true);
    expect(FIELD_FS.startsWith('#version 300 es')).toBe(true);
    expect(FIELD_UNIFORMS).toEqual(['u_resolution', 'u_time', 'u_trunks', 'u_trunkState', 'u_nodes', 'u_packet', 'u_marks']);
    for (const name of FIELD_UNIFORMS) expect(FIELD_FS).toMatch(new RegExp(`uniform \\w+ ${name}[\\[;]`));
  });

  it('sizes its arrays from the model', () => {
    expect(FIELD_FS).toContain(`uniform vec4 u_trunks[${TRUNKS.length}];`);
    expect(FIELD_FS).toContain(`uniform vec2 u_trunkState[${TRUNKS.length}];`);
    expect(FIELD_FS).toContain(`uniform vec4 u_nodes[${NODE_IDS.length}];`);
  });
});

describe('intercept field uniforms', () => {
  it('preallocates buffers sized to the model', () => {
    const b = createFieldBuffers();
    expect([N_TRUNKS, N_NODES]).toEqual([22, 11]);
    expect([b.trunks.length, b.trunkState.length, b.nodes.length, b.packet.length, b.marks.length]).toEqual([88, 44, 44, 4, 2]);
  });

  it('fills trunk endpoints and node positions from the projection', () => {
    const b = createFieldBuffers();
    fillStatic(b, nodeXY);
    const [a, c] = TRUNKS[0];
    expect(Array.from(b.trunks.slice(0, 4))).toEqual([...nodeXY(a), ...nodeXY(c)].map(Math.fround));
    expect(Array.from(b.nodes.slice(0, 2))).toEqual(nodeXY(NODE_IDS[0]).map(Math.fround));
  });

  it('heats a trunk by its hotter end and marks traced trunks', () => {
    const b = createFieldBuffers();
    fillScene(b, { loads: { US: 0.25, CA: 0.75 }, kept: { UK: 0.5 }, traced: new Set([0]) });
    expect(b.trunkState[0]).toBeCloseTo(0.75);
    expect(b.trunkState[1]).toBe(1);
    const uk = NODE_IDS.indexOf('UK');
    expect(b.nodes[uk * 4 + 3]).toBeCloseTo(0.5);
    expect(b.nodes[1 * 4 + 2]).toBeCloseTo(0.75);
  });

  it('writes the packet and its marks, and clears them when it is gone', () => {
    const b = createFieldBuffers();
    fillPacket(b, { x: 10, y: 20, alive: 1, open: 1 }, { named: true, measured: false });
    expect(Array.from(b.packet)).toEqual([10, 20, 1, 1]);
    expect(Array.from(b.marks)).toEqual([1, 0]);
    fillPacket(b, null, null);
    expect(Array.from(b.packet)).toEqual([0, 0, 0, 0]);
    expect(Array.from(b.marks)).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/components/intercept/__tests__/interceptFieldPure.test.js`
Expected: FAIL, with "Failed to resolve import "../interceptGeometry"".

- [ ] **Step 3: Write the geometry**

Create `src/terminal/components/intercept/interceptGeometry.js`:

```js
// interceptGeometry.js — where the lattice sits on the WorldMap ghost
// (800 × 400 viewBox, geoNaturalEarth1). Computed once at module load.

import { toMapXY } from '../../data/worldMapPolys';
import { NODES, EU_MEMBERS } from '../../lib/interceptLattice';

const XY = Object.fromEntries(NODES.map((n) => {
  const [x, y] = toMapXY(n.lonlat[0], n.lonlat[1]);
  return [n.id, [x + n.nudge[0], y + n.nudge[1]]];
}));

export const nodeXY = (id) => XY[id];

// Andrew's monotone chain; collinear points are dropped.
export function convexHull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// The hull pushed outward from its centroid by `pad` map units.
export function membranePath(points, pad) {
  const hull = convexHull(points);
  const cx = hull.reduce((s, q) => s + q[0], 0) / hull.length;
  const cy = hull.reduce((s, q) => s + q[1], 0) / hull.length;
  const out = hull.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return [x + (dx / d) * pad, y + (dy / d) * pad];
  });
  return `M${out.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;
}

export const EU_MEMBRANE_PATH = membranePath(EU_MEMBERS.map(nodeXY), 12);
```

- [ ] **Step 4: Write the shader**

Create `src/terminal/components/intercept/interceptFieldShader.js`:

```js
// The intercept lattice's felt layer (spec §7): trunk glow, ambient beads,
// node bloom, retention rings, the packet bead. Array sizes are interpolated
// from the model so the shader and the uniform buffers cannot drift.
// Coordinates are WorldMap viewBox units (800 × 400, y down).

import { TRUNKS, NODES } from '../../lib/interceptLattice';

const N_T = TRUNKS.length;
const N_N = NODES.length;

export const FIELD_UNIFORMS = ['u_resolution', 'u_time', 'u_trunks', 'u_trunkState', 'u_nodes', 'u_packet', 'u_marks'];

export const FIELD_VS = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

export const FIELD_FS = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_trunks[${N_T}];
uniform vec2 u_trunkState[${N_T}];
uniform vec4 u_nodes[${N_N}];
uniform vec4 u_packet;
uniform vec2 u_marks;

out vec4 outColor;

const vec3 INDIGO = vec3(0.388, 0.400, 0.945);
const vec3 CYAN   = vec3(0.133, 0.827, 0.933);
const vec3 AMBER  = vec3(0.984, 0.573, 0.235);
const vec3 RED    = vec3(0.937, 0.267, 0.267);
const vec3 BONE   = vec3(1.000, 0.953, 0.878);

vec3 heatColor(float h) {
  vec3 cool = mix(INDIGO, CYAN, 0.6);
  vec3 hot = mix(AMBER, RED, smoothstep(0.5, 1.0, h));
  return mix(cool, hot, smoothstep(0.0, 0.35, h));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = vec2(uv.x * 800.0, (1.0 - uv.y) * 400.0);
  float unit = 800.0 / u_resolution.x;
  vec3 col = vec3(0.0);

  for (int i = 0; i < ${N_T}; i++) {
    vec4 t = u_trunks[i];
    vec2 ab = t.zw - t.xy;
    float len = max(length(ab), 0.001);
    float s = clamp(dot(p - t.xy, ab) / (len * len), 0.0, 1.0);
    float d = length(p - (t.xy + ab * s));
    float heat = u_trunkState[i].x;
    float traced = u_trunkState[i].y;
    float w = 0.55 + unit;
    float core = exp(-(d * d) / (2.0 * w * w));
    float halo = exp(-d / (5.0 + 5.0 * heat)) * 0.10;
    float beads = 0.0;
    for (int k = 0; k < 3; k++) {
      float ph = fract(u_time * (26.0 / len) + float(k) / 3.0 + float(i) * 0.137);
      float bd = (s - ph) * len;
      beads += exp(-(bd * bd) / 6.0);
    }
    col += heatColor(heat) * (core * (0.28 + 0.35 * traced + 0.9 * beads) + halo);
  }

  for (int n = 0; n < ${N_N}; n++) {
    vec4 nd = u_nodes[n];
    float d = length(p - nd.xy);
    float r = 2.5 + 9.0 * nd.z;
    float bloom = exp(-(d * d) / (2.0 * r * r)) * (0.18 + 0.7 * nd.z);
    float ring = nd.w * exp(-((d - 7.0) * (d - 7.0)) / 1.6) * 0.55;
    col += heatColor(nd.z) * bloom + AMBER * ring;
  }

  if (u_packet.z > 0.0) {
    float d = length(p - u_packet.xy);
    float pulse = u_marks.y > 0.5 ? 0.72 + 0.28 * sin(u_time * 5.0) : 1.0;
    float bead = exp(-(d * d) / 6.5) * 1.6 * pulse;
    float shell = u_packet.w > 0.5 ? exp(-((d - 4.0) * (d - 4.0)) / 1.2) * 0.9 : 0.0;
    float glyph = u_marks.x > 0.5 ? exp(-length(p - u_packet.xy - vec2(5.0, -5.0)) * 1.4) * 0.9 : 0.0;
    col += BONE * (bead + shell + glyph) * u_packet.z;
  }

  // Premultiplied output: every channel is <= alpha by construction.
  vec3 c = 1.0 - exp(-col);
  float a = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  outColor = vec4(c, a);
}
`;
```

- [ ] **Step 5: Write the uniform buffers**

Create `src/terminal/components/intercept/interceptFieldUniforms.js`:

```js
// Preallocated uniform buffers for the intercept field. Filled in place — no
// per-frame allocation, and the recording GL stub logs typed arrays by value.

import { NODES, TRUNKS } from '../../lib/interceptLattice';

export const N_TRUNKS = TRUNKS.length;
export const N_NODES = NODES.length;

export function createFieldBuffers() {
  return {
    trunks: new Float32Array(N_TRUNKS * 4),     // x1, y1, x2, y2
    trunkState: new Float32Array(N_TRUNKS * 2), // heat, traced
    nodes: new Float32Array(N_NODES * 4),       // x, y, load, kept
    packet: new Float32Array(4),                // x, y, alive, open
    marks: new Float32Array(2),                 // named, measured
  };
}

export function fillStatic(buf, xyOf) {
  TRUNKS.forEach(([a, b], i) => {
    const [x1, y1] = xyOf(a);
    const [x2, y2] = xyOf(b);
    buf.trunks.set([x1, y1, x2, y2], i * 4);
  });
  NODES.forEach((n, i) => {
    const [x, y] = xyOf(n.id);
    buf.nodes[i * 4] = x;
    buf.nodes[i * 4 + 1] = y;
  });
}

export function fillScene(buf, { loads = {}, kept = {}, traced = new Set() } = {}) {
  NODES.forEach((n, i) => {
    buf.nodes[i * 4 + 2] = loads[n.id] ?? 0;
    buf.nodes[i * 4 + 3] = kept[n.id] ?? 0;
  });
  TRUNKS.forEach(([a, b], i) => {
    buf.trunkState[i * 2] = Math.max(loads[a] ?? 0, loads[b] ?? 0);
    buf.trunkState[i * 2 + 1] = traced.has(i) ? 1 : 0;
  });
}

export function fillPacket(buf, state, timeline) {
  if (!state || state.alive <= 0) {
    buf.packet.fill(0);
    buf.marks.fill(0);
    return;
  }
  buf.packet[0] = state.x;
  buf.packet[1] = state.y;
  buf.packet[2] = state.alive;
  buf.packet[3] = state.open;
  buf.marks[0] = timeline?.named ? 1 : 0;
  buf.marks[1] = timeline?.measured ? 1 : 0;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/terminal/components/intercept/__tests__/interceptFieldPure.test.js`
Expected: PASS (3 + 2 + 4 = 9 tests).

- [ ] **Step 7: Commit**

```bash
git add src/terminal/components/intercept/interceptGeometry.js src/terminal/components/intercept/interceptFieldShader.js src/terminal/components/intercept/interceptFieldUniforms.js src/terminal/components/intercept/__tests__/interceptFieldPure.test.js
git commit -m "feat(surveillance): lattice geometry, field shader and uniform buffers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: InterceptField — the WebGL2 canvas on the shared harness

**Files:**
- Create: `src/terminal/components/intercept/InterceptField.jsx`
- Test: `src/terminal/components/intercept/__tests__/interceptField.test.jsx`
- Creates snapshot: `src/terminal/components/intercept/__tests__/__snapshots__/interceptField.test.jsx.snap` (first run only)

**Interfaces:**
- Consumes: `useShaderCanvas` (`src/terminal/gl/useShaderCanvas.js`), `FIELD_*` (Task 5), `fillPacket` (Task 5), `packetAt` (Task 3).
- Produces: `<InterceptField sceneRef packetRef sceneVersion onLiveChange />`, where:
  - `sceneRef.current` is a filled `createFieldBuffers()` object;
  - `packetRef.current` is `{ timeline, start }` or `null` (`start` is a `performance.now()` value);
  - `onLiveChange(bool)` reports whether GL is live.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/components/intercept/__tests__/interceptField.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { useRef } from 'react';
import { render } from '@testing-library/react';
import { driveFrames } from '../../../gl/__tests__/driveFrames';
import InterceptField from '../InterceptField';
import { FIELD_UNIFORMS } from '../interceptFieldShader';
import { createFieldBuffers, fillStatic, fillScene } from '../interceptFieldUniforms';
import { nodeXY } from '../interceptGeometry';
import { buildTimeline } from '../../../lib/interceptPacket';

function Harness({ packet = null, onLive = () => {} }) {
  const sceneRef = useRef(null);
  if (!sceneRef.current) {
    const b = createFieldBuffers();
    fillStatic(b, nodeXY);
    fillScene(b, { loads: { UK: 1 }, kept: { UK: 0.5 }, traced: new Set([1]) });
    sceneRef.current = b;
  }
  // Stamped at mount with the (faked) performance clock, as the session does.
  const packetRef = useRef(packet ? { timeline: packet.timeline, start: performance.now() } : null);
  return <InterceptField sceneRef={sceneRef} packetRef={packetRef} sceneVersion={0} onLiveChange={onLive} />;
}

const drive = (packet = null, frames = 3) =>
  driveFrames(() => {
    const out = render(<Harness packet={packet} />);
    return { unmount: out.unmount, rerender: out.rerender };
  }, { frames, version: 2 });

describe('InterceptField GL traffic (spec §3, §7, §10)', () => {
  it('harvests exactly the declared uniforms', () => {
    const names = drive().init
      .filter((l) => l.startsWith('getUniformLocation('))
      .map((l) => JSON.parse(`[${l.slice('getUniformLocation('.length, -1)}]`)[1]);
    expect(names).toEqual(FIELD_UNIFORMS);
  });

  it('draws one cleared full-screen pass per frame', () => {
    const { frames } = drive();
    expect(frames.filter((l) => l === 'drawArrays(5, 0, 4)')).toHaveLength(3);
    expect(frames.filter((l) => l === 'clearColor(0, 0, 0, 0)')).toHaveLength(3);
  });

  it('uploads trunk geometry and keeps the packet dark without a send', () => {
    const { frames } = drive();
    expect(frames.some((l) => /^uniform4fv\(".*:u_trunks", \[/.test(l))).toBe(true);
    expect(frames.some((l) => /^uniform4fv\(".*:u_packet", \[0,0,0,0\]\)$/.test(l))).toBe(true);
  });

  it('lights the packet while one is in flight', () => {
    const packet = { timeline: buildTimeline(['UK', 'US'], [], nodeXY) };
    const { frames } = drive(packet);
    const line = frames.find((l) => /^uniform4fv\(".*:u_packet", /.test(l));
    const values = JSON.parse(line.slice(line.indexOf('['), -1));
    expect(values[2]).toBe(1);
  });

  it('reports not-live when WebGL2 is unavailable', () => {
    const onLive = vi.fn();
    render(<Harness onLive={onLive} />);
    expect(onLive).toHaveBeenLastCalledWith(false);
  });

  it('freezes its call log (written on first run; a later diff is a finding)', () => {
    const { init, frames } = drive(null, 2);
    expect({ init, frames }).toMatchSnapshot();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/components/intercept/__tests__/interceptField.test.jsx`
Expected: FAIL, with "Failed to resolve import "../InterceptField"".

- [ ] **Step 3: Write the component**

Create `src/terminal/components/intercept/InterceptField.jsx`:

```jsx
// InterceptField.jsx — the felt layer of the intercept lattice (spec §3, §7).
// Reads its scene and packet through refs and never writes them. With no
// WebGL2, or a shader that fails to build, it owns no GL and reports
// not-live; the SVG overlay then draws the fallback.

import { useEffect, useRef } from 'react';
import { useShaderCanvas } from '../../gl/useShaderCanvas';
import { FIELD_VS, FIELD_FS, FIELD_UNIFORMS } from './interceptFieldShader';
import { fillPacket } from './interceptFieldUniforms';
import { packetAt } from '../../lib/interceptPacket';

const CONTEXT_OPTIONS = { alpha: true, premultipliedAlpha: true, antialias: false };

function paint(gl, U, buf, tsec) {
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.u_resolution, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.u_time, tsec);
  gl.uniform4fv(U.u_trunks, buf.trunks);
  gl.uniform2fv(U.u_trunkState, buf.trunkState);
  gl.uniform4fv(U.u_nodes, buf.nodes);
  gl.uniform4fv(U.u_packet, buf.packet);
  gl.uniform2fv(U.u_marks, buf.marks);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export default function InterceptField({ sceneRef, packetRef, sceneVersion, onLiveChange }) {
  const canvasRef = useRef(null);
  const visibleRef = useRef(true);

  const { snap, hostRef } = useShaderCanvas(canvasRef, {
    version: 2,
    contextOptions: CONTEXT_OPTIONS,
    strategy: 'lunar',
    blend: 'premultiplied',
    vs: FIELD_VS,
    fs: FIELD_FS,
    uniforms: FIELD_UNIFORMS,
    pixelSize: { w: 800, h: 400 }, // corrected by the ResizeObserver below
    setStyleSize: false,
    label: 'interceptField',
    loseContextOnDispose: true,
    watchdogMs: 40,
    trackVisibility: true,
    initialDraw: false,
    haltOnReducedMotion: true,

    // Off-screen: skip the pass and keep the last frame (frameLoop has already
    // scheduled the next one, so an early return never stalls the loop).
    // Packet time reads performance.now() — the same clock the session stamps
    // `start` with — never the rAF timestamp, whose origin can differ.
    draw(host, { now }) {
      if (!visibleRef.current) return;
      const buf = sceneRef.current;
      const pk = packetRef.current;
      const state = pk ? packetAt(pk.timeline, performance.now() - pk.start) : null;
      fillPacket(buf, state, pk ? pk.timeline : null);
      paint(host.gl, host.U, buf, now / 1000);
    },

    // Reduced motion: the loop never starts; this static frame is repainted on
    // demand. The SVG overlay carries the packet (spec §9).
    onSnap(host) {
      const buf = sceneRef.current;
      fillPacket(buf, null, null);
      paint(host.gl, host.U, buf, 0);
    },

    deps: [],
  });

  // Declared after useShaderCanvas: its effect has already built (or failed
  // to build) the host. A lost context leaves a dead canvas: report not-live.
  useEffect(() => {
    onLiveChange?.(hostRef.current != null);
    const el = canvasRef.current;
    if (!el) return undefined;
    const onLost = () => onLiveChange?.(false);
    el.addEventListener('webglcontextlost', onLost);
    return () => el.removeEventListener('webglcontextlost', onLost);
  }, [hostRef, onLiveChange]);

  // A scene change is a repaint demand under reduced motion; snap() is a
  // no-op while the loop runs.
  useEffect(() => { snap(); }, [sceneVersion, snap]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      const host = hostRef.current;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!host || !w || !h) return;
      host.resize(w, h);
      snap(); // setting canvas.width cleared the buffer
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hostRef, snap]);

  // Not document.hidden: embedded preview panes report hidden forever.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visibleRef.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-testid="intercept-field"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', mixBlendMode: 'screen' }}
    />
  );
}
```

- [ ] **Step 4: Run the test (the first run writes the new snapshot)**

Run: `npx vitest run src/terminal/components/intercept/__tests__/interceptField.test.jsx`
Expected: PASS (6 tests) and "1 snapshot written". Run it a second time and expect PASS with "1 passed" snapshot and none written.

- [ ] **Step 5: Confirm glParity is untouched**

Run: `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx`
Expected: PASS, with no snapshot written or updated.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/components/intercept/InterceptField.jsx src/terminal/components/intercept/__tests__/interceptField.test.jsx src/terminal/components/intercept/__tests__/__snapshots__/interceptField.test.jsx.snap
git commit -m "feat(surveillance): InterceptField WebGL2 layer on the shared GL harness" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Session hook, SVG overlay and the lattice composition

**Files:**
- Create: `src/terminal/components/intercept/useInterceptSession.js`
- Create: `src/terminal/components/intercept/InterceptOverlay.jsx`
- Create: `src/terminal/components/intercept/InterceptLattice.jsx`
- Test: `src/terminal/components/intercept/__tests__/interceptLattice.test.jsx`

**Interfaces:**
- Consumes: Tasks 1–3, 5, 6; `WorldMap` (`src/terminal/components/WorldMap.jsx`, which accepts `height="100%"`).
- Produces:
  - `useInterceptSession(laws)` returns `{ step, setStep, src, dst, waypoints, path, activate(id, {bend}) → 'src'|'dst'|'bend'|'reset'|null, fate, words, hop, marks:{read:string[], watch:string|null}, traced:number[], kept:{[id]:number}, packetRef }`.
  - `KEPT_CAP = 12`, `WORD_MS = 1600`.
  - `<InterceptLattice laws highlightLaw onNodeSelect />`. `onNodeSelect(nodeId|null)` fires on every node activation, with `null` on reset.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/components/intercept/__tests__/interceptLattice.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import laws from '../../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import InterceptLattice from '../InterceptLattice';
import { WORD_MS } from '../useInterceptSession';

const node = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const fate = () => screen.getByTestId('fate-line').textContent;
const setStep = (i) => fireEvent.change(screen.getByLabelText('legislative time'), { target: { value: String(i) } });

afterEach(() => { vi.useRealTimers(); });

describe('InterceptLattice (spec §5, §6, §8, §9)', () => {
  it('opens at now with the pinned readout', () => {
    render(<InterceptLattice laws={laws} />);
    expect(screen.getByLabelText('legislative time').value).toBe('3');
    expect(screen.getByTestId('lattice-readout').textContent).toBe('in force 30 / 44 · unread 1 · unkept none · unnamed none');
    expect(fate()).toBe('choose where it leaves · then where it lands');
  });

  it('moves the readout with the ratchet', () => {
    render(<InterceptLattice laws={laws} />);
    setStep(1);
    expect(screen.getByTestId('lattice-readout').textContent).toBe('in force 18 / 44 · unread 3 · unkept 6 · unnamed 18');
  });

  it('sends a packet between two clicked nodes and re-sends on a ratchet move', () => {
    const onNodeSelect = vi.fn();
    render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
    setStep(0);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    expect(fate()).toBe('canada → new zealand · 2 hops · arrived. unseen.');
    setStep(5);
    expect(fate()).toBe('canada → new zealand · 2 hops · seen, named, measured, watched before leaving · read at canada, united states · kept at canada, united states · traced at canada');
    expect(onNodeSelect.mock.calls.map((c) => c[0])).toEqual(['CA', 'NZ']);
  });

  it('bends the route through a waypoint with shift, and resets on the source', () => {
    const onNodeSelect = vi.fn();
    render(<InterceptLattice laws={laws} onNodeSelect={onNodeSelect} />);
    setStep(0);
    fireEvent.keyDown(node('canada'), { key: 'Enter' });
    fireEvent.keyDown(node('new zealand'), { key: 'Enter' });
    fireEvent.keyDown(node('australia'), { key: 'Enter', shiftKey: true });
    expect(fate()).toBe('canada → new zealand · 3 hops · arrived. unseen.');
    fireEvent.click(node('canada'));
    expect(fate()).toBe('choose where it leaves · then where it lands');
    expect(onNodeSelect).toHaveBeenLastCalledWith(null);
  });

  it('flashes each word at its node, then lets it fade', () => {
    vi.useFakeTimers();
    const { container } = render(<InterceptLattice laws={laws} />);
    setStep(5);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    act(() => { vi.advanceTimersByTime(0); });
    expect(container.querySelector('[data-word="digitalId"]').textContent).toBe('named');
    act(() => { vi.advanceTimersByTime(WORD_MS + 1); });
    expect(container.querySelector('[data-word="digitalId"]')).toBeNull();
  });

  it('draws the SVG fallback bead when WebGL2 is unavailable', () => {
    render(<InterceptLattice laws={laws} />);
    fireEvent.click(node('canada'));
    fireEvent.click(node('new zealand'));
    expect(screen.getByTestId('fallback-bead')).toBeTruthy();
  });

  it('lights the nodes of a hovered ledger law — all six members for an EU law', () => {
    const euLaw = laws.find((l) => l.location === 'EU');
    const { container } = render(<InterceptLattice laws={laws} highlightLaw={euLaw} />);
    const lit = [...container.querySelectorAll('[data-node][data-highlight="true"]')].map((n) => n.getAttribute('data-node'));
    expect(lit.sort()).toEqual(['BE', 'DE', 'FR', 'IE', 'NL', 'SE']);
    expect(screen.getByTestId('eu-membrane').getAttribute('data-highlight')).toBe('true');
  });

  it('shows flickering ticks for CHALLENGED laws at now only', () => {
    const { container } = render(<InterceptLattice laws={laws} />);
    expect(container.querySelectorAll('[data-node="CA"] [data-state="flicker"]')).toHaveLength(3);
    setStep(4);
    expect(container.querySelectorAll('[data-node="CA"] [data-state="flicker"]')).toHaveLength(0);
  });

  it('keeps the legend honest', () => {
    render(<InterceptLattice laws={laws} />);
    expect(screen.getByText(/each word marks what the law permits, not what happened/)).toBeTruthy();
    expect(screen.getByText(/country-level connectivity, not cable routes/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/components/intercept/__tests__/interceptLattice.test.jsx`
Expected: FAIL, with "Failed to resolve import "../InterceptLattice"".

- [ ] **Step 3: Write the session hook**

Create `src/terminal/components/intercept/useInterceptSession.js`:

```js
// useInterceptSession.js — the visitor's side of the lattice: which route,
// which moment in legislative time, what the last packet went through.
// All state is component-local and dies with the tab (spec §1, §7) — nothing
// reaches storage, the network, the spine or the panopticon store.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NOW_STEP, route, lawsFiring, packetFate, fateLine, trunkIndex,
} from '../../lib/interceptLattice';
import { buildTimeline } from '../../lib/interceptPacket';
import { nodeXY } from './interceptGeometry';

export const KEPT_CAP = 12;
export const WORD_MS = 1600;

const clearTimers = (ref) => {
  ref.current.forEach(clearTimeout);
  ref.current = [];
};

export function useInterceptSession(laws) {
  const [step, setStep] = useState(NOW_STEP);
  const [src, setSrc] = useState(null);
  const [dst, setDst] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [fate, setFate] = useState('');
  const [words, setWords] = useState([]);
  const [hop, setHop] = useState(null);
  const [marks, setMarks] = useState({ read: [], watch: null });
  const [traced, setTraced] = useState([]);
  const [kept, setKept] = useState({});
  const seqRef = useRef(0);
  const wordIdRef = useRef(0);
  const timersRef = useRef([]);
  const packetRef = useRef(null);

  useEffect(() => () => clearTimers(timersRef), []);

  const path = useMemo(() => (src && dst ? route(src, dst, waypoints) : null), [src, dst, waypoints]);

  // Every change of route, detent or corpus is a new send (spec §5).
  useEffect(() => {
    clearTimers(timersRef);
    setWords((w) => (w.length ? [] : w));
    if (!path || path.length < 2) {
      packetRef.current = null;
      setFate('');
      setHop(null);
      setMarks({ read: [], watch: null });
      return;
    }
    seqRef.current += 1;
    const events = packetFate(path, lawsFiring(laws, step, seqRef.current));
    setFate(fateLine(path, events));
    setMarks({
      read: [...new Set(events.filter((e) => e.key === 'backdoor').map((e) => e.node))],
      watch: events.some((e) => e.key === 'worker') ? path[0] : null,
    });

    const keptNodes = [...new Set(events.filter((e) => e.key === 'retain').map((e) => e.node))];
    if (keptNodes.length) {
      setKept((k) => {
        const next = { ...k };
        for (const id of keptNodes) next[id] = Math.min(KEPT_CAP, (next[id] ?? 0) + 1);
        return next;
      });
    }
    const tracedIdx = [];
    for (const e of events) {
      if (e.key !== 'traffic') continue;
      for (const other of [path[e.hop - 1], path[e.hop + 1]]) {
        const i = other ? trunkIndex(e.node, other) : -1;
        if (i >= 0) tracedIdx.push(i);
      }
    }
    if (tracedIdx.length) setTraced((t) => [...new Set([...t, ...tracedIdx])]);

    const tl = buildTimeline(path, events, nodeXY);
    packetRef.current = { timeline: tl, start: performance.now() };
    setHop(0);
    tl.hopTimes.forEach((t, h) => {
      if (h > 0) timersRef.current.push(setTimeout(() => setHop(h), t));
    });
    for (const cue of tl.cues) {
      wordIdRef.current += 1;
      const id = wordIdRef.current;
      timersRef.current.push(setTimeout(() => setWords((w) => [...w, { id, node: cue.node, word: cue.word, key: cue.key }]), cue.t));
      timersRef.current.push(setTimeout(() => setWords((w) => w.filter((x) => x.id !== id)), cue.t + WORD_MS));
    }
  }, [path, step, laws]);

  // First click picks the source, second the destination; a bend adds a
  // waypoint; clicking the source again clears the route (spec §9).
  const activate = useCallback((id, { bend = false } = {}) => {
    if (!src) { setSrc(id); return 'src'; }
    if (id === src) { setSrc(null); setDst(null); setWaypoints([]); return 'reset'; }
    if (!dst) { setDst(id); return 'dst'; }
    if (bend) {
      if (id === dst || waypoints.includes(id)) return null;
      setWaypoints((w) => [...w, id]);
      return 'bend';
    }
    setSrc(id); setDst(null); setWaypoints([]);
    return 'src';
  }, [src, dst, waypoints]);

  return { step, setStep, src, dst, waypoints, path, activate, fate, words, hop, marks, traced, kept, packetRef };
}
```

- [ ] **Step 4: Write the overlay**

Create `src/terminal/components/intercept/InterceptOverlay.jsx`:

```jsx
// InterceptOverlay.jsx — the SVG layer of the intercept lattice (spec §3, §5,
// §9). Everything clickable, focusable or textual lives here; the WebGL field
// underneath only glows. Coordinates are WorldMap viewBox units.

import { useRef, useState } from 'react';
import { NODES, TRUNKS, TAPS } from '../../lib/interceptLattice';
import { nodeXY, EU_MEMBRANE_PATH } from './interceptGeometry';

const FAMILY_COLOR = {
  scan: '#f87171', backdoor: '#f87171',
  retain: '#fb923c', traffic: '#fb923c',
  digitalId: '#facc15', age: '#facc15', biometric: '#facc15', worker: '#facc15',
};
const BEND_RADIUS = 36;

function toMapPoint(svg, clientX, clientY) {
  if (!svg?.createSVGPoint || !svg.getScreenCTM) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const { x, y } = pt.matrixTransform(ctm.inverse());
  return [x, y];
}

function nearestNode([x, y], exclude) {
  let best = null;
  let bestD = BEND_RADIUS;
  for (const n of NODES) {
    if (exclude.includes(n.id)) continue;
    const [nx, ny] = nodeXY(n.id);
    const d = Math.hypot(nx - x, ny - y);
    if (d < bestD) { bestD = d; best = n.id; }
  }
  return best;
}

export default function InterceptOverlay({
  path, src, dst, waypoints, ticks, words, hop, showBead, showFallbackGlow,
  loads, kept, keptCap, marks, traced, highlight, euHighlight, onActivate,
}) {
  const svgRef = useRef(null);
  const pointerTypeRef = useRef('mouse');
  const [dragging, setDragging] = useState(false);
  const [bendPreview, setBendPreview] = useState(null);
  const pts = path ? path.map(nodeXY) : [];
  const polyPoints = pts.map((p) => p.join(',')).join(' ');

  const onMove = (e) => {
    if (!dragging) return;
    const p = toMapPoint(svgRef.current, e.clientX, e.clientY);
    setBendPreview(p ? nearestNode(p, [src, dst, ...waypoints]) : null);
  };
  const endDrag = () => {
    if (dragging && bendPreview) onActivate(bendPreview, { bend: true });
    setDragging(false);
    setBendPreview(null);
  };

  const stack = {};

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 800 400"
      className="absolute inset-0 w-full h-full"
      style={{ touchAction: dragging ? 'none' : 'auto' }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      data-testid="intercept-overlay"
    >
      <path
        d={EU_MEMBRANE_PATH}
        fill="#fb923c" fillOpacity={euHighlight ? 0.14 : 0.04}
        stroke="#fb923c" strokeOpacity={euHighlight ? 0.45 : 0.12}
        strokeWidth="0.6" strokeDasharray="2 3"
        data-testid="eu-membrane" data-highlight={euHighlight ? 'true' : 'false'}
      />

      {traced.map((i) => {
        const [a, b] = TRUNKS[i];
        const [x1, y1] = nodeXY(a);
        const [x2, y2] = nodeXY(b);
        return <line key={`traced-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fb923c" strokeOpacity="0.5" strokeWidth="0.7" strokeDasharray="1 2.5" />;
      })}

      {pts.length > 1 && (
        <g>
          <polyline points={polyPoints} fill="none" stroke="#fde68a" strokeOpacity="0.75" strokeWidth="0.8" strokeLinejoin="round" data-testid="route-filament" />
          <polyline
            points={polyPoints} fill="none" stroke="transparent" strokeWidth="12"
            style={{ cursor: 'grab', pointerEvents: 'stroke' }}
            onPointerDown={(e) => { e.preventDefault(); setDragging(true); }}
          />
        </g>
      )}

      {bendPreview && (() => {
        const [x, y] = nodeXY(bendPreview);
        return <circle cx={x} cy={y} r="10" fill="none" stroke="#fde68a" strokeOpacity="0.6" strokeDasharray="2 2" />;
      })()}

      {NODES.map((n) => {
        const [x, y] = nodeXY(n.id);
        const role = n.id === src ? 'source' : n.id === dst ? 'destination' : waypoints.includes(n.id) ? 'waypoint' : null;
        const tickList = ticks[n.id] ?? [];
        const count = tickList.filter(Boolean).length;
        const lit = highlight.has(n.id);
        const load = loads[n.id] ?? 0;
        const k = kept[n.id] ?? 0;
        return (
          <g
            key={n.id}
            role="button"
            tabIndex={0}
            aria-label={`${n.name} · ${count} ${count === 1 ? 'tap' : 'taps'} in force${role ? ` · ${role}` : ''}`}
            data-node={n.id}
            data-highlight={lit ? 'true' : 'false'}
            style={{ cursor: 'pointer', outline: 'none' }}
            onPointerUp={(e) => { pointerTypeRef.current = e.pointerType || 'mouse'; }}
            onClick={(e) => onActivate(n.id, { bend: e.shiftKey || pointerTypeRef.current === 'touch' })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate(n.id, { bend: e.shiftKey });
              }
            }}
          >
            <title>{n.name}</title>
            <circle cx={x} cy={y} r="14" fill="transparent" />
            {showFallbackGlow && <circle cx={x} cy={y} r={3 + 8 * load} fill="#fb923c" fillOpacity={0.12 + 0.3 * load} />}
            {showFallbackGlow && k > 0 && (
              <circle cx={x} cy={y} r="7" fill="none" stroke="#fb923c" strokeOpacity={0.15 + 0.5 * (k / keptCap)} strokeWidth="0.8" />
            )}
            {tickList.map((state, i) => {
              if (!state) return null;
              const ang = ((i * 45 - 90) * Math.PI) / 180;
              const c = Math.cos(ang);
              const s = Math.sin(ang);
              return (
                <line
                  key={TAPS[i].key}
                  x1={x + c * 4} y1={y + s * 4} x2={x + c * 7} y2={y + s * 7}
                  stroke={FAMILY_COLOR[TAPS[i].key]} strokeOpacity={state === 'on' ? 0.85 : 0.5}
                  strokeWidth="0.9" strokeLinecap="round"
                  className={state === 'flicker' ? 'iv-flicker' : undefined}
                  data-tick={TAPS[i].key} data-state={state}
                />
              );
            })}
            <circle cx={x} cy={y} r={role ? 2.8 : 2} fill={role ? '#fde68a' : '#fdba74'} />
            {lit && <circle className="iv-pulse" cx={x} cy={y} r="10" fill="none" stroke="#fdba74" strokeWidth="0.8" />}
            {marks.watch === n.id && (
              <circle cx={x} cy={y} r="9.5" fill="none" stroke="#f87171" strokeOpacity="0.55" strokeWidth="0.7" data-mark="watched" />
            )}
            {marks.read.includes(n.id) && (
              <circle cx={x + 6.5} cy={y} r="1.1" fill="#fca5a5" data-mark="read">
                <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="5s" repeatCount="indefinite" />
              </circle>
            )}
            <text x={x} y={y + 15} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#fed7aa" fillOpacity="0.5" style={{ pointerEvents: 'none' }}>
              {n.id}
            </text>
          </g>
        );
      })}

      {showBead && path && path.length > 1 && hop != null && (() => {
        const [x, y] = nodeXY(path[Math.min(hop, path.length - 1)]);
        return <circle cx={x} cy={y} r="2.6" fill="#fff7ed" data-testid="fallback-bead" />;
      })()}

      {words.map((w) => {
        const [x, y] = nodeXY(w.node);
        stack[w.node] = (stack[w.node] ?? -1) + 1;
        return (
          <text
            key={w.id} className="iv-word"
            x={x} y={y - 11 - stack[w.node] * 8}
            textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#fff7ed"
            style={{ pointerEvents: 'none' }}
            data-word={w.key}
          >
            {w.word}
          </text>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 5: Write the composition**

Create `src/terminal/components/intercept/InterceptLattice.jsx`:

```jsx
// InterceptLattice.jsx — /SURVEILLANCE's hero: a jurisdiction lattice the
// visitor sends a packet through while the laws in force act on it
// (docs/superpowers/specs/2026-09-25-surveillance-intercept-lattice-design.md).
// Map ghost at the bottom, the WebGL field in the middle, the SVG overlay on top.

import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import WorldMap from '../WorldMap';
import InterceptField from './InterceptField';
import InterceptOverlay from './InterceptOverlay';
import { useInterceptSession, KEPT_CAP, WORD_MS } from './useInterceptSession';
import { createFieldBuffers, fillStatic, fillScene } from './interceptFieldUniforms';
import { nodeXY } from './interceptGeometry';
import {
  NODE_IDS, STEPS, lawNodes, lawsInForce, nodeLoad, tickStates, familyReadout, formatCount,
} from '../../lib/interceptLattice';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STYLE = `
  @keyframes iv-word { 0% { opacity: 0; } 8% { opacity: 1; } 70% { opacity: 0.9; } 100% { opacity: 0; } }
  @keyframes iv-flicker { 0%, 100% { opacity: 0.2; } 18% { opacity: 0.9; } 22% { opacity: 0.25; } 57% { opacity: 0.75; } 63% { opacity: 0.2; } }
  @keyframes iv-pulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }
  .iv-word { animation: iv-word ${WORD_MS}ms linear forwards; }
  .iv-flicker { animation: iv-flicker 2.6s steps(1, end) infinite; }
  .iv-pulse { animation: iv-pulse 1.4s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { .iv-flicker, .iv-pulse { animation: none; } }
`;

const NO_LAWS = [];

export default function InterceptLattice({ laws = NO_LAWS, highlightLaw = null, onNodeSelect }) {
  const s = useInterceptSession(laws);
  const [glLive, setGlLive] = useState(false);
  const [reducedMotion] = useState(prefersReducedMotion);

  const sceneRef = useRef(null);
  if (!sceneRef.current) {
    sceneRef.current = createFieldBuffers();
    fillStatic(sceneRef.current, nodeXY);
  }

  const inForce = useMemo(() => lawsInForce(laws, s.step), [laws, s.step]);
  const loadScale = useMemo(() => Math.max(1, ...NODE_IDS.map((n) => nodeLoad(n, laws))), [laws]);
  const loads = useMemo(
    () => Object.fromEntries(NODE_IDS.map((n) => [n, nodeLoad(n, inForce) / loadScale])),
    [inForce, loadScale],
  );
  const ticks = useMemo(
    () => Object.fromEntries(NODE_IDS.map((n) => [n, tickStates(n, laws, s.step)])),
    [laws, s.step],
  );
  const readout = useMemo(() => familyReadout(laws, s.step), [laws, s.step]);
  const highlight = useMemo(() => new Set(highlightLaw ? lawNodes(highlightLaw) : []), [highlightLaw]);

  const { kept, traced } = s;
  // Layout effect: it must fill the buffer before the child InterceptField's
  // passive snap() repaints under reduced motion, or that frame lags a detent.
  useLayoutEffect(() => {
    fillScene(sceneRef.current, {
      loads,
      kept: Object.fromEntries(Object.entries(kept).map(([id, n]) => [id, n / KEPT_CAP])),
      traced: new Set(traced),
    });
  }, [loads, kept, traced]);
  const sceneVersion = `${s.step}:${Object.values(kept).join(',')}:${traced.length}`;

  const activate = (id, opts) => {
    const r = s.activate(id, opts);
    if (r) onNodeSelect?.(r === 'reset' ? null : id);
  };

  return (
    <section className="mb-6 border border-orange-900/20 bg-black/30 rounded-sm p-3" aria-label="intercept lattice">
      <style>{STYLE}</style>
      <div className="relative w-full" style={{ aspectRatio: '2 / 1' }}>
        <div className="absolute inset-0 opacity-60">
          <WorldMap palette="orange" height="100%" scanDur={9} />
        </div>
        <InterceptField sceneRef={sceneRef} packetRef={s.packetRef} sceneVersion={sceneVersion} onLiveChange={setGlLive} />
        <InterceptOverlay
          path={s.path} src={s.src} dst={s.dst} waypoints={s.waypoints}
          ticks={ticks} words={s.words} hop={s.hop}
          showBead={!glLive || reducedMotion} showFallbackGlow={!glLive}
          loads={loads} kept={kept} keptCap={KEPT_CAP}
          marks={s.marks} traced={traced}
          highlight={highlight} euHighlight={highlightLaw?.location === 'EU'}
          onActivate={activate}
        />
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <input
          type="range" min={0} max={STEPS.length - 1} step={1} value={s.step}
          onChange={(e) => s.setStep(Number(e.target.value))}
          aria-label="legislative time" aria-valuetext={STEPS[s.step].id}
          className="w-full accent-orange-500 cursor-pointer"
        />
        <div className="flex justify-between text-[9px] font-mono lowercase">
          {STEPS.map((st, i) => (
            <span key={st.id} className={i === s.step ? 'text-orange-300' : 'text-orange-400/35'}>{st.id}</span>
          ))}
        </div>
      </div>

      <div data-testid="lattice-readout" className="mt-2 text-[10px] font-mono lowercase text-orange-300/80 tabular-nums">
        {`in force ${inForce.length} / ${laws.length} · unread ${formatCount(readout.unread)} · unkept ${formatCount(readout.unkept)} · unnamed ${formatCount(readout.unnamed)}`}
      </div>
      <p data-testid="fate-line" aria-live="polite" className="mt-2 text-[11px] font-mono lowercase text-orange-200/90 min-h-[1.25rem]">
        {s.fate || 'choose where it leaves · then where it lands'}
      </p>
      <p className="mt-1 text-[9px] font-mono lowercase text-orange-400/35">
        each word marks what the law permits, not what happened · within this corpus · country-level connectivity, not cable routes
      </p>
    </section>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/terminal/components/intercept/__tests__/interceptLattice.test.jsx`
Expected: PASS (9 tests). jsdom may log "Not implemented: HTMLCanvasElement.prototype.getContext". That is expected, because it is exactly the no-WebGL fallback path.

- [ ] **Step 7: Lint the new files**

Run: `npx eslint src/terminal/components/intercept`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/components/intercept/useInterceptSession.js src/terminal/components/intercept/InterceptOverlay.jsx src/terminal/components/intercept/InterceptLattice.jsx src/terminal/components/intercept/__tests__/interceptLattice.test.jsx
git commit -m "feat(surveillance): intercept lattice — session, SVG overlay, ratchet and fate line" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Compose the lattice into SurveillanceTab, link the ledger, prove the compile invariant

**Files:**
- Modify: `src/terminal/views/SurveillanceTab.jsx`
- Modify: `src/terminal/views/__tests__/SurveillanceTab.test.jsx`

**Interfaces:**
- Consumes: `<InterceptLattice laws highlightLaw onNodeSelect />` (Task 7); the Task 4 test hooks.
- Produces: the finished tab.

- [ ] **Step 1: Add the failing tests**

In `src/terminal/views/__tests__/SurveillanceTab.test.jsx`, replace the import block at the top:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import laws from '../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import SurveillanceTab from '../SurveillanceTab';
```
with:
```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import laws from '../../lib/__tests__/fixtures/legislation-sealed-2026-03-09.json';
import SurveillanceTab from '../SurveillanceTab';
import { setPanopticonCorpus } from '../../lib/panopticon';

vi.mock('../../lib/panopticon', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, setPanopticonCorpus: vi.fn(real.setPanopticonCorpus) };
});
```

Append to the end of the file:

```jsx
describe('SurveillanceTab lattice + linked ledger (spec §1, §8)', () => {
  it('puts the lattice above the ledger and drops the old stats row', () => {
    renderTab();
    expect(screen.getByRole('region', { name: 'intercept lattice' })).toBeTruthy();
    expect(screen.queryByText('Critical 5/5')).toBeNull();
  });

  it('lights a hovered card’s nodes on the lattice', () => {
    const { container } = renderTab();
    const dsa = cards().find((c) => c.textContent.includes('DIGITAL SERVICES ACT'));
    fireEvent.mouseEnter(dsa);
    const lit = [...container.querySelectorAll('[data-node][data-highlight="true"]')].map((n) => n.getAttribute('data-node'));
    expect(lit.sort()).toEqual(['BE', 'DE', 'FR', 'IE', 'NL', 'SE']);
    fireEvent.mouseLeave(dsa);
    expect(container.querySelectorAll('[data-node][data-highlight="true"]')).toHaveLength(0);
  });

  it('filters the ledger to the node last touched, and back to all on reset', () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: /^united kingdom/ }));
    expect(screen.getByLabelText(/region/i).value).toBe('UK');
    expect(cards()).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /^united kingdom/ }));
    expect(screen.getByLabelText(/region/i).value).toBe('ALL');
    expect(cards()).toHaveLength(44);
  });

  it('never registers a corpus or writes storage, and keeps the sealed index', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderTab();
    fireEvent.change(screen.getByLabelText('legislative time'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /^canada/ }));
    fireEvent.click(screen.getByRole('button', { name: /^new zealand/ }));
    expect(setPanopticonCorpus).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(screen.getByTestId('panopticon-score').textContent).toBe('61');
    setItem.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/terminal/views/__tests__/SurveillanceTab.test.jsx`
Expected: the 18 Task 4 tests PASS. The 4 new tests FAIL, with "Unable to find role="region" and name "intercept lattice"" and similar.

- [ ] **Step 3: Swap the imports**

In `src/terminal/views/SurveillanceTab.jsx`, replace:

```jsx
import WorldMap from '../components/WorldMap';
import { toMapXY } from '../data/worldMapPolys';
```
with:
```jsx
import InterceptLattice from '../components/intercept/InterceptLattice';
```

Delete these blocks entirely:
- the `REGION_LONLAT` constant with its comment;
- the `REGION_NUDGE` constant with its comment;
- the `SEV_HEX` constant with its comment;
- the `regionThreats` useMemo with its `// ── Threat map: per-region max severity` comment;
- the `critCount` and `highCount` lines.

- [ ] **Step 4: Add hover state**

Directly after `const [minSev,   setMinSev]   = useState(0);`, add:

```jsx
  const [hoverLaw, setHoverLaw] = useState(null);
```

- [ ] **Step 5: Replace the stats row and the threat map with the lattice**

Delete the `{/* ── Stats row ── */}` block (the `<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">…</div>`). Replace the whole `{/* ── Threat map SVG ── */}` block (the `{legislationArticles.length > 0 && ( … )}` expression) with:

```jsx
      {/* ── Intercept lattice (spec §3–§9) ────────────────────────────────── */}
      <InterceptLattice
        laws={legislationArticles}
        highlightLaw={hoverLaw}
        onNodeSelect={(id) => setRegion(id ?? 'ALL')}
      />
```

- [ ] **Step 6: Link the cards to the lattice**

On the card's outer `<div key={law.id} …>`, add these handlers next to `onClick`:

```jsx
                onMouseEnter={() => setHoverLaw(law)}
                onMouseLeave={() => setHoverLaw(null)}
                onFocus={() => setHoverLaw(law)}
                onBlur={() => setHoverLaw(null)}
                tabIndex={0}
```

- [ ] **Step 7: Run the tab tests to verify they pass**

Run: `npx vitest run src/terminal/views/__tests__/SurveillanceTab.test.jsx`
Expected: PASS (22 tests).

- [ ] **Step 8: Run the compile-path suites and the whole suite**

Run: `npx vitest run tests/panopticon.test.js tests/sovereignty.test.js`
Expected: PASS, unchanged.

Run: `npm test`
Expected: all test files pass, and no snapshot is written except that the Task 6 snapshot is already present.

- [ ] **Step 9: Lint**

Run: `npm run lint`
Expected: exit 0, with 0 errors and warnings ≤ 153.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/views/SurveillanceTab.jsx src/terminal/views/__tests__/SurveillanceTab.test.jsx
git commit -m "feat(surveillance): the intercept lattice replaces the threat map; ledger linked both ways" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verify in the browser

No new code, unless verification finds a defect. In that case, fix it with a failing test first, and commit that fix separately.

**Files:** none planned.

- [ ] **Step 1: Start the dev server**

Use the preview tool: `preview_start` with `{ name: "scale94-dev" }` (port 5174). In the page, run:
```js
(await navigator.serviceWorker?.getRegistrations?.() ?? []).forEach(r => r.unregister());
location.reload();
```
Open the Surveillance tab from the nav. The nav button name contains "Surveillance"; use `find` to locate it.

- [ ] **Step 2: Check the shader built**

Read the console messages, filtered by `interceptField`.
Expected: no "[interceptField] … failed to compile/link" error. If one appears, the log names the GLSL line: fix `interceptFieldShader.js`, keep the Task 5 tests green, and commit.

- [ ] **Step 3: Look before judging**

Take a screenshot of the lattice. Confirm all of the following:
- trunks glow cool, and the ones touching tapped nodes run warm;
- ambient beads flow along the trunks;
- ticks are visible around the nodes;
- the EU membrane is faint.

Only if the pane is hidden, where screenshots time out, verify through `getComputedStyle` and DOM probes instead.

- [ ] **Step 4: Drive the loop**
- Click Canada, then New Zealand. The bead travels over the US, words appear, and the fate line matches the test strings for the current detent.
- Drag the filament toward Australia. The route bends, and the fate line shows 3 hops.
- Scrub the ratchet from `before` to `proposed`. At `before` the line reads `arrived. unseen.`
- Hover an EU card in the ledger. Six nodes and the membrane light up.

- [ ] **Step 5: Check at phone width**

`resize_window` with preset `mobile`, then reload. Confirm there is no horizontal page scroll, nodes can be tapped, and the detent labels fit. Then reset with preset `desktop`.

- [ ] **Step 6: Confirm the compile invariant live**

In the page, run:
```js
const p = await import('/src/terminal/lib/panopticon.js');
p.getPanopticonState();
```
Expected: `{ index: 61, lawCount: 44 }`, both before and after using the lattice. Then crystallize one card in the LatentCollider on the /SCALING tab, and run:
```js
(await import('/src/terminal/lib/sovereignty.js')).getLastAssessment();
```
Expected: an assessment computed from panopticon index 61, the same as on `main`.

- [ ] **Step 7: Report**

Summarise for the user: screenshots, the fate lines observed, the invariant values, and any tuning candidates (nudges in the European cluster, bead speed, glow widths). Visual tuning is a follow-up with the user, not part of this task. Do not push.
