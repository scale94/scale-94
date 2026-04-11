# Mercury Element Fireworks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-screen fireworks fire when a user clicks any of the four element nodes (Fire, Air, Earth, Water) on the Mercury sphere, each with a distinct doctrine-compliant burst personality.

**Architecture:** A `<canvas>` overlay (`position:absolute; inset:0; pointer-events:none; z-index:10`) is rendered inside `MercuryTab.jsx`. On node click, `MercurySphere.jsx` reports `(phase, screenX, screenY)` up the tree; `MercuryTab` forwards to `MercuryFireworks` via a `forwardRef`/`useImperativeHandle` imperative handle. A self-contained `requestAnimationFrame` loop manages all rocket and burst particles.

**Tech Stack:** React 19 (forwardRef, useImperativeHandle, useRef, useEffect), 2D Canvas API, Vitest + jsdom for pure-function tests.

---

## File Map

| Path | Role |
|------|------|
| `src/terminal/mercury/fireworksUtils.js` | **New** — pure functions: doctrine alpha, rocket/burst spawn, element palettes |
| `src/terminal/mercury/MercuryFireworks.jsx` | **New** — forwardRef canvas component + RAF loop |
| `tests/mercury/fireworksUtils.test.js` | **New** — unit tests for all pure functions |
| `src/terminal/mercury/MercurySphere.jsx` | **Modify** — add `onElementFired` prop, call it in `onPointerDown` |
| `src/terminal/mercury/MercuryCanvas.jsx` | **Modify** — accept + forward `onElementFired` prop to `MercurySphere` |
| `src/terminal/views/MercuryTab.jsx` | **Modify** — create `fireworksRef`, render `<MercuryFireworks>`, wire callback to canvas |

---

## Task 1: Pure utility functions + tests

**Files:**
- Create: `src/terminal/mercury/fireworksUtils.js`
- Create: `tests/mercury/fireworksUtils.test.js`

- [ ] **Step 1: Write failing tests for `doctrineAlpha`**

```js
// tests/mercury/fireworksUtils.test.js
import { describe, it, expect } from 'vitest';
import { doctrineAlpha, spawnRockets, spawnBurst } from '../../src/terminal/mercury/fireworksUtils';

describe('doctrineAlpha', () => {
  it('is 0 at age 0', () => {
    expect(doctrineAlpha(0, 100)).toBe(0);
  });

  it('ramps quadratically in 0–15% window', () => {
    // at t=0.075 (halfway into ramp): alpha = 0.55 * (0.5)^2 = 0.1375
    expect(doctrineAlpha(7.5, 100)).toBeCloseTo(0.1375, 3);
  });

  it('holds base alpha 0.55 at t=0.40 (middle of hold zone)', () => {
    expect(doctrineAlpha(40, 100)).toBeCloseTo(0.55, 3);
  });

  it('is culled (< 0.004) at age === lifespan', () => {
    expect(doctrineAlpha(100, 100)).toBeLessThan(0.004);
  });

  it('decays with power 2.2 in 70–100% window', () => {
    // at t=0.85: progress into decay = (0.85-0.70)/0.30 = 0.5
    // alpha = 0.55 * (1 - 0.5)^2.2 = 0.55 * 0.5^2.2 ≈ 0.55 * 0.2176 ≈ 0.1197
    expect(doctrineAlpha(85, 100)).toBeCloseTo(0.1197, 2);
  });
});
```

- [ ] **Step 2: Run — expect FAIL ("Cannot find module")**

```bash
cd F:/scale_9.4 && npx vitest run tests/mercury/fireworksUtils.test.js 2>&1 | tail -20
```

- [ ] **Step 3: Write failing tests for `spawnRockets`**

Append to `tests/mercury/fireworksUtils.test.js`:

```js
describe('spawnRockets', () => {
  it('returns 3–5 rockets', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    expect(rockets.length).toBeGreaterThanOrEqual(3);
    expect(rockets.length).toBeLessThanOrEqual(5);
  });

  it('each rocket has required fields', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    for (const r of rockets) {
      expect(r).toMatchObject({
        type: 'rocket',
        element: 'thermal',
        age: 0,
        hasExploded: false,
      });
      expect(typeof r.lifespan).toBe('number');
      expect(typeof r.apexX).toBe('number');
      expect(typeof r.apexY).toBe('number');
      expect(typeof r.delay).toBe('number');
    }
  });

  it('apex Y is in the upper 40% of screen height', () => {
    const rockets = spawnRockets('thermal', 400, 300, 800, 600);
    for (const r of rockets) {
      expect(r.apexY).toBeLessThanOrEqual(600 * 0.4);
    }
  });

  it('delays are staggered 80–150ms apart (ascending)', () => {
    const rockets = spawnRockets('fluid', 200, 400, 800, 600);
    for (let i = 1; i < rockets.length; i++) {
      const gap = rockets[i].delay - rockets[i - 1].delay;
      expect(gap).toBeGreaterThanOrEqual(80);
      expect(gap).toBeLessThanOrEqual(150);
    }
  });
});
```

- [ ] **Step 4: Write failing tests for `spawnBurst`**

Append to `tests/mercury/fireworksUtils.test.js`:

```js
describe('spawnBurst', () => {
  it('thermal → 12–18 ember particles', () => {
    const ps = spawnBurst('thermal', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(12);
    expect(ps.length).toBeLessThanOrEqual(18);
    expect(ps[0].type).toBe('ember');
  });

  it('fluid → 10–14 droplet particles', () => {
    const ps = spawnBurst('fluid', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(10);
    expect(ps.length).toBeLessThanOrEqual(14);
    expect(ps[0].type).toBe('droplet');
  });

  it('air → 2–3 ring particles', () => {
    const ps = spawnBurst('air', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(2);
    expect(ps.length).toBeLessThanOrEqual(3);
    expect(ps[0].type).toBe('ring');
  });

  it('earth → 8–12 shard particles', () => {
    const ps = spawnBurst('earth', 400, 200);
    expect(ps.length).toBeGreaterThanOrEqual(8);
    expect(ps.length).toBeLessThanOrEqual(12);
    expect(ps[0].type).toBe('shard');
  });

  it('all burst particles start at age 0 with positive lifespan', () => {
    for (const el of ['thermal', 'fluid', 'air', 'earth']) {
      const ps = spawnBurst(el, 400, 200);
      for (const p of ps) {
        expect(p.age).toBe(0);
        expect(p.lifespan).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 5: Implement `fireworksUtils.js`**

```js
// src/terminal/mercury/fireworksUtils.js

// ── Fade Doctrine alpha envelope ──────────────────────────────────────────────
// 0–15%:  quadratic ease-in
// 15–70%: hold at BASE_ALPHA
// 70–100%: power ease-out (exponent 2.2)
const BASE_ALPHA = 0.55;

export function doctrineAlpha(age, lifespan) {
  const t = age / lifespan;
  if (t >= 1) return 0;
  if (t < 0.15) {
    const r = t / 0.15;
    return BASE_ALPHA * r * r;
  }
  if (t < 0.70) return BASE_ALPHA;
  const decay = (t - 0.70) / 0.30;
  return BASE_ALPHA * Math.pow(1 - decay, 2.2);
}

