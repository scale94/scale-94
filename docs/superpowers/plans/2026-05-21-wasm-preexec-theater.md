# WASM Pre-Exec Theater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inject 200–450ms artificial delay + memory-address hex stream into the system log between WASM_BOOT metadata and real output, for both the terminal `run` path and the LatentCollider CRYSTALLIZE ACCORD path.

**Architecture:** A single shared `preExecTheater.js` utility drives both paths. The `runPreExecTheater(appendLog, durationMs)` function fires a 30ms interval emitting `0x…` hex address lines into any log callback, resolving after `durationMs`. The RUN path inserts an `await` inside the existing async IIFE in `useCommandDispatch.js`, after `loadWasm()` and before `performance.now()`. The CRYSTALLIZE path adds `acquiring`/`acquireLog` state to `LatentCollider`, runs the theater before `fetch`, and renders the log inline.

**Tech Stack:** React 18, ES modules (Vite), `Math.random()` for pseudorandom hex

---

## File Map

| File | Status | Role |
|---|---|---|
| `src/terminal/utils/preExecTheater.js` | **New** | Shared utility: hex line generator + theater promise |
| `src/terminal/hooks/useCommandDispatch.js` | Modify | `await runPreExecTheater` after `loadWasm()`, before `t0` |
| `src/terminal/views/LatentCollider.jsx` | Modify | `acquiring`/`acquireLog` state, theater in `handleAcquire`, inline render |

---

### Task 1: Create `src/terminal/utils/preExecTheater.js`

**Files:**
- Create: `src/terminal/utils/preExecTheater.js`

- [ ] **Step 1: Create the file**

Write this exact content to `F:\scale_9.4\src\terminal\utils\preExecTheater.js`:

```js
// ── preExecTheater ────────────────────────────────────────────────────────────
// Injects variable artificial delay + memory-address hex stream into any log
// callback. Shared by the terminal RUN path and the LatentCollider CRYSTALLIZE
// ACCORD path.
//
// appendLog  — (line: string) => void  — called every ~30ms during delay
// durationMs — number                  — total theater duration in ms
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

/**
 * Runs the pre-execution theater: streams hex address lines into `appendLog`
 * every 30ms for `durationMs` milliseconds.
 */
export function runPreExecTheater(appendLog, durationMs) {
  return new Promise(resolve => {
    const interval = setInterval(() => appendLog(hexLine()), 30);
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, durationMs);
  });
}

/**
 * Returns a random integer in [200, 450] for use as theater duration.
 * Called independently by each consumer so RUN and CRYSTALLIZE get different durations.
 */
export function theaterDuration() {
  return Math.floor(Math.random() * 251) + 200;
}
```

- [ ] **Step 2: Verify the file exists and exports are correct**

Read `F:\scale_9.4\src\terminal\utils\preExecTheater.js` and confirm:
- `runPreExecTheater` is exported
- `theaterDuration` is exported
- `hexLine()` produces `0x` + 8 hex chars, four per line, two spaces between

- [ ] **Step 3: Commit**

```bash
git add src/terminal/utils/preExecTheater.js
git commit -m "feat: add preExecTheater utility — hex stream + variable delay"
```

---

### Task 2: Wire theater into the RUN path — `useCommandDispatch.js`

**Context:** The RUN path resolves a `wasmEntry`, logs `COMMAND: ...` and `WASM_BOOT` metadata, then enters an `(async () => { ... })()` IIFE. Inside that IIFE, `const mod = await loadWasm()` loads the WASM binary, then `const t0 = performance.now()` starts the execution timer, then the kernel function is called. The theater goes between `loadWasm()` and `t0` so: (a) the hex stream appears after "Instantiating WASM module..." in the log, and (b) `t0` still measures true WASM execution time only.

**Files:**
- Modify: `src/terminal/hooks/useCommandDispatch.js`

- [ ] **Step 1: Add import at top of `useCommandDispatch.js`**

Find the existing imports at the top of `F:\scale_9.4\src\terminal\hooks\useCommandDispatch.js`. Add the import after the last existing import line:

```js
import { runPreExecTheater, theaterDuration } from '../utils/preExecTheater.js';
```

- [ ] **Step 2: Insert `await runPreExecTheater(...)` after `loadWasm()`**

Find this block (around line 272–276 in `useCommandDispatch.js`):

```js
        (async () => {
          try {
            // eslint-disable-next-line import/no-unresolved
            const mod = await loadWasm();

            const t0 = performance.now();
```

Change it to:

```js
        (async () => {
          try {
            // eslint-disable-next-line import/no-unresolved
            const mod = await loadWasm();

            await runPreExecTheater(line => log(line), theaterDuration());

            const t0 = performance.now();
```

