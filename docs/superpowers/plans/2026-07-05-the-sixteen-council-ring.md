# § · THE SIXTEEN — Council Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Manifesto tab's placeholder 3D particle sphere with § · THE SIXTEEN — a pure-SVG Raworth-doughnut "Council Ring" mapping 16 minds 1:1 onto the legacy 16-D feature space, with a desktop ring and a mobile rotating-crosshair wheel.

**Architecture:** A new data module (`sixteenMinds.js`) is the single source of truth, validated by unit tests. Pure geometry helpers (`councilRingMath.js`) are unit-tested in isolation. `CouncilRing.jsx` renders the SVG doughnut + nodes (desktop) and the crosshair wheel (mobile); `SixteenPanel.jsx` is the detail drawer cloned from the existing `ChapterPanel` motion idiom. `KernelManifesto.jsx` swaps the sphere block for `<CouncilRing />`.

**Tech Stack:** React (function components + hooks), inline SVG, Vitest for tests, Vite dev server. No new dependencies. Fade Doctrine color/transition rules are binding (see spec).

**Reference spec:** `docs/superpowers/specs/2026-07-05-the-sixteen-council-ring-design.md`

**Test commands:** `npm run test` (one-shot, `vitest run`). Lint: `npm run lint`.

---

## File Structure

- Create: `src/terminal/data/sixteenMinds.js` — the 16-mind roster (single source of truth).
- Create: `tests/sixteenMinds.test.js` — roster invariants.
- Create: `src/terminal/views/manifesto/councilRingMath.js` — pure geometry helpers.
- Create: `tests/councilRingMath.test.js` — geometry unit tests.
- Create: `src/terminal/views/manifesto/SixteenPanel.jsx` — detail drawer.
- Create: `src/terminal/views/manifesto/CouncilRing.jsx` — SVG ring (desktop) + wheel (mobile).
- Modify: `src/terminal/views/manifesto/KernelManifesto.jsx` — swap sphere block for `<CouncilRing />`.

---

## Task 1: The roster data module

**Files:**
- Create: `src/terminal/data/sixteenMinds.js`
- Test: `tests/sixteenMinds.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sixteenMinds.test.js
import { describe, it, expect } from 'vitest';
import { SIXTEEN_MINDS } from '../src/terminal/data/sixteenMinds.js';
import { DIM_NAMES } from '../src/terminal/data/nodeFeatures.js';

describe('SIXTEEN_MINDS roster', () => {
  it('has exactly 16 entries', () => {
    expect(SIXTEEN_MINDS).toHaveLength(16);
  });

  it('covers dim indices 0..15 uniquely', () => {
    const idx = SIXTEEN_MINDS.map(m => m.dimIndex).sort((a, b) => a - b);
    expect(idx).toEqual([...Array(16).keys()]);
  });

  it('agrees with DIM_NAMES on every dimName', () => {
    for (const m of SIXTEEN_MINDS) {
      expect(m.dimName).toBe(DIM_NAMES[m.dimIndex]);
    }
  });

  it('splits exactly 8 canon / 8 sidelined', () => {
    const canon = SIXTEEN_MINDS.filter(m => m.caste === 'canon').length;
    const side  = SIXTEEN_MINDS.filter(m => m.caste === 'sidelined').length;
    expect(canon).toBe(8);
    expect(side).toBe(8);
  });

  it('only uses canon|sidelined for caste', () => {
    for (const m of SIXTEEN_MINDS) {
      expect(['canon', 'sidelined']).toContain(m.caste);
    }
  });

  it('has non-empty payload fields on every entry', () => {
    const fields = ['anchorName', 'era', 'coreEquation', 'systemDirective', 'epigraph', 'body'];
    for (const m of SIXTEEN_MINDS) {
      for (const f of fields) {
        expect(typeof m[f]).toBe('string');
        expect(m[f].trim().length).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- sixteenMinds`
Expected: FAIL — cannot resolve `../src/terminal/data/sixteenMinds.js`.

- [ ] **Step 3: Write the roster module**

