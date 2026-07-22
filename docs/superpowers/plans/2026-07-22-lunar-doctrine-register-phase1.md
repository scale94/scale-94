# LUNAR DOCTRINE REGISTER — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compile a decisive, moon-phase-driven doctrine reading through the five lore kernels and render it in the `/LUNAR` tab.

**Architecture:** A pure scoring engine selects one of five kernel lenses — lunar arc position dominates via a continuous affinity curve over the synodic wheel, the tightest live transit modulates and breaks ties, the quintessence spine adds a small bonus. The selected lens indexes an authored corpus keyed by arc quadrant and aspect-tension class, producing `Plato / Promo / Paradox` plus one imperative. No React in the engine; no logic in the view.

**Tech Stack:** React 18, Vite, Vitest, Tailwind. No new dependencies.

**Spec:** [2026-07-22-lunar-doctrine-register-design.md](../specs/2026-07-22-lunar-doctrine-register-design.md) — Phase 1 covers §5, §6, §7 and their §10 tests. **§8 (shader moon) is out of scope for this plan.** The canvas moon is not touched.

## Global Constraints

- **Source discipline (binding).** Shape only. No events, persons, places, institutions or biography — in code, corpus, comments, test names or commit messages. Kernel theses already published on scale94.com are fair material; their sources are not.
- **Directive rules.** One sentence, imperative mood, one verb, one object. No "may", "might", "invites", "consider". No directive promises arrival, transformation or enlightenment — they address conduct and seeing only.
- **All corpus copy in this plan is first draft.** Each per-kernel task is an author review gate; text may be rejected or rewritten without affecting any other task.
- **Test command:** `npm test` (vitest run). Single file: `npx vitest run <path>`.
- **Nothing is deleted.** No existing behaviour changes. `LUNAR_ACCORDS`, `DRYNESS`, `TransitMatrix` and `LunarCanvas` are untouched.
- **Spec amendment required.** Spec §9 claims `LunarTab.jsx` gains "only imports and mount points". Task 1 also removes four module-private constants from it and re-imports them. Task 1 amends the spec to say so.

---

### Task 1: Extract shared synodic domain

`SYNODIC_PERIOD`, `PHASES`, `getPhase` and `ASPECT_TENSION` are module-private inside `LunarTab.jsx`, so the engine cannot reach them. Move them to a pure module and add the derived helpers the engine needs. Pure move — no behaviour change.

**Files:**
- Create: `src/terminal/lunar/synodic.js`
- Create: `src/terminal/lunar/__tests__/synodic.test.js`
- Modify: `src/terminal/views/LunarTab.jsx` (remove lines 32, 89–102, 801; add import)
- Modify: `docs/superpowers/specs/2026-07-22-lunar-doctrine-register-design.md` (§9 note)

**Interfaces:**
- Consumes: nothing
- Produces: `SYNODIC_PERIOD: number`, `PHASES: Array<{id,label,glyph,range:[number,number]}>`, `getPhase(age: number) → Phase`, `ASPECT_TENSION: Record<string,number>`, `tensionClassOf(aspectName: string) → 'harmonic'|'fused'|'friction'|'polarity'`, `ARC_QUADRANTS: string[]`, `quadrantOf(age: number) → string`, `wrappedDistance(a: number, b: number, period?: number) → number`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lunar/__tests__/synodic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  SYNODIC_PERIOD, PHASES, getPhase, ASPECT_TENSION,
  tensionClassOf, ARC_QUADRANTS, quadrantOf, wrappedDistance,
} from '../synodic';

