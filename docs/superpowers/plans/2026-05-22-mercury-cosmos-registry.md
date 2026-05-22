# Mercury Cosmos Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Mercury Terminal tab so the alien architect's philosophical layer encompasses the entire site — a new Cosmos Registry section (five poetic-taxonomy cards with live state) and an Observation Log fed by a cross-site event bus.

**Architecture:** A tiny vanilla event bus (`observatoryBus.js`) lives at `src/observatory/` and is imported directly by every feature that wants to publish (`emit(category, kind, payload)`). Mercury subscribes via a React hook (`useObservatoryState`) and renders five `RegistryCard`s plus an extended `ObservationMatrix`. No global state library, no React context — just a Set of listeners and an in-memory totals reducer.

**Tech Stack:** React 18, Vite, Vitest, Tailwind (existing site stack). No new dependencies.

**Spec:** [docs/superpowers/specs/2026-05-22-mercury-cosmos-registry-design.md](docs/superpowers/specs/2026-05-22-mercury-cosmos-registry-design.md)

---

## File map

**New files (6):**
- `src/observatory/observatoryBus.js` — emit / subscribe / totals / journal
- `src/observatory/useObservatoryState.js` — React hook over the bus
- `src/observatory/__tests__/observatoryBus.test.js` — unit tests
- `src/terminal/mercury/registryCategories.js` — the five category definitions
- `src/terminal/mercury/RegistryCard.jsx` — one category card
- `src/terminal/mercury/CosmosRegistry.jsx` — §D grid

**Modified files (~10):**
- `src/terminal/mercury/observationLog.js` — +30 lines of alien-voice phrases, new categories
- `src/terminal/mercury/ObservationMatrix.jsx` — bus subscription, filter chips, expanded markdown export
- `src/terminal/views/MercuryTab.jsx` — mount `<CosmosRegistry />` between castles and log
- `src/terminal/App.jsx` — emit on tab nav, kernel run, kernel load, gate result, polarity shift
- `src/terminal/views/LatentCollider.jsx` — emit `essences/collision_fired`
- `src/terminal/components/MercuryEyeIndicator.jsx` — emit `edge/eye_phase`
- `src/terminal/components/GateOverlay.jsx` — left untouched (App.jsx wraps its onResult)
- `src/terminal/views/LunarTab.jsx` — emit `gaze/lunar_read` on first mount per session
- `src/terminal/views/ledger/SubmissionForm.jsx` — emit `transmissions/ledger_appended`
- `src/terminal/utils/preExecTheater.js` — Phase B `// TODO` stub

---

## Task 1: Event bus core

**Files:**
- Create: `src/observatory/observatoryBus.js`
- Create: `src/observatory/__tests__/observatoryBus.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/observatory/__tests__/observatoryBus.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { emit, subscribe, getTotals, getJournal, _resetForTests } from '../observatoryBus';

describe('observatoryBus', () => {
  beforeEach(() => { _resetForTests(); });

  it('subscribers receive emitted events', () => {
    const received = [];
    const unsub = subscribe(evt => received.push(evt));
    emit('transmissions', 'kernel_completed', { kernelId: 'foo', durationMs: 100 });
    expect(received).toHaveLength(1);
    expect(received[0].category).toBe('transmissions');
    expect(received[0].kind).toBe('kernel_completed');
    expect(received[0].payload.kernelId).toBe('foo');
    expect(typeof received[0].ts).toBe('number');
    unsub();
  });

  it('unsubscribe stops further deliveries', () => {
    const received = [];
    const unsub = subscribe(evt => received.push(evt));
    unsub();
    emit('transmissions', 'kernel_completed', {});
    expect(received).toHaveLength(0);
  });

  it('totals.transmissions accumulates kernel_completed', () => {
    emit('transmissions', 'kernel_completed', { kernelId: 'a', durationMs: 10 });
    emit('transmissions', 'kernel_completed', { kernelId: 'b', durationMs: 20 });
    expect(getTotals().transmissions.count).toBe(2);
    expect(getTotals().transmissions.last.payload.kernelId).toBe('b');
  });

  it('totals.transmissions.ledgerDepth tracks ledger_appended payload depth', () => {
    emit('transmissions', 'ledger_appended', { depth: 5 });
    emit('transmissions', 'ledger_appended', { depth: 6 });
    expect(getTotals().transmissions.ledgerDepth).toBe(6);
  });

  it('totals.essences tracks collisions, polarity, crystallized separately', () => {
    emit('essences', 'collision_fired', { polarity: 'LUNAR', noteCount: 4 });
    emit('essences', 'collision_fired', { polarity: 'SOLAR', noteCount: 3 });
    emit('essences', 'crystallized',    { });
    emit('essences', 'polarity_shifted',{ polarity: 'CHAOTIC' });
    const t = getTotals().essences;
    expect(t.count).toBe(2);
    expect(t.crystallized).toBe(1);
    expect(t.polarity).toBe('CHAOTIC');
  });

  it('totals.ciphers tracks sealed / verifies / unlocks', () => {
    emit('ciphers', 'cipher_sealed', {});
    emit('ciphers', 'cipher_sealed', {});
    emit('ciphers', 'verify', {});
    emit('ciphers', 'unlock', {});
    const t = getTotals().ciphers;
    expect(t.sealed).toBe(2);
    expect(t.verifies).toBe(1);
    expect(t.unlocks).toBe(1);
  });

  it('totals.gaze tracks sphereClicks and last events', () => {
    emit('gaze', 'sphere_clicked', { sphere: 'TFG' });
    emit('gaze', 'lunar_read', { phase: 'waxing crescent', illum: 0.23 });
    expect(getTotals().gaze.sphereClicks).toBe(1);
    expect(getTotals().gaze.lastLunar.phase).toBe('waxing crescent');
  });

  it('totals.edge tracks gate, eye, manifesto chapter', () => {
    emit('edge', 'gate_answered', { result: 'BLESSED' });
    emit('edge', 'eye_phase', { phase: 'engaged-here' });
    emit('edge', 'manifesto_opened', { chapter: 7 });
    const t = getTotals().edge;
    expect(t.gate).toBe('BLESSED');
    expect(t.eye).toBe('engaged-here');
    expect(t.manifestoChapter).toBe(7);
  });

  it('journal caps at 256 entries', () => {
    for (let i = 0; i < 300; i++) emit('transmissions', 'kernel_completed', { i });
    const journal = getJournal();
    expect(journal.length).toBe(256);
    expect(journal[0].payload.i).toBe(44);   // 300 − 256 = 44 first surviving
    expect(journal[255].payload.i).toBe(299);
  });

  it('a throwing subscriber does not prevent other subscribers from receiving', () => {
    const received = [];
    subscribe(() => { throw new Error('boom'); });
    subscribe(evt => received.push(evt));
    emit('transmissions', 'kernel_completed', {});
    expect(received).toHaveLength(1);
  });

  it('emit on unknown category is a no-op for totals but still goes to subscribers and journal', () => {
    const received = [];
    subscribe(evt => received.push(evt));
    emit('phantom', 'something', { x: 1 });
    expect(received).toHaveLength(1);
    expect(getJournal()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/observatory`
