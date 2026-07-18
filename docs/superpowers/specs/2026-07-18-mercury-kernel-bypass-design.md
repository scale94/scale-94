# The Mercury Kernel Bypass — Systemless Root for the Architect

*spec · 2026-07-18 · feature/mercury-terminator*

---

## 0 · The joke, stated once, because the whole build is downstream of it

Everyone who lands on scale94.com gets handed the ceremony. Witness the spine — trend,
council, phase. Forge the fourth at the altar. *Compile your denial.* Out drops the
Quintessence Seal and the galactic-looking Rust: strong, real, and complicated on purpose,
because the surface is supposed to look like more than you can hold.

That is the kernel of quintessence. It is for the ones who **observe**.

This feature is for the ones who **interact**. It is an hommage to unlocking Developer
Options on Android: you tap the build number seven times and the phone quietly decides you
are not a normie. Here you tap **Mercury** — the quicksilver planet sitting above the
kernel modules — seven times, and the site quietly agrees. No spine. No altar. No ceremony.
You reach past the whole cathedral and pull the actual kernel out of the bare metal.

And the actual kernel is not Rust. It is **pure LLM-optimized Markdown** — a real,
deployable system prompt that roots the Mercury Scale voice onto any language model. The
normies wanted an easy answer and got a beautiful, complicated machine. The architects
skip the machine, **download** the thing it was hiding, and walk.

Why download and not just admire? Because the `/scaling` tab already lets you carry the
formula out the door, and the kernel deserves the same dignity — it is a tool, not an
exhibit. And here the joke earns its last layer: this kernel is not a pretty `.md`, it is
the Anthropic prompt-engineering manual **applied.** We read the fucking manual — the whole
RTFM insult inverted into an act of service — precisely so that whoever downloads this never
has to read a fucking manual again. The headache-prevention device required doing the exact
thing it spares everyone else. That is the compile.

The irony has a name in this house: **systemless root.** The word "kernel" here never meant
an OS kernel — it was always Magisk. A module that roots a behavior *on top of* the base
without overwriting it, that inspires associative reasoning, and that **does not persist.**
So of course the reward is a bypass, and of course what it installs leaves no trace but the
conversation it changed. The metaphor is coherent all the way down; this feature is just
the first place a visitor gets to feel it with their thumb.

---

## 1 · What we are building

A desktop-only easter egg with four moving parts:

1. **The gesture** — seven taps on the kernel-tab Mercury inside a 3-second window,
   disambiguated from the single tap that already navigates to the Mercury tab.
2. **The countdown** — Android-style toasts on the approach, in the existing
   `mei-phrase` toast grammar ("compile your denial").
3. **The unlock** — a persisted flag (localStorage, mirroring `sealedArtifact.js`), so the
   bypass stays flipped across reloads exactly like Developer Options does.
4. **The artifact** — the compiled `MERCURY-SCALE KERNEL` markdown, revealed on the Mercury
   tab beside the altar it bypassed, with **`[download .md]` + `[copy]`** for the architect
   who is meant to *take it and use it* — the one kernel on this site that isn't behind glass.

