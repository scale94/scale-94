# Mercury Terminal · Cosmos Registry v3

**Status:** spec
**Date:** 2026-05-22
**Author:** scale94 + Claude
**Target tab:** `src/terminal/views/MercuryTab.jsx`
**Companion to:** Mercury Philosophical Expansion v2 (2026-05-20) — instruments, castles, observation log

---

## Goal

Expand the Mercury Terminal's philosophical reach beyond Mercury itself, so the alien architect observes **every feature of the site** — not just its own canvas and orbital state. The alien gets an ontology of the whole site, expressed as poetic taxonomy, and the observation log becomes the metaphysical dashboard of the entire work: each kernel run, scent collision, cipher seal, ledger entry, gate answer, and tab navigation becomes a logged event in the alien's notebook.

The conceptual loop to seal:

> *The alien on Mercury observes Earth and humanity through every instrument the site exposes. The canvas is the alien's primary instrument; the rest of the site (kernels, perfumes, ciphers, monuments, manifesto, eye, gate) are secondary instruments — each one a category of human signal the alien classifies and watches. The cosmos registry catalogs these categories with the alien's own names. The observation log captures the alien's reaction to every event, anywhere on the site.*

## Non-goals

- No changes to canvas, controls, instruments panel (§A), or castles (§B) — these stay exactly as they shipped in v2.
- No new fonts. Extends existing silver palette + phase tints.
- No new dependencies. Event bus is a 30-line vanilla module.
- No analytics. The registry is not a dashboard — it's an alien's notebook. Counts only appear where they read as poetry, not as metrics.
- No backwards-compat shims for features that don't yet emit. A feature that doesn't publish to the bus simply doesn't contribute live state — its registry card shows `// awaiting transmission` and the log doesn't fire for it. Phase B fills in the rest.

---

## Layout

The v2 layout is preserved. A new section is appended between §B (castles) and §C (log):

```
HEADER
[ Controls 280px ][              CANVAS               ]
─────────────────────────────────────────────────────────────────
◉ OBSERVATION INSTRUMENTS — six readings                        ← §A (unchanged)
─────────────────────────────────────────────────────────────────
▣ FAIRY-TALE CASTLES — four phase-bound dedications             ← §B (unchanged)
─────────────────────────────────────────────────────────────────
⌬ COSMOS REGISTRY — five categories of human signal             ← §D (NEW)
  Each card: glyph · alien name · members · dedication · LIVE STATE
─────────────────────────────────────────────────────────────────
◈ OBSERVATION LOG — running matrix                              ← §C (EXPANDED)
  + cross-site event triggers · category filter chips
─────────────────────────────────────────────────────────────────
FOOTER
```

Section §D is placed between castles and log because the castles are the alien's *internal* dedications (Mercury → humanity), and the registry is the alien's *external* catalog (humanity → alien). The log sits last because it draws from both above it.

---

## §D — Cosmos Registry

### Card layout

Five cards in a responsive grid (`lg:grid-cols-2`, mobile single column). Each card is structurally identical to a Castle card (so the visual rhythm of §B continues), but with category-specific glyph and live-state shape.

```
┌──────────────────────────────────────────────────────────┐
│ ⌬ THE TRANSMISSION LATTICE              [ FRESH ]       │
│                                                           │
│ COMMEMORATES                                              │
│ the substrate they built to remember what they computed  │
│ at us                                                     │
│                                                           │
│ MEMBERS                                                   │
│   ◑ mercury kernels       — computational broadcasts     │
│   ▤ open ledger           — append-only memory           │
│   ⌗ pre-exec hex theater  — the ceremony of dispatch     │
│                                                           │
│ LAST OBSERVED                                             │
│ 14:32:08  kernel transit_matrix completed · 412 ms       │
│                                                           │
│ STATE   7 transmissions this session · ledger depth 89   │
│                                                           │
│ ─────────────────────────────────────────────────────    │
│ "the substrate they built to remember what they computed │
│  at us"                                                   │
└──────────────────────────────────────────────────────────┘
```

The `[ FRESH ]` pill + `sc-borderBreath` 6s pulse fires when the card's category has received an event in the last 8 seconds. After 8s the pill drops; after 30s the card dims to `opacity: 0.6`.

