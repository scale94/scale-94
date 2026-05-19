# Gate + Possession Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the philosophical-prompt gate that fires on first page load, routing the visitor into either a curated 5-command tour (pass) or a 60-second hostile WASM possession of the terminal (fail). See spec: `docs/superpowers/specs/2026-05-19-gate-possession-design.md`.

**Architecture:** State-based phantom typing (not DOM event dispatch) — the gate overlay is a React modal, the tour and possession are React hooks that mutate `commandInput` and call a new `runRawCommand` helper exposed from `App.jsx`. Possession sets the terminal input to `readOnly` and applies a red-border CSS class while the timer ticks down. State is persisted in `sessionStorage` so reloads inside the same tab don't re-trigger.

**Tech Stack:** React (existing), vitest (for pure-logic tests), Tailwind CSS (existing). No new dependencies.

---

## File Structure

**Files to create:**
- `src/terminal/lib/gateAnswers.js` — pure answer-normalization + matching
- `src/terminal/lib/gateStorage.js` — sessionStorage wrapper with in-memory fallback
- `src/terminal/hooks/usePhantomTyper.js` — state-based phantom command typing
- `src/terminal/hooks/useTourSequence.js` — pass path: 5 curated commands
- `src/terminal/hooks/usePossessionSequence.js` — fail path: 60s of hostile commands
- `src/terminal/components/GateOverlay.jsx` — full-viewport prompt UI
- `tests/gateAnswers.test.js` — unit tests for answer matching
- `tests/gateStorage.test.js` — unit tests for storage wrapper

**Files to modify:**
- `src/terminal/App.jsx` — add gate state, mount overlay, wire tour/possession, expose `runRawCommand`, pass `readOnly` into the terminal input

---

## Task 1: Gate answer-matching utility

**Files:**
- Create: `src/terminal/lib/gateAnswers.js`
- Test: `tests/gateAnswers.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/gateAnswers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { normalizeGateAnswer, isAcceptedAnswer, ACCEPTED_ANSWERS, GATE_PROMPT } from '../src/terminal/lib/gateAnswers';

describe('gateAnswers', () => {
  it('exports the prompt text', () => {
    expect(GATE_PROMPT).toBe('from perihelion, growth reads as ___');
  });

  it('exports the accepted set', () => {
    expect(ACCEPTED_ANSWERS).toEqual(['noise', 'decay', 'dying']);
  });

  describe('normalizeGateAnswer', () => {
    it('lowercases', () => expect(normalizeGateAnswer('NOISE')).toBe('noise'));
    it('trims whitespace', () => expect(normalizeGateAnswer('  decay  ')).toBe('decay'));
    it('collapses inner whitespace to single space', () => expect(normalizeGateAnswer('dy ing')).toBe('dy ing'));
    it('handles null/undefined', () => {
      expect(normalizeGateAnswer(null)).toBe('');
      expect(normalizeGateAnswer(undefined)).toBe('');
    });
  });

  describe('isAcceptedAnswer', () => {
    it('accepts canonical "noise"', () => expect(isAcceptedAnswer('noise')).toBe(true));
    it('accepts canonical "decay"', () => expect(isAcceptedAnswer('decay')).toBe(true));
    it('accepts canonical "dying"', () => expect(isAcceptedAnswer('dying')).toBe(true));
    it('accepts uppercase NOISE', () => expect(isAcceptedAnswer('NOISE')).toBe(true));
    it('accepts whitespace-padded " decay "', () => expect(isAcceptedAnswer(' decay ')).toBe(true));
    it('rejects empty string', () => expect(isAcceptedAnswer('')).toBe(false));
    it('rejects null', () => expect(isAcceptedAnswer(null)).toBe(false));
    it('rejects "growth"', () => expect(isAcceptedAnswer('growth')).toBe(false));
    it('rejects partial match "noi"', () => expect(isAcceptedAnswer('noi')).toBe(false));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- gateAnswers`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/terminal/lib/gateAnswers.js`:

```js
export const GATE_PROMPT = 'from perihelion, growth reads as ___';

export const ACCEPTED_ANSWERS = ['noise', 'decay', 'dying'];

export function normalizeGateAnswer(text) {
  if (text == null) return '';
  return String(text).trim().toLowerCase();
}

