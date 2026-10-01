# /MERCURY phase 4 — the Sun's signature + gem pass

Date: 2026-10-01 · Branch: `feature/mercury-signature` (off `feature/mercury-surface` @ `25da0614`) · Status: APPROVED in sections by the author, awaiting review of this written spec

Master spec: `2026-09-30-mercury-gem-polish-design.md` (this document is its **Amendment 4**). Phase 4 is defined there in §7 item 4. Its physics lives in §3 (rows "Noon: boiling" and "Solar-wind sodium tail") and §5 "Shading per pixel" items 3–4. Amendments 1–3 stay binding.

## 1. Scope

Four parts plus a tuning pass:

1. **Mobile GPU budget:** a perf HUD, quality tiers, and a measured `phone` tier.
2. **Reduced motion** (`CALM`).
3. **Boiling roil:** bubble-collapse pops.
4. **Exosphere:** the sodium tail plus the Hg vapour limb haze.
5. **Author tuning pass.**

## 2. Author decisions (this session)

| # | Decision |
|---|---|
| D1 | Mobile bar: **the author's phone, 60 fps**, holding with the liquid branch on. |
| D2 | Phone numbers come from an **on-screen dev HUD** (`?perf=1`) that the author reads or screenshots. No USB/CDP tracing. |
| D3 | **Fixed tiers, no runtime auto-switching.** Tier = `isMobile ? 'phone' : 'full'`; `?tier=` overrides it. |
| D4 | Reduced motion means **a direct turn and a calm liquid**. A drag turns the planet 1:1 under the pointer with no inertia. Transmutation still happens, as a still mirror. Release eases back slowly (overdamped). Motion only ever follows the user's hand. |
| D5 | Under `CALM` the **aether streak drift freezes** too. |
| D6 | Tail brightness is **honest, with a floor**: it follows `g(|v_r|)/r²` from the ephemeris, never below 15 % of the orbit's peak. |
| D7 | Exosphere renders as a **separate additive mesh**, with two species (Na, Hg vapour) in one module and one draw. |
| D8 | Roil is **bubble-collapse pops** built on the existing dispersive `rippleSlope`. Noise is only the `lite` fallback. |
| D9 | The g-curve is a **fitted model**, a stated convention. It is not tabulated literature data. |

## 3. Quality tiers — `planet/planetQuality.js` (new, pure)

| Axis | `full` | `phone` | `lite` |
|---|---|---|---|
| DPR cap | 2 | 1.5 | 1 |
| Ripple slots (`IMPULSE_SLOTS` in the shader) | 8 | 4 | 2 |
| Shadow march steps (`SHADOW_STEPS`) | 12 | 6 | 0 (Lambert only) |
| Roil | pops | pops | 1 noise octave |
| Exosphere ray steps | 16 | 8 | 0 (closed-form halo only) |

- The `phone` column is a starting guess. Checkpoint 1 (§8) replaces it with measured values.
- A tier is a **shader variant**. `buildPlanetShader({ tier, calm })` returns the VS/FS strings, with loop counts as compile-time `const int` via `glf()`.
  - Switching tier or `calm` rebuilds the material once, never per frame.
  - The JS ring buffer keeps 8 slots. Only the shader loop is shortened: the strongest *k* are written first, which needs a sort by |amplitude| in `impulseFrame`.
- **Parity invariant:** `buildPlanetShader({ tier: 'full', calm: false })` is byte-identical to today's shader strings (test).
- `MercuryCanvas` takes `dpr` from the tier.

## 4. Perf HUD — `MercuryPerfHud.jsx` (dev only, `?perf=1`)

- Samples the frame `delta` into a preallocated ring buffer inside `useFrame` (no React state per frame). A 4 Hz timer writes a fixed DOM overlay.
- Shows:
  - frame time p50 / p95 / max over the last 2 s, and the fps they imply;
  - tier, `calm`, DPR, and canvas pixel count;
  - τ, heat, and boil coverage (§6);
  - tail B and v_r (§7);
  - the same frame-time stats **split into still (τ = 0) and liquid (τ > 0)**, so the expensive state is never averaged away.
