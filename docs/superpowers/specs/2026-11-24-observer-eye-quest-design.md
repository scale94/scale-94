# The Observer Eye as quest-giver — design

2026-11-24 · branch `feature/eye-ambient` · status: DRAFT v2 (builder check folded in), awaiting author approval.
Input: `docs/superpowers/audits/2026-11-24-quintessence-wiring-audit.md` (read it for the per-tab wiring).

## 1. Intent

The eye (top-left of the masthead) becomes the single in-world instrument that notices the visitor.
Every deliberate act anywhere in the terminal gets its own short shader reaction. Now and then the eye
drops a cryptic, playful riddle that lures the visitor toward a mechanic they have not touched yet.
Compiling the Kernel of Quintessence is the violent payoff.

Why: seven tabs (/SCENT, /SOL, /CRYPTOGRAPHY, /CHAOS, /ECOCIDE, /LEDGER, /SURVEILLANCE) already feed
the kernel without ever showing it. Some interactive pieces, the /MERCURY flick above all, are not
self-evident. The author wants one diegetic answer to both problems, with no progress bars or
achievement UI inside those tabs. The work is aimed at Ars Electronica review, where a visitor may
visit once, briefly, or come back later.

## 2. Goals / non-goals / anti-goals

**Goals**
- G1 **Silver is always the baseline.** The luminous silver "golden record" rest is where the eye
  returns after anything. Nothing persistent replaces it (today `complete` replaces it with flat teal,
  and the compass and `leaning` hold the eye for good once a vertebra is marked).
- G2 **Every deliberate act gets a distinct reaction**, in three tiers: *witness* (quiet houses),
  *vertebra* (the four altar-arming acts, heavier), *crescendo* (the seal).
- G3 **Agency.** Events the simulations fire on their own never move the eye.
- G4 **Forward whispers.** Rare, never-repeating riddles that point at untouched mechanics, plus a
  one-time idle nudge on a tab with an untouched piece.
- G5 **Aether armed state** and a **violent seal crescendo** that detonates the armed star-core.
- G6 Fix the **amber jump** (a guidance suggestion reasserting after a nav flash) and the **2 s seal
  latency** (polled `sealed`).

**Non-goals**
- Fixing the quintessence wiring gaps from the audit (keygen not compiled, ledger depth filed under
  transmissions, the unreachable reliquary schematic, /BSKY single point of failure). Those are
  separate work. This design adds only the events the eye needs.
- Any new UI inside the tabs. Tabs gain bus emits only.
- Rewriting the existing existentialist phrase pools.
- A kiosk / shared-machine reset of the spine and seal (D17).

**Anti-goals** (failure even if it technically works)
- Literal instructions ("click here", "now go to /LUNAR"), achievement or progress framing.
- A chatty eye: whispers that repeat, crowd each other, or talk while nobody is touching anything.
- Reactions the visitor can't see because the baseline is dull, or that collide with each other
  (the amber-jump class of bug).
- Reactions to the simulations' own events (an eye that "sees" a hand that isn't there).

## 3. Decisions taken in the conversation