export function isAcceptedAnswer(text) {
  const norm = normalizeGateAnswer(text);
  if (!norm) return false;
  return ACCEPTED_ANSWERS.includes(norm);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- gateAnswers`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/gateAnswers.js tests/gateAnswers.test.js
git commit -m "feat(gate): add philosophical-prompt answer matching"
```

---

## Task 2: SessionStorage gate-state helper

**Files:**
- Create: `src/terminal/lib/gateStorage.js`
- Test: `tests/gateStorage.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/gateStorage.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGateState, setGateState, GATE_KEY } from '../src/terminal/lib/gateStorage';

describe('gateStorage', () => {
  beforeEach(() => {
    // Reset both real sessionStorage and the in-memory fallback before each test
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
  });

  it('exports the storage key', () => {
    expect(GATE_KEY).toBe('scale94.gate');
  });

  it('returns null when nothing is stored', () => {
    expect(getGateState()).toBeNull();
  });

  it('persists and reads "passed"', () => {
    setGateState('passed');
    expect(getGateState()).toBe('passed');
  });

  it('persists and reads "failed"', () => {
    setGateState('failed');
    expect(getGateState()).toBe('failed');
  });

  it('clears state when set to null', () => {
    setGateState('passed');
    setGateState(null);
    expect(getGateState()).toBeNull();
  });

  it('falls back to in-memory when sessionStorage throws', () => {
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('blocked'); },
    });
    try {
      setGateState('passed');
      expect(getGateState()).toBe('passed');
    } finally {
      Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: original });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- gateStorage`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/terminal/lib/gateStorage.js`:

```js
export const GATE_KEY = 'scale94.gate';

let memoryFallback = null;

function safeStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function getGateState() {
  const storage = safeStorage();
  if (!storage) return memoryFallback;
  try {
    return storage.getItem(GATE_KEY);
  } catch {
    return memoryFallback;
  }
}

export function setGateState(value) {
  const storage = safeStorage();
  memoryFallback = value;
  if (!storage) return;
  try {
    if (value == null) storage.removeItem(GATE_KEY);
    else storage.setItem(GATE_KEY, value);
  } catch {
    /* in-memory fallback already updated */
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- gateStorage`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/lib/gateStorage.js tests/gateStorage.test.js
git commit -m "feat(gate): add sessionStorage wrapper with in-memory fallback"
```

---

## Task 3: usePhantomTyper hook

**Files:**
- Create: `src/terminal/hooks/usePhantomTyper.js`

Manual verification only — this hook drives a visible animation; vitest can't observe the rendered DOM.

- [ ] **Step 1: Write the hook**

Create `src/terminal/hooks/usePhantomTyper.js`:

```js
import { useRef, useCallback, useEffect } from 'react';

/**
 * usePhantomTyper — state-based phantom typing for the terminal command input.
 *
 * The hook returns { typeAndSubmit, cancel } where:
 *   typeAndSubmit(rawCmd) animates `setCommandInput` char-by-char at ~40ms/char,
 *     then calls `runRawCommand(rawCmd)` to fire it through the existing dispatcher,
 *     then clears the input.
 *   cancel() aborts any in-flight typing immediately.
 *
 * @param {(text: string) => void} setCommandInput   from App.jsx
 * @param {(raw: string) => void}  runRawCommand     from App.jsx
 */
export default function usePhantomTyper({ setCommandInput, runRawCommand }) {
  const cancelRef = useRef({ cancelled: false });

  // Cancel any in-flight typing on unmount
  useEffect(() => () => { cancelRef.current.cancelled = true; }, []);

  const cancel = useCallback(() => {
    cancelRef.current.cancelled = true;
  }, []);

  const typeAndSubmit = useCallback(async (rawCmd) => {
    cancelRef.current = { cancelled: false };
    const token = cancelRef.current;
    for (let i = 1; i <= rawCmd.length; i++) {
      if (token.cancelled) return false;
      setCommandInput(rawCmd.slice(0, i));
      await new Promise(r => setTimeout(r, 40));
    }
    if (token.cancelled) return false;
    // small pause so the user sees the full command before it fires
    await new Promise(r => setTimeout(r, 180));
    if (token.cancelled) return false;
    runRawCommand(rawCmd);
    setCommandInput('');
    return true;
  }, [setCommandInput, runRawCommand]);

  return { typeAndSubmit, cancel };
}
```

- [ ] **Step 2: Commit (no functional change yet — the hook is consumed in later tasks)**

```bash
git add src/terminal/hooks/usePhantomTyper.js
git commit -m "feat(gate): add usePhantomTyper hook for state-based command animation"
```

---

## Task 4: Expose `runRawCommand` from App.jsx

**Files:**
- Modify: `src/terminal/App.jsx`

The existing terminal keydown handler does the parse+dispatch inline. To let phantom typing reuse the same pipeline, extract the parsing-and-dispatch into a stable callback.

- [ ] **Step 1: Locate the existing Enter handler in App.jsx**

Run: `grep -n "rawCmd\|cmdParts" src/terminal/App.jsx | head -10`
Expected: matches inside the terminal keydown handler.

- [ ] **Step 2: Add `runRawCommand` helper near the dispatch call**

In `src/terminal/App.jsx`, locate the existing keydown handler (look for `setCmdHistory(prev => [rawCmd` or the dispatch invocation). Just before that handler is defined, add:

```js
// Shared command-execution path: used by the terminal keydown handler
// AND the phantom-typing hooks (tour + possession). Parses the raw command
// the same way the keydown handler does, then dispatches.
const runRawCommand = useCallback((raw) => {
  const rawCmd = (raw ?? '').trim();
  if (!rawCmd) return;
  const cmdParts = rawCmd.toLowerCase().split(' ').filter(Boolean);
  const action = cmdParts[0]
    ? (cmdParts[0].startsWith('/') ? cmdParts[0].substring(1) : cmdParts[0])
    : '';
  const query = cmdParts.slice(1).join(' ');
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  dispatch(action, query, rawCmd, now);
}, [dispatch]);
```

Note: `dispatch` here is whatever variable name the existing code uses for the return value of `useCommandDispatch(...)`. Confirm by grepping `useCommandDispatch` in App.jsx — the variable name is in the destructuring assignment.

- [ ] **Step 3: Refactor the existing Enter handler to use `runRawCommand`**

Find the existing code block that builds `rawCmd`, `cmdParts`, `action`, `query` inline within the keydown handler and dispatches. Replace that block with:

```js
const rawCmd = commandInput.trim();
if (rawCmd) {
  setCmdHistory(prev => [rawCmd, ...prev].slice(0, 50));
  setHistoryIdx(-1);
  setSavedInput('');
}
setCommandInput('');
runRawCommand(rawCmd);
```

(Keep any surrounding logic — suggestion-dropdown handling, history navigation, etc. Only replace the parse+dispatch block.)

- [ ] **Step 4: Verify the dev server still runs and existing commands still work**

Open the preview, type `mercury` + Enter in the terminal. Verify it navigates to the Mercury tab. Type `run bosonic` + Enter. Verify the WASM kernel runs and outputs to the system log.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/App.jsx
git commit -m "refactor(terminal): extract runRawCommand helper for phantom typing reuse"
```

---

## Task 5: GateOverlay component

**Files:**
- Create: `src/terminal/components/GateOverlay.jsx`

- [ ] **Step 1: Write the component**

Create `src/terminal/components/GateOverlay.jsx`:

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { GATE_PROMPT, isAcceptedAnswer } from '../lib/gateAnswers';

/**
 * GateOverlay — full-viewport philosophical-prompt overlay.
 *
 * Fires onResult(true) for an accepted answer, onResult(false) for
 * an empty submit, Escape, or any rejected string.
 */
export default function GateOverlay({ onResult }) {
  const [value, setValue] = useState('');
  const [fading, setFading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Autofocus on mount; mobile keyboards open automatically.
    inputRef.current?.focus();
  }, []);

  const resolve = (passed) => {
    if (fading) return;
    setFading(true);
    // 300ms fade before unmount (parent decides actual unmount)
    setTimeout(() => onResult(passed), 300);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      resolve(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      resolve(isAcceptedAnswer(value));
    }
  };

  return (
    <div
      role="dialog"
      aria-label="entry prompt"
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/95 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex flex-col items-center gap-6 px-6 max-w-3xl w-full">
        <div
          className="font-mono text-cyan-300 text-base sm:text-2xl md:text-3xl text-center tracking-wide"
          aria-live="polite"
        >
          {GATE_PROMPT}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="bg-transparent border-b border-cyan-500/60 focus:border-cyan-300 focus:outline-none text-cyan-100 font-mono text-lg sm:text-2xl text-center w-full max-w-md px-2 py-2 caret-cyan-300"
          aria-label="your answer"
        />
        <div className="font-mono text-cyan-700 text-[10px] uppercase tracking-widest">
          Enter to submit · Esc to refuse
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke-test the component in isolation**

Add a temporary direct mount in `src/terminal/App.jsx` near the existing `<BootSequence>` line (we'll wire it properly in the next task — this is just to confirm it renders). At the top of the App component body:

```js
const [gateTest, setGateTest] = useState(true);
```

In the render, before the existing top-level overlays:

```jsx
{gateTest && <GateOverlay onResult={(passed) => { console.log('gate result:', passed); setGateTest(false); }} />}
```

And import: `import GateOverlay from './components/GateOverlay';`

- [ ] **Step 3: Verify in preview**

Refresh the preview. The gate should fill the viewport with the prompt text and a focused input. Type `noise` + Enter — console should log `gate result: true` and the overlay should fade out. Refresh, then type `nonsense` + Enter — console should log `gate result: false`.

- [ ] **Step 4: Remove the temporary smoke-test scaffolding**

Delete the `gateTest` useState and the `{gateTest && <GateOverlay ...}` mount you added in Step 2. Keep the `import GateOverlay from ...` line — Task 6 will use it.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/GateOverlay.jsx src/terminal/App.jsx
git commit -m "feat(gate): add GateOverlay component with philosophical prompt"
```

---

## Task 6: Wire gate state into App.jsx

**Files:**
- Modify: `src/terminal/App.jsx`

Adds the `gateState` + `possessionActive` state, persists results, and conditionally mounts the overlay. Tour/possession integration comes in later tasks.

- [ ] **Step 1: Add the gate state declarations**

Near the top of the App component body (alongside the other useState declarations), add:

```js
import { getGateState, setGateState } from './lib/gateStorage';

// ...

const [gateState, _setGateStateInternal] = useState(() => getGateState()); // null | 'passed' | 'failed'
const [possessionActive, setPossessionActive] = useState(false);

const persistGateState = useCallback((value) => {
  _setGateStateInternal(value);
  setGateState(value);
}, []);
```

(Put the import alongside the other `./lib/...` imports near the top of App.jsx.)

- [ ] **Step 2: Mount the overlay conditionally**

In the render, near the existing `{bootSequence && <BootSequence ...}` mount, add:

```jsx
{gateState === null && (
  <GateOverlay onResult={(passed) => persistGateState(passed ? 'passed' : 'failed')} />
)}
```

The overlay should sit at a higher z-index than BootSequence — it already has `z-[200]` in its className, so it stacks above the boot (`z-100`).

- [ ] **Step 3: Verify in preview**

Open a fresh incognito window pointed at the preview (so sessionStorage is empty). Verify:
1. After the boot sequence finishes (or alongside it), the gate appears.
2. Typing `noise` + Enter dismisses the gate.
3. Refresh the same tab — the gate does NOT reappear (sessionStorage has 'passed').
4. Open another incognito tab — gate reappears (fresh session).
5. In that fresh tab, type `wrong` + Enter — gate dismisses, sessionStorage gets 'failed'. Refresh — no gate.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/App.jsx
git commit -m "feat(gate): persist gate state in sessionStorage, mount overlay on first load"
```

---

## Task 7: useTourSequence hook

**Files:**
- Create: `src/terminal/hooks/useTourSequence.js`
- Modify: `src/terminal/App.jsx`

- [ ] **Step 1: Write the hook**

Create `src/terminal/hooks/useTourSequence.js`:

```js
import { useEffect, useRef } from 'react';

const TOUR_COMMANDS = [
  'mercury',
  'run bosonic',
  'art',
  'ledger',
  'load fish_scale_kernel',
];

const GAP_MS = 2500;

/**
 * useTourSequence — on `active`, types the 5 tour commands sequentially
 * via the phantom typer. Any real (`isTrusted`) keydown on the terminal
 * input cancels the remaining queue silently.
 */
export default function useTourSequence({ active, phantom, inputRef, appendSystemLog, onDone }) {
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    cancelledRef.current = false;

    const handler = (e) => {
      if (e.isTrusted) {
        cancelledRef.current = true;
        phantom.cancel();
      }
    };
    const inputEl = inputRef.current;
    inputEl?.addEventListener('keydown', handler);

    (async () => {
      for (const cmd of TOUR_COMMANDS) {
        if (cancelledRef.current) break;
        appendSystemLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          msg: `# the architect demonstrates :: ${cmd}`,
        });
        await new Promise(r => setTimeout(r, 350));
        if (cancelledRef.current) break;
        await phantom.typeAndSubmit(cmd);
        if (cancelledRef.current) break;
        await new Promise(r => setTimeout(r, GAP_MS));
      }
      onDone?.();
    })();

    return () => {
      cancelledRef.current = true;
      phantom.cancel();
      inputEl?.removeEventListener('keydown', handler);
    };
  }, [active, phantom, inputRef, appendSystemLog, onDone]);
}
```

- [ ] **Step 2: Wire the tour into App.jsx**

In `src/terminal/App.jsx`:

1. Add imports near the existing hook imports:

```js
import usePhantomTyper  from './hooks/usePhantomTyper';
import useTourSequence  from './hooks/useTourSequence';
```

2. Find the existing terminal input element — search for `placeholder="enter command…"` or similar. Add a `ref` to it. Declare the ref alongside other refs near the top of the component:

```js
const terminalInputRef = useRef(null);
```

Then on the `<input>` JSX: `ref={terminalInputRef}`. (If the input is rendered inside a child component, lift the ref via prop or use an existing ref if one exists.)

3. Below the existing state declarations, instantiate the phantom typer:

```js
const phantom = usePhantomTyper({ setCommandInput, runRawCommand });
```

4. Drive the tour:

```js
useTourSequence({
  active: gateState === 'passed' && !possessionActive,
  phantom,
  inputRef: terminalInputRef,
  appendSystemLog,
  onDone: () => { /* no-op; one-shot */ },
});
```

Place this after `gateState` and `phantom` are declared.

- [ ] **Step 3: Guard against repeat firing on remount**

The tour should only fire once per session. After it runs, sessionStorage already has `'passed'`, but `useTourSequence`'s effect dependency includes `active`. On a reload with `gateState === 'passed'` from sessionStorage, the effect would fire again — which is undesired.

Add a useRef guard inside the hook (modify `useTourSequence.js`):

```js
const hasRunRef = useRef(false);

