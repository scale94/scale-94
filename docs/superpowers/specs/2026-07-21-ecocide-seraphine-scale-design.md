# Ecocide — Seraphine's Scale

*Distinct per-lever identities + a witnessed-equilibrium collective payoff for the PROTECTION_PROTOCOL cluster.*

Date: 2026-07-21
Status: Design approved — ready for implementation plan
Predecessor: [2026-07-20-ecocide-regenerative-mirror-design.md](2026-07-20-ecocide-regenerative-mirror-design.md) (Phase 1 — the bidirectional engine this builds on)

---

## 1. Problem

The Ecocide tab is feature-complete and the regenerative mirror works: taming growth below the degrowth gate and funding the protection levers heals the world in reverse. But the **four protection levers are the one flat spot**. They are visually identical thin tracks — same 4px bar, colored fill, dot, number — distinguished only by hue, even though they play four *different* mechanical roles. And the reward for moving them is entirely downstream and diffuse (the map eventually re-greens); there is no distinct, rewarding feedback at the controls themselves.

Goal: make the levers **distinct per-lever** *and* give the act of protection a **collective payoff**, finding the sweet spot that leans into the Seraphine persona and gives depth **without tipping into a gamey jackpot** — the reward is *equilibrium*, witnessed.

## 2. Design spine

**The levers are counterweights on Seraphine's scale.** Collapse tips the beam; the four protections load the other side. Seraphine — already this tab's presiding intelligence (`Seraphine-8.8.8.8.8.8.8.8` Governance, the SARG = *Seraphine* Associative Reasoning Gain, the Paradox Governance overlay) — witnesses the result.

Two layers, both approved via animated mockups:

- **Per-lever identity** — each control *moves like what it does in the engine*.
- **Collective payoff (two-stage)** — the beam **levels first** (earn equilibrium), and only once held level does **the Eye open** (receive grace). You cannot over-tip; past balance the surplus becomes grace, not a reverse tilt.

## 3. Per-lever identities (locked)

Each lever's identity derives from its actual engine role, so the control is honest — it looks like it does.

| Lever | Engine role | Identity | Motion character |
|---|---|---|---|
| `TOXICITY_CAP` | shields — throttles extraction damage (gated) | **SEAL** — frosted blue membrane drawn over a churning toxic shimmer; poison muted where covered | viscous, a pressure-valve wobble |
| `SANCTUARY` | passive slow recovery (w=0.35) | **BREATHE** — protected pocket, slow respiration glow + a ring exhaling every ~5s | slow, weighty, tidal |
| `RESTORATION` | active bloom driver (w=0.65) | **GROW** — eager tendrils sprouting from the fill | springy, quickest rhythm |
| `NATIVE_BIODIV` | resilience — buffers relapse (newly wired, §4) | **KNIT** — interlocking mesh, nodes lighting in sequence | crystalline, deliberate |

Richness level: CSS/SVG as prototyped (validated at "socks/10"). No shaders required.

### Gated → ignite beat
While growth is **above** the degrowth gate (`GATE_HIGH = 3.0`), the levers are **dormant**: desaturated, animations *paused* (`animation-play-state: paused`), marked inert (the existing "GATE CLOSED — protections inert" note stays). The moment growth is tamed and the gate opens, the levers **ignite** — animations resume with a one-shot flare. The unlock is itself a reward, reinforcing "degrowth is the key."

## 4. Engine changes (`src/terminal/lib/ecocideEngine.js`)

Minimal, tested, and preserving all existing invariants.

### 4.1 Beam + grace derivations (no new simulation)
Pure functions of the signed vitality already computed each tick:

- `beamTilt(v)` → `clamp(-v, 0, 1)` — 1 at full collapse, 0 at homeostasis **and beyond** (holds level through positive vitality; cannot over-tip).
- `graceLevel(v)` → `max(0, v)` — equals `bloomFrac`. Drives the Eye + halo.

These are UI derivations; they do not alter the integrator.

### 4.2 NATIVE_BIODIV wired as resilience
Add `nativeBio` to `stepVitalityHybrid`'s levers and a new tuning constant `RESILIENCE_STRENGTH`. Diversity **damps the damage rate in proportion to the bloom already earned**, representing a diverse biosphere that re-collapses more slowly when growth spikes back up:

```
bloomFrac  = max(0, prevV)                              // the bloom earned so far
resilience = 1 - RESILIENCE_STRENGTH * nativeBio * bloomFrac
damage    *= resilience
```