| # | Decision | By |
|---|---|---|
| D1 | Glances (option A): silver rest; the compass becomes an occasional glance toward the next vertebra; `complete` leaves a faint permanent teal thread inside the silver. | author |
| D2 | `armed` = **Aether**: bright silver, calm weightless orbital flow, pearlescent starlight shimmer on the brightest ridges (pale gold / ice-white / faint violet), and a tiny intense **star-core** at the centre. | author |
| D3 | The seal **detonates the star-core** into a violent crescendo, then settles to silver + thread. | author |
| D4 | The altar emits **`edge/kernel_sealed`** at the moment the seal completes; the 2 s poll goes away. | author (name: my proposal, accepted) |
| D5 | Glances only after a **~8 s quiet window** (no nav flash, no reaction), easing in and out slowly. | author |
| D6 | Whispers point **forward** (option A): rare, non-repeating, toward untouched mechanics; plus the idle nudge. | author |
| D7 | **Two voices**: existentialist pools stay for /KERNEL load and run; a new mythic-riddle pool for whispers. | author |
| D8 | Spent whispers and touched pieces live in **`sessionStorage`** (survive refresh, reset on a new visit). | author |
| D9 | Idle nudge after **~12–15 s** without deliberate input; global whisper cooldown **60–90 s**. | author |
| D10 | Vertebrae already marked in the (localStorage) spine are never whispered at. | my call, accepted |
| D11 | Only click / tap / key / scroll reset the idle clock; pointer movement does not. | my call, accepted |
| D12 | A whisper is paired with a glance in the target's tab hue. | my call, accepted |
| D13 | On mobile a whisper waits until the masthead is visible. | my call, accepted |
| D14 | Approach A (below) + single shader with a direct imperative handle. | author |
| D15 | After a seal the eye rests in **silver + thread**, even though the altar re-arms. Aether returns only if a vertebra is re-marked after the seal (intent to recompile). | author |
| D16 | On mobile, a **whisper or the crescendo forces the masthead visible** for its duration; ordinary reactions do not. | author |
| D17 | Shared-machine / kiosk reset is **out of scope** for this build. | author |
| D18 | The glParity snapshot is **regenerated once, in its own reviewed commit** with a written reason; unchanged looks are proven by a pixel-readback test. | author |

## 4. Approaches considered

- **A. One observer store fed by `observatoryBus` (CHOSEN).** A no-React store, built like
  `guidanceStore`/`spineStore`, subscribes to the bus and the spine and produces reactions, glances and
  whispers. Agency comes from an allowlist of user-only event kinds plus a `hand: true` payload flag
  on the mixed kinds. Tabs never import the eye. Cost: each event kind is checked once for agency.
- **B. Tabs call the eye directly** (`eyeReact('scent')` from handlers). Agency comes for free, but
  about ten tabs get coupled to the eye and every interaction ends up with two signals that will drift.
  Rejected.
- **Overlay canvas for the crescendo.** Sharper, but it doubles the GL contexts and splits the look
  across two shaders. Rejected in favour of extending the one shader.

## 5. Architecture

```
tabs ──emit──▶ observatoryBus ──▶ observerStore ──impulse──▶ MercuryEyeIndicator ──kick()──▶ ObserverEye (shader)
spineStore ───────────────────▶      │  glance / whisper ─▶      │ (React state)        baseline props
window input (pointerdown/key/wheel)─▶│                           └─ whisper toast (mei-phrase slot)
App.handleNav → notifyNav ───────────▶│  (flash)                  App nav-beat ← glance.tab
```

### 5.1 `observerStore` (new, `src/terminal/quintessence/observerStore.js`)
No React, a Set of listeners, `start()` idempotent, `_resetForTests()`. It absorbs `guidanceStore`'s job:
- **Keeps:** `NAV_TINTS` (moved here or re-exported), `notifyNav(tab)` and its 1.5 s flash.
- **Retires:** the element-house suggestion loop (`INITIAL_REST_MS`, `SUGGEST_MS`, rests). The
  compass glance replaces it, so the amber jump cannot happen. The audit also found the old loop
  pointed *away* from the gating houses before the first mark (finding 1). Glances point at the next
  unmarked vertebra from the start.

Outputs:
- `subscribeImpulse(fn)`: fires `{ sig, tier, tint, at }` once per reaction (transient, not state).
- `getObserver()` / `subscribeObserver(fn)`: `{ flash, glance, whisper, igniting }`, where
  - `flash`: `{tab, tint}|null`, as today
  - `glance`: `{tab, tint, reason:'compass'|'whisper'}|null`
  - `whisper`: `{id, text, tab}|null`
  - `igniting`: `bool`, true between ignition start and seal or failure.

### 5.2 Agency filter (the reducer's input table)
User-only kinds pass as they are. Mixed kinds need `hand: true`, and anything without it is dropped.
Verified against the code on 2026-11-24:

