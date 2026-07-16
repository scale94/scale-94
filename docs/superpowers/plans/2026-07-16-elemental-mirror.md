# The Elemental Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The mercury drop's reflection becomes elemental — a procedural night-world environment colored by the active element, dissolving through neutral night at peak chrome, replacing the static `preset="night"` HDR.

**Architecture:** A new `MercuryEnvironment` component renders one inverted sphere with a custom gradient shader into a small cubemap via drei `<Environment>` children mode. Shader uniforms ride the existing `usePhaseTransition` signals (`chromePhase`, `colorBlend`) — no new timing system. Element hues move to a shared `elements.js` palette keyed by **phase name**.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/drei 10, three 0.183, vitest 4 (jsdom), Vite dev server `scale94-dev` (port 5174, defined in `.claude/launch.json`).

**Spec:** `docs/superpowers/specs/2026-07-16-elemental-mirror-design.md`

## Global Constraints

- `usePhaseTransition.js` is **not modified**.
- `MercurySphere` material params (`roughness`, `metalness`, `envMapIntensity = (0.3 + cp * 1.3) * Math.min(1, sargScore)`) are **not modified**. If the drop reads wrong, fix the world, not the mercury.
- Palette lookups are keyed by **phase names** (`air`, `thermal`, `earth`, `fluid`) — the signals `usePhaseTransition` emits. Never by element names.
- Shader dithering is mandatory from the first shader commit (banding = hard fail).
- Particle systems, scene lights, transition timing: untouched.
- Visual claims require screenshots (project hard rule: look before claiming).
- **Never push.** Work on branch `feature/elemental-mirror`; integration decision is the user's.

---

### Task 0: Branch

**Files:** none

- [ ] **Step 1: Create the working branch**

```bash
git checkout -b feature/elemental-mirror
```

Expected: `Switched to a new branch 'feature/elemental-mirror'`

---

### Task 1: Shared element palette (`elements.js`)

**Files:**
- Create: `src/terminal/mercury/elements.js`
- Test: `src/terminal/mercury/__tests__/elements.test.js`

**Interfaces:**
- Produces:
  - `ELEMENTS` — object keyed by phase name; each value `{ element: string, color: '#rrggbb', horizonHeight: number }`
  - `NEUTRAL_NIGHT` — same shape, `element: 'QUINTESSENCE'`
  - `elementForPhase(phase) -> palette entry` (unknown/null phase → `NEUTRAL_NIGHT`)
  - `resolveEnvState(activePhase, pendingPhase, sphereState) -> { elementColor: [r,g,b] (0–1 linear-ish sRGB floats), horizonHeight: number, chromePhase: number }`

- [ ] **Step 1: Write the failing tests**

Create `src/terminal/mercury/__tests__/elements.test.js`:

