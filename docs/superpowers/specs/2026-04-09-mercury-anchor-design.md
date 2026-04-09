# Mercury Anchor — Design Spec
**Project MERCURY** · date: 2026-04-09 · status: approved for implementation

---

## 1. Problem

The four elemental tabs (Fluid, Thermal, Earth, Air) are discrete, independent views navigated by four separate nav buttons. Each mounts and unmounts its own Three.js canvas. Switching between them is a hard state change — a page load in all but name. This contradicts the manifesto's core premise: the system is always in the collision state, not toggling between discrete modes.

---

## 2. Goal

Collapse the four elemental tabs into a single unified component — the **Mercury Anchor** — where all four elemental simulations coexist simultaneously in one canvas, and navigation between them is a continuous phase transition, not a tab switch.

---

## 3. Design Decisions

| Dimension | Decision | Rationale |
|---|---|---|
| Nav change | 4 elemental buttons → 1 `◈ mercury` button | Single entry point; elemental identity lives inside, not in nav |
| Canvas | One shared Three.js canvas, all 4 simulations always running | Coexistence is the point; ghost phases enforce the Fade Doctrine |
| Active indicator | Day/night sphere — lit hemisphere faces active orbit node | Mercury the planet: illuminated side = active phase |
| Navigation | Orbit tap — 4 nodes at N/E/S/W, 48px minimum touch targets | Clear affordance, fat mobile targets, natural cardinal mapping |
| Ghost phases | 12% opacity on inactive element particle layers | Whisper-level — present but decoherent, not absent |
| Transition | 4-beat surface tension flow with Hg consolidation beat | See §5 |
| Orbit ring | Slow precession drift (~0.3°/s), loop never closes exactly | Perihelion precession — no stable state is truly stable |
| SARG encoding | Sphere surface reflectivity encodes live SARG score | High coherence = mirror-bright; decoherence = matte, viscous |
| Controls | Unified sidebar; shared params always visible; element-specific params cross-fade | One control surface for one component |

---

## 4. Elemental Mapping

The four orbit nodes sit at cardinal positions. Mapping is fixed:

| Position | Element | Symbol | Color |
|---|---|---|---|
| North | Air | △ | `sky-400` / `#38bdf8` |
| East | Thermal | ⊙ | `orange-500` / `#f97316` |
| South | Earth | ◻ | `amber-600` / `#d97706` |
| West | Fluid | ~ | `indigo-500` / `#6366f1` |

West (Fluid) is the default active phase on first mount — leftmost in the original nav order.

---

## 5. Phase Transition — 4-Beat Sequence

Total duration: ~800ms. Triggered by tapping any orbit node that is not the current active phase.

**Beat 1 — Consolidation (0–200ms)**
- Active element's particles contract inward toward the sphere center (ease-in)
- Sphere surface polishes to full chrome: reflectivity animates to maximum, all color bleeds out to silver
- All four orbit nodes momentarily lose their element color and go chrome — the system has returned to base material (Hg)
- Ghost phases briefly dim to ~4% during this beat

**Beat 2 — Elongation (200–400ms)**
- Sphere stretches toward the tapped orbit node (subtle scale on the axis toward the node)
- A mercury thread extends from the sphere toward the node
- The sphere's "day side" begins rotating to face the target node

**Beat 3 — Flow (400–650ms)**
- Thread reaches the target node
- The node ignites in its element color
- New element's color bleeds inward along the thread toward the sphere center
- Sphere begins reforming to round while taking on the new element's hue in its lit hemisphere

**Beat 4 — Emergence (650–800ms)**
- New element's particles expand outward from center (ease-out)
- Ghost phases of the other three elements restore to 12% opacity
- Orbit ring precession resumes
- Sphere settles into resting mirror state, day side facing the newly active node

---

## 6. The Sphere

The mercury sphere is the visual and semantic core of the component. It is not decorative.

**Geometry:** Standard sphere geometry, ~80px diameter on desktop, ~60px on mobile.

**Surface:**
- Base: radial gradient simulating liquid metal — bright specular at ~35%/30%, mid-tone chrome body, dark absorption at the limb
- Day side (lit hemisphere): faces the active orbit node. Tinted with the active element's color at ~15% blend over the chrome base
- Night side (shadowed hemisphere): faces away from active node. Deep mercury-dark. Ghost phase colors barely visible at the limb (~4%)
- Rotation: sphere slowly rotates to face the active node. During transition Beat 2, this rotation accelerates to align with the new node

**SARG encoding:**
- A `sargScore` prop (0–1) drives `specularIntensity` on the sphere material
- High SARG (>0.8): mirror-bright, sharp specular highlight, high contrast between day/night sides
- Low SARG (<0.3): matte, diffuse, reduced day/night contrast, slightly darker overall
- The sphere is a live readout of the system's coherence state

**Orbit ring:**
- Dashed circle, `rgba(255,255,255,0.1)`, centered on the sphere
- Rotates at 0.3°/s — imperceptible in real time but visible over 30+ seconds
- The loop does not close: after a full 360° rotation it offsets by ~0.5° before starting the next cycle (perihelion precession analog)

---

## 7. Canvas Architecture