// ── Element palettes (semantic — never decorative) ────────────────────────────
export const PALETTES = {
  thermal: { primary: '#f97316', secondary: ['#fbbf24', '#ef4444'] },
  fluid:   { primary: '#6366f1', secondary: ['#818cf8', '#c7d2fe'] },
  air:     { primary: '#38bdf8', secondary: ['#bae6fd', '#0ea5e9'] },
  earth:   { primary: '#d97706', secondary: ['#fbbf24', '#92400e'] },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

// ── Rocket spawn ──────────────────────────────────────────────────────────────
// Returns 3–5 rockets staggered 80–150ms apart.
// Each rocket travels from near (screenX, screenY) to a random apex
// in the upper 40% of the canvas.
export function spawnRockets(element, screenX, screenY, canvasW, canvasH) {
  const count = randInt(3, 5);
  const rockets = [];
  let delay = 0;
  for (let i = 0; i < count; i++) {
    rockets.push({
      type: 'rocket',
      element,
      // Origin: near the clicked node with ±20px jitter
      x: screenX + rand(-20, 20),
      y: screenY + rand(-20, 20),
      prevX: screenX,
      prevY: screenY,
      // Apex: random point in upper 40% of canvas
      apexX: rand(canvasW * 0.1, canvasW * 0.9),
      apexY: rand(0, canvasH * 0.40),
      age: 0,
      lifespan: randInt(60, 80),
      hasExploded: false,
      delay,         // milliseconds before this rocket activates
      color: PALETTES[element]?.primary ?? '#ffffff',
    });
    delay += rand(80, 150);
  }
  return rockets;
}

// ── Burst spawn ───────────────────────────────────────────────────────────────
// Called when a rocket reaches its apex.
export function spawnBurst(element, x, y) {
  switch (element) {
    case 'thermal': return spawnEmbers(x, y);
    case 'fluid':   return spawnDroplets(x, y);
    case 'air':     return spawnRings(x, y);
    case 'earth':   return spawnShards(x, y);
    default:        return spawnEmbers(x, y);
  }
}

// FIRE — thin ember streaks shooting narrow-upward
function spawnEmbers(x, y) {
  const count = randInt(12, 18);
  const palette = PALETTES.thermal;
  return Array.from({ length: count }, () => {
    const angle = rand(-Math.PI / 2 - Math.PI / 9, -Math.PI / 2 + Math.PI / 9); // ±20° from up
    const speed = rand(1.5, 3.5);
    return {
      type: 'ember',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drift: rand(-0.05, 0.05), // horizontal jitter per frame
      age: 0,
      lifespan: randInt(180, 240),
      primary: palette.primary,
      secondary: palette.secondary[Math.floor(Math.random() * palette.secondary.length)],
    };
  });
}

// WATER — droplets in wide parabolic fan with gravity
function spawnDroplets(x, y) {
  const count = randInt(10, 14);
  const palette = PALETTES.fluid;
  return Array.from({ length: count }, () => {
    const angle = rand(-Math.PI / 2 - Math.PI * 4 / 9, -Math.PI / 2 + Math.PI * 4 / 9); // ±80° from up
    const speed = rand(2, 4.5);
    return {
      type: 'droplet',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.08,
      radius: rand(3, 4),
      age: 0,
      lifespan: randInt(100, 140),
      color: Math.random() < 0.5 ? palette.primary : palette.secondary[Math.floor(Math.random() * palette.secondary.length)],
    };
  });
}

// AIR — 2–3 expanding concentric rings
function spawnRings(x, y) {
  const count = randInt(2, 3);
  const palette = PALETTES.air;
  return Array.from({ length: count }, (_, i) => ({
    type: 'ring',
    x, y,
    radius: 0,
    maxRadius: rand(60, 90),
    age: i * 8, // slight stagger between rings
    lifespan: randInt(60, 90),
    color: i % 2 === 0 ? palette.primary : palette.secondary[0],
  }));
}

// EARTH — chunky slow rotating shards
function spawnShards(x, y) {
  const count = randInt(8, 12);
  const palette = PALETTES.earth;
  return Array.from({ length: count }, () => {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(0.6, 1.8) * 0.6; // 0.6× normal speed
    return {
      type: 'shard',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.12,           // 1.5× normal gravity
      rotation: rand(0, Math.PI * 2),
      rotVel: rand(-0.08, 0.08),
      w: rand(4, 8),
      h: rand(3, 6),
      age: 0,
      lifespan: randInt(180, 260),
      color: [palette.primary, ...palette.secondary][Math.floor(Math.random() * 3)],
    };
  });
}
```

- [ ] **Step 6: Run tests — expect all pass**

```bash
cd F:/scale_9.4 && npx vitest run tests/mercury/fireworksUtils.test.js 2>&1 | tail -20
```

Expected: all 14 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/mercury/fireworksUtils.js tests/mercury/fireworksUtils.test.js
git commit -m "feat(mercury): add fireworks pure utility functions with doctrine alpha"
```

---

## Task 2: MercuryFireworks canvas component

**Files:**
- Create: `src/terminal/mercury/MercuryFireworks.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/terminal/mercury/MercuryFireworks.jsx
import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { doctrineAlpha, spawnRockets, spawnBurst } from './fireworksUtils';

const CULL_THRESHOLD = 0.004;

const MercuryFireworks = forwardRef(function MercuryFireworks(_, ref) {
  const canvasRef    = useRef(null);
  const particlesRef = useRef([]);   // all live particles (rockets + bursts)
  const rafRef       = useRef(null);
  const startTimes   = useRef({});   // rocketId → absolute timestamp for delay
  const nowRef       = useRef(0);    // updated each RAF frame

  // ── Expose imperative fire() handle ────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    fire(element, screenX, screenY) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rockets = spawnRockets(element, screenX, screenY, canvas.width, canvas.height);
      // Tag each rocket with an absolute activation time
      const now = performance.now();
      rockets.forEach((r, i) => {
        r._activateAt = now + r.delay;
        r._id = `${now}-${i}`;
      });
      particlesRef.current.push(...rockets);
      ensureLoop();
    },
  }));

  // ── RAF loop ────────────────────────────────────────────────────────────────
  function ensureLoop() {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(tick);
  }

  function tick(ts) {
    nowRef.current = ts;
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = null; return; }
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const next = [];
    for (const p of particlesRef.current) {
      if (p.type === 'rocket') {
        // Respect staggered delay — skip (but keep) until activation time
        if (ts < p._activateAt) { next.push(p); continue; }
        p.age++;
        const alpha = doctrineAlpha(p.age, p.lifespan);
        if (alpha < CULL_THRESHOLD && p.hasExploded) continue;

        // Interpolate position
        const progress = Math.min(p.age / p.lifespan, 1);
        const ox = p.x + (p.apexX - p.x) * (progress - 1 / p.lifespan);
        const cx = p.x + (p.apexX - p.x) * progress;
        const oy = p.y + (p.apexY - p.y) * (progress - 1 / p.lifespan);
        const cy = p.y + (p.apexY - p.y) * progress;

        // Draw trail segment
        if (alpha >= CULL_THRESHOLD) {
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          ctx.restore();
        }

        // Explode at apex
        if (!p.hasExploded && progress >= 1) {
          p.hasExploded = true;
          const burst = spawnBurst(p.element, p.apexX, p.apexY);
          particlesRef.current.push(...burst);
        }

        if (!p.hasExploded || alpha >= CULL_THRESHOLD) next.push(p);
        continue;
      }

      // ── Burst particles ──────────────────────────────────────────────────
      p.age++;
      const alpha = doctrineAlpha(p.age, p.lifespan);
      if (alpha < CULL_THRESHOLD) continue; // cull

      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'ember') {
        // Advance position + drift
        p.x += p.vx;
        p.y += p.vy;
        p.vx += p.drift;
        // Color shifts primary → secondary over lifespan
        const t = p.age / p.lifespan;
        ctx.fillStyle = t < 0.5 ? p.primary : p.secondary;
        ctx.fillRect(p.x - 1, p.y - 3, 2, 6);
      }

      else if (p.type === 'droplet') {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      else if (p.type === 'ring') {
        // Expand radius toward maxRadius over lifespan
        p.radius = p.maxRadius * (p.age / p.lifespan);
        // Stroke width thins 3 → 0.5 as radius grows
        const sw = 3 - 2.5 * (p.age / p.lifespan);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(sw, 0.5);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      else if (p.type === 'shard') {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotVel;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }

      ctx.restore();
      next.push(p);
    }

    particlesRef.current = next;

    if (next.length > 0 || next.some(p => p.type === 'rocket' && !p.hasExploded)) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
  }

  // ── Canvas sizing ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
});

export default MercuryFireworks;
```

- [ ] **Step 2: Fix the RAF continuation condition (subtle bug)**

The `next.some(...)` check at the end of `tick` is wrong — `next` was already filtered. The loop should continue if `next.length > 0`:

Replace the final block in `tick`:

```js
    particlesRef.current = next;

    if (next.length > 0) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = null;
    }
```

- [ ] **Step 3: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/mercury/MercuryFireworks.jsx
git commit -m "feat(mercury): add MercuryFireworks canvas component with RAF loop"
```

---

## Task 3: Wire MercurySphere — emit onElementFired

**Files:**
- Modify: `src/terminal/mercury/MercurySphere.jsx:63-70` (props), `:285-290` (onPointerDown)

- [ ] **Step 1: Add `onElementFired` to the props destructure**

In `MercurySphere.jsx`, line 63–70, the function signature currently is:
```jsx
export default function MercurySphere({
  activePhase,
  pendingPhase,
  sphereState,
  onNodeTap,
  sargScore = 1.0,
  isMobile = false,
}) {
```

Change to:
```jsx
export default function MercurySphere({
  activePhase,
  pendingPhase,
  sphereState,
  onNodeTap,
  onElementFired,
  sargScore = 1.0,
  isMobile = false,
}) {
```

- [ ] **Step 2: Call `onElementFired` in onPointerDown**

In `MercurySphere.jsx`, the `onPointerDown` handler currently is (around line 285):
```jsx
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setPressedPhase(phase);
                    onNodeTap(phase);
                    setTimeout(() => setPressedPhase(null), 380);
                  }}
```

Change to:
```jsx
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setPressedPhase(phase);
                    onNodeTap(phase);
                    onElementFired?.(phase, e.clientX, e.clientY);
                    setTimeout(() => setPressedPhase(null), 380);
                  }}