| Event | Source | Agency | Tier | Touches |
|---|---|---|---|---|
| `transmissions/kernel_loaded` | App build load | hand | witness | `kernel.load` |
| `transmissions/kernel_completed` | terminal `run` | hand | witness (keeps the violet×lime "compiling" look) | `kernel.run` |
| `edge/council_collision` | `useCouncilCollider.js:206`, user synthesis only | hand | **vertebra** (with the spine write) | `accretion.collide` |
| spine `trend` write | `BskyTab.jsx:285` | hand | **vertebra** | `bsky.trend` |
| spine `phase` write | `LunarTab.jsx:434` | hand | **vertebra** | `lunar.phase` |
| spine `element` write | `QuintessenceAltar.ignite` | hand | starts **ignition** (not a vertebra reaction) | — |
| `essences/collision_fired`, `crystallized` | LatentCollider | hand | witness | `scent.collide` |
| `gaze/art_resonance`, `art_node_selected` | ArtTab clicks (`:4030`, `:4086`) | hand | witness | `chaos.pick` |
| `gaze/art_bifurcation` | `handleBifurcate` button (`:967`) **and** chimera injection from the bus (`:4416`) | **mixed** → add `hand: true` at `:967` only | witness | `chaos.fork` |
| `gaze/art_chimera`, `art_regime` | sim | sim | ignored | — |
| `gaze/ecocide_phase` | sim tick (`EcocideTab.jsx:460`) | sim | ignored | — |
| **new** `gaze/ecocide_growth_set` `{growthRate, hand:true}` | `GrowthSlider` release | hand | witness | `ecocide.growth` |
| `ciphers/cipher_sealed`, `unlock`, `key_generated`, `verify` | ClassifiedTab / terminal | hand | witness | `crypto.seal` |
| `transmissions/signal_marked` | InverseEngine mark button | hand | witness | `transmission.mark` |
| `transmissions/ledger_appended`, `verdict_issued` | Ledger form / cascade | hand | witness | `ledger.write` |
| **new** `gaze/sol_release` `{energyErg, handedness, hand: origin==='hand'}` | `SolTab.onSnap` (`:88`); `origin` is `'hand'` or `'star'` (`sol/regions.js:59`) | mixed → only `hand` | witness | `sol.release` |
| **new** `gaze/mercury_flick` `{speed, hand:true}` | `useMercuryDrag` pointerup with release speed over a threshold | hand | witness | `mercury.flick` |
| `gaze/tab_navigated` + privacy drawer | nav | hand | flash only (as today) | `surveillance.privacy` when tab = privacy |
| **new** `edge/kernel_ignited` | `ignite()` after `setElement` | hand | starts ignition | `altar.ignite` |
| **new** `edge/kernel_sealed` `{hash}` | `ignite()` after `setStage(6)` | hand | **crescendo** | `altar.seal` |
| **new** `edge/kernel_ignite_ended` `{sealed:false}` | `ignite()` `finally` when no seal happened (catch **and** the four `!alive.current` early returns, e.g. the altar unmounting on nav) | — | ends ignition quietly | — |

The builder adds the new emits (5 sites) and `hand: true` at `ArtTab.jsx:967`. No other tab code changes.

**Coalescing (my call):** /ACCRETION's spine write and its `council_collision` fire in the same handler; they produce **one** reaction. **Re-marks (my call):** only the first mark of each vertebra in a session gets the vertebra tier; a re-mark (trend, phase or council marked again, also after arming or sealing) gets the witness tier.

### 5.3 Session trail (`sessionStorage`, key `observer_trail_v1`)
`{ touched: {pieceId: true}, spent: {whisperId: true}, idleSpent: {tab: true}, lastWhisperAt }`.
Storage calls are wrapped in try/catch, as in every other store. Refused storage means a volatile
in-memory trail. A piece counts as "done" for whisper targeting when `touched[piece]`, or, for the
three vertebrae, when the spine has it (D10).

### 5.4 Baseline (what `resolveEyeState` decides)
`resolveEyeState` shrinks to the baseline plus the slow overlays:

