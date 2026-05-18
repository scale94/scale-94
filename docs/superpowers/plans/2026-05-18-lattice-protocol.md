# Lattice Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hidden RAM-wipe game to the Mercury Terminal: every `run X` except `daly` / `biodiversity` / `replicator` zeroes the RAM bar; finding all 3 in ≤3 attempts unlocks a permanent `run re$$ill` cheat (100% refill, 60s cooldown).

**Architecture:** Game state and branching logic live in `useEcologicalRam.js` alongside the existing delta map. State persists to localStorage (`scale94_lattice_protocol`). The `re$$ill` command is a new branch in `useCommandDispatch.js`. App.jsx threads the new exports through ctx. A pre-existing `opts?.eco` gate that hides keyboard runs from the eco hook is removed in the same change.

**Tech Stack:** React 19, Vitest + @testing-library/react `renderHook`, jsdom (localStorage available).

**Spec:** [docs/superpowers/specs/2026-05-18-lattice-protocol-design.md](../specs/2026-05-18-lattice-protocol-design.md)

---

## File Structure

| File | Role |
|---|---|
| `src/terminal/hooks/useEcologicalRam.js` | **Modify** — add `SAFE_ALIAS_TO_KERNEL`, lattice state + persistence, branching in `applyRamDelta`, `applyRefill`, boot-hint effect. |
| `src/terminal/hooks/useCommandDispatch.js` | **Modify** — add `re$$ill` branch; remove `opts?.eco` gate at lines 270 & 282. |
| `src/terminal/App.jsx` | **Modify** — thread `latticeState` and `applyRefill` through hook destructure and dispatch ctx (2 line edits). |
| `tests/lattice/useEcologicalRam.lattice.test.js` | **Create** — full coverage of game state machine. |
| `tests/lattice/reFillDispatch.test.js` | **Create** — focused test for `re$$ill` dispatch branch via mocked ctx. |

---

## Task 1: Safe-alias map and constants

**Files:**
- Modify: `src/terminal/hooks/useEcologicalRam.js` (top-of-file constants section)
- Create: `tests/lattice/useEcologicalRam.lattice.test.js`

- [ ] **Step 1: Create the test file with the failing test**

Create `tests/lattice/useEcologicalRam.lattice.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SAFE_ALIAS_TO_KERNEL, SAFE_KERNELS } from '../../src/terminal/hooks/useEcologicalRam';

describe('SAFE_ALIAS_TO_KERNEL', () => {
  it('exposes exactly three canonical safe kernels', () => {
    expect(SAFE_KERNELS).toEqual(['daly', 'biodiversity', 'replicator']);
  });

  it('maps every daly alias to "daly"', () => {
    ['daly', 'ecological', 'entropy_econ', 'daly_rules', 'daly_thermo'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBe('daly');
    });
  });

  it('maps every biodiversity alias to "biodiversity"', () => {
    ['biodiversity', 'biocoenosis', 'species', 'shannon_ecology', 'ecology'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBe('biodiversity');
    });
  });

  it('maps every replicator alias to "replicator"', () => {
    ['replicator', 'ostrom_game', 'commons', 'evolutionary', 'cooperate', 'altruist', 'gametheory'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBe('replicator');
    });
  });

  it('does not include non-safe aliases', () => {
    ['leviathan', 'fusion', 'tesseract', 'soma_plus', 'gaia_scale', 'kuramoto'].forEach(a => {
      expect(SAFE_ALIAS_TO_KERNEL[a]).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: FAIL with "SAFE_ALIAS_TO_KERNEL is not exported" / "undefined".

- [ ] **Step 3: Add the constants to useEcologicalRam.js**

In `src/terminal/hooks/useEcologicalRam.js`, immediately after the `ECOLOGICAL_DELTA_MAP` definition (after the closing `};` near line 285), add:

```js
// ── Lattice Protocol — safe-kernel alias map ─────────────────────────────────
// The three kernels rooted in peer-reviewed ecological math. Every other
// `run X` zeroes the RAM bar; finding all three in ≤3 attempts unlocks re$$ill.
//
// daly         — Herman Daly steady-state thermodynamic economics
// biodiversity — Shannon-Wiener entropy H = -Σ pᵢ ln(pᵢ)
// replicator   — Maynard Smith replicator dynamics + Ostrom commons

export const SAFE_KERNELS = ['daly', 'biodiversity', 'replicator'];