```js
// src/terminal/mercury/__tests__/elements.test.js — shared palette + env-state resolution.
import { describe, it, expect } from 'vitest';
import { ELEMENTS, NEUTRAL_NIGHT, elementForPhase, resolveEnvState } from '../elements';

const IDLE = { chromePhase: 0, colorBlend: 0 };

describe('ELEMENTS palette', () => {
  it('is keyed by phase name, not element name', () => {
    // Regression guard: 'thermal' and 'fluid' are the phase names the
    // transition system emits — an element-name-keyed map ('fire', 'water')
    // silently falls back to neutral for exactly these two.
    expect(elementForPhase('thermal').color).toBe('#f97316'); // FIRE
    expect(elementForPhase('fluid').color).toBe('#6366f1');   // WATER
    expect(elementForPhase('air').color).toBe('#38bdf8');
    expect(elementForPhase('earth').color).toBe('#d97706');
  });

  it('falls back to neutral night for unknown or null phase', () => {
    expect(elementForPhase('quintessence')).toBe(NEUTRAL_NIGHT);
    expect(elementForPhase(null)).toBe(NEUTRAL_NIGHT);
  });

  it('places air high and earth low in the world', () => {
    expect(ELEMENTS.air.horizonHeight).toBeGreaterThan(ELEMENTS.thermal.horizonHeight);
    expect(ELEMENTS.earth.horizonHeight).toBeLessThan(ELEMENTS.fluid.horizonHeight);
  });
});

describe('resolveEnvState', () => {
  it('idle: effective color is the active element, untouched by pending=null', () => {
    const s = resolveEnvState('thermal', null, IDLE);
    expect(s.elementColor.map(v => Math.round(v * 255))).toEqual([0xf9, 0x73, 0x16]);
    expect(s.horizonHeight).toBe(ELEMENTS.thermal.horizonHeight);
    expect(s.chromePhase).toBe(0);
  });

  it('continuity: end of emerging equals the new idle (no visual pop at beat reset)', () => {
    // usePhaseTransition.js:89-98 — at emerging end (active='fluid',
    // pending='thermal', colorBlend=1) the state resets to idle
    // (active='thermal', pending=null, colorBlend=0). Same frame, same world.
    const endOfEmerging = resolveEnvState('fluid', 'thermal', { chromePhase: 0, colorBlend: 1 });
    const newIdle       = resolveEnvState('thermal', null,     IDLE);
    expect(endOfEmerging.elementColor).toEqual(newIdle.elementColor);
    expect(endOfEmerging.horizonHeight).toBe(newIdle.horizonHeight);
  });

  it('mid-blend: color and horizon interpolate between active and pending', () => {
    const s = resolveEnvState('fluid', 'thermal', { chromePhase: 0.3, colorBlend: 0.5 });
    const water = resolveEnvState('fluid', null, IDLE);
    const fire  = resolveEnvState('thermal', null, IDLE);
    s.elementColor.forEach((v, i) => {
      expect(v).toBeCloseTo((water.elementColor[i] + fire.elementColor[i]) / 2, 5);
    });
    expect(s.horizonHeight).toBeCloseTo(
      (ELEMENTS.fluid.horizonHeight + ELEMENTS.thermal.horizonHeight) / 2, 5
    );
    expect(s.chromePhase).toBe(0.3);
  });

  it('tolerates missing sphereState (defensive default = idle)', () => {
    const s = resolveEnvState('air', null, undefined);
    expect(s.chromePhase).toBe(0);
    expect(s.horizonHeight).toBe(ELEMENTS.air.horizonHeight);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/terminal/mercury/__tests__/elements.test.js`
Expected: FAIL — `Cannot find module '../elements'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `src/terminal/mercury/elements.js`:

```js
// src/terminal/mercury/elements.js — single source of truth for element hues
// and their placement in the mirror's world (spec: elemental mirror §Changed).
//
// Keyed by PHASE name — the signal usePhaseTransition emits. 'thermal' is
// FIRE, 'fluid' is WATER; an element-name-keyed map silently loses both.

export const ELEMENTS = {
  air:     { element: 'AIR',   color: '#38bdf8', horizonHeight:  0.20 }, // pale cyan, sits high
  thermal: { element: 'FIRE',  color: '#f97316', horizonHeight:  0.00 }, // ember horizon, centered
  fluid:   { element: 'WATER', color: '#6366f1', horizonHeight: -0.10 }, // indigo, low-mid
  earth:   { element: 'EARTH', color: '#d97706', horizonHeight: -0.20 }, // amber, sunk toward ground
};

// What quintessence reflects: near-colorless deep night, visible only at
// peak chrome. Luminance is tuned against the shipped preset="night" look
// (spec §Named Risk) — this hue is the tuning knob, not the shader.
export const NEUTRAL_NIGHT = { element: 'QUINTESSENCE', color: '#23233a', horizonHeight: 0.0 };

