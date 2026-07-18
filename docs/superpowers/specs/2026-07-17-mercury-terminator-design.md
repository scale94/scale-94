# Mercury Terminator — the compile frontier

**Date:** 2026-07-17
**Status:** design approved (brainstorming), pending spec review → writing-plans
**Surface:** desktop kernel-tab landing hero, top-right corner

---

## 1. Purpose

Replace the placeholder chrome in the kernel-tab hero corner (a decorative dot-sphere,
a fake "Lyapunov" sparkline, and two static status pills) with a single WebGL object
that both elevates the page visually and *transports the page's thesis*: a quicksilver
Mercury whose day/night terminator is a live gauge of how much of the corpus has been
compiled into knowledge.

The axiom printed directly above this corner is:

> THEORY THAT CANNOT BE COMPILED DOES NOT YET EXIST AS KNOWLEDGE

Mercury renders that axiom as a body in space. Night = uncompiled = not-yet-existing.
Daylight = compiled = knowledge. The viewer drives the sunrise by loading and running
kernels.

## 2. Core principle — the surface moves, the frontier means

Mercury's quicksilver body shimmers and flows continuously (ambient life). Its
day/night terminator is **not** a rotation cycle — its position is a **gauge** set by
compile state. This is the load-bearing distinction that separates this from decoration:
surface motion is atmosphere; the light frontier is meaning. A day/night *cycle* on a
timer is exactly the "sports-results headline" failure we are avoiding.

Mercury's real 3:2 spin–orbit resonance (a solar day longer than its year — time folded
on itself) is a *thematic rhyme* with the CHAOS/Feigenbaum arc. It is **not** simulated;
it lives in the spec and the lore, not the shader.

## 3. The gauge — what drives the light

Two frontiers on the visible disc, from live `observatoryBus` totals against the corpus.

- `N` = `kernelBuilds.length` (already a prop on `KernelTab`). Guard: if `N === 0`, gauge
  reads pure night and never divides by zero.
- `loadedDistinct` = `Object.keys(totals.transmissions.kernelsLoaded).length`
- `ranDistinct` = `Object.keys(totals.transmissions.ranAliases).length`