export const SAFE_ALIAS_TO_KERNEL = {
  // daly cluster
  daly: 'daly', ecological: 'daly', entropy_econ: 'daly',
  daly_rules: 'daly', daly_thermo: 'daly',
  // biodiversity cluster
  biodiversity: 'biodiversity', biocoenosis: 'biodiversity', species: 'biodiversity',
  shannon_ecology: 'biodiversity', ecology: 'biodiversity',
  // replicator cluster
  replicator: 'replicator', ostrom_game: 'replicator', commons: 'replicator',
  evolutionary: 'replicator', cooperate: 'replicator', altruist: 'replicator',
  gametheory: 'replicator',
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/hooks/useEcologicalRam.js tests/lattice/useEcologicalRam.lattice.test.js
git commit -m "feat(lattice): add SAFE_ALIAS_TO_KERNEL map for the three commons kernels"
```

---

## Task 2: localStorage persistence layer

**Files:**
- Modify: `src/terminal/hooks/useEcologicalRam.js`
- Modify: `tests/lattice/useEcologicalRam.lattice.test.js`

- [ ] **Step 1: Append failing tests for the persistence helpers**

Append to `tests/lattice/useEcologicalRam.lattice.test.js`:

```js
import { readLatticeState, writeLatticeState, LATTICE_STORAGE_KEY, defaultLatticeState } from '../../src/terminal/hooks/useEcologicalRam';
import { beforeEach } from 'vitest';

describe('lattice state persistence', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns defaults when localStorage is empty', () => {
    const s = readLatticeState();
    expect(s).toEqual(defaultLatticeState());
    expect(s.attemptCount).toBe(0);
    expect(s.foundSafes).toEqual([]);
    expect(s.unlocked).toBe(false);
    expect(s.failed).toBe(false);
    expect(s.lastRefillAt).toBe(0);
    expect(s.hintSeen).toBe(false);
  });

  it('round-trips state through localStorage', () => {
    const s = { attemptCount: 2, foundSafes: ['daly', 'biodiversity'], unlocked: false, failed: false, lastRefillAt: 0, hintSeen: true };
    writeLatticeState(s);
    expect(readLatticeState()).toEqual(s);
  });

  it('uses the correct storage key', () => {
    expect(LATTICE_STORAGE_KEY).toBe('scale94_lattice_protocol');
    writeLatticeState(defaultLatticeState());
    expect(localStorage.getItem(LATTICE_STORAGE_KEY)).not.toBeNull();
  });

  it('returns defaults if stored JSON is malformed', () => {
    localStorage.setItem(LATTICE_STORAGE_KEY, '{not json');
    expect(readLatticeState()).toEqual(defaultLatticeState());
  });

  it('returns defaults if localStorage throws (private-mode fallback)', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    expect(readLatticeState()).toEqual(defaultLatticeState());
    Storage.prototype.getItem = orig;
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: FAIL with "readLatticeState is not exported".

- [ ] **Step 3: Add persistence helpers to useEcologicalRam.js**

In `src/terminal/hooks/useEcologicalRam.js`, immediately after the `SAFE_ALIAS_TO_KERNEL` block, add:

```js
// ── Lattice Protocol — localStorage persistence ──────────────────────────────
export const LATTICE_STORAGE_KEY = 'scale94_lattice_protocol';

export const defaultLatticeState = () => ({
  attemptCount: 0,
  foundSafes:   [],    // serialized as array; treated as set in logic
  unlocked:     false,
  failed:       false,
  lastRefillAt: 0,
  hintSeen:     false,
});

export function readLatticeState() {
  try {
    const raw = localStorage.getItem(LATTICE_STORAGE_KEY);
    if (!raw) return defaultLatticeState();
    const parsed = JSON.parse(raw);
    return { ...defaultLatticeState(), ...parsed };
  } catch (_) {
    return defaultLatticeState();
  }
}

export function writeLatticeState(state) {
  try {
    localStorage.setItem(LATTICE_STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* quota or private mode — silently no-op */ }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: PASS (all tests in both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/hooks/useEcologicalRam.js tests/lattice/useEcologicalRam.lattice.test.js
git commit -m "feat(lattice): add localStorage persistence helpers with private-mode fallback"
```

---

## Task 3: Game branching in applyRamDelta

**Files:**
- Modify: `src/terminal/hooks/useEcologicalRam.js`
- Modify: `tests/lattice/useEcologicalRam.lattice.test.js`

- [ ] **Step 1: Append failing hook tests for the game state machine**

Append to `tests/lattice/useEcologicalRam.lattice.test.js`:

```js
import { renderHook, act } from '@testing-library/react';
import { useEcologicalRam } from '../../src/terminal/hooks/useEcologicalRam';

function setup() {
  const logs = [];
  const appendSystemLog = (entry) => { logs.push(entry); };
  const view = renderHook(() => useEcologicalRam({ appendSystemLog }));
  return { ...view, logs };
}

describe('useEcologicalRam — lattice game branching', () => {
  beforeEach(() => { localStorage.clear(); });

  it('safe alias adds to foundSafes, increments attemptCount, applies normal recharge', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    expect(result.current.latticeState.foundSafes).toEqual(['daly']);
    expect(result.current.latticeState.attemptCount).toBe(1);
    expect(result.current.latticeState.unlocked).toBe(false);
    expect(result.current.ramPct).toBe(70 + 22); // RAM_START + daly delta, capped at 100
    const hint = logs.find(l => l.msg.includes('[LATTICE:HONORED]'));
    expect(hint).toBeDefined();
    expect(hint.msg).toContain('1 of 3');
    expect(hint.msg).toContain('2 attempts remaining');
  });

  it('safe alias resolves canonical name from alias (e.g. ecological → daly)', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta('ecological'); });
    expect(result.current.latticeState.foundSafes).toEqual(['daly']);
  });

  it('duplicate safe alias burns attempt but does not re-add to foundSafes', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    act(() => { result.current.applyRamDelta('daly'); });
    expect(result.current.latticeState.foundSafes).toEqual(['daly']);
    expect(result.current.latticeState.attemptCount).toBe(2);
    const dup = logs.find(l => l.msg.includes('already registered'));
    expect(dup).toBeDefined();
  });

  it('non-safe alias wipes RAM to 0 (bypassing 5% floor)', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    expect(result.current.ramPct).toBe(0);
    expect(result.current.latticeState.attemptCount).toBe(1);
    expect(result.current.latticeState.foundSafes).toEqual([]);
    const wipe = logs.find(l => l.msg.includes('[LATTICE:ZEROED]'));
    expect(wipe).toBeDefined();
    expect(wipe.msg).toContain('2 attempts remaining');
  });

  it('finding 3rd safe within 3 attempts unlocks re$$ill', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    act(() => { result.current.applyRamDelta('biodiversity'); });
    act(() => { result.current.applyRamDelta('replicator'); });
    expect(result.current.latticeState.unlocked).toBe(true);
    expect(result.current.latticeState.failed).toBe(false);
    const unlock = logs.find(l => l.msg.includes('[RE$$ILL:UNLOCKED]'));
    expect(unlock).toBeDefined();
  });

  it('3 attempts with fewer than 3 safes triggers failed', () => {
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    act(() => { result.current.applyRamDelta('daly'); });
    act(() => { result.current.applyRamDelta('fusion'); });
    expect(result.current.latticeState.failed).toBe(true);
    expect(result.current.latticeState.unlocked).toBe(false);
    const seal = logs.find(l => l.msg.includes('[LATTICE:SILENT]'));
    expect(seal).toBeDefined();
  });

  it('state persists to localStorage after each delta', () => {
    const { result } = setup();
    act(() => { result.current.applyRamDelta('daly'); });
    const stored = JSON.parse(localStorage.getItem('scale94_lattice_protocol'));
    expect(stored.foundSafes).toEqual(['daly']);
    expect(stored.attemptCount).toBe(1);
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 2, foundSafes: ['daly', 'biodiversity'], unlocked: false,
      failed: false, lastRefillAt: 0, hintSeen: true,
    }));
    const { result } = setup();
    expect(result.current.latticeState.attemptCount).toBe(2);
    expect(result.current.latticeState.foundSafes).toEqual(['daly', 'biodiversity']);
  });

  it('once unlocked, non-safe runs apply normal delta with 5% floor (game suppressed)', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      ...JSON.parse(JSON.stringify({ attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true, failed: false, lastRefillAt: 0, hintSeen: true })),
    }));
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    expect(result.current.ramPct).toBeGreaterThanOrEqual(5); // floor restored
    expect(result.current.ramPct).toBeLessThan(70);          // delta applied
    expect(logs.find(l => l.msg.includes('[LATTICE:ZEROED]'))).toBeUndefined();
  });

  it('once failed, non-safe runs apply normal delta with 5% floor', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly'], unlocked: false, failed: true, lastRefillAt: 0, hintSeen: true,
    }));
    const { result, logs } = setup();
    act(() => { result.current.applyRamDelta('leviathan'); });
    expect(result.current.ramPct).toBeGreaterThanOrEqual(5);
    expect(logs.find(l => l.msg.includes('[LATTICE:ZEROED]'))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: FAIL — `latticeState` not on hook return, game logic absent.

- [ ] **Step 3: Add lattice state and branching logic to the hook**

In `src/terminal/hooks/useEcologicalRam.js`, modify the `useEcologicalRam` function (currently lines 375–481).

Inside the hook, after `const ramPctRef = useRef(RAM_START);` (~line 379), add:

```js
  // ── Lattice Protocol state ─────────────────────────────────────────────────
  const [latticeState, setLatticeState] = useState(() => readLatticeState());
  const latticeRef = useRef(latticeState);
  useEffect(() => { latticeRef.current = latticeState; }, [latticeState]);

  const updateLattice = useCallback((next) => {
    latticeRef.current = next;
    setLatticeState(next);
    writeLatticeState(next);
  }, []);
```

Then replace the entire `applyRamDelta` callback (currently lines 393–465) with:

```js
  const applyRamDelta = useCallback((aliasOrDelta) => {
    const alias   = typeof aliasOrDelta === 'string' ? aliasOrDelta : null;
    const aliasUp = alias ? alias.toUpperCase() : null;
    const numericDelta = typeof aliasOrDelta === 'number'
      ? aliasOrDelta
      : (ECOLOGICAL_DELTA_MAP[aliasOrDelta] ?? -10);

    const prev = ramPctRef.current;
    const t    = new Date().toLocaleTimeString('en-US', { hour12: false });
    const lat  = latticeRef.current;
    const gameActive = !lat.unlocked && !lat.failed && alias !== null;

    // ── Branch A: game over (or numeric delta — passive entropy) ──────────────
    if (!gameActive) {
      const flavor = (alias && ECO_FLAVOR[alias]) || ecoFlavorFallback(numericDelta);
      const next   = Math.max(RAM_FLOOR, Math.min(RAM_CEIL, prev + numericDelta));
      ramPctRef.current = next;
      setRamPct(next);

      // Existing per-run + threshold log lines (preserved from original implementation)
      const alreadyAtFloor = prev === RAM_FLOOR;
      if (numericDelta < 0 && !alreadyAtFloor) {
        appendRef.current({ time: t, color: ecoRunColor(numericDelta),
          msg: `[ECO:${numericDelta}] ${aliasUp ?? 'COMPUTE'} // ${flavor} · RAM ${prev}% → ${next}%` });
      } else if (numericDelta >= 10) {
        appendRef.current({ time: t, color: '#00FFAA',
          msg: `[ECO:+${numericDelta}] ${aliasUp ?? 'ECOLOGICAL'} // ${flavor} · RAM ${prev}% → ${next}%` });
      }
      if (numericDelta < 0) {
        const crossedFloor = prev > RAM_FLOOR && next === RAM_FLOOR;
        const crossedCrit  = !crossedFloor && prev >= CRIT_THRESH && next < CRIT_THRESH;
        const crossedWarn  = !crossedCrit  && prev >= WARN_THRESH && next < WARN_THRESH;
        if (alreadyAtFloor) {
          appendRef.current({ time: t, color: '#FF0088',
            msg: `[RAM:EXHAUSTED] // planetary commons at minimum threshold · ${next}% floor signal only · the lattice cannot absorb further extraction · run: daly / ecological / gaia_scale` });
        } else if (crossedFloor) {
          appendRef.current({ time: t, color: '#FF0088',
            msg: `[LATTICE:FLOOR] // entropy has claimed all but the carrier signal — RAM ${next}% · the alien turns away · sovereign commons: silent` });
        } else if (crossedCrit) {
          appendRef.current({ time: t, color: '#FF4400',
            msg: `[CASCADE IMMINENT] // RAM ${next}% · the lattice fractures · extraction without reciprocity is a terminal state · run: daly / ecological / ostrom_game` });
        } else if (crossedWarn) {
          appendRef.current({ time: t, color: '#FFD700',
            msg: `[LATTICE STRAIN] // planetary commons under load — ${next}% remaining · the observer registers imbalance · restore: daly / gaia_scale / replicator` });
        } else if (numericDelta <= -30) {
          appendRef.current({ time: t, color: '#AA00FF',
            msg: `[ENTROPIC CASCADE −${Math.abs(numericDelta)}] // RAM ${next}%${aliasUp ? ` · ledger records: ${aliasUp}` : ''} · planetary debt accumulates` });
        }
      }
      return;
    }

    // ── Branch B: game active ─────────────────────────────────────────────────
    const safeKernel = SAFE_ALIAS_TO_KERNEL[alias];
    const newAttempt = lat.attemptCount + 1;
    const remaining  = Math.max(0, 3 - newAttempt);

    if (safeKernel) {
      // Safe hit — apply normal recharge, record discovery
      const next = Math.max(RAM_FLOOR, Math.min(RAM_CEIL, prev + numericDelta));
      ramPctRef.current = next;
      setRamPct(next);

      const alreadyFound  = lat.foundSafes.includes(safeKernel);
      const newFoundSafes = alreadyFound ? lat.foundSafes : [...lat.foundSafes, safeKernel];
      const count         = newFoundSafes.length;

      if (alreadyFound) {
        appendRef.current({ time: t, color: '#FFD700',
          msg: `[LATTICE:HONORED] :: ${aliasUp} already registered · ${count} of 3 found · ${remaining} attempt${remaining === 1 ? '' : 's'} remaining` });
      } else {
        appendRef.current({ time: t, color: '#00FFAA',
          msg: `[LATTICE:HONORED] :: ${aliasUp} registered · ${count} of 3 found · ${remaining} attempt${remaining === 1 ? '' : 's'} remaining` });
      }

      const nowUnlocked = count === 3;
      const nowFailed   = !nowUnlocked && newAttempt >= 3;
      if (nowUnlocked) {
        appendRef.current({ time: t, color: '#00FFAA',
          msg: `[RE$$ILL:UNLOCKED] :: cryptographic key bound to local node · 'run re$$ill' now available · cooldown 60s` });
      } else if (nowFailed) {
        appendRef.current({ time: t, color: '#FF0088',
          msg: `[LATTICE:SILENT] :: protocol window closed · re$$ill key sealed · the alien remembers` });
      }
      updateLattice({ ...lat, attemptCount: newAttempt, foundSafes: newFoundSafes, unlocked: nowUnlocked, failed: nowFailed });
      return;
    }

    // Non-safe hit — wipe to 0 (bypass floor for this single wipe)
    ramPctRef.current = 0;
    setRamPct(0);
    appendRef.current({ time: t, color: '#FF0088',
      msg: `[LATTICE:ZEROED] :: ${aliasUp} // extractive compute detected · planetary commons collapsed · ${remaining} attempt${remaining === 1 ? '' : 's'} remaining` });

    const nowFailed = newAttempt >= 3 && lat.foundSafes.length < 3;
    if (nowFailed) {
      appendRef.current({ time: t, color: '#FF0088',
        msg: `[LATTICE:SILENT] :: protocol window closed · re$$ill key sealed · the alien remembers` });
    }
    updateLattice({ ...lat, attemptCount: newAttempt, failed: nowFailed });
  }, [updateLattice]);
```

Then update the return object at the bottom of `useEcologicalRam` (currently lines 472–480) to expose lattice state:

```js
  return {
    ramPct,
    ecoCost:     100 - ramPct,
    applyEcoCost:  applyRamDelta,   // backward compat alias
    applyRamDelta,
    isCritical,
    isWarning,
    latticeState,
  };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: PASS — all tests across the three describe blocks (constants, persistence, branching).

- [ ] **Step 5: Verify no existing tests broke**

Run: `npx vitest run`
Expected: All previously-passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/hooks/useEcologicalRam.js tests/lattice/useEcologicalRam.lattice.test.js
git commit -m "feat(lattice): game branching in applyRamDelta — safe/non-safe/terminal states"
```

---

## Task 4: applyRefill with cooldown

**Files:**
- Modify: `src/terminal/hooks/useEcologicalRam.js`
- Modify: `tests/lattice/useEcologicalRam.lattice.test.js`

- [ ] **Step 1: Append failing tests for applyRefill**

Append to `tests/lattice/useEcologicalRam.lattice.test.js`:

```js
describe('useEcologicalRam — applyRefill', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns { ok: false, reason: "locked" } when not unlocked', () => {
    const { result } = setup();
    let outcome;
    act(() => { outcome = result.current.applyRefill(); });
    expect(outcome).toEqual({ ok: false, reason: 'locked' });
    expect(result.current.ramPct).toBe(70);
  });

  it('refills to 100 when unlocked and cooldown elapsed', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true,
      failed: false, lastRefillAt: 0, hintSeen: true,
    }));
    const { result } = setup();
    // Drain a bit first
    act(() => { result.current.applyRamDelta(-20); });
    expect(result.current.ramPct).toBe(50);
    let outcome;
    act(() => { outcome = result.current.applyRefill(); });
    expect(outcome.ok).toBe(true);
    expect(result.current.ramPct).toBe(100);
    expect(result.current.latticeState.lastRefillAt).toBeGreaterThan(0);
  });

  it('returns { ok: false, reason: "cooldown", remainingMs } if within 60s', () => {
    const recent = Date.now() - 10_000; // 10s ago
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true,
      failed: false, lastRefillAt: recent, hintSeen: true,
    }));
    const { result } = setup();
    let outcome;
    act(() => { outcome = result.current.applyRefill(); });
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe('cooldown');
    expect(outcome.remainingMs).toBeGreaterThan(45_000);
    expect(outcome.remainingMs).toBeLessThanOrEqual(50_000);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: FAIL — `applyRefill is not a function`.