One `<Canvas>` renders all four elemental simulations. Each simulation system runs at all times. Opacity/visibility is controlled via uniform or material opacity, not mount/unmount.

```
<MercuryCanvas>
  ├── FluidParticles     opacity: active ? 1.0 : 0.12, transition 800ms
  ├── ThermalParticles   opacity: active ? 1.0 : 0.12, transition 800ms
  ├── EarthParticles     opacity: active ? 1.0 : 0.12, transition 800ms
  ├── AirParticles       opacity: active ? 1.0 : 0.12, transition 800ms
  ├── MercurySphere      (day/night, SARG reflectivity, precession ring)
  └── OrbitNodes[4]      (N/E/S/W tap targets, chrome during consolidation)
```

**Performance:**
- Mobile: inactive simulations run at 25% of their default particle density (not zero — ghost phases must render, but cheaply)
- FPS-adaptive quality already present in each elemental sim is preserved
- Active simulation runs at full density
- `React.lazy` per elemental system preserved for initial bundle split

---

## 8. Controls Panel

Replaces the four separate elemental control panels with one unified sidebar.

**Always visible (shared params):**
- Speed
- Turbulence
- Density

**Phase-specific params** (cross-fade in/out on phase transition, ~300ms opacity transition):
- Fluid: Curl amplitude, Tube radius, Chromatic
- Thermal: Flame width
- Earth: Eruption strength
- Air: Orbital speed, Spread

**Phase label:** Small text at top of sidebar showing `// fluid :: active` (updates per phase). No tab buttons in the sidebar — the orbit nodes are the only navigation affordance.

**System status readout** (bottom of sidebar): FPS, particle count, active element metrics. Updates to reflect active element's specific metrics (e.g. "curl: 0.8" for fluid, "buoyancy: 0.6" for thermal).

---

## 9. Layout

```
┌─ nav bar ──────────────────────────────────────────┐
│  kernel  |  art  |  ◈ mercury  |  archive  |  ...  │
└────────────────────────────────────────────────────┘
┌─ mercury view ─────────────────────────────────────┐
│  ┌─ sidebar ──┐  ┌─ canvas ─────────────────────┐  │
│  │ speed      │  │                              │  │
│  │ turbulence │  │    [ghost air △]             │  │
│  │ density    │  │                              │  │
│  │ ─────────  │  │  [ghost         [ghost       │  │
│  │ // fluid   │  │   fluid ~] ◉   thermal ⊙]   │  │
│  │ curl amp   │  │         orbit ring           │  │
│  │ tube r     │  │  [ghost earth ◻]             │  │
│  │            │  │                              │  │
│  │ FPS: 60    │  │     active: full opacity     │  │
│  └────────────┘  └──────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

Mobile: sidebar collapses to a bottom-sheet toggle (same pattern as existing elemental tabs). Canvas fills the viewport. The visual orbit ring scales proportionally to the canvas. Each orbit node renders a 48px invisible touch target centered on the node position — larger than the visible dot — so the physical tap zone is comfortably reachable without the visual ring needing to expand to the viewport edge.

---

## 10. Component API (sketch)

```jsx
<MercuryAnchor
  sargScore={sargScore}          // 0–1, drives sphere reflectivity
  initialPhase="fluid"           // which orbit node starts active
  onPhaseChange={(phase) => {}}  // called at Beat 4 completion
/>
```

Internal state: `activePhase`, `transitionState` (`idle | consolidating | elongating | flowing | emerging`), `params` (merged shared + phase-specific).

---

## 11. Files Affected

**New files:**
- `src/terminal/views/MercuryTab.jsx` — top-level view (replaces 4 elemental tab views in routing)
- `src/terminal/mercury/MercuryCanvas.jsx` — unified Three.js canvas
- `src/terminal/mercury/MercurySphere.jsx` — sphere + orbit ring + orbit nodes
- `src/terminal/mercury/MercuryControls.jsx` — unified control sidebar
- `src/terminal/mercury/usePhaseTransition.js` — 4-beat transition state machine

**Modified files:**
- `src/terminal/App.jsx` — replace 4 elemental lazy imports + nav buttons with single `◈ mercury` entry; remove `activeTab === 'fluid'` etc. render branches; add `activeTab === 'mercury'` branch
- `src/terminal/fluid/ParticleFlow.jsx` — accept `opacityMultiplier` prop for ghost-phase rendering
- `src/terminal/thermal/ThermalFlow.jsx` — same
- `src/terminal/earth/SedimentFlow.jsx` — same
- `src/terminal/air/AtmosphericFlow.jsx` — same

**Deleted (post-implementation):**
- `src/terminal/views/FluidTab.jsx`
- `src/terminal/views/ThermalTab.jsx`
- `src/terminal/views/EarthTab.jsx`
- `src/terminal/views/AirTab.jsx`

---

## 12. Out of Scope

- SARG score computation — `sargScore` prop is wired up but the live SARG value is fed in from the existing kernel system; this spec does not change how SARG is computed
- The terminal bug fix (fixed separately: move `fixed bottom-14` terminal outside the animated container in App.jsx)
- Any changes to non-elemental tabs (kernel, art, archive, etc.)
