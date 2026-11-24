# Observer Eye Quest-Giver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the masthead Observer Eye into the terminal's one diegetic instrument. Silver is always the baseline. Every deliberate act gets a distinct shader reaction, forward riddle whispers lead to untouched mechanics, the armed state becomes Aether, and the seal detonates into a violent crescendo.

**Architecture:** A new no-React `observerStore` absorbs and retires `guidanceStore`. It subscribes to `observatoryBus`, the spine and window input, filters for deliberate acts, and publishes three things: transient impulses, `{flash, glance, whisper, igniting, ...}` state, and a session trail. `resolveEyeState` shrinks to baseline + overlay. `ObserverEye` keeps one shader, gains new uniforms that are zero by default, and exposes an imperative `kick`/`detonate` handle that writes into its easing state without a React render.

**Tech Stack:** React 18, raw WebGL1 via `src/terminal/gl/useShaderCanvas.js`, Vitest + jsdom, the dependency-free CDP driver `scripts/cdp.mjs` (headless Chrome, `--enable-unsafe-swiftshader`).

**Spec:** `docs/superpowers/specs/2026-11-24-observer-eye-quest-design.md` (APPROVED). Background: `docs/superpowers/audits/2026-11-24-quintessence-wiring-audit.md`.

## Global Constraints

- Lint gate: `npm run lint` passes (0 errors, `--max-warnings 143` in package.json); don't sweep `exhaustive-deps`.
- The spine and seal stay in localStorage. Only the observer trail uses sessionStorage, key `observer_trail_v1`. Every storage call goes in try/catch; refused storage means a volatile in-memory trail.
- Bus emits never run synchronously inside a React render or state updater. Use the `setTimeout(…, 0)` pattern from `App.handleNav`.
- Shader budget: 4 fbm calls × 5 octaves, unchanged. No texture reads. The new uniforms at default values must render today's pixels.
- glParity: never run with `-u` except the single reviewed regeneration commit in Task 2 (D18).
- Riddle voice: lower-case, `·` separators, no UI verbs ("click", "press", "go to", "tap").
- Tabs gain bus emits only. No new UI inside any tab.
- Never push. Commit per task on `feature/eye-ambient`.
- Hidden browser panes suspend rAF and lie about timers. Visual and timing checks go through `scripts/cdp.mjs` or a visible tab.

## Review Focus

1. **Tab-hopping during a glance or whisper.** A nav flash cancels any glance, and when the flash ends no second hue returns (the amber jump). Pinned in Task 5.
2. **Storage refused** (Safari private mode, sessionStorage throws). The trail runs in memory, whispers still never repeat within the page life, nothing throws. Pinned in Task 5.
3. **Leaving the altar mid-ignition.** `igniting` returns to false and the eye leaves `charging`. Pinned in Tasks 3 and 4.
4. **Reload after a seal.** The eye starts in silver + thread straight away, the crescendo does not replay, and nothing whispers at sealed vertebrae. Pinned in Task 4.
5. **WebGL unavailable, or an early/late `kick`.** `kick`/`detonate` before mount, after unmount, or with no GL host are no-ops. Under reduced motion they snap to a static hold. Pinned in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| Create `src/terminal/components/observerEyeShader.js` | VS/FS sources, uniform list, `KICK` enum. Plain JS so node scripts can import it |
| Create `scripts/fixtures/observerEyeFS.v1.glsl` | Frozen pre-change FS, the pixel-parity reference |
| Create `scripts/eyeParity.mjs` | CDP pixel parity: v1 FS vs current FS at a state table |
| Modify `src/terminal/components/ObserverEye.jsx` | New states, props, uniform pushes, `forwardRef` handle |
| Create `src/terminal/quintessence/observerStore.js` | Agency reducer, impulses, flash, glance, whispers, trail, idle clock, chrome |
| Create `src/terminal/quintessence/whispers.js` | Riddle corpus (data only) + piece↔tab tables |
| Delete `src/terminal/quintessence/guidanceStore.js` (+ its test), in Task 7 | Retired. `NAV_TINTS` and `notifyNav` move to `observerStore` |
| Modify `src/terminal/components/resolveEyeState.js` | Baseline + overlay only; `pulseTabFor` removed |
| Modify `src/terminal/components/MercuryEyeIndicator.jsx` | Wiring, whisper toast, telemetry, dead CSS and poll removed |
| Modify `src/terminal/App.jsx` | `startObserver`, chrome visibility both ways, nav beat from glance, beat on 5 more buttons |
| Modify 6 emit sites | `QuintessenceAltar.jsx`, `SolTab.jsx`, `useMercuryDrag.js`, `EcocideTab.jsx`, `ArtTab.jsx:967`, (none in BskyTab/LunarTab; those flow through the spine) |