useEffect(() => {
  if (!active || hasRunRef.current) return;
  hasRunRef.current = true;
  // ... rest of the effect
}, [...]);
```

But also: the tour should NOT fire on reloads where the user already passed previously. Detect "fresh pass" by also tracking whether the gate was just resolved this render. The simplest approach: pass `freshPass` boolean from App.jsx.

In App.jsx, track whether the gate was just dismissed this session by adding:

```js
const justResolvedGate = useRef(false);

const persistGateState = useCallback((value) => {
  justResolvedGate.current = true;
  _setGateStateInternal(value);
  setGateState(value);
}, []);
```

Then drive the tour with `active: gateState === 'passed' && justResolvedGate.current && !possessionActive`.

- [ ] **Step 4: Verify in preview**

Fresh incognito tab. Pass the gate with `noise`. Watch the tour:
1. System log shows `# the architect demonstrates :: mercury`, then `mercury` types into the input, fires, and Mercury tab activates.
2. ~2.5s pause.
3. `# the architect demonstrates :: run bosonic`, then `run bosonic` types and fires, kernel output appears.
4. Continues through `art`, `ledger`, `load fish_scale_kernel`.

Repeat in another fresh tab — pass the gate, then mid-tour press any key in the terminal input. The tour should stop silently (no more `# the architect demonstrates ::` lines).