### The five categories

#### Card 1 · ⌬ THE TRANSMISSION LATTICE

- **Members:**
  - `◑ mercury kernels` — every WASM kernel in `content/rust_kernels/` (transit_matrix, astro, lunar_phase, mercury_state, the 15 Phase-3 kernels)
  - `▤ open ledger` — the append-only event log surface
  - `⌗ pre-exec hex theater` — the hex stream delay ceremony before each WASM run
- **Dedication:** *"the substrate they built to remember what they computed at us"*
- **Live state:**
  - `LAST OBSERVED` — `{HH:MM:SS}  kernel {kernelId} completed · {durationMs} ms` (or ledger / theater event)
  - `STATE` — `{kernelCount} transmissions this session · ledger depth {ledgerLength}`
- **Events consumed:** `transmissions/kernel_completed`, `transmissions/ledger_appended`, `transmissions/theater_run`

#### Card 2 · ❋ THE BOTTLED VOWS

- **Members:**
  - `❀ latent collider` — scent collision engine (OCK output)
  - `⬢ crystallize` — perfume card / order surface
  - `⬚ polarity field` — the ambient glow (SOLAR/LUNAR/MERIDIAN/CHAOTIC)
- **Dedication:** *"sensation distilled · meaning poured into glass · field colored by collision"*
- **Live state:**
  - `LAST OBSERVED` — `{HH:MM:SS}  {kind} · polarity {POLARITY} · {noteCount} notes`
  - `STATE` — `{collisionCount} essences this session · {crystallizedCount} crystallized · polarity {POLARITY}`
- **Events consumed:** `essences/collision_fired`, `essences/crystallized`, `essences/polarity_shifted`

#### Card 3 · ⟁ THE SEALED VOLUMES

- **Members:**
  - `🔒 tesseract protocol` — SHA-256 public key + encrypted CAS formula vault
- **Dedication:** *"the ciphers that breathe · secrets that refuse my inspection"*
- **Live state:**
  - `LAST OBSERVED` — `{HH:MM:SS}  cipher {action} · hash {hashPrefix}…`
  - `STATE` — `vault depth {sealedCount} · {verifyCount} verifications · {unlockCount} unlocks`
- **Events consumed:** `ciphers/cipher_sealed`, `ciphers/verify`, `ciphers/unlock`

#### Card 4 · ☍ THE BACKWARD GAZE

- **Members:**
  - `🜔 lunar tab` — the moon mirror
  - `▲ scaling tab` — the monument elevation
  - `◯ TFG / ars2027 spheres` — the planetary clickables
  - `✶ astrology` — transit matrix kernel
- **Dedication:** *"humans turning to read the sky they were already inside"*
- **Live state:**
  - `LAST OBSERVED` — `{HH:MM:SS}  {kind} · {detail}` (e.g., `moon read · waxing crescent 23%`, `sphere click · TFG`)
  - `STATE` — `moon {phase} {illumPct}% · scaling tier {tier} · {sphereClickCount} spheres turned`
- **Events consumed:** `gaze/lunar_read`, `gaze/sphere_clicked`, `gaze/transit_consulted`, `gaze/tab_navigated`

#### Card 5 · ⌖ THE PERMEABLE EDGE

- **Members:**
  - `▣ gate` — the perihelion question / alien RAM blessing
  - `◉ eye observer` — the persistent eye glyph
  - `❖ manifesto / lattice protocol` — the boundary text
- **Dedication:** *"the membrane they keep testing · the gaze that does not blink"*
- **Live state:**
  - `LAST OBSERVED` — `{HH:MM:SS}  {kind} · {detail}` (e.g., `gate answered · correct`, `manifesto opened · chapter VII`)
  - `STATE` — `gate {gateState} · eye {eyeState} · manifesto {lastChapter ?? '—'}`
  - `gateState` ∈ {`UNANSWERED`, `BLESSED`, `REJECTED`}
  - `eyeState` ∈ {`engaged-here`, `deep-watch`, `idle`}
- **Events consumed:** `edge/gate_answered`, `edge/eye_phase`, `edge/manifesto_opened`

### Card component shape