---

### Task 1: Extract the shader and build the pixel-parity gate

**Files:**
- Create: `src/terminal/components/observerEyeShader.js`, `scripts/fixtures/observerEyeFS.v1.glsl`, `scripts/eyeParity.mjs`
- Modify: `src/terminal/components/ObserverEye.jsx:39-78` (import instead of inline)

**Interfaces:**
- Produces: `export const VS: string`, `export const FS: string`, `export const UNIFORMS: string[]` (today's 9 names, same order) from `observerEyeShader.js`. Running `node scripts/eyeParity.mjs` exits 0 on parity and 1 with a per-state report otherwise.

- [ ] **Step 1:** Move `VS`/`FS` and the uniform name list verbatim into `observerEyeShader.js`. ObserverEye imports them. Write the FS string byte-for-byte to `scripts/fixtures/observerEyeFS.v1.glsl`.
- [ ] **Step 2:** Run `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx src/terminal/components/__tests__`. Expected: PASS. The source is identical, so the snapshot hash is unchanged.
- [ ] **Step 3: Write `scripts/eyeParity.mjs`.**
  - Build one HTML page (data URL) with two 128×128 WebGL canvases, compiled from the v1 fixture and the current `FS`.
  - For each state row, set every v1 uniform to the row values on both canvases, set every new uniform (none yet) to 0, draw, and `readPixels`.
  - Fail if any channel differs by more than 2/255, or if more than 0.1 % of pixels differ.
  - State rows: `resting`, `leaning` tinted `[56,189,248]` + gaze `[0.12,-0.08]`, `armed`, `compiling`, `complete`, each at `u_t ∈ {0, 7.3, 41.9}` and `u_pulse ∈ {0, 1}`.
  - Uniform values come from `STATES` in ObserverEye, copied into the script as a table.
  - Use `launch` from `scripts/cdp.mjs`.
- [ ] **Step 4:** Run `node scripts/eyeParity.mjs`. Expected: `eye parity: 30/30 rows identical`, exit 0.
- [ ] **Step 5: Commit.** `refactor(eye): extract ObserverEye shader + pixel-parity gate`.

### Task 2: Extend the shader, the states and the imperative handle

**Files:**
- Modify: `observerEyeShader.js`, `ObserverEye.jsx`
- Test: `src/terminal/components/__tests__/observerEyeHandle.test.jsx` (new), `glParity` snapshot (regenerated, own commit)

**Interfaces:**
- Consumes: Task 1 exports.
- Produces:
  - `observerEyeShader.js`:
    - `UNIFORMS` = today's 9 + `u_core, u_orbit, u_shimmer, u_thread, u_turb, u_kick, u_kickKind, u_kickDir`.
    - `export const KICK = { inhale:1, miosis:2, merge:3, split:4, quantize:5, ring:6, sag:7, ripple:8, packet:9, stare:10, shove:11, spiral:12, sweep:13, flutter:14 }`.
  - ObserverEye states: `STATES` gains `aether` and `charging`. Existing states keep their values.
  - ObserverEye props: new `thread = 0` (0..1), `shimmer = 0` (0..1). Existing props unchanged (`ElementSeal` keeps working).
  - `forwardRef` handle:
    - `kick({ kind: number /* KICK */, tint: [r,g,b]|null, dir?: -1|1, durationMs: number, strength?: number /* 0..1, default 1 */ }): void`
    - `detonate(): void`

- [ ] **Step 1: Write the failing tests** in `observerEyeHandle.test.jsx`, with the glParity-style fake GL:
  - `kick_writes_uniforms_without_render`: render, spy on React render count, call `ref.current.kick({kind: KICK.merge, tint:[217,70,239], durationMs:1100})`, advance 5 frames. Assert `u_kick > 0` and `u_kickKind === 3` were pushed, and the render count did not change.
  - `kick_decays_to_zero`: after `durationMs + 200` ms of frames, the last pushed `u_kick === 0`.
  - `detonate_runs_crescendo_phases`: the pushed `u_core` rises then falls to ≤ 0.01 by 250 ms. `u_turb` peaks ≥ 0.9 between 250–600 ms. At ~5600 ms both are ≈ 0.
  - `handle_is_noop_without_host`: with `createShaderHost` returning null, `kick` and `detonate` do not throw. Also no throw before mount (ref captured, then component unmounted, then called).
  - `defaults_push_zero`: with no kick and default props, every new uniform is pushed as 0 on every frame.
  - `reduced_motion_kick_holds_static`: stub `matchMedia` to reduce. After `kick`, the snap paints once with the kick colour and `u_t` stays 0. After `durationMs` a second snap restores the baseline.
- [ ] **Step 2:** Run `npx vitest run src/terminal/components/__tests__/observerEyeHandle.test.jsx`. Expected: FAIL (no handle).
- [ ] **Step 3: Implement the shader.** Each new term is multiplied by its uniform, so zero is an exact no-op.
  - `u_core`: an additive pinpoint `exp(-r²/σ²)` (σ ≈ 0.035) in white-gold. When `u_core > 0` it overrides the pupil darkening.
  - `u_orbit`: scales the `q` warp amplitude by `(1 − 0.8·u_orbit)` and the swirl term up by `(1 + 0.6·u_orbit)`.
  - `u_shimmer`: glints on `n > 0.78`, cycling pale gold `(1,.92,.7)`, ice `(.85,.95,1)`, violet `(.8,.7,1)` by angle and time.
  - `u_thread`: a thin teal `(20,184,166)` filament riding the `u_irid` sweep at ~0.35 alpha.
  - `u_turb`: adds to the warp amplitude and to `u_speed`.
  - `u_kick`/`u_kickKind`/`u_kickDir`: one `if` per kind. Spec §5.5 gives the look of each primitive; the exact maths is the builder's.
  - Reduced motion is handled in JS, not GLSL.
- [ ] **Step 4: Implement the ObserverEye side.**
  - `aether` = `{ irid:1, cols: resting cols, speed:0.06, focus:0.08, gaze:[0,0], core:0.85, orbit:1, shimmer:1 }`.
  - `charging` = aether with `core` ramping 0.85→1.6 and `orbit` 1→1.4 over 5 s from entry (time-based, on the eased `cur`).
  - The kick envelope: attack 120 ms linear, then exponential decay to 0 at `durationMs`.
  - `detonate` phases: implosion 250 ms (`core`→0, `focus`→0.95), detonation 350 ms (`u_kick` white-gold ring at 1, `turb`→1, speed ×4), storm 2000 ms (`turb` 1→0.6, gaze jitter ±0.03), settle 3000 ms (everything eases to the baseline).
  - All envelopes are frame-rate independent and run on `tsec`.
- [ ] **Step 5:** Run the handle tests. Expected: PASS.
- [ ] **Step 6:** Run `node scripts/eyeParity.mjs`. Expected: exit 0. The v1 rows render identically with the new uniforms at 0.
- [ ] **Step 7:** Run `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx`. Expected: FAIL, in `init` (new source hash and lookups) and `frames` (the new uniform pushes) only. Read the diff and confirm only those differ.
- [ ] **Step 8: Commit** the code (the snapshot still failing is expected): `feat(eye): Aether/charging states, star-core, kick + detonate handle`.
- [ ] **Step 9: Regenerate the snapshot (D18).** Run `npx vitest run src/terminal/gl/__tests__/glParity.test.jsx -u`, then the full `npx vitest run`. Expected: PASS. Commit only the `.snap` file, with a message body naming the eyeParity run (30/30 identical) as the evidence: `test(gl): regenerate ObserverEye glParity snapshot (reviewed, D18)`.

### Task 3: Bus emits at the six sites

**Files:**
- Modify: `src/terminal/mercury/QuintessenceAltar.jsx:105-155`, `src/terminal/views/SolTab.jsx:88-111`, `src/terminal/mercury/useMercuryDrag.js` (`endDrag`), `src/terminal/views/EcocideTab.jsx` (`GrowthSlider` pointerup, ~line 240), `src/terminal/views/ArtTab.jsx:967`
- Test: `src/terminal/quintessence/__tests__/quintessenceAltar.test.jsx` (extend), `src/terminal/mercury/__tests__/useMercuryDrag.test.jsx` (new or extend), `src/terminal/views/__tests__/solRelease.test.jsx` (new, thin)

**Interfaces:**
- Produces these bus events (category/kind and payload):
  - `edge/kernel_ignited {element}`: right after `setElement`.
  - `edge/kernel_sealed {hash}`: in the same synchronous block as `setStage(6)`. `hash` comes from the artifact meta (whatever field `compileKernel` names the BUILD hash).
  - `edge/kernel_ignite_ended {sealed:false}`: in `finally` when no seal was emitted. This covers the catch path and all four `!alive.current` returns.
  - `gaze/sol_release {energyErg, handedness, hand}`, with `hand = ev.origin === 'hand'`. Fires on every snap, not only on the facing ones that launch a cloud.
  - `gaze/mercury_flick {speed, dir, hand:true}`: on pointerup when the tracker's release angular speed is above `FLICK_MIN` (export it from `useMercuryDrag.js`; start at the value that makes the planet visibly coast, measured in the CDP page). `dir` is ±1 from the release spin sign.
  - `gaze/ecocide_growth_set {growthRate, hand:true}`: on slider pointerup only, not per move.
  - `gaze/art_bifurcation {count, hand:true}`: at `ArtTab.jsx:967` only. The chimera-injection emit at `:4416` stays unflagged.

- [ ] **Step 1: Write the failing tests.**
  - Altar `emits_kernel_sealed_same_tick_as_stage6`: subscribe to the bus. Drive `ignite` with the existing test doubles. Assert the `kernel_sealed` emit happens before the next macrotask after stage 6 renders, and `kernel_ignited` came first.
  - Altar `emits_ignite_ended_on_unmount_midway`: unmount during stage 1. Assert one `kernel_ignite_ended` and no `kernel_sealed`.
  - Altar `emits_ignite_ended_on_compile_throw`.
  - Drag `flick_emits_above_threshold_only`: synthetic pointerdown/move/up fast emits once with `hand:true`; slow emits nothing.
  - Sol `release_tags_hand_origin`: `onSnap` with `origin:'star'` → `hand:false`; with `'hand'` → `hand:true`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Add the emits. Each goes through the bus `emit`, deferred with `setTimeout(0)` wherever the site is inside a state updater. The altar's `ignite` is an async function body, not a render, so it emits directly.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS (existing suites included).
- [ ] **Step 5: Commit.** `feat(observatory): seal/ignition, sol release, mercury flick, growth, hand-flag emits`.

### Task 4: `observerStore`, part 1: agency reducer, impulses, flash, seal state

**Files:**
- Create: `src/terminal/quintessence/observerStore.js`, `src/terminal/quintessence/whispers.js` (tables only in this task)
- Test: `src/terminal/quintessence/__tests__/observerStore.test.js`

**Interfaces:**
- Consumes: `observatoryBus.subscribe`, `spineStore.getSpine/subscribeSpine`, `sealedArtifact.loadSealedArtifact`, `volatileHold.heldVolatile`, the Task 3 events, `KICK` from Task 2.
- Produces (from `observerStore.js`):
  - `export const NAV_TINTS`: copied verbatim from guidanceStore (guidanceStore is deleted in Task 7, once nothing imports it).
  - `export function startObserver({ tab }: { tab: string }): void`: idempotent; sets the landing tab with no flash.
  - `export function notifyNav(tab: string): void`: 1.5 s flash, as today.
  - `export function subscribeImpulse(fn: (imp: Impulse) => void): () => void`
    - `type Impulse = { piece: string, kind: number, tier: 'witness'|'vertebra'|'crescendo', tint: [r,g,b]|null, dir: -1|1, durationMs: number, at: number }`
  - `export function getObserver(): ObserverSnap` and `export function subscribeObserver(fn): () => void`
    - `type ObserverSnap = { flash, glance, whisper, igniting: boolean, sealed: boolean, remarkedSinceSeal: boolean, wantsChrome: boolean }`
    - `glance`, `whisper` and `wantsChrome` stay null/false until Task 5.
  - `export function _resetObserverForTests({ random?, now? })`
- In `whispers.js`:
  - `PIECE_TAB = { 'mercury.flick':'mercury', 'bsky.trend':'bsky', 'accretion.collide':'manifesto', 'lunar.phase':'lunar', 'scent.collide':'scaling', 'chaos.pick':'art', 'sol.release':'sol', 'crypto.seal':'cryptography', 'ledger.write':'ledger', 'transmission.mark':'transmission', 'ecocide.growth':'ecocide', 'surveillance.privacy':'surveillance', 'kernel.run':'kernel', 'altar.ignite':'mercury' }`
  - `TAB_PIECES`: the inverse, as lists.
- Constants (exported): `FLASH_MS = 1500`, `WITNESS_MS = 1100`, `VERTEBRA_MS = 2200`, `CRESCENDO_MS = 5600`.
- Reducer table: spec §5.2, copied as a single `const RULES` keyed by `category/kind`. A mixed kind passes only when `payload.hand === true`. `gaze/tab_navigated` with `tab:'privacy'` → impulse `stare` + piece `surveillance.privacy`.
- Kick kind per piece:

  | Piece | Kick |
  |---|---|
  | kernel.load | inhale |
  | kernel.run | miosis |
  | scent.collide | merge |
  | chaos.pick, chaos.fork | split |
  | crypto.seal | quantize |
  | sol.release | ring |
  | ecocide.growth | sag |
  | ledger.write | ripple |
  | transmission.mark | packet |
  | surveillance.privacy | stare |
  | mercury.flick | shove |
  | accretion vertebra | spiral |
  | lunar vertebra | sweep |
  | bsky vertebra | flutter |

  The tint is `NAV_TINTS[PIECE_TAB[piece]]`, except `mercury.flick`, whose tint is null (silver on silver; the motion carries it).

- [ ] **Step 1: Write the failing tests** (fake timers, `_resetSpineForTests`, bus `_resetForTests`):
  - `sim_events_produce_no_impulse`: emit `art_regime`, `art_chimera`, `ecocide_phase`, `art_bifurcation` without `hand`, and `sol_release {hand:false}`. Expect 0 impulses.
  - `hand_events_produce_witness`: `collision_fired` → `{piece:'scent.collide', kind:KICK.merge, tier:'witness', durationMs:1100}`.
  - `first_vertebra_mark_is_vertebra_tier_remark_is_witness`: `setTrend` twice → tiers `vertebra`, then `witness`.
  - `council_collision_plus_spine_write_coalesce`: `setCouncil` and `edge/council_collision` in the same tick → exactly 1 impulse (`spiral`, vertebra).
  - `element_write_starts_ignition_not_vertebra`: `kernel_ignited` (preceded by `setElement`) → `igniting:true`, no vertebra impulse.
  - `kernel_sealed_fires_crescendo_and_seals`: → impulse tier `crescendo`, `sealed:true`, `igniting:false`, `remarkedSinceSeal:false`.
  - `ignite_ended_clears_igniting` (Review Focus 3).
  - `reload_with_seal_starts_sealed_without_crescendo` (Review Focus 4): a seal in localStorage before `startObserver` → `sealed:true` and 0 impulses.
  - `remark_after_seal_sets_remarkedSinceSeal`: after a seal, `setPhase(valid)` → true.
  - `lower_tier_never_interrupts_higher`: a witness emitted within `CRESCENDO_MS` after a crescendo → no impulse published. A witness within `VERTEBRA_MS` after a vertebra → none.
  - `notifyNav_flash_expires`: `flash` is set, then null after 1500 ms.
- [ ] **Step 2:** Run `npx vitest run src/terminal/quintessence/__tests__/observerStore.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement**, in the `spineStore`/`guidanceStore` discipline: a listener Set, per-listener try/catch, no React. Coalescing works through `piece` + same-macrotask dedupe (a `queueMicrotask`-flushed pending map). Sealed state reads `loadSealedArtifact() || heldVolatile()` at start, then follows the events.
- [ ] **Step 4:** Run the tests, then `npx vitest run`. Expected: PASS everywhere (guidanceStore is untouched in this task).
- [ ] **Step 5: Commit.** `feat(eye): observerStore agency reducer + impulses`.

### Task 5: `observerStore`, part 2: glances, whispers, trail, idle clock, chrome

**Files:**
- Modify: `observerStore.js`, `whispers.js` (add `RIDDLES` from spec Appendix A, verbatim)
- Test: `observerStore.test.js` (extend)

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `export function setChromeVisible(v: boolean): void`
  - `getObserver()` now fills:
    - `glance: { tab, tint, shimmer: boolean, reason: 'compass'|'whisper', phase: 'in'|'hold'|'out' } | null`
    - `whisper: { id: string, text: string, piece: string } | null`
    - `wantsChrome: boolean`: true while a whisper shows or while igniting or within `CRESCENDO_MS` of a seal.
  - `RIDDLES: Record<piece, string[]>`. Whisper ids are `${piece}:${index}`.
  - Constants (exported):

    | Constant | Value |
    |---|---|
    | `QUIET_MS` | 8000 |
    | `GLANCE_IN_MS` | 1200 |
    | `GLANCE_HOLD_MS` | 3000 |
    | `GLANCE_OUT_MS` | 1500 |
    | `GLANCE_GAP_MS` | 25000 |
    | `IDLE_MS` | 13000 |
    | `COOLDOWN_MIN_MS` | 60000 |
    | `COOLDOWN_MAX_MS` | 90000 |
    | `AFTER_REACTION_MS` | 2500 |
    | `WHISPER_MS` | 6000 |
    | `PHRASE_BUSY_MS` | 5100 |
    | `MOBILE_HOLD_MS` | 30000 |

  - The trail is `observer_trail_v1` in sessionStorage: `{ touched, spent, idleSpent, lastWhisperAt, actedOnce }`.
- Rules (spec §5.7–5.8):
  - **Input.** The idle clock resets on `pointerdown`/`keydown`/`wheel`/`touchstart` (window, capture, passive) and on `notifyNav`.
  - **Phrase busy.** `kernel_loaded`/`kernel_completed` start a `PHRASE_BUSY_MS` window in which a whisper waits.
  - **Compass glance.** Fires only when not armed, not sealed, and some vertebra is unmarked. Requires ≥ `QUIET_MS` since the last flash, impulse or whisper end, and ≥ `GLANCE_GAP_MS` since the last compass glance. A flash or impulse during a glance cancels it immediately (`glance → null`).
  - **Target order.** `mercury.flick`, then the unmarked vertebrae in `VERTEBRAE` order, then `scent, chaos, sol, crypto, ledger, transmission, ecocide, surveillance, kernel`, then `altar.ignite` only when armed. A piece is done when `touched[piece]`, or, for a vertebra, when the spine has it. A piece with no unspent riddle is skipped.
  - **Forward whisper.** Requires `actedOnce`, `AFTER_REACTION_MS` after an impulse settles, and the cooldown (`lastWhisperAt + random[60–90 s]`). Exception: the visit's first whisper ignores the cooldown. Skips the current tab's pieces.
  - **Idle whisper.** Fires after `IDLE_MS` without input on the current tab when `!idleSpent[tab]`, the tab has an undone piece, and the cooldown allows. It doesn't need `actedOnce`.
  - **On fire.** Mark the id spent and set `lastWhisperAt`. Start a whisper glance (`reason:'whisper'`, tint from `PIECE_TAB`; `shimmer:true` and tint null for mercury pieces). `whisper` clears after `WHISPER_MS`.
  - **Mobile.** When chrome isn't visible, a whisper is pending. It shows when `setChromeVisible(true)` arrives within `MOBILE_HOLD_MS`; otherwise it's dropped and **not** marked spent.

- [ ] **Step 1: Write the failing tests:**
  - `flash_cancels_glance_and_nothing_reasserts` (Review Focus 1): reach a compass glance, `notifyNav('kernel')`, advance 1600 ms → `flash:null`, `glance:null`, and `glance` stays null for the next `QUIET_MS − 1`.
  - `compass_glance_waits_quiet_window_and_gap`
  - `compass_glance_points_at_first_unmarked_vertebra_before_any_mark`: fresh spine → glance tab `bsky`.
  - `no_compass_when_armed_or_sealed`
  - `idle_whisper_fires_at_IDLE_MS_on_mercury_without_prior_act`: `startObserver({tab:'mercury'})`, advance 13000 → whisper piece `mercury.flick`, glance `shimmer:true`.
  - `pointermove_does_not_reset_idle_but_pointerdown_does`
  - `forward_whisper_needs_first_act_and_skips_current_tab`
  - `cooldown_60_90_between_whispers_except_first`
  - `marked_vertebra_never_whispered` (D10)
  - `spent_survives_store_restart_within_session`: re-`_reset` while keeping sessionStorage → the same id is not reused.
  - `session_storage_throwing_is_volatile_and_safe` (Review Focus 2): stub `sessionStorage.setItem/getItem` to throw. Nothing throws, and ids aren't repeated within the run.
  - `whisper_waits_for_chrome_and_drops_unspent_after_30s`
  - `wantsChrome_true_during_whisper_and_crescendo`
  - `whisper_waits_while_kernel_phrase_busy`
  - `riddles_have_no_ui_verbs`: every `RIDDLES` line fails to match `/\b(click|press|tap|go to|scroll)\b/i`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement it with one scheduler `setTimeout`, re-armed on every state change. Don't use intervals.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(eye): glances, forward/idle whispers, session trail, chrome hold`.

### Task 6: `resolveEyeState`, baseline + overlay

**Files:**
- Modify: `src/terminal/components/resolveEyeState.js`, `src/terminal/components/__tests__/resolveEyeState.test.js` (rewrite)

**Interfaces:**
- Consumes: `VERTEBRAE`; the `ObserverSnap` fields.
- Produces: `resolveEyeState({ spine, sealed, igniting, remarkedSinceSeal, flash, glance }) → { state: 'resting'|'aether'|'charging'|'leaning', tint, gaze, pulse: boolean, thread: 0|1, shimmer: 0|1, baseline: 'silver'|'aether'|'charging' }`. `pulseTabFor` is deleted.
- Table (spec §5.4, D15):
  - **Baseline:**
    - `igniting` → charging.
    - Otherwise, sealed and not remarked → silver, thread 1.
    - Otherwise, all three vertebrae marked → aether (thread 1 if sealed).
    - Otherwise → silver.
  - **Overlay:**
    - A flash → `leaning` + the flash tint, `gaze:null`.
    - Otherwise a glance with a tint → `leaning` + the tint, gaze `[0.15,-0.04]`, `pulse:true`.
    - Otherwise a glance with `shimmer` → the baseline state + `shimmer:1` + gaze `[0.15,-0.04]`.
  - `baseline` always reports the underlying baseline, for telemetry.

- [ ] **Step 1:** Rewrite the tests as a table, one row per baseline × overlay combination. Include `sealed_rearmed_spine_stays_silver_thread` (the reviewer's Q1) and `flash_overrides_glance`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(eye): resolveEyeState = baseline + overlay (silver always returns)`.

### Task 7: Wire the indicator and App

**Files:**
- Delete: `src/terminal/quintessence/guidanceStore.js`, `src/terminal/quintessence/__tests__/guidanceStore.test.js`
- Modify: `src/terminal/quintessence/__tests__/vertebrae.test.js` (import `NAV_TINTS` from observerStore), `src/terminal/components/MercuryEyeIndicator.jsx`, `src/terminal/App.jsx` (imports ~59-61, pulse block 618-627, `handleNav` 630-649, chrome 306-325, eye mount 1173-1181, nav buttons for /SCENT, /SOL, /SURVEILLANCE, /CRYPTOGRAPHY, /KERNEL)
- Test: `src/terminal/components/__tests__/mercuryEyeIndicator.test.jsx` (new)

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6.
- Produces:
  - `MercuryEyeIndicator({ activeTab, onNavigate, lastKernelAt, lastLoadAt, mobileChrome })`
  - Telemetry: `edge/eye_phase {phase: 'silver'|'aether'|'charging'|'crescendo'|'sealed'}` and `edge/eye_whisper {piece}`.

- [ ] **Step 1: Write the failing tests** (mock `ObserverEye` to a forwardRef stub that records `kick`/`detonate` calls and props):
  - `impulse_calls_kick_with_kind_tint_duration`
  - `crescendo_impulse_calls_detonate`
  - `whisper_renders_in_phrase_slot_with_riddle_colour`: the text appears, and its colour differs from the amber phrase colour `rgba(232,210,138,0.65)`.
  - `no_setInterval_seal_poll`: spy `setInterval`; mount; expect no calls.
  - `eye_phase_emits_crescendo_then_sealed`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement the indicator.**
  - Subscribe to `subscribeObserver` and `subscribeImpulse`. Impulses map to `eyeRef.current.kick(...)`, and the crescendo maps to `detonate()`.
  - Pass the `resolveEyeState` output into `<ObserverEye ref=… state tint gaze pulse thread shimmer>`.
  - Show the whisper in the existing phrase slot: same box, colour `rgba(200,196,232,0.75)`, ~6 s animation.
  - Keep the kernel flare as `KICK.miosis` coming from the store, and delete the local `flaring` timer.
  - Remove `deepWatch`, the 2 s poll, and all `mei-spectrum-*` / `mei-breath*` / `mei-flare` keyframes. Keep `mei-phrase`.
  - Keep the existentialist pools and their load/run triggers unchanged.
- [ ] **Step 4: Implement the App changes.**
  - Call `startObserver({ tab: LANDING_TAB })` once, after boot ends.
  - Import `notifyNav` from `observerStore`.
  - Call `setChromeVisible(mobileChrome)` in an effect, and OR the store's `wantsChrome` into the header's visibility class. While `wantsChrome` is true, skip the hide timer.
  - Pass `mobileChrome` to the indicator.
  - Set `pulseTab = getObserver().glance?.tab ?? null` (subscribed). Delete `pulseTabFor` and the `spineSnap` state that only fed it.
  - Append `${beat('<id>')}` to the /SCENT (`scaling`), /SOL, /SURVEILLANCE, /CRYPTOGRAPHY and /KERNEL buttons.
- [ ] **Step 5:** Delete guidanceStore and its test; `grep -rn guidanceStore src` must return nothing. Run `npx vitest run` and `npm run lint`. Expected: everything passes, 0 errors, warnings ≤ 143.
- [ ] **Step 6: Commit.** `feat(eye): wire observerStore into the masthead eye and nav`.

### Task 8: Look and timing pass with the author (real GPU)

**Files:**
- Create: `scripts/eyeQuestTour.mjs` (a CDP capture of a scripted visit)
- Modify: tuning constants only (`observerStore.js`, the ObserverEye envelopes, `whispers.js`)

- [ ] **Step 1: Write `scripts/eyeQuestTour.mjs`.**
  - Launch the dev server URL fresh, with sessionStorage and localStorage empty.
  - Crop screenshots of the eye (64 px + margin, scaled ×4) at: landing silver; t=13.5 s (idle Mercury whisper + shimmer glance); after a synthetic `collision_fired` emit through `window.__observatoryEmit`, a dev-only hook added in this task on the same pattern as `window.__quintessenceSpine`; after each vertebra via `window.__quintessenceSpine`; armed Aether; and `kernel_sealed` emitted at +0, 250, 600, 1500, 3000 and 6000 ms.
  - Write them to `baseline/eye-quest-tour/`.
- [ ] **Step 2:** Run it and show the author the contact sheet. Tune the primitives and timings on their word only. Each ruling goes in a commit message.
- [ ] **Step 3:** Desktop check: open the dev server in a **visible** browser on the 360 Hz panel and confirm the envelopes look the same at 60 Hz and 360 Hz (they are time-based).
- [ ] **Step 4:** Phone gate (OnePlus 9 Pro, `scripts/mobileFps.mjs` or the author's device). Confirm the masthead comes back for a whisper and for the crescendo, and that FPS holds (no regression vs the main baseline).
- [ ] **Step 5: Commit** the tuning: `tune(eye): author look rulings <date>`. Do not push.
