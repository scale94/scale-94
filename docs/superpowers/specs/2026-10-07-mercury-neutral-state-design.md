# Mercury: neutral liquid state, no ghosts, switch-through-neutral lifecycle

Date 2026-10-07 · branch `feature/mercury-stage` · sub-project A of the author directive of 2026-10-06
(sub-project B, the softer fluid + air threads, is a separate spec).

## Goal

The /mercury tab rests on a clean, liquid-mercury planet with no elemental gas. An element is a mode you enter and
leave. Every switch passes through that neutral liquid state, so no particles from one element leak into another.

## Author rulings (2026-10-06/07)

1. NEUTRAL = the melted planet, **held liquid**, with no gas. It is a fifth state.
2. The tab **boots into neutral**. Tapping a node starts that element. Tapping the **lit** node returns to neutral. No
   new controls.
3. Element → element = **fadeOut 400 ms → neutral 300 ms → spinUp 600 ms** (~1.3 s). The old breath
   (consolidate / elongate / flow / emerge, nebula inhale + flash) is removed.
4. The neutral mirror shows a **quiet dark sky**: Sun glint + base mirror, no element sky.
5. A melt forced by neutral runs **3× faster** (TRANSMUTE_S 3 s → ~1 s).
6. **Ghosts removed**: no 300-particle idle copies of inactive elements, no 12 % idle opacity.
7. Architecture: an explicit state machine; all four flows stay mounted; a flow at fade 0 does not draw.

## States and beats

`state ∈ { neutral, fluid, thermal, earth, air }`. Each element `e` has a fade `f[e] ∈ [0, 1]`.

| From → to | Beats |
|---|---|
| neutral → e | spinUp: f[e] 0 → 1 over 600 ms |
| e → neutral (tap lit node) | fadeOut: f[e] 1 → 0 over 400 ms, then rest in neutral |
| e → e′ | fadeOut f[e] → 0 (400 ms), neutral beat (300 ms, all f = 0), spinUp f[e′] → 1 (600 ms) |

- Fades are linear in time, with eased output: easeIn for fadeOut, easeOut for spinUp. Durations are named constants.
- **Retarget.** A tap during a transition becomes the new target.
  - Fades continue from their current values, at the same rates. There are no jumps.
  - If the new target is the element currently fading out (or the one already fading in), it goes straight into (or stays in) spinUp from its current fade, with no neutral beat.
  - If it is another element, the current element fades out from its current value, then the neutral beat and spinUp
    follow.
- **Invariants.** At most two fades are ever non-zero. In the neutral state and the neutral beat, all fades are 0.
  In steady element state e, f[e] = 1 and the others are 0.
- **Large time steps** (hidden tab: rAF suspended). One `advance(dt)` with a large dt resolves the whole remaining
  sequence in that call. It lands on the target's steady state, with no stacked beats and no intermediate burst.
- **"Active element"** for UI purposes (lit node, thread line, FPS reporter, gas counts) is the element whose fade is
  rising or at 1. In neutral there is none.

## Units

### `transitionMachine.js` (new, pure, no React or three)

- `createMachine()` returns `{ state: 'neutral', target: 'neutral', beat: 'idle', fade: {fluid,thermal,earth,air} }`.
- `request(m, element)` handles a tap. Tapping the lit element means a target of `'neutral'`.
- `advance(m, dtMs)` mutates `m` and allocates nothing.
- `holdLiquid(m)` is true while `state === 'neutral'` or `beat === 'neutral'`.
- Exported constants: `FADE_OUT_MS 400`, `NEUTRAL_MS 300`, `SPIN_UP_MS 600`.

### `usePhaseTransition.js` (rewritten as a thin wrapper)

- Owns one machine and drives `advance` from its rAF with `performance.now()` deltas.
- Keeps re-rendering only when the discrete parts change (state, beat, active element), plus once per animated frame
  while a transition runs, as today.
- Exposes:
  - `activePhase` (an element, or `null` in neutral);
  - `fades`;
  - `transitionState` (the beat);
  - `holdLiquid`;
  - `triggerTransition(element)`.
- `PHASES` keeps the four elements. Neutral is not a phase.

### Planet body (`mercuryBody.js`)

- `b.holdLiquid` (boolean, default false):
  - When true, `stepBody` and `coolBody` floor `b.heatK` at `MELT_HEAT_K`, so `liquid` stays true and τ → 1.
  - Spin heating still adds heat above the floor.
- `TRANSMUTE_HOLD_S = 1`: while `holdLiquid` is set, τ steps toward its goal at `h / TRANSMUTE_HOLD_S` instead of
  `h / TRANSMUTE_S`.
- When the flag clears, nothing else changes: the heat leaks from its current value as before.
- `MercuryPlanet.jsx` sets `body.holdLiquid` each frame from the hook's `holdLiquid`.

### Canvas (`MercuryCanvas.jsx`)

- **Opacity:** `opacityFor(e) = fades[e] × 0.45`, where 0.45 is today's active opacity cap. There is no ghost floor.
- **Mounting:** each flow is mounted with `visible={fades[e] > 0}`. This is three's object visibility: no draw call, and
  no `useFrame` uniform work beyond the clock.
- **Gas counts:** always the tier's full counts (`gasCounts(base, tier.gasDensity, …)`). The ghost branch and
  `GHOST_DENSITY` go.
- `condense` is 0 for all flows. The props and uniforms stay; their removal is later cleanup.
- **Sky weights:** `skyWeights` takes `fades` directly; the weight for element e is `fades[e]`, normalised if the sum is
  above 1. In neutral every weight is 0, which gives the quiet dark sky.
- **Look check:** if the all-zero mirror reads as dead black, add one tune value `neutralSky`. It is a faint,
  colourless, slow aether term, default chosen in the look check, and 0 is allowed.
- **Nodes and thread line:** no node is lit in neutral. The thread line's opacity follows the active element's fade.
- **FPS:** `onFps` goes to the active flow. In neutral, `MercuryPlanet` reports it.

## Out of scope

- Sub-project B, the thread look. Fluid and air threads keep their current look here.
- The phone frame-time check (needs the author's hardware).
- Removing the condense plumbing.

## Testing

- **Unit, `transitionMachine.test.js`:**
  - boots into neutral;
  - `request` and lit-node toggle;
  - every row of the beats table, with exact durations;
  - retarget in each beat (no jump, at the correct rate);
  - reversal into spinUp;
  - invariants checked at a fine dt grid;
  - a large-dt jump from every beat lands on the steady state in one call;
  - `holdLiquid` truth table.
- **Unit, `mercuryBody` tests:**
  - while held, heat is ≥ `MELT_HEAT_K` and the body stays liquid through a 600 s `coolBody`;
  - the held melt goes from τ 0 to 1 in 1 s ± one step;
  - when released, the heat leaks normally.
- **Unit, `skyWeights`:** the weights equal the fades, normalised; all-zero in neutral.
- **Canvas wiring:** source pins in the repo idiom: no ghost branch, `visible` per flow, opacity from fades.
- **Live (controller, CDP :5175):**
  - boot: the gas flows' draw calls are 0;
  - neutral beat mid-switch: no gas flow visible;
  - errors are `[]`;
  - crust → switch: τ reaches 1 within ~1.1 s;
  - calm still freezes motion;
  - hide the tab mid-switch, then return: the steady target state, no burst;
  - shots of neutral, mid-fadeOut, the neutral beat and mid-spinUp, viewed before the author look.