- **Gated on earned bloom, not on growth.** This is the key correction: relapse happens when the operator re-raises growth (which *closes* the degrowth gate). Gating resilience on `bloomFrac` means a world you already healed resists that relapse — whereas gating on the growth gate would switch resilience off exactly when it is needed.
- **Greenwash invariant preserved:** on a collapsing / never-bloomed world `bloomFrac = 0`, so `resilience = 1` and `nativeBio` maxed changes *nothing*. You cannot skip degrowth — resilience only pays out on bloom you had to earn (via the gate) first. Asserted in tests.
- **Palette:** `nativeBio` widens the bloom color range the map already gestures toward (the `// nativeBio widens the palette later` branch in `EcocideTab.jsx` becomes real).

`RESILIENCE_STRENGTH` starts modest (≈0.3) — sanctuary/restoration remain the primary heal; native_biodiv is the stabilizer, not a second bloom driver.

## 5. The collective — beam cradle + the Eye (perf-first)

**Decision: implied balance, not literal tilt.** The world map **stays upright** — the 177 fracturing country cells are never transformed by the beam. The balance is *implied*:

- **Beam** — a slim SVG arc cradles the **base of the sphere**, fulcrum triangle at bottom-centre. **Only the beam group rotates**, by `beamTilt(v) * MAX_TILT` — a single GPU-composited transform, effectively free. The Earth reads as "the thing in the balance" because the beam holds it; the map's own re-greening supplies the rest.
- **The Eye** — crowns the sphere. **Unmounted entirely when `bloomFrac ≤ 0.02`**, so pure-collapse (the common case) pays zero added cost. As bloom crosses in, the lid opens (`scaleY`) and the iris glow scales with `graceLevel`.
- **Whisper of halo** — one cheap CSS `radial-gradient` behind the Eye, `opacity = graceLevel`. **No `feGaussianBlur` anywhere.**
- **Collapse-side weight (optional, minimal):** a subtle ember/weight cue on the collapse side scaling with `deadFrac`, only if it costs nothing meaningful; cut first if perf budget tightens.

## 6. Performance plan (non-negotiable for option C)

- **No new `requestAnimationFrame` loop.** Beam angle and Eye state ride the existing 10 Hz `mapState` update; CSS transitions interpolate to 60 fps. (Reuses the pipeline in `EcocideTab.jsx`.)
- Beam = one transform. Eye = mounted only during bloom. Halo = CSS gradient, not an SVG filter.
- **Map layer untouched** (upright) — the expensive 177-cell layer is not made heavier.
- Honor the existing perf tier (cf. `perf(boot): trim mobile repaint cost of glow/blur`) and `prefers-reduced-motion` (pause lever animations, static beam/eye).

## 7. Architecture & files

- **Extract components out of `EcocideTab.jsx`** (currently 1295 lines):
  - `src/terminal/views/ecocide/ProtectionLevers.jsx` — the four identity sliders (`SealSlider`, `BreatheSlider`, `GrowSlider`, `KnitSlider`) + gated/ignite state. Replaces the generic `ProtocolSlider`.
  - `src/terminal/views/ecocide/SeraphineScale.jsx` — beam cradle + Eye + halo, driven by `mapState` (`bloomFrac`, `vitality`/derived tilt).
  - (Final filenames may adjust to match repo conventions during implementation.)
- **`EcocideTab.jsx`** — pass `nativeBio` into the `stepVitalityHybrid` call; render `SeraphineScale` inside the hero (upright map, beam cradle beneath, Eye above); swap `ProtocolSlider` usages for the identity levers.
- **`ecocideEngine.js`** — `nativeBio` resilience term, `RESILIENCE_STRENGTH`, `beamTilt`/`graceLevel` helpers.

## 8. Testing & verification

- **Unit (`ecocideEngine.test.js`):**
  - `beamTilt` / `graceLevel` boundary behavior (collapse → level → hold through bloom; no over-tip).
  - `nativeBio` resilience: on a never-bloomed world (`prevV ≤ 0`) `nativeBio = 1` changes damage by 0 — **greenwash invariant** holds even at high growth; on a bloomed world (`prevV > 0`) `nativeBio = 1` measurably slows relapse vs `nativeBio = 0` at the same growth.
  - Existing collapse tick-for-tick behavior unchanged when all levers 0 (regression).
- **Browser:** verify both directions (collapse + heal) as in Phase 1; confirm levers ignite on gate open; confirm Eye mounts only during bloom.
- **Mobile-perf sanity pass:** confirm no regression vs current hero (no new rAF, no SVG blur, map untransformed).
- Full suite green (581+ tests) before any merge.

## 9. Out of scope / non-goals

- No literal map tilt (vetoed on perf).
- No shader work — CSS/SVG only.
- No change to the collapse integrator's velocity or the observatory `PHASE_NAME` contract.
- Not pushed on completion — merge to local `main` per standing rule; pushing requires an explicit command.
