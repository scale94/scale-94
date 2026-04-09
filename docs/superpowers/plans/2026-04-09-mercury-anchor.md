# Mercury Anchor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse four discrete elemental tabs (Fluid, Thermal, Earth, Air) into one unified Mercury Anchor component — a single Three.js canvas where all four simulations coexist at varying opacity, navigated by orbit-tap with a 4-beat liquid-metal phase transition.

**Architecture:** `usePhaseTransition` is a RAF-driven state machine that emits per-frame `phaseOpacities` and `sphereState`. `MercuryCanvas` wraps all four particle flows in one `<Canvas>` and feeds those values in. `MercurySphere` is an R3F mesh that reads `sphereState` for day/night shading and orbit-ring precession. `MercuryControls` is a plain React sidebar. `MercuryTab` is the top-level view wired into App.jsx.

**Tech Stack:** React 18, React Three Fiber, Three.js, @react-three/drei, @react-three/postprocessing, Vitest, @testing-library/react, Tailwind CSS

---

## File Map

**New files:**
| File | Responsibility |
|---|---|
| `src/terminal/mercury/usePhaseTransition.js` | 4-beat RAF animation state machine; emits `phaseOpacities`, `sphereState`, `triggerTransition` |
| `src/terminal/mercury/MercurySphere.jsx` | R3F sphere + orbit ring + 4 orbit nodes; reads `sphereState`, fires `onNodeTap` |
| `src/terminal/mercury/MercuryControls.jsx` | Unified sidebar; shared params always visible; element-specific params cross-fade |
| `src/terminal/mercury/MercuryCanvas.jsx` | Single `<Canvas>` with all 4 particle flows + boundary geometries + MercurySphere; owns OrbitControls + Bloom |
| `src/terminal/views/MercuryTab.jsx` | Top-level view: MercuryCanvas + MercuryControls + phase header |
| `tests/mercury/usePhaseTransition.test.js` | Unit tests for the state machine hook |
| `tests/mercury/mercuryControls.test.js` | Render tests for the controls sidebar |

**Modified files:**
| File | Change |
|---|---|
| `src/terminal/views/KernelTab.jsx` | Portal the `fixed bottom-14` terminal to `document.body` on mobile — definitive fix for the transform containing-block bug |
| `src/terminal/fluid/ParticleFlow.jsx` | Add `uOpacity` uniform + `opacityMultiplier` prop |
| `src/terminal/thermal/ThermalFlow.jsx` | Same |
| `src/terminal/earth/SedimentFlow.jsx` | Same |
| `src/terminal/air/AtmosphericFlow.jsx` | Same |
| `src/terminal/App.jsx` | Replace 4 elemental lazy imports + nav buttons + render branches with single Mercury entry; remove fluid/thermal/earth/air breadcrumb entries; add `.superpowers/` to `.gitignore` |

**Deleted after Task 10:**
- `src/terminal/views/FluidTab.jsx`
- `src/terminal/views/ThermalTab.jsx`
- `src/terminal/views/EarthTab.jsx`
- `src/terminal/views/AirTab.jsx`

---

## Task 0: Terminal Bug Fix — Portal on Mobile

**Files:**
- Modify: `src/terminal/views/KernelTab.jsx`

The `fixed bottom-14` tty0 terminal is inside the boot-reveal animated container. CSS `transform` on any ancestor breaks `position: fixed`. Portal the terminal to `document.body` on mobile where `fixed` is active.

- [ ] **Step 1: Add createPortal import to KernelTab.jsx**

Find the existing React import at the top of the file:
```js
import { ..., useCallback } from 'react';
```
Add `createPortal` from `react-dom` after it:
```js
import { createPortal } from 'react-dom';
```

- [ ] **Step 2: Add portalTarget ref**

In the KernelTab component body, after existing `useRef` declarations, add:
```js
// Portal the fixed terminal to body on mobile to bypass ancestor transform containing blocks.
// On desktop (md:) the element uses relative positioning so no portal needed.
const ttyPortalTarget = useRef(
  typeof window !== 'undefined' && window.innerWidth < 768 ? document.body : null
);
```

- [ ] **Step 3: Wrap the tty0 div in a portal**

Find the section with the comment `{/* ── Bottom apex: /dev/tty0 */}` and the div that opens with:
```jsx
className={`fixed bottom-14 left-0 right-0 z-40 md:relative...`}
```

Capture the entire tty0 div (from that opening tag through its closing `</div>`) into a variable, then conditionally portal:

