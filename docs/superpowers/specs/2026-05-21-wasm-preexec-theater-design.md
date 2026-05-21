# WASM Pre-Exec Theater

**Date:** 2026-05-21
**Branch:** `main`
**Status:** Spec — pending user review
**Scope:** Inject artificial variable delay (200–450ms) + memory-address hex stream into the system log between command echo and WASM output, for both the `run` terminal path and the CRYSTALLIZE ACCORD path.

---

## Problem

WASM kernels execute in sub-millisecond time. The terminal echoes `COMMAND: run bosonic` and immediately delivers output — the computation feels weightless. The Crystallize Accord acquisition is similarly instant. Neither communicates the claimed complexity of 1536-dimensional cross-attention synthesis. The system should visibly labor before delivering results.

## Goals

1. **Visual weight on RUN.** After the command echo, a pre-exec theater phase fires: 200–450ms of artificial delay during which memory-address hex lines stream into the syslog at 30ms intervals.
2. **Visual weight on CRYSTALLIZE.** Same theater fires during the acquire flow, rendered inline below the acquire button — no dependency on the terminal syslog.
3. **Single utility.** One shared `runPreExecTheater(appendLog, durationMs)` function owns the interval + promise logic. No duplication.
4. **Hex format: memory-address style.** Lines read `0x3f8a2c19  0xd04b7e22  0x8c3f1a9d  0x7e2b0f45` — four 32-bit addresses per line, two spaces between, 8 random hex chars each.

## Non-Goals

- No change to actual WASM execution speed.
- No new UI components for the RUN path (uses existing syslog).
- No persistent storage of hex lines.
- No theater on failed commands (alias not found, RAM gate blocked) — theater only fires on confirmed valid kernel runs.

## Architecture

### Shared utility — `src/terminal/utils/preExecTheater.js` (new)

```js
// ── preExecTheater ────────────────────────────────────────────────────────────
// Injects variable artificial delay + memory-address hex stream into any log
// callback. Used for both the terminal RUN path and the LatentCollider
// CRYSTALLIZE ACCORD path.
//
// appendLog  — (line: string) => void  — called every ~30ms during delay
// durationMs — number                  — total theater duration (ms)
// returns    — Promise<void>           — resolves when duration elapses

const HEX = '0123456789abcdef';

function randHex8() {
  let s = '';
  for (let i = 0; i < 8; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

function hexLine() {
  return `0x${randHex8()}  0x${randHex8()}  0x${randHex8()}  0x${randHex8()}`;
}

export function runPreExecTheater(appendLog, durationMs) {
  return new Promise(resolve => {
    const interval = setInterval(() => appendLog(hexLine()), 30);
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, durationMs);
  });
}

export function theaterDuration() {
  return Math.floor(Math.random() * 251) + 200; // 200–450ms
}
```

- `randHex8()` — 8 random hex chars, no `0x` prefix (prefix added in `hexLine`)
- `hexLine()` — four `0x…` addresses joined by two spaces
- `runPreExecTheater` — clears interval in the `setTimeout` callback (immune to timer drift); resolves after exactly `durationMs`
- `theaterDuration()` — random int in [200, 450], called by each consumer independently

### RUN path — `src/terminal/hooks/useCommandDispatch.js`

**Import at top of file:**
```js
import { runPreExecTheater, theaterDuration } from '../utils/preExecTheater.js';
```

**Insertion point:** After the command echo (`log(`COMMAND: ${rawCmd}`)`) and after the registry lookup confirms `wasmEntry` is valid, before the WASM execution call. The theater fires *after* the command echo so the user sees their command immediately, then sees the hex stream, then sees real output.

```js
// After: log(`COMMAND: ${rawCmd}`);
// After: wasmEntry confirmed valid (not null/undefined)
// Before: WASM execution

const dur = theaterDuration();
await runPreExecTheater(
  line => log(line),
  dur,
);
// → WASM executes here
```

The existing `log` helper in `useCommandDispatch` appends to `syslog` via `appendSystemLog`. Each hex line becomes a standard log entry with the current timestamp — indistinguishable in rhythm from real output lines, just visually distinct content.

**Note:** The `run` action callback is already `async` (it contains `await wasm.instantiate()`). No async wrapper change needed.

### CRYSTALLIZE path — `src/terminal/views/LatentCollider.jsx`

**Import at top of file:**
```js
import { runPreExecTheater, theaterDuration } from '../utils/preExecTheater.js';
```

**New state** (inside `LatentCollider` component, near other acquire-related state):
```js
const [acquireLog, setAcquireLog] = useState([]);
```

**In `handleAcquire`**, immediately after `setAcquiring(true)` and before the `fetch('/api/transmute/order', …)`:
```js
setAcquireLog([]);
await runPreExecTheater(
  line => setAcquireLog(prev => [...prev, line].slice(-20)),
  theaterDuration(),
);
// → fetch('/api/transmute/order', …) here
```

`.slice(-20)` caps the log at 20 entries (max ~15 at 30ms/450ms, but defensive).

**Rendering** — below the acquire button, only while `acquiring === true`:
```jsx
{acquiring && acquireLog.length > 0 && (
  <div className="font-mono text-[9px] leading-relaxed mt-3 select-none"
       style={{ color: 'rgba(232,210,138,0.45)' }}>
    {acquireLog.map((line, i) => (
      <div key={i}>{line}</div>
    ))}
  </div>
)}
```

Color `rgba(232,210,138,0.45)` — Fade Doctrine body gold at 45% opacity, muted enough to read as process noise rather than signal.

**Cleanup:** `setAcquireLog([])` in the acquire `finally` block (after the fetch resolves/rejects), so no stale lines persist on re-trigger.

## Files Affected

| File | Status | Change |
|---|---|---|
| `src/terminal/utils/preExecTheater.js` | **New** | Shared utility: hex line generator + theater promise |
| `src/terminal/hooks/useCommandDispatch.js` | Modify | Import + `await runPreExecTheater` before WASM exec |
| `src/terminal/views/LatentCollider.jsx` | Modify | Import + `acquireLog` state + theater in `handleAcquire` + inline render |

## Edge Cases

| Case | Behavior |
|---|---|
| Command fails validation (alias not found) | Theater never fires — `wasmEntry` check comes before the await |
| RAM gate blocks | Theater never fires — gate check is before theater |
| User runs two commands before first completes | Second theater starts independently; syslog entries interleave (acceptable — terminal is single-entry-at-a-time) |
| Crystallize called twice rapidly | Second call resets `acquireLog` to `[]` and fires a fresh theater |
| Theater duration = 200ms, 30ms interval → 6-7 lines | Min case still produces visible hex stream |
| Theater duration = 450ms, 30ms interval → ~15 lines | Max case fills ~15 log lines before WASM output |
| `appendLog` throws (unlikely) | `setInterval` continues; `setTimeout` still resolves — no hang |

## Hex Line Format

```
0x3f8a2c19  0xd04b7e22  0x8c3f1a9d  0x7e2b0f45
```

- Four addresses per line
- Two spaces between addresses  
- `0x` prefix on each
- 8 lowercase hex chars each (32-bit address width)
- Fully random, non-repeating across ticks (pseudorandom via `Math.random()`)