- Never mounted without `?perf=1`, and tree-shaken out of production builds (`import.meta.env.DEV` guard).

## 5. Reduced motion — `CALM`

- **Source:** `matchMedia('(prefers-reduced-motion: reduce)')`, subscribed with `change` so an OS toggle applies live. A `?calm=1` override exists for probes.
- **`stepBody(..., { calm })`:**
  - While dragging, the orientation is set directly from the pointer's angular displacement over the frame (axis-angle premultiply of the pointer rotation since the last sample; time-independent). `omega` is held at the pointer's angular velocity for the heat store only. It is never carried over after release.
  - On release, `omega` is zeroed at once. Recapture runs **overdamped**: `RECAPTURE_CALM_OMEGA` with damping ratio ζ = 2, no overshoot, no ramp delay.
  - The heat store, the heat floor (`HEAT_OMEGA_FLOOR`) and the hysteresis are unchanged, so a vigorous hand still melts the bead and it still refreezes.
- **Shader `CALM` variant:** compiles out ripples, body modes, spin bulge, the bead re-intersection and roil pops. The roil's roughness patches stay but are frozen in time (pop activity sampled at a fixed t).
- **Aether:** `aetherLobeDirs` stops advancing its clock (D5). The streaks stay where they are.
- **Strikes:**
  - On crust: crater as now (a crater is a state change, not motion).
  - On liquid or solid Hg: no impulse. Instead, a 0.4 s smooth brightening at the impact point (a static Gaussian, fading in and out), so the tap still answers.
- **Exosphere:** streamer noise frozen. Brightness follows the ephemeris, which barely moves.
- `CALM` is orthogonal to the tiers: a desktop with reduced motion = `full` + `CALM`.

## 6. Boiling roil — `planet/mercuryRoil.js` (new, pure, mirrored in GLSL)

