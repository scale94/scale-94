# Eye Observer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ◉ Mercury eye glyph subtly observe kernel runs and align its color to the Fade Doctrine two-gold palette.

**Architecture:** Three coordinated changes: (1) replace `#FFD700` with `#e8d28a`/`#d4a82a` in `MercuryEyeIndicator.jsx`; (2) thread `lastKernelAt` timestamp state from App.jsx through `useCommandDispatch.js`; (3) wire `lastKernelAt` + `mobileChrome` into the eye component where `useEffect` hooks manage flare and deep-watch animation states.

**Tech Stack:** React 18 (hooks, functional components), CSS keyframe animations, Vite dev server.

---

## File Map

| File | Role | Change |
|---|---|---|
| `src/terminal/components/MercuryEyeIndicator.jsx` | Eye glyph component | Color realignment, new keyframes, accept `lastKernelAt` + `mobileChrome` props, add observation state |
| `src/terminal/App.jsx` | Root app — owns all state | Add `lastKernelAt` state, pass `mobileChrome` + `lastKernelAt` + `onKernelRun` to dispatch and eye |
| `src/terminal/hooks/useCommandDispatch.js` | Command dispatch hook | Destructure `onKernelRun` from ctx, call it after each kernel-run push |

---

### Task 1: Color realignment + new keyframes in `MercuryEyeIndicator.jsx`

**Context:** The eye currently uses `#FFD700` (pure CSS gold). The Fade Doctrine palette is `#e8d28a` (body) and `#d4a82a` (emphasis). Four new keyframes are needed: `mei-breath-deep` (dim patient presence) and `mei-flare` (kernel acknowledgment), plus updates to existing `mei-breath` and `mei-breath-active` keyframe glow values.

**Files:**
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx`

The file is 78 lines. Replace its entire contents with the color-corrected version below. (In Task 3 we will add props and animation logic on top of this.)

- [ ] **Step 1: Replace `MercuryEyeIndicator.jsx` with color-aligned version**

```jsx
// ── MercuryEyeIndicator ──────────────────────────────────────────────────────
// Persistent ◉ glyph rendered top-right across every tab. Converts Mercury's
// alien-architect frame from a *feature* of one tab into a *structural
// property* of the whole work — the observer is always watching, not just
// when you visit Mercury.
//
// Visual register:
//   • Fade Doctrine two-gold: #e8d28a (body) / #d4a82a (emphasis, Mercury active)
//   • Slow breath cycle (~11s) — subliminal presence, never demands attention
//   • On Mercury tab itself: #d4a82a palette + faster (~8s) cycle
//   • flare: brief brightness surge on kernel run (~1.8s)
//   • deep-watch: dims to near-invisible (14s cycle) after 90s without a kernel run
//
// Suppression rules (handled by parent):
//   • Hidden during BootSequence (the eye hasn't engaged yet)
//   • Hidden during Sanctuary (the still center is *outside* observation)
//   • Hidden during Breach (the player is acting, not being observed)
//   • On mobile: follows header opacity fade via mobileChrome prop

import React from 'react';