- [ ] **Step 3: Implement applyRefill**

In `src/terminal/hooks/useEcologicalRam.js`, add this constant near the top of the file alongside the other RAM constants:

```js
const REFILL_COOLDOWN_MS = 60_000;
```

Then add this callback inside `useEcologicalRam`, after the `applyRamDelta` definition:

```js
  const applyRefill = useCallback(() => {
    const lat = latticeRef.current;
    if (!lat.unlocked) return { ok: false, reason: 'locked' };
    const elapsed = Date.now() - lat.lastRefillAt;
    if (elapsed < REFILL_COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown', remainingMs: REFILL_COOLDOWN_MS - elapsed };
    }
    ramPctRef.current = RAM_CEIL;
    setRamPct(RAM_CEIL);
    updateLattice({ ...lat, lastRefillAt: Date.now() });
    return { ok: true };
  }, [updateLattice]);
```

Update the return object to include `applyRefill`:

```js
  return {
    ramPct,
    ecoCost:     100 - ramPct,
    applyEcoCost:  applyRamDelta,
    applyRamDelta,
    applyRefill,
    isCritical,
    isWarning,
    latticeState,
  };
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: PASS — all four describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/hooks/useEcologicalRam.js tests/lattice/useEcologicalRam.lattice.test.js
git commit -m "feat(lattice): applyRefill with 60s cooldown and outcome tuple"
```

