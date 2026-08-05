# Art Sphere Groundwork (Spec Steps 0–1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `/art` sphere's audio engine without losing the visual it secretly drives, and lift its three canvas text draws into a DOM overlay — leaving the piece ready for the WebGL canvas without any GL work yet.

**Architecture:** Both steps are Canvas2D-only groundwork. Intricate per-frame logic is extracted into pure modules under `src/terminal/art/` (the established pattern alongside `artParticles.js`, `artMath.js`, `artAwakening.js`, `artGraph.js`) where it can be unit tested; `ArtTab.jsx` keeps orchestration only. No WebGL, no react-three-fiber, no new dependencies.

**Tech Stack:** React 19, Vite, Vitest + jsdom, @testing-library/react. Existing project conventions only.

**Spec:** `docs/superpowers/specs/2026-08-04-art-sphere-webgl-design.md` (steps 0 and 1 of §5).

## Global Constraints

- **Test runner:** `npx vitest run <path>` for one file, `npm test` for the suite. Tests live in `__tests__/` beside the module and match `src/**/__tests__/**/*.test.{js,jsx}`.
- **Lint must pass:** `npm run lint` runs with `--max-warnings 0`. Unused imports are errors.
- **`ArtTab.jsx` cannot be mounted in jsdom.** It pulls ~25 imports including ten custom hooks, WASM-backed fields, IndexedDB and websockets, and jsdom has no 2-D canvas context (no `canvas` package is installed). Do not write tests that render `<ArtTab />`. Test extracted pure modules only; visual verification is by browser screenshot.
- **Projected coordinates are CSS pixels.** `dimsRef.current = { w, h }` comes from `contentRect` and the loop applies `ctx.setTransform(dpr,0,0,dpr,0,0)` at `ArtTab.jsx:790`. DOM overlays consume `p.sx` / `p.sy` directly with no DPR conversion.
- **No visual change is permitted in either step** beyond removed audio controls (step 0) and crisper text (step 1).
- **Do not touch** hit-testing, pointer handlers, the simulation hooks, or the projection code. See spec §4.

## File Structure

| File | Responsibility |
|---|---|
| `src/terminal/art/artBeatClock.js` | **Create.** Visual-only beat clock. Replaces the audio engine's beat timer. |
| `src/terminal/art/__tests__/artBeatClock.test.js` | **Create.** Unit tests, fake timers. |
| `src/terminal/art/artLabels.js` | **Create.** Pure label visibility/placement logic for node and cluster labels. |
| `src/terminal/art/__tests__/artLabels.test.js` | **Create.** Unit tests. |
| `src/terminal/art/SphereLabels.jsx` | **Create.** DOM overlay rendering label states. |
| `src/terminal/net/SomaPresence.js` | **Move** from `src/terminal/audio/SomaPresence.js`. It is multiplayer, not audio. |
| `src/terminal/audio/SomaAudio.js` | **Delete.** 1216 lines, sole consumer is ArtTab. |
| `src/terminal/views/ArtTab.jsx` | **Modify.** Strip audio, wire beat clock, mount label overlay, delete three `fillText` sites. |

---

## Task 1: Visual-only beat clock module

The ambient beat pulse at `ArtTab.jsx:871` reads `beatPhaseRef`, which is written **only** by `somaAudio.startBeatClock(114, …)` at `ArtTab.jsx:2552`. Deleting audio without this leaves `beatPhaseRef` pinned at 0 and the pulse layer silently stops existing. This module replaces the timer, dropping the sound and keeping the tick.

**Files:**
- Create: `src/terminal/art/artBeatClock.js`
- Test: `src/terminal/art/__tests__/artBeatClock.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createBeatClock({ bpm, onBeat }) → { start(), stop(), intervalMs, running }`, and `DEFAULT_BPM = 114`. Task 2 uses both.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/art/__tests__/artBeatClock.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBeatClock, DEFAULT_BPM } from '../artBeatClock';