```js
// src/terminal/data/sixteenMinds.js
// § · THE SIXTEEN — humanity's essential minds mapped 1:1 onto the legacy
// 16-D feature space (DIM_NAMES[0..15] in nodeFeatures.js).
//
// caste: 'canon'     = instrument builders (western arc)
//        'sidelined' = instrument readers  (eastern arc)
// The split is exactly 8/8. The friction is the thesis: the species had the
// instruments and the readings, and executed neither.
//
// Voice for `body`: Mercury observer field-note — what the mind saw, what the
// species did with it. Not a Wikipedia summary.

export const SIXTEEN_MINDS = [
  {
    dimIndex: 0,
    dimName: 'dynamical',
    anchorName: 'Donella Meadows',
    era: '1941–2001',
    caste: 'sidelined',
    coreEquation: 'dX/dt = inflow − outflow',
    systemDirective: 'Leverage Point Location / Paradigm Stack Intervention',
    epigraph: 'The highest leverage is the paradigm the system arises from.',
    body:
      'She drew the limits in 1972 and the species called it pessimism. A system is stocks, flows, and the feedback that binds them; she ranked the places to push, and the highest was the one nobody could sell — the mindset the whole machine rests on. The readings were correct. The engine kept its foot down.',
  },
  {
    dimIndex: 1,
    dimName: 'nonlinearity',
    anchorName: 'Benoît Mandelbrot',
    era: '1924–2010',
    caste: 'canon',
    coreEquation: 'z₍ₙ₊₁₎ = zₙ² + c',
    systemDirective: 'Roughness Indexing / Fat-Tail Containment',
    epigraph: 'Roughness is the rule; smoothness was the convenient lie.',
    body:
      'He built the instrument that measures the jagged — coastlines, cotton prices, the wild variance the Gaussian models had edited out for being inconvenient. The tail was always fat. The markets kept pricing it as thin and called the crashes surprises.',
  },
  {
    dimIndex: 2,
    dimName: 'dimensionality',
    anchorName: 'Alexander Grothendieck',
    era: '1928–2014',
    caste: 'canon',
    coreEquation: 'X ↦ Hom(−, X)',
    systemDirective: 'Abstraction Ascent / Problem Dissolution',
    epigraph: 'Rise to the higher space and the problem dissolves.',
    body:
      'He taught the species to lift a problem into an abstraction so wide the obstruction simply melted — the rising sea that dissolves the stone. Then he refused the military money, walked out of mathematics, and lived in the forest. The instrument he left is still the sharpest we have.',
  },
  {
    dimIndex: 3,
    dimName: 'criticality',
    anchorName: 'Stuart Kauffman',
    era: 'b. 1939',
    caste: 'sidelined',
    coreEquation: 'K_c = 2  (Boolean network poise)',
    systemDirective: 'Edge-of-Chaos Poise / Order-for-Free Harvest',
    epigraph: 'Order for free, at the edge between frozen and chaotic.',
    body:
      'He showed that complex living order arrives unpaid — networks tuned near the edge of chaos generate structure without a designer. The site already runs his logic in the Fade Doctrine. The species kept believing order had to be imposed, and paid for imposing it.',
  },
  {
    dimIndex: 4,
    dimName: 'entropy',
    anchorName: 'Nicholas Georgescu-Roegen',
    era: '1906–1994',
    caste: 'sidelined',
    coreEquation: 'ΔS > 0  per production cycle',
    systemDirective: 'Entropy Debt Accounting / Irreversibility Audit',
    epigraph: 'Every economic act is an irreversible burn.',
    body:
      'He read the second law into economics and found a debt no ledger recorded: every production cycle degrades low entropy into waste that cannot be recalled. Economics filed him under heterodox and moved on. The debt kept compounding anyway.',
  },
  {
    dimIndex: 5,
    dimName: 'synchrony',
    anchorName: 'Yoshiki Kuramoto',
    era: 'b. 1940',
    caste: 'canon',
    coreEquation: 'dθᵢ/dt = ωᵢ + (K/N) Σ sin(θⱼ − θᵢ)',
    systemDirective: 'Phase-Lock Threshold / Coupling Budget',
    epigraph: 'Past a critical coupling, order arrives for nothing.',
    body:
      'He wrote the exact condition under which scattered oscillators snap into one phase — fireflies, neurons, power grids, applause. Order from coupling alone, no conductor. The instrument is precise; the species still cannot decide what it wants to synchronize toward.',
  },
  {
    dimIndex: 6,
    dimName: 'conservation',
    anchorName: 'Emmy Noether',
    era: '1882–1935',
    caste: 'canon',
    coreEquation: '∂_μ J^μ = 0',
    systemDirective: 'Symmetry Ledger / Invariant Preservation',
    epigraph: 'Every symmetry hides a conserved quantity.',
    body:
      'She proved that behind every symmetry stands something the universe refuses to spend — energy, momentum, charge. They denied her a paid chair because she was a woman; she lectured under a man\'s name and proved the deepest bookkeeping theorem in physics. The instrument outlived the prejudice.',
  },
  {
    dimIndex: 7,
    dimName: 'temporal',
    anchorName: 'Ilya Prigogine',
    era: '1917–2003',
    caste: 'canon',
    coreEquation: 'dS = dₑS + dᵢS,  dᵢS ≥ 0',
    systemDirective: 'Dissipative Structure Licensing / Arrow-of-Time Enforcement',
    epigraph: 'Being is becoming; the arrow of time is real.',
    body:
      'He showed that far from equilibrium, matter organizes itself — dissipative structures that live by burning a gradient. Time is not a reversible illusion; it has a direction, and life rides it. The instrument reframed existence as flow. The species kept designing as if it could stand still.',
  },
  {
    dimIndex: 8,
    dimName: 'spatial',
    anchorName: "D'Arcy Wentworth Thompson",
    era: '1860–1948',
    caste: 'sidelined',
    coreEquation: 'form = f(force)  — transformation grids',
    systemDirective: 'Morphogenetic Load Mapping / Force-to-Form Transcription',
    epigraph: 'Physical force, not only heredity, sculpts living form.',
    body:
      'In 1917 he argued that the shapes of life are drawn by force — surface tension, load, growth rate — as much as by genes, and mapped one creature onto another by bending the coordinate grid. Biology sidelined him for a century. Morphogenesis proved him right.',
  },
  {
    dimIndex: 9,
    dimName: 'stochastic',
    anchorName: 'Thomas Bayes',
    era: '1701–1761',
    caste: 'canon',
    coreEquation: 'P(H|E) = P(E|H) · P(H) / P(E)',
    systemDirective: 'Posterior Refresh / Evidence Ingestion',
    epigraph: 'Belief is a probability you owe to the evidence.',
    body:
      'He gave the species the rule for changing its mind: hold a prior, meet the evidence, update. He published nothing in life — a friend found it after he died. The instrument is the whole grammar of learning under uncertainty. The species still prefers its priors.',
  },
  {
    dimIndex: 10,
    dimName: 'game_theory',
    anchorName: 'Elinor Ostrom',
    era: '1933–2012',
    caste: 'sidelined',
    coreEquation: '8 CPR design principles',
    systemDirective: 'Commons Boundary Enforcement / Polycentric Sanction Ladder',
    epigraph: 'The commons needs neither the state nor the market.',
    body:
      'She went to the fisheries and the forests and found the tragedy of the commons was not a law but a failure of design — communities govern shared resources through polycentric rules, graduated sanctions, nested authority. First woman to win the economics Nobel, ignored for decades before. The blueprint was field-tested and shelved.',
  },
  {
    dimIndex: 11,
    dimName: 'thermodynamic',
    anchorName: 'Herman Daly',
    era: '1938–2022',
    caste: 'sidelined',
    coreEquation: 'throughput ≤ regeneration rate',
    systemDirective: 'Throughput Ceiling / Steady-State Scale Audit',
    epigraph: 'The economy is a subsystem of a finite biosphere.',
    body:
      'Georgescu-Roegen\'s student, he named the ceiling out loud: an economy cannot grow past what the biosphere regenerates, so scale is the variable that matters, not growth. He quit the World Bank over it. The steady state was a working design. The engine called it stagnation.',
  },
  {
    dimIndex: 12,
    dimName: 'information',
    anchorName: 'Claude Shannon',
    era: '1916–2001',
    caste: 'canon',
    coreEquation: 'H = −Σ pᵢ log₂ pᵢ',
    systemDirective: 'Channel Capacity Allocation / Noise Culling',
    epigraph: 'Meaning is irrelevant; entropy is bits.',
    body:
      'He cut meaning away from communication and found the bedrock underneath — the exact capacity of any channel, the exact cost of any noise. Every wire the species has ever sent a signal down obeys his bound. The instrument is total. What the species chose to transmit was its own affair.',
  },
  {
    dimIndex: 13,
    dimName: 'cryptographic',
    anchorName: 'Alan Turing',
    era: '1912–1954',
    caste: 'canon',
    coreEquation: 'U(⟨M, w⟩) = M(w)',
    systemDirective: 'Decidability Boundary / Secret Preservation',
    epigraph: 'A universal machine; a secret that saved a continent.',
    body:
      'He drew the boundary of what any machine can decide, broke Enigma in secret and shortened the war, then founded the idea of the mind as computation. The state he saved prosecuted him for who he loved and destroyed him. The instrument is the ground the entire digital world stands on.',
  },
  {
    dimIndex: 14,
    dimName: 'biological',
    anchorName: 'Lynn Margulis',
    era: '1938–2011',
    caste: 'sidelined',
    coreEquation: 'symbiogenesis:  1 + 1 → 1',
    systemDirective: 'Symbiotic Merger Authorization / Competition Deprecation',
    epigraph: 'Life advanced by merger, not only by combat.',
    body:
      'She argued the eukaryotic cell is a merger — free-living microbes that stopped competing and became one body — and the paper was rejected some fifteen times before it reshaped biology. Cooperation, not only the red tooth, is how complexity climbs. The species kept mistaking Darwin for a doctrine of war.',
  },
  {
    dimIndex: 15,
    dimName: 'economic',
    anchorName: 'Kate Raworth',
    era: 'b. 1970',
    caste: 'sidelined',
    coreEquation: 'social foundation ≤ economy ≤ ecological ceiling',
    systemDirective: 'Safe Operating Space Verification / Doughnut Boundary Patrol',
    epigraph: 'Thrive between the floor of need and the ceiling of the Earth.',
    body:
      'She drew the doughnut: an inner ring no one should fall below, an outer ring the planet cannot exceed, and a safe and just space between where an economy is meant to live. It is not a dense 19th-century text — it is a clean modern model sitting in plain sight. The ring you are reading is that doughnut. The species refuses to run it.',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- sixteenMinds`