---

## Task 5: Boot hint effect

**Files:**
- Modify: `src/terminal/hooks/useEcologicalRam.js`
- Modify: `tests/lattice/useEcologicalRam.lattice.test.js`

- [ ] **Step 1: Append failing tests for the boot hint**

Append to `tests/lattice/useEcologicalRam.lattice.test.js`:

```js
describe('useEcologicalRam — boot hint', () => {
  beforeEach(() => { localStorage.clear(); });

  it('emits the LATTICE_PROTOCOL hint once on first mount', () => {
    const { logs } = setup();
    const hint = logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'));
    expect(hint).toBeDefined();
    expect(hint.msg).toContain('3 kernels honor the commons');
    expect(hint.msg).toContain("'re$$ill'");
  });

  it('persists hintSeen so the hint does not repeat on next mount', () => {
    setup(); // first mount
    const { logs } = setup(); // second mount — fresh hook, same localStorage
    const hint = logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'));
    expect(hint).toBeUndefined();
  });

  it('suppresses the hint when already unlocked', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly','biodiversity','replicator'], unlocked: true,
      failed: false, lastRefillAt: 0, hintSeen: false,
    }));
    const { logs } = setup();
    expect(logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'))).toBeUndefined();
  });

  it('suppresses the hint when already failed', () => {
    localStorage.setItem('scale94_lattice_protocol', JSON.stringify({
      attemptCount: 3, foundSafes: ['daly'], unlocked: false, failed: true,
      lastRefillAt: 0, hintSeen: false,
    }));
    const { logs } = setup();
    expect(logs.find(l => l.msg.includes('[LATTICE_PROTOCOL]'))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: FAIL — no `[LATTICE_PROTOCOL]` log emitted.

- [ ] **Step 3: Add the boot hint effect**

In `src/terminal/hooks/useEcologicalRam.js`, inside `useEcologicalRam`, after the existing passive entropy `useEffect`, add:

```js
  // Boot hint — runs once when the game is still in play and the hint has
  // never been shown. Marks hintSeen so it never repeats. Suppressed once
  // the user has either unlocked or failed.
  useEffect(() => {
    const lat = latticeRef.current;
    if (lat.hintSeen || lat.unlocked || lat.failed) return;
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    appendRef.current({
      time:  t,
      color: '#9F7AEA', // violet — ambient protocol hint
      msg:   `[LATTICE_PROTOCOL] :: 3 kernels honor the commons — find them in 3 attempts to unlock 're$$ill'`,
    });
    updateLattice({ ...lat, hintSeen: true });
  }, [updateLattice]);
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/lattice/useEcologicalRam.lattice.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/hooks/useEcologicalRam.js tests/lattice/useEcologicalRam.lattice.test.js
git commit -m "feat(lattice): boot hint emitted once per browser, suppressed after game ends"
```

---

## Task 6: `re$$ill` dispatch + remove `opts?.eco` gate + App.jsx wiring

**Files:**
- Modify: `src/terminal/hooks/useCommandDispatch.js`
- Modify: `src/terminal/App.jsx`
- Create: `tests/lattice/reFillDispatch.test.js`

- [ ] **Step 1: Create the failing dispatch test**

Create `tests/lattice/reFillDispatch.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandDispatch } from '../../src/terminal/hooks/useCommandDispatch';