describe('createBeatClock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('derives the interval from bpm, rounded, matching the retired audio clock', () => {
    // SomaAudio.startBeatClock used Math.round(60000 / bpm); 114 bpm → 526ms.
    expect(createBeatClock({ bpm: 114 }).intervalMs).toBe(526);
    expect(createBeatClock({ bpm: 120 }).intervalMs).toBe(500);
  });

  it('defaults to 114 bpm', () => {
    expect(DEFAULT_BPM).toBe(114);
    expect(createBeatClock({}).intervalMs).toBe(526);
  });

  it('fires immediately on start so the pulse begins on toggle', () => {
    const onBeat = vi.fn();
    createBeatClock({ onBeat }).start();
    expect(onBeat).toHaveBeenCalledTimes(1);
  });

  it('fires once per interval thereafter', () => {
    const onBeat = vi.fn();
    createBeatClock({ bpm: 120, onBeat }).start();
    onBeat.mockClear();
    vi.advanceTimersByTime(1500);
    expect(onBeat).toHaveBeenCalledTimes(3);
  });

  it('stops firing after stop()', () => {
    const onBeat = vi.fn();
    const clock = createBeatClock({ bpm: 120, onBeat });
    clock.start();
    clock.stop();
    onBeat.mockClear();
    vi.advanceTimersByTime(5000);
    expect(onBeat).not.toHaveBeenCalled();
  });

  it('does not double-schedule when started twice', () => {
    const onBeat = vi.fn();
    const clock = createBeatClock({ bpm: 120, onBeat });
    clock.start();
    clock.start();
    onBeat.mockClear();
    vi.advanceTimersByTime(1000);
    expect(onBeat).toHaveBeenCalledTimes(2); // not 4
  });

  it('reports running state', () => {
    const clock = createBeatClock({ onBeat: () => {} });
    expect(clock.running).toBe(false);
    clock.start();
    expect(clock.running).toBe(true);
    clock.stop();
    expect(clock.running).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/art/__tests__/artBeatClock.test.js`
Expected: FAIL — cannot resolve `../artBeatClock`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/art/artBeatClock.js`:

```js
// artBeatClock.js — visual-only beat clock for the sphere's ambient pulse.
//
// Extracted from SomaAudio.startBeatClock when the /art tab's audio was
// removed. The "Ambient beat pulse glow" layer decays a beat phase every
// frame and needs something to set it back to 1 on the beat. That something
// used to be the audio engine, which made a purely visual effect depend on
// an AudioContext — and made the pulse the least obvious casualty of
// deleting the sound.

export const DEFAULT_BPM = 114;

/**
 * createBeatClock({ bpm, onBeat }) — a bare interval that fires immediately
 * on start and then once per beat. Timing is identical to the audio clock it
 * replaces; only the sound is gone.
 */
export function createBeatClock({ bpm = DEFAULT_BPM, onBeat } = {}) {
  const intervalMs = Math.round(60000 / bpm);
  let id = null;

  const stop = () => {
    if (id != null) { clearInterval(id); id = null; }
  };

  const start = () => {
    stop();                       // never double-schedule
    onBeat?.();                   // fire immediately so the pulse starts on toggle
    id = setInterval(() => onBeat?.(), intervalMs);
  };

  return {
    start,
    stop,
    intervalMs,
    get running() { return id != null; },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/art/__tests__/artBeatClock.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artBeatClock.js src/terminal/art/__tests__/artBeatClock.test.js
git commit -m "feat(art): extract the beat clock from the audio engine

The ambient pulse reads a beat phase that only SomaAudio's beat clock ever
wrote, so a purely visual effect depended on an AudioContext. Same timing,
no sound."
```

---

## Task 2: Wire the beat clock into ArtTab

**Files:**
- Modify: `src/terminal/views/ArtTab.jsx` (imports; the beat toggle at `:2552`)

**Interfaces:**
- Consumes: `createBeatClock`, `DEFAULT_BPM` from Task 1.
- Produces: `beatClockRef` — a ref holding the clock instance, used by nothing later. Task 4 relies on `somaAudio.startBeatClock` / `stopBeatClock` no longer being referenced anywhere.

- [ ] **Step 1: Add the import**

In `src/terminal/views/ArtTab.jsx`, beside the other `../art/` imports (near line 48):

```js
import { createBeatClock } from '../art/artBeatClock';
```

- [ ] **Step 2: Create the clock ref**

Beside `beatPhaseRef` (line 225):

```js
  const beatPhaseRef   = useRef(0);     // 1 = just fired, decays toward 0 per frame
  const beatClockRef   = useRef(null);
  if (beatClockRef.current === null) {
    beatClockRef.current = createBeatClock({
      onBeat: () => { beatPhaseRef.current = 1.0; },
    });
  }
```

- [ ] **Step 3: Swap the toggle over**

Find the beat toggle at `ArtTab.jsx:2552`. Replace the two audio calls:

```js
                somaAudio.startBeatClock(114, () => { beatPhaseRef.current = 1.0; });
```
becomes
```js
                beatClockRef.current.start();
```

and
```js
                somaAudio.stopBeatClock();
```
becomes
```js
                beatClockRef.current.stop();
```

- [ ] **Step 4: Stop the clock on unmount**

The unmount effect at `ArtTab.jsx:236-241` calls `somaAudio.stopBeatClock()`. Add the new clock's teardown alongside it (the audio call is removed in Task 4):

```js
      beatClockRef.current?.stop();
```

- [ ] **Step 5: Verify no beat-clock audio calls remain**

Run: `grep -n "startBeatClock\|stopBeatClock" src/terminal/views/ArtTab.jsx`
Expected: only the `somaAudio.stopBeatClock()` line inside the unmount effect, which Task 4 removes. No other matches.

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`
Expected: exit 0.

```bash
git add src/terminal/views/ArtTab.jsx
git commit -m "feat(art): drive the ambient pulse from the visual beat clock"
```

---

## Task 3: Move SomaPresence out of the audio directory

`src/terminal/audio/SomaPresence.js` is the **multiplayer layer** — peer cursors, fire events, phase broadcast — feeding Collective Perturbation via `useCollectiveR`. It lives in `audio/` only by accident. Task 4 empties that directory, and leaving presence behind invites a future deletion that silently kills multiplayer.

**Files:**
- Move: `src/terminal/audio/SomaPresence.js` → `src/terminal/net/SomaPresence.js`
- Modify: `src/terminal/views/ArtTab.jsx:35` (the only importer)

**Interfaces:**
- Consumes: nothing.
- Produces: `somaPresence` importable from `../net/SomaPresence`. No API change.

- [ ] **Step 1: Move the file with history preserved**

```bash
mkdir -p src/terminal/net
git mv src/terminal/audio/SomaPresence.js src/terminal/net/SomaPresence.js
```

- [ ] **Step 2: Update the import**

In `src/terminal/views/ArtTab.jsx:35`:

```js
import { somaPresence } from '../audio/SomaPresence';
```
becomes
```js
import { somaPresence } from '../net/SomaPresence';
```

- [ ] **Step 3: Confirm no other importer exists**

Run: `grep -rn "audio/SomaPresence" src/`
Expected: no output. (`src/terminal/hooks/useCollectiveR.js:9` mentions SomaPresence in a comment only — leave it, it is still accurate.)

- [ ] **Step 4: Verify the build resolves**

Run: `npm run build`
Expected: exit 0, no unresolved import errors.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/net/SomaPresence.js src/terminal/audio/SomaPresence.js src/terminal/views/ArtTab.jsx
git commit -m "refactor(art): move SomaPresence out of audio/

It is the multiplayer layer — peer cursors, fire events, phase broadcast —
and it only lived under audio/ by accident. The next commit empties that
directory."
```

---

## Task 4: Delete the audio engine

**Files:**
- Delete: `src/terminal/audio/SomaAudio.js` (1216 lines)
- Modify: `src/terminal/views/ArtTab.jsx` — ~28 call sites plus four UI features

**Interfaces:**
- Consumes: Task 2's beat clock (already wired — the pulse must survive this task).
- Produces: an `ArtTab.jsx` with zero `somaAudio` references.

- [ ] **Step 1: Remove the import and the init plumbing**

Delete `import { somaAudio } from '../audio/SomaAudio';` (line 34), the `ensureAudio` callback (`:228-234`), `audioInitRef`, the `audioMuted` state, and the audio init/suspend/resume effect (`:236-241`) — keeping the `beatClockRef.current?.stop()` line Task 2 added.

Also delete `CLUSTER_FREQ_MAP` (`:61`), which exists solely to mirror SomaAudio's cluster frequencies for sonification.

- [ ] **Step 2: Remove every remaining call site**

Delete these statements. Where a line is `ensureAudio(); somaAudio.playX(); somethingElse();`, keep only `somethingElse()`.

| Line | Call |
|---|---|
| `:198` | `somaAudio.playResonance?.({ freq: 660, … })` |
| `:201` | `somaAudio.playNode?.('drk_entropy', …)` |
| `:491` | `ensureAudio(); somaAudio.playNode(node.id);` — keep `fireNode(node.id)` |
| `:564` | `ensureAudio(); somaAudio.playBifurcation(spawned.length);` |
| `:667` | `somaAudio.playNode(n.id);` |
| `:695` | `somaAudio.stepContinuous({ … })` — the whole continuous-sonification block inside the draw loop |
| `:1924` | `ensureAudio(); somaAudio.playResonance(…)` |
| `:1954` | `ensureAudio(); somaAudio.playBeat(); somaAudio.playNode(node.id);` |
| `:1993` | `ensureAudio(); somaAudio.playDrop();` |
| `:2035` | `ensureAudio(); somaAudio.playDrop();` |
| `:2137` | `ensureAudio(); somaAudio.playBeat(); somaAudio.playNode(node.id);` |
| `:2193` | `somaAudio.playBifurcation(…)` |
| `:2307` | `ensureAudio(); somaAudio.playBifurcation(1);` |
| `:2363-2364` | the mute keyboard shortcut |
| `:2372-2373` | recording start/stop |

**Do not remove** the surrounding logic — several of these lines carry
non-audio statements (`fireNode`, `somaPresence.sendFire`, state updates) that
must survive.

- [ ] **Step 3: Remove the audio UI**

Delete the mute button (`:2536`), the beat-clock toggle's audio branches — keeping the `beatClockRef` calls from Task 2 — the recording button (`:2584`) and the MIDI export button (`:2608`). Remove now-unused `lucide-react` icons from the line 16 import (`Volume2`, `VolumeX`, `Radio`, `Download`, `Clock` — check each against remaining usage before deleting; `npm run lint` will fail on any left unused).

- [ ] **Step 4: Delete the module**

```bash
git rm src/terminal/audio/SomaAudio.js
```

- [ ] **Step 5: Verify nothing references it**

Run: `grep -rn "somaAudio\|SomaAudio\|CLUSTER_FREQ_MAP" src/`
Expected: no output.

Run: `ls src/terminal/audio/ 2>/dev/null`
Expected: empty or absent. If empty, remove the directory.

- [ ] **Step 6: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: all exit 0. Lint is the real gate here — it catches every orphaned import and unused variable left by the deletions.

- [ ] **Step 7: Verify in the browser — this is the acceptance gate**

Start the dev server via the preview tooling (never a bare `npm run dev` in a shell), open `/art`, and confirm:

1. The sphere renders and rotates.
2. **The ambient beat pulse still pulses** after toggling the beat control — the specific regression this whole task risks.
3. Drag-rotate, hover, left-click cue, right-click fusion and shift-click resonance all still work.
4. Multiplayer presence still connects (peer count indicator).
5. No console errors.

Capture a screenshot and compare against one taken before Task 1. Per spec §6, use the headless-Chrome-over-CDP recipe — never `--disable-gpu`, use `--enable-unsafe-swiftshader`. The browser pane suspends `requestAnimationFrame`, so a capture from it is a frozen first frame, not the piece.

**Acceptance: pixel-identical apart from the removed audio controls.**

- [ ] **Step 8: Commit**

```bash
git add src/terminal/views/ArtTab.jsx src/terminal/audio/SomaAudio.js
git commit -m "refactor(art): delete the audio engine

1216 lines with a single consumer, and by the author's own assessment it
sounded like cheap church bells. The ambient pulse it secretly drove now
runs off artBeatClock; everything else it touched was sound only."
```

---

## Task 5: Pure label state module

The node label logic composites three visibility sources and runs a staggered
cascade envelope — the most intricate pure logic in the draw loop, and
currently untestable because it is inlined between `ctx` calls. Extract it
verbatim before moving the rendering.

**Files:**
- Create: `src/terminal/art/artLabels.js`
- Test: `src/terminal/art/__tests__/artLabels.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `fireAlphaFor({ elapsed, isSeed, index }) → number`
  - `nodeLabelState({ node, projected, index, isHovered, fired, elapsed, depthAlpha, radius }) → { text, x, y, alpha, fontSize } | null`
  - `clusterLabelState({ rz, projected, text }) → { text, x, y, alpha, fontSize } | null`
  - `fireExpired(elapsed) → boolean`
  - Constants `FIRE_FADE_IN`, `FIRE_HOLD_END`, `FIRE_FADE_OUT_END`, `FIRE_EXPIRY`, `CLUSTER_LABEL_MIN_Z`

  Task 6 consumes all of these.

- [ ] **Step 1: Write the failing test**

Create `src/terminal/art/__tests__/artLabels.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  fireAlphaFor, nodeLabelState, clusterLabelState, fireExpired,
  FIRE_EXPIRY, CLUSTER_LABEL_MIN_Z,
} from '../artLabels';

const projected = { sx: 100, sy: 200, scale: 1, depth: 0.5 };
const node = { id: 'n1', label: 'KERNEL', energy: 0 };

describe('fireAlphaFor', () => {
  it('is silent before the stagger delay elapses', () => {
    // neighbours at index 1 wait 0.08 + 1*0.025 = 0.105s
    expect(fireAlphaFor({ elapsed: 0.05, isSeed: false, index: 1 })).toBe(0);
  });

  it('gives the seed no delay', () => {
    expect(fireAlphaFor({ elapsed: 0.001, isSeed: true, index: 0 })).toBeGreaterThan(0);
  });

  it('eases in over the first 0.35s', () => {
    const half = fireAlphaFor({ elapsed: 0.175, isSeed: true, index: 0 });
    expect(half).toBeCloseTo(0.5 * 0.95, 5);
  });

  it('holds at full between 0.35s and 2.5s', () => {
    expect(fireAlphaFor({ elapsed: 1.0, isSeed: true, index: 0 })).toBeCloseTo(0.95, 5);
  });

  it('scales neighbours below the seed', () => {
    expect(fireAlphaFor({ elapsed: 1.0, isSeed: false, index: 0 })).toBeCloseTo(0.80, 5);
  });

  it('fades out between 2.5s and 3.5s and is zero after', () => {
    expect(fireAlphaFor({ elapsed: 3.0, isSeed: true, index: 0 })).toBeCloseTo(0.5 * 0.95, 5);
    expect(fireAlphaFor({ elapsed: 3.6, isSeed: true, index: 0 })).toBe(0);
  });
});

describe('fireExpired', () => {
  it('expires past 3.8s', () => {
    expect(FIRE_EXPIRY).toBe(3.8);
    expect(fireExpired(3.7)).toBe(false);
    expect(fireExpired(3.9)).toBe(true);
  });
});

describe('nodeLabelState', () => {
  const base = {
    node, projected, index: 0, isHovered: false,
    fired: null, elapsed: 0, depthAlpha: 1, radius: 6,
  };

  it('returns null when no visibility source is active', () => {
    expect(nodeLabelState(base)).toBeNull();
  });

  it('shows on hover at 0.92 alpha and full font weight', () => {
    const s = nodeLabelState({ ...base, isHovered: true });
    expect(s.alpha).toBeCloseTo(0.92, 5);
    expect(s.fontSize).toBe(10);
    expect(s.text).toBe('KERNEL');
  });

  it('shows on high energy above the 0.45 threshold', () => {
    expect(nodeLabelState({ ...base, node: { ...node, energy: 0.45 } })).toBeNull();
    const s = nodeLabelState({ ...base, node: { ...node, energy: 0.9 } });
    expect(s).not.toBeNull();
    expect(s.fontSize).toBe(8);
  });

  it('suppresses the energy source behind the sphere', () => {
    const behind = { ...projected, depth: -0.5 };
    expect(nodeLabelState({
      ...base, node: { ...node, energy: 0.9 }, projected: behind,
    })).toBeNull();
  });

  it('positions above the node by its radius plus 4', () => {
    const s = nodeLabelState({ ...base, isHovered: true });
    expect(s.x).toBe(100);
    expect(s.y).toBe(200 - 6 - 4);
  });

  it('scales the font by the projected scale', () => {
    const s = nodeLabelState({
      ...base, isHovered: true, projected: { ...projected, scale: 2 },
    });
    expect(s.fontSize).toBe(20);
  });

  it('takes the brightest of the competing sources', () => {
    // hover 0.92 beats energy 0.9*0.8 = 0.72
    const s = nodeLabelState({
      ...base, isHovered: true, node: { ...node, energy: 0.9 },
    });
    expect(s.alpha).toBeCloseTo(0.92, 5);
  });

  it('dims non-hover labels to 0.82 of their alpha', () => {
    const s = nodeLabelState({ ...base, node: { ...node, energy: 1.0 } });
    expect(s.alpha).toBeCloseTo(1.0 * 0.80 * 0.82, 5);
  });

  it('shows a fired neighbour via the cascade', () => {
    const fired = { seedId: 'other', neighborIds: new Set(['n1']) };
    const s = nodeLabelState({ ...base, fired, elapsed: 1.0 });
    expect(s).not.toBeNull();
    expect(s.fontSize).toBe(9);
  });

  it('ignores nodes outside the fired neighbour set', () => {
    const fired = { seedId: 'other', neighborIds: new Set(['somethingelse']) };
    expect(nodeLabelState({ ...base, fired, elapsed: 1.0 })).toBeNull();
  });

  it('applies depth alpha to the fire source', () => {
    const fired = { seedId: 'n1', neighborIds: new Set(['n1']) };
    const lit = nodeLabelState({ ...base, fired, elapsed: 1.0, depthAlpha: 1 });
    const dim = nodeLabelState({ ...base, fired, elapsed: 1.0, depthAlpha: 0.5 });
    expect(dim.alpha).toBeCloseTo(lit.alpha * 0.5, 5);
  });
});

describe('clusterLabelState', () => {
  it('hides labels on the back face', () => {
    expect(CLUSTER_LABEL_MIN_Z).toBe(-0.2);
    expect(clusterLabelState({ rz: -0.3, projected, text: 'eco' })).toBeNull();
  });

  it('uppercases and scales alpha by rz', () => {
    const s = clusterLabelState({ rz: 0.5, projected, text: 'eco' });
    expect(s.text).toBe('ECO');
    expect(s.alpha).toBeCloseTo(0.5 * 0.12, 5);
    expect(s.fontSize).toBe(9);
  });

  it('floors alpha at zero within the visible band', () => {
    const s = clusterLabelState({ rz: -0.1, projected, text: 'eco' });
    expect(s.alpha).toBe(0);
  });

  it('offsets upward by 52 times the projected scale', () => {
    const s = clusterLabelState({
      rz: 0.5, projected: { ...projected, scale: 0.5 }, text: 'eco',
    });
    expect(s.y).toBe(200 - 26);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/art/__tests__/artLabels.test.js`
Expected: FAIL — cannot resolve `../artLabels`.

- [ ] **Step 3: Write the implementation**

Create `src/terminal/art/artLabels.js`. This is a **verbatim** extraction of the logic at `ArtTab.jsx:1460-1506` and `:901-912` — do not improve it, or parity is lost:

```js
// artLabels.js — pure label visibility and placement for the /art sphere.
//
// Extracted verbatim from ArtTab's draw loop when labels moved from canvas
// fillText to a DOM overlay. Nothing here draws; it answers "should this
// label be visible, where, and how bright", so the answer can be tested
// without a canvas and rendered by either backend.
//
// All coordinates are CSS pixels: the draw loop projects against the
// contentRect size and applies the DPR as a canvas transform, so projected
// values need no conversion for DOM positioning.

export const FIRE_FADE_IN = 0.35;
export const FIRE_HOLD_END = 2.5;
export const FIRE_FADE_OUT_END = 3.5;
export const FIRE_EXPIRY = 3.8;
export const CLUSTER_LABEL_MIN_Z = -0.2;

/**
 * fireAlphaFor — the fired-node cascade envelope.
 * The seed fires instantly; neighbours are staggered 80-200ms by index so the
 * cascade reads as propagation rather than a simultaneous flash.
 */
export function fireAlphaFor({ elapsed, isSeed, index }) {
  const delay = isSeed ? 0 : 0.08 + (index % 5) * 0.025;
  const t = elapsed - delay;

  let a;
  if (t < 0)                      a = 0;
  else if (t < FIRE_FADE_IN)      a = t / FIRE_FADE_IN;
  else if (t < FIRE_HOLD_END)     a = 1.0;
  else if (t < FIRE_FADE_OUT_END) a = 1.0 - (t - FIRE_HOLD_END);
  else                            a = 0;

  return a * (isSeed ? 0.95 : 0.80);
}

/** The cascade ref is cleared once every label in it has faded. */
export function fireExpired(elapsed) {
  return elapsed > FIRE_EXPIRY;
}

/**
 * nodeLabelState — composites three independent visibility sources (hover,
 * high energy, fired cascade) and returns the brightest, or null if the label
 * should not render at all.
 */
export function nodeLabelState({
  node, projected, index, isHovered, fired, elapsed, depthAlpha, radius,
}) {
  const isSeed = !!fired && node.id === fired.seedId;
  const inFire = !!fired && fired.neighborIds.has(node.id);
  const fireAlpha = inFire
    ? fireAlphaFor({ elapsed, isSeed, index }) * depthAlpha
    : 0;

  const showHover  = !!isHovered;
  const showEnergy = node.energy > 0.45 && projected.depth > -0.1;
  const showFire   = fireAlpha > 0.01;
  if (!showHover && !showEnergy && !showFire) return null;

  const hoverA  = showHover  ? 0.92 : 0;
  const energyA = showEnergy ? node.energy * 0.80 * depthAlpha : 0;
  const la      = Math.max(hoverA, energyA, fireAlpha);

  const fontSize = Math.round(
    ((showHover || isSeed) ? 10 : showFire ? 9 : 8) * projected.scale,
  );

  return {
    text: node.label,
    x: projected.sx,
    y: projected.sy - radius - 4,
    alpha: la * (showHover ? 1.0 : 0.82),
    fontSize,
  };
}

/**
 * clusterLabelState — the ghost labels at projected cluster anchor positions.
 * Very low alpha by design; they are atmosphere, not navigation.
 */
export function clusterLabelState({ rz, projected, text }) {
  if (rz < CLUSTER_LABEL_MIN_Z) return null;
  return {
    text: text.toUpperCase(),
    x: projected.sx,
    y: projected.sy - 52 * projected.scale,
    alpha: Math.max(0, rz) * 0.12,
    fontSize: 9,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/art/__tests__/artLabels.test.js`
Expected: PASS, 21 tests.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/art/artLabels.js src/terminal/art/__tests__/artLabels.test.js
git commit -m "feat(art): extract label visibility logic from the draw loop

Three composited visibility sources and a staggered cascade envelope, until
now inlined between ctx calls and untestable. Verbatim extraction — the
numbers are the shipped ones."
```

---

## Task 6: Render labels in the DOM

**Files:**
- Create: `src/terminal/art/SphereLabels.jsx`
- Modify: `src/terminal/views/ArtTab.jsx` — remove `fillText` at `:911`, `:1506`, `:1606`; collect label state per frame; mount the overlay

**Interfaces:**
- Consumes: Task 5's `nodeLabelState`, `clusterLabelState`, `fireExpired`.
- Produces: `<SphereLabels ref={labelsApiRef} />` exposing one imperative
  method, `update(labels)`, where each label is
  `{ key, text, x, y, alpha, fontSize, color }`. The draw loop calls it once
  per frame.

**Why imperative:** the overlay updates every frame on the piece whose entire
migration exists to buy frame budget. Re-rendering React at 60fps to move a
handful of spans pays reconciliation for something a direct style write does
for free — and the rest of the draw loop already works this way.

**Test file:** `src/terminal/art/__tests__/SphereLabels.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/terminal/art/__tests__/SphereLabels.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import SphereLabels from '../SphereLabels';

const label = (over = {}) => ({
  key: 'node:n1', text: 'KERNEL', x: 100, y: 200,
  alpha: 0.5, fontSize: 9, color: 'rgb(255,0,0)', ...over,
});

function mount() {
  const ref = createRef();
  const { container } = render(<SphereLabels ref={ref} />);
  return { ref, host: container.firstChild };
}

describe('SphereLabels', () => {
  it('never intercepts pointer events', () => {
    const { host } = mount();
    expect(host.style.pointerEvents).toBe('none');
  });

  it('creates one span per label with position, font and opacity applied', () => {
    const { ref, host } = mount();
    ref.current.update([label()]);
    const spans = host.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('KERNEL');
    expect(spans[0].style.left).toBe('100px');
    expect(spans[0].style.top).toBe('200px');
    expect(spans[0].style.opacity).toBe('0.5');
  });

  it('reuses the same element across updates for a stable key', () => {
    const { ref, host } = mount();
    ref.current.update([label()]);
    const first = host.querySelector('span');
    ref.current.update([label({ x: 300, alpha: 0.9 })]);
    const second = host.querySelector('span');
    expect(second).toBe(first);              // reused, not recreated
    expect(second.style.left).toBe('300px');
    expect(second.style.opacity).toBe('0.9');
  });

  it('removes elements whose labels disappear', () => {
    const { ref, host } = mount();
    ref.current.update([label(), label({ key: 'node:n2', text: 'OTHER' })]);
    expect(host.querySelectorAll('span')).toHaveLength(2);
    ref.current.update([label()]);
    const spans = host.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('KERNEL');
  });

  it('clears everything when handed an empty set', () => {
    const { ref, host } = mount();
    ref.current.update([label()]);
    ref.current.update([]);
    expect(host.querySelectorAll('span')).toHaveLength(0);
  });

  it('survives being called before paint with no labels', () => {
    const { ref, host } = mount();
    expect(() => ref.current.update([])).not.toThrow();
    expect(host.querySelectorAll('span')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/art/__tests__/SphereLabels.test.jsx`
Expected: FAIL — cannot resolve `../SphereLabels`.

- [ ] **Step 3: Write the overlay component**

Create `src/terminal/art/SphereLabels.jsx`:

```jsx
// SphereLabels.jsx — DOM overlay for the sphere's labels.
//
// Text was the one layer that could not follow the rest of the sphere onto
// the GPU: an SDF atlas is real work and this project's mono font has dropped
// glyphs before. Because the labels sit mid-stack, leaving them on the canvas
// would have blocked every layer beneath them from migrating. Same move as
// the collider chamber's readouts.
//
// Updates are imperative: the draw loop calls update() once per frame and the
// elements are mutated in place. Going through React state here would put
// reconciliation in the hot path of the one piece this whole migration exists
// to make faster.
//
// Positions arrive as CSS pixels straight from the projection — the draw loop
// projects against contentRect and applies DPR as a canvas transform.

import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

const SphereLabels = forwardRef(function SphereLabels(_props, ref) {
  const hostRef = useRef(null);
  const poolRef = useRef(new Map());   // label key → span element

  useImperativeHandle(ref, () => ({
    update(labels) {
      const host = hostRef.current;
      if (!host) return;
      const pool = poolRef.current;
      const seen = new Set();

      for (const l of labels) {
        seen.add(l.key);
        let el = pool.get(l.key);
        if (!el) {
          el = document.createElement('span');
          el.style.position = 'absolute';
          el.style.transform = 'translate(-50%, -100%)';
          el.style.whiteSpace = 'nowrap';
          host.appendChild(el);
          pool.set(l.key, el);
        }
        if (el.textContent !== l.text) el.textContent = l.text;
        el.style.left = `${l.x}px`;
        el.style.top = `${l.y}px`;
        el.style.font = `bold ${l.fontSize}px monospace`;
        el.style.color = l.color;
        el.style.opacity = String(l.alpha);
      }

      for (const [key, el] of pool) {
        if (!seen.has(key)) { el.remove(); pool.delete(key); }
      }
    },
  }), []);

  useEffect(() => {
    const pool = poolRef.current;
    return () => { pool.forEach(el => el.remove()); pool.clear(); };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', userSelect: 'none',
      }}
    />
  );
});

export default SphereLabels;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/terminal/art/__tests__/SphereLabels.test.jsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit the component**

```bash
git add src/terminal/art/SphereLabels.jsx src/terminal/art/__tests__/SphereLabels.test.jsx
git commit -m "feat(art): add the DOM label overlay"
```

- [ ] **Step 6: Collect cluster labels in the draw loop**

In `ArtTab.jsx`, replace the cluster ghost label block at `:901-912`. Delete
the `ctx.textAlign` / `ctx.font` / `ctx.fillStyle` / `ctx.fillText` lines and
push state instead:

```js
      // ── Cluster ghost labels (projected anchor positions) ─────────────────
      Object.entries(CLUSTER_ANCHORS).forEach(([key, a]) => {
        const [rx, ry, rz] = applyM(M, a.x, a.y, a.z);
        const p = project(rx, ry, rz, w, h, sphereR, focal);
        const st = clusterLabelState({ rz, projected: p, text: CLUSTERS[key].label });
        if (!st) return;
        nextLabels.push({
          key: `cluster:${key}`, ...st,
          color: hslAlpha(CLUSTER_COLORS[key], 1),
        });
      });
```

Declare `const nextLabels = [];` near the top of `draw()`, before the first
layer that contributes to it. The array is handed to the overlay at the very
end of `draw()` (step 9) — after the probe label, which is pushed later in the
frame than the node loop.

Add to the `../art/artLabels` import: `clusterLabelState`, `nodeLabelState`, `fireExpired`.

- [ ] **Step 7: Collect node labels in the draw loop**

Replace the label rendering block at `ArtTab.jsx:1460-1506` — the whole
section from the `// ── Label rendering ──` comment through the closing brace
of `if (showHover || showEnergy || showFire) { … }`:

```js
        // ── Label rendering — state only; SphereLabels draws it ────────────
        const fired = firedRef.current;
        const elapsed = fired ? (performance.now() - fired.t0) / 1000 : 0;
        if (fired && fireExpired(elapsed)) firedRef.current = null;

        const st = nodeLabelState({
          node: n, projected: p, index: i, isHovered: isHov,
          fired, elapsed, depthAlpha, radius,
        });
        if (st) {
          nextLabels.push({
            key: `node:${n.id}`, ...st,
            color: hslAlpha(renderCol, 1),
          });
        }
```

- [ ] **Step 8: Move the probe label**

Replace the four label lines at `ArtTab.jsx:1603-1606` (`ctx.textAlign`,
`ctx.font`, `ctx.fillStyle`, `ctx.fillText`) — keeping the `shortQ` line above
them, which computes the truncated query text:

```js
          // Label
          const shortQ = probe.query.length > 22 ? probe.query.slice(0, 20) + '…' : probe.query;
          nextLabels.push({
            key: 'probe',
            text: `⊕ ${shortQ}`,
            x: pp.sx,
            y: pp.sy - probeR - 5,
            alpha: 0.88 * depthAlpha,
            fontSize: Math.round(9 * pp.scale),
            color: 'rgb(221,214,254)',
          });
```

The alpha, font size and colour are lifted directly from the lines being
deleted: `rgba(221,214,254, 0.88 * depthAlpha)` splits into an opaque colour
plus the `alpha` field, exactly as the cluster and node labels do.

- [ ] **Step 9: Mount the overlay and hand it the frame's labels**

Create the ref beside the other refs:

```js
  const labelsApiRef = useRef(null);
```

Mount it as a sibling immediately after the `<canvas>` element, inside the
same positioned container so `inset: 0` resolves against the canvas box:

```jsx
        <SphereLabels ref={labelsApiRef} />
```

As the **last statement in `draw()`**, before the next frame is scheduled:

```js
      labelsApiRef.current?.update(nextLabels);
```

The optional call matters — `draw()` can run before the overlay has mounted.

- [ ] **Step 10: Verify no canvas text remains**

Run: `grep -n "fillText\|strokeText" src/terminal/views/ArtTab.jsx`
Expected: no output.

- [ ] **Step 11: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: all exit 0.

- [ ] **Step 12: Verify in the browser — acceptance gate**

Open `/art` and confirm against a screenshot taken after Task 4:

1. Cluster ghost labels appear in the same positions, same faintness, and
   still vanish on the back face.
2. Node labels appear on hover, and the fired cascade still staggers
   outward from the clicked node rather than flashing at once.
3. Labels scale with depth and fade with distance as before.
4. The probe label renders on `probe <concept>`.
5. Labels do **not** intercept pointer events — hover, drag and click must
   still reach the canvas through them.
6. No console errors.

**Acceptance: crisper, not different.** Point 5 is the likely regression;
`pointer-events: none` on the container is what prevents it.

- [ ] **Step 13: Commit**

```bash
git add src/terminal/views/ArtTab.jsx
git commit -m "feat(art): move sphere labels to a DOM overlay

Text is the one layer that cannot follow the rest onto the GPU, and it sits
mid-stack — leaving it on the canvas would block every layer beneath it from
migrating. Same move as the collider chamber's readouts."
```

---

## What this plan deliberately excludes

- **Any WebGL or react-three-fiber work.** That is spec §5 step 2 onward and
  gets its own plan once this lands.
- **Deleting `KernelSphere.jsx`, `ChapterPanel.jsx` or `manifestoChapters.js`.**
  Spec §9.1 leaves them in place as a separate decision.
- **Splitting `ArtTab.jsx` further.** It shrinks as layers leave; a
  general-purpose decomposition is not in scope here.
- **Restoring any audio.** Spec §9.3 — a future site-wide audio pass starts
  from a clean sheet, not from `SomaAudio.js`.
