# Mercury Tab — Element Fireworks Design

**Date:** 2026-04-11  
**Status:** Approved

## Summary

Full-screen fireworks trigger when the user clicks any of the four element nodes (Fire, Air, Earth, Water) in the Mercury tab's 3D sphere. Each element has a distinct burst personality. All particles conform to the Fade Doctrine's cubic envelope lifecycle and additive blend mode.

---

## Architecture

### New Component: `MercuryFireworks.jsx`

- Renders a `<canvas>` absolutely positioned over the full Mercury tab
- CSS: `position: absolute; inset: 0; pointer-events: none; z-index: 10`
- Runs its own `requestAnimationFrame` animation loop
- Receives click events via a callback ref passed from `MercuryTab.jsx`

### Trigger Flow

1. User clicks an element node in `MercurySphere.jsx`
2. Existing scale-burst animation fires as before (unchanged)
3. `MercurySphere.jsx` calls `onElementFired({ element, screenX, screenY })` — a callback ref provided by `MercuryTab.jsx`
4. `MercuryFireworks.jsx` receives the event and spawns a salvo

### Integration Points

- `MercuryTab.jsx` — creates a `fireworksRef` callback, passes it down to both `MercuryFireworks` and `MercurySphere`
- `MercurySphere.jsx` — calls `fireworksRef.current({ element, screenX, screenY })` on existing node click handler
- `MercuryFireworks.jsx` — new file, self-contained canvas loop

---

## Particle Lifecycle (Fade Doctrine Compliance)

All particles — trails and bursts — use the cubic envelope from `artParticles.js`:

```
t = age / lifespan  (0.0 → 1.0)

if t < 0.15:  alpha = base * (t / 0.15)²           // quadratic ease-in
elif t < 0.70: alpha = base                          // hold
else:          alpha = base * (1 - (t - 0.70) / 0.30)^2.2  // power ease-out
```

- **Base alpha:** `0.55`
- **Cull threshold:** `alpha < 0.004`
- **Composite mode:** `ctx.globalCompositeOperation = 'lighter'` (additive)
- **No white fills, no opacity dissolves to white**

---

## Rocket Salvo

Per click: **3–5 rockets**, staggered 80–150ms apart.

Each rocket:
- Origin: near the clicked node's screen position (±20px random offset)
- Apex: random point in the upper 40% of the screen
- Trail: thin line in element primary color, fade-doctrine lifecycle, ~60–80 frame lifespan
- At apex: burst fires the element's personality

---

## Element Color Palettes (Semantic)

| Element | Primary | Secondary |
|---------|---------|-----------|
| Fire | `#f97316` | `#fbbf24`, `#ef4444` |
| Water | `#6366f1` | `#818cf8`, `#c7d2fe` |
| Air | `#38bdf8` | `#bae6fd`, `#0ea5e9` |
| Earth | `#d97706` | `#fbbf24`, `#92400e` |

---

## Element Burst Personalities

### Fire ▲
- **12–18 thin ember streaks**
- Direction: upward, narrow angle spread (±20° from vertical)
- Lifespan: 180–240 frames (slow burn)
- Horizontal drift: slight random jitter each frame
- Color ages from primary → secondary as lifespan progresses
- Particle shape: thin rectangle (2×6px)

### Water ▽
- **10–14 droplet particles**
- Direction: wide parabolic fan (±80° from vertical)
- Gravity: downward acceleration applied each frame
- Lifespan: 100–140 frames
- Colors: cool indigo/violet throughout, no warm tones
- Particle shape: small filled circle (3–4px radius)

### Air ○
- **2–3 expanding concentric rings**
- Rendered as stroked circles growing in radius (0 → 80px)
- Lifespan: 60–90 frames (fast)
- Stroke width thins as radius grows (3px → 0.5px)
- Color: cyan `#38bdf8`, secondary `#bae6fd`
- Particle shape: `ctx.arc` stroke, no fill

### Earth ◆
- **8–12 chunky rectangular shards**
- Direction: radial, all angles
- Velocity: slow and heavy (0.6× normal speed)
- Gravity: strong downward pull (1.5× normal gravity)
- Rotation: each shard has a random angular velocity, rotates each frame
- Lifespan: 180–260 frames (slowest)
- Particle shape: filled rectangle (4–8px × 3–6px), rotated via `ctx.save/rotate/restore`
- Colors: amber/brown palette

---

## Data Flow

```
MercuryTab.jsx
  ├── fireworksRef = useRef(null)
  ├── <MercuryFireworks onFire={fireworksRef} />
  └── <MercuryCanvas>
        └── <MercurySphere onElementClick={(el, sx, sy) => fireworksRef.current?.(el, sx, sy)} />
```

---

## File Changes

| File | Change |
|------|--------|
| `src/terminal/mercury/MercuryFireworks.jsx` | **New** — canvas overlay + particle engine |
| `src/terminal/views/MercuryTab.jsx` | Add `fireworksRef`, render `MercuryFireworks`, pass ref to canvas |
| `src/terminal/mercury/MercurySphere.jsx` | Add `onElementClick` prop, call it on existing node click |

---

## Constraints

- `pointer-events: none` on canvas — must not block Three.js OrbitControls or node clicks
- Canvas resizes with the tab container (ResizeObserver or window resize listener)
- No modifications to existing particle systems (ParticleFlow, ThermalFlow, SedimentFlow, AtmosphericFlow)
- No white fills anywhere — doctrine violation
- Particle cull loop runs every frame, removes dead particles from array