| Condition | Baseline |
|---|---|
| default | **silver** (today's `resting`, unchanged look) |
| `igniting` | **charging**: Aether, with the star-core growing and the orbit tightening over the ignition (~4–6 s, the altar's 6 stages × 650 ms plus the engine) |
| armed (all 3 vertebrae, not sealed) | **Aether** (D2) |
| sealed | **silver + thread**: the faint teal thread lives inside the silver sweep; never flat teal. Holds even though the altar re-arms by itself (the spine is never reset in production) (D15) |
| sealed, then a vertebra re-marked after the seal | Aether + thread (the visitor signalled a recompile) (D15). The store tracks `remarkedSinceSeal` (session-scoped) |

Overlays on top of the baseline: `flash` (1.5 s nav hue, as today) and `glance` (the hue leans in,
gaze drifts toward the nav row). A glance never shows during a flash or a reaction.

### 5.5 Reactions (impulses)
`kick(sig)` on ObserverEye starts an envelope. The signature picks the hue (`NAV_TINTS[house]`) and
one motion primitive. Each house should read as distinct in peripheral vision:

| Piece | Motion primitive (proposal, tuned by eye) |
|---|---|
| kernel load | inhale: brief dilation, then the hue |
| kernel run | today's violet×lime miosis ("compiling"), shortened to fit the envelope |
| scent collide | two counter-rotating lobes merge at the centre |
| chaos pick / fork | angular split: the swirl forks into 2–3 lobes, then rejoins |
| crypto | quantise stutter: the colour bands posterise for ~200 ms (a lattice "lock") |
| sol release | outward ring burst from the core |
| ecocide growth | slow sag: focus drops and the hue drains toward green-grey |
| ledger | concentric ripples (water) |
| transmission mark | a radial packet: one bright ring travelling inward |
| privacy drawer | gaze snaps to centre and the iris narrows: the eye looks back |
| mercury flick | a spin shove: the rotation jerks in the flick's direction, then coasts back |
| **vertebra** (bsky / accretion / lunar) | the house hue + a deep contraction (focus ~0.75) + a sharp pulse; ~2× the witness duration |

- **Envelope.** Attack ~120 ms. Witness decay ~0.9–1.4 s, vertebra ~2–2.5 s. All of it is
  frame-rate independent, like today's easing.
- **Overlap.** A new reaction while one decays re-triggers (the newest signature wins), with
  amplitude capped. Tier order is crescendo > vertebra > witness: a lower tier never interrupts a
  higher one.
- **Crescendo** (on `kernel_sealed`):
  1. **Implosion**, ~250 ms: the star-core collapses to a point.
  2. **Detonation**, ~350 ms: white-gold flash outward, turbulence at max, speed spike.
  3. **Storm**, ~2 s: high-turbulence fbm, with the gaze shaking slightly.
  4. **Settle**, ~3 s: back to silver, with the thread fading in.

### 5.6 Shader changes (`ObserverEye.jsx` FS)
New uniforms, all with defaults that reproduce today's rendered output exactly. ElementSeal reuses the
component with `lens={false}` and must render unchanged.

| Uniform | Drives |
|---|---|
| `u_core` | star-core: an additive bright pinpoint at r→0, which overrides the dark pupil term |
| `u_orbit` | calm: scales the domain-warp `q` down and lets the differential rotation lead |
| `u_shimmer` | ridge glints: pale gold / ice-white / violet on `n` above a high threshold |
| `u_thread` | thin teal filament in the silver sweep |
| `u_turb` | extra warp amplitude + speed (storm) |
| `u_kick`, `u_kickKind`, `u_kickDir` | reaction envelope and which primitive |

The imperative handle: `ObserverEye` gets `forwardRef` + `useImperativeHandle({ kick })`. `kick`
writes into `curRef`, so no React re-render happens.

**Reduced motion** (my call): reactions become a brief static colour hold (no motion). The crescendo
becomes a held bright flash that fades to silver + thread. Aether shows its colours with no motion.

### 5.7 Glances
- **Compass glance.** Only when nothing is armed or sealed and a vertebra is unmarked. It fires
  after ≥ 8 s with no flash, reaction or whisper (D5): ease in ~1.2 s, hold ~3 s, ease out ~1.5 s,
  then ≥ 25 s before the next compass glance (my call).
- **Whisper glance.** Rides with every whisper (D12), aimed at the whisper's target tab.
- **Nav beat.** App's nav beat (`App.jsx:625`) pulses the glance's tab while a glance holds, and
  nothing otherwise (my call; today it pulses the suggestion for 20 s at a time). `beat()` is wired on only
  seven nav buttons today; the builder adds it to /SCENT, /SOL, /SURVEILLANCE, /CRYPTOGRAPHY and /KERNEL
  (App nav markup, not tab code). /MERCURY has no nav button: the eye *is* its button, so a Mercury
  glance needs no beat.
- **Hue collisions (my call).** `NAV_TINTS.mercury` is silver, which is invisible on the silver
  baseline: a Mercury glance shows as the pearlescent shimmer (`u_shimmer`) with a slight gaze drift
  instead of a hue. /ACCRETION and /LUNAR share violet `[139,92,246]` (and `[167,139,250]` in
  `vertebrae.js`); their vertebra reactions are told apart by motion, not hue: accretion = spiral
  infall toward the core, lunar = a terminator shadow sweeping across the disc, bsky = a fast
  two-lobed flutter.

### 5.8 Whispers
- **When:**
  - **What counts.** A nav click is deliberate input (it resets the idle clock, D11) but is **not** a
    reaction-producing act: a flash is not a reaction. The idle whisper needs no prior act; it exists
    for the visitor who lands on /MERCURY and doesn't know the sphere can be flicked (from the
    conversation). A visitor who only browses tabs gets an idle whisper on any tab they linger on,
    subject to the cooldown.
  - **Forward whisper.** Never before the visitor's first deliberate reaction-producing act. After
    a reaction settles (+~2.5 s), if the cooldown allows, pick a target.
  - **Idle whisper.** After 12–15 s of no deliberate input on the current tab, if that tab has an
    untouched piece and `idleSpent[tab]` is unset. Once per tab per session.
  - **Cooldown.** Both obey the 60–90 s global cooldown (random in range per whisper), except the
    **very first whisper of the visit**, which is not delayed by a cooldown.
- **Target order** (D6, my order): `mercury.flick` → the unmarked vertebrae in spine order (bsky,
  accretion, lunar) → the quiet houses (scent, chaos, sol, crypto, ledger, transmission, ecocide,
  privacy, kernel) → `altar.ignite` once armed. Skip the current tab for forward whispers. The idle
  whisper is about the current tab by definition.
- **Placement:** the existing `mei-phrase` slot (right of the eye), same dark box and mono type.
  The riddle colour is a pale silver-violet to tell it apart from the amber existentialist lines
  (my call). Duration ~6 s. A whisper and a kernel phrase never overlap: the whisper waits.
- **Mobile** (D13, D16): the masthead hides 3 s after every `touchend` (`App.jsx:306-325`), so most
  whispers and the whole crescendo would otherwise play unseen. A whisper, and the crescendo from
  ignition through settle, **force the masthead visible** for their duration; the normal hide resumes
  after. Ordinary reactions do not force it. App must start passing `mobileChrome` to
  `MercuryEyeIndicator` (it does not today, `App.jsx:1176`), and the store exposes a `wantsChrome`
  flag that App ORs into its visibility.
- **Corpus:** `src/terminal/quintessence/whispers.js` holds data only, 2–3 lines per target. The
  author edits it. Draft in appendix A.

### 5.9 Telemetry
Keep `edge/eye_phase`. Its phases become `silver | aether | charging | crescendo | sealed`, plus
`whisper` events (`edge/eye_whisper {target}`) so CosmosRegistry and ObservationMatrix can log them.
Drop the dead `deepWatch` and spectrum code paths and the dead `mei-spectrum-*` / `mei-breath*` CSS.

## 6. Constraints
- 360 Hz desktop panel and a phone (OnePlus 9 Pro) gate. The eye is a 64 px canvas. Keep the FS loop
  count unchanged (4 fbm calls × 5 octaves) and add no texture reads.
- Hidden-pane timer queries lie (project memory). Verify timing with the real tab visible.
- Bus emits must be deferred out of render (the `setTimeout(0)` pattern in `handleNav`).
- Lint gate: 0 errors, warnings ratchet ≤ 153.
- The spine and seal stay in localStorage. Only the observer trail is sessionStorage.

### 6.1 Snapshot policy (D18)
The glParity test header says never to run it with `-u`. Any FS edit changes the init snapshot
(source hash, uniform lookups). The builder regenerates it **once**, in its own commit whose message
explains why, after a new pixel-readback test proves the existing looks unchanged: render `resting`,
`leaning` (tinted), `armed`, `compiling` and `complete`-era output at fixed `u_t` with the old and new FS,
and compare pixels within a small tolerance. ElementSeal (`lens={false}`) is included.

## 7. Testing (proposal)
- `observerStore` is table-tested with fake timers:
  - agency filter: sim events dropped, `hand` events pass
  - tier ordering
  - glance quiet window and spacing
  - whisper cooldown, idle clock, target order, D10 skip, session persistence
  - mobile hold and drop
- `resolveEyeState` baseline table.
- `ObserverEye` handle: `kick` changes uniforms without a re-render.
- glParity scripts only one ObserverEye case today (`leaning` with tint/constrict/pulse → `resting` at
  frame 30); `armed`, `compiling`, `complete` are not snapshotted. Snapshot policy: see §6.1.
- Amber-jump regression: a nav flash during a would-be glance window shows no second hue after the
  flash.
- Seal latency: `edge/kernel_sealed` is emitted in the same tick as `setStage(6)`.

## 8. Left to the builder
- Exact shader math for each primitive and the crescendo curve. Tuned by eye with the author;
  the timings above are starting points.
- The mercury flick speed threshold (read `planet/mercuryDrag` release velocity).
- Whether `NAV_TINTS` moves to `observerStore` or stays exported from a slimmed `guidanceStore`.
- Rewriting the `guidanceStore` tests that cover the retired suggestion loop.

## Appendix A — draft riddle pool (for the author to tune)

Voice: playful, mythic, wordplay. No verbs aimed at UI ("click", "press", "go to"). Lower-case,
middle-dot separators, like the existing pools.

| Target | Drafts |
|---|---|
| `mercury.flick` | quicksilver sulks when left alone · · a flick of the wrist is a flick of the will · · the messenger only runs when pushed |
| `bsky.trend` | the sky won't stop saying one word · catch it · · pin a rumour to the wind · · the crowd hums a name · keep it |
| `accretion.collide` | two minds fall faster together · · seat a pair of thinkers · let the light bend · · thought gathers mass in collision |
| `lunar.phase` | the moon wears a perfume per phase · · mark the moon and it marks you back · · dryness is a calendar · choose a night |
| `scent.collide` | let scent be your accent · · two notes · one collision · a new accord · · the nose knows what the mind collides |
| `chaos.pick` | the sphere speaks louder in pairs · · order is a rumour · fork it · · pick two and the chaos picks you |
| `sol.release` | the sun throws tantrums at whoever faces it · · snap the star · something leaves for you · · light takes eight minutes to forgive |
| `crypto.seal` | a secret kept is a secret sealed · · lock something small · see who notices · · lattices remember what you hide |
| `ledger.write` | the tide signs whatever you confess · · water keeps the books · · write it down and the sea will witness |
| `transmission.mark` | some signals ask to be kept · · not every packet is lost · mark one · · the dead letter wants a reader |
| `ecocide.growth` | growth has a dial and a bill · · turn up more · count what's left · · the earth keeps the receipts |
| `surveillance.privacy` | someone reads over your shoulder · read back · · privacy is a drawer · it opens both ways · · the watcher has a watcher |
| `kernel.run` | the terminal answers only to verbs · · load a mind · then make it run · · a kernel at rest is a kernel denied |
| `altar.ignite` (armed) | three bones aligned · the altar is listening · · four is a body · five is a soul · · the fifth element waits beneath the mercury |

Idle whispers reuse the target's lines. Repeats are impossible within a session (`spent`).