export default function MercuryEyeIndicator({ activeTab, onNavigate }) {
  const isOnMercury = activeTab === 'mercury';

  return (
    <div
      className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[80] select-none cursor-pointer group"
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
      <style>{`
        @keyframes mei-breath {
          0%, 100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
          50%      { opacity: 0.58; text-shadow: 0 0 14px rgba(232,210,138,0.50), 0 0 4px rgba(232,210,138,0.35); }
        }
        @keyframes mei-breath-active {
          0%, 100% { opacity: 0.72; text-shadow: 0 0 18px rgba(212,168,42,0.65), 0 0 6px rgba(212,168,42,0.40); }
          50%      { opacity: 0.95; text-shadow: 0 0 30px rgba(212,168,42,0.90), 0 0 10px rgba(212,168,42,0.65); }
        }
        @keyframes mei-breath-deep {
          0%, 100% { opacity: 0.15; text-shadow: 0 0 4px rgba(232,210,138,0.12); }
          50%      { opacity: 0.38; text-shadow: 0 0 10px rgba(232,210,138,0.30); }
        }
        @keyframes mei-flare {
          0%   { opacity: 0.95; text-shadow: 0 0 28px rgba(232,210,138,0.85), 0 0 8px rgba(232,210,138,0.55); }
          35%  { opacity: 0.82; text-shadow: 0 0 20px rgba(232,210,138,0.65); }
          100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
        }
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
        style={{
          color: isOnMercury ? '#d4a82a' : '#e8d28a',
          animation: isOnMercury
            ? 'mei-breath-active 8s ease-in-out infinite'
            : 'mei-breath 11s ease-in-out infinite',
        }}
      >
        ◉
      </div>
      {/* Tooltip — only on hover, very subtle */}
      <div
        className="absolute right-0 top-full mt-2 pointer-events-none opacity-0 group-hover:opacity-100"
        style={{ transition: 'opacity 0.35s ease-out 0.15s' }}
      >
        <div className="text-[9px] font-mono tracking-[0.2em] uppercase whitespace-nowrap text-right"
          style={{ color: 'rgba(232,210,138,0.75)' }}>
          OBSERVER :: alien architect
        </div>
        <div className="text-[8px] font-mono whitespace-nowrap text-right mt-0.5"
          style={{ color: 'rgba(232,210,138,0.4)' }}>
          {isOnMercury ? 'engaged here · 9.4.castle' : 'click → mercury'}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and verify color change**

```bash
npm run dev
```

Open http://localhost:5173. Navigate to any tab other than Mercury — the ◉ eye should now appear in muted aged-gold (`#e8d28a`), not bright CSS yellow. Navigate to Mercury tab — eye should shift to deeper `#d4a82a`. The hover tooltip text should also be in the same muted gold tones.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/components/MercuryEyeIndicator.jsx
git commit -m "feat: realign MercuryEyeIndicator to Fade Doctrine two-gold palette"
```

---

### Task 2: Kernel signal threading — `App.jsx` + `useCommandDispatch.js`

**Context:** The eye needs to know when a kernel run completes. `useCommandDispatch.js` is where kernel runs happen — it already pushes to `kernelRunHistoryRef` at two call sites (lines ~322 and ~335). We add `onKernelRun` to the dispatch context; when called, it updates `lastKernelAt` state in App.jsx, which is passed down to the eye.

**Files:**
- Modify: `src/terminal/App.jsx`
- Modify: `src/terminal/hooks/useCommandDispatch.js`

- [ ] **Step 1: Add `lastKernelAt` state to `App.jsx`**

In `App.jsx`, find the line with `kernelRunHistoryRef` (around line 291):

```js
const kernelRunHistoryRef = useRef([]);
```

Add `lastKernelAt` state immediately after it:

```js
const kernelRunHistoryRef = useRef([]);
const [lastKernelAt, setLastKernelAt] = useState(null);
```

(`useState` is already imported in App.jsx.)

- [ ] **Step 2: Add `onKernelRun` to the dispatch context in `App.jsx`**

Find the `useCommandDispatch({...})` call (around line 778). It currently ends with:

```js
    fusionLog, setFusionLog, kernelRunHistoryRef,
  });
```

Change it to:

```js
    fusionLog, setFusionLog, kernelRunHistoryRef,
    onKernelRun: setLastKernelAt,
  });
```

- [ ] **Step 3: Destructure `onKernelRun` in `useCommandDispatch.js`**

In `useCommandDispatch.js`, find the destructure block (around line 55–63) that ends with:

```js
      fusionLog, setFusionLog, kernelRunHistoryRef,
    } = ctxRef.current;
```

Change it to:

```js
      fusionLog, setFusionLog, kernelRunHistoryRef, onKernelRun,
    } = ctxRef.current;
```

- [ ] **Step 4: Call `onKernelRun` after each kernel push in `useCommandDispatch.js`**

There are two `kernelRunHistoryRef?.current?.push(…)` call sites. Find both and add `onKernelRun?.(Date.now())` on the line immediately after each.

**First site** (inside the `setTimeout` async output path, around line 322):

```js
                    applyEcoCost(ecoAlias);
                    kernelRunHistoryRef?.current?.push({ id: wasmEntry.id, alias: ecoAlias, t: Date.now() });
                    onKernelRun?.(Date.now());