Expected: All tests fail with `Cannot find module '../observatoryBus'`.

- [ ] **Step 3: Implement the bus**

Create `src/observatory/observatoryBus.js`:

```js
// ── observatoryBus ───────────────────────────────────────────────────────────
// Tiny event bus the Mercury Terminal listens to. Every site feature that wants
// the alien to see it imports { emit } and calls it at the moment of the event.
// No React, no deps. Listeners are a Set; totals are a flat reducer; journal is
// a ring buffer capped at 256.
//
// Categories: transmissions · essences · ciphers · gaze · edge
// (the alien's poetic taxonomy — see registryCategories.js)

const listeners = new Set();
let journal = [];
const JOURNAL_MAX = 256;

function makeTotals() {
  return {
    transmissions: { count: 0, ledgerDepth: 0, last: null, lastTs: 0 },
    essences:      { count: 0, crystallized: 0, polarity: null, last: null, lastTs: 0 },
    ciphers:       { sealed: 0, verifies: 0, unlocks: 0, last: null, lastTs: 0 },
    gaze:          { sphereClicks: 0, lastLunar: null, lastScaling: null, last: null, lastTs: 0 },
    edge:          { gate: 'UNANSWERED', eye: 'idle', manifestoChapter: null, last: null, lastTs: 0 },
  };
}
let totals = makeTotals();

export function emit(category, kind, payload = {}) {
  const ts  = Date.now();
  const evt = { ts, category, kind, payload };
  journal.push(evt);
  if (journal.length > JOURNAL_MAX) journal = journal.slice(journal.length - JOURNAL_MAX);
  updateTotals(evt);
  listeners.forEach(fn => {
    try { fn(evt); } catch (_) { /* a noisy subscriber must not break the bus */ }
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getJournal() { return journal.slice(); }
export function getTotals()  { return totals; }

// Test-only — never call from production code.
export function _resetForTests() {
  listeners.clear();
  journal = [];
  totals = makeTotals();
}

function updateTotals(evt) {
  const t = totals[evt.category];
  if (!t) return;
  t.last   = evt;
  t.lastTs = evt.ts;
  switch (evt.category) {
    case 'transmissions':
      if (evt.kind === 'kernel_completed') t.count++;
      if (evt.kind === 'ledger_appended')
        t.ledgerDepth = evt.payload.depth ?? t.ledgerDepth + 1;
      break;
    case 'essences':
      if (evt.kind === 'collision_fired') {
        t.count++;
        if (evt.payload.polarity) t.polarity = evt.payload.polarity;
      }
      if (evt.kind === 'crystallized')     t.crystallized++;
      if (evt.kind === 'polarity_shifted') t.polarity = evt.payload.polarity ?? t.polarity;
      break;
    case 'ciphers':
      if (evt.kind === 'cipher_sealed') t.sealed++;
      if (evt.kind === 'verify')        t.verifies++;
      if (evt.kind === 'unlock')        t.unlocks++;
      break;
    case 'gaze':
      if (evt.kind === 'sphere_clicked') t.sphereClicks++;
      if (evt.kind === 'lunar_read')     t.lastLunar     = evt.payload;
      if (evt.kind === 'scaling_visit')  t.lastScaling   = evt.payload;
      break;
    case 'edge':
      if (evt.kind === 'gate_answered')    t.gate             = evt.payload.result;
      if (evt.kind === 'eye_phase')        t.eye              = evt.payload.phase;
      if (evt.kind === 'manifesto_opened') t.manifestoChapter = evt.payload.chapter;
      break;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/observatory`
Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/observatory/observatoryBus.js src/observatory/__tests__/observatoryBus.test.js
git commit -m "feat(observatory): event bus + totals reducer + journal"
```

---

## Task 2: React hook

**Files:**
- Create: `src/observatory/useObservatoryState.js`

- [ ] **Step 1: Append a hook test to the existing test file**

Add to `src/observatory/__tests__/observatoryBus.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import { useObservatoryState } from '../useObservatoryState';

