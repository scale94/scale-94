# /SOL — design (2026-11-15)

Branch: `feature/sol`, cut from the tip of `origin/main` (`7e2c34e8` on 2026-11-15). Nothing here touches `/LUNAR`.
`feature/privacy-tab-rework` carries no commits beyond main; there is nothing to reuse from it.

Legend: **[author]** = ruled by the author in the 2026-11-15 brainstorm. **[call]** = decided by the spec writer;
the author accepted the ones listed in §12 in chat, the rest are flagged there for review.

## 0. Intent

`/SOL` is the site's final tab: it takes the nav slot `/PRIVACY` holds today. It is one star and one gesture.

The visitor stirs the solar surface with their hand, winds the magnetic field until it snaps, and throws a cloud
of plasma at themselves. Then nothing happens for between 17.6 hours and three days, because that is how long the
cloud really takes. Whether it bites when it lands was fixed by which way they stirred, and they could not read
that at the time.

**The critique is the delay.** No sentence anywhere on the tab states a moral. The visitor is put in the real
human position: you watched it leave, nothing recalls it, and the star is already winding the next one. Grids,
cables and growth are theirs to fill in. An earlier draft that said this in HUD copy ("unshielded copper wire
downstream of a star that doesn't know we exist") was rejected by the author as intellectually lazy. Treat that
as the standing anti-goal.

## 1. Goals, non-goals, anti-goals

Goals
- One mechanic the whole tab answers to: **wind → snap → wait → landing**.
- Physically honest wherever it costs nothing (§3, §5, §6 give the numbers).
- Hypnotic, tactile, continuous motion. The author's top praise is for motion that feels like touching a material.
- 60+ fps on desktop (the author's panel is 360 Hz), usable on a phone.

Non-goals **[author]**
- No five-band spectral viewer, no wavelength scrubber, no observatory presets.
- No separate grid-vulnerability simulator or threshold widget.
- No flux/activity sliders. The hand is the only control.
- No audio **[call]**. The "hum" is visible surface ripples only.
- No change to `/LUNAR`. No site-wide chrome effects. No server, no account.

Anti-goals (it fails even if it works)
- It reads as a NASA SDO viewer with a button.
- Any text that explains what the piece means.
- A score. Nothing counts snaps as an achievement.
- Banded, stepped or mechanical motion anywhere (aurora and convection especially).
- White used before the snap. White belongs to the reconnection flash only.

## 2. Build order **[call]**

Three phases, each shippable alone, each its own commit series on `feature/sol`:

1. **Privacy move** (§9). Frees the slot. No dependency on the rest.
2. **The star**: sphere, self-winding, stir, pores, arch, snap, ejection, HUD (§3–§5, §8, §10).
3. **The clock**: cloud store, transit, landing, aurora, Altar wiring (§6, §7, §11).

After phase 2 and before phase 3 the tab is a complete toy; after phase 3 it is the piece.

## 3. The star

- One sphere, lit by itself. Limb darkening. Photosphere palette: incandescent white-gold core falling to amber
  and deep orange at the limb. No spectral-band switching.
- **Convection**: domain-warped multi-octave noise read as boiling granules. Cells must evolve, not just scroll.
- **Differential rotation [author]**: the surface turns on its own, faster at the equator than the poles
  (real ratio: ~25 days at the equator, ~34 at the poles; keep the ratio, compress the period to taste).
- **Self-winding [author]**: differential rotation winds the star's own field. The star carries a small number
  of active regions that gain tension on their own, slowly, and snap on their own when they cross the threshold.
  The visitor's hand only hurries one. **[call]** Pace: an untouched star produces a self-snap roughly every
  4–6 minutes; tune by look.
- **Active regions**: each is a bipolar pair of **dark pores with bright rims [author]** (strong field chokes
  convection, so the patch cools and darkens; the rim is the bright plage). Darkness and pore separation grow
  with that region's tension. A magnetic arch joins the pair above the surface; as tension rises it rises,
  thins and pulls taut. Arches are drawn in the amber-gold of the star, never white.
- **Ripples [author]**: winding sends concentric surface ripples out from the wound patch across the
  photosphere. Amplitude follows tension. They must read as a travelling wave train, not rings stamped on top.
- The star simulates only while the tab is rendering **[call]**. It does not catch up for time spent away.
  Only clouds (§6) run on the wall clock.

## 4. The hand

- **On the disc: stir to wind [author].** Pointer-down on the surface plants a grab point on the star (it rides
  with the rotation). Circular motion around that point accumulates signed winding, measured in turns. The
  plasma under the hand visibly twists around the grab point by the accumulated angle, falling off with distance.
  If no active region is near the grab point, one is born there.
- **Off the disc: orbit [author].** Drag that starts outside the limb orbits the camera around the star, with
  smooth damping. The star keeps turning by itself either way.
- **Slip [author]**: when the hand stops, winding slowly relaxes. **[call]** time constant about 8 s; stirring
  the other way unwinds directly.
- **Tension** of a region is a function of its winding: baseline quiet field a few hundred G, pores forming
  near 1500 G, threshold at **4000 G** (real umbral fields run 2500–4000 G). **[call]** about six full turns
  from quiet to threshold; tune by feel.
- **Snap triggers [author]**: releasing the pointer, or crossing the threshold while still held.
  **[call]** A release below roughly one turn does not snap; it just relaxes. A click must never fire a CME.
- **Handedness** (clockwise or counter-clockwise as the visitor sees it) is recorded at the snap. It is never
  displayed (§6).
- **State model [call]**: a region carries two separate quantities.
  - *Star winding*: a magnitude that only grows (from differential rotation) and resets at a snap. It never slips.
  - *Hand winding*: signed turns from the current and recent stirring. Slip applies to this only. Stirring the
    other way runs it down through zero and then up the other side, so tension dips and rises again.
  - Tension is a function of star winding + |hand winding|.
  - Handedness at the snap is the sign of the hand winding when the hand contributed at least the one-turn
    minimum; otherwise it is the region's hemisphere sign (§5) and the cloud's origin is `star`.
  This keeps the outcome "fixed by which way they stirred": the same gesture always gives the same orientation,
  whatever the region was doing before the hand arrived.
- Touch: the canvas takes `touch-action: none`; the page must still be scrollable outside the canvas.

## 5. The snap

- The field reconnects: the arch breaks, a white flash at the footpoints (the only white on the tab), the pores
  release, tension in that region drops to baseline, the twist in the plasma unwinds fast, and a shock front
  crosses the surface and the corona. A brief camera impulse and bloom kick, decaying smoothly.
- **The ejection leaves straight out along the surface normal at the footpoint [author].**
  - If the footpoint faces the camera, the plume comes **at the camera as a halo**, expanding around the whole
    disc **[author]**. The camera is Earth. **[call]** "Faces the camera" means the normal is within 35° of the
    view axis at the instant of the snap.
  - Otherwise it leaves sideways off the limb as a plume. Beautiful, harmless, not tracked.
- **Release magnitude [author]**: energy in ergs on a log scale from the winding at the snap, 10^29 (small)
  to 5×10^32 (Carrington-class) at the threshold. This is "yield": the size of the last release, not a count.
- **Speed and transit** follow from the energy: a threshold snap travels 1 AU in **17.6 h** (Carrington's
  measured transit, about 2350 km/s average); the weakest tracked snap takes **72 h** (about 580 km/s).
  Interpolate on the log of energy.
- **Self-snaps count [call]**: when the star snaps one of its own regions and it faces the camera, that cloud
  is tracked exactly like a hand-wound one. Its handedness follows the real hemispheric rule: northern regions
  counter-clockwise, southern clockwise. This is the "whether we touch it or not" half of the piece.
- After any snap the region starts gaining tension again on its own.

## 6. The clock

Every Earth-directed snap launches a **cloud**, persisted in the visitor's browser **[author]**.

A cloud stores: launch time (ms epoch), energy (erg), transit duration (ms), handedness, origin (`hand` or
`star`), and whether its landing has been witnessed. Everything else is derived from the wall clock, so a cloud
advances and lands whether or not the site is open **[author]**.

Derived moments, all in **true hours [author]**:

| Moment | When | Meaning |
|---|---|---|
| Light | launch − 499 s (shown at the snap) | "the light you just saw left 8 min 19 s ago" |
| Mercury passage | launch + 0.387 × transit | the cloud crosses Mercury's orbit; the Altar marks it |
| Orientation read | arrival − (1.5×10^6 km ÷ speed), roughly 10–45 min before arrival | the upstream monitor reads the cloud; its record changes from *unread* to *southward* or *northward* |
| Arrival | launch + transit | landing (§7) |
| Storm end | arrival + storm duration | the aurora is over |

- **Coupling [author]**: handedness alone decides. **[call]** Clockwise is southward and couples;
  counter-clockwise is northward and passes. The rule is fixed and never stated, so a returning visitor can
  learn it.
- **Storm strength**: for a coupled cloud, peak disturbance in nT from the energy, about −50 nT (weak) to
  −1200 nT (Carrington-class). **Storm duration [call]**: 3 h (weak) to 12 h (strongest), real time.
- **Multiple clouds [author]**: each snap is its own cloud with its own times. **[call]** At most 16 in flight;
  past that the weakest in flight is dropped. Landed clouds are kept as a log, newest 32.
- Storage **[call]**: a bus-adjacent store in the style of `quintessence/spineStore.js` (no React, a `Set` of
  listeners, `localStorage`, tolerant of storage being unavailable), key `sol_clouds_v1`. Clearing site data
  loses the clouds; that is accepted **[author]**. Clock tampering is not defended against.
- All time maths lives in pure functions that take `now` as an argument, so it can be tested without waiting.
- A **DEV-only hatch** (stripped from production, like `window.__quintessenceSpine`) launches a cloud with an
  arbitrary transit and handedness. Without it the landing cannot be verified.

## 7. The landing

The landing happens to the visitor, on `/SOL`, not to the sun **[author]**.

- **Coupled, and `/SOL` is open during the storm window**: an **aurora** rises in the foreground of the frame,
  between the visitor and the star, which stays visible through it. Brightness and reach follow storm strength;
  it holds for the storm duration and fades. Arriving partway through the window shows the storm at its current
  stage. This marks the cloud witnessed.
  - Colour is the real one: oxygen green (557.7 nm) curtains; strong storms add the deep red (630 nm) crown
    above, the colour the Carrington aurora was reported in at low latitudes.
  - It is a slow, folding curtain with rays that drift. It must never band or step; dither it. Treat it as a
    second shader piece with its own look round.
- **Passed (northward)**: no visual. One line in the HUD: arrived, northward, passed. Nothing else **[author]**.
  The author confirmed this is right even after a nineteen-hour wait.
- **Missed**: a coupled cloud whose storm window closed before the visitor returned is recorded as arrived
  unwitnessed. One line. No replay.
- A coupled landing also reports its strength in nT in the HUD; with ergs at the snap, this is the other half
  of "yield" **[author]**.

## 8. HUD

Terminal typography and panel framing matching `/KERNEL`, `/ACCRETION`, `/LUNAR`. Minimal.

- **Magnetic tension (G)**: the region under the hand; when idle, the most-wound region on the star.
- **Last release (erg)**, and for the last coupled landing, **nT**.
- **Light delay**: at each snap, the 8 min 19 s line.
- **Clouds in flight**: one row each: time to arrival (true clock), orientation *unread* until the read moment.
- **Landings**: one-line states only: *arrived · northward · passed*, *arrived · southward · coupled · −N nT*,
  *arrived · unwitnessed*.

Voice: the site's Mercury voice (poetic taxonomy that mirrors live state). Numbers and one-line states. No
instructions beyond what a first-time visitor needs to discover the stir, and no sentence about civilization,
infrastructure or meaning **[author]**. Exact wording is the builder's, subject to the author's look round.

## 9. Privacy move (phase 1) **[author]**

- `PrivacyTab` leaves the nav. Its whole content, including the live panopticon index and the last sovereignty
  assessment, moves into a **button and drawer at the bottom of `/SURVEILLANCE`**, above the footer credit in
  `views/SurveillanceTab.jsx`. The readouts stay live while the drawer is open. Keep it lazy-loaded.
- `SurveillanceTab` must now receive `systemArticles` (the privacy text is `systemArticles['PRIVACY-PROTOCOL']`).
- In `App.jsx` remove every `privacy` nav surface: the desktop bar button, the mobile icon-bar button, the
  `g`-hint strip entry, the per-tab theme entry, the render block. Find any other reference to
  `~/system/privacy` (commands, deep links) and route it to `/SURVEILLANCE` with the drawer open.
- There is no URL router; paths are display state through `handleNav`. The other `privacy` references to
  reroute are the terminal commands: `hooks/useTerminalCommands.js` (~163), `hooks/useCommandDispatch.js`
  (~31, ~441), `commands/runHelpers.js` (~69), and the help strings in both hooks.
- Visits are counted only by `emit('gaze','tab_navigated',{tab})` on the observatory bus; the drawer emits that
  with `tab: 'privacy'` when opened.
- **Open, author's to answer**: the moved panel's `COOKIE_STATUS` vector says "No localStorage behavioral
  tracking" and "No persistent client-side identity constructed". Phase 3 stores timestamped clouds on the
  device for days. Do not reword the statement unasked; the author decides whether it gains a line.
- **[call]** `g p` keeps working: it goes to `/SURVEILLANCE` and opens the drawer.
- **[call]** The compiled kernel's `house_privacy` (fed by `tabsVisited.privacy` via `quintessence/periphery.js`)
  survives: opening the drawer reports a privacy visit on the observatory bus exactly as entering the tab did.
- `AirgapIcon` moves to the drawer button.

## 10. `/SOL` in the nav (phase 2)

- Internal id `sol`, path `~/system/sol`, in the slot `/PRIVACY` occupied (between `/Scent` and `/Surveillance`),
  on the desktop bar, the mobile icon bar, the theme map and the `g`-hint strip.
- **[call]** Tab colour: pale yellow-white. Amber already belongs to `/CHAOS`, orange to cryptography.
- **[call]** Shortcut `g o`.
- **[call]** A custom `SolGlyph` in `components/icons/`, no lucide. House rule: the icon draws what the tab
  does, so a disc with one twisted arch lifting off its limb, not a generic sun with rays.
- Lazy-loaded view `views/SolTab.jsx`; module code under `src/terminal/sol/`.

## 11. Altar wiring (phase 3) **[author: only `/KERNEL` is touched]**

`/SOL` joins the Quintessence Altar as an **optional witness**, not a fourth required vertebra **[call,
accepted]**. A visitor who never touched the sun still compiles; the house is marked empty the way the others are.

**Where the Altar is [call]**: the author says "/KERNEL" for the Mercury side of the site. In the repo the Altar
(`mercury/QuintessenceAltar.jsx`, with `ReliquaryView`) is rendered in `views/MercuryTab.jsx`, not
`views/KernelTab.jsx`. "Only the Altar is touched" means: the Altar component, the quintessence modules below,
and nothing else on either tab. The planet, its shaders and its controls are not touched.

- `quintessence/periphery.js`: `snapshotPeriphery()` gains `sol`:
  - `null`: never came;
  - `{ visits }`: entered, star untouched (same pattern as `art`);
  - otherwise a summary of the cloud store at compile time: clouds in flight (arrival time, Mercury passage
    passed or not, orientation read or unread), landings (coupled with nT / passed / unwitnessed), last release.
- `quintessence/compileKernel.js`:
  - a `house_sol` line in `PeripheralWitness`, with the standing empty-house rendering when `null`;
  - a `sol_telemetry` block (a struct plus a const, in the file's existing Rust idiom) listing each cloud and
    its fate. A cloud whose orientation is still unread compiles as `None` for that field: the kernel must not
    leak what the visitor cannot yet know;
  - `sol` is added to the filled-house count here (lines ~129–132) and in `mercury/QuintessenceAltar.jsx`
    (lines ~78–80). The Altar's count feeds the engine's `maxLayers`, so a witnessed sun deepens the engine
    run; that is intended.
  - `quintessence/taxonomyRegistry.js` hardcodes "of 9 houses witnessed": it becomes 10, thresholds unchanged,
    and `house_sol` gets a lens owner.
- The observatory bus is in-memory per session while clouds persist, so a non-empty cloud store counts as
  "came" even when this session never opened `/SOL`.
- The Altar panel shows one compact line per cloud in flight, including the Mercury passage once
  it has happened ("crossed Mercury's orbit"). Placement inside the existing Altar layout is the builder's.
- Compilation stays pure and deterministic: the sol snapshot is taken by the caller and passed in, as periphery
  already is. Existing quintessence tests must be updated, not weakened.

## 12. Calls for the author to check

Accepted in chat: optional-witness wiring; no audio; pale yellow-white tab; `g o`; no stated takeaway; build
order; browser-only clock; one cloud per snap.

Not yet seen by the author:
1. The star's own snaps launch tracked clouds when they face the camera, with handedness by hemisphere (§5).
2. Clockwise couples, counter-clockwise passes (§6).
3. "Faces the camera" = within 35° (§5). Orbiting the camera therefore moves "Earth"; accepted as the observer.
4. Release below about one turn does not snap (§4).
5. Orientation is read 10–45 minutes before arrival and the record updates then (§6).
6. Caps: 16 in flight, 32 logged (§6). Storm lasts 3–12 h (§6).
7. Aurora colours: green, with a red crown for strong storms (§7).
8. `g p` opens the privacy drawer; drawer opening counts as a privacy visit for the kernel (§9).
9. The star does not simulate while the tab is closed (§3).
10. Glyph concept: disc with a twisted arch (§10).
11. The hand's winding and the star's winding are kept separate; the cloud takes the hand's direction (§4).
12. Under reduced motion the hand still works, with stills instead of motion (§13).
13. "/KERNEL" is read as the Altar on the Mercury tab; only the Altar component is touched there (§11).

## 13. Constraints and how it gets made

- **Rendering [call]**: build on the shared shader harness (`src/terminal/gl/`: `useShaderCanvas`, `glHost`,
  `frameLoop`), the way `lunar/LunarShaderMoon.jsx` and the council field do, with the star as an analytic
  sphere in a full-screen fragment shader. Reasons: the sphere, pores, twist, arches, halo and aurora are all
  expressible analytically for a handful of regions; the harness already owns visibility, reduced-motion and the
  frame clock; and it avoids the three.js material path that produced the 87 s ANGLE compile stall on `/MERCURY`.
  The builder may choose react-three-fiber instead if a spike shows arches or the plume need real geometry, but
  must say so in the plan.
- **State lives in JS**: a small list of active regions (position on the star, winding, tension, handedness)
  simulated per frame and passed as uniforms. No fluid simulation; the "physical twist" is a warp of the
  convection domain around each grab point by that region's winding angle. Bound region count to a small
  constant (suggest 6).
- **Everything is on the clock, never frame-counted.** The panel runs at 360 Hz; rates must hold from 60 to
  360 Hz. Clamp `dt` as the harness does.
- **Shader compile time** on ANGLE/D3D11 must stay under about 3 s: constant loop bounds, no large unrolled
  noise inside per-region loops.
- **Reduced motion [call]**: no ambient motion (the harness halts the loop; the star neither boils, turns nor
  winds itself, so there are no self-snaps), but the hand still works. Pointer input drives frames while a
  stir is held, so the simulation step must be callable from pointer events as well as the frame loop. The
  snap shows as a short still flash with no shake; a coupled landing shows a still aurora. Clouds fly and land
  as normal.
- **Phone**: must hold a usable frame rate; lower octave counts or resolution scale on small or slow devices.
  A phone gate (real device) is required before calling phase 2 or 3 done.
- **Lint**: the repo's gate is 0 errors and a warnings ratchet; do not raise it.
- **Verification**: pure modules (stir accumulator, tension, energy/transit, coupling, cloud store with an
  injected clock, periphery, compile) get unit tests. The look is verified by screenshots of the real render
  before any visual claim is made, and by the author's eye. Use the DEV hatch for landings.
- **Nothing is pushed** without the author's explicit instruction.

## 14. Left to the builder

Noise recipe and octave counts; exact palette within §3; bloom and shake amounts; arch and plume drawing
technique; HUD layout and wording within §8; drawer styling; the glyph's drawing; file breakdown under
`src/terminal/sol/`; all tuning constants marked "tune".