```

**Second site** (synchronous output path, around line 335):

```js
              applyEcoCost(ecoAlias);
              kernelRunHistoryRef?.current?.push({ id: wasmEntry.id, alias: ecoAlias, t: Date.now() });
              onKernelRun?.(Date.now());
```

- [ ] **Step 5: Verify signal fires in browser console**

In `App.jsx`, temporarily add a console.log to verify signal fires:

```js
const [lastKernelAt, setLastKernelAt] = useState(null);
// TEMP: remove after verification
React.useEffect(() => { if (lastKernelAt) console.log('[eye] lastKernelAt:', lastKernelAt); }, [lastKernelAt]);
```

Run `npm run dev`. Open the terminal. Run any kernel command (e.g. `run bosonic`). Confirm `[eye] lastKernelAt: <timestamp>` appears in browser console. Then remove the temporary `useEffect`.

- [ ] **Step 6: Remove the temporary console.log and commit**

Remove the temporary `useEffect` added in Step 5. Then:

```bash
git add src/terminal/App.jsx src/terminal/hooks/useCommandDispatch.js
git commit -m "feat: thread lastKernelAt signal from kernel run to App state"
```

---

### Task 3: Eye observation behavior + mobile fade — `MercuryEyeIndicator.jsx` + `App.jsx`

**Context:** Wire `lastKernelAt` and `mobileChrome` into the eye. The eye gains three React hooks: a `flaring` state (1.8s on new kernel run), a `deepWatch` state (dims after 90s quiet), and the `mobileChrome` fade-sync. We also pass the two new props from App.jsx.

**Files:**
- Modify: `src/terminal/components/MercuryEyeIndicator.jsx`
- Modify: `src/terminal/App.jsx`

- [ ] **Step 1: Pass `mobileChrome` and `lastKernelAt` from `App.jsx` to the eye**

In `App.jsx`, find the `MercuryEyeIndicator` usage (around line 967):

```jsx
        <MercuryEyeIndicator
          activeTab={activeTab}
          onNavigate={() => handleNav('~/system/mercury', 'mercury')}
        />
```

Change it to:

```jsx
        <MercuryEyeIndicator
          activeTab={activeTab}
          onNavigate={() => handleNav('~/system/mercury', 'mercury')}
          mobileChrome={mobileChrome}
          lastKernelAt={lastKernelAt}
        />
```

- [ ] **Step 2: Replace `MercuryEyeIndicator.jsx` with full observation implementation**

Replace the entire file with:

```jsx
// ── MercuryEyeIndicator ──────────────────────────────────────────────────────
// Persistent ◉ glyph rendered top-right across every tab. Converts Mercury's
// alien-architect frame from a *feature* of one tab into a *structural
// property* of the whole work — the observer is always watching, not just
// when you visit Mercury.
//
// Color: Fade Doctrine two-gold — #e8d28a (body) / #d4a82a (Mercury active)
//
// Animation priority (highest → lowest):
//   flare      — 1.8s surge on kernel run, then hands off to breath
//   active     — on Mercury tab: faster (8s), brighter (#d4a82a)
//   deep-watch — >90s since last kernel: slower (14s), dimmer (0.15–0.38)
//   idle       — default: 11s breath (0.28–0.58)
//
// Mobile fade: follows header opacity via mobileChrome prop.
// Suppression: handled by parent (boot / sanctuary / breach).

import React, { useState, useEffect, useRef } from 'react';