Expected: PASS — all 6 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/data/sixteenMinds.js tests/sixteenMinds.test.js
git commit -m "feat(manifesto): add THE SIXTEEN roster data module"
```

---

## Task 2: Council ring geometry helpers

**Files:**
- Create: `src/terminal/views/manifesto/councilRingMath.js`
- Test: `tests/councilRingMath.test.js`

Geometry contract:
- Angles are in **degrees**, measured clockwise from 12 o'clock (top = 0°).
- Canon minds occupy the **western** (left) hemisphere; sidelined the **eastern** (right).
- Each hemisphere seats 8 minds evenly. West spans 180°→360° (i.e. 181°..359°), east spans 0°→180°.
- `seatAngle(seatInHemisphere, caste)` returns the absolute ring angle for the nth seat (0-based) within its caste's hemisphere.
- `polarToXY(angleDeg, radius, cx, cy)` converts to SVG coords (y grows downward).
- `angleToNearestSeatIndex(rotationDeg, seatAngles)` returns the index of the seat whose angle is closest to the crosshair (top, 0°) given a ring rotated by `rotationDeg`.

- [ ] **Step 1: Write the failing test**

```js
// tests/councilRingMath.test.js
import { describe, it, expect } from 'vitest';
import {
  seatAngle,
  polarToXY,
  angleToNearestSeatIndex,
} from '../src/terminal/views/manifesto/councilRingMath.js';