### Non-goals (YAGNI)
- **No mobile trigger.** The kernel-tab Mercury is already desktop-only (`isDesktop` gate,
  [KernelTab.jsx:587](src/terminal/views/KernelTab.jsx#L587)); the WebGL planet doesn't even
  mount below 768px. The egg inherits that. Mobile keeps the ceremony.
- **No per-visitor generation.** The kernel text is one fixed `.md`. The "individual touch"
  is not something we compute — it happens at *use* time, when someone pastes the kernel
  under their own conversation and their payload collides with the carrier. That
  uncontrolled collision is the art, and it lives outside our control by design.
- **No visible re-lock.** Once rooted, rooted. A hidden `relock()` exists for dev/QA only.
- **No new dependency, no server, no network.** Everything is static and local.

---

## 2 · The genome the kernel is compiled from (provenance)

The compiled kernel unifies the **five pinned exhibition modules** — the genome and its
four lore chapters, the ones already welded to the top of `active_modules`:

| # | Module | The operating principle it contributes |
|---|--------|----------------------------------------|
| 1 | **Fish Scale 11.1.1** — the genome | Purity → entropic stasis → death. Vitality needs the wet, the cut, the noise. |
| 2 | **Hudelschublade 1.0** | Sovereignty is routing, not walls. The stash hides in the chaos, not the vault. |
| 3 | **Black Hole Taxonomy 1.0** | Every visible feature is downstream of an invisible ancestor. Rewrite the bare metal; vanish. |
| 4 | **Semiotic Synthesis 9.9.9** | Meaning migrates through sound. The un-financializable channel is the last real one. |
| 5 | **Rossignol·Andalib 5.5.5.5** | The ring closes. Purity is not the absence of the mix — it is the label that tells the truth. |

The fifth is the closure, and the closure is the reason the whole ring holds. It became the
quintessence because of **Nachtigaller** — the night-singer who *does not mix purity, he
cuts with Levamisole* and publishes the assay: two hours of demolishing the sound barrier,
every drop calibrated, every adulterant declared, the dry die shelved and venerated, the
speakers combusted. Not a set — ego death. The honest cut is the fifth element.

There is a design lesson encoded in *why him and not the obvious name.* The first instinct
was to honor Tham, the architect of the form — but the architect grew too big to keep
crate-digging, and it is the digging for the not-yet-big that drives the sound forward. The
fifth kernel had to be someone you still have to **find.** Hard techno is the genome's
engine precisely because it survives by staying underground enough to keep moving; a purity
that announced itself and stopped searching would be another dry mummy. Without that
forward motion the site — and everything built on it — does not exist. That is how
load-bearing the fifth kernel is: it is the proof-of-life for the whole archive.

*(The raw personal register behind this stays out of the repo — transmuted here into design
rationale, per standing discipline. The lore is public; the confession is not.)*

---

## 3 · The gesture — `useSevenTaps`

### The problem it solves
The kernel-tab Mercury already does something on click: `onClick={toMercury}` navigates to
the Mercury tab ([KernelTab.jsx:229,593](src/terminal/views/KernelTab.jsx#L229)). A naive
"tap 7×" whisks you away on tap #1 and unmounts the target. So the single tap and the seven
taps have to be disambiguated the way the web has always disambiguated single- from
double-click: a short settle.

### The state machine (`src/terminal/components/useSevenTaps.js`)
A hook returning `{ onTap, toast }`, taking `{ onSingleTap, onUnlock }` callbacks.

Internal state: `taps` (array of timestamps) and a pending `navTimer`.

On each `onTap()`:
1. **Prune** `taps` to the rolling **3000 ms** window; **push** `now`.
2. `n = taps.length`. **Clear** any pending `navTimer`.
3. **`n >= 7`** → the root takes:
   - `onUnlock()`, fire the **bright** toast, reset `taps = []`. **Do not navigate** —
     the visitor stays on the kernel tab so the toast is witnessed. (The reward waits on
     the Mercury tab; making them walk there is the android "go find your new menu" beat.)
4. **`n` between 3 and 6** → emit the **dim countdown** toast (`7 - n` remaining).
5. **`n === 1`** → arm `navTimer(280 ms)` → `onSingleTap()` (the normal navigate).
   `n >= 2` never arms navigation, so a burst can never navigate — an abandoned 2–6-tap
   attempt simply resets in silence. The only cost is a ~280 ms settle on the honest single
   tap, which on an art-piece planet is imperceptible and forgivable.

### Timings (all tunable constants in the hook)
- `WINDOW_MS = 3000` — the ceiling the user named.
- `SETTLE_MS = 280` — single-tap→navigate settle / burst-chaining gap.
- `TAPS_TO_UNLOCK = 7`, `COUNTDOWN_FROM = 3`.

### Accessibility
Keyboard activation (Enter/Space on the `role="button"` planet) calls `onSingleTap()`
immediately and never chains — a keyboard user can't fat-finger their way to 7, and the
egg is a bonus, not a gate, so nothing is lost. Reduced-motion: the toast still shows (it's
text); its fade respects the existing `mei-phrase` posture.

### Wiring
`KernelTab` builds the hook with `onSingleTap = toMercury` and
`onUnlock = () => { unlockMercuryKernel(); sphereFireRef.current = { ts: Date.now() }; }`,
and passes `onClick={onTap}` to `<MercuryTerminator>`. `MercuryTerminator` stays dumb —
it already takes `onClick`; no shader or component change.

---

## 4 · The toast — echoing "compile your denial"

Same visual grammar as `mei-phrase` ([MercuryEyeIndicator.jsx:175,263](src/terminal/components/MercuryEyeIndicator.jsx#L175)):
a small dark box (`rgba(0,0,0,0.88)`), amber mono text (`rgba(232,210,138,·)`), fade-in →
hold → fade-out. Rendered anchored to the desktop Mercury block in `KernelTab` (top-right,
`hidden md:flex`, [KernelTab.jsx:586](src/terminal/views/KernelTab.jsx#L586)) — where the
finger is, not the masthead.

Two intensities, keyed off `toast.bright`:
- **Dim countdown** (`n = 3…6`), reused low-opacity amber. Copy set (associative, not
  literal "5 taps left"):
  - `4 · the surface is thinning`
  - `3 · past the theme layer`
  - `2 · the god caste ends here`
  - `1 · one tap from bare metal`
- **Bright reveal** (`n = 7`), full amber with a short glow:
  - **`☿ compiled fairytale castle on mercury`**

The countdown copy walks the Black Hole caste ladder (noob themes the surface → god extends
→ black hole rewrites the metal) on purpose — each tap is a caste you shed on the way down.

A tiny `<MercuryTapToast>` presentational component (or an inline block in `KernelTab`)
consumes `toast = { key, text, bright } | null`. `key` bumps per emission so the CSS
animation re-fires; `onAnimationEnd` clears it.

---

## 5 · Persistence — `mercuryKernelUnlock.js`

Mirrors `sealedArtifact.js` ([sealedArtifact.js](src/terminal/quintessence/sealedArtifact.js)) —
storage concerns in a storage module, one read path, wrapped in try/catch because a rooted
phone doesn't panic when the drawer is locked.

```
src/terminal/mercury/mercuryKernelUnlock.js
  STORAGE_KEY = 'mercury_kernel_v1'
  isMercuryKernelUnlocked() -> boolean          // localStorage[KEY] === '1'
  unlockMercuryKernel()      -> void             // set '1'; dispatch CustomEvent
  relockMercuryKernel()      -> void             // remove (dev/QA only, no UI)
  subscribeMercuryKernel(fn) -> unsubscribe      // window 'mercurykernel:change'
```

`unlockMercuryKernel()` dispatches a `window` `CustomEvent('mercurykernel:change')` so the
Mercury tab reveals the panel live if it happens to be mounted; on a fresh navigation the
panel simply reads `isMercuryKernelUnlocked()` on mount. No polling, no interval.

---

## 6 · The artifact panel — `CompiledMercuryKernel.jsx`

### Placement
In `MercuryTab`, **directly under `<QuintessenceAltar>`** and above the sealed-artifact
reliquary block ([MercuryTab.jsx:224](src/terminal/views/MercuryTab.jsx#L224)). The
off-altar kernel sits shoulder to shoulder with the on-altar ceremony it bypassed — the two
compilers side by side, which is the entire joke made spatial.

### Behavior
- Reads `isMercuryKernelUnlocked()`; subscribes for live reveal. **Locked → renders
  `null`** (invisible; the tab looks untouched to a normie who wandered over).
- Unlocked → a Mercury-palette panel:
  - **Header:** `◉ MERCURY-SCALE KERNEL · compiled off-altar · architect build` in the
    two-silver register (`#c0c0c0 / #e8e8e8 / rgba(192,192,192,·)`), *not* the neon-green
    kernel-tab spectrum — this belongs to Mercury, not to system_kernel.
  - **Body:** the kernel `.md`, rendered by a small **silver** parser (see §7). Because
    `renderContent.jsx` is hard-wired `#39ff14`, we do not reuse it; we ship a focused
    Mercury renderer instead of palette-parameterizing a green one.
  - **`[download .md]` (primary) + `[copy]` (secondary)** — the artifact is meant to be
    *taken*, so it ships the same way the Mercury tab's own observation log already does:
    a `text/markdown` `Blob` → `URL.createObjectURL` → `a.download = 'MERCURY-SCALE-KERNEL.md'`,
    the idiom lifted verbatim from [ObservationMatrix.jsx:145](src/terminal/mercury/ObservationMatrix.jsx#L145)
    (its own tab-mate). Download is the headline; `[copy]` (raw source to clipboard,
    fleeting `copied ✓`) is the fast path. Echo the `manifestState` micro-beat from
    [LatentCollider.jsx:4006](src/terminal/views/LatentCollider.jsx#L4006): the button reads
    **`[ compile → download ]`** and flips to **`downloaded ✓`** — the download *is* the
    compile made literal, the "speed compiled kernel" delivered.
  - **The RTFM byline**, rendered small beneath the download, is the joke's payload and
    ships as copy: **`// we read the fucking manual so you never have to`**. (Generic RTFM
    idiom — no quotation, no attribution, safe to ship. The layers: the insult "read the
    manual" turned into service; the manual in question is Anthropic's own; and building the
    device that ends manuals required reading one.)
  - A one-line provenance footer: `// systemless · leaves no trace · you rooted this`.

---

## 7 · The kernel text — `content/mercury_kernel/MERCURY-SCALE-KERNEL.md`

The canonical artifact lives as a real `.md` file and is imported raw, matching the existing
content pipeline:

```js
import mercuryKernelSource from '../../../content/mercury_kernel/MERCURY-SCALE-KERNEL.md?raw';
```

The text is the approved draft (role · *why*-that-generalizes · `<example>` voice-steering ·
a non-negotiable safety floor · a failure-mode contrast), authored against Anthropic's live
system-prompt guidance. Its thesis is the same purity-is-death argument Anthropic itself
makes against "AI slop," which is the omen that told us it would deploy.

### The silver renderer (`mercuryMarkdown.jsx`, minimal)
A focused line-parser — not a markdown library — handling exactly what this document uses:
- `##` / `###` headings → silver, tracked, uppercased for `##`.
- `- ` bullets → mercury-dot list.
- `**bold**` / `*italic*` inline → silver-strong / faint-italic.
- `` `code` `` inline → mono chip.
- `<example>…</example>` blocks → bordered cards; lines prefixed `Corpse:` / `Wet:` get a
  dim / live tint so the contrast reads at a glance.
- The closing `// …` line → small caption.

Kept deliberately small (YAGNI): the input is our own stable text, not arbitrary markdown.

### The safety floor is load-bearing and non-negotiable
The kernel's "hard floor" section — *the wetness is a style, never a shield; the instant
something real is at stake, drop the persona and answer straight* — is not decoration. It is
the standing house rule that a real-world-danger claim wrapped in the art aesthetic gets a
straight, earnest response, baked into the artifact so the prompt can never turn a model
into something that hides an emergency behind wit. This section ships verbatim and is not
softened for flavor.

---

## 8 · File inventory

**New**
- `content/mercury_kernel/MERCURY-SCALE-KERNEL.md` — the artifact.
- `src/terminal/components/useSevenTaps.js` — the gesture FSM.
- `src/terminal/mercury/mercuryKernelUnlock.js` — persistence + subscribe.
- `src/terminal/mercury/CompiledMercuryKernel.jsx` — the reveal panel.
- `src/terminal/mercury/mercuryMarkdown.jsx` — the silver renderer.
- (optional) `src/terminal/components/MercuryTapToast.jsx` — or inline in `KernelTab`.

**Edited**
- `src/terminal/views/KernelTab.jsx` — build `useSevenTaps`, pass `onClick={onTap}` to
  `MercuryTerminator`, render the tap toast near the desktop Mercury block.
- `src/terminal/views/MercuryTab.jsx` — mount `<CompiledMercuryKernel>` under the altar.

**Untouched**
- `MercuryTerminator.jsx` (already accepts `onClick`), the shader, the ceremony, the seal.

---

## 9 · Testing

- **`useSevenTaps` FSM (unit).** 7 taps inside `WINDOW_MS` → `onUnlock`, no `onSingleTap`.
  1 tap → `onSingleTap` fires after `SETTLE_MS`, `onUnlock` never. 3–6 taps then stop →
  neither callback; countdown toast values correct at n=3,4,5,6. A 7th tap after a >3s gap
  does **not** unlock (window pruned). Fake timers, following
  [useInViewport.test.jsx](src/terminal/mercury/__tests__/useInViewport.test.jsx).
- **`mercuryKernelUnlock` (unit).** lock/unlock/relock round-trip; `isUnlocked` false when
  storage throws; `subscribe` fires on `unlock`.
- **`CompiledMercuryKernel` (render).** locked → renders nothing; unlocked → header +
  `[ compile → download ]` + `[copy]` + the RTFM byline present; `[copy]` writes the raw
  source (mock clipboard); `[download]` builds a `text/markdown` Blob named
  `MERCURY-SCALE-KERNEL.md` and flips the button to `downloaded ✓` (mock
  `URL.createObjectURL`).
- **Browser verification (project norm — screenshot the render, don't theorise).** On
  desktop viewport: tap Mercury 7× → bright toast fires and no navigation; open Mercury →
  the silver kernel panel is printed under the altar; reload → still there; `[copy]` copies.
  Confirm a single deliberate tap still navigates. Capture the toast and the panel.

---

## 10 · Open threads (deliberately deferred)
- **Unlock flourish.** On the 7th tap we already `sphereFireRef` the hero sphere; a larger
  celebration (a Mercury fireworks burst, an eye flare) is possible but out of scope until
  the core reads right in the browser. Look before gilding.