// Minimal ctx — re$$ill branch fires before WASM lookup, so most fields are unused.
function makeCtx(overrides = {}) {
  const logs = [];
  return {
    articles: [], classifiedSession: null, transmissionStories: [], tagIndex: {},
    systemArticles: {}, activeTab: 'kernel',
    setSystemLogs:   vi.fn((updater) => { if (typeof updater === 'function') logs.splice(0, logs.length, ...updater(logs)); }),
    setClassifiedSession: vi.fn(), setActiveTab: vi.fn(), setSelectedArticle: vi.fn(),
    setSearchFilter: vi.fn(), setCurrentPath: vi.fn(), setRelicMode: vi.fn(), setBreachOpen: vi.fn(),
    applyEcoCost: vi.fn(), applyRefill: vi.fn(() => ({ ok: true })),
    latticeState: { unlocked: true, lastRefillAt: 0 },
    setOriginTab: vi.fn(), setArchitectThesis: vi.fn(), setTagCloudView: vi.fn(),
    appendSystemLog: vi.fn((entry) => { logs.push(entry); }),
    handleNav: vi.fn(), handleKernelClick: vi.fn(), handleTransmissionSelect: vi.fn(),
    loadAbortRef: { current: null }, activeKernels: { current: {} },
    setKuramotoViz: vi.fn(), setAssociativeField: vi.fn(), setSpectralBridges: vi.fn(),
    setEnclaveKeys: vi.fn(), setProbeNode: vi.fn(), setBoneFusions: vi.fn(),
    fusionLog: [], setFusionLog: vi.fn(),
    ...overrides,
    _logs: logs,
  };
}