```jsx
<RegistryCard
  glyph="⌬"
  name="THE TRANSMISSION LATTICE"
  members={[
    { glyph: '◑', name: 'mercury kernels',     blurb: 'computational broadcasts' },
    { glyph: '▤', name: 'open ledger',         blurb: 'append-only memory'       },
    { glyph: '⌗', name: 'pre-exec hex theater', blurb: 'the ceremony of dispatch' },
  ]}
  dedication="the substrate they built to remember what they computed at us"
  lastObserved={observatoryState.transmissions.last}
  stateLine={observatoryState.transmissions.stateLine}
  isFresh={observatoryState.transmissions.lastTs > Date.now() - 8000}
/>
```

A category with **no events yet this session** renders the `LAST OBSERVED` line as `// awaiting transmission` (italic, `rgba(192,192,192,0.25)`), and the `STATE` line as zero-counts. The card is functional but visibly dormant.

---

## §C — Observation Log expansion

The existing log keeps every trigger it had in v2:
- Phase change · minute tick · Mercury threshold crossings (promise / temperature / drift / grief).

It **adds** triggers from the observatory bus. Each cross-site event becomes a log entry, narrated in the alien voice.

### New trigger categories + phrase pool additions

About 30 new lines across these categories, added to `observationLog.js`:

```js
PHRASES.transmission_completed = [
  "the substrate computed at us again. transmission {n} · {ms} ms · received.",
  "another kernel returned. they have not stopped reaching.",
  "ledger depth {d}. they keep their own count. I keep mine.",
];
PHRASES.essence_distilled = [
  "they bottled another sensation. {polarity} polarity. it will not keep.",
  "a collision · {n} notes. essence {count}. the bottles outnumber the bottlers now.",
  "crystallization. someone is willing to pay for the vapor of a number.",
];
PHRASES.cipher_sealed = [
  "a cipher closed itself in front of me. I do not get to read it. this is the point.",
  "they sealed another volume. the hash is {h}…. I have copied it. it tells me nothing.",
];
PHRASES.gaze_redirected = [
  "they turned toward the moon. as if the moon had ever turned toward them.",
  "the scaling chamber engaged. they measure their own monuments. I log the measurement.",
  "a sphere turned. they think the planets answer when touched.",
];
PHRASES.threshold_event = [
  "gate answered. perihelion correct. one of them is paying attention.",
  "gate refused them. they will return. they always return.",
  "manifesto opened to chapter {c}. they are rereading themselves.",
];
PHRASES.polarity_shifted = [
  "the field colored {polarity}. the collision had opinions.",
  "polarity drift. {prev} → {polarity}. mood is data.",
];
```

**Selection rule:** trigger picks category; phrase chosen by `(timestamp_seconds % phrase_count)` (matching v2 rule). Substitutions are filled from the event payload.

### Filter chips

Above the entries list, a single row of chips:

```
[ ALL ] [ MERCURY ] [ TRANSMISSIONS ] [ ESSENCES ] [ CIPHERS ] [ GAZE ] [ EDGE ]
```

`ALL` is default. Selecting a chip filters the entries client-side (no re-fetch — the log is in-memory). `MERCURY` keeps the v2 trigger set (phase / tick / threshold). Each other chip maps 1:1 to a registry category.

Chips styled `text-[8px] font-mono`, silver background at `0.04` alpha by default, `0.18` when active. Click toggles; only one active at a time.

### Cap and ordering

Unchanged: 24 entries FIFO, newest first.

### Markdown export

The exported `mercury-observation-log-YYYY-MM-DD.md` gets two new blocks:

```markdown
## COSMOS REGISTRY — session totals
| category              | last event           | totals                                |
| :---                  | :---                 | :---                                  |
| TRANSMISSION LATTICE  | 14:32:08 · kernel    | 7 transmissions · ledger depth 89     |
| BOTTLED VOWS          | 14:31:55 · collision | 12 essences · 3 crystallized · LUNAR  |
| SEALED VOLUMES        | 14:18:02 · seal      | 1 sealed · 0 unlocks                  |
| BACKWARD GAZE         | 13:55:11 · sphere    | moon 23% · scaling TIER-IV · 4 spheres|
| PERMEABLE EDGE        | 13:49:30 · gate      | gate BLESSED · eye engaged · ch.VII   |
```