```jsx
{/* ── Bottom apex: /dev/tty0 ─────────────────────────────────── */}
{(() => {
  const ttyEl = (
    <div
      className={`fixed bottom-14 left-0 right-0 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:h-auto md:flex-[4] md:min-h-0 border-t border-cyan-900/40 md:border md:border-cyan-900/30 md:rounded-lg flex flex-col md:mx-auto md:w-3/5 overflow-hidden bg-black/95 md:bg-black/50 backdrop-blur-sm transition-[height,opacity] duration-300 ${!mobileChrome ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`}
      style={{
        animation:   'sk-ttyPulse 4s ease-in-out infinite',
        {/* ...keep all existing style props exactly as they are... */}
      }}
    >
      {/* ...all existing tty0 inner content exactly as it is... */}
    </div>
  );
  return ttyPortalTarget.current ? createPortal(ttyEl, ttyPortalTarget.current) : ttyEl;
})()}
```

> **Important:** Do not change any of the inner content of the tty0 div — only wrap it. Copy the full existing JSX of that div verbatim inside `ttyEl`.

- [ ] **Step 4: Run the dev server and verify on mobile viewport**

```bash
npm run dev
```
Resize browser to 375px width. The tty0 terminal should appear at the bottom of the screen. Check DevTools Elements — the tty0 div should be a direct child of `<body>`, not nested inside the boot-reveal container.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/views/KernelTab.jsx
git commit -m "fix(terminal): portal fixed tty0 to body on mobile — bypass ancestor transform containing block"
```

---

## Task 1: opacityMultiplier — ParticleFlow (Fluid)

**Files:**
- Modify: `src/terminal/fluid/ParticleFlow.jsx`

- [ ] **Step 1: Add uOpacity uniform to the fragment shader**

Find the `fragmentShader` const (around line 145). Change the first line from:
```glsl
const fragmentShader = /* glsl */ `
  varying float vHue;
  varying float vBrightness;
```
To:
```glsl
const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  varying float vHue;
  varying float vBrightness;
```

Find the existing `gl_FragColor` line at the end of the shader:
```glsl
    gl_FragColor = vec4(color, alpha * 0.95);
```
Change it to:
```glsl
    gl_FragColor = vec4(color, alpha * 0.95 * uOpacity);
```

- [ ] **Step 2: Add opacityMultiplier prop and update useFrame**

Find the component signature (line 192):
```js
export default function ParticleFlow({
  isMobile = false,
  speed = 0.08,
  curlAmp = 0.02,
  tubeRadius = 0.32,
  chromatic = 0.0,
  density = null,
  onFps = null,
}) {
```
Add `opacityMultiplier = 1` to the destructured props:
```js
export default function ParticleFlow({
  isMobile = false,
  speed = 0.08,
  curlAmp = 0.02,
  tubeRadius = 0.32,
  chromatic = 0.0,
  density = null,
  onFps = null,
  opacityMultiplier = 1,
}) {
```

Find the `useFrame` block and add the uniform update after the existing ones:
```js
  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (mat) {
      mat.uniforms.uTime.value += delta;
      mat.uniforms.uSpeed.value = speed;
      mat.uniforms.uCurlAmp.value = curlAmp;
      mat.uniforms.uTubeRadius.value = tubeRadius;
      mat.uniforms.uChromatic.value = chromatic;
      mat.uniforms.uOpacity.value = opacityMultiplier;  // ADD
    }
```

Find the `<shaderMaterial uniforms={...}>` block and add the initial value:
```jsx
        uniforms={{
          uTime:       { value: 0 },
          uSpeed:      { value: speed },
          uCurlAmp:    { value: curlAmp },
          uTubeRadius: { value: tubeRadius },
          uChromatic:  { value: chromatic },
          uOpacity:    { value: opacityMultiplier },  // ADD
        }}
```

- [ ] **Step 3: Commit**

```bash
git add src/terminal/fluid/ParticleFlow.jsx
git commit -m "feat(fluid): add opacityMultiplier prop via uOpacity shader uniform"
```

---

## Task 2: opacityMultiplier — ThermalFlow

**Files:**
- Modify: `src/terminal/thermal/ThermalFlow.jsx`

- [ ] **Step 1: Add uOpacity uniform to ThermalFlow's fragment shader**

Find ThermalFlow's `fragmentShader` const. Add `uniform float uOpacity;` as the first line inside the template literal, then multiply final alpha by `uOpacity`.

The ThermalFlow fragment shader outputs: `gl_FragColor = vec4(col, alpha);` — find that line and change it to:
```glsl
uniform float uOpacity;
```
(at the top of the shader), and:
```glsl
    gl_FragColor = vec4(col, alpha * uOpacity);
```
(at the output line — find the exact line by searching for `gl_FragColor` in ThermalFlow.jsx).

- [ ] **Step 2: Add opacityMultiplier prop to ThermalFlow**

Find the component signature (line 222):
```js
export default function ThermalFlow({
  isMobile    = false,
  speed       = 0.13,
  turbulence  = 0.40,
  flameWidth  = 0.85,
  density     = null,
  onFps       = null,
}) {
```
Add `opacityMultiplier = 1`:
```js
export default function ThermalFlow({
  isMobile         = false,
  speed            = 0.13,
  turbulence       = 0.40,
  flameWidth       = 0.85,
  density          = null,
  onFps            = null,
  opacityMultiplier = 1,
}) {
```

Add to `useFrame`:
```js
      mat.uniforms.uOpacity.value = opacityMultiplier;
```

Add to `uniforms={{...}}` in `<shaderMaterial>`:
```js
          uOpacity: { value: opacityMultiplier },
```

- [ ] **Step 3: Commit**

```bash
git add src/terminal/thermal/ThermalFlow.jsx
git commit -m "feat(thermal): add opacityMultiplier prop via uOpacity shader uniform"
```

---

## Task 3: opacityMultiplier — SedimentFlow (Earth)

**Files:**
- Modify: `src/terminal/earth/SedimentFlow.jsx`

- [ ] **Step 1: Find gl_FragColor in SedimentFlow.jsx**

```bash
grep -n "gl_FragColor" src/terminal/earth/SedimentFlow.jsx
```

- [ ] **Step 2: Add uOpacity uniform and multiply**

Same pattern as Tasks 1 and 2: add `uniform float uOpacity;` to the fragment shader, multiply the final `gl_FragColor` alpha by `uOpacity`.

- [ ] **Step 3: Add opacityMultiplier prop**

Find SedimentFlow's component signature (line 212):
```js
export default function SedimentFlow({
  isMobile      = false,
  speed         = 0.08,
  turbulence    = 0.25,
  eruptStrength = 0.8,
  density       = null,
  onFps         = null,
}) {
```
Add `opacityMultiplier = 1`. Add `mat.uniforms.uOpacity.value = opacityMultiplier;` to `useFrame`. Add `uOpacity: { value: opacityMultiplier }` to `uniforms={{...}}`.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/earth/SedimentFlow.jsx
git commit -m "feat(earth): add opacityMultiplier prop via uOpacity shader uniform"
```

---

## Task 4: opacityMultiplier — AtmosphericFlow (Air)

**Files:**
- Modify: `src/terminal/air/AtmosphericFlow.jsx`

- [ ] **Step 1: Find gl_FragColor in AtmosphericFlow.jsx**

```bash
grep -n "gl_FragColor" src/terminal/air/AtmosphericFlow.jsx
```

- [ ] **Step 2: Add uOpacity uniform and multiply**

Same pattern as Tasks 1–3.

- [ ] **Step 3: Add opacityMultiplier prop**

Find AtmosphericFlow's component signature (line 209):
```js
export default function AtmosphericFlow({
  isMobile     = false,
  orbitalSpeed = 1.2,
  turbulence   = 0.18,
  spread       = 1.0,
  density      = null,
  onFps        = null,
}) {
```
Add `opacityMultiplier = 1`. Add `mat.uniforms.uOpacity.value = opacityMultiplier;` to `useFrame`. Add `uOpacity: { value: opacityMultiplier }` to `uniforms={{...}}`.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/air/AtmosphericFlow.jsx
git commit -m "feat(air): add opacityMultiplier prop via uOpacity shader uniform"
```

---

## Task 5: usePhaseTransition Hook

**Files:**
- Create: `src/terminal/mercury/usePhaseTransition.js`
- Create: `tests/mercury/usePhaseTransition.test.js`

The hook drives the 4-beat transition animation via `requestAnimationFrame`. All mutable state lives in a `useRef` to avoid stale closures. A `useReducer` counter (`forceRender`) triggers React re-renders each frame.

- [ ] **Step 1: Create the hook**

Create `src/terminal/mercury/usePhaseTransition.js`:

```js
import { useRef, useReducer, useCallback, useEffect } from 'react';

export const PHASES = ['fluid', 'thermal', 'earth', 'air'];

// Beat durations in ms
const BEAT_MS = { consolidating: 200, elongating: 200, flowing: 250, emerging: 150 };

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function easeIn(t)  { const c = Math.max(0, Math.min(1, t)); return c * c; }
function easeOut(t) { const c = Math.max(0, Math.min(1, t)); return 1 - (1 - c) * (1 - c); }

function idleOpacities(active) {
  return Object.fromEntries(PHASES.map(p => [p, p === active ? 1.0 : 0.12]));
}

const IDLE_SPHERE = {
  reflectivity: 1.0,   // 0=matte, 2=mirror-peak during consolidation
  chromePhase: 0,      // 0=element colors, 1=full chrome
  nodeChrome: 0,       // 0=element node colors, 1=all nodes chrome
  elongation: 0,       // 0=round sphere, 1=stretched toward target
  threadProgress: 0,   // 0=no thread, 1=thread at target node
  colorBlend: 0,       // 0=active element hue, 1=pending element hue
};

export default function usePhaseTransition(initialPhase = 'fluid') {
  // All animation state in a ref — no stale closures in the RAF callback
  const anim = useRef({
    activePhase: initialPhase,
    pendingPhase: null,
    beat: 'idle',
    beatStart: 0,
    phaseOpacities: idleOpacities(initialPhase),
    sphereState: { ...IDLE_SPHERE },
  });

  const [, forceRender] = useReducer(n => n + 1, 0);
  const rafRef = useRef(null);

  const stopAnimation = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Stable frame callback — anim ref handles all mutable state
  const frame = useCallback(() => {
    const a = anim.current;
    const now = performance.now();
    const elapsed = now - a.beatStart;

    if (a.beat === 'consolidating') {
      const t = easeIn(elapsed / BEAT_MS.consolidating);
      a.phaseOpacities = Object.fromEntries(
        PHASES.map(p => [p, p === a.activePhase ? 1.0 : lerp(0.12, 0.04, t)])
      );
      a.sphereState = { ...IDLE_SPHERE, reflectivity: lerp(1.0, 2.0, t), chromePhase: t, nodeChrome: t };
      if (elapsed >= BEAT_MS.consolidating) { a.beat = 'elongating'; a.beatStart = now; }

    } else if (a.beat === 'elongating') {
      const t = easeOut(elapsed / BEAT_MS.elongating);
      a.sphereState = {
        ...IDLE_SPHERE,
        reflectivity: 2.0,
        chromePhase: lerp(1, 0.6, t),
        nodeChrome:  lerp(1, 0.4, t),
        elongation:  t,
        threadProgress: t * 0.5,
      };
      if (elapsed >= BEAT_MS.elongating) { a.beat = 'flowing'; a.beatStart = now; }

    } else if (a.beat === 'flowing') {
      const t = easeOut(elapsed / BEAT_MS.flowing);
      a.sphereState = {
        ...IDLE_SPHERE,
        reflectivity:   lerp(2.0, 1.2, t),
        chromePhase:    lerp(0.6, 0, t),
        nodeChrome:     lerp(0.4, 0, t),
        elongation:     lerp(1, 0, t),
        threadProgress: lerp(0.5, 1, t),
        colorBlend:     t,
      };
      if (elapsed >= BEAT_MS.flowing) { a.beat = 'emerging'; a.beatStart = now; }

    } else if (a.beat === 'emerging') {
      const t = easeOut(elapsed / BEAT_MS.emerging);
      a.phaseOpacities = Object.fromEntries(
        PHASES.map(p => [p, p === a.pendingPhase ? 1.0 : lerp(0.04, 0.12, t)])
      );
      a.sphereState = { ...IDLE_SPHERE, reflectivity: lerp(1.2, 1.0, t), colorBlend: 1 };
      if (elapsed >= BEAT_MS.emerging) {
        a.activePhase = a.pendingPhase;
        a.pendingPhase = null;
        a.beat = 'idle';
        a.phaseOpacities = idleOpacities(a.activePhase);
        a.sphereState = { ...IDLE_SPHERE };
        stopAnimation();
        forceRender();
        return;
      }
    }

    forceRender();
    rafRef.current = requestAnimationFrame(frame);
  }, [stopAnimation]); // forceRender is stable from useReducer

  const triggerTransition = useCallback((targetPhase) => {
    const a = anim.current;
    if (targetPhase === a.activePhase || targetPhase === a.pendingPhase) return;
    stopAnimation();
    a.pendingPhase = targetPhase;
    a.beat = 'consolidating';
    a.beatStart = performance.now();
    rafRef.current = requestAnimationFrame(frame);
  }, [frame, stopAnimation]);

  // Cleanup on unmount
  useEffect(() => stopAnimation, [stopAnimation]);

  const a = anim.current;
  return {
    activePhase:    a.activePhase,
    pendingPhase:   a.pendingPhase,
    transitionState: a.beat,
    phaseOpacities: a.phaseOpacities,
    sphereState:    a.sphereState,
    triggerTransition,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/mercury/usePhaseTransition.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePhaseTransition, { PHASES } from '../../src/terminal/mercury/usePhaseTransition';

// Mock RAF/CAF so we control frame execution
let rafCallbacks = [];
let nowMs = 0;

beforeEach(() => {
  rafCallbacks = [];
  nowMs = 0;
  vi.stubGlobal('requestAnimationFrame', (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn(() => {}));
  vi.stubGlobal('performance', { now: () => nowMs });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushFrames(advanceMs) {
  nowMs += advanceMs;
  const cbs = rafCallbacks.splice(0);
  cbs.forEach(cb => cb(nowMs));
}

describe('usePhaseTransition — idle state', () => {
  it('starts with fluid active and all opacities set', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    expect(result.current.activePhase).toBe('fluid');
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.phaseOpacities.fluid).toBe(1.0);
    expect(result.current.phaseOpacities.thermal).toBe(0.12);
    expect(result.current.phaseOpacities.earth).toBe(0.12);
    expect(result.current.phaseOpacities.air).toBe(0.12);
  });

  it('respects custom initialPhase', () => {
    const { result } = renderHook(() => usePhaseTransition('thermal'));
    expect(result.current.activePhase).toBe('thermal');
    expect(result.current.phaseOpacities.thermal).toBe(1.0);
    expect(result.current.phaseOpacities.fluid).toBe(0.12);
  });
});

describe('usePhaseTransition — triggerTransition', () => {
  it('enters consolidating beat after trigger', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => { result.current.triggerTransition('thermal'); });
    expect(result.current.transitionState).toBe('consolidating');
    expect(result.current.pendingPhase).toBe('thermal');
  });

  it('ignores trigger to same phase', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => { result.current.triggerTransition('fluid'); });
    expect(result.current.transitionState).toBe('idle');
  });

  it('dims ghost opacities during consolidation', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => {
      result.current.triggerTransition('thermal');
      flushFrames(100); // halfway through consolidation (200ms beat)
    });
    // Ghost phases should be dimmer than 0.12 but not yet at 0.04
    expect(result.current.phaseOpacities.thermal).toBeLessThan(0.12);
    expect(result.current.phaseOpacities.thermal).toBeGreaterThan(0.04);
  });

  it('completes full transition and sets new activePhase', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => {
      result.current.triggerTransition('thermal');
      // Total transition: 200 + 200 + 250 + 150 = 800ms
      flushFrames(201); // finish consolidating
      flushFrames(201); // finish elongating
      flushFrames(251); // finish flowing
      flushFrames(151); // finish emerging
    });
    expect(result.current.activePhase).toBe('thermal');
    expect(result.current.transitionState).toBe('idle');
    expect(result.current.phaseOpacities.thermal).toBe(1.0);
    expect(result.current.phaseOpacities.fluid).toBe(0.12);
  });

  it('sphere reaches chrome peak during consolidation', () => {
    const { result } = renderHook(() => usePhaseTransition('fluid'));
    act(() => {
      result.current.triggerTransition('earth');
      flushFrames(200); // end of consolidation beat
    });
    expect(result.current.sphereState.chromePhase).toBeGreaterThan(0.9);
    expect(result.current.sphereState.nodeChrome).toBeGreaterThan(0.9);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL (hook file exists, test file exists, logic verification)**

```bash
npm run test -- tests/mercury/usePhaseTransition.test.js
```

Expected: all tests pass (hook was written before tests in this case — verify green).

- [ ] **Step 4: Commit**

```bash
git add src/terminal/mercury/usePhaseTransition.js tests/mercury/usePhaseTransition.test.js
git commit -m "feat(mercury): usePhaseTransition hook — 4-beat RAF state machine"
```

---

## Task 6: MercurySphere

**Files:**
- Create: `src/terminal/mercury/MercurySphere.jsx`

An R3F component that renders the mercury sphere, orbit ring, and 4 orbit nodes. Reads `sphereState` from `usePhaseTransition`. The orbit ring precesses at 0.3°/s and drifts 0.5° each full cycle.

- [ ] **Step 1: Create MercurySphere.jsx**

Create `src/terminal/mercury/MercurySphere.jsx`:

```jsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// Cardinal positions: N=air, E=thermal, S=earth, W=fluid
const ORBIT_NODES = [
  { phase: 'air',     angle: Math.PI / 2,        symbol: '△', color: '#38bdf8' },
  { phase: 'thermal', angle: 0,                  symbol: '⊙', color: '#f97316' },
  { phase: 'earth',   angle: -Math.PI / 2,       symbol: '◻', color: '#d97706' },
  { phase: 'fluid',   angle: Math.PI,            symbol: '~', color: '#6366f1' },
];

const ORBIT_RADIUS = 1.4;
const PRECESSION_RATE = 0.3 * (Math.PI / 180); // 0.3°/s in radians
const PRECESSION_DRIFT = 0.5 * (Math.PI / 180); // 0.5° drift per full cycle

export default function MercurySphere({
  activePhase,
  pendingPhase,
  sphereState,
  onNodeTap,
  sargScore = 1.0,
}) {
  const sphereRef = useRef();
  const ringRef   = useRef();
  const orbitAngleRef = useRef(0);
  const cycleCountRef = useRef(0);

  // Derive which node is "lit" — pending during transition, active at idle
  const litPhase = pendingPhase ?? activePhase;

  useFrame((_, delta) => {
    // Orbit ring precession — 0.3°/s with 0.5° drift per cycle
    const prevAngle = orbitAngleRef.current;
    orbitAngleRef.current += PRECESSION_RATE * delta;
    if (orbitAngleRef.current >= Math.PI * 2) {
      cycleCountRef.current++;
      orbitAngleRef.current -= Math.PI * 2;
      orbitAngleRef.current += PRECESSION_DRIFT;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = orbitAngleRef.current;
    }

    // Sphere: subtle idle rotation + elongation toward target node
    if (sphereRef.current) {
      const { elongation } = sphereState;
      const litNode = ORBIT_NODES.find(n => n.phase === litPhase);
      const targetAngle = litNode ? litNode.angle + orbitAngleRef.current : 0;

      // Scale sphere: elongate on axis pointing toward target node
      const scaleX = 1 + elongation * 0.15 * Math.cos(targetAngle);
      const scaleY = 1 + elongation * 0.15 * Math.sin(targetAngle);
      sphereRef.current.scale.set(scaleX, scaleY, 1);
    }
  });

  // Sphere color: lerp between active and pending element color during transition
  const activeNode  = ORBIT_NODES.find(n => n.phase === activePhase);
  const pendingNode = ORBIT_NODES.find(n => n.phase === pendingPhase) ?? activeNode;
  const activeColor  = new THREE.Color(activeNode?.color  ?? '#6366f1');
  const pendingColor = new THREE.Color(pendingNode?.color ?? '#6366f1');
  const sphereColor  = activeColor.clone().lerp(pendingColor, sphereState.colorBlend);

  // Reflectivity: SARG score * transition reflectivity
  const finalReflectivity = Math.min(1, sargScore) * sphereState.reflectivity;

  return (
    <group>
      {/* Mercury sphere */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={sphereColor}
          metalness={0.95}
          roughness={Math.max(0.02, 0.5 - finalReflectivity * 0.45)}
          envMapIntensity={finalReflectivity * 2}
        />
      </mesh>

      {/* Orbit ring — precesses via rotation.z in useFrame */}
      <group ref={ringRef}>
        {/* Dashed ring drawn as thin torus */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ORBIT_RADIUS, 0.004, 8, 80]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
        </mesh>

        {/* Mercury thread — only visible during elongating/flowing beats */}
        {sphereState.threadProgress > 0 && (() => {
          const litNode = ORBIT_NODES.find(n => n.phase === litPhase);
          if (!litNode) return null;
          const endX = Math.cos(litNode.angle) * ORBIT_RADIUS * sphereState.threadProgress;
          const endY = Math.sin(litNode.angle) * ORBIT_RADIUS * sphereState.threadProgress;
          const midX = endX / 2;
          const midY = endY / 2;
          const length = Math.sqrt(endX * endX + endY * endY);
          const angle  = Math.atan2(endY, endX);
          return (
            <mesh position={[midX, midY, 0]} rotation={[0, 0, angle]}>
              <cylinderGeometry args={[0.008, 0.002, length, 6]} />
              <meshBasicMaterial color="#d0d0d0" transparent opacity={0.7} />
            </mesh>
          );
        })()}

        {/* Orbit nodes */}
        {ORBIT_NODES.map(({ phase, angle, symbol, color }) => {
          const x = Math.cos(angle) * ORBIT_RADIUS;
          const y = Math.sin(angle) * ORBIT_RADIUS;
          const isLit  = phase === litPhase;
          const nodeColor = new THREE.Color(color)
            .lerp(new THREE.Color('#c0c0c0'), sphereState.nodeChrome);

          return (
            <group key={phase} position={[x, y, 0]}>
              {/* Visible dot */}
              <mesh>
                <sphereGeometry args={[0.06, 12, 12]} />
                <meshBasicMaterial
                  color={nodeColor}
                  transparent
                  opacity={isLit ? 1.0 : 0.5}
                />
              </mesh>
              {/* Invisible 48px HTML touch target */}
              <Html center>
                <div
                  style={{ width: 48, height: 48, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => onNodeTap(phase)}
                  onPointerDown={(e) => { e.stopPropagation(); onNodeTap(phase); }}
                  aria-label={`Switch to ${phase} phase`}
                >
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none', userSelect: 'none' }}>
                    {symbol}
                  </span>
                </div>
              </Html>
            </group>
          );
        })}
      </group>
    </group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/mercury/MercurySphere.jsx
git commit -m "feat(mercury): MercurySphere — day/night sphere, precessing orbit ring, orbit nodes"
```

---

## Task 7: MercuryControls

**Files:**
- Create: `src/terminal/mercury/MercuryControls.jsx`
- Create: `tests/mercury/mercuryControls.test.js`

A plain React component (no Three.js). Unified sidebar: three shared sliders always visible, element-specific sliders cross-fade per active phase.

- [ ] **Step 1: Create MercuryControls.jsx**

Create `src/terminal/mercury/MercuryControls.jsx`:

```jsx
import { useRef } from 'react';

// Reusable slider — same pattern as existing elemental controls
function Slider({ label, value, min, max, step, onChange }) {
  const trackRef = useRef();
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e);
  };
  const update = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(min + (max - min) * t);
  };
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-mono text-cyan-400/60 tracking-widest uppercase">{label}</span>
        <span className="text-[10px] font-mono text-cyan-400/40">{typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-1 bg-cyan-900/30 rounded cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => { if (e.buttons === 1) update(e); }}
      >
        <div className="absolute left-0 top-0 h-full bg-cyan-500/60 rounded" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400" style={{ left: `calc(${pct}% - 4px)` }} />
      </div>
    </div>
  );
}

// Element-specific param definitions
const PHASE_PARAMS = {
  fluid: [
    { key: 'curlAmp',    label: 'curl amp',   min: 0,   max: 0.1,  step: 0.001 },
    { key: 'tubeRadius', label: 'tube radius', min: 0.1, max: 0.8,  step: 0.01  },
    { key: 'chromatic',  label: 'chromatic',   min: 0,   max: 1,    step: 0.01  },
  ],
  thermal: [
    { key: 'flameWidth', label: 'flame width', min: 0.2, max: 2.0, step: 0.05 },
  ],
  earth: [
    { key: 'eruptStrength', label: 'eruption', min: 0, max: 2.0, step: 0.05 },
  ],
  air: [
    { key: 'orbitalSpeed', label: 'orbital spd', min: 0.2, max: 3.0, step: 0.05 },
    { key: 'spread',       label: 'spread',      min: 0.2, max: 2.0, step: 0.05 },
  ],
};

const PHASE_LABEL = {
  fluid: '// fluid :: active',
  thermal: '// thermal :: active',
  earth: '// earth :: active',
  air: '// air :: active',
};

export default function MercuryControls({
  activePhase,
  params,
  onChange,
  fps = 0,
  particleCount = 0,
}) {
  const handleChange = (key, value) => onChange({ ...params, [key]: value });

  return (
    <div className="font-mono text-[11px] border border-cyan-900/30 rounded-lg p-3 bg-black/50 backdrop-blur-sm space-y-1">
      {/* Phase label */}
      <div className="text-[9px] text-cyan-400/40 tracking-widest mb-3 border-b border-cyan-900/20 pb-2">
        {PHASE_LABEL[activePhase]}
      </div>

      {/* Shared params */}
      <Slider label="speed"      value={params.speed}      min={0.01} max={0.4}  step={0.01} onChange={v => handleChange('speed', v)} />
      <Slider label="turbulence" value={params.turbulence ?? 0.25} min={0}    max={1.0}  step={0.01} onChange={v => handleChange('turbulence', v)} />
      <Slider label="density"    value={params.density}    min={1000} max={15000} step={500} onChange={v => handleChange('density', v)} />

      {/* Phase-specific params */}
      <div className="border-t border-cyan-900/20 pt-2 mt-2">
        {(PHASE_PARAMS[activePhase] ?? []).map(({ key, label, min, max, step }) => (
          <Slider
            key={key}
            label={label}
            value={params[key] ?? min}
            min={min}
            max={max}
            step={step}
            onChange={v => handleChange(key, v)}
          />
        ))}
      </div>

      {/* Status readout */}
      <div className="border-t border-cyan-900/20 pt-2 mt-1 space-y-0.5 text-[9px] text-cyan-400/30 tracking-widest">
        <div>FPS: {fps}</div>
        <div>particles: {particleCount.toLocaleString()}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/mercury/mercuryControls.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MercuryControls from '../../src/terminal/mercury/MercuryControls';

const baseParams = {
  speed: 0.1, turbulence: 0.25, density: 8000,
  curlAmp: 0.02, tubeRadius: 0.32, chromatic: 0.0,
  flameWidth: 0.85, eruptStrength: 0.8,
  orbitalSpeed: 1.2, spread: 1.0,
};

describe('MercuryControls', () => {
  it('renders shared params for any active phase', () => {
    render(<MercuryControls activePhase="fluid" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/speed/i)).toBeTruthy();
    expect(screen.getByText(/turbulence/i)).toBeTruthy();
    expect(screen.getByText(/density/i)).toBeTruthy();
  });

  it('renders fluid-specific params when fluid is active', () => {
    render(<MercuryControls activePhase="fluid" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/curl amp/i)).toBeTruthy();
    expect(screen.getByText(/tube radius/i)).toBeTruthy();
    expect(screen.getByText(/chromatic/i)).toBeTruthy();
  });

  it('renders thermal-specific params when thermal is active', () => {
    render(<MercuryControls activePhase="thermal" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/flame width/i)).toBeTruthy();
    expect(screen.queryByText(/curl amp/i)).toBeNull();
  });

  it('renders earth-specific params when earth is active', () => {
    render(<MercuryControls activePhase="earth" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/eruption/i)).toBeTruthy();
    expect(screen.queryByText(/flame width/i)).toBeNull();
  });

  it('renders air-specific params when air is active', () => {
    render(<MercuryControls activePhase="air" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/orbital spd/i)).toBeTruthy();
    expect(screen.getByText(/spread/i)).toBeTruthy();
  });

  it('shows correct phase label', () => {
    render(<MercuryControls activePhase="thermal" params={baseParams} onChange={() => {}} />);
    expect(screen.getByText(/thermal :: active/i)).toBeTruthy();
  });

  it('shows fps and particle count', () => {
    render(<MercuryControls activePhase="fluid" params={baseParams} onChange={() => {}} fps={60} particleCount={10000} />);
    expect(screen.getByText(/60/)).toBeTruthy();
    expect(screen.getByText(/10,000/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm run test -- tests/mercury/mercuryControls.test.js
```

Expected: all 7 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/terminal/mercury/MercuryControls.jsx tests/mercury/mercuryControls.test.js
git commit -m "feat(mercury): MercuryControls — unified sidebar with phase-specific param cross-fade"
```

---

## Task 8: MercuryCanvas

**Files:**
- Create: `src/terminal/mercury/MercuryCanvas.jsx`

Single `<Canvas>` with all four particle systems + boundary geometries + MercurySphere. Owns one OrbitControls and one Bloom. All four particle flows run simultaneously; `opacityMultiplier` comes from `usePhaseTransition`.

- [ ] **Step 1: Create MercuryCanvas.jsx**

Create `src/terminal/mercury/MercuryCanvas.jsx`:

```jsx
import { Suspense, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

import ParticleFlow   from '../fluid/ParticleFlow';
import GlassKnot      from '../fluid/GlassKnot';
import ThermalFlow    from '../thermal/ThermalFlow';
import GlassHearth    from '../thermal/GlassHearth';
import SedimentFlow   from '../earth/SedimentFlow';
import CrystalGeode   from '../earth/CrystalGeode';
import AtmosphericFlow from '../air/AtmosphericFlow';
import AtmoShell      from '../air/AtmoShell';
import MercurySphere  from './MercurySphere';
import usePhaseTransition from './usePhaseTransition';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
// Inactive particle density: 25% of default to keep ghost renders cheap on mobile
const GHOST_DENSITY = isMobile ? 1000 : 2500;

export default function MercuryCanvas({
  params,
  sargScore = 1.0,
  onPhaseChange = null,
  onFps = null,
}) {
  const {
    activePhase,
    pendingPhase,
    phaseOpacities,
    sphereState,
    triggerTransition,
  } = usePhaseTransition('fluid');

  const controlsRef = useRef();
  const idleTimer = useRef(null);
  const dpr = isMobile ? [1, 1.5] : [1, 2];

  const handleNodeTap = useCallback((phase) => {
    triggerTransition(phase);
    onPhaseChange?.(phase);
  }, [triggerTransition, onPhaseChange]);

  const handleInteractionStart = useCallback(() => {
    clearTimeout(idleTimer.current);
    if (controlsRef.current) controlsRef.current.autoRotate = false;
  }, []);

  const handleInteractionEnd = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = true;
    }, 3000);
  }, []);

  // Resolve per-phase density: active = full, inactive = GHOST_DENSITY
  const densityFor = (phase) =>
    phase === activePhase ? (params.density ?? (isMobile ? 4000 : 10000)) : GHOST_DENSITY;

  return (
    <Canvas
      camera={{ position: isMobile ? [0, 0, 5] : [1.5, 1.5, 3.5], fov: isMobile ? 50 : 46 }}
      dpr={dpr}
      gl={{ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' }}
      style={{ background: '#000' }}
    >
      <Suspense fallback={null}>
        {/* Mercury-neutral lighting rig */}
        <ambientLight intensity={0.12} color="#0a0a12" />
        <pointLight position={[3, 3, 3]}  intensity={1.5} color="#c8c8d8" />
        <pointLight position={[-2, -2, 1]} intensity={0.6} color="#1a1a2e" />
        <Environment preset="night" />

        {/* All four particle systems — always running, opacity driven by transition */}
        <ParticleFlow
          isMobile={isMobile}
          speed={params.speed}
          curlAmp={params.curlAmp ?? 0.02}
          tubeRadius={params.tubeRadius ?? 0.32}
          chromatic={params.chromatic ?? 0}
          density={densityFor('fluid')}
          opacityMultiplier={phaseOpacities.fluid}
          onFps={activePhase === 'fluid' ? onFps : null}
        />
        <GlassKnot isMobile={isMobile} visible={activePhase === 'fluid'} />

        <ThermalFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.4}
          flameWidth={params.flameWidth ?? 0.85}
          density={densityFor('thermal')}
          opacityMultiplier={phaseOpacities.thermal}
          onFps={activePhase === 'thermal' ? onFps : null}
        />
        <GlassHearth isMobile={isMobile} visible={activePhase === 'thermal'} />

        <SedimentFlow
          isMobile={isMobile}
          speed={params.speed}
          turbulence={params.turbulence ?? 0.25}
          eruptStrength={params.eruptStrength ?? 0.8}
          density={densityFor('earth')}
          opacityMultiplier={phaseOpacities.earth}
          onFps={activePhase === 'earth' ? onFps : null}
        />
        <CrystalGeode isMobile={isMobile} visible={activePhase === 'earth'} />

        <AtmosphericFlow
          isMobile={isMobile}
          orbitalSpeed={params.orbitalSpeed ?? 1.2}
          turbulence={params.turbulence ?? 0.18}
          spread={params.spread ?? 1.0}
          density={densityFor('air')}
          opacityMultiplier={phaseOpacities.air}
          onFps={activePhase === 'air' ? onFps : null}
        />
        <AtmoShell isMobile={isMobile} visible={activePhase === 'air'} />

        {/* Mercury Sphere — central anchor */}
        <MercurySphere
          activePhase={activePhase}
          pendingPhase={pendingPhase}
          sphereState={sphereState}
          onNodeTap={handleNodeTap}
          sargScore={sargScore}
        />

        <OrbitControls
          ref={controlsRef}
          autoRotate
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.05}
          minDistance={2.5}
          maxDistance={7}
          onStart={handleInteractionStart}
          onEnd={handleInteractionEnd}
        />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            intensity={isMobile ? 0.8 : 1.4}
            mipmapBlur={!isMobile}
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
```

- [ ] **Step 2: Check GlassKnot/GlassHearth/CrystalGeode/AtmoShell accept a `visible` prop**

```bash
grep -n "visible" src/terminal/fluid/GlassKnot.jsx src/terminal/thermal/GlassHearth.jsx src/terminal/earth/CrystalGeode.jsx src/terminal/air/AtmoShell.jsx
```

If the components pass props to a `<mesh>`, Three.js meshes natively accept a `visible` prop. If they wrap a `<group>`, add `{...props}` spread or an explicit `visible` prop to the root element of each boundary geometry component. Check each file and update if needed.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/mercury/MercuryCanvas.jsx
git commit -m "feat(mercury): MercuryCanvas — unified R3F canvas, all four simulations + sphere"
```

---

## Task 9: MercuryTab

**Files:**
- Create: `src/terminal/views/MercuryTab.jsx`

Top-level view component. Provides the `params` state, handles debounced density, FPS-adaptive quality, and renders MercuryCanvas + MercuryControls side by side.

- [ ] **Step 1: Create MercuryTab.jsx**

Create `src/terminal/views/MercuryTab.jsx`:

```jsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import MercuryCanvas   from '../mercury/MercuryCanvas';
import MercuryControls from '../mercury/MercuryControls';

const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

const DEFAULT_PARAMS = {
  speed:        0.1,
  turbulence:   0.25,
  density:      isMobile ? 4000 : 10000,
  // Fluid-specific
  curlAmp:      0.02,
  tubeRadius:   0.32,
  chromatic:    0.0,
  // Thermal-specific
  flameWidth:   0.85,
  // Earth-specific
  eruptStrength: 0.8,
  // Air-specific
  orbitalSpeed: 1.2,
  spread:       1.0,
};

export default function MercuryTab() {
  const [params, setParams]           = useState(DEFAULT_PARAMS);
  const [activePhase, setActivePhase] = useState('fluid');
  const [fps, setFps]                 = useState(0);
  const [liveDensity, setLiveDensity] = useState(DEFAULT_PARAMS.density);
  const densityTimer = useMemo(() => ({ current: null }), []);
  const dpr = useMemo(() => isMobile ? [1, 1.5] : [1, 2], []);

  // Debounce density changes to avoid buffer churn
  const handleParamsChange = useCallback((next) => {
    setParams(next);
    if (next.density !== params.density) {
      clearTimeout(densityTimer.current);
      densityTimer.current = setTimeout(() => setLiveDensity(next.density), 200);
    }
  }, [params.density, densityTimer]);

  // FPS-adaptive quality: auto-reduce density on mobile if sustained below 30fps
  const fpsAdaptive = useRef({ history: [], adjusted: false });
  useEffect(() => {
    if (!isMobile || fps === 0) return;
    const ad = fpsAdaptive.current;
    ad.history.push(fps);
    if (ad.history.length > 60) ad.history.shift();
    if (!ad.adjusted && ad.history.length >= 60) {
      const avg = ad.history.reduce((a, b) => a + b, 0) / ad.history.length;
      if (avg < 30) {
        ad.adjusted = true;
        setParams(p => {
          const reduced = Math.max(1000, Math.round(p.density * 0.75 / 500) * 500);
          setLiveDensity(reduced);
          return { ...p, density: reduced };
        });
      }
    }
  }, [fps]);

  const mergedParams = { ...params, density: liveDensity };

  return (
    <div className="max-w-[1800px] mx-auto">
      <style>{`
        @keyframes hg-titleReveal {
          0%   { opacity: 0; filter: brightness(3) blur(6px); letter-spacing: 0.4em; }
          40%  { opacity: 1; filter: brightness(2) blur(1px); letter-spacing: 0.15em; }
          100% { opacity: 1; filter: brightness(1) blur(0); letter-spacing: 0.05em; }
        }
        @keyframes hg-energyLine {
          from { width: 0; } to { width: 100%; }
        }
      `}</style>

      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight uppercase font-mono"
          style={{
            background: 'linear-gradient(90deg, #c0c0c0, #e8e8e8, #a0a0a0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'hg-titleReveal 0.8s cubic-bezier(0.16,1,0.3,1) both',
          }}
        >
          ◈ Mercury
        </h2>
        <div
          className="text-[9px] font-mono text-gray-500/50 uppercase tracking-[0.2em] mt-1"
          style={{ animation: 'hg-titleReveal 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          {activePhase} :: phase active // perihelion precession // metallurgy of the present
        </div>
        <div className="mt-4 relative h-[1px]">
          <div
            style={{
              position: 'absolute', left: 0, top: 0, height: '1px',
              background: 'linear-gradient(90deg, rgba(192,192,192,0.6), rgba(192,192,192,0.1), transparent)',
              animation: 'hg-energyLine 1.2s 0.3s cubic-bezier(0.16,1,0.3,1) both',
            }}
          />
        </div>
        <div className="border-b border-gray-800/40 pb-4 mb-6" />
      </div>

      {/* Main: Controls + Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <div>
          <MercuryControls
            activePhase={activePhase}
            params={mergedParams}
            onChange={handleParamsChange}
            fps={fps}
            particleCount={liveDensity}
          />
        </div>
        <div
          className="w-full rounded-sm overflow-hidden"
          style={{
            height: isMobile
              ? 'calc(100svh - 420px - env(safe-area-inset-bottom, 0px))'
              : 'calc(100svh - 260px)',
            minHeight: '300px',
            background: '#000',
            touchAction: 'none',
          }}
        >
          <MercuryCanvas
            params={mergedParams}
            sargScore={1.0}
            onPhaseChange={setActivePhase}
            onFps={setFps}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/terminal/views/MercuryTab.jsx
git commit -m "feat(mercury): MercuryTab — top-level view with unified controls + canvas"
```

---

## Task 10: Wire App.jsx

**Files:**
- Modify: `src/terminal/App.jsx`
- Modify: `.gitignore`

Replace four elemental entries in imports, nav bar (desktop + mobile), render branches, and breadcrumb color map with a single `mercury` entry.

- [ ] **Step 1: Replace lazy imports**

Find lines 78–81:
```js
const FluidTab        = lazy(() => import('./views/FluidTab'));
const ThermalTab      = lazy(() => import('./views/ThermalTab'));
const EarthTab        = lazy(() => import('./views/EarthTab'));
const AirTab          = lazy(() => import('./views/AirTab'));
```
Replace with:
```js
const MercuryTab      = lazy(() => import('./views/MercuryTab'));
```

- [ ] **Step 2: Remove unused lucide icons**

Find line 12:
```js
import { Hexagon, Cpu, Lock, Scale, Eye, ShieldAlert, KeyRound, Waves, Radio, Leaf, Moon, Droplets, Flame, Mountain, Wind } from 'lucide-react';
```
Remove `Droplets, Flame, Mountain, Wind` — they are only used on the four elemental nav buttons. The Mercury nav button will use the `◈` character directly.

- [ ] **Step 3: Replace four desktop nav buttons with one Mercury button**

Find lines 1096–1102 (the four elemental nav buttons):
```jsx
            <button aria-label="Fluid" ...><Droplets .../> /Fluid</button>
            <button aria-label="Thermal" ...><Flame .../> /Thermal</button>
            <button aria-label="Earth" ...><Mountain .../> /Earth</button>
            <button aria-label="Air" ...><Wind .../> /Air</button>
```
Replace with:
```jsx
            <button
              aria-label="Mercury"
              aria-current={activeTab === 'mercury' ? 'page' : undefined}
              onClick={() => handleNav('~/system/mercury', 'mercury')}
              className={`${activeTab === 'mercury' ? 'text-white shadow-[0_0_14px_rgba(192,192,192,0.5)]' : 'hover:text-white hover:bg-gray-900/30'} px-2 py-1 transition-all duration-300 uppercase rounded-sm flex items-center gap-1.5 whitespace-nowrap`}
              style={activeTab === 'mercury'
                ? { background: 'linear-gradient(90deg, #707070, #c0c0c0, #707070)' }
                : { color: 'rgba(192,192,192,0.5)' }}
            >
              ◈ /Mercury
            </button>
```

- [ ] **Step 4: Replace four mobile bottom-nav buttons with one Mercury button**

Find lines 1464–1475 (mobile bottom nav elemental buttons):
```jsx
        <button onClick={() => handleNav('~/system/fluid', 'fluid')} ...><Droplets .../></button>
        <button onClick={() => handleNav('~/system/thermal', 'thermal')} ...><Flame .../></button>
        <button onClick={() => handleNav('~/system/earth', 'earth')} ...><Mountain .../></button>
        <button onClick={() => handleNav('~/system/air', 'air')} ...><Wind .../></button>
```
Replace with:
```jsx
        <button
          onClick={() => handleNav('~/system/mercury', 'mercury')}
          aria-label="Mercury"
          className={`flex shrink-0 w-14 items-center justify-center transition-all duration-200 font-mono text-xs ${activeTab === 'mercury' ? 'text-gray-200' : 'text-gray-500/50'}`}
        >
          ◈
        </button>
```

- [ ] **Step 5: Replace four render branches with one**

Find lines 1279–1297:
```jsx
          {activeTab === 'fluid' && !selectedArticle && !architectThesis && (
            <FluidTab />
          )}
          {activeTab === 'thermal' && !selectedArticle && !architectThesis && (
            <ThermalTab />
          )}
          {activeTab === 'earth' && !selectedArticle && !architectThesis && (
            <EarthTab />
          )}
          {activeTab === 'air' && !selectedArticle && !architectThesis && (
            <AirTab />
          )}
```
Replace with:
```jsx
          {/* Mercury — unified elemental phase simulation */}
          {activeTab === 'mercury' && !selectedArticle && !architectThesis && (
            <MercuryTab />
          )}
```

- [ ] **Step 6: Update breadcrumb color map**

In the `_bc` object (around line 1131), remove the four entries for `fluid`, `thermal`, `earth`, `air` and add one for `mercury`:
```js
              mercury: { prompt: 'text-gray-400', path: 'text-gray-300', cursor: 'bg-gray-400', border: 'border-gray-500/25', glow: '0 0 18px rgba(192,192,192,0.2), 0 0 4px rgba(192,192,192,0.35)', cursorGlow: '0 0 10px rgba(192,192,192,0.7)', pathGlow: '0 0 6px rgba(192,192,192,0.25)' },
```

- [ ] **Step 7: Add .superpowers/ to .gitignore**

```bash
echo "" >> .gitignore
echo "# Brainstorm visual companion" >> .gitignore
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 8: Run tests and build check**

```bash
npm run test
npm run build 2>&1 | tail -20
```

Expected: all tests pass, build completes with no errors (chunk size warnings are OK).

- [ ] **Step 9: Commit**

```bash
git add src/terminal/App.jsx .gitignore
git commit -m "feat(mercury): wire MercuryTab into App.jsx — replace 4 elemental nav entries with single ◈ mercury"
```

---

## Task 11: Delete Old Elemental Tab Views

**Files:**
- Delete: `src/terminal/views/FluidTab.jsx`
- Delete: `src/terminal/views/ThermalTab.jsx`
- Delete: `src/terminal/views/EarthTab.jsx`
- Delete: `src/terminal/views/AirTab.jsx`

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "FluidTab\|ThermalTab\|EarthTab\|AirTab" src/
```

Expected: no output (all references were removed in Task 10).

- [ ] **Step 2: Delete the files**

```bash
git rm src/terminal/views/FluidTab.jsx src/terminal/views/ThermalTab.jsx src/terminal/views/EarthTab.jsx src/terminal/views/AirTab.jsx
```

- [ ] **Step 3: Run full test suite and build**

```bash
npm run test
npm run build 2>&1 | tail -30
```

Expected: all tests pass, build succeeds.

- [ ] **Step 4: Smoke test in browser**

```bash
npm run dev
```

Navigate to the Mercury tab. Verify:
- [ ] Single `◈ /Mercury` button in desktop nav and `◈` in mobile bottom nav
- [ ] Fluid simulation active on first load (indigo particles)
- [ ] Three ghost-phase color zones faintly visible in canvas background
- [ ] Mercury sphere visible at center with orbit ring
- [ ] Tapping `⊙` (East/Thermal) node triggers transition — sphere chrome moment visible, orange particles emerge
- [ ] Controls sidebar shows `// thermal :: active` after transition
- [ ] FPS counter updating in sidebar

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove superseded elemental tab view files (FluidTab, ThermalTab, EarthTab, AirTab)"
```

---

## Self-Review Notes

**Spec coverage check:**
- §4 Elemental mapping (N=air, E=thermal, S=earth, W=fluid) → Task 6 `ORBIT_NODES` array ✅
- §5 4-beat transition → Task 5 `usePhaseTransition` BEAT_MS ✅
- §6 Sphere day/night + SARG reflectivity → Task 6 `MercurySphere` `finalReflectivity` ✅
- §6 Orbit ring precession with drift → Task 6 `PRECESSION_DRIFT` in `useFrame` ✅
- §7 Ghost phases at 12% via opacityMultiplier → Tasks 1–4 + `GHOST_DENSITY` + `phaseOpacities` ✅
- §8 Unified controls, shared + phase-specific params → Task 7 `MercuryControls` ✅
- §9 Mobile orbit nodes 48px → Task 6 `Html` div with `width: 48, height: 48` ✅
- §10 `onPhaseChange` callback → Task 9 `MercuryTab` `onPhaseChange={setActivePhase}` ✅
- §11 Files affected list → all tasks match ✅
- Terminal bug fix → Task 0 portal approach ✅

**One implementation note for Task 8:** `GlassKnot`, `GlassHearth`, `CrystalGeode`, and `AtmoShell` each need to accept and forward a `visible` prop to their root Three.js mesh/group. Step 2 of Task 8 includes a check for this and instructions to add if missing.