The `log` helper is already in scope (defined at line ~65 as `const log = (msg, rust = false) => appendSystemLog(...)`).

- [ ] **Step 3: Verify insertion is correct**

Read lines 270–280 of `F:\scale_9.4\src\terminal\hooks\useCommandDispatch.js` and confirm `runPreExecTheater` appears between `loadWasm()` and `t0`.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/hooks/useCommandDispatch.js
git commit -m "feat(run): inject pre-exec hex theater before WASM execution"
```

---

### Task 3: Wire theater into the CRYSTALLIZE path — `LatentCollider.jsx`

**Context:** `handleAcquire` (line 1185) is an async `useCallback`. It sets `acquired = true`, does RSA-OAEP encryption, builds the order body, signs it, then fires `fetch('/api/transmute/order', …)` as fire-and-forget at line 1279. The theater goes right before the `fetch` call (line 1279), but only when `isDupe === false` (the early-return at line 1216 already gates this). Two new state values are added: `acquiring` (boolean, for conditional render) and `acquireLog` (string[], displayed inline).

**Files:**
- Modify: `src/terminal/views/LatentCollider.jsx`

- [ ] **Step 1: Add import to `LatentCollider.jsx`**

Find the existing imports at the top of `F:\scale_9.4\src\terminal\views\LatentCollider.jsx`. Add after the last import:

```js
import { runPreExecTheater, theaterDuration } from '../utils/preExecTheater.js';
```

- [ ] **Step 2: Add `acquiring` and `acquireLog` state**

Find the `acquired` state declaration (around line 1151):

```js
  const [acquired,     setAcquired]     = useState(false);
```

Add two new state declarations immediately after it:

```js
  const [acquired,     setAcquired]     = useState(false);
  const [acquiring,    setAcquiring]    = useState(false);
  const [acquireLog,   setAcquireLog]   = useState([]);
```

- [ ] **Step 3: Insert theater in `handleAcquire` before the `fetch`**

In `handleAcquire` (line ~1265–1283), find this block:

```js
    // HMAC-SHA256 sign the body (Web Crypto API, timing-safe)
    let sig = '';
    try {
      const secret = import.meta.env.VITE_TRANSMUTE_WEBHOOK_SECRET;
      if (secret) {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
        );
        const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(orderBody));
        sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch { /* signing failed — send unsigned, server will accept in dev mode */ }

    fetch('/api/transmute/order', {
```

Change it to:

```js
    // HMAC-SHA256 sign the body (Web Crypto API, timing-safe)
    let sig = '';
    try {
      const secret = import.meta.env.VITE_TRANSMUTE_WEBHOOK_SECRET;
      if (secret) {
        const key = await crypto.subtle.importKey(
          'raw', new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
        );
        const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(orderBody));
        sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch { /* signing failed — send unsigned, server will accept in dev mode */ }

    // ── Pre-transmit theater ─────────────────────────────────────────────────
    setAcquiring(true);
    setAcquireLog([]);
    try {
      await runPreExecTheater(
        line => setAcquireLog(prev => [...prev, line].slice(-20)),
        theaterDuration(),
      );
    } finally {
      setAcquiring(false);
      setAcquireLog([]);
    }

    fetch('/api/transmute/order', {
```

- [ ] **Step 4: Render `acquireLog` inline — find the render location**

Find where `CrystallizeCard` and `TesseractCard` are rendered in `LatentCollider.jsx` (around lines 3188–3212). They are rendered with `onRegister={(contact, tier) => handleAcquire(crystal.id, contact, tier)}`. 

Find the JSX block that renders both cards. It will look like:

```jsx
          <CrystallizeCard
            ...
            acquired={acquired}
            ...
            onRegister={(contact, tier) => handleAcquire(crystal.id, contact, tier)}
            ...
          />
```

Immediately after the closing `/>` of whichever card is rendered last in that block, add the acquireLog display:

```jsx
          {acquiring && acquireLog.length > 0 && (
            <div
              className="font-mono text-[9px] leading-relaxed mt-3 select-none"
              style={{ color: 'rgba(232,210,138,0.45)' }}
            >
              {acquireLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
```

- [ ] **Step 5: Verify the theater fires and renders**

Start the dev server (`npm run dev`). Navigate to the Scaling tab. Run a collision to generate a crystal. Click "Register Interest" / CRYSTALLIZE. Confirm:
1. The hex address lines appear briefly below the card in muted amber
2. They disappear after ~200–450ms when the theater completes
3. The order POST still fires (check Network tab — `/api/transmute/order` request present)

- [ ] **Step 6: Commit**

```bash
git add src/terminal/views/LatentCollider.jsx
git commit -m "feat(crystallize): inject pre-transmit hex theater before order POST"
```