Reload after a tour completes. Gate doesn't fire (sessionStorage 'passed'), and the tour does NOT re-run.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/hooks/useTourSequence.js src/terminal/App.jsx
git commit -m "feat(gate): add 5-command tour sequence on successful gate"
```

---

## Task 8: usePossessionSequence hook

**Files:**
- Create: `src/terminal/hooks/usePossessionSequence.js`
- Modify: `src/terminal/App.jsx`

- [ ] **Step 1: Write the hook**

Create `src/terminal/hooks/usePossessionSequence.js`:

```js
import { useEffect, useRef } from 'react';
import wasmRegistry from '../../wasm/wasm.generated';

const DURATION_MS    = 60_000;
const MIN_GAP_MS     = 800;
const MAX_GAP_MS     = 1500;
const INTRUSION_EVERY = 3;   // every 3rd command tick, append an intrusion line

const EXCLUDED_KERNELS = new Set([
  'VCACHE-BURN',           // 100k iterations, too slow
  'ML-KEM-CLASSIFIED',     // navigates to /cryptography + opens an API session
]);

const INTRUSION_LINES = [
  'INTRUSION_DETECTED :: unprivileged execution from MERCURY_NODE',
  'INTRUSION_DETECTED :: substrate access granted to non-local process',
  'INTRUSION_DETECTED :: keyboard buffer redirected',
  'INTRUSION_DETECTED :: exfiltrating kernel cache to perihelion',
  'INTRUSION_DETECTED :: user attention captured',
];