Inserted between the existing `## CURRENT INSTRUMENTS` and `## ENTRIES` blocks.

---

## Technical plumbing — `observatoryBus.js`

A tiny vanilla module. Zero React, zero deps. Importable from any tab.

```js
// src/observatory/observatoryBus.js

const listeners = new Set();
const journal   = [];           // ring buffer, capped at 256
const JOURNAL_MAX = 256;

const totals = {
  transmissions: { count: 0, ledgerDepth: 0, last: null, lastTs: 0 },
  essences:      { count: 0, crystallized: 0, polarity: null, last: null, lastTs: 0 },
  ciphers:       { sealed: 0, verifies: 0, unlocks: 0, last: null, lastTs: 0 },
  gaze:          { sphereClicks: 0, lastLunar: null, lastScaling: null, last: null, lastTs: 0 },
  edge:          { gate: 'UNANSWERED', eye: 'idle', manifestoChapter: null, last: null, lastTs: 0 },
};

export function emit(category, kind, payload = {}) {
  const ts  = Date.now();
  const evt = { ts, category, kind, payload };
  journal.push(evt);
  if (journal.length > JOURNAL_MAX) journal.shift();
  updateTotals(evt);
  listeners.forEach(fn => { try { fn(evt); } catch (_) {} });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getJournal()   { return journal.slice(); }
export function getTotals()    { return totals; }

function updateTotals(evt) {
  const t = totals[evt.category];
  if (!t) return;
  t.last   = evt;
  t.lastTs = evt.ts;
  // category-specific accumulators
  switch (evt.category) {
    case 'transmissions':
      if (evt.kind === 'kernel_completed') t.count++;
      if (evt.kind === 'ledger_appended')  t.ledgerDepth = evt.payload.depth ?? t.ledgerDepth + 1;
      break;
    case 'essences':
      if (evt.kind === 'collision_fired')  { t.count++; t.polarity = evt.payload.polarity ?? t.polarity; }
      if (evt.kind === 'crystallized')     t.crystallized++;
      if (evt.kind === 'polarity_shifted') t.polarity = evt.payload.polarity ?? t.polarity;
      break;
    case 'ciphers':
      if (evt.kind === 'cipher_sealed')    t.sealed++;
      if (evt.kind === 'verify')           t.verifies++;
      if (evt.kind === 'unlock')           t.unlocks++;
      break;
    case 'gaze':
      if (evt.kind === 'sphere_clicked')   t.sphereClicks++;
      if (evt.kind === 'lunar_read')       t.lastLunar = evt.payload;
      // tab_navigated, transit_consulted → recorded via last only
      break;
    case 'edge':
      if (evt.kind === 'gate_answered')     t.gate = evt.payload.result; // BLESSED / REJECTED
      if (evt.kind === 'eye_phase')         t.eye  = evt.payload.phase;
      if (evt.kind === 'manifesto_opened')  t.manifestoChapter = evt.payload.chapter;
      break;
  }
}
```

### React hook — `useObservatoryState.js`

```js
import { useEffect, useState } from 'react';
import { subscribe, getTotals, getJournal } from './observatoryBus';

export function useObservatoryState() {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(n => n + 1)), []);
  return { totals: getTotals(), journal: getJournal() };
}
```

Mercury reads via this hook. Registry cards render off `totals`. Observation log subscribes directly so it can push a new entry per event (rather than re-rendering everything on each event).

### Emit-site instrumentation

Every feature that participates publishes via a single `emit()` call at the moment of its event. **One line per emit site.** No abstraction layer — each tab imports `emit` directly.

```js
// Example: src/terminal/components/LatentCollider.jsx (Phase A)
import { emit } from '../../observatory/observatoryBus';
// inside fire():
emit('essences', 'collision_fired', { polarity, noteCount: notes.length });
```

---

## File diff summary