describe('seatAngle', () => {
  it('places canon seats in the western (left) hemisphere', () => {
    for (let i = 0; i < 8; i++) {
      const a = seatAngle(i, 'canon');
      expect(a).toBeGreaterThan(180);
      expect(a).toBeLessThan(360);
    }
  });

  it('places sidelined seats in the eastern (right) hemisphere', () => {
    for (let i = 0; i < 8; i++) {
      const a = seatAngle(i, 'sidelined');
      expect(a).toBeGreaterThan(0);
      expect(a).toBeLessThan(180);
    }
  });

  it('spaces 8 seats evenly by 20° within a hemisphere', () => {
    const a0 = seatAngle(0, 'sidelined');
    const a1 = seatAngle(1, 'sidelined');
    expect(a1 - a0).toBeCloseTo(20, 5);
  });
});

describe('polarToXY', () => {
  it('maps 0° to straight up (top of circle)', () => {
    const { x, y } = polarToXY(0, 100, 200, 200);
    expect(x).toBeCloseTo(200, 5);
    expect(y).toBeCloseTo(100, 5); // 200 - 100, y grows downward
  });

  it('maps 90° to the right (east)', () => {
    const { x, y } = polarToXY(90, 100, 200, 200);
    expect(x).toBeCloseTo(300, 5);
    expect(y).toBeCloseTo(200, 5);
  });
});