function pickRandomKernel() {
  const ids = Object.values(wasmRegistry)
    .map(e => e.id)
    .filter(id => !EXCLUDED_KERNELS.has(id));
  return ids[Math.floor(Math.random() * ids.length)];
}

function jitterGap() {
  return MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
}

/**
 * usePossessionSequence — on `active`, runs the hostile takeover for 60s.
 *
 * Owns: scheduling random WASM kernels via the phantom typer,
 * interleaving INTRUSION_DETECTED log lines, and calling
 * setPossessionActive(true → false) for the lifetime of the sequence.
 */
export default function usePossessionSequence({
  active,
  phantom,
  appendSystemLog,
  setPossessionActive,
  setPossessionCountdown,
  onDone,
}) {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!active || hasRunRef.current) return;
    hasRunRef.current = true;

    setPossessionActive(true);
    const startedAt = Date.now();
    let tick = 0;
    let timeoutId;

    const runTick = async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= DURATION_MS) {
        appendSystemLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          msg: 'EXFILTRATION COMPLETE :: substrate released',
          rust: true,
        });
        setPossessionActive(false);
        setPossessionCountdown(0);
        onDone?.();
        return;
      }
      setPossessionCountdown(Math.ceil((DURATION_MS - elapsed) / 1000));

      tick++;
      if (tick % INTRUSION_EVERY === 0) {
        const line = INTRUSION_LINES[Math.floor(Math.random() * INTRUSION_LINES.length)];
        appendSystemLog({
          time: new Date().toLocaleTimeString('en-US', { hour12: false }),
          msg: `  ${line}`,
          intrusion: true,
        });
      }

      const kernelId = pickRandomKernel();
      if (kernelId) {
        await phantom.typeAndSubmit(`run ${kernelId.toLowerCase()}`);
      }

      timeoutId = setTimeout(runTick, jitterGap());
    };

    timeoutId = setTimeout(runTick, 600); // brief beat before the first command

    return () => {
      clearTimeout(timeoutId);
      phantom.cancel();
      setPossessionActive(false);
      setPossessionCountdown(0);
    };
  }, [active, phantom, appendSystemLog, setPossessionActive, setPossessionCountdown, onDone]);
}
```

- [ ] **Step 2: Render the intrusion lines in red**

Find where system logs are rendered in App.jsx (search for `systemLogs.map` or `log.rust` to find the existing line-renderer). The renderer already supports a `rust: true` flag (renders green). Add support for `intrusion: true` (renders red).

Locate the JSX that maps `systemLogs` to lines. The existing pattern likely looks like:

```jsx
{systemLogs.map((log, i) => (
  <div key={i} className={log.rust ? 'text-[#39ff14]' : 'text-cyan-300'}>
    [{log.time}] {log.msg}
  </div>
))}
```

Add an `intrusion` branch:

```jsx
{systemLogs.map((log, i) => (
  <div key={i} className={log.intrusion ? 'text-red-400' : (log.rust ? 'text-[#39ff14]' : 'text-cyan-300')}>
    [{log.time}] {log.msg}
  </div>
))}
```

(Adapt to the exact className pattern in your file. The point: `intrusion: true` → red text.)

- [ ] **Step 3: Wire possession into App.jsx**

Add imports:

```js
import usePossessionSequence from './hooks/usePossessionSequence';
```

Add state:

```js
const [possessionCountdown, setPossessionCountdown] = useState(0);
```

Drive the sequence:

```js
usePossessionSequence({
  active: gateState === 'failed' && justResolvedGate.current,
  phantom,
  appendSystemLog,
  setPossessionActive,
  setPossessionCountdown,
  onDone: () => { justResolvedGate.current = false; },
});
```

- [ ] **Step 4: Lock + style the terminal input during possession**

Locate the terminal input element. Add:

```jsx
<input
  ref={terminalInputRef}
  readOnly={possessionActive}
  className={`... ${possessionActive ? 'ring-1 ring-red-500/60 border-red-500/60' : ''}`}
  // ... existing props