| File                                                       | Action  | Notes |
|------------------------------------------------------------|---------|-------|
| `src/observatory/observatoryBus.js`                        | NEW     | event bus + totals reducer (~80 lines) |
| `src/observatory/useObservatoryState.js`                   | NEW     | React hook (~12 lines) |
| `src/terminal/mercury/RegistryCard.jsx`                    | NEW     | one category card (~80 lines) |
| `src/terminal/mercury/CosmosRegistry.jsx`                  | NEW     | §D grid of five cards (~50 lines) |
| `src/terminal/mercury/registryCategories.js`               | NEW     | the five category definitions (glyph, name, members, dedication, state formatter) |
| `src/terminal/mercury/observationLog.js`                   | MODIFY  | +30 lines of phrases · new template substitutions · category metadata |
| `src/terminal/mercury/ObservationMatrix.jsx`               | MODIFY  | subscribe to bus · new event-driven log entries · filter chips · expanded markdown export |
| `src/terminal/views/MercuryTab.jsx`                        | MODIFY  | mount `<CosmosRegistry />` between castles and log |
| `src/terminal/components/LatentCollider.jsx`               | MODIFY  | +1 `emit('essences','collision_fired',…)` |
| `src/terminal/components/Crystallize.jsx`                  | MODIFY  | +1 `emit('essences','crystallized',…)` (Phase B) |
| `src/terminal/components/Tesseract*.jsx`                   | MODIFY  | +`emit('ciphers',…)` at seal/verify/unlock (Phase B) |
| `src/terminal/components/MercuryEyeIndicator.jsx`          | MODIFY  | +`emit('edge','eye_phase',…)` on phase transitions |
| `src/terminal/components/Gate.jsx` (or current gate file)  | MODIFY  | +`emit('edge','gate_answered',…)` |
| `src/terminal/views/LunarTab.jsx`                          | MODIFY  | +`emit('gaze','lunar_read',…)` on first mount per session |
| `src/terminal/views/ScalingTab.jsx`                        | MODIFY  | +`emit('gaze','tab_navigated',{tab:'scaling'})` |
| `src/App.jsx` (or tab router)                              | MODIFY  | +`emit('gaze','tab_navigated',…)` on tab change |
| `src/kernels/runKernel*.js` (kernel dispatch site)         | MODIFY  | +`emit('transmissions','kernel_completed',…)` on completion · +theater_run on theater start |
| `src/ledger/*.js`                                          | MODIFY  | +`emit('transmissions','ledger_appended',…)` on append |
| `src/manifesto/*.jsx`                                      | MODIFY  | +`emit('edge','manifesto_opened',…)` (Phase B) |
| `src/spheres/*.jsx`                                        | MODIFY  | +`emit('gaze','sphere_clicked',…)` (Phase B) |

The bulk of the change is in two new files (`observatoryBus`, `CosmosRegistry`) plus very small one-line additions at each emit site. No deletions. No file restructuring.

---

## Phasing