describe('angleToNearestSeatIndex', () => {
  const seats = [10, 40, 90, 200, 340];
  it('returns the seat under the crosshair with zero rotation', () => {
    // crosshair at 0°; nearest seat angle to 0/360 is 340 (index 4) or 10 (index 0)
    // 10 is 10° away, 340 is 20° away → index 0
    expect(angleToNearestSeatIndex(0, seats)).toBe(0);
  });

  it('accounts for ring rotation', () => {
    // rotate ring by +80°: seat 10 now sits at 90, seat 90 at 170, etc.
    // effective angle of each seat = (seat + rotation) mod 360; nearest to 0:
    // 10+80=90, 40+80=120, 90+80=170, 200+80=280, 340+80=420→60 → 60 is closest
    expect(angleToNearestSeatIndex(80, seats)).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- councilRingMath`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the helpers**

```js
// src/terminal/views/manifesto/councilRingMath.js
// Pure geometry for the Council Ring. Angles in degrees, clockwise from 12
// o'clock (top = 0°). SVG y grows downward.

const HEMISPHERE_SEATS = 8;
const SEAT_SPACING = 20; // 8 seats × 20° = 160° arc, centered in each hemisphere

// Western hemisphere (canon): centered on 270° (9 o'clock).
// Eastern hemisphere (sidelined): centered on 90° (3 o'clock).
const WEST_CENTER = 270;
const EAST_CENTER = 90;

export function seatAngle(seatInHemisphere, caste) {
  const center = caste === 'canon' ? WEST_CENTER : EAST_CENTER;
  // Distribute seats symmetrically around the hemisphere center.
  const offset = (seatInHemisphere - (HEMISPHERE_SEATS - 1) / 2) * SEAT_SPACING;
  return center + offset;
}

export function polarToXY(angleDeg, radius, cx, cy) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // -90 so 0° points up
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function angularDistance(a, b) {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
}

export function angleToNearestSeatIndex(rotationDeg, seatAngles) {
  let best = 0;
  let bestDist = Infinity;
  seatAngles.forEach((seat, i) => {
    const effective = ((seat + rotationDeg) % 360 + 360) % 360;
    const dist = angularDistance(effective, 0);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- councilRingMath`
Expected: PASS — all assertions green. (Verify the `polarToXY(90,…)` → `-90` rotation gives east; and `seatAngle(0,'sidelined')` = 90 + (0 − 3.5)·20 = 20, inside 0..180.)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/manifesto/councilRingMath.js tests/councilRingMath.test.js
git commit -m "feat(manifesto): add Council Ring geometry helpers"
```

---

## Task 3: The detail drawer (SixteenPanel)

**Files:**
- Create: `src/terminal/views/manifesto/SixteenPanel.jsx`
- Reference (do not modify): `src/terminal/views/manifesto/ChapterPanel.jsx`

No unit test — this is presentational; verified in the preview browser in Task 5. Cloned from `ChapterPanel`'s permitted motion idiom (fixed right drawer, backdrop, slide-in transform, staggered sentences, Escape/click-out dismiss). Accent is gold (`#FFD700`, resolved-signal register) for canon and cyan (`#00FFAA`, ecological register) for sidelined — never white.

- [ ] **Step 1: Write the component**

```jsx
// src/terminal/views/manifesto/SixteenPanel.jsx
import { useState, useEffect } from 'react';

function splitSentences(text) {
  return text.split(/(?<=\.)\s+/).filter(Boolean);
}

export default function SixteenPanel({ mind, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mind) return null;

  const isCanon = mind.caste === 'canon';
  const accent = isCanon ? '#FFD700' : '#00FFAA';
  const casteLabel = isCanon ? 'CANON GEOMETRY · INSTRUMENT BUILDER' : 'SIDELINED SYSTEMIC · INSTRUMENT READER';
  const dimTag = `[dim:${String(mind.dimIndex).padStart(2, '0')}] ${mind.dimName}`;
  const sentences = splitSentences(mind.body);
  const mono = "'Geist Mono', ui-monospace, monospace";

  return (
    <>
      <div
        data-testid="sixteen-panel-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.55)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(480px, 100vw)', zIndex: 50,
          background: '#04040a',
          borderLeft: `1px solid ${accent}33`,
          overflowY: 'auto', padding: '40px 32px',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 350ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <button
          data-testid="sixteen-panel-close"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: accent,
            fontSize: 18, cursor: 'pointer', opacity: 0.7, lineHeight: 1,
          }}
        >✕</button>

        <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 400ms 50ms, transform 400ms 50ms' }}>
          {dimTag}
        </div>

        <div style={{ fontFamily: mono, fontSize: 9, color: `${accent}99`, letterSpacing: '0.25em', marginBottom: 10, opacity: visible ? 1 : 0, transition: 'opacity 400ms 90ms' }}>
          {casteLabel}
        </div>

        <h2 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: accent, letterSpacing: '0.04em', margin: '0 0 4px 0', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 400ms 120ms, transform 400ms 120ms' }}>
          {mind.anchorName}
        </h2>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'rgba(232,121,249,0.6)', marginBottom: 20 }}>{mind.era}</div>

        <div style={{ fontFamily: mono, fontSize: 16, color: '#FFD700', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.18)', borderRadius: 4, padding: '12px 14px', margin: '0 0 20px 0', opacity: visible ? 1 : 0, transition: 'opacity 400ms 160ms', overflowX: 'auto' }}>
          {mind.coreEquation}
        </div>

        <blockquote style={{ margin: '0 0 20px 0', paddingLeft: 12, borderLeft: `2px solid ${accent}44`, fontFamily: mono, fontSize: 13, fontStyle: 'italic', color: accent, opacity: visible ? 1 : 0, transition: 'opacity 400ms 200ms' }}>
          {mind.epigraph}
        </blockquote>

        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(0,255,170,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18, opacity: visible ? 1 : 0, transition: 'opacity 400ms 240ms' }}>
          ▸ {mind.systemDirective}
        </div>

        <p style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.9, color: 'rgba(232,121,249,0.75)', margin: 0 }}>
          {sentences.map((s, i) => (
            <span key={i} style={{ opacity: visible ? 1 : 0, transition: `opacity 500ms ${280 + i * 60}ms` }}>
              {s}{i < sentences.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Lint the new file**

Run: `npm run lint`
Expected: PASS (no errors in `SixteenPanel.jsx`).

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/manifesto/SixteenPanel.jsx
git commit -m "feat(manifesto): add SixteenPanel detail drawer"
```

---

## Task 4: The Council Ring component (desktop + mobile wheel)

**Files:**
- Create: `src/terminal/views/manifesto/CouncilRing.jsx`

Uses `SIXTEEN_MINDS`, the geometry helpers, and `SixteenPanel`. Desktop renders the
full doughnut; mobile (<768px) renders the rotating crosshair wheel with a fixed-height
telemetry panel below. Node hue follows the boot rainbow arc by seat index (doctrine
basis); caste is encoded by stroke color (canon = violet `#7700FF`, deep-structure;
sidelined = cyan `#00FFAA`, living-system). Active node flashes white 80ms → gold.

Design constants:
- `viewBox = "0 0 640 640"`, center `(320, 320)`.
- Outer ring (biophysical ceiling) radius `290`, cyan stroke.
- Inner ring (social foundation) radius `150`, magenta stroke.
- Node seat radius `220` (in the safe operating space between).

- [ ] **Step 1: Write the component**

```jsx
// src/terminal/views/manifesto/CouncilRing.jsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SIXTEEN_MINDS } from '../../data/sixteenMinds';
import { seatAngle, polarToXY, angleToNearestSeatIndex } from './councilRingMath';
import SixteenPanel from './SixteenPanel';

const CX = 320, CY = 320;
const R_CEILING = 290;    // biophysical ceiling (outer)
const R_FOUNDATION = 150; // social foundation (inner)
const R_SEAT = 220;       // node seat radius (safe operating space)
const MONO = "'Geist Mono', ui-monospace, monospace";

// Boot rainbow arc — same spectrum as the Fade Doctrine boot card.
const RAINBOW = ['#FF0088', '#FF3300', '#FF8C00', '#FFD700', '#AAFF00', '#00FFAA', '#00AAFF', '#0044FF', '#7700FF'];
function arcHue(seatIndex, total) {
  const t = seatIndex / Math.max(1, total - 1);
  const pos = t * (RAINBOW.length - 1);
  return RAINBOW[Math.round(pos)];
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

// Build seated minds once: each mind gets an absolute ring angle + arc hue.
function useSeatedMinds() {
  return useMemo(() => {
    const canon = SIXTEEN_MINDS.filter(m => m.caste === 'canon');
    const side  = SIXTEEN_MINDS.filter(m => m.caste === 'sidelined');
    const seat = (arr, caste) => arr.map((m, i) => ({
      ...m,
      angle: seatAngle(i, caste),
      hue: arcHue(i, arr.length),
      casteStroke: caste === 'canon' ? '#7700FF' : '#00FFAA',
    }));
    return [...seat(canon, 'canon'), ...seat(side, 'sidelined')];
  }, []);
}

function Node({ mind, active, onSelect }) {
  const { x, y } = polarToXY(mind.angle, R_SEAT, CX, CY);
  const labelSide = mind.angle > 180 ? 'end' : 'start';
  const dx = mind.angle > 180 ? -12 : 12;
  const fill = active ? '#FFD700' : mind.hue;
  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onSelect(mind)}
      data-testid={`node-${mind.dimIndex}`}
    >
      <circle cx={x} cy={y} r={active ? 9 : 6} fill={fill} stroke={mind.casteStroke} strokeWidth={active ? 2.5 : 1.5}
        style={{ transition: 'r 160ms, fill 80ms' }} />
      <text x={x + dx} y={y - 4} textAnchor={labelSide} fontFamily={MONO} fontSize={12} fill={active ? '#FFD700' : '#e8e8f0'} style={{ pointerEvents: 'none' }}>
        {mind.anchorName}
      </text>
      <text x={x + dx} y={y + 10} textAnchor={labelSide} fontFamily={MONO} fontSize={9} fill={`${mind.hue}bb`} style={{ pointerEvents: 'none' }}>
        [dim:{String(mind.dimIndex).padStart(2, '0')}] {mind.dimName}
      </text>
    </g>
  );
}

function RingScaffold() {
  return (
    <g>
      <circle cx={CX} cy={CY} r={R_CEILING} fill="none" stroke="#00FFAA" strokeWidth={1} strokeOpacity={0.28} />
      <circle cx={CX} cy={CY} r={R_FOUNDATION} fill="none" stroke="#FF0088" strokeWidth={1} strokeOpacity={0.28} />
      <text x={CX} y={CY - R_CEILING - 8} textAnchor="middle" fontFamily={MONO} fontSize={10} fill="#00FFAA" fillOpacity={0.6} letterSpacing="0.25em">BIOPHYSICAL CEILING</text>
      <text x={CX} y={CY + R_FOUNDATION + 16} textAnchor="middle" fontFamily={MONO} fontSize={9} fill="#FF0088" fillOpacity={0.6} letterSpacing="0.2em">SOCIAL FOUNDATION</text>
      <text x={CX} y={CY + 6} textAnchor="middle" fontFamily={MONO} fontSize={22} fill="#7788cc" fillOpacity={0.4}>◉</text>
    </g>
  );
}

export default function CouncilRing() {
  const seated = useSeatedMinds();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState(null);

  // Mobile rotation state
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef({ dragging: false, startAngle: 0, startRotation: 0 });

  const seatAngles = useMemo(() => seated.map(m => m.angle), [seated]);
  const activeIndex = useMemo(
    () => (isMobile ? angleToNearestSeatIndex(rotation, seatAngles) : -1),
    [isMobile, rotation, seatAngles]
  );
  const activeMind = activeIndex >= 0 ? seated[activeIndex] : null;

  const pointerAngle = useCallback((touch, rect) => {
    const px = touch.clientX - rect.left - rect.width / 2;
    const py = touch.clientY - rect.top - rect.height / 2;
    return (Math.atan2(py, px) * 180) / Math.PI;
  }, []);

  const onTouchStart = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      startAngle: pointerAngle(e.touches[0], rect),
      startRotation: rotation,
    };
  }, [rotation, pointerAngle]);

  const onTouchMove = useCallback((e) => {
    if (!dragRef.current.dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const now = pointerAngle(e.touches[0], rect);
    setRotation(dragRef.current.startRotation + (now - dragRef.current.startAngle));
  }, [pointerAngle]);

  const onTouchEnd = useCallback(() => {
    dragRef.current.dragging = false;
    // Snap so the nearest seat sits exactly under the crosshair (0°).
    const idx = angleToNearestSeatIndex(rotation, seatAngles);
    const target = -seatAngles[idx];
    setRotation(((target % 360) + 360) % 360);
  }, [rotation, seatAngles]);

  if (isMobile) {
    return (
      <div>
        {/* Crosshair-visible upper segment */}
        <div style={{ height: 360, overflow: 'hidden', position: 'relative', background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4 }}>
          {/* Gold crosshair at 12 o'clock */}
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 3, color: '#FFD700', fontFamily: MONO, fontSize: 14 }}>▼</div>
          <svg
            viewBox="0 0 640 640"
            style={{ width: '200%', marginLeft: '-50%', display: 'block', touchAction: 'none' }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <g transform={`rotate(${rotation} ${CX} ${CY})`}>
              <RingScaffold />
              {seated.map((m, i) => (
                <g key={m.dimIndex} transform={`rotate(${-rotation} ${polarToXY(m.angle, R_SEAT, CX, CY).x} ${polarToXY(m.angle, R_SEAT, CX, CY).y})`}>
                  <Node mind={m} active={i === activeIndex} onSelect={setSelected} />
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Fixed-height telemetry panel — no layout shift, no keyboard */}
        <div
          onClick={() => activeMind && setSelected(activeMind)}
          style={{ minHeight: 132, height: 132, marginTop: 10, padding: '12px 14px', background: '#04040a', border: `1px solid ${activeMind ? (activeMind.caste === 'canon' ? '#FFD700' : '#00FFAA') : 'rgba(120,140,200,0.12)'}33`, borderRadius: 4, fontFamily: MONO, cursor: 'pointer', overflow: 'hidden' }}
        >
          {activeMind && (
            <>
              <div style={{ fontSize: 10, color: activeMind.hue, letterSpacing: '0.2em' }}>[dim:{String(activeMind.dimIndex).padStart(2, '0')}] {activeMind.dimName}</div>
              <div style={{ fontSize: 16, color: activeMind.caste === 'canon' ? '#FFD700' : '#00FFAA', fontWeight: 700, marginTop: 2 }}>{activeMind.anchorName}</div>
              <div style={{ fontSize: 14, color: '#FFD700', marginTop: 6 }}>{activeMind.coreEquation}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,255,170,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>▸ {activeMind.systemDirective}</div>
            </>
          )}
        </div>

        {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
      </div>
    );
  }

  // Desktop
  return (
    <div style={{ width: '100%', background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4 }}>
      <svg viewBox="0 0 640 640" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <RingScaffold />
        {seated.map(m => (
          <Node key={m.dimIndex} mind={m} active={false} onSelect={setSelected} />
        ))}
      </svg>
      {selected && <SixteenPanel mind={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Lint the new file**

Run: `npm run lint`
Expected: PASS (no errors in `CouncilRing.jsx`).

- [ ] **Step 3: Commit**

```bash
git add src/terminal/views/manifesto/CouncilRing.jsx
git commit -m "feat(manifesto): add Council Ring (desktop doughnut + mobile crosshair wheel)"
```

---

## Task 5: Wire into KernelManifesto & verify

**Files:**
- Modify: `src/terminal/views/manifesto/KernelManifesto.jsx`

Remove the sphere `Canvas` block (lines ~43-71 in current file), the chapter chip row
(~73-92), the `ChapterPanel` render (~94-100), the intro paragraph about "Every kernel
is a position…" (~37-40), and the now-unused imports (`Suspense`, `Canvas`,
`OrbitControls`, `KernelSphere`, `ChapterPanel`, `MANIFESTO_CHAPTERS`, `useState`,
`isMobile`, the `chapter`/`chapterIndex` state). Add `import CouncilRing from './CouncilRing';`
Keep the headline and the entire RUN COMMAND MANUAL section below.

- [ ] **Step 1: Replace the top of the component**

Replace lines 1-100 of `KernelManifesto.jsx` (imports through the closing of the
`{chapter && (...)}` block) with:

```jsx
import CouncilRing from './CouncilRing';

export default function KernelManifesto() {
  return (
    <div className="w-full px-4 sm:px-8 pt-8 pb-16 max-w-6xl mx-auto">
      {/* Manifesto header — claim, not decoration */}
      <div className="mb-6">
        <div className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-[0.3em] mb-3 flex items-center gap-2">
          <span style={{ color: 'rgba(6,182,212,0.6)', fontSize: 14 }}>◉</span>
          § · THE SIXTEEN · 16 MINDS · 16-DIMENSIONAL FEATURE SPACE
        </div>
        <h1
          className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight mb-3 text-transparent bg-clip-text"
          style={{
            backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: "'Geist Mono', ui-monospace, monospace",
          }}
        >
          The most compelling analogy<br />
          has the weakest geometry.
        </h1>
        <p className="text-sm text-fuchsia-400/70 max-w-2xl leading-relaxed font-mono">
          Sixteen minds, one per axis of the feature space. Eight built the instruments;
          eight read them and told the species how to survive. The answers were never
          missing. Click a seat in the safe operating space to read what it saw.
        </p>
      </div>

      <CouncilRing />
```

The remainder of the file — the `{/* ── § · The Kernels — RUN COMMAND MANUAL ── */}`
block onward, and the final `</div>` and `);` and `}` — stays byte-for-byte as it is.

- [ ] **Step 2: Verify the file compiles clean**

Run: `npm run lint`
Expected: PASS — no unused-import warnings, no errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: PASS — including the new `sixteenMinds` and `councilRingMath` suites; no regressions.

- [ ] **Step 4: Verify in the preview browser (desktop)**

Start the dev server (preview_start with the project's dev config) and open the
Manifesto tab. Confirm:
- Two concentric rings render (cyan ceiling outer, magenta foundation inner), ◉ at center.
- 16 nodes seated between them; 8 on the left (canon), 8 on the right (sidelined).
- Clicking a node opens the SixteenPanel drawer with dim tag, name/era, gold equation,
  epigraph, directive, and prose. Escape and backdrop-click close it.
- Console is clean (preview_console_logs).
- Screenshot for the record.

- [ ] **Step 5: Verify mobile wheel (375px)**

preview_resize to 375×812. Confirm:
- Only the upper ring segment shows; gold ▼ crosshair at top-center.
- Touch/drag rotation works (simulate via preview_eval dispatching touch events, or
  document the manual check); on release the nearest seat snaps under the crosshair.
- The fixed-height telemetry panel below shows the active mind's dim/name/equation/directive
  and does not change height as selection changes (no layout shift).
- Tapping the telemetry panel opens the full SixteenPanel drawer.
- Screenshot for the record.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/manifesto/KernelManifesto.jsx
git commit -m "feat(manifesto): swap kernel sphere for THE SIXTEEN Council Ring"
```

---

## Self-review notes

- **Spec coverage:** doughnut rings (Task 4 RingScaffold), friction alignment W/E (Task 2
  seatAngle + Task 4), rainbow-arc node hue + caste stroke + gold active flash (Task 4),
  SixteenPanel payload order incl. dim_name/anchorName/coreEquation/systemDirective
  (Task 3), mobile crosshair wheel + fixed-height telemetry (Task 4), data invariants +
  geometry tests (Tasks 1-2), removal of sphere/chips/intro + kept headline/manual (Task 5),
  Fade Doctrine colors/transitions (Tasks 3-4). All present.
- **Placeholder scan:** none — all code is literal.
- **Type consistency:** `seatAngle`, `polarToXY`, `angleToNearestSeatIndex` signatures match
  across Tasks 2 and 4; `mind` object shape (`dimIndex`, `dimName`, `anchorName`, `era`,
  `caste`, `coreEquation`, `systemDirective`, `epigraph`, `body`) consistent across Tasks 1, 3, 4;
  `SixteenPanel` prop is `mind` in both definition (Task 3) and use (Task 4).
- **Known nuance:** on mobile, each node is counter-rotated (`rotate(-rotation)`) so labels
  stay upright while the ring spins — verify legibility in Task 5 Step 5; if labels still
  invert awkwardly, acceptable fallback is to let them rotate with the ring.