```

- [ ] **Step 3: Run existing tests to confirm nothing broken**

```bash
cd F:/scale_9.4 && npx vitest run tests/mercury/ 2>&1 | tail -20
```

Expected: all existing mercury tests PASS.

- [ ] **Step 4: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/mercury/MercurySphere.jsx
git commit -m "feat(mercury): MercurySphere emits onElementFired on node press"
```

---

## Task 4: Wire MercuryCanvas — pass onElementFired through

**Files:**
- Modify: `src/terminal/mercury/MercuryCanvas.jsx:20-25` (props), `:126-133` (MercurySphere usage)

- [ ] **Step 1: Accept `onElementFired` in MercuryCanvas props**

Current signature (line 20–25):
```jsx
export default function MercuryCanvas({
  params,
  sargScore = 1.0,
  onPhaseChange = null,
  onFps = null,
}) {
```

Change to:
```jsx
export default function MercuryCanvas({
  params,
  sargScore = 1.0,
  onPhaseChange = null,
  onFps = null,
  onElementFired = null,
}) {
```

- [ ] **Step 2: Pass `onElementFired` to MercurySphere**

Current `<MercurySphere>` usage (line 126–133):
```jsx
        <MercurySphere
          activePhase={activePhase}
          pendingPhase={pendingPhase}
          sphereState={sphereState}
          onNodeTap={handleNodeTap}
          sargScore={sargScore}
          isMobile={isMobile}
        />
```