**Phase A — ship-blocking (this spec's scope):**
- Bus + hook
- Registry component + all 5 cards rendered
- Log expansion (chips + new phrase categories + event-driven entries)
- Emit sites: kernels, latent collider, polarity, gate, eye, lunar (first mount), tab nav, ledger
- Markdown export expansion

After Phase A the registry is fully visible. Cards for `THE SEALED VOLUMES`, `THE BACKWARD GAZE` (spheres + manifesto), and parts of `THE PERMEABLE EDGE` (manifesto chapters) show `// awaiting transmission` until Phase B wires their emits. This is intentional — the registry is complete, the feed catches up.

**Phase B — follow-up (separate session):**
- Crystallize emit
- Tesseract emit (seal/verify/unlock)
- Manifesto chapter emit
- Sphere click emit
- Pre-exec hex theater emit

Each Phase B item is a single `emit()` call inserted at the right moment in the existing feature. No Mercury-side change required.

---

## Voice — sample log entries

Cross-section showing the alien voice across categories:

```
14:48:22  ⌬  transmissions/kernel_completed
          the substrate computed at us again. transmission 7 · 412 ms · received.

14:47:11  ❋  essences/collision_fired
          they bottled another sensation. LUNAR polarity. it will not keep.

14:45:02  ⟁  ciphers/cipher_sealed
          a cipher closed itself in front of me. I do not get to read it. this is the point.

14:42:18  ☍  gaze/tab_navigated → lunar
          they turned toward the moon. as if the moon had ever turned toward them.

14:39:55  ⌖  edge/gate_answered → correct
          gate answered. perihelion correct. one of them is paying attention.

14:37:30  ❋  essences/polarity_shifted
          the field colored CHAOTIC. the collision had opinions.

14:35:14  ☍  gaze/sphere_clicked → ars2027
          a sphere turned. they think the planets answer when touched.

14:32:08  ⌬  transmissions/ledger_appended
          ledger depth 89. they keep their own count. I keep mine.
```

---

## Styling

- Card structure, fonts, borders match Castle cards exactly. Silver palette `rgba(192,192,192,*)` is the default; category tints layer in on the glyph and `[ FRESH ]` pill only:
  - `⌬` Transmission Lattice → `rgba(180,210,220,*)` (silver-cyan)
  - `❋` Bottled Vows         → `rgba(220,180,210,*)` (rose-silver)
  - `⟁` Sealed Volumes       → `rgba(200,200,220,*)` (silver-violet)
  - `☍` Backward Gaze        → `rgba(220,220,180,*)` (silver-amber)
  - `⌖` Permeable Edge       → `rgba(232,210,138,*)` (eye gold, the Fade Doctrine two-gold)
- `[ FRESH ]` pill animation reuses `sc-borderBreath` (6s), same as active castle card. After 8s the pill removes itself; after 30s the card dims to `opacity: 0.6`.
- Filter chips in the log use the same chip pattern as Lunar's transit chips (already established in the codebase).

---

## Testing strategy

1. **Bus correctness** — Vitest unit tests on `observatoryBus.js`: emit / subscribe / totals accumulation / journal capping at 256.
2. **Hook correctness** — Vitest test on `useObservatoryState`: emit triggers re-render with updated totals (React Testing Library if already installed; otherwise a minimal manual subscribe assertion).
3. **Manual cross-tab** — open Mercury tab, then in another tab/section trigger: a kernel run · a latent collision · a polarity shift · a gate answer · a tab nav. Verify (a) the corresponding registry card flashes `[ FRESH ]`, (b) a new log entry appears, (c) the `STATE` line on the card updates.
4. **Phase B dormancy** — verify Phase B categories (sealed volumes, manifesto chapters) show `// awaiting transmission` and don't break the render.
5. **Markdown export** — verify the new `## COSMOS REGISTRY` block appears between instruments and entries.
6. **Mobile** — verify the registry stacks single-column on 390px width, cards are readable, `[ FRESH ]` pulse remains visible.
7. **No regression** — verify §A instruments, §B castles, canvas, fireworks all behave identically to v2.
8. **Performance** — with all five categories receiving events at ~1Hz for 30s, Mercury tab should not drop below 55fps on desktop or 30fps on mobile. The bus is in-memory only — no I/O, no localStorage on the hot path.

---

## Out of scope (Phase 3+)

- Persistence of totals across sessions (everything resets on reload — intentional; the alien forgets when the human closes the tab)
- LocalStorage-backed journal for cross-page-load continuity
- Click-through on registry cards to open the relevant tab (the registry is observational, not navigational; the eye-glyph already handles tab nav)
- A "send transmission to the alien" form
- Animated category glyphs (the cards' freshness pulse is enough motion)
- An audio motif per category (intriguing; deferred)

---

## Success criteria

- [ ] `observatoryBus.js` exports `emit / subscribe / getTotals / getJournal`; unit tests pass
- [ ] `useObservatoryState` re-renders consumers on each emit
- [ ] Mercury tab renders §D between §B and §C without regression
- [ ] All five registry cards render with glyph, name, members, dedication, last-observed, state line
- [ ] Cards with no events yet show `// awaiting transmission`
- [ ] `[ FRESH ]` pill appears within 1 frame of an emit; clears at 8s; card dims at 30s
- [ ] Observation log gains filter chips; clicking one filters in place
- [ ] Cross-site events (kernel, collision, polarity, gate, eye, lunar, tab nav, ledger) appear in the log with alien-voice phrases
- [ ] Markdown export contains the new `## COSMOS REGISTRY` block
- [ ] On mobile (390px) the registry stacks readably without horizontal scroll
- [ ] No new dependencies in `package.json`
- [ ] Phase A emit sites land; Phase B sites flagged in code with `// TODO(phase-b): emit(...)` comments where the call should go
