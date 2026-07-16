# Altar Spine Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the altar's red `SPINE INCOMPLETE` line with a live three-row spine mirror that names what is marked, names the house that fills each gap, and walks there on click.

**Architecture:** A new pure `vertebrae.js` in `quintessence/` owns the vertebra→house→hue→field table (spine domain knowledge that currently lives in the eye's view module). `resolveEyeState.js` and a new presentational `SpineMirror.jsx` both consume it, so the eye's compass and the altar's mirror cannot drift. `QuintessenceAltar.jsx` composes the mirror in; its compile orchestration is untouched.

**Tech Stack:** React 19 (`act` from `react`, `createRoot`), Vitest 4, Tailwind utility classes, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-altar-spine-mirror-design.md` (approved 2026-07-16, commit `20b6e00`). Section references below point at it.

## Global Constraints

- **Do NOT push to origin.** Branch is `nightly/20260716-the-eye-observer`. Commit locally only. Leave the worktree clean.
- **This touches `src/` — it is production code**, unlike `mercury-skin.html`. Held to the real bar: tests green, prod build clean.
- **No progress counter, ever.** No `2 of 3`, no `1/3`, no "one vertebra short". Spec §2. A test enforces this.
- **No red.** `None` is `text-zinc-700`, `Some` is `text-amber-300`. Spec §2. A test enforces this.
- **Never explain what a vertebra IS.** Say *where* it is filled, never *what* a phase means. Spec §2.
- **No HUD-announcement copy** ("X ENGAGED", "SYSTEM ONLINE"). Lowercase, `·` separators, mono, low opacity except active states.
- **Hue is decoration only.** Every fact the colour carries must also be in the `aria-label`. Spec §3.
- Test runner: `npx vitest run <path>`. Full suite: `npm test`.

---

### Task 1: `vertebrae.js` — the shared table

**Files:**
- Create: `src/terminal/quintessence/vertebrae.js`
- Test: `src/terminal/quintessence/__tests__/vertebrae.test.js`

**Interfaces:**
- Consumes: `missingVertebrae`, `setTrend`, `setCouncil`, `setPhase`, `_resetSpineForTests` from `./spineStore` (test only); `NAV_TINTS` from `./guidanceStore` (test only).
- Produces: `VERTEBRAE` — an ordered array of `{ key, tab, tint, field, house, quoted?, preview }` where `key: 'trend'|'council'|'phase'`, `tab: string`, `tint: [r,g,b]`, `field: string`, `house: string`, `quoted?: boolean`, `preview: (spine) => string|null`. Also `PREVIEW_MAX: number` (28) and `truncate(s: string, max?: number) => string`. Consumed by Task 2 (`resolveEyeState.js`) and Task 3 (`SpineMirror.jsx`).

- [ ] **Step 1: Write the failing test**

Create `src/terminal/quintessence/__tests__/vertebrae.test.js`:

```js
// src/terminal/quintessence/__tests__/vertebrae.test.js — the spine's table (spec §4).
import { describe, it, expect, beforeEach } from 'vitest';
import { VERTEBRAE, truncate, PREVIEW_MAX } from '../vertebrae';
import { NAV_TINTS } from '../guidanceStore';
import { getSpine, missingVertebrae, setTrend, setCouncil, setPhase, _resetSpineForTests } from '../spineStore';

const EMPTY = { trend: null, council: null, phase: null, element: null };

describe('VERTEBRAE — the table', () => {
  beforeEach(() => { _resetSpineForTests(); });

  it('order matches spineStore.missingVertebrae() — the mirror, the compass and the eyebrow must name the same "next"', () => {
    const missing = missingVertebrae();
    expect(missing).toHaveLength(VERTEBRAE.length);
    VERTEBRAE.forEach((v, i) => {
      expect(missing[i]).toContain(v.key.toUpperCase());
    });
  });

  it('every tab is a real house in NAV_TINTS', () => {
    for (const v of VERTEBRAE) expect(NAV_TINTS[v.tab]).toBeDefined();
  });

  it('previews are null on an empty spine', () => {
    for (const v of VERTEBRAE) expect(v.preview(EMPTY)).toBeNull();
  });

  it('previews read a real spine off the store: label, pair joined with ×, accord', () => {
    setTrend({ label: 'gaza ceasefire', velocity: 0.4 });
    setCouncil({ pair: ['hunger', 'mercy'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 1 });
    setPhase('MINERAL STILLNESS');
    const spine = getSpine();   // the real shape, not a hand-built literal
    const by = k => VERTEBRAE.find(v => v.key === k);
    expect(by('trend').preview(spine)).toBe('gaza ceasefire');
    expect(by('council').preview(spine)).toBe('hunger × mercy');
    expect(by('phase').preview(spine)).toBe('MINERAL STILLNESS');
  });

  it('a council with no pair does not throw — it reads as absent', () => {
    const by = k => VERTEBRAE.find(v => v.key === k);
    expect(by('council').preview({ ...EMPTY, council: {} })).toBeNull();
  });

  it('only the trend is quoted — a label is a string literal, a pair is not', () => {
    const by = k => VERTEBRAE.find(v => v.key === k);
    expect(by('trend').quoted).toBe(true);
    expect(by('council').quoted).toBeFalsy();
    expect(by('phase').quoted).toBeFalsy();
  });
});

describe('truncate — the mirror is a row, not a paragraph', () => {
  it('leaves short strings alone', () => {
    expect(truncate('degrowth')).toBe('degrowth');
  });

  it('caps at PREVIEW_MAX with an ellipsis', () => {
    const long = 'a'.repeat(60);
    const out = truncate(long);
    expect(out).toHaveLength(PREVIEW_MAX);
    expect(out.endsWith('…')).toBe(true);
  });

  it('a string of exactly PREVIEW_MAX is untouched', () => {
    const exact = 'b'.repeat(PREVIEW_MAX);
    expect(truncate(exact)).toBe(exact);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/vertebrae.test.js`
Expected: FAIL — `Failed to resolve import "../vertebrae"`.

- [ ] **Step 3: Write minimal implementation**

Create `src/terminal/quintessence/vertebrae.js`:

```js
// src/terminal/quintessence/vertebrae.js — the spine's three deliberate vertebrae (spec §4).
// Pure data + pure functions, no React: same discipline as spineStore / guidanceStore.
// This is spine domain knowledge, not view state — the eye's compass and the
// altar's mirror both read it, and a second copy is how tints drift.
//
// ORDER IS LOAD-BEARING: it must match missingVertebrae() in spineStore.js, so
// the mirror, the compass and the reliquary eyebrow all name the same "next".

export const PREVIEW_MAX = 28;

export function truncate(s, max = PREVIEW_MAX) {
  const str = String(s);
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

export const VERTEBRAE = [
  {
    key: 'trend', tab: 'bsky', tint: [56, 189, 248],   // sky-400 — /BSKY
    field: 'narcos payload', house: 'the bsky house',
    quoted: true,                                       // a trend label is a string literal
    preview: s => s.trend?.label ?? null,
  },
  {
    key: 'council', tab: 'manifesto', tint: [167, 139, 250],  // violet-400 — /MANIFESTO
    field: 'friction pair', house: 'the manifesto house',
    preview: s => (s.council?.pair?.length ? s.council.pair.join(' × ') : null),
  },
  {
    // violet-400, NOT fuchsia (spec §4.1). /LUNAR is violet in the nav
    // (App.jsx:1151), in NAV_TINTS, and in its own tab body (LunarTab.jsx:987).
    // [217,70,239] is fuchsia-500 = NAV_TINTS.scaling — the eye leaned at the
    // wrong house for as long as no test pinned this value. Task 2 pins it.
    key: 'phase', tab: 'lunar', tint: [167, 139, 250],  // violet-400 — /LUNAR
    field: 'dryness', house: 'the lunar house',
    preview: s => s.phase ?? null,
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/quintessence/__tests__/vertebrae.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/vertebrae.js src/terminal/quintessence/__tests__/vertebrae.test.js
git commit -m "feat(quintessence): vertebrae.js — the spine table leaves the eye's view module

The vertebra->house->hue mapping is spine domain knowledge that has been
living in resolveEyeState.js, a view module owned by the eye. It had one
consumer, so its home did not matter. The altar's mirror is the second.

Order is load-bearing and now tested against missingVertebrae() directly."
```

---

### Task 2: `resolveEyeState` consumes the table — and lunar stops leaning fuchsia

**Files:**
- Modify: `src/terminal/components/resolveEyeState.js:4-8` (delete the local `VERTEBRAE` const, import instead)
- Modify: `src/terminal/components/__tests__/resolveEyeState.test.js` (add the tint pins)

**Interfaces:**
- Consumes: `VERTEBRAE` from `../quintessence/vertebrae` (Task 1); `NAV_TINTS` from `../../quintessence/guidanceStore` (test only).
- Produces: no signature change. `resolveEyeState({flaring, sealed, spine, suggestion, flash}) → {state, tint, gaze, pulse, pulseTab}` and `pulseTabFor({sealed, flaring, spine, suggestion}) → string|null` behave exactly as before, except the phase vertebra's tint is now `[167,139,250]` instead of `[217,70,239]`.

- [ ] **Step 1: Write the failing test**

Append to `src/terminal/components/__tests__/resolveEyeState.test.js`, after the existing `describe` block. Also add these two imports at the top of the file, below the existing `import { resolveEyeState, pulseTabFor } from '../resolveEyeState';`:

```js
import { VERTEBRAE } from '../../quintessence/vertebrae';
import { NAV_TINTS } from '../../quintessence/guidanceStore';
```

New block:

```js
describe('the tints the compass leans in (spec §4.1)', () => {
  it('pins every vertebra tint — the fuchsia survived precisely because nothing asserted this', () => {
    expect(VERTEBRAE.map(v => [v.tab, v.tint])).toEqual([
      ['bsky',      [56, 189, 248]],   // sky-400
      ['manifesto', [167, 139, 250]],  // violet-400
      ['lunar',     [167, 139, 250]],  // violet-400 — was [217,70,239], /SCALING's fuchsia
    ]);
  });

  it('no vertebra leans in /SCALING fuchsia — the exact mistake, named so it cannot recur', () => {
    for (const v of VERTEBRAE) {
      expect(v.tint).not.toEqual(NAV_TINTS.scaling);
    }
  });

  it('a spine missing only the phase leans violet at /LUNAR, not fuchsia', () => {
    const r = resolveEyeState({
      flaring: false, sealed: false, suggestion: null, flash: null,
      spine: { trend: { label: 'x' }, council: {}, phase: null, element: null },
    });
    expect(r.state).toBe('leaning');
    expect(r.tint).toEqual([167, 139, 250]);
    expect(r.pulseTab).toBe('lunar');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/terminal/components/__tests__/resolveEyeState.test.js`
Expected: FAIL on both new tint tests — received `[217, 70, 239]` for lunar, expected `[167, 139, 250]`. The pre-existing chain tests still PASS.

- [ ] **Step 3: Write minimal implementation**

Replace the head of `src/terminal/components/resolveEyeState.js` — delete the local `VERTEBRAE` const (lines 4–8) and import it. The file becomes:

```js
// src/terminal/components/resolveEyeState.js — the eye's priority chain (spec §2).
// Pure: no React, no WebGL — the whole chain is table-testable.
// Order: compiling > (mirror-flash overlay) > complete > armed > compass > ambient > resting.
// The vertebra table lives in quintessence/vertebrae.js — the altar's mirror
// reads it too, and one table is the only way the two surfaces agree.
import { VERTEBRAE } from '../quintessence/vertebrae';

const NAV_GAZE = [0.15, -0.04]; // drift toward the nav row

export function resolveEyeState({ flaring, sealed, spine, suggestion, flash }) {
  if (flaring) return { state: 'compiling', tint: null, gaze: null, pulse: false, pulseTab: null };

  const next = VERTEBRAE.find(v => !spine[v.key]);
  const marked = !!(spine.trend || spine.council || spine.phase);
  const pulseTab = sealed ? null
    : !next ? null                                  // armed: the altar is the pulse partner
    : marked ? next.tab                             // compass curriculum
    : suggestion ? suggestion.tab                   // element curriculum
    : null;

  if (flash) return { state: 'leaning', tint: flash.tint, gaze: null, pulse: false, pulseTab };
  if (sealed) return { state: 'complete', tint: null, gaze: null, pulse: false, pulseTab: null };
  if (!next)  return { state: 'armed', tint: null, gaze: null, pulse: true, pulseTab: null };
  if (marked) return { state: 'leaning', tint: next.tint, gaze: NAV_GAZE, pulse: true, pulseTab };
  if (suggestion) return { state: 'leaning', tint: suggestion.tint, gaze: NAV_GAZE, pulse: true, pulseTab };
  return { state: 'resting', tint: null, gaze: null, pulse: false, pulseTab: null };
}

export function pulseTabFor({ sealed, flaring, spine, suggestion }) {
  return resolveEyeState({ flaring, sealed, spine, suggestion, flash: null }).pulseTab;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/terminal/components/__tests__/resolveEyeState.test.js`
Expected: PASS — all pre-existing chain tests plus the 3 new ones.

- [ ] **Step 5: Verify nothing else consumed the old const**

Run: `npx vitest run src/terminal/components/`
Expected: PASS. `MercuryEyeIndicator.jsx` already imports `resolveEyeState` rather than owning a table; nothing should reference a local `VERTEBRAE`.

Run: `grep -rn "VERTEBRAE" src/terminal/components/`
Expected: only the `import { VERTEBRAE } from '../quintessence/vertebrae';` line in `resolveEyeState.js` and the test's import.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/components/resolveEyeState.js src/terminal/components/__tests__/resolveEyeState.test.js
git commit -m "fix(observer): lunar is violet — the eye was leaning in /SCALING's fuchsia

resolveEyeState leaned [217,70,239] at the phase vertebra, commented
'Lunar fuchsia'. /LUNAR is violet-400: in the nav, in NAV_TINTS, and in its
own tab body. [217,70,239] is fuchsia-500 — NAV_TINTS.scaling.

The pointer was always right (beat() pulses the correct tab); the hue
contradicted it, which is the one thing the guidance spec promised it
would never do: one vocabulary, three surfaces.

No test ever pinned the value. That is why it survived. Pinned now, plus a
guard that no vertebra may lean in scaling's fuchsia."
```

---

### Task 3: `SpineMirror` — and the red line dies

**Files:**
- Create: `src/terminal/mercury/SpineMirror.jsx`
- Modify: `src/terminal/mercury/QuintessenceAltar.jsx` (add import; replace the `stage === -1` block at lines 119–127)
- Test: `src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx` (rewrite 2 tests, add 7)

**Interfaces:**
- Consumes: `VERTEBRAE`, `truncate` from `../quintessence/vertebrae` (Task 1); `getSpine` from `../quintessence/spineStore` (already imported by the altar).
- Produces: `<SpineMirror spine={SpineObject} onNavigate={(tab: string) => void} />`, default export. Renders `<ul data-testid="spine-mirror">`. `spine` is the object returned by `getSpine()`.

**Note on precedent:** `SpineMirror` is presentational and is tested through the altar's harness, exactly as `ElementSeal` is. It gets no separate test file.

- [ ] **Step 1: Write the failing tests**

In `src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx`:

(a) Add this helper beside the existing `sealFor`:

```js
function mirrorRows() {
  return [...container.querySelectorAll('[data-testid="spine-mirror"] button')];
}
function mirrorRowFor(field) {
  return mirrorRows().find(b => b.textContent.includes(field));
}
```

(b) **Replace** the existing test `'empty spine: names the missing vertebrae, but the seals are NEVER disabled'` (lines 53–59) with:

```js
  it('empty spine: three None rows name their houses — and the seals are NEVER disabled', () => {
    const text = container.textContent;
    expect(text).not.toContain('SPINE INCOMPLETE');
    expect(mirrorRows()).toHaveLength(3);
    expect(text).toContain('narcos payload');
    expect(text).toContain('friction pair');
    expect(text).toContain('dryness');
    expect(text).toContain('→ the bsky house holds it');
    expect(text).toContain('→ the manifesto house holds it');
    expect(text).toContain('→ the lunar house holds it');
    const seals = sealButtons();
    expect(seals).toHaveLength(4);
    for (const b of seals) expect(b.disabled).toBe(false);
  });

  it('an unmarked vertebra is an invitation, not an error — nothing renders red', () => {
    expect(container.querySelector('[class*="red-"]')).toBeNull();
  });

  it('no progress counter — the shape is the count (spec §2)', () => {
    act(() => { setTrend({ label: 'degrowth', velocity: 0.9 }); });
    expect(container.textContent).not.toMatch(/\d\s*(of|\/)\s*\d/);
  });

  it('partial spine: Some carries the value and its provenance, the gaps name their house', () => {
    act(() => { setTrend({ label: 'gaza ceasefire', velocity: 0.4 }); });
    const text = container.textContent;
    expect(text).toContain('Some("gaza ceasefire")');
    expect(text).toContain('✦ marked at /BSKY');
    expect(text).toContain('→ the manifesto house holds it');
    expect(text).toContain('→ the lunar house holds it');
  });

  it('a council pair reads unquoted — a pair is not a string literal', () => {
    act(() => {
      setCouncil({ pair: ['hunger', 'mercy'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 0 });
    });
    expect(container.textContent).toContain('Some(hunger × mercy)');
  });

  it('clicking an unmarked row walks to the house that fills it', () => {
    act(() => { mirrorRowFor('dryness').click(); });
    expect(onNavigate).toHaveBeenCalledWith('lunar');
  });

  it('clicking a marked row walks back to re-mark it', () => {
    act(() => { setTrend({ label: 'degrowth', velocity: 0.9 }); });
    act(() => { mirrorRowFor('narcos payload').click(); });
    expect(onNavigate).toHaveBeenCalledWith('bsky');
  });

  it('a long trend label is truncated — the mirror is a row, not a paragraph', () => {
    act(() => { setTrend({ label: 'x'.repeat(60), velocity: 0.5 }); });
    expect(container.textContent).toContain('…');
    expect(container.textContent).not.toContain('x'.repeat(60));
  });

  it('every row carries an aria-label — the hue is decoration, the label is the fact', () => {
    const labels = mirrorRows().map(b => b.getAttribute('aria-label'));
    expect(labels).toHaveLength(3);
    for (const l of labels) expect(l).toBeTruthy();
    expect(labels.some(l => l.includes('unmarked') && l.includes('the lunar house'))).toBe(true);
  });
```

(c) **Replace** the existing test `'armed altar: the prompt names the gesture, and click STILL navigates'` (lines 79–85) with:

```js
  it('armed altar: the mirror STAYS lit (the payoff), the prompt names the gesture, click still navigates', () => {
    completeSpine();
    expect(container.textContent).toContain('ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL');
    expect(container.querySelector('[data-testid="spine-mirror"]')).not.toBeNull();
    expect(container.textContent).not.toContain('None');
    expect(mirrorRows()).toHaveLength(3);
    act(() => { sealFor('EARTH').click(); });
    expect(onNavigate).toHaveBeenCalledWith('ecocide');
  });

  it('compiling: the mirror yields the frame to the stages', () => {
    vi.useFakeTimers();
    completeSpine();
    const seal = sealFor('FIRE');
    act(() => { seal.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })); });
    act(() => { vi.advanceTimersByTime(1200); });
    expect(container.textContent).toContain('SPINE READ');
    expect(container.querySelector('[data-testid="spine-mirror"]')).toBeNull();
    vi.useRealTimers();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx`
Expected: FAIL — `mirrorRows()` returns `[]`, and `expect(text).not.toContain('SPINE INCOMPLETE')` fails because the red block is still rendered.

- [ ] **Step 3: Write `SpineMirror.jsx`**

Create `src/terminal/mercury/SpineMirror.jsx`:

```jsx
// src/terminal/mercury/SpineMirror.jsx — the altar's live spine (spec §3).
// Names what is marked and where the rest is found. There is deliberately no
// count: three rows where two read Some and one reads None already are the
// count, and a numeral would turn three deliberate acts into chores remaining.
// The field names stay genome-cryptic — the mystery lives there. The tail says
// where, never what.
import { VERTEBRAE, truncate } from '../quintessence/vertebrae';

export default function SpineMirror({ spine, onNavigate }) {
  return (
    <ul className="mt-3 mb-1 p-0 list-none space-y-1" data-testid="spine-mirror">
      {VERTEBRAE.map(v => {
        const raw = v.preview(spine);
        const marked = raw !== null && raw !== undefined;
        const shown = marked ? (v.quoted ? `"${truncate(raw)}"` : truncate(raw)) : null;
        // The label carries every fact the hue does — if the mirror stops
        // working in greyscale, the words are not doing their job (spec §3).
        const label = marked
          ? `${v.field} — ${raw} · marked at ${v.tab} · walk there`
          : `${v.field} — unmarked · walk to ${v.house}`;
        return (
          <li key={v.key}>
            <button
              type="button"
              aria-label={label}
              onClick={() => onNavigate?.(v.tab)}
              className="group w-full flex gap-3 items-baseline bg-transparent border-0 p-0 text-left font-mono text-[10px] cursor-pointer"
            >
              <span aria-hidden="true" className={marked ? 'text-amber-300' : 'text-zinc-700'}>
                {marked ? `Some(${shown})` : 'None'}
              </span>
              <span aria-hidden="true" className="text-zinc-600">{`// ${v.field}`}</span>
              {marked ? (
                <span aria-hidden="true" className="ml-auto whitespace-nowrap text-zinc-700">
                  {`✦ marked at /${v.tab.toUpperCase()}`}
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="ml-auto whitespace-nowrap opacity-70 transition-opacity group-hover:opacity-100"
                  style={{ color: `rgb(${v.tint[0]},${v.tint[1]},${v.tint[2]})` }}
                >
                  {`→ ${v.house} holds it`}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Wire it into the altar**

In `src/terminal/mercury/QuintessenceAltar.jsx`, add the import beside the existing `ElementSeal` import:

```js
import SpineMirror from './SpineMirror';
```

Then **replace** this block (lines 119–127):

```jsx
      {stage === -1 && (missing.length > 0 ? (
        <div className="text-[10px] font-mono tracking-[0.2em] text-red-400/70 uppercase">
          SPINE INCOMPLETE · {missing.join(' · ')}
        </div>
      ) : (
        <div role="status" className="text-[10px] font-mono tracking-[0.2em] text-amber-300/90 uppercase">
          [ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL]
        </div>
      ))}
```

with:

```jsx
      {/* The mirror stays lit when armed: filling up and THEN arming is the payoff. */}
      {stage === -1 && <SpineMirror spine={getSpine()} onNavigate={onNavigate} />}

      {armed && (
        <div role="status" className="mt-3 text-[10px] font-mono tracking-[0.2em] text-amber-300/90 uppercase">
          [ALTAR ARMED · HOLD AN ELEMENT TO SEAL THE KERNEL]
        </div>
      )}
```

`missing` stays — `armed` is still derived from it on line 45. `getSpine()` is already imported on line 5, and the component already re-renders on spine changes via `subscribeSpine(force)` on line 33, so the mirror is always live.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx`
Expected: PASS — all tests, including the 5 pre-existing hold/keyboard/wet-dry ones which must be untouched.

- [ ] **Step 6: Run the full suite and build**

Run: `npm test`
Expected: PASS, no regressions. **Baseline measured on this branch at `c9714e3`, 2026-07-16: 51 files, 462 tests passing.** This plan adds 9 (Task 1) + 3 (Task 2) + 9 (Task 3) and rewrites 2, so expect **483 passing** at the end. A lower number means something was silently dropped.

Run: `npm run build`
Expected: clean, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/mercury/SpineMirror.jsx src/terminal/mercury/QuintessenceAltar.jsx src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx
git commit -m "feat(altar): the spine mirror — the altar speaks the state it already owned

SPINE INCOMPLETE named an absence in the register of an error and said
nothing about the deliberate acts already performed or where the rest is
found. Every fact it withheld was already in the app.

Three rows. Some carries your value and where you marked it; None names the
house that fills it and walks you there. No counter: the shape is the count.
No red: an unmarked vertebra is an invitation. The mirror stays lit when the
spine completes, because filling up and then arming is the payoff."
```

---

### Task 4: Look at it

Green tests are not evidence that a visual feature is right — per `feedback-look-before-diagnosing`, the render is the only thing that settles this, and this plan's own author has already been caught this week by a measurement that read healthy while the screen was wrong.

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server**

Use the preview tool with `{name: "scale94-dev"}` (`.claude/launch.json`, port 5174). Navigate to `http://localhost:5174`.

- [ ] **Step 2: Walk the three states via the DEV hatch**

In the browser console, on the Mercury tab, scrolled to the altar:

```js
// empty — three None rows, three house invitations, no red anywhere
window.__quintessenceSpine.getSpine();

// partial — Some + provenance, two invitations left
window.__quintessenceSpine.setTrend({ label: 'gaza ceasefire', velocity: 0.4 });

// armed — three Some rows, mirror still lit, armed line beneath it
window.__quintessenceSpine.setCouncil({ pair: ['hunger', 'mercy'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 1 });
window.__quintessenceSpine.setPhase('MINERAL STILLNESS');
```

- [ ] **Step 3: Screenshot each of the three states**

Confirm by eye, not by metric:
- the two violet rows (manifesto, lunar) read as violet — **not** fuchsia
- `None` reads patient, not broken; nothing is red
- the invitation tails sit right-aligned and do not collide with anything (the failure mode that bit the mercury mock's panel handle was exactly a "measurements said clear, screen said overlapping")
- the mirror does not push the element grid off-screen at a narrow window

- [ ] **Step 4: Click a `None` row in the real page**

Confirm it navigates to `/LUNAR` and that the eye's compass leans **violet** on the way, matching the tab.

- [ ] **Step 5: The greyscale test (spec §3)**

In the console:

```js
document.documentElement.style.filter = 'grayscale(1)';
```

The mirror must remain fully legible: which vertebrae are marked, and which house fills each gap. If it does not, the words are not carrying their weight and §2's "two violets are acceptable" is falsified — report that rather than papering over it.

```js
document.documentElement.style.filter = '';
```

- [ ] **Step 6: Report**

Post the three screenshots. State plainly whether the greyscale test passed. If anything failed, say so with the image — do not claim done on green tests alone.

---

## Notes for the implementer

- **Do not touch `ReliquaryView.jsx`.** It already works; sharing its three trivial preview expressions buys coupling, not safety. Spec §6.
- **Do not touch the element seal row.** Verified working — dry seals are grey mineral stillness, wet are a living nebula. Spec §1.
- **Do not touch `missingVertebrae()`.** The altar still derives `armed` from it, and the reliquary eyebrow still renders its strings. Spec §6.
- **Do not unify the palette.** Three tables describe tab hue and disagree on *shade* (violet-400 vs violet-500). This plan corrects one wrong **colour** and nothing else. Spec §6.
- **Do not push.** Leave the tree clean.