Change to:
```jsx
        <MercurySphere
          activePhase={activePhase}
          pendingPhase={pendingPhase}
          sphereState={sphereState}
          onNodeTap={handleNodeTap}
          onElementFired={onElementFired}
          sargScore={sargScore}
          isMobile={isMobile}
        />
```

- [ ] **Step 3: Run existing tests**

```bash
cd F:/scale_9.4 && npx vitest run tests/mercury/ 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/mercury/MercuryCanvas.jsx
git commit -m "feat(mercury): MercuryCanvas forwards onElementFired to MercurySphere"
```

---

## Task 5: Wire MercuryTab — render MercuryFireworks + connect callback

**Files:**
- Modify: `src/terminal/views/MercuryTab.jsx`

- [ ] **Step 1: Add imports**

At the top of `MercuryTab.jsx`, the existing imports are:
```jsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import MercuryCanvas   from '../mercury/MercuryCanvas';
import MercuryControls from '../mercury/MercuryControls';
```

Change to:
```jsx
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import MercuryCanvas     from '../mercury/MercuryCanvas';
import MercuryControls   from '../mercury/MercuryControls';
import MercuryFireworks  from '../mercury/MercuryFireworks';
```

- [ ] **Step 2: Add `fireworksRef` inside the component**

After the existing `const densityTimer = useMemo(...)` line, add:
```jsx
  const fireworksRef = useRef(null);
```