Two-stage mapping (the axiom's exact ontology):

- **night → twilight** boundary = `ease(loadedDistinct / N)` — a loaded kernel lifts that
  patch out of pure dark into cyan/violet dawn (*potential* knowledge, not yet real).
- **twilight → full-day** boundary = `ease(ranDistinct / N)` — a kernel that actually
  ran/compiled burns that patch to molten gold/lime (knowledge that *exists*).

Because a kernel must be loaded before it can run, `ranDistinct ≤ loadedDistinct` always,
so the day zone always nests inside the twilight zone. No clamp needed, but assert it.

**Easing (concave / diminishing-returns) so a few clicks read dramatically.** No jury
member will load all ~43 kernels; ~4–5 loads must visibly dawn the planet. Starting
point: `ease(x) = Math.sqrt(x)` (x=0.1 → 0.32). Tunable constant, pinned during
implementation against the real corpus size. `ease(0) = 0` (night is night).

## 4. Session memory + sunrise flares

- **Fresh dawn each session.** Reads the session-scoped accumulators as-is: starts at
  night on load, monotonic within a session, resets to night on reload. No storage. This
  re-stages the axiom every visit — knowledge doesn't-yet-exist until re-compiled.
- **Sunrise flares.** On each `kernel_loaded` / `kernel_completed` event the terminator
  *sweeps* to its new target over ~1.5 s (eased, not snapped) with a brief over-bright
  bloom envelope. This is the retired dot-sphere's burst beat, reborn as dawn — cyan
  bloom for a load, gold bloom for a run. Reduced-motion: no bloom, target snaps.

## 5. The living legend line

One quiet mono line in the space the pills vacated, directly between the axiom (above)
and `active_modules` (below). It is a **lure, not a manual** — "the kernel of quintessence
is only for those asking for purpose." It never hands over the meaning; it names where
the meaning is buried (the kernels) and rewards the seeker who loads one and watches dawn
break. Poetic register, terminal-native, points inward/downward at the kernels.

State machine, keyed on `{ loaded: loadedDistinct, run: ranDistinct }` (first-draft copy —
doctrine lines are always first-draft, user-tunable):

| State | Condition | Line (draft) |
|-------|-----------|--------------|
| night     | `loaded === 0`            | `☿ night · no theory yet compiled` |
| dawn      | `loaded > 0 && run === 0` | `☿ dawn · {loaded} loaded, not yet real` |
| daylight  | `run > 0`                 | `☿ daylight · {run} burned into knowledge` |

Pure function `legendLine({ loaded, run })` → string; trivially unit-testable.

## 6. Architecture — three units, clean boundaries

1. **`frontier.js` (pure)** — no React, no WebGL.
   - `frontierFromTotals(totals, N) → { twilight, day }` (section 3 math + easing).
   - `legendLine({ loaded, run }) → string` (section 5 table).
   - Fully unit-tested (mirrors `observatoryBus.test.js` / `resolveEyeState.test.js`).

2. **`useCompileFrontier(N)` (hook)** — subscribes to `observatoryBus`, runs
   `frontierFromTotals`, and tracks flares. Returns
   `{ twilight, day, loaded, run, flare }` where `flare = { kind: 'load'|'run', ts } | null`
   set from the subscribed event's `kind`. All bus wiring isolated here; the shader stays
   pure.

3. **`MercuryTerminator.jsx` (shader component)** — modeled directly on
   `ObserverEye.jsx`: full-screen-quad fragment shader, analytic lit sphere, fbm
   quicksilver surface, `rAF` + 40 ms `setTimeout` watchdog (survives suspended-rAF
   preview panes), DPR sizing, `WEBGL_lose_context` cleanup on unmount, reduced-motion
   snap. **Pure renderer** — takes numeric props, knows nothing of the bus. A second
   WebGL context alongside the nav eye is trivial (browsers allow ~16).

   ```jsx
   <MercuryTerminator
     twilight={0..1}          // night→twilight frontier target
     day={0..1}               // twilight→day frontier target (≤ twilight)
     flare={{kind,ts}|null}   // triggers a bloom sweep
     size={180}
     onClick={toMercury}
     title="☿ mercury — the compile frontier"
   />
   ```

   Shader sketch: lit sphere via analytic normal on a disc; `terminatorTwilight` and
   `terminatorDay` uniforms place two smoothstep bands across the surface; day side =
   state-colored (twilight → cyan/violet `#38bdf8`/`#a78bfa`; full day → gold/lime
   `#FFD700`/`#7ab800`, echoing the eye's armed/compiling palette); night side = deep
   chrome/indigo. Quicksilver = fbm-warped specular sheen drifting over the body (the
   ambient motion; independent of the frontier). Bloom envelope on `flare`.

## 7. Rendering approach (decided)

Raw WebGL, `ObserverEye` pattern. **Not** react-three-fiber — one small object doesn't
justify the dep, and the nebula work already hit r3f inline-uniform GPU-upload traps.
Consistency with the existing eye + full control + one file wins.

## 8. `KernelTab.jsx` changes

**Remove:**
- `useLyapunovSparkline` (hook, `sparklineCanvasRef`, its `<canvas>`) — deleted entirely;
  self-contained, nothing reads it.
- Desktop `useMiniSphere(sphereCanvasRef, …)` call + the desktop `<canvas ref={sphereCanvasRef}>`.
- Both status pills — `operational` **and** `leviathan: active` — from **both** the
  desktop block (~L616–627) and the mobile block (~L607–615).

**Add (desktop block only):**
- `const { twilight, day, loaded, run, flare } = useCompileFrontier(kernelBuilds.length);`
- `<MercuryTerminator twilight={twilight} day={day} flare={flare} size={180} onClick={toMercury} … />`
- The legend line: `<div className="…mono…">{legendLine({ loaded, run })}</div>` beneath Mercury.

**Keep:**
- Mobile `useMiniSphere(sphereCanvasMobileRef, …)` + the 120 px mobile dot-sphere (Mercury
  is desktop-exclusive).
- `toMercury` / `sphereFireRef` (mobile sphere still uses the fire burst).

## 9. Mobile

Untouched dot-sphere at 120 px. Both pills removed here too (wording parity). No legend
line on mobile (it explains Mercury, which mobile doesn't have). Mobile hero = title +
dot-sphere; deliberately lean, matching the 9:16 constraint. Desktop is unmistakably the
flagship.

## 10. Testing

- **Unit (`frontier.test.js`):** `frontierFromTotals` — night at empty totals, monotonic
  growth, `day ≤ twilight`, `N === 0` guard, easing concavity (small input → larger
  output). `legendLine` — correct line per state, count interpolation.
- **Browser (the project's normal way):** load the kernel tab, confirm Mercury renders
  night on cold load; click `[load]` on a kernel → cyan dawn sweep + legend flips to
  `dawn · 1 loaded`; click `[run]` → gold daylight burst + legend flips to
  `daylight · N burned`; confirm the nav eye is untouched; confirm reduced-motion snaps;
  screenshot for the palette-against-the-corner judgment (silver/gold Mercury over the
  now-pill-less corner).

## 11. Non-goals (YAGNI)

Cross-session persistence · idle-cooling/dusk · react-three-fiber · any change to the nav
`ObserverEye` · a mobile shader · simulated orbital mechanics · retaining any status pill ·
a dry percentage readout.

## 12. Open implementation details (pin during plan)

- Exact easing constant/curve against real `kernelBuilds.length`.
- Final legend copy (first-draft above; user-tunable).
- Mercury size (180 to match the retired sphere, or up to ~200 into reclaimed pill space).
- Legend placement: directly under Mercury vs. tucked at the corner's lower edge.