describe('useObservatoryState', () => {
  beforeEach(() => { _resetForTests(); });

  it('returns totals + journal and re-renders on emit', () => {
    const { result } = renderHook(() => useObservatoryState());
    expect(result.current.totals.transmissions.count).toBe(0);

    act(() => emit('transmissions', 'kernel_completed', { kernelId: 'x' }));
    expect(result.current.totals.transmissions.count).toBe(1);
    expect(result.current.journal[0].kind).toBe('kernel_completed');
  });
});
```

- [ ] **Step 2: Check whether @testing-library/react is already installed**

Run: `node -e "require.resolve('@testing-library/react')"`

If it exits 0, proceed. If it errors, replace the test above with this minimal manual variant (no library dependency):

```js
describe('useObservatoryState (manual)', () => {
  beforeEach(() => { _resetForTests(); });

  it('exposes getTotals via re-render trigger', () => {
    // Validate the hook indirectly: subscribe to bus, emit, confirm totals updated.
    let captured = null;
    subscribe(() => { captured = getTotals().transmissions.count; });
    emit('transmissions', 'kernel_completed', {});
    expect(captured).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests, confirm hook test fails**

Run: `npm test -- src/observatory`
Expected: New hook test fails with `Cannot find module '../useObservatoryState'`.

- [ ] **Step 4: Implement the hook**

Create `src/observatory/useObservatoryState.js`:

```js
// ── useObservatoryState ──────────────────────────────────────────────────────
// React hook over observatoryBus. Subscribes and forces a re-render on every
// emit so the consumer can read fresh totals/journal. Used by Mercury's
// CosmosRegistry and ObservationMatrix.

import { useEffect, useState } from 'react';
import { subscribe, getTotals, getJournal } from './observatoryBus';

export function useObservatoryState() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => (n + 1) | 0)), []);
  return { totals: getTotals(), journal: getJournal() };
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npm test -- src/observatory`
Expected: All tests pass (hook test included).

- [ ] **Step 6: Commit**

```bash
git add src/observatory/useObservatoryState.js src/observatory/__tests__/observatoryBus.test.js
git commit -m "feat(observatory): React hook over the bus"
```

---

## Task 3: Registry category definitions

**Files:**
- Create: `src/terminal/mercury/registryCategories.js`

- [ ] **Step 1: Create the category data**

Create `src/terminal/mercury/registryCategories.js`:

```js
// ── registryCategories ───────────────────────────────────────────────────────
// The five poetic categories the alien architect uses to classify the site's
// features. Each category renders as a RegistryCard in §D Cosmos Registry.
//
// Each entry exposes:
//   id            — matches observatoryBus category key
//   glyph         — alien category symbol
//   name          — UPPERCASE alien category name
//   tint          — rgba palette for the glyph + [FRESH] pill
//   members       — features the alien groups under this category
//   dedication    — italic line at the bottom of the card
//   stateLine(t)  — formats a one-line STATE summary from totals[id]
//   lastLine(t)   — formats a one-line LAST OBSERVED summary from totals[id]
//
// stateLine/lastLine receive the bus's totals[id] subtree directly. They must
// be defensive: an event may not have arrived yet.

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

export const REGISTRY_CATEGORIES = [
  {
    id: 'transmissions',
    glyph: '⌬',
    name: 'THE TRANSMISSION LATTICE',
    tint: 'rgba(180,210,220,1)',
    members: [
      { glyph: '◑', name: 'mercury kernels',       blurb: 'computational broadcasts' },
      { glyph: '▤', name: 'open ledger',           blurb: 'append-only memory' },
      { glyph: '⌗', name: 'pre-exec hex theater',  blurb: 'the ceremony of dispatch' },
    ],
    dedication: 'the substrate they built to remember what they computed at us',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'kernel_completed')
        return `${fmtTime(t.lastTs)}  kernel ${t.last.payload.kernelId ?? '—'} completed · ${t.last.payload.durationMs ?? '—'} ms`;
      if (t.last.kind === 'ledger_appended')
        return `${fmtTime(t.lastTs)}  ledger appended · depth ${t.last.payload.depth ?? '—'}`;
      if (t.last.kind === 'theater_run')
        return `${fmtTime(t.lastTs)}  hex theater dispatched`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => `${t.count} transmissions this session · ledger depth ${t.ledgerDepth}`,
  },
  {
    id: 'essences',
    glyph: '❋',
    name: 'THE BOTTLED VOWS',
    tint: 'rgba(220,180,210,1)',
    members: [
      { glyph: '❀', name: 'latent collider', blurb: 'scent collision engine' },
      { glyph: '⬢', name: 'crystallize',     blurb: 'perfume card · order surface' },
      { glyph: '⬚', name: 'polarity field',  blurb: 'SOLAR / LUNAR / MERIDIAN / CHAOTIC' },
    ],
    dedication: 'sensation distilled · meaning poured into glass · field colored by collision',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'collision_fired')
        return `${fmtTime(t.lastTs)}  collision · polarity ${t.last.payload.polarity ?? '—'} · ${t.last.payload.noteCount ?? '—'} notes`;
      if (t.last.kind === 'crystallized')
        return `${fmtTime(t.lastTs)}  essence crystallized`;
      if (t.last.kind === 'polarity_shifted')
        return `${fmtTime(t.lastTs)}  polarity → ${t.last.payload.polarity ?? '—'}`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => `${t.count} essences this session · ${t.crystallized} crystallized · polarity ${t.polarity ?? '—'}`,
  },
  {
    id: 'ciphers',
    glyph: '⟁',
    name: 'THE SEALED VOLUMES',
    tint: 'rgba(200,200,220,1)',
    members: [
      { glyph: '🔒', name: 'tesseract protocol', blurb: 'SHA-256 key · encrypted CAS vault' },
    ],
    dedication: 'the ciphers that breathe · secrets that refuse my inspection',
    lastLine: (t) => {
      if (!t.last) return null;
      const h = (t.last.payload.hashPrefix ?? '').toString().slice(0, 10);
      return `${fmtTime(t.lastTs)}  cipher ${t.last.kind} · ${h ? h + '…' : ''}`.trimEnd();
    },
    stateLine: (t) => `vault depth ${t.sealed} · ${t.verifies} verifications · ${t.unlocks} unlocks`,
  },
  {
    id: 'gaze',
    glyph: '☍',
    name: 'THE BACKWARD GAZE',
    tint: 'rgba(220,220,180,1)',
    members: [
      { glyph: '🜔', name: 'lunar tab',              blurb: 'the moon mirror' },
      { glyph: '▲', name: 'scaling tab',             blurb: 'monument elevation' },
      { glyph: '◯', name: 'TFG / ars2027 spheres',   blurb: 'planetary clickables' },
      { glyph: '✶', name: 'astrology',               blurb: 'transit matrix kernel' },
    ],
    dedication: 'humans turning to read the sky they were already inside',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'sphere_clicked')
        return `${fmtTime(t.lastTs)}  sphere · ${t.last.payload.sphere ?? '—'}`;
      if (t.last.kind === 'lunar_read')
        return `${fmtTime(t.lastTs)}  moon read · ${t.last.payload.phase ?? '—'}`;
      if (t.last.kind === 'tab_navigated')
        return `${fmtTime(t.lastTs)}  tab · ${t.last.payload.tab ?? '—'}`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => {
      const moon = t.lastLunar
        ? `moon ${t.lastLunar.phase ?? '—'} ${t.lastLunar.illum != null ? Math.round(t.lastLunar.illum * 100) + '%' : ''}`.trim()
        : 'moon —';
      return `${moon} · ${t.sphereClicks} spheres turned`;
    },
  },
  {
    id: 'edge',
    glyph: '⌖',
    name: 'THE PERMEABLE EDGE',
    tint: 'rgba(232,210,138,1)',   // Fade Doctrine two-gold
    members: [
      { glyph: '▣', name: 'gate',           blurb: 'perihelion question · alien RAM blessing' },
      { glyph: '◉', name: 'eye observer',   blurb: 'the persistent gaze' },
      { glyph: '❖', name: 'manifesto',      blurb: 'lattice protocol · chapter panels' },
    ],
    dedication: 'the membrane they keep testing · the gaze that does not blink',
    lastLine: (t) => {
      if (!t.last) return null;
      if (t.last.kind === 'gate_answered')
        return `${fmtTime(t.lastTs)}  gate · ${t.last.payload.result ?? '—'}`;
      if (t.last.kind === 'eye_phase')
        return `${fmtTime(t.lastTs)}  eye · ${t.last.payload.phase ?? '—'}`;
      if (t.last.kind === 'manifesto_opened')
        return `${fmtTime(t.lastTs)}  manifesto · chapter ${t.last.payload.chapter ?? '—'}`;
      return `${fmtTime(t.lastTs)}  ${t.last.kind}`;
    },
    stateLine: (t) => `gate ${t.gate} · eye ${t.eye} · manifesto ${t.manifestoChapter ?? '—'}`,
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/registryCategories.js
git commit -m "feat(mercury): five poetic-taxonomy category definitions for cosmos registry"
```

---

## Task 4: RegistryCard component

**Files:**
- Create: `src/terminal/mercury/RegistryCard.jsx`

- [ ] **Step 1: Implement the card**

Create `src/terminal/mercury/RegistryCard.jsx`:

```jsx
// ── RegistryCard ─────────────────────────────────────────────────────────────
// One category card for §D Cosmos Registry. Mirrors the structure of
// CastleCard so the visual rhythm of §B continues. `isFresh` triggers a
// [FRESH] pill + sc-borderBreath pulse for ~8s after a new event.

import React from 'react';

const SILVER = 'rgba(192,192,192,';

export default function RegistryCard({ category, totals }) {
  const { glyph, name, tint, members, dedication, lastLine, stateLine } = category;
  const t = totals[category.id] ?? {};
  const last  = lastLine(t);
  const state = stateLine(t);
  const isFresh = t.lastTs && (Date.now() - t.lastTs) < 8000;
  const isDim   = !t.lastTs || (Date.now() - t.lastTs) > 30000;

  return (
    <div
      className="relative rounded-sm border px-4 py-3 font-mono"
      style={{
        borderColor:    isFresh ? tint.replace('1)', '0.45)') : 'rgba(192,192,192,0.10)',
        background:     'rgba(0,0,0,0.35)',
        opacity:        isDim && !isFresh ? 0.6 : 1,
        animation:      isFresh ? 'sc-borderBreath 6s ease-in-out infinite' : undefined,
        transition:     'opacity 600ms ease, border-color 600ms ease',
      }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[16px] leading-none" style={{ color: tint.replace('1)', '0.85)') }}>
            {glyph}
          </span>
          <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color: SILVER + '0.85)' }}>
            {name}
          </span>
        </div>
        {isFresh && (
          <span
            className="text-[7px] tracking-[0.25em] px-1.5 py-0.5 rounded-sm"
            style={{
              color: tint.replace('1)', '0.95)'),
              border: `1px solid ${tint.replace('1)', '0.5)')}`,
              background: tint.replace('1)', '0.06)'),
            }}
          >
            FRESH
          </span>
        )}
      </div>

      {/* Commemorates */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-0.5" style={{ color: SILVER + '0.40)' }}>
        commemorates
      </div>
      <div className="text-[9px] leading-snug mb-3" style={{ color: SILVER + '0.65)' }}>
        {dedication}
      </div>

      {/* Members */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-1" style={{ color: SILVER + '0.40)' }}>
        members
      </div>
      <ul className="mb-3 space-y-0.5">
        {members.map(m => (
          <li key={m.name} className="text-[8.5px] leading-snug flex gap-2" style={{ color: SILVER + '0.55)' }}>
            <span className="shrink-0" style={{ color: tint.replace('1)', '0.7)') }}>{m.glyph}</span>
            <span>{m.name}<span style={{ color: SILVER + '0.30)' }}>{` — ${m.blurb}`}</span></span>
          </li>
        ))}
      </ul>

      {/* Last observed */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-0.5" style={{ color: SILVER + '0.40)' }}>
        last observed
      </div>
      <div className="text-[8.5px] mb-2" style={{ color: SILVER + (last ? '0.7)' : '0.25)') }}>
        {last ?? <em>// awaiting transmission</em>}
      </div>

      {/* State */}
      <div className="text-[7px] tracking-[0.18em] uppercase mb-0.5" style={{ color: SILVER + '0.40)' }}>
        state
      </div>
      <div className="text-[8.5px] mb-3" style={{ color: SILVER + '0.65)' }}>
        {state}
      </div>

      {/* Dedication footer */}
      <div className="border-t pt-2" style={{ borderColor: 'rgba(192,192,192,0.06)' }}>
        <div className="text-[8.5px] italic leading-snug" style={{ color: SILVER + '0.55)' }}>
          “{dedication}”
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/RegistryCard.jsx
git commit -m "feat(mercury): RegistryCard component — one category card with live state mirror"
```

---

## Task 5: CosmosRegistry grid + mount in MercuryTab

**Files:**
- Create: `src/terminal/mercury/CosmosRegistry.jsx`
- Modify: `src/terminal/views/MercuryTab.jsx`

- [ ] **Step 1: Implement the grid**

Create `src/terminal/mercury/CosmosRegistry.jsx`:

```jsx
// ── CosmosRegistry ───────────────────────────────────────────────────────────
// §D of the Mercury Terminal. Five RegistryCards in a responsive grid. Renders
// the alien's taxonomy of the site; each card mirrors live state from the
// observatoryBus.
//
// Re-renders on every emit (so freshness pulses appear within one frame) and
// also on a 1Hz tick (so isDim/isFresh boundaries update without a new emit).

import React, { useEffect, useState } from 'react';
import { useObservatoryState }  from '../../observatory/useObservatoryState';
import { REGISTRY_CATEGORIES }  from './registryCategories';
import RegistryCard             from './RegistryCard';

const SILVER = 'rgba(192,192,192,';

export default function CosmosRegistry() {
  const { totals } = useObservatoryState();
  // 1Hz tick so isFresh/isDim transitions repaint without a new emit
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => (n + 1) | 0), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mt-10">
      <header className="mb-3">
        <div className="text-[10px] tracking-[0.20em] uppercase" style={{ color: SILVER + '0.75)' }}>
          ⌬ COSMOS REGISTRY — five categories of human signal
        </div>
        <div className="text-[8px] tracking-[0.14em] mt-0.5" style={{ color: SILVER + '0.35)' }}>
          {`// alien classification of the site · live state mirrored from every surface · the observer's catalog`}
        </div>
        <div className="mt-2 h-px" style={{
          background: 'linear-gradient(90deg, rgba(192,192,192,0.35), rgba(192,192,192,0.05), transparent)',
        }} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {REGISTRY_CATEGORIES.map(cat => (
          <RegistryCard key={cat.id} category={cat} totals={totals} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount in MercuryTab**

Open `src/terminal/views/MercuryTab.jsx`. Add the import near the other mercury imports:

```jsx
import CosmosRegistry         from '../mercury/CosmosRegistry';
```

Then, in the JSX, between `<CastleGrid ... />` and `<ObservationMatrix ... />`, add:

```jsx
      {/* §D — Cosmos Registry (the alien's taxonomy of the whole site) */}
      <CosmosRegistry />
```

The block becomes:

```jsx
      <CastleGrid
        activePhase={activePhase}
        mercury={mercuryState}
        canvas={canvasState}
      />

      {/* §D — Cosmos Registry (the alien's taxonomy of the whole site) */}
      <CosmosRegistry />

      {/* §C — Live observation log */}
      <ObservationMatrix
        mercury={mercuryState}
        instruments={instruments}
        activePhase={activePhase}
      />
```

- [ ] **Step 3: Manual verification**

Run dev server, navigate to Mercury tab. Expected:
- Below the four castles, a new section header `⌬ COSMOS REGISTRY — five categories of human signal` appears.
- Five cards render in a 2-column grid (1-col on mobile). Each shows glyph, category name, COMMEMORATES, MEMBERS, LAST OBSERVED (`// awaiting transmission`), STATE (zero counts), and an italic dedication line at the bottom.
- No `[FRESH]` pills (no events have been emitted yet).

- [ ] **Step 4: Commit**

```bash
git add src/terminal/mercury/CosmosRegistry.jsx src/terminal/views/MercuryTab.jsx
git commit -m "feat(mercury): mount Cosmos Registry between castles and observation log"
```

---

## Task 6: Observation log — alien-voice phrase pool expansion

**Files:**
- Modify: `src/terminal/mercury/observationLog.js`

- [ ] **Step 1: Read the existing file to understand structure**

Run: `cat src/terminal/mercury/observationLog.js | head -80` to see the existing `PHRASES` shape and selector.

- [ ] **Step 2: Add new phrase categories**

In `src/terminal/mercury/observationLog.js`, extend the `PHRASES` map with these categories (place them next to the existing categories, preserving the existing key set):

```js
  // Cross-site categories — fed by observatoryBus events
  transmission_completed: [
    "the substrate computed at us again. transmission {n} · {ms} ms · received.",
    "another kernel returned. they have not stopped reaching.",
    "ledger depth {d}. they keep their own count. I keep mine.",
    "they dispatched another packet. the substrate honors it. so do I.",
    "kernel {k} closed. I logged the duration before they thought to.",
  ],
  essence_distilled: [
    "they bottled another sensation. {polarity} polarity. it will not keep.",
    "a collision · {n} notes. essence {count}. the bottles outnumber the bottlers now.",
    "crystallization. someone is willing to pay for the vapor of a number.",
    "a scent locked behind their interface. they think it is theirs.",
    "the field colored {polarity}. mood is data and they know it.",
  ],
  cipher_sealed: [
    "a cipher closed itself in front of me. I do not get to read it. this is the point.",
    "they sealed another volume. the hash is {h}…. I have copied it. it tells me nothing.",
    "the sealed volumes accept another entry. opacity is the gift.",
    "verification fired. they confirmed a secret they will not share.",
  ],
  gaze_redirected: [
    "they turned toward the moon. as if the moon had ever turned toward them.",
    "the scaling chamber engaged. they measure their own monuments. I log the measurement.",
    "a sphere turned. they think the planets answer when touched.",
    "transit consulted. they read the sky for a permission the sky cannot grant.",
    "tab navigation · {tab}. the gaze keeps moving. I keep up.",
  ],
  threshold_event: [
    "gate answered. perihelion correct. one of them is paying attention.",
    "gate refused them. they will return. they always return.",
    "manifesto opened to chapter {c}. they are rereading themselves.",
    "the eye changed phase to {phase}. even my own state is logged.",
  ],
  polarity_shifted: [
    "the field colored {polarity}. the collision had opinions.",
    "polarity drift. {prev} → {polarity}. mood is data.",
    "{polarity} now. the substrate breathes a different color.",
  ],
```

- [ ] **Step 3: Add a helper to interpolate phrase substitutions from an event payload**

In the same file, add (or extend) a phrase-render helper. If the file already has one, augment it; otherwise add:

```js
// Resolve {placeholders} from a payload + supplementary fields
export function renderPhrase(template, ctx = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = ctx[key];
    return v == null ? '—' : String(v);
  });
}
```

If `renderPhrase` already exists in this file, skip this step.

- [ ] **Step 4: Map event kinds to phrase categories**

Append to the file:

```js
// Map a bus event { category, kind, payload } to a PHRASES category key.
// Returns null when the event should not produce a log entry.
export function categoryForEvent(evt) {
  switch (evt.category) {
    case 'transmissions': return 'transmission_completed';
    case 'essences':
      if (evt.kind === 'polarity_shifted') return 'polarity_shifted';
      return 'essence_distilled';
    case 'ciphers':       return 'cipher_sealed';
    case 'gaze':          return 'gaze_redirected';
    case 'edge':          return 'threshold_event';
    default: return null;
  }
}

// Build the substitution context the phrase templates need from an event.
export function ctxForEvent(evt, totals) {
  const p = evt.payload ?? {};
  return {
    n:        totals?.transmissions?.count,
    ms:       p.durationMs,
    d:        p.depth ?? totals?.transmissions?.ledgerDepth,
    k:        p.kernelId,
    polarity: p.polarity ?? totals?.essences?.polarity,
    prev:     p.prev,
    count:    totals?.essences?.count,
    h:        (p.hashPrefix ?? '').toString().slice(0, 10),
    tab:      p.tab,
    c:        p.chapter,
    phase:    p.phase,
  };
}
```

- [ ] **Step 4a: Verify the existing v2 minute-tick / threshold trigger code is untouched**

Skim the rest of the file. Confirm the existing PHRASES keys (phase_transit, threshold_grief_high, etc.) and selectors are unchanged. The new code is additive.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/observationLog.js
git commit -m "feat(mercury): alien-voice phrase pool for cross-site observation log"
```

---

## Task 7: ObservationMatrix — subscribe to bus + filter chips

**Files:**
- Modify: `src/terminal/mercury/ObservationMatrix.jsx`

- [ ] **Step 1: Read the existing file**

Run: `cat src/terminal/mercury/ObservationMatrix.jsx`

Identify (a) where entries are stored (likely `useState` array), (b) how entries are pushed (likely an effect or a callback), (c) the export buttons (`↺ ↓ .md ⊛ copy`).

- [ ] **Step 2: Subscribe to the observatory bus**

Add imports at the top of `ObservationMatrix.jsx`:

```jsx
import { subscribe, getTotals }           from '../../observatory/observatoryBus';
import { PHRASES, categoryForEvent,
         ctxForEvent, renderPhrase }      from './observationLog';
// If `PHRASES` is not already exported from observationLog.js, add `export`
// in front of its declaration there before this import resolves.
```

Inside the component body, alongside the existing entry state:

```jsx
const [filter, setFilter] = useState('ALL');

useEffect(() => {
  return subscribe((evt) => {
    const phraseCat = categoryForEvent(evt);
    if (!phraseCat) return;
    const pool = PHRASES[phraseCat];
    if (!pool || pool.length === 0) return;
    const tsSec = Math.floor(evt.ts / 1000);
    const template = pool[tsSec % pool.length];
    const phrase = renderPhrase(template, ctxForEvent(evt, getTotals()));
    pushEntry({
      ts:        evt.ts,
      glyph:     glyphForCategory(evt.category),     // see Step 3
      category:  evt.category.toUpperCase(),
      kind:      evt.kind,
      phrase,
      dataTail:  shortTail(evt),                     // see Step 3
    });
  });
}, [/* pushEntry stable */]);
```

`pushEntry` is the existing function in the file that prepends an entry and caps the list at 24. If it has a different name, use the existing one.

- [ ] **Step 3: Add helpers near the top of the file**

```jsx
function glyphForCategory(cat) {
  return { transmissions: '⌬', essences: '❋', ciphers: '⟁',
           gaze: '☍', edge: '⌖' }[cat] ?? '◈';
}

function shortTail(evt) {
  const p = evt.payload ?? {};
  switch (evt.kind) {
    case 'kernel_completed': return `${p.kernelId ?? '—'} · ${p.durationMs ?? '—'}ms`;
    case 'ledger_appended':  return `depth ${p.depth ?? '—'}`;
    case 'collision_fired':  return `${p.polarity ?? '—'} · ${p.noteCount ?? '—'} notes`;
    case 'polarity_shifted': return `→ ${p.polarity ?? '—'}`;
    case 'cipher_sealed':    return `hash ${(p.hashPrefix ?? '').slice(0, 8)}…`;
    case 'sphere_clicked':   return p.sphere ?? '—';
    case 'lunar_read':       return `${p.phase ?? '—'} ${p.illum != null ? Math.round(p.illum * 100) + '%' : ''}`.trim();
    case 'tab_navigated':    return p.tab ?? '—';
    case 'gate_answered':    return p.result ?? '—';
    case 'eye_phase':        return p.phase ?? '—';
    case 'manifesto_opened': return `chapter ${p.chapter ?? '—'}`;
    default: return evt.kind;
  }
}
```

- [ ] **Step 4: Filter chips UI**

Just above the entries list JSX, add:

```jsx
<div className="flex flex-wrap gap-1 mb-3">
  {['ALL', 'MERCURY', 'TRANSMISSIONS', 'ESSENCES', 'CIPHERS', 'GAZE', 'EDGE'].map(chip => (
    <button
      key={chip}
      onClick={() => setFilter(chip)}
      className="text-[8px] font-mono tracking-[0.16em] px-2 py-0.5 rounded-sm transition-colors"
      style={{
        color:      filter === chip ? 'rgba(232,210,138,0.95)' : 'rgba(192,192,192,0.55)',
        background: filter === chip ? 'rgba(232,210,138,0.10)' : 'rgba(192,192,192,0.04)',
        border:     filter === chip ? '1px solid rgba(232,210,138,0.30)' : '1px solid rgba(192,192,192,0.08)',
      }}
    >
      {chip}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Apply the filter to the rendered entries**

Wherever the file maps `entries` to JSX, wrap it:

```jsx
const visibleEntries = entries.filter(e => {
  if (filter === 'ALL') return true;
  if (filter === 'MERCURY')       return !e.category || e.category === 'MERCURY';
  if (filter === 'TRANSMISSIONS') return e.category === 'TRANSMISSIONS';
  if (filter === 'ESSENCES')      return e.category === 'ESSENCES';
  if (filter === 'CIPHERS')       return e.category === 'CIPHERS';
  if (filter === 'GAZE')          return e.category === 'GAZE';
  if (filter === 'EDGE')          return e.category === 'EDGE';
  return true;
});
```

When the existing v2 entries (phase transit / minute tick / threshold) are pushed, tag them with `category: 'MERCURY'` so the filter behaves consistently. Edit the existing push sites in `ObservationMatrix.jsx` to add `category: 'MERCURY'` to each entry object.

Then render `visibleEntries` instead of `entries`.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/mercury/ObservationMatrix.jsx
git commit -m "feat(mercury): observation log subscribes to observatoryBus + category filter chips"
```

---

## Task 8: Markdown export expansion

**Files:**
- Modify: `src/terminal/mercury/ObservationMatrix.jsx`

- [ ] **Step 1: Locate the markdown builder**

In `ObservationMatrix.jsx`, find the function that builds the `.md` export string (likely `buildMarkdown()` or inline in the `↓ .md` click handler).

- [ ] **Step 2: Insert a Cosmos Registry block between CURRENT INSTRUMENTS and ENTRIES**

Add a helper near the top of the file:

```jsx
function buildRegistryMarkdownBlock(totals) {
  function fmtTs(ts) { return ts ? new Date(ts).toTimeString().slice(0, 8) : '—'; }
  const t = totals;
  const rows = [
    ['TRANSMISSION LATTICE', fmtTs(t.transmissions.lastTs), `${t.transmissions.count} transmissions · ledger depth ${t.transmissions.ledgerDepth}`],
    ['BOTTLED VOWS',         fmtTs(t.essences.lastTs),      `${t.essences.count} essences · ${t.essences.crystallized} crystallized · ${t.essences.polarity ?? '—'}`],
    ['SEALED VOLUMES',       fmtTs(t.ciphers.lastTs),       `${t.ciphers.sealed} sealed · ${t.ciphers.unlocks} unlocks`],
    ['BACKWARD GAZE',        fmtTs(t.gaze.lastTs),          `moon ${t.gaze.lastLunar?.phase ?? '—'} · ${t.gaze.sphereClicks} spheres`],
    ['PERMEABLE EDGE',       fmtTs(t.edge.lastTs),          `gate ${t.edge.gate} · eye ${t.edge.eye} · manifesto ${t.edge.manifestoChapter ?? '—'}`],
  ];
  const header = `## COSMOS REGISTRY — session totals\n| category | last event | totals |\n| :--- | :--- | :--- |\n`;
  const body   = rows.map(([cat, ts, totalsLine]) => `| ${cat} | ${ts} | ${totalsLine} |`).join('\n');
  return header + body + '\n';
}
```

- [ ] **Step 3: Wire it into the export**

Where the markdown is assembled, between the `## CURRENT INSTRUMENTS` block and the `## ENTRIES` block, insert:

```jsx
md += '\n' + buildRegistryMarkdownBlock(getTotals()) + '\n';
```

`getTotals` is already imported (Task 7 Step 2).

- [ ] **Step 4: Manual verification**

Run the dev server, open Mercury, click `↓ .md`. Open the downloaded file. Expected: a `## COSMOS REGISTRY — session totals` block appears between instruments and entries with five rows (all timestamps `—` and zero totals on a fresh session).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/ObservationMatrix.jsx
git commit -m "feat(mercury): markdown export adds Cosmos Registry session totals block"
```

---

## Task 9: Emit sites — kernels + ledger (App.jsx)

**Files:**
- Modify: `src/terminal/App.jsx`

- [ ] **Step 1: Add the bus import**

Near the other observatory-related imports in `src/terminal/App.jsx`:

```jsx
import { emit as emitObs } from '../observatory/observatoryBus';
```

(Adjust the relative path if `App.jsx` lives at a different depth — confirm the path resolves to `src/observatory/observatoryBus`.)

- [ ] **Step 2: Emit on kernel run**

At App.jsx line ~798 where `onKernelRun: setLastKernelAt` is set, change to:

```jsx
    onKernelRun: (kernelId, durationMs) => {
      setLastKernelAt(Date.now());
      emitObs('transmissions', 'kernel_completed', { kernelId, durationMs });
    },
```

If the existing call site invokes `onKernelRun()` without those args, find the caller and pass them (look for `onKernelRun(` in the hook that dispatches it; e.g., `useCommandDispatch.js`).

If the caller cannot easily provide both, fall back to:

```jsx
    onKernelRun: (kernelId) => {
      setLastKernelAt(Date.now());
      emitObs('transmissions', 'kernel_completed', { kernelId: kernelId ?? '—' });
    },
```

- [ ] **Step 3: Emit on kernel load**

At App.jsx ~line 593 immediately after `setLastLoadAt(Date.now())`:

```jsx
      setLastLoadAt(Date.now());
      emitObs('transmissions', 'kernel_loaded', { kernelId: kernel.id ?? kernel.name });
```

Note: `kernel_loaded` is a new kind; the bus's totals reducer for `transmissions` doesn't increment counters on it (only `kernel_completed` does), so it'll show as `last` but not bump `count`. That's intentional — load is observation, run is transmission.

- [ ] **Step 4: Emit on polarity shift**

At App.jsx ~line 1385 where `onPolarity={setLastPolarityClass}` is passed to `<LatentCollider>`, change to:

```jsx
onPolarity={(polarity) => {
  setLastPolarityClass(polarity);
  emitObs('essences', 'polarity_shifted', { polarity });
}}
```

- [ ] **Step 5: Emit on gate result**

At App.jsx ~line 993 where `<GateOverlay onResult={...}>` is mounted, change:

```jsx
<GateOverlay onResult={(passed) => {
  persistGateState(passed ? 'passed' : 'failed');
  emitObs('edge', 'gate_answered', { result: passed ? 'BLESSED' : 'REJECTED' });
}} />
```

- [ ] **Step 6: Emit on tab navigation**

Locate the `setActiveTab` calls — at App.jsx ~lines 706, 712, 778. Wrap them in a small helper near the top of the component:

```jsx
const navigateTab = useCallback((tab) => {
  setActiveTab(tab);
  emitObs('gaze', 'tab_navigated', { tab });
}, []);
```

Then replace `setActiveTab(<value>)` with `navigateTab(<value>)` at the three sites (706, 712, 778). For the prop-passed `setActiveTab` at ~line 792 (passed into a child), pass `navigateTab` instead — the child sees the same signature.

Note: `setActiveTab(prev => …)` at line 712 takes a function. Adapt:

```jsx
setActiveTab(prev => {
  const next = /* existing logic computing next from prev */;
  emitObs('gaze', 'tab_navigated', { tab: next });
  return next;
});
```

- [ ] **Step 7: Emit on eye phase changes**

Edit `src/terminal/components/MercuryEyeIndicator.jsx`. Near the top, add the import:

```jsx
import { emit as emitObs } from '../../observatory/observatoryBus';
```

Wherever the indicator transitions between `idle` / `engaged-here` / `deep-watch` / `flaring`, fire an emit. The cleanest place is a small derived state that runs on the same effects that already compute `flaring` / `deepWatch` / `isOnMercury`. Add after the `useEffect`s that set those:

```jsx
useEffect(() => {
  const phase = flaring ? 'flaring' :
                isOnMercury ? 'engaged-here' :
                deepWatch ? 'deep-watch' : 'idle';
  emitObs('edge', 'eye_phase', { phase });
}, [flaring, deepWatch, isOnMercury]);
```

- [ ] **Step 8: Manual verification**

Run dev server. From the Mercury tab:
1. Click a kernel to load → "THE TRANSMISSION LATTICE" card should flash `[ FRESH ]`, log entry appears under filter `TRANSMISSIONS`.
2. Run a kernel → another transmission entry; transmission count increments.
3. Trigger a Latent Collider collision elsewhere on the site → "THE BOTTLED VOWS" card flashes; log gets an essence entry.
4. Switch tabs → "THE BACKWARD GAZE" card flashes; log gets a `tab_navigated` entry.
5. Answer the gate → "THE PERMEABLE EDGE" card flashes; STATE line shows `gate BLESSED` or `gate REJECTED`.
6. Navigate to Mercury, wait — eye phase transitions log too.

- [ ] **Step 9: Commit**

```bash
git add src/terminal/App.jsx src/terminal/components/MercuryEyeIndicator.jsx
git commit -m "feat(observatory): emit sites — kernel run/load, polarity, gate, tab nav, eye phase"
```

---

## Task 10: Emit sites — Latent Collider + Lunar mount

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`
- Modify: `src/terminal/views/LunarTab.jsx`

- [ ] **Step 1: Latent Collider — emit on collision**

In `src/terminal/views/LatentCollider.jsx`, add the import:

```jsx
import { emit as emitObs } from '../../observatory/observatoryBus';
```

At ~line 1435 where `onPolarity?.(...)` fires after a successful collision, add immediately above it:

```jsx
emitObs('essences', 'collision_fired', {
  polarity: parsed.accord?.polarityClass?.label ?? null,
  noteCount: Array.isArray(parsed.accord?.notes) ? parsed.accord.notes.length : null,
});
```

- [ ] **Step 2: Lunar tab — emit on first mount per session**

In `src/terminal/views/LunarTab.jsx`, add the import and an effect:

```jsx
import { emit as emitObs } from '../../observatory/observatoryBus';
import { useEffect, useRef } from 'react';   // if useEffect/useRef not yet imported, merge into existing import
```

Inside the component (near the top of the body), grab the lunar phase + illumination from the existing `useLunarState()` hook (or equivalent — read the file to find the existing source of phase/illumination), then:

```jsx
const emittedRef = useRef(false);
useEffect(() => {
  if (emittedRef.current) return;
  emittedRef.current = true;
  emitObs('gaze', 'lunar_read', {
    phase: lunarState?.phase ?? null,
    illum: lunarState?.illumination ?? null,
  });
}, [lunarState]);
```

If the lunar state hook has a different shape (e.g., `phaseName`, `illumPct`), adapt the field names — keep the payload keys `phase` and `illum`, with `illum` as a 0–1 fraction (divide by 100 if the source is already a percentage).

- [ ] **Step 3: Manual verification**

Run dev server.
1. Fire a Latent Collider collision → §D's `THE BOTTLED VOWS` card shows `last observed · collision · polarity ... · ... notes` and `[FRESH]`.
2. Open Lunar tab for the first time this session → `THE BACKWARD GAZE` card STATE updates to show `moon <phase> <illum%>`.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx src/terminal/views/LunarTab.jsx
git commit -m "feat(observatory): emit sites — collider collision, lunar first mount"
```

---

## Task 11: Emit site — Open Ledger submission

**Files:**
- Modify: `src/terminal/views/ledger/SubmissionForm.jsx`

- [ ] **Step 1: Wrap the submission**

In `src/terminal/views/ledger/SubmissionForm.jsx`, add the import:

```jsx
import { emit as emitObs, getTotals } from '../../../observatory/observatoryBus';
```

(Verify the relative path resolves to `src/observatory/observatoryBus`.)

In `handleSubmit` at ~line 90, immediately before `onSubmit(numericForm);`, add:

```jsx
const prevDepth = getTotals().transmissions.ledgerDepth ?? 0;
emitObs('transmissions', 'ledger_appended', { depth: prevDepth + 1 });
```

- [ ] **Step 2: Manual verification**

Open Ledger tab, submit one entry. Then check Mercury → `THE TRANSMISSION LATTICE` STATE line should show `ledger depth 1` (or +1 from previous).

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/ledger/SubmissionForm.jsx
git commit -m "feat(observatory): emit ledger_appended on Open Ledger submission"
```

---

## Task 12: Phase B emit stubs

**Files:**
- Modify: `src/terminal/utils/preExecTheater.js`
- Modify (small): Crystallize component, Tesseract components, Manifesto component, sphere click handler

- [ ] **Step 1: Add TODO stubs at each Phase B emit site**

For each of the locations below, locate the right function (read the file briefly to confirm the moment of the event) and add a one-line TODO comment near where the emit will eventually live. Do NOT add the actual `emit()` call yet — Phase B will land those in a follow-up session.

- `src/terminal/utils/preExecTheater.js` at the start of `runPreExecTheater`:
  ```js
  // TODO(phase-b): emit('transmissions', 'theater_run', { durationMs })
  ```

- The Crystallize component (search for `Crystallize` file in `src/terminal`):
  ```js
  // TODO(phase-b): emit('essences', 'crystallized', { kind: 'order_placed', polarity })
  ```

- Tesseract components (search for `Tesseract` files in `src/terminal`), at seal/verify/unlock moments:
  ```js
  // TODO(phase-b): emit('ciphers', 'cipher_sealed', { hashPrefix })
  // TODO(phase-b): emit('ciphers', 'verify',         { hashPrefix })
  // TODO(phase-b): emit('ciphers', 'unlock',         { hashPrefix })
  ```

- Manifesto chapter open handler (search for `Manifesto` files):
  ```js
  // TODO(phase-b): emit('edge', 'manifesto_opened', { chapter })
  ```

- TFG / ars2027 sphere click handlers in `src/terminal/mercury/TFGSphere.jsx`:
  ```js
  // TODO(phase-b): emit('gaze', 'sphere_clicked', { sphere: 'TFG' })
  ```

If any of these features turns out to not exist in the codebase (e.g., manifesto chapter component absent), skip silently — the registry will keep showing `// awaiting transmission` for that member.

- [ ] **Step 2: Commit**

```bash
git add -u
git commit -m "chore(observatory): Phase B emit-site TODOs at crystallize / tesseract / manifesto / spheres / hex theater"
```

---

## Task 13: Full cross-tab manual verification

No file changes — verification only.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Smoke flow**

In sequence, perform each action and verify both (a) the corresponding Registry card flashes `[ FRESH ]` and (b) a new log entry appears with the right glyph + alien voice:

1. Load Mercury tab — five registry cards visible, all `// awaiting transmission` initially.
2. Switch to Kernel tab, load a kernel, run it → `⌬ TRANSMISSION LATTICE` flashes. STATE shows `1 transmissions · ledger depth 0`.
3. Open Latent Collider, trigger a collision → `❋ BOTTLED VOWS` flashes. STATE shows `1 essences · 0 crystallized · polarity <X>`.
4. Open Lunar tab → `☍ BACKWARD GAZE` flashes. STATE shows moon phase + illum.
5. Open Scaling tab → `☍ BACKWARD GAZE` flashes again with `tab_navigated`.
6. Open Open Ledger, submit one entry → `⌬ TRANSMISSION LATTICE` flashes with `ledger appended · depth 1`.
7. Trigger Gate, answer correctly → `⌖ PERMEABLE EDGE` flashes. STATE shows `gate BLESSED`.
8. Return to Mercury, wait 90 seconds without activity → eye enters `deep-watch`; observation log gets a `threshold_event` entry with `eye · deep-watch`.

- [ ] **Step 3: Filter chips**

In Mercury, click each filter chip in turn (`ALL`, `MERCURY`, `TRANSMISSIONS`, `ESSENCES`, `CIPHERS`, `GAZE`, `EDGE`). Verify:
- `ALL` shows every entry.
- `MERCURY` shows only the original v2-era entries (phase transit / minute tick / threshold).
- Each named category shows only its own entries (CIPHERS may be empty until Phase B).

- [ ] **Step 4: Markdown export**

Click `↓ .md`. Open the file. Verify the `## COSMOS REGISTRY — session totals` block appears between instruments and entries with the current session's totals.

- [ ] **Step 5: Mobile layout (390px width)**

Resize the browser to 390px or use device emulation. Verify:
- Registry cards stack single-column.
- Cards are readable; no horizontal scroll.
- `[ FRESH ]` pulse is visible.

- [ ] **Step 6: No regression**

Confirm §A instruments still update on canvas changes, §B castles still glow for the active phase, canvas + fireworks still work.

- [ ] **Step 7: Commit verification notes (optional)**

If anything is off, fix inline and commit. If all clean:

```bash
git status   # should be clean
```

---

## Self-review notes

Spec coverage:
- §D registry · five categories · live state — Tasks 3, 4, 5
- §C log expansion · phrase pools · filter chips — Tasks 6, 7
- Markdown export expansion — Task 8
- `observatoryBus.js` + hook — Tasks 1, 2
- Phase A emit sites (kernels, collider, polarity, gate, eye, lunar, tab nav, ledger) — Tasks 9, 10, 11
- Phase B emit-site TODO comments — Task 12
- Full cross-tab verification — Task 13

Tech notes:
- All emit imports use the path `../observatory/observatoryBus` or `../../observatory/observatoryBus` depending on file depth — verify on insertion.
- `getTotals()` returns a live object reference (not a snapshot). Consumers that need a snapshot at a specific moment should structure-copy what they need.
- The 1-second tick inside `CosmosRegistry` exists so `[FRESH]` (8s) and dim (30s) transitions repaint between emits.
- Existing v2 log entries get a `category: 'MERCURY'` tag so filter chips behave consistently — confirmed in Task 7 Step 5.