export function elementForPhase(phase) {
  return ELEMENTS[phase] ?? NEUTRAL_NIGHT;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function lerp(a, b, t) { return a + (b - a) * t; }

// Effective (already blended) env palette for a given transition frame.
// The neutral dip at peak chrome happens in the shader via uChromePhase;
// this resolves only the element-to-element blend.
export function resolveEnvState(activePhase, pendingPhase, sphereState) {
  const active  = elementForPhase(activePhase);
  const pending = pendingPhase ? elementForPhase(pendingPhase) : active;
  const blend       = sphereState?.colorBlend  ?? 0;
  const chromePhase = sphereState?.chromePhase ?? 0;
  const a = hexToRgb(active.color);
  const p = hexToRgb(pending.color);
  return {
    elementColor: [lerp(a[0], p[0], blend), lerp(a[1], p[1], blend), lerp(a[2], p[2], blend)],
    horizonHeight: lerp(active.horizonHeight, pending.horizonHeight, blend),
    chromePhase,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/terminal/mercury/__tests__/elements.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/elements.js src/terminal/mercury/__tests__/elements.test.js
git commit -m "feat(mercury): shared element palette keyed by phase name"
```

---

### Task 2: `MercurySphere` consumes the shared palette

**Files:**
- Modify: `src/terminal/mercury/MercurySphere.jsx:11-16` (ORBIT_NODES colors) and the `'#6366f1'` fallbacks at lines 157-158, 168.

**Interfaces:**
- Consumes: `ELEMENTS` from Task 1.
- Produces: no interface change — pure DRY refactor, zero visual change.

- [ ] **Step 1: Point ORBIT_NODES at the palette**

In `src/terminal/mercury/MercurySphere.jsx`, add the import below the existing imports:

```js
import { ELEMENTS } from './elements';
```

Replace the ORBIT_NODES literal colors:

```js
const ORBIT_NODES = [
  { phase: 'air',     angle: Math.PI / 2,  color: ELEMENTS.air.color,     element: 'AIR',   glyph: 'air'   },
  { phase: 'thermal', angle: 0,            color: ELEMENTS.thermal.color, element: 'FIRE',  glyph: 'fire'  },
  { phase: 'earth',   angle: -Math.PI / 2, color: ELEMENTS.earth.color,   element: 'EARTH', glyph: 'earth' },
  { phase: 'fluid',   angle: Math.PI,      color: ELEMENTS.fluid.color,   element: 'WATER', glyph: 'water' },
];
```

Replace the three `'#6366f1'` fallback literals (lines 157, 158, 168) with `ELEMENTS.fluid.color`:

```js
const activeColor  = new THREE.Color(activeNode?.color  ?? ELEMENTS.fluid.color);
const pendingColor = new THREE.Color(pendingNode?.color ?? ELEMENTS.fluid.color);
```

and in `emergeColor`:

```js
const emergeColor = liquidSilver.clone().lerp(
  new THREE.Color(pendingNode?.color ?? ELEMENTS.fluid.color), sphereState.colorBlend * 0.25
);
```

- [ ] **Step 2: Verify nothing broke**

Run: `npx vitest run && npm run lint`
Expected: all existing tests PASS, lint clean.

- [ ] **Step 3: Commit**

```bash
git add src/terminal/mercury/MercurySphere.jsx
git commit -m "refactor(mercury): sphere reads element hues from shared palette"
```

---

### Task 3: `MercuryEnvironment` — the neutral night world

**Files:**
- Create: `src/terminal/mercury/MercuryEnvironment.jsx`

**Interfaces:**
- Consumes: `NEUTRAL_NIGHT` from Task 1 (element driving arrives in Task 5).
- Produces: `<MercuryEnvironment activePhase pendingPhase sphereState isMobile />` — default export. In this task the world renders **neutral night only**; props are accepted but not yet driven (spec §Named Risk: tune neutral first, alone).

**Domain notes for the implementer (read before coding):**
- drei `<Environment>` with JSX children renders those children into a cubemap that becomes `scene.environment`. No HDR is fetched. `frames={Infinity}` re-renders it every frame; a finite number renders that many frames then holds.
- Raw `ShaderMaterial` gets **no** three.js shader chunks — helpers like `transformDirection()` don't exist there. We avoid the problem entirely: the env sphere is centered at the cube camera's origin and unrotated, so the **object-space position of a unit sphere is already the world direction**. The vertex shader just passes `position` through as a varying.
- Inverted sphere = positive scale + `side={THREE.BackSide}`. Do **not** also negate the scale — negative scale flips winding and, combined with BackSide, un-inverts the sphere.
- Dithering is baked in from this first commit (Global Constraints).

- [ ] **Step 1: Write the component**

Create `src/terminal/mercury/MercuryEnvironment.jsx`:

```jsx
// src/terminal/mercury/MercuryEnvironment.jsx — the mirror's world.
// A procedural night environment rendered into a small cubemap via drei
// <Environment> children mode. Replaces preset="night" (no HDR, no CDN).
// Spec: docs/superpowers/specs/2026-07-16-elemental-mirror-design.md
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { NEUTRAL_NIGHT } from './elements';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // Sphere is centered on the cube camera and unrotated: object-space
    // position of a unit sphere IS the world direction. No matrix chunks needed.
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vDir;
  uniform vec3  uElementColor;   // effective (pre-blended) element chroma
  uniform vec3  uNeutralColor;   // quintessence night chroma
  uniform float uChromePhase;    // 1.0 = pure mirror: world drains to neutral
  uniform float uHorizonHeight;  // world-y of the glow band
  uniform float uTime;

  // Hash dither — a smooth gradient in a low-res cubemap is a banding
  // machine, and banding is a hard fail for this project.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec3 dir = normalize(vDir);
    float y = dir.y;

    // The dissolution: element chroma drains to neutral night at peak chrome.
    vec3 chroma = mix(uElementColor, uNeutralColor, uChromePhase);

    // World base — dark ground below, quintessence-dark zenith above.
    vec3 zenith = vec3(0.010, 0.010, 0.018);
    vec3 ground = vec3(0.004, 0.004, 0.008);
    vec3 world  = mix(ground, zenith, smoothstep(-1.0, 1.0, y));

    // Horizon band — the world's main light source. Breathes slowly.
    float breathe = 1.0 + 0.12 * sin(uTime * 0.35);
    float band = exp(-pow((y - uHorizonHeight) * 4.5, 2.0));
    world += chroma * band * 0.85 * breathe;

    // Faint stratum below the horizon — the ground remembering the glow.
    float stratum = exp(-pow((y - uHorizonHeight + 0.45) * 3.0, 2.0));
    world += chroma * stratum * 0.18;

    // Distant sources — three soft blobs drifting on slow incommensurate orbits.
    vec3 b1 = normalize(vec3(cos(uTime * 0.050),        0.35, sin(uTime * 0.050)));
    vec3 b2 = normalize(vec3(cos(uTime * 0.031 + 2.4),  0.05, sin(uTime * 0.031 + 2.4)));
    vec3 b3 = normalize(vec3(cos(uTime * 0.021 + 4.2), -0.25, sin(uTime * 0.021 + 4.2)));
    world += chroma * pow(max(dot(dir, b1), 0.0), 22.0) * 0.35;
    world += mix(chroma, vec3(0.50, 0.50, 0.60), 0.5)
                    * pow(max(dot(dir, b2), 0.0), 30.0) * 0.25;
    world += chroma * pow(max(dot(dir, b3), 0.0), 40.0) * 0.20;

    // Dither before quantization.
    world += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * (1.5 / 255.0);

    gl_FragColor = vec4(world, 1.0);
  }
`;

// eslint-disable-next-line no-unused-vars -- activePhase/pendingPhase/sphereState wired in the dissolution-arc task
export default function MercuryEnvironment({ activePhase, pendingPhase, sphereState, isMobile = false }) {
  const uniforms = useMemo(() => ({
    uElementColor:  { value: new THREE.Color(NEUTRAL_NIGHT.color) },
    uNeutralColor:  { value: new THREE.Color(NEUTRAL_NIGHT.color) },
    uChromePhase:   { value: 0 },
    uHorizonHeight: { value: NEUTRAL_NIGHT.horizonHeight },
    uTime:          { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <Environment frames={Infinity} resolution={128}>
      {/* Positive scale + BackSide = inverted sphere. Never negate the scale:
          that flips winding and un-inverts it. */}
      <mesh scale={50}>
        <sphereGeometry args={[1, 48, 32]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </Environment>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run lint && npx vitest run`
Expected: lint clean, existing tests PASS. (Visual verification happens in Task 4 — this component isn't mounted anywhere yet.)

- [ ] **Step 3: Commit**

```bash
git add src/terminal/mercury/MercuryEnvironment.jsx
git commit -m "feat(mercury): procedural neutral-night environment world (not yet wired)"
```

---

### Task 4: Wire into the canvas + tune neutral against the shipped look

**Files:**
- Modify: `src/terminal/mercury/MercuryCanvas.jsx:3` (drei import) and `:74` (Environment swap)
- Possibly tune: `NEUTRAL_NIGHT.color` in `src/terminal/mercury/elements.js`, luminance constants in `MercuryEnvironment.jsx`

**Interfaces:**
- Consumes: `MercuryEnvironment` from Task 3.

This task is spec §Named Risk step 1: the neutral world alone must visually match the shipped `preset="night"` mercury look before any element color exists.

- [ ] **Step 1: Confirm the env only feeds the sphere**

The swap assumes `scene.environment` effectively lights only the mercury sphere. Verify:

Run: `grep -lE "meshStandardMaterial|meshPhysicalMaterial|MeshStandardMaterial|MeshPhysicalMaterial" src/terminal/fluid/*.jsx src/terminal/thermal/*.jsx src/terminal/earth/*.jsx src/terminal/air/*.jsx`

Expected: matches only in the hidden boundary geometries (`GlassKnot`, `GlassHearth`, `CrystalGeode`, `AtmoShell` — all rendered `visible={false}` per `MercuryCanvas.jsx:89-125`), or no matches. If a *flow* system (particle) file matches, stop and flag it — the env swap would recolor the particles too, and that needs a human decision.

- [ ] **Step 2: Swap the environment**

In `src/terminal/mercury/MercuryCanvas.jsx`:

Line 3 — drop `Environment` from the drei import:

```js
import { OrbitControls } from '@react-three/drei';
```

Add below the other mercury imports:

```js
import MercuryEnvironment from './MercuryEnvironment';
```

Line 74 — replace `<Environment preset="night" />` with:

```jsx
<MercuryEnvironment
  activePhase={activePhase}
  pendingPhase={pendingPhase}
  sphereState={sphereState}
  isMobile={isMobile}
/>
```

- [ ] **Step 3: Lint + tests**

Run: `npm run lint && npx vitest run`
Expected: clean.

- [ ] **Step 4: Look at it (mandatory)**

1. Start the dev server via the browser preview tools: `preview_start` with name `scale94-dev`.
2. Navigate to the Mercury tab in the terminal UI.
3. Screenshot the idle sphere. Tap an element node and screenshot around the chrome flash.
4. Open `https://scale94.com` (shipped `preset="night"`) in a second tab, same views, same screenshots.
5. Compare: the drop's brightness, the moody blue-grey liquid flash, the planet-mode ambient sheen. The two should be close siblings — not identical (the world is ours now), but no brightness regression and no black-glass relapse.

- [ ] **Step 5: Tune until it matches**

Tuning knobs, in order of preference:
1. `NEUTRAL_NIGHT.color` in `elements.js` (overall chroma/luminance of the night).
2. The `0.85` horizon-band gain and `zenith`/`ground` constants in the fragment shader.
3. Do **not** touch `MercurySphere` material params (Global Constraints).

Re-screenshot after each adjustment. Also check the console for shader compile errors (`read_console_messages`) — a failed shader silently falls back to a magenta/black env.

- [ ] **Step 6: Verify the CDN fetch is gone**

Check the network requests for the Mercury tab load: zero requests for `.hdr` / `.exr` assets (the preset host). Expected: none.

- [ ] **Step 7: Commit**

```bash
git add src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/elements.js src/terminal/mercury/MercuryEnvironment.jsx
git commit -m "feat(mercury): canvas reflects the procedural night world (neutral tuned vs shipped)"
```

---

### Task 5: The dissolution arc — elements enter the mirror

**Files:**
- Modify: `src/terminal/mercury/MercuryEnvironment.jsx` (drive uniforms from phase signals)

**Interfaces:**
- Consumes: `resolveEnvState` from Task 1; `activePhase`/`pendingPhase`/`sphereState` props already wired in Task 4.

- [ ] **Step 1: Drive the uniforms**

In `MercuryEnvironment.jsx`, extend the import:

```js
import { NEUTRAL_NIGHT, resolveEnvState } from './elements';
```

Replace the `useFrame` block with:

```jsx
  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
    // Ride the existing beats: chromePhase drains the world to neutral at
    // peak mirror; colorBlend floods the pending element back in.
    const s = resolveEnvState(activePhase, pendingPhase, sphereState);
    uniforms.uElementColor.value.setRGB(...s.elementColor);
    uniforms.uChromePhase.value = s.chromePhase;
    uniforms.uHorizonHeight.value = s.horizonHeight;
  });
```

Update the `eslint-disable` comment above the component signature — `isMobile` is still unused until the mobile-staging task:

```js
// eslint-disable-next-line no-unused-vars -- isMobile wired in the mobile-staging task
```

(The comment is removed entirely in that task.)

- [ ] **Step 2: Lint + tests**

Run: `npm run lint && npx vitest run`
Expected: clean.

- [ ] **Step 3: Look at it (mandatory) — the payoff window**

With the dev server running:

1. **Idle sheen × 4:** for each element (tap WATER, FIRE, EARTH, AIR; let each settle), screenshot the idle sphere. Expected: subtle element-tinted ambient on the planet surface, four visibly different worlds in the faint reflections.
2. **The dip and the payoff:** transitions are 800ms — to *see* the beats, temporarily slow them: in `usePhaseTransition.js:6` multiply all four `BEAT_MS` values by 10 **in the working tree only** (e.g. `consolidating: 2000, elongating: 2000, flowing: 2500, emerging: 1500`). Do NOT commit this. Tap FIRE from WATER and screenshot:
   - during consolidating: world drains toward colorless night as the sphere chromes;
   - during flowing: **fire's ember horizon visible on a still-chrome sphere** — this is the thesis made visible (spec §The payoff window). If the sphere is already rocky before orange appears, the ramp is too late: check that `colorBlend` is driving `uElementColor` (it rises through flowing while `chromePhase` decays 0.6→0).
3. **Continuity:** watch the end of a transition at 10× — no pop when beats reset to idle.
4. Revert the `BEAT_MS` change: `git checkout src/terminal/mercury/usePhaseTransition.js`. Confirm with `git status` (must be clean except intended files).

- [ ] **Step 4: Commit**

```bash
git add src/terminal/mercury/MercuryEnvironment.jsx
git commit -m "feat(mercury): dissolution arc — the mirror drains to night, the element floods back"
```

---

### Task 6: Mobile staging — render the burst, hold the frame

**Files:**
- Modify: `src/terminal/mercury/MercuryEnvironment.jsx`

**Interfaces:**
- Consumes: `isMobile` prop (already passed from `MercuryCanvas`, derived from userAgent at `MercuryCanvas.jsx:17`).

**Domain note:** drei's `frames` prop is read at mount. Remounting `<Environment>` (via `key`) restarts the frame counter. The key must change **only when a transition starts** — `pendingPhase` goes `null → phase` at start and `phase → null` at end; keying on `pendingPhase` itself would remount twice per transition and churn render targets.

- [ ] **Step 1: Add the burst key**

In `MercuryEnvironment.jsx`, add `useRef` to the react import:

```js
import { useMemo, useRef } from 'react';
```

Inside the component, before the return:

```jsx
  // Mobile: re-render the env only while a transition runs (~800ms), then
  // hold a static frame. Bump the key only when a transition STARTS —
  // keying on pendingPhase directly would remount again when it nulls.
  const burstRef = useRef(0);
  const prevPendingRef = useRef(null);
  if (pendingPhase && pendingPhase !== prevPendingRef.current) burstRef.current += 1;
  prevPendingRef.current = pendingPhase;
```

Replace the `<Environment ...>` opening tag with:

```jsx
    <Environment
      key={isMobile ? `burst-${burstRef.current}` : 'live'}
      frames={isMobile ? 70 : Infinity}
      resolution={isMobile ? 64 : 128}
    >
```

(70 frames ≈ 1.17s at 60fps — covers the 800ms transition with margin; the held frame is the new element's idle world.)

- [ ] **Step 2: Lint + tests**

Run: `npm run lint && npx vitest run`
Expected: clean.

- [ ] **Step 3: Verify the mobile path (temporary override)**

`isMobile` is derived from the userAgent at module load, so emulate by force: in `MercuryCanvas.jsx:17`, temporarily set `const isMobile = true;` **in the working tree only**. Do NOT commit this.

1. Reload the Mercury tab. Screenshot idle — a static (but structured) neutral-to-element world, sphere legible.
2. Check banding at resolution 64: zoom a screenshot of the sphere's lit limb. If stepped arcs appear, raise mobile resolution to 128 and re-check.
3. Tap an element: the transition should animate the env (the burst), then settle frozen. Watch ~5s after settle — reflections must not drift (frozen = correct on mobile).
4. Revert: `git checkout src/terminal/mercury/MercuryCanvas.jsx` — then re-apply ONLY if that file carried no other uncommitted work (it shouldn't at this point; confirm with `git status` first).
5. Reload on desktop path and confirm idle drift is alive again (reflections breathe).

- [ ] **Step 4: Commit**

```bash
git add src/terminal/mercury/MercuryEnvironment.jsx
git commit -m "feat(mercury): mobile env staging — burst on transition, hold at idle"
```

---

### Task 7: Full verification matrix + wrap

**Files:** none new (tuning fixes only, if the matrix fails)

Spec §Verification, executed end-to-end on the desktop path unless stated. All checkpoints start unproven; screenshots are the evidence.

- [ ] **Step 1: Neutral night match** — re-confirm vs `scale94.com` after all tasks (Task 4 tuning may have drifted during 5/6). Screenshot pair.

- [ ] **Step 2: Idle sheen × 4** — one screenshot per element at idle. Four distinguishable worlds in the reflections; horizon placement differs (air high, earth low).

- [ ] **Step 3: The dip + payoff** — 10× `BEAT_MS` slow-mo (working tree only, revert after): night dip at peak chrome; element saturated on still-chrome sphere in flowing. Screenshots of both beats.

- [ ] **Step 4: FPS** — the canvas already reports FPS via `onFps`. Compare desktop steady-state FPS before/after (git stash the branch or check out main in a second server if needed; a rough eyeball vs the pre-change number is acceptable — art-project calibration, but note the numbers).

- [ ] **Step 5: Banding sweep** — zoomed screenshots of the sphere limb and the darkest world regions, desktop 128 and mobile 64. No stepped arcs. If banding survives the dither, escalate: check what texture type drei allocated for the cubemap (`renderer.info` / inspect the render target) and force half-float if it's byte.

- [ ] **Step 6: Network** — Mercury tab load fires zero `.hdr`/`.exr` requests. Screenshot or request-list evidence.

- [ ] **Step 7: Working tree hygiene** — `git status` clean; `BEAT_MS` and `isMobile` overrides reverted (both were checkout-reverted in Tasks 5/6; re-confirm).

- [ ] **Step 8: Final commit if tuning changed anything**

```bash
git add -A src/terminal/mercury
git commit -m "polish(mercury): elemental mirror tuning from verification matrix"
```

- [ ] **Step 9: Hand back for integration decision**

Use superpowers:finishing-a-development-branch. **Never push** — merge/PR/push decisions belong to the user.