describe('re$$ill command branch', () => {
  it('calls applyRefill when unlocked and emits success log', () => {
    const ctx = makeCtx();
    const { result } = renderHook(() => useCommandDispatch(ctx));
    act(() => { result.current('run', 're$$ill', 'run re$$ill', '12:00:00', {}); });
    expect(ctx.applyRefill).toHaveBeenCalled();
    expect(ctx._logs.some(l => l.msg.includes('RE$$ILL') && l.msg.includes('100%'))).toBe(true);
  });

  it('logs RE$$ILL_LOCKED when applyRefill returns locked', () => {
    const ctx = makeCtx({ applyRefill: vi.fn(() => ({ ok: false, reason: 'locked' })) });
    const { result } = renderHook(() => useCommandDispatch(ctx));
    act(() => { result.current('run', 're$$ill', 'run re$$ill', '12:00:00', {}); });
    expect(ctx._logs.some(l => l.msg.includes('RE$$ILL_LOCKED'))).toBe(true);
  });

  it('logs cooldown with seconds remaining when applyRefill returns cooldown', () => {
    const ctx = makeCtx({ applyRefill: vi.fn(() => ({ ok: false, reason: 'cooldown', remainingMs: 23_400 })) });
    const { result } = renderHook(() => useCommandDispatch(ctx));
    act(() => { result.current('run', 're$$ill', 'run re$$ill', '12:00:00', {}); });
    const cd = ctx._logs.find(l => l.msg.includes('RE$$ILL_COOLDOWN'));
    expect(cd).toBeDefined();
    expect(cd.msg).toMatch(/24s remaining/); // 23.4s ceil → 24s
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npx vitest run tests/lattice/reFillDispatch.test.js`
Expected: FAIL — re$$ill branch not implemented, returns generic RUN_FAIL.

- [ ] **Step 3: Add the `re$$ill` branch and remove the eco gate**

In `src/terminal/hooks/useCommandDispatch.js`:

First, update the ctx destructure (line 52–60) to add `applyRefill` and `latticeState`:

```js
    const {
      articles, classifiedSession, transmissionStories, tagIndex, systemArticles, activeTab,
      setSystemLogs, setClassifiedSession, setActiveTab, setSelectedArticle,
      setSearchFilter, setCurrentPath, setRelicMode, setBreachOpen, applyEcoCost,
      applyRefill, latticeState,
      setOriginTab, setArchitectThesis, setTagCloudView,
      appendSystemLog, handleNav, handleKernelClick, handleTransmissionSelect,
      loadAbortRef, activeKernels, setKuramotoViz, setAssociativeField, setSpectralBridges, setEnclaveKeys, setProbeNode, setBoneFusions,
      fusionLog, setFusionLog,
    } = ctxRef.current;
```

Then, immediately after the empty-query check (after the `if (!query) { ... return; }` block around line 77), add the re$$ill branch BEFORE the `const [baseCmd, ...flagTokens]` line so it runs before any other parsing:

```js
      // ── run re$$ill ──────────────────────────────────────────────────────
      // The Lattice Protocol cheat. Permanent unlock via localStorage. 60s cooldown.
      // Intercepted before WASM lookup so the $$ characters don't trip normalization.
      if (query.trim().toLowerCase() === 're$$ill') {
        const outcome = applyRefill();
        log(`COMMAND: ${rawCmd}`);
        if (outcome.ok) {
          logs(
            `  RE$$ILL :: planetary RAM restored to 100%`,
            `  the cheat is honored · the cooldown begins · 60s until next refill`,
          );
        } else if (outcome.reason === 'locked') {
          logs(
            `  RE$$ILL_LOCKED :: cryptographic key not bound`,
            `  find the 3 commons kernels in 3 attempts to unlock`,
          );
        } else if (outcome.reason === 'cooldown') {
          const remaining = Math.ceil(outcome.remainingMs / 1000);
          logs(
            `  RE$$ILL_COOLDOWN :: ${remaining}s remaining`,
            `  the lattice replenishes on geological time`,
          );
        }
        return;
      }
```

Finally, **remove the `opts?.eco` gate**. Change line 270:

```js
                    if (opts?.eco) applyEcoCost(ecoAlias);
```

To:

```js
                    applyEcoCost(ecoAlias);
```

And line 282:

```js
              if (opts?.eco) applyEcoCost(ecoAlias);
```

To:

```js
              applyEcoCost(ecoAlias);
```

- [ ] **Step 4: Wire `applyRefill` and `latticeState` through App.jsx**

In `src/terminal/App.jsx`, modify line 144 from:

```js
  const { ramPct, ecoCost, applyEcoCost, isCritical, isWarning } = useEcologicalRam({ appendSystemLog });
```

To:

```js
  const { ramPct, ecoCost, applyEcoCost, applyRefill, latticeState, isCritical, isWarning } = useEcologicalRam({ appendSystemLog });
```

Then modify line 757 from:

```js
    setSearchFilter, setCurrentPath, setRelicMode, setBreachOpen, applyEcoCost,
```

To:

```js
    setSearchFilter, setCurrentPath, setRelicMode, setBreachOpen, applyEcoCost, applyRefill, latticeState,
```

- [ ] **Step 5: Run dispatch tests to verify pass**

Run: `npx vitest run tests/lattice/reFillDispatch.test.js`
Expected: PASS (3/3).

- [ ] **Step 6: Run the full test suite to verify nothing broke**

Run: `npx vitest run`
Expected: All tests pass. If any tests touch the eco gate behavior, they should still pass (removing the gate makes eco fire MORE often, not less).

- [ ] **Step 7: Run the linter**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/hooks/useCommandDispatch.js src/terminal/App.jsx tests/lattice/reFillDispatch.test.js
git commit -m "feat(lattice): run re\$\$ill command + remove opts?.eco gate + App.jsx wiring"
```

---

## Task 7: Browser verification

**Files:** None modified — manual verification only.

- [ ] **Step 1: Start the dev server**

Use `mcp__Claude_Preview__preview_start` (the project's preview MCP) to launch vite.

- [ ] **Step 2: Verify the boot hint appears**

Use `preview_snapshot` on the terminal. The system log should show the `[LATTICE_PROTOCOL] :: 3 kernels honor the commons` line shortly after boot.

If the hint is missing, check:
- Open browser console via `preview_console_logs`.
- Check that `localStorage.scale94_lattice_protocol` is unset (fresh session).
- Reload with cleared storage if needed via `preview_eval`: `localStorage.removeItem('scale94_lattice_protocol'); location.reload();`.

- [ ] **Step 3: Run `daly` and verify the HONORED line**

Use `preview_fill` to type `run daly` in the command input, then `preview_eval` to press Enter (or use the project's existing input pattern — check `preview_snapshot` for the input element).

Expected snapshot content:
- `[LATTICE:HONORED] :: DALY registered · 1 of 3 found · 2 attempts remaining`
- RAM bar increased (70 + 22 = 92).

- [ ] **Step 4: Run `biodiversity`, then `replicator`**

After each, verify the HONORED line increments. After the third (`replicator`):
- `[RE$$ILL:UNLOCKED] :: cryptographic key bound to local node · 'run re$$ill' now available · cooldown 60s`
- `localStorage.scale94_lattice_protocol` shows `unlocked: true`.

- [ ] **Step 5: Run `re$$ill` and verify the refill**

Type `run re$$ill`. Expected:
- `RE$$ILL :: planetary RAM restored to 100%`
- RAM bar jumps to 100.

- [ ] **Step 6: Run `re$$ill` again within 60s — verify cooldown**

Expected:
- `RE$$ILL_COOLDOWN :: <N>s remaining`
- RAM bar unchanged.

- [ ] **Step 7: Reload page and verify persistence**

Use `preview_eval`: `location.reload()`. After reload:
- Boot hint does NOT reappear.
- Type `run re$$ill` — should still work (after cooldown elapses).

- [ ] **Step 8: Test the failure path in a fresh session**

`preview_eval`: `localStorage.removeItem('scale94_lattice_protocol'); location.reload();`.

Then run three non-safe commands in sequence: `run leviathan`, `run fusion`, `run tesseract`.

Expected:
- Each emits `[LATTICE:ZEROED]` and drops RAM to 0%.
- After the third: `[LATTICE:SILENT] :: protocol window closed · re$$ill key sealed · the alien remembers`.
- Typing `run re$$ill` thereafter emits `RE$$ILL_LOCKED`.
- `localStorage.scale94_lattice_protocol` shows `failed: true`, `unlocked: false`.

- [ ] **Step 9: Take a screenshot of the unlocked state for the PR**

`preview_screenshot` after running the safe trio + re$$ill, showing the unlocked terminal with full RAM bar and the success log lines.

- [ ] **Step 10: Stop the dev server**

`preview_stop`.

- [ ] **Step 11: Final commit if any browser-discovered fixes were needed**

If verification surfaced bugs, fix them with focused edits and commit:

```bash
git add <files>
git commit -m "fix(lattice): <specific issue found in browser verification>"
```

If no fixes needed, skip this step.

---

## Self-Review Notes

**Spec coverage check:**
- Safe trio (daly/biodiversity/replicator) — Task 1
- RAM wipe to 0 for non-safes — Task 3
- ≤3 attempts to unlock — Task 3
- localStorage persistence — Task 2, 3, 5
- re$$ill 100% refill + 60s cooldown — Task 4, 6
- Boot hint (cryptic, once) — Task 5
- All edge cases listed in spec (duplicate safe, collision, breach, unknown kernel, passive drain, locked re$$ill, malformed localStorage, multi-tab) — covered by tests in Tasks 2–5
- Pre-existing eco gate fix — Task 6 Step 3 (line edits)
- App.jsx wiring — Task 6 Step 4
- Browser verification (success criteria 1–8 from spec) — Task 7

No gaps. No placeholders. All type names consistent across tasks (`latticeState`, `applyRefill`, `SAFE_ALIAS_TO_KERNEL`, `SAFE_KERNELS`, `LATTICE_STORAGE_KEY`, `defaultLatticeState`, `readLatticeState`, `writeLatticeState`).