/>
```

Above the input, render the countdown strip when active:

```jsx
{possessionActive && (
  <div className="font-mono text-[11px] text-red-400 uppercase tracking-widest mb-1 px-2">
    ⚠ TERMINAL COMPROMISED :: T-{String(possessionCountdown).padStart(2, '0')} s
  </div>
)}
```

- [ ] **Step 5: Verify in preview**

Fresh incognito tab. Type `wrong` + Enter on the gate.
1. Gate dismisses. Terminal input gets a red border. A red `⚠ TERMINAL COMPROMISED :: T-60 s` strip appears above it.
2. Within ~1.5s, the first `run <kernel>` types itself into the input and fires. Kernel output appears in the system log.
3. Random commands continue every 0.8–1.5s. Every 3rd command, a red `INTRUSION_DETECTED :: ...` line appears.
4. Countdown ticks down each second.
5. At T-0, a green `EXFILTRATION COMPLETE :: substrate released` line appears. Red border + countdown strip disappear. Input becomes typable again.

Try typing into the input during possession — nothing happens (readOnly).
Click the Mercury tab during possession — navigation still works.

Reload during possession — gate doesn't fire (sessionStorage 'failed'), possession doesn't resume (justResolvedGate is false on reload). Land in clean IDLE.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/hooks/usePossessionSequence.js src/terminal/App.jsx
git commit -m "feat(gate): add 60s hostile possession sequence on failed gate"
```