describe('synodic', () => {
  it('keeps the period and the eight phases in cycle order', () => {
    expect(SYNODIC_PERIOD).toBeCloseTo(29.53058770576, 10);
    expect(PHASES.map(p => p.id)).toEqual([
      'new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous',
      'full', 'waning-gibbous', 'last-quarter', 'waning-crescent',
    ]);
  });

  it('getPhase resolves ages to phases and clamps past the end', () => {
    expect(getPhase(0).id).toBe('new');
    expect(getPhase(14.7).id).toBe('full');
    expect(getPhase(29.52).id).toBe('waning-crescent');
    expect(getPhase(99).id).toBe('new');   // out of range falls back to PHASES[0]
  });

  it('classifies aspect tension into four classes', () => {
    expect(tensionClassOf('Trine')).toBe('harmonic');
    expect(tensionClassOf('Sextile')).toBe('harmonic');
    expect(tensionClassOf('Conjunct')).toBe('fused');
    expect(tensionClassOf('Square')).toBe('friction');
    expect(tensionClassOf('Opposite')).toBe('polarity');
    expect(tensionClassOf('nonsense')).toBe('fused');   // unknown → zero tension
    expect(ASPECT_TENSION.Square).toBe(1);
  });

  it('splits the arc into four quadrants and clamps the endpoints', () => {
    expect(ARC_QUADRANTS).toHaveLength(4);
    expect(quadrantOf(0)).toBe('DARK-WAXING');
    expect(quadrantOf(8)).toBe('LIGHT-WAXING');
    expect(quadrantOf(16)).toBe('LIGHT-WANING');
    expect(quadrantOf(25)).toBe('DARK-WANING');
    expect(quadrantOf(SYNODIC_PERIOD)).toBe('DARK-WANING');   // clamp, not overflow
    expect(quadrantOf(-1)).toBe('DARK-WAXING');
  });

  it('measures distance across the wheel seam', () => {
    expect(wrappedDistance(0.1, 0)).toBeCloseTo(0.1, 6);
    // 29.4 is 0.13 days *before* new, not 29.4 days after it
    expect(wrappedDistance(29.4, 0)).toBeCloseTo(0.1305877, 5);
    expect(wrappedDistance(0, 14.765)).toBeCloseTo(14.765, 3);
    expect(wrappedDistance(5, 5)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lunar/__tests__/synodic.test.js`
Expected: FAIL — `Failed to resolve import "../synodic"`

- [ ] **Step 3: Create the module**

Create `src/terminal/lunar/synodic.js`. The first four exports are moved verbatim out of `LunarTab.jsx` — do not retune the phase ranges or the tension values, downstream code depends on both.

```js
// src/terminal/lunar/synodic.js — shared synodic domain.
// Moved out of LunarTab.jsx so the doctrine engine can reach it without
// importing the view. Pure data + pure functions, no React, no DOM:
// same discipline as spineStore / vertebrae.

export const SYNODIC_PERIOD = 29.53058770576;

// Phase ranges tuned to astronomical convention:
// New/Full are narrow (~1.5 day windows centered on the event),
// quarters and crescents/gibbous fill the remaining arc.
export const PHASES = [
  { id: 'new',              label: 'New Moon',          glyph: '🌑', range: [0, 1.11] },
  { id: 'waxing-crescent',  label: 'Waxing Crescent',   glyph: '🌒', range: [1.11, 6.38] },
  { id: 'first-quarter',    label: 'First Quarter',     glyph: '🌓', range: [6.38, 8.77] },
  { id: 'waxing-gibbous',   label: 'Waxing Gibbous',    glyph: '🌔', range: [8.77, 13.65] },
  { id: 'full',             label: 'Full Moon',         glyph: '🌕', range: [13.65, 15.88] },
  { id: 'waning-gibbous',   label: 'Waning Gibbous',    glyph: '🌖', range: [15.88, 20.76] },
  { id: 'last-quarter',     label: 'Last Quarter',      glyph: '🌗', range: [20.76, 23.15] },
  { id: 'waning-crescent',  label: 'Waning Crescent',   glyph: '🌘', range: [23.15, 29.53] },
];

export function getPhase(age) {
  return PHASES.find(p => age >= p.range[0] && age < p.range[1]) || PHASES[0];
}

export const ASPECT_TENSION = { Conjunct: 0, Sextile: -1, Trine: -2, Square: 1, Opposite: 2 };

// Four classes the doctrine corpus is keyed on. Unknown aspects read as fused
// (zero tension) rather than throwing — a malformed aspect must not deny a reading.
export function tensionClassOf(aspectName) {
  const t = ASPECT_TENSION[aspectName] ?? 0;
  if (t <= -1) return 'harmonic';
  if (t === 0)  return 'fused';
  if (t === 1)  return 'friction';
  return 'polarity';
}

// Corpus indexing. Distinct from the lens centers in doctrineLens.js: quadrants
// pick which *text* a kernel speaks, centers pick which *kernel* speaks.
export const ARC_QUADRANTS = ['DARK-WAXING', 'LIGHT-WAXING', 'LIGHT-WANING', 'DARK-WANING'];

export function quadrantOf(age) {
  const q = Math.floor((age / SYNODIC_PERIOD) * 4);
  return ARC_QUADRANTS[Math.min(Math.max(q, 0), 3)];
}

// Distance on the wheel, not on the number line: a kernel centered on the new
// moon must score identically just before and just after it.
export function wrappedDistance(a, b, period = SYNODIC_PERIOD) {
  const d = Math.abs(((a - b) % period + period) % period);
  return Math.min(d, period - d);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lunar/__tests__/synodic.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Rewire LunarTab.jsx to the shared module**

Delete line 32 (`const SYNODIC_PERIOD = ...`), lines 89–102 (the `PHASES` array, its preceding comment block, and `getPhase`), and line 801 (`const ASPECT_TENSION = ...`). Add to the import block near the top, after the `lunarAccords` import:

```js
import { SYNODIC_PERIOD, PHASES, getPhase, ASPECT_TENSION } from '../lunar/synodic';
```

Leave `PLANET_DATA`, `ASPECT_GLYPH` and `ASPECT_COLOR` where they are — they are presentation, not domain, and the register receives them as props in Task 12.

- [ ] **Step 6: Verify nothing regressed**

Run: `npm test`
Expected: PASS — the full existing suite, including `quintessence/__tests__/lunarAccords.test.js`. If any test fails here, the extraction changed a value; diff the moved constants against git history before proceeding.

- [ ] **Step 7: Amend the spec**

In `docs/superpowers/specs/2026-07-22-lunar-doctrine-register-design.md` §9, replace:

```
`LunarTab.jsx` is already 1452 lines and gains **only** imports and mount
points — no new logic. Nothing existing is deleted in this change.
```

with:

```
`LunarTab.jsx` gains imports, two mount points, and one pure extraction:
`SYNODIC_PERIOD`, `PHASES`, `getPhase` and `ASPECT_TENSION` move to
`lunar/synodic.js` because they are module-private and the engine needs them.
No new logic, no behaviour change. Nothing existing is deleted.
```

- [ ] **Step 8: Commit**

```bash
git add src/terminal/lunar/synodic.js src/terminal/lunar/__tests__/synodic.test.js src/terminal/views/LunarTab.jsx docs/superpowers/specs/2026-07-22-lunar-doctrine-register-design.md
git commit -m "refactor(lunar): extract synodic domain out of the view

SYNODIC_PERIOD, PHASES, getPhase and ASPECT_TENSION were module-private in
LunarTab.jsx. Move them verbatim to lunar/synodic.js and add the derived
helpers the doctrine engine needs: tensionClassOf, quadrantOf, wrappedDistance.

Pure move, no behaviour change."
```

---

### Task 2: Lens table and phase affinity

The moon selects. This task builds only the lunar half of the score.

**Files:**
- Create: `src/terminal/lunar/doctrineLens.js`
- Create: `src/terminal/lunar/__tests__/doctrineLens.test.js`

**Interfaces:**
- Consumes: `wrappedDistance`, `SYNODIC_PERIOD` from `../synodic`
- Produces: `LENSES: Array<{id,kernel,center,planets,element}>`, `SIGMA: number`, `PHASE_OWNER: Record<string,string>`, `phaseAffinity(center: number, age: number) → number`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lunar/__tests__/doctrineLens.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { LENSES, PHASE_OWNER, phaseAffinity } from '../doctrineLens';
import { PHASES, SYNODIC_PERIOD } from '../synodic';

describe('doctrineLens', () => {
  it('holds exactly the five kernels in wheel order', () => {
    expect(LENSES.map(l => l.id)).toEqual([
      'hudelschublade', 'blackhole', 'semiotic', 'fishscale', 'rossignol',
    ]);
    expect(LENSES.map(l => l.center)).toEqual([0.0, 9.5, 16.5, 22.0, 26.5]);
  });

  it('gives rossignol no element — it is the fifth', () => {
    const byId = Object.fromEntries(LENSES.map(l => [l.id, l]));
    expect(byId.hudelschublade.element).toBe('FIRE');
    expect(byId.blackhole.element).toBe('EARTH');
    expect(byId.semiotic.element).toBe('AIR');
    expect(byId.fishscale.element).toBe('WATER');
    expect(byId.rossignol.element).toBeNull();
  });

  it('assigns every one of the eight phases to a real lens', () => {
    const ids = new Set(LENSES.map(l => l.id));
    for (const p of PHASES) {
      expect(ids.has(PHASE_OWNER[p.id])).toBe(true);
    }
    expect(Object.keys(PHASE_OWNER)).toHaveLength(8);
  });

  it('peaks affinity at the center and falls off with distance', () => {
    expect(phaseAffinity(9.5, 9.5)).toBeCloseTo(100, 6);
    expect(phaseAffinity(9.5, 13.7)).toBeLessThan(65);   // 1 sigma out
    expect(phaseAffinity(9.5, 17.5)).toBeLessThan(20);   // 2 sigma out
  });

  it('scores identically either side of the wheel seam', () => {
    // The whole reason wrappedDistance exists: hudelschublade sits on age 0.
    // The mirror of age 0.1 across the seam is exactly SYNODIC_PERIOD - 0.1.
    // Rounding that literal (e.g. to 29.43) destroys the symmetry the test
    // exists to prove — the curve is steep here, so 0.0006 days of drift
    // moves affinity by more than a 4-decimal tolerance allows.
    expect(phaseAffinity(0, 0.1)).toBeCloseTo(phaseAffinity(0, SYNODIC_PERIOD - 0.1), 10);
  });

  it('cannot let a distant lens be overturned by the maximum modulation', () => {
    // a lens on its center vs a lens 8 days away, with max transit (30) + spine (15)
    expect(phaseAffinity(0, 0)).toBeGreaterThan(phaseAffinity(0, 8) + 30 + 15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lunar/__tests__/doctrineLens.test.js`
Expected: FAIL — `Failed to resolve import "../doctrineLens"`

- [ ] **Step 3: Write the implementation**

Create `src/terminal/lunar/doctrineLens.js`:

```js
// src/terminal/lunar/doctrineLens.js — which kernel is speaking (spec §5.1).
// Five lenses seated around the synodic wheel. The moon selects; the sky
// modulates. Affinity is continuous rather than bucketed so dragging the
// time-scrub recompiles the doctrine smoothly instead of stepping.
import { wrappedDistance } from './synodic';

// Falloff width in days. 4.2 keeps each lens dominant over roughly a quarter
// of the wheel while leaving real contest in the overlaps, which is where the
// transit bonus is meant to decide.
export const SIGMA = 4.2;

export const LENSES = [
  {
    id: 'hudelschublade',
    kernel: 'HUDELSCHUBLADE-ROUTING-KERNEL 1.0.0',
    center: 0.0,                                   // new → waxing crescent
    planets: { Mercury: 1.0, Saturn: 0.8, Pluto: 0.5 },
    element: 'FIRE',                               // the chaos house
  },
  {
    id: 'blackhole',
    kernel: 'BLACK-HOLE-TAXONOMY-KERNEL 1.0.0',
    center: 9.5,                                   // first quarter → waxing gibbous
    planets: { Pluto: 1.0, Saturn: 0.7, Neptune: 0.6 },
    element: 'EARTH',                              // bare metal
  },
  {
    id: 'semiotic',
    kernel: 'SEMIOTIC-SYNTHESIS-KERNEL 9.9.9',
    center: 16.5,                                  // full → waning gibbous
    planets: { Mercury: 1.0, Mars: 0.7, Uranus: 0.7 },
    element: 'AIR',                                // transmission
  },
  {
    id: 'fishscale',
    kernel: 'FISH-SCALE-KERNEL 11.1.1',
    center: 22.0,                                  // last quarter — dryness 96
    planets: { Neptune: 0.9, Venus: 0.7, Pluto: 0.6 },
    element: 'WATER',                              // wetness is vitality
  },
  {
    id: 'rossignol',
    kernel: 'ROSSIGNOL-RUISENOR-NIGHTINGALE-ANDALIB-KERNEL 5.5.5.5',
    center: 26.5,                                  // waning crescent → return to new
    planets: { Jupiter: 0.9, Venus: 0.8, Sun: 0.6 },
    element: null,                                 // takes no element: it is the fifth
  },
];

// Which lens owns each phase outright. Used only by the spine bonus, which
// rewards a compiled phase that agrees with the sky rather than re-deriving
// ownership from the affinity curve.
export const PHASE_OWNER = {
  'new':             'hudelschublade',
  'waxing-crescent': 'hudelschublade',
  'first-quarter':   'blackhole',
  'waxing-gibbous':  'blackhole',
  'full':            'semiotic',
  'waning-gibbous':  'semiotic',
  'last-quarter':    'fishscale',
  'waning-crescent': 'rossignol',
};

export function phaseAffinity(center, age) {
  const d = wrappedDistance(age, center);
  return 100 * Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lunar/__tests__/doctrineLens.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lunar/doctrineLens.js src/terminal/lunar/__tests__/doctrineLens.test.js
git commit -m "feat(lunar): seat the five kernel lenses on the synodic wheel

Continuous gaussian affinity (sigma 4.2) rather than phase buckets, so the
time-scrub recompiles smoothly. A lens on its center cannot be overturned by
the maximum transit + spine modulation, which is what makes the moon primary."
```

---

### Task 3: Transit modulation and the no-transit path

**Files:**
- Modify: `src/terminal/lunar/doctrineLens.js`
- Modify: `src/terminal/lunar/__tests__/doctrineLens.test.js`

**Interfaces:**
- Consumes: `LENSES`, `SYNODIC_PERIOD`
- Produces: `transitBonus(lens: Lens, dominant: Aspect|null) → number`, `synthesizeLunarAspect(age: number) → Aspect`, where `Aspect = { p1: string, p2: string, aspect: string, orb: number, synthetic?: boolean }`

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/lunar/__tests__/doctrineLens.test.js`:

```js
import { transitBonus, synthesizeLunarAspect } from '../doctrineLens';
import { SYNODIC_PERIOD } from '../synodic';

describe('transitBonus', () => {
  const semiotic = LENSES.find(l => l.id === 'semiotic');
  const fishscale = LENSES.find(l => l.id === 'fishscale');

  it('is zero without a dominant aspect', () => {
    expect(transitBonus(semiotic, null)).toBe(0);
  });

  it('is zero when neither body is weighted by the lens', () => {
    expect(transitBonus(semiotic, { p1: 'Jupiter', p2: 'Sun', aspect: 'Trine', orb: 0 })).toBe(0);
  });

  it('pays most for a tight aspect between two weighted bodies', () => {
    // Mercury 1.0 + Mars 0.7 → mean 0.85, orb 0 → tightness 1 → 30 * 0.85
    expect(transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 0 }))
      .toBeCloseTo(25.5, 6);
  });

  it('decays linearly to zero at the 8 degree orb limit', () => {
    const tight = transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 4 });
    expect(tight).toBeCloseTo(12.75, 6);
    expect(transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 8 })).toBe(0);
    expect(transitBonus(semiotic, { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 99 })).toBe(0);
  });

  it('never exceeds the 30 point ceiling', () => {
    for (const lens of LENSES) {
      const [a, b] = Object.keys(lens.planets);
      expect(transitBonus(lens, { p1: a, p2: b, aspect: 'Conjunct', orb: 0 })).toBeLessThanOrEqual(30);
    }
  });

  it('discriminates between lenses on the same aspect', () => {
    const asp = { p1: 'Neptune', p2: 'Venus', aspect: 'Trine', orb: 1 };
    expect(transitBonus(fishscale, asp)).toBeGreaterThan(transitBonus(semiotic, asp));
  });
});

describe('synthesizeLunarAspect', () => {
  it('reads new moon as the Sun-Moon conjunction', () => {
    const a = synthesizeLunarAspect(0);
    expect(a).toMatchObject({ p1: 'Sun', p2: 'Moon', aspect: 'Conjunct', orb: 0, synthetic: true });
  });

  it('reads full moon as the opposition', () => {
    expect(synthesizeLunarAspect(SYNODIC_PERIOD * 0.5).aspect).toBe('Opposite');
  });

  it('reads both quarters as squares', () => {
    expect(synthesizeLunarAspect(SYNODIC_PERIOD * 0.25).aspect).toBe('Square');
    expect(synthesizeLunarAspect(SYNODIC_PERIOD * 0.75).aspect).toBe('Square');
  });

  it('closes the wheel — the end of the cycle is a conjunction, not an opposition', () => {
    expect(synthesizeLunarAspect(SYNODIC_PERIOD - 0.01).aspect).toBe('Conjunct');
  });

  it('caps the orb at the 8 degree limit so it stays a usable aspect', () => {
    const mid = synthesizeLunarAspect(SYNODIC_PERIOD * 0.125);   // maximally far from any exact point
    expect(mid.orb).toBeLessThanOrEqual(8);
    expect(mid.orb).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lunar/__tests__/doctrineLens.test.js`
Expected: FAIL — `transitBonus is not a function`

- [ ] **Step 3: Write the implementation**

Append to `src/terminal/lunar/doctrineLens.js`:

```js
import { SYNODIC_PERIOD } from './synodic';

// Secondary term (spec §5.2), ceiling 30. Scaled by how tight the aspect is:
// an 8 degree orb is the widest this tab ever reports, so it pays nothing.
export function transitBonus(lens, dominant) {
  if (!dominant) return 0;
  const tightness = Math.min(Math.max(1 - dominant.orb / 8, 0), 1);
  const w1 = lens.planets[dominant.p1] ?? 0;
  const w2 = lens.planets[dominant.p2] ?? 0;
  return 30 * tightness * ((w1 + w2) / 2);
}

// There is no null path. Lunar age IS the Sun-Moon elongation, so when the
// ephemeris is unavailable or nothing is within orb, the moon itself supplies
// the aspect: conjunct at new, opposite at full, square at the quarters.
// Astronomically exact, and a reading always exists.
const LUNAR_EXACT = [
  { at: 0,                     name: 'Conjunct' },
  { at: SYNODIC_PERIOD * 0.25, name: 'Square' },
  { at: SYNODIC_PERIOD * 0.5,  name: 'Opposite' },
  { at: SYNODIC_PERIOD * 0.75, name: 'Square' },
  { at: SYNODIC_PERIOD,        name: 'Conjunct' },   // closes the wheel
];

export function synthesizeLunarAspect(age) {
  let best = LUNAR_EXACT[0];
  let bestD = Infinity;
  for (const p of LUNAR_EXACT) {
    const d = Math.abs(age - p.at);
    if (d < bestD) { bestD = d; best = p; }
  }
  // days from exact → degrees of elongation (360 per synodic period), capped
  // at the tab's own widest reported orb.
  const orb = Math.min(8, (bestD / SYNODIC_PERIOD) * 360);
  return {
    p1: 'Sun', p2: 'Moon', aspect: best.name,
    orb: Number(orb.toFixed(1)), synthetic: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lunar/__tests__/doctrineLens.test.js`
Expected: PASS, 17 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lunar/doctrineLens.js src/terminal/lunar/__tests__/doctrineLens.test.js
git commit -m "feat(lunar): transit modulation + synthetic Sun-Moon fallback

Bonus is capped at 30 and decays linearly to zero at the 8 degree orb limit,
so it decides overlaps without ever overturning a lens on its center.

No null path: lunar age is the Sun-Moon elongation, so a missing ephemeris
still yields a real aspect (conjunct at new, opposite at full, square at the
quarters) rather than an absent reading."
```

---

### Task 4: Spine bonus and lens selection

**Files:**
- Modify: `src/terminal/lunar/doctrineLens.js`
- Modify: `src/terminal/lunar/__tests__/doctrineLens.test.js`

**Interfaces:**
- Consumes: `LENSES`, `PHASE_OWNER`, `phaseAffinity`, `transitBonus`
- Produces: `spineBonus(lens, spine, currentAccord, phaseId) → number`, `scoreLenses({age, phaseId, currentAccord, dominant, spine}) → Array<{id, kernel, affinity, transit, spine, total}>` sorted by `total` descending

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/lunar/__tests__/doctrineLens.test.js`:

```js
import { spineBonus, scoreLenses } from '../doctrineLens';

const FULL_SPINE = {
  trend: { label: 'x', velocity: 0.5 },
  council: { pair: ['a', 'b'] },
  phase: 'DARK INCUBATION',
  element: 'FIRE',
};

describe('spineBonus', () => {
  const hudel = LENSES.find(l => l.id === 'hudelschublade');
  const rossignol = LENSES.find(l => l.id === 'rossignol');

  it('is zero for an absent spine', () => {
    expect(spineBonus(hudel, null, 'DARK INCUBATION', 'new')).toBe(0);
  });

  it('pays 8 for a matching element', () => {
    expect(spineBonus(hudel, { element: 'FIRE' }, null, 'new')).toBe(8);
    expect(spineBonus(hudel, { element: 'WATER' }, null, 'new')).toBe(0);
  });

  it('pays 4 when a compiled phase agrees with the sky and this lens owns it', () => {
    // new moon is owned by hudelschublade
    expect(spineBonus(hudel, { phase: 'DARK INCUBATION' }, 'DARK INCUBATION', 'new')).toBe(4);
    // compiled a different phase than the sky is showing → nothing
    expect(spineBonus(hudel, { phase: 'MAXIMUM PROJECTION' }, 'DARK INCUBATION', 'new')).toBe(0);
    // right phase, but this lens does not own it
    expect(spineBonus(rossignol, { phase: 'DARK INCUBATION' }, 'DARK INCUBATION', 'new')).toBe(0);
  });

  it('pays the closed-ring bonus to rossignol alone', () => {
    expect(spineBonus(rossignol, FULL_SPINE, null, 'new')).toBe(6);
    // hudelschublade gets its element match from the same spine, never the ring
    expect(spineBonus(hudel, { ...FULL_SPINE, element: null }, null, 'new')).toBe(0);
  });

  it('caps at 15', () => {
    const maxed = spineBonus(rossignol, { ...FULL_SPINE, element: null, phase: 'SMOKE DISSOLUTION' },
      'SMOKE DISSOLUTION', 'waning-crescent');
    expect(maxed).toBeLessThanOrEqual(15);
  });
});

describe('scoreLenses', () => {
  const base = { age: 0.5, phaseId: 'new', currentAccord: 'DARK INCUBATION', dominant: null, spine: null };

  it('returns all five, sorted by total descending', () => {
    const s = scoreLenses(base);
    expect(s).toHaveLength(5);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].total).toBeGreaterThanOrEqual(s[i].total);
  });

  it('lets the moon alone select the lens', () => {
    expect(scoreLenses(base)[0].id).toBe('hudelschublade');
    expect(scoreLenses({ ...base, age: 16.5, phaseId: 'full', currentAccord: 'MAXIMUM PROJECTION' })[0].id)
      .toBe('semiotic');
    expect(scoreLenses({ ...base, age: 22.0, phaseId: 'last-quarter', currentAccord: 'MINERAL STILLNESS' })[0].id)
      .toBe('fishscale');
  });

  it('reaches every one of the five somewhere on the arc', () => {
    const seen = new Set();
    for (let age = 0; age < SYNODIC_PERIOD; age += 0.05) {
      seen.add(scoreLenses({ ...base, age })[0].id);
    }
    expect([...seen].sort()).toEqual(
      ['blackhole', 'fishscale', 'hudelschublade', 'rossignol', 'semiotic']
    );
  });

  it('lets a tight transit decide an overlap it could not decide on a center', () => {
    // midway between blackhole (9.5) and semiotic (16.5)
    const overlap = { ...base, age: 13.0, phaseId: 'waxing-gibbous', currentAccord: 'FLORAL AMPLIFICATION' };
    const neutral = scoreLenses(overlap)[0].id;
    const pushed  = scoreLenses({ ...overlap, dominant: { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 0 } })[0].id;
    expect(pushed).toBe('semiotic');
    expect(pushed).not.toBe(neutral);

    // the same tight aspect cannot move a lens sitting on its own center
    const onCenter = scoreLenses({ ...base, age: 22.0, phaseId: 'last-quarter',
      currentAccord: 'MINERAL STILLNESS',
      dominant: { p1: 'Mercury', p2: 'Mars', aspect: 'Square', orb: 0 } });
    expect(onCenter[0].id).toBe('fishscale');
  });

  it('is deterministic', () => {
    const a = scoreLenses({ ...base, spine: FULL_SPINE, dominant: { p1: 'Sun', p2: 'Moon', aspect: 'Conjunct', orb: 1 } });
    const b = scoreLenses({ ...base, spine: FULL_SPINE, dominant: { p1: 'Sun', p2: 'Moon', aspect: 'Conjunct', orb: 1 } });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lunar/__tests__/doctrineLens.test.js`
Expected: FAIL — `spineBonus is not a function`

- [ ] **Step 3: Write the implementation**

Append to `src/terminal/lunar/doctrineLens.js`:

```js
// Tertiary term (spec §5.3), ceiling 15. Reads the quintessence spine, so a
// visitor who has compiled vertebrae gets a reading tilted by their own choices.
export function spineBonus(lens, spine, currentAccord, phaseId) {
  if (!spine) return 0;
  let b = 0;
  if (lens.element && spine.element === lens.element) b += 8;
  if (spine.phase && spine.phase === currentAccord && PHASE_OWNER[phaseId] === lens.id) b += 4;
  const closed = !!(spine.trend && spine.council && spine.phase && spine.element);
  if (closed && lens.id === 'rossignol') b += 6;      // the ring rewards the ring
  return Math.min(b, 15);
}

// Full score for all five, highest first. Array.prototype.sort is stable, so
// an exact tie resolves to LENSES order — the documented tie-break.
export function scoreLenses({ age, phaseId, currentAccord, dominant, spine }) {
  return LENSES
    .map(lens => {
      const affinity = phaseAffinity(lens.center, age);
      const transit  = transitBonus(lens, dominant);
      const sp       = spineBonus(lens, spine, currentAccord, phaseId);
      return {
        id: lens.id, kernel: lens.kernel,
        affinity, transit, spine: sp,
        total: affinity + transit + sp,
      };
    })
    .sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lunar/__tests__/doctrineLens.test.js`
Expected: PASS, 28 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lunar/doctrineLens.js src/terminal/lunar/__tests__/doctrineLens.test.js
git commit -m "feat(lunar): spine bonus + full lens selection

Element match 8, sky-agreeing compiled phase 4, closed ring 6 to rossignol
alone, capped at 15. Selection is deterministic and stable-sorted, so an exact
tie resolves to wheel order.

Test pins the property that matters: every one of the five is reachable across
the arc, a tight transit decides overlaps, and it cannot move a lens that is
sitting on its own center."
```

---

### Task 5: Corpus shape, validator, and the HUDELSCHUBLADE lens

Establishes the corpus contract and fills the first of five. **Author review gate — all copy is first draft.**

**Files:**
- Create: `src/terminal/data/kernelHoroscope.js`
- Create: `src/terminal/data/__tests__/kernelHoroscope.test.js`

**Interfaces:**
- Consumes: `ARC_QUADRANTS` from `../lunar/synodic`
- Produces: `KERNEL_HOROSCOPE: Record<lensId, Entry>` where
  `Entry = { axis: string, quadrants: Record<Quadrant, {plato,promo,directive}>, paradox: Record<TensionClass,string>, coda: {complete: string, partial: string} }`,
  and `TENSION_CLASSES: string[]`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/data/__tests__/kernelHoroscope.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { KERNEL_HOROSCOPE, TENSION_CLASSES } from '../kernelHoroscope';
import { ARC_QUADRANTS } from '../../lunar/synodic';

// Grows as each lens lands. The final entry (Task 9) flips this to all five.
const AUTHORED = ['hudelschublade'];

const HEDGES = /\b(may|might|perhaps|possibly|consider|invites?|could)\b/i;

function assertEntryComplete(id) {
  const e = KERNEL_HOROSCOPE[id];
  expect(e, `${id} missing from corpus`).toBeTruthy();
  expect(e.axis.length).toBeGreaterThan(10);

  for (const q of ARC_QUADRANTS) {
    expect(e.quadrants[q], `${id}.${q}`).toBeTruthy();
    for (const slot of ['plato', 'promo', 'directive']) {
      expect(e.quadrants[q][slot].trim().length, `${id}.${q}.${slot}`).toBeGreaterThan(10);
    }
    // directives are imperatives: one sentence, no hedging
    expect(e.quadrants[q].directive, `${id}.${q}.directive hedges`).not.toMatch(HEDGES);
  }

  for (const t of TENSION_CLASSES) {
    expect(e.paradox[t].trim().length, `${id}.paradox.${t}`).toBeGreaterThan(10);
  }
  for (const c of ['complete', 'partial']) {
    expect(e.coda[c].trim().length, `${id}.coda.${c}`).toBeGreaterThan(10);
  }
}

describe('kernelHoroscope', () => {
  it('declares the four tension classes', () => {
    expect(TENSION_CLASSES).toEqual(['harmonic', 'fused', 'friction', 'polarity']);
  });

  it.each(AUTHORED)('%s has all 19 slots filled', assertEntryComplete);

  it('has no duplicate directives anywhere in the corpus', () => {
    const all = Object.values(KERNEL_HOROSCOPE)
      .flatMap(e => ARC_QUADRANTS.map(q => e.quadrants[q].directive));
    expect(new Set(all).size).toBe(all.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: FAIL — `Failed to resolve import "../kernelHoroscope"`

- [ ] **Step 3: Write the corpus module with the first lens**

Create `src/terminal/data/kernelHoroscope.js`:

```js
// src/terminal/data/kernelHoroscope.js — the doctrine register's corpus.
//
// The mythic twin of this tab's cited chemistry, in the register kernelDoctrines
// already established: "the alchemy to the theory's chemistry, astrology to its
// astronomy." Each lens speaks a Plato / Promo / Paradox triad and resolves to
// one imperative.
//
// Indexing: quadrant picks WHAT a kernel says, tension class picks HOW the
// paradox lands, coda reads the spine. 19 slots per lens.
//
// Directive contract: one sentence, imperative, one verb, one object. No
// hedging. No directive promises arrival, transformation or enlightenment —
// the cycle has no destination, only adaptation. Directives address conduct
// and seeing.
//
// Copy discipline: shape only. No events, persons, places or institutions.

export const TENSION_CLASSES = ['harmonic', 'fused', 'friction', 'polarity'];

export const KERNEL_HOROSCOPE = {
  // Entropy cipher. The drawer is unlocked; protection is search cost, not walls.
  hudelschublade: {
    axis: 'the drawer is unlocked · protection is search cost, not walls',
    quadrants: {
      'DARK-WAXING': {
        plato:  'The vault. Every wall you add is another index entry for the sweep.',
        promo:  'The drawer nobody opens, because nobody can parse what they already own.',
        directive: 'Stop hardening it and misfile it.',
      },
      'LIGHT-WAXING': {
        plato:  'A clean surface. Everything where it belongs, legible at a glance.',
        promo:  'Legible at a glance to you, and to everyone else at the same glance.',
        directive: 'Put the thing you value where you would never look for it.',
      },
      'LIGHT-WANING': {
        plato:  'The inventory. You could list what you have if anyone asked.',
        promo:  'The list is the theft. Whoever holds it has no further use for the drawer.',
        directive: 'Do not make the list.',
      },
      'DARK-WANING': {
        plato:  'Order restored. The mess finally sorted, the entropy spent.',
        promo:  'Sorted is searchable. You spent the only key you had.',
        directive: 'Leave the mess exactly as it stands.',
      },
    },
    paradox: {
      harmonic: 'Two systems agree and the agreement is the leak. Nothing hidden survives being easy to read.',
      fused:    'Cover and contents at zero-point. The mess and the valuables are one object now; separating them destroys both.',
      friction: 'Signal under structural pressure routes around the structure. Force applied to a drawer only proves something is in it.',
      polarity: 'Maximum legibility opposite maximum value. What you can fully explain, you can fully lose.',
    },
    coda: {
      complete: 'The ring is closed and the drawer is still the safest room in it.',
      partial:  'Vertebrae unmarked. Unmarked is not empty — it is unindexed.',
    },
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/kernelHoroscope.js src/terminal/data/__tests__/kernelHoroscope.test.js
git commit -m "feat(lunar): doctrine corpus contract + the hudelschublade lens

19 slots per lens: axis, four quadrants of plato/promo/directive, four tension
paradoxes, two spine codas. Validator pins slot completeness and rejects hedged
directives, so a half-authored lens cannot ship silently."
```

---

### Task 6: BLACK HOLE lens

**Author review gate — all copy is first draft.**

**Files:**
- Modify: `src/terminal/data/kernelHoroscope.js`
- Modify: `src/terminal/data/__tests__/kernelHoroscope.test.js`

**Interfaces:**
- Consumes: the `Entry` shape from Task 5
- Produces: `KERNEL_HOROSCOPE.blackhole`

- [ ] **Step 1: Extend the failing test**

In `src/terminal/data/__tests__/kernelHoroscope.test.js`, change the `AUTHORED` array:

```js
const AUTHORED = ['hudelschublade', 'blackhole'];
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: FAIL — `blackhole missing from corpus`

- [ ] **Step 3: Add the entry**

Add to `KERNEL_HOROSCOPE` in `src/terminal/data/kernelHoroscope.js`, after `hudelschublade`:

```js
  // Depth cipher. The horizon recedes at your exact speed; the exit is to stop
  // orbiting, not to arrive.
  blackhole: {
    axis: 'the horizon recedes at your exact speed · the exit is to stop orbiting',
    quadrants: {
      'DARK-WAXING': {
        plato:  'The ancestor. Whoever wrote the layer you are standing on, and wrote it better.',
        promo:  'Four words of changelog and no forwarding address.',
        directive: 'Read the source, not the author.',
      },
      'LIGHT-WAXING': {
        plato:  'Close now. Another year of this and you are the one being cited.',
        promo:  'The horizon recedes at exactly your speed. It has never once been nearer.',
        directive: 'Ship the thing at your current radius.',
      },
      'LIGHT-WANING': {
        plato:  'You arrived. The thing you chased is in your hands and it is yours.',
        promo:  'It is ordinary. It was always ordinary; distance was the only feature it had.',
        directive: 'Take the credit that was never withheld, only unclaimed.',
      },
      'DARK-WANING': {
        plato:  'One more orbit. The next pass is the one that catches it.',
        promo:  'Orbit is not approach. You have held this radius for years.',
        directive: 'Name what you can already do that you still call aspiration.',
      },
    },
    paradox: {
      harmonic: 'Two depths agree and the agreement dissolves the idol. What you admired turns out to be a technique, and techniques transfer.',
      fused:    'You and the ancestor at zero-point. Indistinguishable from outside, which is the only place the distinction ever lived.',
      friction: 'Drive against depth. Every increment of effort buys less distance; the asymptote is charging you for it.',
      polarity: 'Aspiration opposite arrival. Awareness only through the gap — and the gap is the whole apparatus.',
    },
    coda: {
      complete: 'The ring is closed. Nothing in it is above you.',
      partial:  'The spine is unfinished and it is still yours. Unfinished is not unqualified.',
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/kernelHoroscope.js src/terminal/data/__tests__/kernelHoroscope.test.js
git commit -m "feat(lunar): the black hole lens

Waxing gibbous is the asymptote — visible, nearly complete, never arrived.
Its directives refuse the chase rather than reward it."
```

---

### Task 7: SEMIOTIC 9.9.9 lens

**Author review gate — all copy is first draft.**

**Files:**
- Modify: `src/terminal/data/kernelHoroscope.js`
- Modify: `src/terminal/data/__tests__/kernelHoroscope.test.js`

**Interfaces:**
- Consumes: the `Entry` shape from Task 5
- Produces: `KERNEL_HOROSCOPE.semiotic`

- [ ] **Step 1: Extend the failing test**

```js
const AUTHORED = ['hudelschublade', 'blackhole', 'semiotic'];
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: FAIL — `semiotic missing from corpus`

- [ ] **Step 3: Add the entry**

Add to `KERNEL_HOROSCOPE`, after `blackhole`:

```js
  // Homophony cipher. The sound holds while the payload recompiles at each
  // border. Sits at the full moon: maximum projection, zero vision.
  semiotic: {
    axis: 'the sound holds while the payload recompiles · reach is not vision',
    quadrants: {
      'DARK-WAXING': {
        plato:  'Silence. Nothing sent, nothing to answer for.',
        promo:  'The refusal arrives anyway. It always arrives; the only variable is what you compile it into.',
        directive: 'Compile the refusal into something you own.',
      },
      'LIGHT-WAXING': {
        plato:  'The word means one thing. Say it and be understood.',
        promo:  'It crossed a border while you were saying it. Same sound, new payload, and the room heard the new one.',
        directive: 'Hold the form and let the payload change.',
      },
      'LIGHT-WANING': {
        plato:  'Untouchable. Maximum projection, the name carrying further than the body.',
        promo:  'You are lit from every side and can see nothing. Reach is not vision.',
        directive: 'Turn the lights off and count what you can still see.',
      },
      'DARK-WANING': {
        plato:  'The name persists. Whatever else goes, the name was built to outlast it.',
        promo:  'A name that outlasts the body is a monument, and monuments do not get to revise.',
        directive: 'Say the thing that would cost you the name.',
      },
    },
    paradox: {
      harmonic: 'Sound and meaning hop together and the border opens. A translation nobody had to be taught.',
      fused:    'Signal and self at zero-point. What you are called and what you are have stopped being separable — that is the cost, not the achievement.',
      friction: 'Payload under pressure at the checkpoint. The sound passes; the meaning is what gets searched.',
      polarity: 'Projection opposite perception. Everyone can find you and you cannot find the door.',
    },
    coda: {
      complete: 'Four crossings, all marked. The sound held through every one.',
      partial:  'The chain is short and the sound is intact. Short chains still cross borders.',
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/kernelHoroscope.js src/terminal/data/__tests__/kernelHoroscope.test.js
git commit -m "feat(lunar): the 9.9.9 lens

Seated at the full moon, where MAXIMUM PROJECTION means peak melatonin
suppression: seen from every side, able to see nothing."
```

---

### Task 8: FISH SCALE lens

**Author review gate — all copy is first draft.**

**Files:**
- Modify: `src/terminal/data/kernelHoroscope.js`
- Modify: `src/terminal/data/__tests__/kernelHoroscope.test.js`

**Interfaces:**
- Consumes: the `Entry` shape from Task 5
- Produces: `KERNEL_HOROSCOPE.fishscale`

- [ ] **Step 1: Extend the failing test**

```js
const AUTHORED = ['hudelschublade', 'blackhole', 'semiotic', 'fishscale'];
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: FAIL — `fishscale missing from corpus`

- [ ] **Step 3: Add the entry**

Add to `KERNEL_HOROSCOPE`, after `semiotic`:

```js
  // Counterfeit cipher. Purity is desiccation. Seated at last quarter, where
  // DRYNESS peaks at 96 — the monument reached, and refused.
  fishscale: {
    axis: 'purity is desiccation · the monument is reached every cycle and refused every cycle',
    quadrants: {
      'DARK-WAXING': {
        plato:  'Start clean this time. No cut, no compromise, nothing in it that should not be.',
        promo:  'Nothing in it that should not be is nothing in it. Clean does not run.',
        directive: 'Put something impure in it before it sets.',
      },
      'LIGHT-WAXING': {
        plato:  'Discipline. The intake narrows, the edges sharpen, the thing gets truer.',
        promo:  'Narrowing feels like precision from inside and reads as drying from outside.',
        directive: 'Stop narrowing.',
      },
      'LIGHT-WANING': {
        plato:  'Almost pure. What is left is what survived, and what survived is the real material.',
        promo:  'What survived is what was least alive. You have been selecting for the wrong property.',
        directive: 'Select for what moves, not for what lasts.',
      },
      'DARK-WANING': {
        plato:  'The monument. Perfectly preserved, nothing left to lose, nothing left to rot.',
        promo:  'Preserved is not alive. The cycle reaches this exact point every month and refuses to stay.',
        directive: 'Leave the monument standing and walk.',
      },
    },
    paradox: {
      harmonic: 'Purity and preservation agree, and the agreement is a still object. Agreement at this dryness is the failure mode.',
      fused:    'The cut and the product at zero-point. The contaminant is the texture that makes it saleable; you cannot remove it without removing the thing.',
      friction: 'Desiccation against circulation. The drier it gets the better it keeps and the less it moves.',
      polarity: 'Preservation opposite vitality. Maximum permanence, minimum pulse — and the cycle turns anyway.',
    },
    coda: {
      complete: 'The ring closed and did not calcify. That is the entire achievement.',
      partial:  'Unfinished and still wet. Keep it that way longer than feels responsible.',
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/kernelHoroscope.js src/terminal/data/__tests__/kernelHoroscope.test.js
git commit -m "feat(lunar): the fish scale lens

Seated at last quarter where DRYNESS peaks at 96 — the driest, lowest-sillage
accord in the set. Its DARK-WANING reading is the spine of the whole register:
the cycle completes the desiccation, reaches the monument, and refuses it."
```

---

### Task 9: ROSSIGNOL lens — corpus complete

**Author review gate — all copy is first draft.**

**Files:**
- Modify: `src/terminal/data/kernelHoroscope.js`
- Modify: `src/terminal/data/__tests__/kernelHoroscope.test.js`

**Interfaces:**
- Consumes: the `Entry` shape from Task 5
- Produces: `KERNEL_HOROSCOPE.rossignol`; corpus now covers every id in `LENSES`

- [ ] **Step 1: Extend the failing test**

Replace the `AUTHORED` constant, and add a test that pins the corpus to the lens table so the two can never drift apart:

```js
const AUTHORED = ['hudelschublade', 'blackhole', 'semiotic', 'fishscale', 'rossignol'];
```

Add this import at the top of the file:

```js
import { LENSES } from '../../lunar/doctrineLens';
```

And add this test inside the `describe('kernelHoroscope', ...)` block:

```js
  it('covers every lens in the wheel, and nothing else', () => {
    expect(Object.keys(KERNEL_HOROSCOPE).sort()).toEqual(LENSES.map(l => l.id).sort());
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: FAIL — `rossignol missing from corpus`

- [ ] **Step 3: Add the entry**

Add to `KERNEL_HOROSCOPE`, after `fishscale`:

```js
  // The only lens that is not a cipher: it publishes. Seated on the return to
  // new, where the ring closes.
  rossignol: {
    axis: 'one song, four tongues, identical response · purity is the label telling the truth',
    quadrants: {
      'DARK-WAXING': {
        plato:  'A new start, unencumbered, nothing carried over.',
        promo:  'You came back wearing a name you picked up somewhere else. The return is never to the same place.',
        directive: 'Come back before you are finished.',
      },
      'LIGHT-WAXING': {
        plato:  'Say it plainly and it will be understood as you meant it.',
        promo:  'It will be understood as they need it. That is not a failure of the saying — it is what saying is for.',
        directive: 'Let them hear it wrong and keep playing.',
      },
      'LIGHT-WANING': {
        plato:  'The formula is the value. Publish it and you are left with nothing.',
        promo:  'Published, it becomes an assay. A declared label is the only purity anyone can verify.',
        directive: 'Publish the assay.',
      },
      'DARK-WANING': {
        plato:  'One more circuit before you declare anything.',
        promo:  'The ring is already closed. You are circling something you have finished.',
        directive: 'Close it and say so out loud.',
      },
    },
    paradox: {
      harmonic: 'Two tongues agree without translation. The pulse crossed and nobody had to be taught it.',
      fused:    'Departure and return at zero-point. The bird is home and foreign in the same instant, and both are correct readings.',
      friction: 'Disclosure against advantage. Every declared gram costs you the edge and buys the only trust that compounds.',
      polarity: 'The song opposite the name. Four languages, one response — the response was never in the language.',
    },
    coda: {
      complete: 'Four marked, the ring shut. This is the reading the other four were arriving at.',
      partial:  'The ring is open at one point. An open ring is a route, not a defect.',
    },
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/data/__tests__/kernelHoroscope.test.js`
Expected: PASS, 8 tests — including `covers every lens in the wheel, and nothing else`

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/kernelHoroscope.js src/terminal/data/__tests__/kernelHoroscope.test.js
git commit -m "feat(lunar): the rossignol lens — corpus complete

The only lens that is not a cipher. Seated on the return to new, where the ring
closes. Corpus is now pinned to the lens table so the two cannot drift."
```

---

### Task 10: Compile the reading

Joins selection to corpus. This is the function the view consumes.

**Files:**
- Create: `src/terminal/lunar/compileLunarDoctrine.js`
- Create: `src/terminal/lunar/__tests__/compileLunarDoctrine.test.js`

**Interfaces:**
- Consumes: `scoreLenses`, `synthesizeLunarAspect` from `./doctrineLens`; `quadrantOf`, `tensionClassOf`, `SYNODIC_PERIOD` from `./synodic`; `KERNEL_HOROSCOPE` from `../data/kernelHoroscope`; `drynessFor` from `../data/lunarAccords`
- Produces: `compileLunarDoctrine({age, illumination, phaseId, currentAccord, transits, planets, spine}) → Reading` where
  `Reading = { lensId, kernel, axis, plato, promo, paradox, directive, coda, quadrant, tension, dominant, provenance: {age, illumination, dryness, phaseId, accord, element, spineComplete}, scores }`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lunar/__tests__/compileLunarDoctrine.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { compileLunarDoctrine } from '../compileLunarDoctrine';
import { SYNODIC_PERIOD } from '../synodic';

const NEW_MOON = {
  age: 0.4, illumination: 0.01, phaseId: 'new', currentAccord: 'DARK INCUBATION',
  transits: [], planets: {}, spine: null,
};

describe('compileLunarDoctrine', () => {
  it('returns a fully populated reading with no empty strings', () => {
    const r = compileLunarDoctrine(NEW_MOON);
    for (const k of ['lensId', 'kernel', 'axis', 'plato', 'promo', 'paradox', 'directive', 'coda']) {
      expect(typeof r[k], k).toBe('string');
      expect(r[k].trim().length, k).toBeGreaterThan(0);
    }
    expect(r.lensId).toBe('hudelschublade');
    expect(r.quadrant).toBe('DARK-WAXING');
  });

  it('is deterministic', () => {
    expect(compileLunarDoctrine(NEW_MOON)).toEqual(compileLunarDoctrine(NEW_MOON));
  });

  it('synthesises the Sun-Moon aspect when no transit is available', () => {
    const r = compileLunarDoctrine(NEW_MOON);
    expect(r.dominant.synthetic).toBe(true);
    expect(r.dominant.aspect).toBe('Conjunct');
    expect(r.tension).toBe('fused');
  });

  it('prefers the tightest real transit over the synthetic one', () => {
    const r = compileLunarDoctrine({
      ...NEW_MOON,
      transits: [{ p1: 'Mercury', p2: 'Saturn', aspect: 'Square', orb: 1.2 }],
    });
    expect(r.dominant.synthetic).toBeUndefined();
    expect(r.dominant.aspect).toBe('Square');
    expect(r.tension).toBe('friction');
  });

  it('carries dryness and phase into provenance', () => {
    const r = compileLunarDoctrine({ ...NEW_MOON, currentAccord: 'MINERAL STILLNESS' });
    expect(r.provenance.dryness).toBe(96);
    expect(r.provenance.accord).toBe('MINERAL STILLNESS');
    expect(r.provenance.illumination).toBe(0.01);
  });

  it('picks the complete coda only for a fully marked spine', () => {
    const partial = compileLunarDoctrine({ ...NEW_MOON, spine: { element: 'FIRE' } });
    const full = compileLunarDoctrine({
      ...NEW_MOON,
      spine: { trend: { label: 'x' }, council: { pair: ['a', 'b'] }, phase: 'DARK INCUBATION', element: 'FIRE' },
    });
    expect(partial.provenance.spineComplete).toBe(false);
    expect(full.provenance.spineComplete).toBe(true);
    expect(partial.coda).not.toBe(full.coda);
  });

  it('never yields an empty slot anywhere on the arc, under any tension, with or without a spine', () => {
    const spines = [null, { element: 'WATER' },
      { trend: { label: 'x' }, council: { pair: ['a', 'b'] }, phase: 'DARK INCUBATION', element: 'FIRE' }];
    const aspects = ['Conjunct', 'Sextile', 'Square', 'Trine', 'Opposite'];
    for (let age = 0; age < SYNODIC_PERIOD; age += 0.25) {
      for (const spine of spines) {
        for (const aspect of aspects) {
          const r = compileLunarDoctrine({
            ...NEW_MOON, age, spine,
            transits: [{ p1: 'Mercury', p2: 'Saturn', aspect, orb: 2 }],
          });
          for (const k of ['axis', 'plato', 'promo', 'paradox', 'directive', 'coda']) {
            expect(r[k], `age ${age.toFixed(2)} ${aspect} → ${k}`).toBeTruthy();
          }
        }
      }
    }
  });

  it('tolerates a malformed transit rather than denying a reading', () => {
    const r = compileLunarDoctrine({ ...NEW_MOON, transits: [{ p1: 'Nibiru', p2: 'Moon', aspect: 'Wobble', orb: 3 }] });
    expect(r.tension).toBe('fused');       // unknown aspect reads as zero tension
    expect(r.directive.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lunar/__tests__/compileLunarDoctrine.test.js`
Expected: FAIL — `Failed to resolve import "../compileLunarDoctrine"`

- [ ] **Step 3: Write the implementation**

Create `src/terminal/lunar/compileLunarDoctrine.js`:

```js
// src/terminal/lunar/compileLunarDoctrine.js — the doctrine register's engine
// (spec §5). Pure: no React, no DOM, no clock. Same inputs always compile the
// same reading, which is what lets the time-scrub recompile it live.
import { scoreLenses, synthesizeLunarAspect } from './doctrineLens';
import { quadrantOf, tensionClassOf } from './synodic';
import { KERNEL_HOROSCOPE } from '../data/kernelHoroscope';
import { drynessFor } from '../data/lunarAccords';

export function compileLunarDoctrine({
  age, illumination, phaseId, currentAccord, transits, planets, spine,
}) {
  // transits arrive orb-sorted from useTransits. Nothing within orb (or no
  // ephemeris at all) is not an absence: the moon supplies its own aspect.
  const dominant = (transits && transits.length)
    ? transits[0]
    : synthesizeLunarAspect(age);

  const scores = scoreLenses({ age, phaseId, currentAccord, dominant, spine });
  const winner = scores[0];
  const entry  = KERNEL_HOROSCOPE[winner.id];

  const quadrant = quadrantOf(age);
  const tension  = tensionClassOf(dominant.aspect);
  const q        = entry.quadrants[quadrant];

  const spineComplete = !!(spine?.trend && spine?.council && spine?.phase && spine?.element);

  return {
    lensId:    winner.id,
    kernel:    winner.kernel,
    axis:      entry.axis,
    plato:     q.plato,
    promo:     q.promo,
    paradox:   entry.paradox[tension],
    directive: q.directive,
    coda:      spineComplete ? entry.coda.complete : entry.coda.partial,
    quadrant,
    tension,
    dominant,
    provenance: {
      age,
      illumination,
      dryness: drynessFor(currentAccord),
      phaseId,
      accord: currentAccord,
      element: spine?.element ?? null,
      spineComplete,
    },
    scores,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lunar/__tests__/compileLunarDoctrine.test.js`
Expected: PASS, 8 tests. The sweep test alone covers 1785 compiled readings.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lunar/compileLunarDoctrine.js src/terminal/lunar/__tests__/compileLunarDoctrine.test.js
git commit -m "feat(lunar): compile the doctrine reading

Joins lens selection to the corpus. Pure and deterministic — no clock, no DOM.

The sweep test walks the whole arc against every tension class and three spine
states (1785 readings) asserting no slot is ever empty, and a malformed aspect
degrades to fused rather than denying a reading."
```

---

### Task 11: DoctrineRegister view

**Files:**
- Create: `src/terminal/lunar/DoctrineRegister.jsx`
- Create: `src/terminal/lunar/__tests__/DoctrineRegister.test.jsx`

**Interfaces:**
- Consumes: `compileLunarDoctrine` (Task 10); `snapshotPeriphery` from `../quintessence/periphery`
- Produces: default export `DoctrineRegister({ reading, planetData, aspectGlyph })` — a presentational component. `planetData` and `aspectGlyph` are passed in from `LunarTab` rather than imported, keeping presentation constants where they already live.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/lunar/__tests__/DoctrineRegister.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DoctrineRegister from '../DoctrineRegister';
import { compileLunarDoctrine } from '../compileLunarDoctrine';

const PLANET_DATA = {
  Sun:     { glyph: '☉', color: '#f59e0b' },
  Moon:    { glyph: '☽', color: '#e8e8f0' },
  Mercury: { glyph: '☿', color: '#c0c0c0' },
  Saturn:  { glyph: '♄', color: '#a8a29e' },
};
const ASPECT_GLYPH = { Conjunct: '⊕', Sextile: '⚹', Square: '□', Trine: '△', Opposite: '☍' };

function readingAt(over = {}) {
  return compileLunarDoctrine({
    age: 0.4, illumination: 0.01, phaseId: 'new', currentAccord: 'DARK INCUBATION',
    transits: [], planets: {}, spine: null, ...over,
  });
}

function renderAt(over) {
  return render(
    <DoctrineRegister reading={readingAt(over)} planetData={PLANET_DATA} aspectGlyph={ASPECT_GLYPH} />
  );
}

describe('DoctrineRegister', () => {
  it('renders the triad, the directive and the kernel name', () => {
    const r = readingAt();
    renderAt();
    expect(screen.getByText(/DOCTRINE REGISTER/i)).toBeTruthy();
    expect(screen.getByText(r.kernel)).toBeTruthy();
    expect(screen.getByText(r.plato)).toBeTruthy();
    expect(screen.getByText(r.promo)).toBeTruthy();
    expect(screen.getByText(r.paradox)).toBeTruthy();
    expect(screen.getByText(r.directive)).toBeTruthy();
    expect(screen.getByText(r.axis)).toBeTruthy();
  });

  it('shows provenance: illumination, day, dryness', () => {
    renderAt({ currentAccord: 'MINERAL STILLNESS' });
    expect(screen.getByText(/dryness 96/)).toBeTruthy();
    expect(screen.getByText(/day 0\.4/)).toBeTruthy();
  });

  it('names the aspect that selected the lens, with glyphs', () => {
    renderAt({ transits: [{ p1: 'Mercury', p2: 'Saturn', aspect: 'Square', orb: 1.2 }] });
    expect(screen.getByText(/☿/)).toBeTruthy();
    expect(screen.getByText(/♄/)).toBeTruthy();
    expect(screen.getByText(/orb 1\.2°/)).toBeTruthy();
  });

  it('marks a synthesised aspect so the reading never looks like it invented a transit', () => {
    renderAt();
    expect(screen.getByText(/elongation/i)).toBeTruthy();
  });

  it('shows the chaos cross-link only under the hudelschublade lens', () => {
    renderAt();                                                  // new moon → hudelschublade
    expect(screen.getByText(/house: chaos/i)).toBeTruthy();

    const { queryByText } = render(
      <DoctrineRegister
        reading={readingAt({ age: 22.0, phaseId: 'last-quarter', currentAccord: 'MINERAL STILLNESS' })}
        planetData={PLANET_DATA} aspectGlyph={ASPECT_GLYPH} />
    );
    expect(queryByText(/house: chaos/i)).toBeNull();
  });

  it('renders nothing rather than crashing when the reading is absent', () => {
    const { container } = render(
      <DoctrineRegister reading={null} planetData={PLANET_DATA} aspectGlyph={ASPECT_GLYPH} />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/lunar/__tests__/DoctrineRegister.test.jsx`
Expected: FAIL — `Failed to resolve import "../DoctrineRegister"`

- [ ] **Step 3: Write the implementation**

Create `src/terminal/lunar/DoctrineRegister.jsx`:

```jsx
// src/terminal/lunar/DoctrineRegister.jsx — the reading (spec §7).
// Presentational only: every value arrives already compiled. Recomputes for
// free when currentAge changes, so dragging the time-scrub recompiles the
// doctrine live.
import React from 'react';
import { snapshotPeriphery } from '../quintessence/periphery';

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-2 sm:gap-3 items-baseline">
      <div className="text-[7px] font-mono text-violet-500/45 uppercase tracking-[0.2em] pt-0.5">
        {label}
      </div>
      <div className="text-[9px] sm:text-[10px] font-mono text-zinc-400 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function DoctrineRegister({ reading, planetData, aspectGlyph }) {
  if (!reading) return null;

  const { dominant, provenance } = reading;
  const d1 = planetData?.[dominant.p1];
  const d2 = planetData?.[dominant.p2];

  // Only the entropy lens claims the chaos house; the cross-link would be a
  // non-sequitur under any other kernel.
  const chaos = reading.lensId === 'hudelschublade' ? snapshotPeriphery()?.art ?? null : null;
  const showChaos = reading.lensId === 'hudelschublade';

  return (
    <div className="mt-8 border border-violet-500/20 rounded-lg bg-violet-950/[0.07] overflow-hidden">
      {/* header — names itself as the register, so it does not read as a
          contradiction of the tab's cited-mechanics posture */}
      <div className="px-4 py-3 border-b border-violet-900/30">
        <div className="text-[10px] font-mono font-bold text-violet-400/80 uppercase tracking-widest">
          ◈ DOCTRINE REGISTER
        </div>
        <div className="text-[7px] font-mono text-violet-500/40 mt-0.5">
          // the alchemy to the chemistry above · astrology to its astronomy
        </div>
      </div>

      {/* lens */}
      <div className="px-4 py-3 border-b border-zinc-600/[0.04] bg-black/20">
        <div className="text-[7px] font-mono text-zinc-600 uppercase tracking-widest mb-1">LENS</div>
        <div className="text-[9px] sm:text-[10px] font-mono text-violet-300/80 tracking-wide break-words">
          {reading.kernel}
        </div>
        <div className="text-[8px] font-mono text-zinc-500/70 italic mt-1 leading-relaxed">
          {reading.axis}
        </div>
        <div className="text-[7px] font-mono text-zinc-600 mt-1.5 flex items-center gap-1 flex-wrap">
          <span>selected by</span>
          <span className="text-zinc-500">{provenance.phaseId.replace(/-/g, ' ')}</span>
          <span>×</span>
          <span style={{ color: d1?.color }}>{d1?.glyph ?? dominant.p1}</span>
          <span className="text-zinc-500">{aspectGlyph?.[dominant.aspect] ?? ''} {dominant.aspect}</span>
          <span style={{ color: d2?.color }}>{d2?.glyph ?? dominant.p2}</span>
          <span className="text-zinc-600">orb {dominant.orb}°</span>
          {dominant.synthetic && (
            <span className="text-zinc-700">· sun–moon elongation</span>
          )}
        </div>
      </div>

      {/* the triad */}
      <div className="px-4 py-4 space-y-2.5">
        <Row label="PLATO">{reading.plato}</Row>
        <Row label="PROMO">{reading.promo}</Row>
        <Row label="PARADOX">{reading.paradox}</Row>
      </div>

      {/* the imperative */}
      <div className="px-4 py-3 border-t border-violet-500/15 bg-violet-950/10">
        <div className="flex items-start gap-2.5">
          <span className="text-violet-400/70 text-[11px] leading-none pt-0.5">⟶</span>
          <p className="text-[11px] sm:text-[12px] font-mono text-violet-100/90 leading-relaxed tracking-wide">
            {reading.directive}
          </p>
        </div>
      </div>

      {/* spine coda */}
      <div className="px-4 py-2 border-t border-zinc-600/[0.04]">
        <p className="text-[8px] font-mono text-zinc-500/70 italic leading-relaxed">
          {reading.coda}
        </p>
      </div>

      {/* chaos cross-link — the entropy lens names the Feigenbaum house */}
      {showChaos && (
        <div className="px-4 py-2 border-t border-zinc-600/[0.04] text-[7px] font-mono tracking-wide flex items-center gap-1.5">
          <span className="text-violet-400/35">↗</span>
          <span className="text-violet-400/45">house: chaos</span>
          <span className="text-violet-300/65">
            {chaos ? 'witnessed — the drawer has been opened' : 'unindexed — never entered'}
          </span>
        </div>
      )}

      {/* provenance */}
      <div className="px-4 py-2 border-t border-zinc-600/[0.04] text-[6.5px] font-mono text-zinc-600 leading-relaxed">
        moon {(provenance.illumination * 100).toFixed(1)}% ·
        day {provenance.age.toFixed(1)} ·
        dryness {provenance.dryness} ·
        {provenance.accord}
        {provenance.element ? ` · spine ${provenance.element}` : ''}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/lunar/__tests__/DoctrineRegister.test.jsx`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lunar/DoctrineRegister.jsx src/terminal/lunar/__tests__/DoctrineRegister.test.jsx
git commit -m "feat(lunar): render the doctrine register

Presentational only — every value arrives compiled. Names itself as the
register in its own header so it does not read as a contradiction of the tab's
cited-mechanics posture, and marks a synthesised aspect explicitly so a reading
never looks like it invented a transit.

Wires the previously unplugged hudelschublade -> house_chaos cross-link."
```

---

### Task 12: Mount in LunarTab

**Files:**
- Modify: `src/terminal/views/LunarTab.jsx`

**Interfaces:**
- Consumes: `compileLunarDoctrine`, `DoctrineRegister`, and the tab's existing `PLANET_DATA` / `ASPECT_GLYPH` / `currentAge` / `illumination` / `currentPhase` / `selectedAccord` / `transits` / `planets`
- Produces: nothing — terminal task

- [ ] **Step 1: Add the imports**

In `src/terminal/views/LunarTab.jsx`, after the existing `synodic` import added in Task 1:

```js
import { compileLunarDoctrine } from '../lunar/compileLunarDoctrine';
import DoctrineRegister from '../lunar/DoctrineRegister';
```

- [ ] **Step 2: Compile the reading inside the component**

In `export default function LunarTab()`, immediately after the `selectedAccord` `useMemo` (around line 1129), add:

```js
  // Subscribe to spine writes so compiling a vertebra elsewhere re-reads here.
  // spineTick MUST be in the useMemo deps below: getSpine() is read inside the
  // memo, so without it a spine write re-renders and returns a stale doctrine.
  const [spineTick, forceSpineDoctrine] = useReducer(x => x + 1, 0);
  useEffect(() => subscribeSpine(forceSpineDoctrine), []);

  // Recompiles on every scrub tick — the doctrine is a function of the arc.
  const doctrine = useMemo(
    () => compileLunarDoctrine({
      age: currentAge,
      illumination,
      phaseId: currentPhase.id,
      currentAccord: LUNAR_ACCORDS.find(a => a.phase === currentPhase.id)?.accord
        ?? selectedAccord.accord,
      transits,
      planets,
      spine: getSpine(),
    }),
    [currentAge, illumination, currentPhase.id, selectedAccord.accord, transits, planets, spineTick]
  );
```

`useReducer`, `subscribeSpine` and `getSpine` are already imported by this file — do not add duplicate imports.

- [ ] **Step 3: Add the third header badge line**

In the header block, inside the `hidden sm:flex flex-col items-end` div (around line 1213), after the existing `⊘ NO ESOTERICISM · CITED` span, add:

```jsx
            <span className="text-violet-400/60 mt-0.5 flex items-center gap-1">
              <span>◈</span> DOCTRINE REGISTER · DECLARED
            </span>
```

And in the mobile badge row (around line 1226), after the existing `⊘ NO ESOTERICISM` span:

```jsx
          <span className="text-violet-400/60">◈ REGISTER</span>
```

- [ ] **Step 4: Mount the register**

Between the closing `</div>` of the "Selected Accord Detail" block and the `<TransitMatrix ... />` line (around line 1437), insert:

```jsx
      <DoctrineRegister
        reading={doctrine}
        planetData={PLANET_DATA}
        aspectGlyph={ASPECT_GLYPH}
      />
```

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — entire suite, no regressions.

- [ ] **Step 6: Verify in the browser**

Start the dev server via the preview tool (never Bash), open `/LUNAR`, and confirm:
- the register renders below the selected-accord block and above the transit matrix
- dragging the **time scrub** changes the lens as the arc crosses lens boundaries — this is the payoff, verify it explicitly by scrubbing from day 0 to day 29 and watching the kernel name change at least three times
- the chaos cross-link appears only at new / waxing crescent
- no console errors

Capture a screenshot at new moon and at last quarter.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/views/LunarTab.jsx
git commit -m "feat(lunar): mount the doctrine register

Compiles off currentAge, so dragging the existing time-scrub recompiles the
doctrine — a second life for a control that already shipped. Header gains a
third badge line declaring the register, so it reads as the tab's mythic twin
rather than as a contradiction of its cited mechanics."
```

---

## Self-review

**Spec coverage.** §5.1 → Task 2. §5.2 → Task 3. §5.3 → Task 4. §5.4 → Task 4. §6 → Tasks 5–9. §7 → Tasks 11–12 (badge line, cross-link, placement all covered). §10 register tests → distributed across every task. §8 out of scope by design. **One gap found and closed:** the spec did not say where the engine gets `SYNODIC_PERIOD` / `PHASES` / `ASPECT_TENSION` from — they were module-private. Task 1 now covers it and amends §9.

**Placeholder scan.** No TBDs, no "similar to Task N", no "handle edge cases". Every code step carries complete code. All 95 corpus strings are written out rather than described.

**Type consistency.** `Aspect` shape `{p1,p2,aspect,orb,synthetic?}` is identical in Tasks 3, 4, 10, 11 and matches what `useTransits` already produces at LunarTab.jsx:874. `scoreLenses` returns `{id, kernel, affinity, transit, spine, total}` in Task 4 and is consumed as `scores[0].id` / `.kernel` in Task 10. Corpus `Entry` shape defined in Task 5 is used unchanged in 6–9 and read in Task 10. `spineBonus(lens, spine, currentAccord, phaseId)` — four args, same order at definition and call site. `DoctrineRegister` prop names `reading` / `planetData` / `aspectGlyph` match between Tasks 11 and 12.