- **Domain:** only where `boilW > 0` (local T > 629.88 K, spin heat included). That band is world-frame (Sun-fixed). Pop cells live in the **body** frame (`xb`), so they ride the liquid and switch on as they pass under the noon zone.
- **Cells:** a 3D Worley lattice over `xb · POP_FREQ`, with site jitter hashed per cell and then noise-warped (no visible grid).
- **Clock per cell:** a hashed period `P ∈ [POP_P_MIN, POP_P_MAX]` and a hashed phase; `age = mod(t + phase, P)`. The time base is `uTime` (seconds), so rate parity across refresh rates holds by construction.
- **Density by superheat:** a cell is active iff `hash_c < popDensity(T − T_boil)`. `popDensity` rises smoothly and monotonically from 0 at T_boil: sparse isolated pops at the band edge, dense rolling boil toward noon. No hard line.
- **The pop:** `rippleSlope(th, age, pxArc)`, the existing dispersive capillary train including its snap dimple (the collapsed bubble's crater). Splash and boil are one physics. The amplitude is `roilGain` (a `PLANET_TUNE` look knob, default 1).
- **Containment:** a pop's ring is windowed to zero at `POP_REACH = 0.45 ×` cell spacing. The shader sums the **two nearest sites** (F1, F2), so no seam shows at a cell boundary. Per boil fragment: an 8-neighbour Worley search plus 2 `rippleSlope` evaluations.
- **Coherence loss:** roughness = `mix(ROUGH_LIQUID, ROUGH_BOIL, boilW · (0.5 + 0.5 · popActivity))`, where `popActivity` ∈ [0,1] is the local dimple strength. The floor stays ≥ 0.14 (the black-mirror trap).
- **Starting values** (tuned live with the author): cell spacing ≈ 0.07 rad (~15 px on the desktop disc); pop life ≈ 0.6 s at `WAVE_PLAYBACK`.
- **`lite`:** one octave of `vnoise3(xb · ROIL_LITE_FREQ + t · ROIL_LITE_SPEED)`, used as a normal tilt × `boilW`.
- **`CALM`:** pops compiled out; the frozen roughness patches remain (§5).

## 7. Exosphere — `planet/mercuryExosphere.js` (new, pure) + `MercuryExosphere.jsx`

### Physics, owned by the module
- **Brightness:** `B = clamp(g(|v_r|)/r² / B_max, B_FLOOR, 1)`.
  - `B_FLOOR` = 0.15 (D6).
  - `B_max` is the maximum of `g(|v_r|)/r²` over one orbit, computed once at module load by sampling `mercuryEphemeris` across 88 days.
- **`g(v)`:** a smooth fitted model of the solar Na D Fraunhofer line core. Minimum at v = 0; rises steeply and saturates by |v| ≈ 8–10 km/s. The module header states it is a convention (D9), not the Killen et al. tables, the same way `mercuryEphemeris.js` states its precision boundary.
- **Tail length:** `L = L_MIN + (L_MAX − L_MIN) · B`. Radiation pressure drives the tail, so a weak tail is short as well as dim.
- **Inputs:** `r` and `rdotKmS` from `mercuryEphemeris`, refreshed on the existing `EPHEMERIS_REFRESH_S` tick. A dev-only `__mercuryTune.dateOverride` feeds probes.
- **Hg vapour coverage**, analytic on the CPU: the boiling cap is where `T_ss · cos^¼θ + heat > T_boil`, so `cosθ_b = ((T_boil − heat)/T_ss)⁴`, clamped to [0,1], and `coverage = τ · (1 − cosθ_b)/2`. No GPU readback.

### Density, in scene units (R = planet radius)
- **Na halo:** `n = exp(−(r − R)/H_NA)` for r > R.
- **Na tail:** about the world anti-Sun axis `a = −SUN_DIR_WORLD` (independent of the body's spin). With s = distance along a and ρ = distance from the axis:
  `n = B · exp(−s/L) · exp(−ρ²/(2w(s)²))` for s ≥ 0, where `w(s) = W0 + W_SPREAD · s`.
  Plus a faint streamer noise advected downstream (frozen under `CALM`).
- **Hg haze:** `n = coverage · exp(−(r − R)/H_HG)`, at a much lower gain than Na.

### Rendering
- An additive box mesh fitted around the halo and the current tail length L, drawn with `side: BackSide` (works with the camera inside). It is refitted only on the ephemeris tick.
- **Fragment:** clip the view ray to the box and analytically to the planet sphere (radius R; Amendment 3's ≤ 6 % wobble is ignored here), then integrate along the ray: 16 steps on `full`, 8 on `phone`, closed-form halo only on `lite`.
- **Colour:** Na ≈ linear `(1.0, 0.55, 0.12)`, Hg ≈ `(0.75, 0.80, 0.90)`. Look knob `exoGain`.
- **Ordered dither** on output (QD-OLED banding on faint gradients).
- Never particles. No bloom.
- **Expected framing** (Sun at `[-0.82, 0, 0.57]`): the tail points right and away from the camera. It emerges past the right-rear limb, foreshortened, its root partly hidden by the planet.

## 8. Sequencing

Each task gets its own commit and live check.

1. **Tiers + shader variant build + HUD.** No visible change at `full` (parity test).
   **Checkpoint 1:** the author screenshots the HUD on their phone in still, liquid and hard-spin states. Those numbers set the `phone` column.
2. **`CALM`** (§5).
3. **Roil** (§6).
4. **Exosphere** (§7).
5. **Checkpoint 2:** the author's phone HUD with roil and tail on. A miss is cut along tier axes only, never by changing the `full` look.
6. **Author tuning pass:** `roilGain`, `exoGain`, pop spacing and life, `B_FLOOR`, plus the open items carried from phase 3 (the drag dimple, `modeGain`, crater subtlety).

## 9. Testing and verification

**Unit (vitest):**
- `planetQuality`: tier table shape; `full`-variant byte parity; each tier × `calm` compiles (the shader compile test).
- `mercuryBody` `calm`:
  - the pointer turn is reproduced exactly;
  - no carried ω after release;
  - overdamped return with no overshoot;
  - heat and hysteresis unchanged;
  - 60/360 Hz parity.
- `mercuryRoil`:
  - determinism;
  - no pops below T_boil;
  - density monotonic in superheat;
  - slope = 0 beyond `POP_REACH`;
  - the F1+F2 sum continuous across a cell boundary;
  - GLSL constants interpolated from the module.
- `mercuryExosphere`:
  - `g` has its minimum at 0 and is monotonic in |v|;
  - B ∈ [B_FLOOR, 1] across an 88-day sweep, with its max = 1 at the |v_r| maxima;
  - tail axis = −Sun;
  - coverage = 0 below the threshold and monotonic in heat;
  - density = 0 inside the planet.

**Live** (headless CDP; the in-app pane runs at 0 fps):
- New probes in `.superpowers/sdd/tools/`:
  - `boilProbe.mjs`: heat held at the cap; contact sheet of the noon zone over time.
  - `exoProbe.mjs`: `dateOverride` swept across one orbit.
  - `calmProbe.mjs`: `--force-prefers-reduced-motion`; drag, release, strike.
- Regressions after tasks 2–3: `refreezeProbe.mjs`, `tumbleDense.mjs`, `slowStrokeProbe.mjs`.
- Screenshot before any visual diagnosis.
- Motion feel, banding and fps are judged only by the author, on their screen and phone.

## 10. Risks

- **Roil cost on the phone** (8-neighbour Worley + 2 ripple evaluations per boil fragment). Mitigation: tier axes; the boil band is a fraction of the disc.
- **Exosphere overdraw** when the tail is long. Mitigation: the box is fitted to L and shrinks when B is low.
- **The `CALM` turn's frame-rate independence:** it is driven by pointer displacement, not per-frame steps (tested).

## 11. Out of scope

- A Sun shader or bloom.
- Night-side Na emission.
- Hg tail particles.
- Tabulated g-factors.
- Persisting state across visits.
- KernelTab's `MercuryTerminator` reading the exosphere.

## 12. Refinements from planning (2026-10-01)

- **R1 (§6):** the shader sums every active pop within reach, not just F1/F2. The 2×2×2 neighbourhood `floor(p − 0.5) + {0,1}³` contains every site that can reach `p` when `POP_JITTER + POP_REACH < 1`, so the sum is exactly seam-free. Pops are sparse, so the cost matches F1/F2.
- **R2 (§6):** a pop is the splash train miniaturised: `rippleSlope(th·POP_SCALE, age·POP_TIME, pxArc·POP_SCALE)`. At `WAVE_PLAYBACK` real dispersion cannot keep a 0.6 s pop inside its ~0.03 rad reach. This is a third stated playback convention.
- **R2 amended (2026-10-01):** pop geometry re-scaled so the rings resolve. At `POP_FREQ` 14 / `POP_REF_TH` 0.5 the peak wavelength mapped to ~1 px on the rest disc (pxArc ≈ 0.0047) and `bandAA` erased it, leaving only the sub-pixel snap dimple as specks. New values: `POP_FREQ` 5 (0.2 rad cells), `POP_REF_TH` 0.25, so `POP_REACH_RAD` = 0.09 rad (≈ 19 px), `POP_SCALE` ≈ 2.78, `WAVE_K_PEAK·pxArc·POP_SCALE` ≈ 1.18 ≤ 2π/5 (≈ 5.3 px per peak crest, ~3.6 crests in reach). `POP_JITTER`, `POP_REACH`, `POP_DENSITY_K`, `POP_AMP` unchanged (reach/cell ratio, so area coverage, is unchanged; pop count per area drops ~8×). The snap dimple now fades by pixel footprint (`dimpleAA`: smoothstep over dimple radius 1.5–2.5 px) inside `rippleSlope`; it is exactly 1 for any splash at pxArc ≤ 0.02.
- **R3 (§7, §9):** `g/r²` does not peak exactly at the |v_r| maxima. The test asserts that B at perihelion (v_r ≈ 0) is below B at the date of maximum |v_r|.