---

## Task 9: End-to-end manual smoke test

No code changes. Run the full verification checklist from the spec.

- [ ] **Step 1: Restart the dev server clean**

Stop and restart the Vite dev server so any HMR drift is cleared.

- [ ] **Step 2: Walk through the spec verification checklist**

Open an incognito window. For each of the 10 items below, verify and check off. If any item fails, fix it inline before continuing.

1. First load shows the gate within 1s.
2. Typing `noise` + Enter dismisses the gate, runs the 5-command tour in order, each command visibly executing.
3. Typing into the input during the tour cancels the remaining commands silently.
4. Refresh after passing: lands directly in IDLE, no gate.
5. Open new incognito tab: gate fires fresh.
6. Typing `wrong` + Enter dismisses the gate, terminal input becomes readOnly with red border, countdown begins.
7. Random `run` commands fire approximately every 1s during possession; outputs appear in the system log.
8. Possession ends at exactly T+60s with the green release message; input re-enables.
9. Refresh during possession: lands in IDLE with no possession.
10. Mobile (responsive emulation, 375x812): gate is legible, input is focused, virtual keyboard appears.

- [ ] **Step 3: Verify edge cases from the spec**

- Type `NOISE` (uppercase) on the gate → passes.
- Type `  decay  ` (whitespace-padded) on the gate → passes.
- Press Esc on the gate → triggers possession (fail path).
- Submit empty string on the gate → triggers possession.

- [ ] **Step 4: Verify navigation during possession is unrestricted**

Fail the gate. While possession is running, click each tab in the nav (kernel, bsky, manifesto, etc.). Each tab should switch normally. Scroll the page — no input lock.

- [ ] **Step 5: Final commit (only if there were inline fixes)**

If any inline fix was needed during the smoke test:

```bash
git add <fixed files>
git commit -m "fix(gate): <specific fix description>"
```

Otherwise, no commit. The feature is complete.

---

## Self-Review Notes

**Spec coverage:**
- Prompt text + accepted answers → Task 1 ✓
- sessionStorage persistence → Task 2 ✓
- GateOverlay UI + Esc/Enter handling → Task 5 ✓
- Conditional mount on first load → Task 6 ✓
- 5-command tour with user-cancel → Task 7 ✓
- 60s possession with intrusion lines, readOnly input, countdown, release message → Task 8 ✓
- Mobile, screen reader, navigation-unrestricted edge cases → Task 9 ✓

**Type consistency:** `phantom` object has `{ typeAndSubmit, cancel }` throughout. `appendSystemLog` signature `{ time, msg, rust?, intrusion? }` matches existing log shape with new flag. `gateState` is `null | 'passed' | 'failed'` consistently.

**Open items:** Step 3 of Task 7 mentions reading the existing input ref location in App.jsx — the agent executing this plan should grep first and adapt the wiring if the input is rendered inside a child component (likely needs prop forwarding of the ref).