export default function MercuryEyeIndicator({ activeTab, onNavigate, mobileChrome, lastKernelAt }) {
  const isOnMercury = activeTab === 'mercury';
  const [flaring,   setFlaring]   = useState(false);
  const [deepWatch, setDeepWatch] = useState(true); // true on load — no runs yet
  const prevKernelAt = useRef(null);

  // ── Flare on new kernel run ─────────────────────────────────────────────────
  useEffect(() => {
    if (!lastKernelAt || lastKernelAt === prevKernelAt.current) return;
    prevKernelAt.current = lastKernelAt;
    setFlaring(true);
    setDeepWatch(false);
    const t = setTimeout(() => setFlaring(false), 1800);
    return () => clearTimeout(t);
  }, [lastKernelAt]);

  // ── Deep-watch: dim after 90s of no kernel runs ─────────────────────────────
  useEffect(() => {
    const elapsed = lastKernelAt ? Date.now() - lastKernelAt : Infinity;
    if (elapsed >= 90_000) {
      setDeepWatch(true);
      return;
    }
    const remaining = 90_000 - elapsed;
    const t = setTimeout(() => setDeepWatch(true), remaining);
    return () => clearTimeout(t);
  }, [lastKernelAt]);

  // ── Animation priority ──────────────────────────────────────────────────────
  const animation = flaring
    ? 'mei-flare 1.8s ease-out forwards'
    : isOnMercury
      ? 'mei-breath-active 8s ease-in-out infinite'
      : deepWatch
        ? 'mei-breath-deep 14s ease-in-out infinite'
        : 'mei-breath 11s ease-in-out infinite';

  return (
    <div
      className={`fixed top-3 right-3 sm:top-4 sm:right-4 z-[80] select-none cursor-pointer group transition-opacity duration-500 ${!mobileChrome ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`}
      onClick={onNavigate}
      role="button"
      aria-label="Open Mercury — observer view"
      title="◉ OBSERVER :: alien architect engaged"
    >
      <style>{`
        @keyframes mei-breath {
          0%, 100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
          50%      { opacity: 0.58; text-shadow: 0 0 14px rgba(232,210,138,0.50), 0 0 4px rgba(232,210,138,0.35); }
        }
        @keyframes mei-breath-active {
          0%, 100% { opacity: 0.72; text-shadow: 0 0 18px rgba(212,168,42,0.65), 0 0 6px rgba(212,168,42,0.40); }
          50%      { opacity: 0.95; text-shadow: 0 0 30px rgba(212,168,42,0.90), 0 0 10px rgba(212,168,42,0.65); }
        }
        @keyframes mei-breath-deep {
          0%, 100% { opacity: 0.15; text-shadow: 0 0 4px rgba(232,210,138,0.12); }
          50%      { opacity: 0.38; text-shadow: 0 0 10px rgba(232,210,138,0.30); }
        }
        @keyframes mei-flare {
          0%   { opacity: 0.95; text-shadow: 0 0 28px rgba(232,210,138,0.85), 0 0 8px rgba(232,210,138,0.55); }
          35%  { opacity: 0.82; text-shadow: 0 0 20px rgba(232,210,138,0.65); }
          100% { opacity: 0.28; text-shadow: 0 0 6px rgba(232,210,138,0.20); }
        }
        @keyframes mei-tooltip-in {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="text-[18px] sm:text-[20px] leading-none font-black transition-transform duration-300 group-hover:scale-110"
        style={{
          color: isOnMercury ? '#d4a82a' : '#e8d28a',
          animation,
        }}
      >
        ◉
      </div>
      {/* Tooltip — only on hover, very subtle */}
      <div
        className="absolute right-0 top-full mt-2 pointer-events-none opacity-0 group-hover:opacity-100"
        style={{ transition: 'opacity 0.35s ease-out 0.15s' }}
      >
        <div className="text-[9px] font-mono tracking-[0.2em] uppercase whitespace-nowrap text-right"
          style={{ color: 'rgba(232,210,138,0.75)' }}>
          OBSERVER :: alien architect
        </div>
        <div className="text-[8px] font-mono whitespace-nowrap text-right mt-0.5"
          style={{ color: 'rgba(232,210,138,0.4)' }}>
          {isOnMercury ? 'engaged here · 9.4.castle' : 'click → mercury'}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify flare in browser**

Run `npm run dev`. Open terminal. Observe the ◉ eye — it should be dim (deep-watch state, 14s breath, low opacity) since no kernels have run yet. Run any kernel: `run bosonic`. Immediately after the kernel output appears, the ◉ eye should briefly brighten (flare, ~1.8s) then settle into the normal 11s breath. After ~90s idle it dims back to deep-watch.

- [ ] **Step 4: Verify mobile fade sync**

On a mobile viewport (or DevTools responsive mode): the eye should fade out whenever the header fades out (after ~3s idle on mobile). They should fade in sync.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/components/MercuryEyeIndicator.jsx src/terminal/App.jsx
git commit -m "feat: eye observer — kernel flare, deep-watch, mobile fade sync"
```