- [ ] **Step 3: Add `position: relative` to outer wrapper and render MercuryFireworks**

The outer return wrapper currently is:
```jsx
    <div className="max-w-[1800px] mx-auto">
```

Change to:
```jsx
    <div className="max-w-[1800px] mx-auto" style={{ position: 'relative' }}>
      <MercuryFireworks ref={fireworksRef} />
```

The closing `</div>` at the end of the return stays as-is.

- [ ] **Step 4: Pass `onElementFired` to MercuryCanvas**

Current `<MercuryCanvas>` usage (line 162–167):
```jsx
          <MercuryCanvas
            params={mergedParams}
            sargScore={1.0}
            onPhaseChange={setActivePhase}
            onFps={setFps}
          />
```

Change to:
```jsx
          <MercuryCanvas
            params={mergedParams}
            sargScore={1.0}
            onPhaseChange={setActivePhase}
            onFps={setFps}
            onElementFired={(element, screenX, screenY) =>
              fireworksRef.current?.fire(element, screenX, screenY)
            }
          />
```

- [ ] **Step 5: Run all tests**

```bash
cd F:/scale_9.4 && npx vitest run tests/mercury/ 2>&1 | tail -20
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd F:/scale_9.4 && git add src/terminal/views/MercuryTab.jsx
git commit -m "feat(mercury): wire MercuryFireworks into MercuryTab — fireworks on element click"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Full-screen canvas overlay `position:absolute; inset:0; pointer-events:none; z-index:10` | Task 2 |
| Doctrine cubic envelope alpha | Task 1, Task 2 |
| Additive blend `ctx.globalCompositeOperation = 'lighter'` | Task 2 |
| No white fills | Task 2 (no white in palettes or rendering) |
| Particle cull at alpha < 0.004 | Task 2 |
| 3–5 rockets staggered 80–150ms | Task 1, Task 2 |
| Origin near node screen position ±20px | Task 1 |
| Apex in upper 40% of screen | Task 1 |
| Fire: 12–18 embers, ±20° upward, 180–240 frame lifespan | Task 1 |
| Water: 10–14 droplets, ±80° fan, gravity, 100–140 frames | Task 1 |
| Air: 2–3 expanding rings, 60–90 frames, thinning stroke | Task 1 |
| Earth: 8–12 shards, slow (0.6×), strong gravity (1.5×), rotating, 180–260 frames | Task 1 |
| Canvas resizes with parent (ResizeObserver) | Task 2 |
| onElementFired threaded through MercurySphere → MercuryCanvas → MercuryTab | Tasks 3–5 |
| screenX/screenY from `e.clientX, e.clientY` on pointerDown | Task 3 |

All requirements covered.

**Placeholder scan:** No TBDs, TODOs, or vague steps. All code is complete.

**Type consistency:**
- `fire(element, screenX, screenY)` — matches `useImperativeHandle` definition and call site in MercuryTab
- `spawnRockets(element, screenX, screenY, canvasW, canvasH)` — matches call in `MercuryFireworks.fire()`
- `spawnBurst(element, x, y)` — matches call in `tick()` at `p.apexX, p.apexY`
- `onElementFired?.(phase, e.clientX, e.clientY)` in MercurySphere — matches `(element, screenX, screenY) => fireworksRef.current?.fire(element, screenX, screenY)` in MercuryTab ✓
