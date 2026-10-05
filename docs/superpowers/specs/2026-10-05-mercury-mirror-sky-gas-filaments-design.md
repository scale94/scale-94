# Mercury aether — moving mirror sky + gas filaments

Date: 2026-10-05 · Branch: `feature/mercury-stage` (LOCAL ONLY, never push without the author's command)
Sub-project 2 of 3 of "the circulating field". Sub-project 1 was the glitter dust; next is the shared
velocity field.

## Problem

The author's read of the live scene (2026-10-05): **the liquid looks hit by a rave light show.**

- **The mirror does not reflect the gas.** It reflects 16 analytic Gaussian ellipses (`aetherLobes.js`, drawn by
  `aetherMirror` in `hgMirrorGlsl.js`). They are saturated: each lobe takes palette colour `i % 3` of every
  element, and the ghost elements still add up to 0.12 each. So the fluid's pure magenta and cyan show even in the
  fire phase.
- **The mirror is near-static while the nebula is highly dynamic.** This is the main break, the author's own
  catch. The lobes turn rigidly about +Y at 0.04 rad/s (one turn per 2.6 min, `MercuryPlanet.jsx:691`), while the
  fluid's knot drift loops in ~15 s and the air orbits at ~0.9 rad/s.
- **The gas itself reads as soft round puffs.** Several-px `smoothstep` discs overlap into fog, and no filaments
  or currents are visible.
- **There is no shared time base.** Each flow integrates its own `uTime` from a random start (air ×100, fire ×120,
  earth ×100) and multiplies it by the *current* speed slider (`uTime · uSpeed`). That is the `rate(x_now) · t`
  trap: moving the slider jumps every particle's phase. The flows also ignore calm (reduced motion).

## Decisions (author, 2026-10-05)

- **Mirror look A:** a dim, cold sky. Black space and the Sun dominate, and the element shows as fine moving
  structure, never as blocks of colour.
- **Approach 1:** a procedural per-element sky `aetherSky_e(R, t)` evaluated analytically in the mirror shader,
  moving at its gas's pace. No cubemap. It matches the gas statistically, not particle for particle.
- **Approved looks** (companion mockups, `mirror-sky-v5.html`; GLSL in the appendix):
  - Water: curling filaments.
  - Fire: rising self-lit tongues.
  - Air: contra-rotating streamlines.
  - Earth v2: slow grainy settling dust, plus rare sharp specular pings off tumbling grains on the sunward dark
    side, 1–2 concurrent.
- **Build order 3 → 1 → 2:** the shared clock, then the mirror sky, then the gas filaments.
- **Fire:** keeps round embers. Only the fast sparks get a mild stretch, ≤ 1.5×.
- **Mirror shows the active element only,** cross-fading cleanly during a phase switch. Ghosts are not reflected.
- **Phone budget:** the gas density multiplier is adaptive, keyed to the phone frame-time gate, ≥ 2×.
- **Calm freezes the entire gas volume** (a new behaviour).
- **Rough crust and glaze drop noise octaves.**
- **The "hgMirrorGlsl byte-identical" rule from sub-project 1 is deliberately broken.** The planet FS snapshot is
  re-pinned. Droplets and beads inherit the new sky through `envRadiance`, and that is intended.
- **Out of scope:**
  - The gas self-shadow (idea B's second half).
  - The offscreen LIC pass (idea C).
  - The shared velocity field for beads (sub-project 3).
  - Hg vapour and the anti-sunward lean.

## §1 The shared clock (`planet/aetherClock.js`, new)

A pure module (no React, no THREE) with a tiny hook wrapper. State:

| Field | Meaning |
|---|---|
| `t` | shared aether time in seconds. `t += delta` unless calm. |
| `phase.fluid` | `∫ speed dt`: the fluid knot phase (replaces `uTime · uSpeed`) |
| `phase.thermal` | `∫ speed dt`: the fire life phase |
| `phase.earth` | `∫ speed dt`: the sediment life/sink phase |
| `phase.air` | `∫ orbitalSpeed dt`: the cyclone angle phase |

- **Integrated:** every phase is integrated from its own rate. Moving a slider changes only the rate, never the
  phase (fixes the jump).
- **Calm:** calm freezes `t` and every phase, so the whole nebula stops. Condensation, opacity cross-fades and
  phase switches still run (they aren't motion).
- **Ticked once per frame, idempotently:**
  - `tickAetherClock(clock, frameStamp, delta, rates, calm)` advances only when `frameStamp` differs from the last
    one (the r3f frame time).
  - Every consumer calls it at the top of its `useFrame`, and the first caller per frame advances.
  - No `useFrame` priority is used: a non-zero priority would take over r3f's render loop.
- **One clock instance** is created in `MercuryCanvas` and passed to the four flows and `MercuryPlanet` as a prop.
  No per-frame allocation.
- **Start offsets:** the random start offsets are dropped. One deterministic start keeps the mirror and the gas in
  step.

**Shared rate constants (`FLOW_RATES`).** Each is exported once and interpolated into *both* the flow GLSL and the
sky GLSL with `glf()`. String tests pin that the flow shader source and the sky source contain the same constant.

| Constant | Value (from the flow source) | Used by |
|---|---|---|
| `FLUID_LANE_MEAN` | 0.8 (mean of `0.6 + 0.4·aOffset`) | knot drift. Sky: water rotation about the knot axis, angle `= 2·2π·FLUID_LANE_MEAN·phase.fluid` (knot centre angle is `2φ`). |
| `AIR_ORBIT_MEAN` | 0.75 (mean of `0.4 + 0.7·aSpeed`) | cyclone. Sky: upper hemisphere `+AIR_ORBIT_MEAN·phase.air`, lower `× AIR_LOWER_DIR` |
| `AIR_LOWER_DIR` | −0.85 | already the flow's lower-layer direction |
| `FIRE_RISE` | mean rise per unit life phase (`mean(riseSpeed) · mean(lifeMult)`) / `AETHER_LOBE_R` 1.4 | sky: tongue scroll in direction space |
| `EARTH_SINK` | mean sink per unit phase / 1.4 | sky: dust and grain drift |

- **Plan step 1** computes the exact means from the flow sources and records them.
- **Advection sign.** A pattern carried at angular rate ω is sampled at `az − ω·phase`, so it moves *with* the
  gas. The mockups used `az + …` for air and `rotY(R, +t…)` for water, which may run against the current. Plan
  step: derive the sign from the flow (the angle grows with time, `x = cos`, `z = sin`) and pin it with a test that
  evaluates the JS-side angle convention.
- **The water axis must match the knot's world axis.** The knot is built in its local xy-plane (axis +Z) and the
  flows are mounted unrotated (verify in the plan).
- Slow internal noise drifts (warp, gusts, flicker) use `t`, not a phase.

## §2 The mirror sky (`planet/aetherSky.js`, new; `hgMirrorGlsl.js` rewired)

**Removed:**
- `aetherLobes.js`, apart from what other modules still import. `mulberry32` moves to its own tiny module or into
  `hgBeads.js`. `AETHER_LOBE_R` is kept if `aetherLight` still needs it.
- `aetherStreak`, `aetherStreakColor`, the `AETHER_SHAPE` constant.
- The uniforms `uAethDir[16]`, `uAethCol[16]`, `uAetherSinW`, `uAetherEdge`, `uAetherStretch`, `uAetherCurve`,
  `uAetherCore`.
- The per-frame `aetherLobeDirs` / `aetherLobeColors` work in `MercuryPlanet`.
- `PLANET_TUNE` keys and `AETHER_FRINGE_*` constants that become unused.
- The tests for removed code.

**Added, `AETHER_SKY_GLSL`:**
- Shared noise helpers: hash `h`, value noise `vn`, and an `fbmL(p, oct)` that fades octaves by a float LOD.
- The four functions `skyFluid`, `skyThermal`, `skyEarth` and `skyAir`, each taking `(R, rough)` and reading the
  clock uniforms.
- **The combiner `aetherSky(R, rough)`:**
  ```
  vec3 s = vec3(0.0);
  if (uSkyW.x > 0.01) s += uSkyW.x * skyFluid(R, rough);
  ... (one branch per element; at most two non-zero weights, during a cross-fade)
  ```
- **Uniforms:**
  - `uSkyT` (float): `clock.t`.
  - `uSkyPhase` (vec4): the four element phases.
  - `uSkyW` (vec4): mirror weights.
  - `uSunDir` already exists, so the mockups' `S` becomes `uSunDir`.

**Mirror weights.**
- **Source:** `w_e` comes from `phaseOpacities[e]` (`usePhaseTransition`), with ghosts removed: an element counts
  only while it is the active phase or is fading out of being the active phase.
- **Normalisation:** `w_e = phaseOpacities[e]` for the elements in the current transition pair, divided by their
  sum when that sum is > 1, and 0 for every other element.
- **Cost bound:** at most two skies are evaluated per pixel, and only during the ~1 s switch.
- **Plan step:** read `usePhaseTransition` and pin the exact formula with a unit test (pure function
  `skyWeights(activePhase, opacities, out)`).

**Rewired `aetherMirror(R, rough, nW)`** (the signature is kept, so every call site keeps working):
```
return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(aetherSky(R, rough)));
```
- `aetherTint` (night), `aetherShoulder` (hue-preserving roll-off), `aetherHue` (`uAetherSilver`) and
  `uAetherGain` are kept.
- Their defaults are re-tuned in the look round. The starting point is gain such that the mockup proportions hold
  under the planet's exposure.
- `envRadiance` is unchanged apart from calling the new `aetherMirror`.

**Roughness → octave LOD (approved).**
- **LOD:** `lod = 1 − smoothstep(SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, rough)`. Octave count fades from 5 (liquid) toward
  1, implemented as per-octave amplitude weights in a constant-bound loop (GLSL ES 3.0 / three's WebGL2).
- **At or above `SKY_ROUGH_FLAT`** (starting value 0.6), each sky returns its **element mean radiance**: a constant
  colour per element times the weight, with no noise at all. This covers:
  - the frost and evaporite ambient lookups (`envRadiance(nW, 1.0, …)`), which become free;
  - the polycrystalline crust (`ROUGH_SOLID`), which becomes nearly free.
- **Earth pings are suppressed above the sharp threshold.** A rough mirror cannot resolve a pinpoint.
- **Element mean radiances** (`SKY_MEAN_FLUID/THERMAL/EARTH/AIR`, vec3) are measured once:
  - Render each sky at rough 0 into a small equirect target via CDP and average over solid angle (cos-latitude
    weighted), over a few `t` samples.
  - Write the results to `planetLook.js`, with that recipe in a comment.
  - **Requirement:** sweeping rough from `SKY_ROUGH_SHARP` to `SKY_ROUGH_FLAT` gives no visible brightness step on
    the crust.

**Earth pings:**
- The tumble phase is per-grain `t · rate_grain + offset`. The rates are constant per grain, so the phase is
  integrated by construction.
- `t` freezes under calm, so the pings freeze too.
- `SKY_PING_EXP` 250 and `SKY_PING_GAIN` 10 are named constants (the approved cadence: 1–2 concurrent on the sphere
  at desktop size).

**Cost budget.**
- Sky evaluations per liquid pixel ≤ 2 (liquid + one rough). The rough one costs ~1 octave or a constant.
- **Measure** desktop and phone frame time against the current lobes. Phone p50 must stay within the existing
  phase-5 phone budget, with no regression > 1 ms p50 on the CDP phone profile.
- **If over budget:** cut the water warp from 3 fbm to 2, then lower the liquid's max octaves on the phone tier
  (`TIERS[tier].skyOctaves`).

## §3 Gas filaments (the four flow shaders)

**3a. Motion factored and clocked.**
- Each flow VS gets `vec3 flowCore(<attrs>, float phase, float t)`: the **analytic big motion only** (knot drift,
  cyclone orbit, flame rise + taper + ember drift, sediment sink + eruption arc). Curl turbulence and shimmer
  stay outside it.
- `main` computes:
  - `pos = flowCore(phase) + curl + shimmer`, as today;
  - `prev = flowCore(phase − STREAK_DT·rate) + (the same curl + shimmer offsets)`.
- **Velocity comes from the big motion only.** Streaks show the current, not the jitter. The extra cost is one
  cheap analytic evaluation per vertex, not 6 more snoise calls.
- **Uniforms:** `uTime` → the clock's `t`. `uTime · uSpeed` (or `uOrbitalSpeed`) → `uPhase` from the clock.
- **Lifecycle wrap guard:** where a particle's `fract()` life wrapped between `prev` and `pos`, the streak length
  is 0, so no streak is drawn across the respawn jump.

**3b. Velocity-aligned capsules.**
- Project `pos` and `prev` (both after condensation scaling) to pixels: `d = px(pos) − px(prev)`, normalised by
  `STREAK_DT` into a px/s velocity.
- **Length:** `L = min(|d| · STREAK_GAIN, (STRETCH_MAX − 1) · size)`.
- **Sprite size:** `gl_PointSize = size + L`.
- **Varyings:** `vDir` (unit 2D, point-coord space, y flipped), `vCap = vec2(L, size) / gl_PointSize`.
- **FS:**
  - Distance from the fragment to the segment of length `L` through the sprite centre along `vDir`, in units of
    the sprite radius.
  - The element's existing radial falloff is applied to that distance, so each element keeps its own edge
    softness, now on a capsule.
  - Fragments outside are discarded.
- **Stretch limits:** `STRETCH_MAX` is 3 for fluid, air and earth. For fire it is 1.5, applied **only to embers**
  (`aEmber`). Flame body particles stay round.
- **Calm:** velocity 0 → round sprites.
- **Fill-rate:** the sprite area grows by up to 3×, with the count capped by §3d.
- `STREAK_GAIN` is the look knob ("how much speed shows"), tuned live.

**3c. Ridged-noise mask** (per particle, in the VS):
- `m = pow(1 − |2·snoise3(worldPos · MASK_FREQ + drift) − 1|, MASK_SHARP)`.
  - `drift` advances with the element's phase, so the mask travels with the current.
  - The mask also moves slowly with `t`, so it never sits still (no static lattice: banded/mechanical is a hard
    fail).
- **Alpha:** `alpha *= mix(1, m, MASK_DEPTH)`. The mask changes transparency only, never position.
- **Cost:** one snoise per vertex (two octaves at most).
- Ghost flows share the shader, so they get streaks and mask too at their existing low density.

**3d. Density and size.**
- **Active density:** `base × TIERS[tier].gasDensity`, where base = 1200 desktop / 600 mobile:
  - `full` 3;
  - `phone` 3 if the phone gate passes, else 2 (never < 2);
  - `lite` 1.
- **Sprite size:** base size × `GAS_SIZE_SCALE`.
  - Start at ⅓ per the approved recipe, with a floor of 1.5 px on `gl_PointSize` so sprites never go sub-pixel and
    shimmer.
  - Alpha is re-balanced live so the overall nebula brightness holds. At ×3 count, area ÷ 9, opacity needs roughly
    ×3 as a starting point.
- **Density slider:** an explicit slider value (`params.density`) is used as is. The tier multiplier applies to
  the default only. The slider-min quirk (1000 vs the 600 mobile default) stays as noted in the handover, untouched.
- `GHOST_DENSITY` is unchanged.

## §4 Testing

- **Pure modules** (vitest): `aetherClock` covers:
  - integration;
  - a slider change not jumping the phase;
  - calm freezing everything;
  - an idempotent tick on the same frame stamp;
  - no allocation per tick.

  `skyWeights` covers the active-only rule, the cross-fade pair and normalisation.
- **Shader source tests** (the `?raw` / string idiom, `flowLight.test.js` style):
  - each flow uses `uPhase` and the clock `t`, with no `uTime * uSpeed` left;
  - `FLOW_RATES` constants are present in both the flow and sky sources;
  - capsule FS present, fire stretch ≤ 1.5 and embers-only;
  - lifecycle wrap guard present;
  - mask present.
- **Snapshot:** the planet FS snapshot is re-pinned **once**, in the mirror-sky task. The diff must show only the
  aether-sky change.
- **Live GPU compile via CDP** after every shader task (planet, droplet, bead, four flows). A float/vec3 mismatch
  has shipped past read-review before.
- **Live checks:**
  - mirror moving in step with the gas, per element (CDP frames over ~2 s, diff-based motion check);
  - earth ping cadence, measured numerically (bright-pixel count over 240 frames; 1–2 concurrent);
  - calm freezes gas, mirror and pings;
  - phase switch cross-fade, with no pop and never more than 2 skies.
- **Phone gate:** CDP phone profile frame time p50/p95 before vs after, plus a hardware check by the author. This
  decides `gasDensity` on the phone (3 or 2).
- **Gates:**
  - `npm run lint`: 0 errors, warnings ≤ the cap;
  - `npx vitest run src/terminal/mercury`: all pass;
  - full suite: only the known `artComposite compositeDpr` failure.

## §5 Look round (after the build, with the author)

Settled on the live build, on the author's 360 Hz panel:
- `uAetherGain` and the sky brightness under the real exposure;
- `uAetherSilver`;
- `STREAK_GAIN` (streak length);
- `MASK_DEPTH` / `MASK_SHARP`;
- `GAS_SIZE_SCALE` and the alpha balance.

Exposed on `window.__mercuryTune.planet.*` like the existing knobs.

## Appendix — approved sky GLSL (mockup `mirror-sky-v5.html`, verbatim)

The mockup's `t` speeds were approximations. In the build:
- `rotY(R, t*0.5)` (water) becomes the knot-axis rotation from `phase.fluid` (§1);
- `t*0.8` (fire scroll) becomes `FIRE_RISE·phase.thermal`;
- `t*0.9*s` (air) becomes `AIR_ORBIT_MEAN·phase.air` with the `AIR_LOWER_DIR` asymmetry;
- the earth drift `t*0.05` / `t*0.02` becomes `EARTH_SINK·phase.earth`;
- `S` becomes `uSunDir`;
- the octave loops take the LOD.

The character, constants and proportions below are what the author approved.

```glsl
float h(vec3 p){ p = fract(p*0.3183099+.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
vec3 rotY(vec3 v, float a){ float c=cos(a), s=sin(a); return vec3(c*v.x+s*v.z, v.y, -s*v.x+c*v.z); }

vec3 water(vec3 R, float t){
  vec3 q = rotY(R, t*0.5) * 2.2;
  vec3 w = vec3(fbm(q+vec3(0.,0.,t*.15)), fbm(q+vec3(5.2,1.3,-t*.12)), fbm(q+vec3(2.1,7.7,t*.1)));
  float n = fbm(q*1.1 + 1.8*w);
  float ridge = pow(1.-abs(n*2.-1.), 9.);
  float sheet = smoothstep(.40,.75, fbm(q*.6 + w*1.2 + vec3(0.,t*.05,0.)));
  vec3 col = mix(vec3(.22,.55,.78), vec3(.52,.32,.85), smoothstep(.3,.7,w.x));
  float fwd = 0.35 + 1.4*pow(max(dot(R,S),0.),3.);
  return col * (ridge*0.12 + sheet*ridge*1.5 + sheet*0.02) * fwd * 0.55;
}

vec3 fire(vec3 R, float t){
  float flick = 0.85 + 0.15*vn(vec3(t*6.,0.,0.));
  vec3 q = vec3(R.x*3.2, R.y*1.3 - t*0.8, R.z*3.2);
  vec3 w = vec3(fbm(q*.8+vec3(t*.3,0,0)), fbm(q*.8+vec3(3.,t*.2,1.)), 0.);
  float n = fbm(q + vec3(w.xy*1.5, 0.));
  float base = smoothstep(.55,-.7,R.y);              // tongues root low, thin out as they rise
  float tg = smoothstep(.42 + .35*(1.-base), .92, n) * flick;
  vec3 ember = vec3(.45,.05,.0), orange = vec3(1.,.38,.04), yellow = vec3(1.,.82,.45);
  vec3 c = mix(ember, orange, smoothstep(.0,.5,tg)); c = mix(c, yellow, smoothstep(.5,1.,tg));
  return c * tg * (0.25 + 0.9*base) * 0.9;
}

vec3 earth2(vec3 R, float t){
  vec3 q = R*3. + vec3(0., t*0.05, 0.);
  float haze = smoothstep(.35,.85, fbm(q + fbm(q*1.5)*.8));
  vec3 g = (R + vec3(0., t*0.02, 0.)) * 70.;
  vec3 gi = floor(g); float hh = h(gi);
  float isGrain = step(.93, hh);
  float dg = length(fract(g)-.5);
  float grain = isGrain * smoothstep(.45,.0, dg) * (0.6+0.4*sin(t*1.3+hh*40.));
  float opp = 0.25 + 1.6*pow(max(dot(R,-S),0.),4.);
  float h2 = h(gi+17.), h3 = h(gi+41.), h4 = h(gi+73.);
  vec3 m = normalize(vec3(sin(t*(0.7+h2)+h3*40.), sin(t*(0.5+h3)+h4*40.), sin(t*(0.6+h4)+h2*40.)));
  vec3 hv = normalize(S - R);
  float spec = pow(max(dot(m, hv), 0.), 250.);
  float sunward = smoothstep(-.3, .5, dot(R, S));
  vec3 gp = (R + vec3(0., t*0.02, 0.));
  float dc = length(gp*70. - normalize(gi+.5)*length(gp)*70.);
  float core = smoothstep(.55, .0, dc);
  vec3 ping = vec3(1., .93, .78) * spec * core * sunward * isGrain * 10.;
  vec3 col = vec3(.78,.47,.20);
  return col * (haze*0.10 + grain*0.9) * opp + ping;
}

vec3 air(vec3 R, float t){
  float az = atan(R.z, R.x);
  float s = clamp(R.y*5., -1., 1.); s = s*(1.5-0.5*s*s);
  float ph = az + t*0.9*s;
  vec3 q = vec3(cos(ph)*1.2, sin(ph)*1.2, R.y*8.);
  float n = fbm(q + vec3(0.,0.,fbm(q*.5)*2.));
  float lines = pow(1.-abs(n*2.-1.), 18.);
  float gust = smoothstep(.45,.8, fbm(vec3(cos(ph+.6*s)*.9, sin(ph+.6*s)*.9, R.y*2.) + 4.));
  float band = smoothstep(.95,.2,abs(R.y));
  float mu = dot(R,S);
  vec3 col = vec3(.55,.76,.98);
  return col * lines * gust * band * (0.5+0.5*(1.+mu*mu)) * 0.6;
}
```
