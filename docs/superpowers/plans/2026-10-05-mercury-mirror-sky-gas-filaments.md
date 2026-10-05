# Mercury mirror sky + gas filaments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the liquid mirror's 16 static aether lobes with a moving procedural sky for each element. Give
the element gas velocity-aligned filaments. Tie both to one shared clock, so the reflection moves at the gas's pace.

**Architecture:**
- **Shared clock.** A pure `aetherClock` module integrates one calm-gated time and four element phases. The four
  flow shaders and the planet's mirror read the same phases.
- **Mirror sky.** `aetherSky.js` holds the approved per-element sky GLSL. It is spliced into the shared mirror chunk
  (`HG_ENV_GLSL`), so the planet, droplets, beads and visitors all reflect it.
- **Gas filaments.** `gasStreak.js` holds the capsule sprite and lane-mask GLSL that each flow interpolates.

**Tech Stack:** React 18 + @react-three/fiber, three.js `ShaderMaterial` (WebGL2 / GLSL ES 3.0 through three's
chunk translation), vitest (source-string tests with the `?raw` idiom), CDP live probes
(`.superpowers/sdd/tools/`, dev server on :5175).

**Spec:** `docs/superpowers/specs/2026-10-05-mercury-mirror-sky-gas-filaments-design.md` (read it first; §3 was
amended for Option A after Task 7, so the gas tasks are 7b, 8 and 9).

## Global Constraints

**Branch and git**
- Branch `feature/mercury-stage`. **LOCAL ONLY: never push.** Never stage `.import-cache.json`, `baseline/` or
  `.superpowers/`; stage files by name.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Shaders**
- Every task that changes a shader ends with a live GPU compile via CDP, done by the **controller**: the
  implementer cannot run a browser. A float/vec3 mismatch has shipped past read-review before.
- Shaders are string-tested in vitest. Extend tests in the same style (`flowLight.test.js`, the `?raw` idiom).
- `glf()` from `src/terminal/gl/glf.js` writes every JS constant into GLSL. No hand-typed duplicate numbers.

**Runtime rules**
- No per-frame allocation in sims, hooks or `useFrame`.
- Calm (reduced motion) freezes gas motion, the mirror sky, the earth pings and streaks.
- Rates integrate (`phase += rate·dt`). Never write `rate(x_now)·t`.
- Banded or mechanical patterns are a hard fail. Every mask or pattern is noise-driven and time-varying.

**Gates**
- Lint: `npm run lint` with 0 errors and warnings ≤ the script cap (currently 137 / cap 143). Don't sweep
  `exhaustive-deps`.
- Mercury suite: `npx vitest run src/terminal/mercury` must pass (706 pass at ac8fa425).
- Full suite: only the known `artComposite compositeDpr` failure.

**Scratch files**
- Rename `scripts/task-brief` outputs to the `ms-` prefix (this feature) right away.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/terminal/mercury/planet/aetherClock.js` | new | shared clock, rate constants, sky weights (pure) |
| `src/terminal/mercury/planet/aetherSky.js` | new | the four element skies + LOD combiner (GLSL string + constants) |
| `src/terminal/mercury/planet/gasStreak.js` | new | two-role gas chunk (fog passthrough + filament capsules), lane mask, `gasRoles`/`gasFogCount` (Task 7b) |
| `src/terminal/mercury/planet/prng.js` | new | `mulberry32`, moved out of the deleted `aetherLobes.js` |
| `src/terminal/mercury/planet/aetherLobes.js` | **deleted** | (16 lobes) |
| `src/terminal/mercury/planet/hgMirrorGlsl.js` | modify | uniforms/decls; `aetherMirror` reads `aetherSky` |
| `src/terminal/mercury/planet/mercuryPlanetShader.js` | modify | planet decls follow `hgMirrorGlsl` |
| `src/terminal/mercury/planet/planetLook.js` | modify | drop lobe knobs; add gas tune knobs |
| `src/terminal/mercury/planet/planetQuality.js` | modify | `gasDensity` per tier |
| `src/terminal/mercury/planet/hgBeads.js` | modify | import `mulberry32` from `prng.js` |
| `src/terminal/mercury/MercuryPlanet.jsx` | modify | sky uniforms from the clock + weights; lobe code removed |
| `src/terminal/mercury/MercuryCanvas.jsx` | modify | owns the clock; passes it on; tier density + base-tied fog count (Task 7b) |
| `src/terminal/fluid/ParticleFlow.jsx` | modify | clocked phase; `knotPos` core; fog + filament roles (`aRole`) |
| `src/terminal/air/AtmosphericFlow.jsx` | modify | clocked phase; `orbitPos` core; fog + filament roles (`aRole`) |
| `src/terminal/thermal/ThermalFlow.jsx` | modify | clocked phase; `flamePos` core; flame-body fog + round embers (`aEmber` = role), no lane |
| `src/terminal/earth/SedimentFlow.jsx` | modify | clocked phase; `sedimentPos` core; dust fog + settling streaks (`aRole`) |

---

### Task 1: The shared clock (pure) and the tier density column

**Files:**
- Create: `src/terminal/mercury/planet/aetherClock.js`
- Create: `src/terminal/mercury/planet/__tests__/aetherClock.test.js`
- Modify: `src/terminal/mercury/planet/planetQuality.js` (TIERS rows)
- Modify: `src/terminal/mercury/planet/__tests__/planetQuality.test.js` (next to the `beadRate` assertions, ~line 81)

**Interfaces:**
- Produces:
  - `CLOCK_PHASES = ['fluid','thermal','earth','air']`;
  - `createAetherClock()` → `{ t, phase:{…}, rate:{…}, rateIn:{…}, calm, stamp }`;
  - `configureAetherClock(clock, { speed, orbitalSpeed, calm })` → `clock`;
  - `tickAetherClock(clock, stamp, delta)` → `clock`;
  - `skyWeights(activePhase, pendingPhase, opacities, out=[0,0,0,0])` → `out`;
  - constants `FLUID_LANE_MEAN`, `AIR_ORBIT_MEAN`, `AIR_LOWER_DIR`, `FIRE_LIFE_MEAN`, `FIRE_RISE_MEAN`,
    `EARTH_MASS_MEAN`, `EARTH_SINK_RATE_K`, `EARTH_FALL`, `AETHER_SKY_R`, `FLUID_SKY_RAD`, `AIR_SKY_RAD`,
    `FIRE_SKY_RISE`, `EARTH_SKY_SINK`, `GHOST_OPACITY`;
  - `TIERS[tier].gasDensity`.

- [ ] **Step 1: Write the failing tests**

`src/terminal/mercury/planet/__tests__/aetherClock.test.js`:
```js
// The shared aether clock (mirror-sky spec §1): one integrated time base for the gas and the mirror.
import { describe, it, expect } from 'vitest';
import {
  CLOCK_PHASES, createAetherClock, configureAetherClock, tickAetherClock, skyWeights, GHOST_OPACITY,
  FLUID_LANE_MEAN, AIR_ORBIT_MEAN, AIR_LOWER_DIR, FIRE_LIFE_MEAN, FIRE_RISE_MEAN, EARTH_MASS_MEAN,
  EARTH_SINK_RATE_K, EARTH_FALL, AETHER_SKY_R, FLUID_SKY_RAD, AIR_SKY_RAD, FIRE_SKY_RISE, EARTH_SKY_SINK,
} from '../aetherClock';
import transitionSrc from '../../usePhaseTransition.js?raw';

describe('aetherClock', () => {
  it('integrates t and each phase from its own rate', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    for (let i = 1; i <= 60; i++) tickAetherClock(c, i / 60, 1 / 60);
    expect(c.t).toBeCloseTo(1, 10);
    expect(c.phase.fluid).toBeCloseTo(0.1, 10);
    expect(c.phase.thermal).toBeCloseTo(0.1, 10);
    expect(c.phase.earth).toBeCloseTo(0.1, 10);
    expect(c.phase.air).toBeCloseTo(1.2, 10);
    expect(c.rate.air).toBe(1.2);
  });

  it('a slider change moves the rate, never the phase (no rate(x_now)·t jump)', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    for (let i = 1; i <= 60; i++) tickAetherClock(c, i / 60, 1 / 60);
    const before = c.phase.fluid;
    configureAetherClock(c, { speed: 0.5, orbitalSpeed: 1.2, calm: false });
    expect(c.phase.fluid).toBe(before);
    tickAetherClock(c, 61 / 60, 1 / 60);
    expect(c.phase.fluid - before).toBeCloseTo(0.5 / 60, 12);
  });

  it('calm freezes t and every phase, and reports zero applied rates', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    tickAetherClock(c, 1, 0.5);
    const snap = { t: c.t, ...c.phase };
    configureAetherClock(c, { speed: 0.1, orbitalSpeed: 1.2, calm: true });
    for (let i = 2; i < 30; i++) tickAetherClock(c, i, 0.5);
    expect({ t: c.t, ...c.phase }).toEqual(snap);
    for (const p of CLOCK_PHASES) expect(c.rate[p]).toBe(0);
  });

  it('ticks once per frame stamp: every consumer may call it, the first one advances', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    for (let k = 0; k < 5; k++) tickAetherClock(c, 7.25, 1 / 60);
    expect(c.t).toBeCloseTo(1 / 60, 12);
  });

  it('allocates nothing per tick (same objects)', () => {
    const c = configureAetherClock(createAetherClock(), { speed: 0.1, orbitalSpeed: 1.2, calm: false });
    const { phase, rate, rateIn } = c;
    tickAetherClock(c, 1, 0.1); configureAetherClock(c, { speed: 0.2, orbitalSpeed: 1, calm: false }); tickAetherClock(c, 2, 0.1);
    expect(c.phase).toBe(phase); expect(c.rate).toBe(rate); expect(c.rateIn).toBe(rateIn);
  });

  it('rate means come from the flows\' attribute formulas (all U[0,1) attributes)', () => {
    expect(FLUID_LANE_MEAN).toBeCloseTo(0.6 + 0.4 * 0.5, 12);
    expect(AIR_ORBIT_MEAN).toBeCloseTo(0.4 + 0.7 * 0.5, 12);
    expect(AIR_LOWER_DIR).toBe(-0.85);
    expect(FIRE_LIFE_MEAN).toBeCloseTo(0.4 + 0.6 * 0.5, 12);
    expect(FIRE_RISE_MEAN).toBeCloseTo((2.4 + 3.5) / 2, 12);
    expect(EARTH_MASS_MEAN).toBeCloseTo(0.2 * 0.15 + 0.8 * 0.7, 12);
    expect(EARTH_SINK_RATE_K).toBeCloseTo(2.2 * 0.4, 12);
    expect(EARTH_FALL).toBe(2.4);
    expect(AETHER_SKY_R).toBe(1.4);
    expect(FLUID_SKY_RAD).toBeCloseTo(2 * 2 * Math.PI * FLUID_LANE_MEAN, 12);
    expect(AIR_SKY_RAD).toBe(AIR_ORBIT_MEAN);
    expect(FIRE_SKY_RISE).toBeCloseTo(FIRE_LIFE_MEAN * FIRE_RISE_MEAN / AETHER_SKY_R, 12);
    expect(EARTH_SKY_SINK).toBeCloseTo(EARTH_FALL * EARTH_SINK_RATE_K * EARTH_MASS_MEAN / AETHER_SKY_R, 12);
  });
});

describe('skyWeights — the mirror shows the active element, cross-fading on a switch', () => {
  const idle = (a) => Object.fromEntries(CLOCK_PHASES.map((p) => [p, p === a ? 1 : 0.12]));
  it('the ghost opacity matches usePhaseTransition', () => {
    expect(transitionSrc).toContain('p === active ? 1.0 : 0.12');
    expect(GHOST_OPACITY).toBe(0.12);
  });
  it('idle: the active element alone, ghosts never', () => {
    expect(skyWeights('earth', null, idle('earth'))).toEqual([0, 0, 1, 0]);
  });
  it('consolidating: the active fades as its cloud ducks; emerging: the pending rises, the old stays out', () => {
    const w = skyWeights('fluid', 'air', { fluid: 0.56, thermal: 0.03, earth: 0.03, air: 0.03 });
    expect(w[0]).toBeCloseTo(0.5, 12); expect(w[3]).toBe(0); expect(w[1]).toBe(0);
    const e = skyWeights('fluid', 'air', { fluid: 0.08, thermal: 0.08, earth: 0.08, air: 0.56 });
    expect(e).toEqual([0, 0, 0, expect.closeTo(0.5, 12)]);
  });
  it('never more than two non-zero weights, never a sum above 1', () => {
    const w = skyWeights('fluid', 'air', { fluid: 1, thermal: 1, earth: 1, air: 1 });
    expect(w.filter((x) => x > 0).length).toBeLessThanOrEqual(2);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it('no opacities given: the active element at full weight', () => {
    expect(skyWeights('thermal', null, null)).toEqual([0, 1, 0, 0]);
  });
  it('writes into the given array (no allocation)', () => {
    const out = [9, 9, 9, 9];
    expect(skyWeights('air', null, idle('air'), out)).toBe(out);
  });
});
```

Append to `src/terminal/mercury/planet/__tests__/planetQuality.test.js`, inside the `describe` that holds the
`beadRate` assertions (~line 81). Add a new `it`:
```js
  it('gas density multiplier per tier (mirror-sky spec §3d): full 3, phone ≥ 2, lite 1', () => {
    expect(TIERS.full.gasDensity).toBe(3);
    expect(TIERS.phone.gasDensity).toBeGreaterThanOrEqual(2);
    expect(TIERS.phone.gasDensity).toBeLessThanOrEqual(3);
    expect(TIERS.lite.gasDensity).toBe(1);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherClock.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: FAIL (`Failed to resolve import "../aetherClock"`; `gasDensity` undefined).

- [ ] **Step 3: Implement**

`src/terminal/mercury/planet/aetherClock.js`:
```js
// src/terminal/mercury/planet/aetherClock.js — one time base for the aether (mirror-sky spec §1).
//
// The four element flows and the liquid's mirror sky read the same calm-gated time t and the same four
// integrated phases, so the reflection moves at its gas's pace. Every phase integrates its own rate
// (phase += rate·dt): moving a slider changes the rate, never the phase. One instance per canvas
// (MercuryCanvas); every consumer ticks it at the top of its useFrame and the first tick per frame advances.
// Pure: no React, no THREE, no allocation per tick.

export const CLOCK_PHASES = Object.freeze(['fluid', 'thermal', 'earth', 'air']);

// Means of each flow's per-particle rate terms. Every attribute involved is Math.random() in its buildBuffers,
// i.e. U[0, 1). aetherClock.test pins the derivations; flowClock.test pins the flow literals they come from.
export const FLUID_LANE_MEAN = 0.8;    // ParticleFlow: (0.6 + aOffset * 0.4)
export const AIR_ORBIT_MEAN = 0.75;    // AtmosphericFlow: (0.4 + aSpeed * 0.7), upper layer (ionosphere excluded)
export const AIR_LOWER_DIR = -0.85;    // AtmosphericFlow: aAlt > 0.5 ? 1.0 : -0.85
export const FIRE_LIFE_MEAN = 0.7;     // ThermalFlow: lifeMult = 0.4 + aSpeed * 0.6
export const FIRE_RISE_MEAN = 2.95;    // ThermalFlow: riseSpeed = mix(2.4, 3.5, aTemp)
export const EARTH_MASS_MEAN = 0.59;   // SedimentFlow: aMass = 20 % U[0, 0.3) + 80 % U[0.4, 1.0)
export const EARTH_SINK_RATE_K = 0.88; // SedimentFlow: sinkOffset = fract(aPhase + phase · aMass * 2.2 * 0.4)
export const EARTH_FALL = 2.4;         // SedimentFlow: settledY = spawnY - sinkOffset * 2.4

// What the mirror sky moves by, per unit of its element's phase. The flows ring the planet at about the old
// lobe radius, so a fall of d scene units sweeps d / AETHER_SKY_R in direction space.
export const AETHER_SKY_R = 1.4;
export const FLUID_SKY_RAD = 2 * 2 * Math.PI * FLUID_LANE_MEAN;   // knot-centre angle: 2φ, φ = 2π · knot phase
export const AIR_SKY_RAD = AIR_ORBIT_MEAN;                         // cyclone angle (upper layer)
export const FIRE_SKY_RISE = (FIRE_LIFE_MEAN * FIRE_RISE_MEAN) / AETHER_SKY_R;
export const EARTH_SKY_SINK = (EARTH_FALL * EARTH_SINK_RATE_K * EARTH_MASS_MEAN) / AETHER_SKY_R;

export function createAetherClock() {
  return {
    t: 0,
    phase: { fluid: 0, thermal: 0, earth: 0, air: 0 },
    rate: { fluid: 0, thermal: 0, earth: 0, air: 0 },   // applied this frame (0 under calm): streak lengths read it
    rateIn: { fluid: 0, thermal: 0, earth: 0, air: 0 }, // configured (the sliders)
    calm: false,
    stamp: NaN,
  };
}

// Render time: the sliders and calm. Mutates in place.
export function configureAetherClock(clock, { speed, orbitalSpeed, calm }) {
  clock.rateIn.fluid = speed;
  clock.rateIn.thermal = speed;
  clock.rateIn.earth = speed;
  clock.rateIn.air = orbitalSpeed;
  clock.calm = !!calm;
  return clock;
}

// Frame time: stamp = r3f's state.clock.elapsedTime, identical for every useFrame callback of one frame.
export function tickAetherClock(clock, stamp, delta) {
  if (stamp === clock.stamp) return clock;
  clock.stamp = stamp;
  const k = clock.calm ? 0 : 1;
  for (let i = 0; i < CLOCK_PHASES.length; i++) {
    const p = CLOCK_PHASES[i];
    clock.rate[p] = k * clock.rateIn[p];
    clock.phase[p] += delta * clock.rate[p];
  }
  clock.t += k * delta;
  return clock;
}

// usePhaseTransition's idle ghost opacity (idleOpacities). Ghost elements are never reflected.
export const GHOST_OPACITY = 0.12;

// Mirror weights in CLOCK_PHASES order: the active and the pending element only, each by how far its cloud
// stands above ghost level. Idle → the active at 1; a switch → the old fades as its cloud ducks, the new rises
// as its cloud floods back. No opacities → the active at 1.
export function skyWeights(activePhase, pendingPhase, opacities, out = [0, 0, 0, 0]) {
  let sum = 0;
  for (let i = 0; i < CLOCK_PHASES.length; i++) {
    const p = CLOCK_PHASES[i];
    let w = 0;
    if (p === activePhase || p === pendingPhase) {
      if (!opacities) w = p === activePhase ? 1 : 0;
      else w = Math.min(Math.max(((opacities[p] ?? 0) - GHOST_OPACITY) / (1 - GHOST_OPACITY), 0), 1);
    }
    out[i] = w;
    sum += w;
  }
  if (sum > 1) for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}
```

In `src/terminal/mercury/planet/planetQuality.js`, add `gasDensity` to each TIERS row, right after `beadRate`:
- `full`: `beadRate: 1, gasDensity: 3,`
- `phone`: `beadRate: 0.55, gasDensity: 3,`
- `lite`: `beadRate: 0.3, gasDensity: 1,`

Add this line to the header comment:
`// gasDensity: active element-flow particle multiplier (mirror-sky spec §3d); phone set by the frame-time gate (≥ 2).`

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherClock.test.js src/terminal/mercury/planet/__tests__/planetQuality.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/aetherClock.js src/terminal/mercury/planet/__tests__/aetherClock.test.js src/terminal/mercury/planet/planetQuality.js src/terminal/mercury/planet/__tests__/planetQuality.test.js
git commit -m "feat(mercury): shared aether clock — integrated, calm-gated phases + mirror sky weights; gasDensity tier column

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The four flows run on the shared clock

**Files:**
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx`,
  `src/terminal/thermal/ThermalFlow.jsx`, `src/terminal/earth/SedimentFlow.jsx`
- Modify: `src/terminal/mercury/MercuryCanvas.jsx`
- Create: `src/terminal/mercury/planet/__tests__/flowClock.test.js`

**Interfaces:**
- Consumes (Task 1): `createAetherClock`, `configureAetherClock`, `tickAetherClock`.
- Produces:
  - each flow accepts an optional `aetherClock` prop (a clock object);
  - each flow VS declares `uniform float uPhase;`;
  - `uTime` now always equals `clock.t`;
  - `MercuryCanvas` owns `aetherClock` (passed to `MercuryPlanet` in Task 4).

The visible change is small:
- calm now freezes the gas;
- the four flows start at phase 0 instead of a random offset;
- moving the speed slider no longer jumps the particles.

- [ ] **Step 1: Write the failing test**

`src/terminal/mercury/planet/__tests__/flowClock.test.js`:
```js
// The flows run on the shared aether clock (mirror-sky spec §1). Read from the sources (the flowLight.test idiom).
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';
import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';
import canvasSrc from '../../MercuryCanvas.jsx?raw';

const FLOWS = { fluid: particleSrc, thermal: thermalSrc, earth: sedimentSrc, air: atmoSrc };

describe('flows on the shared clock', () => {
  for (const [el, src] of Object.entries(FLOWS)) {
    it(`${el}: ticks the clock, reads t and its own phase, no private time`, () => {
      expect(src).toContain("from '../mercury/planet/aetherClock'");
      expect(src).toContain('tickAetherClock(clk, state.clock.elapsedTime, delta);');
      expect(src).toContain('mat.uniforms.uTime.value = clk.t;');
      expect(src).toContain(`mat.uniforms.uPhase.value = clk.phase.${el};`);
      expect(src).toContain('uniform float uPhase;');
      expect(src).toContain('uTime: { value: 0 },');
      expect(src).not.toMatch(/uTime\.value\s*\+=/);
      expect(src).not.toMatch(/uTime \* uSpeed|uTime \* orbitSpeed|uTime \* sinkRate/);
      expect(src).not.toMatch(/uTime:\s*\{\s*value:\s*Math\.random/);
      expect(src).toMatch(/const clk = aetherClock \?\? configureAetherClock\(ownClock, \{/);
    });
  }

  it('the rate literals the clock means are derived from are still in the flows', () => {
    expect(particleSrc).toContain('fract(aPhase + uPhase * (0.6 + aOffset * 0.4))');
    expect(atmoSrc).toContain('(0.4 + aSpeed * 0.7) * direction * ionSpeedMult');
    expect(atmoSrc).toContain('aAlt > 0.5 ? 1.0 : -0.85');
    expect(thermalSrc).toContain('float lifeMult = 0.4 + aSpeed * 0.6;');
    expect(thermalSrc).toContain('mix(2.4, 3.5, aTemp)');
    expect(thermalSrc).toContain('fract(aPhase + uPhase * lifeMult)');
    expect(sedimentSrc).toContain('float sinkRate   = aMass * 2.2;');
    expect(sedimentSrc).toContain('fract(aPhase + uPhase * sinkRate * 0.4)');
    expect(sedimentSrc).toContain('sinkOffset * 2.4');
    expect(sedimentSrc).toContain('masses[i]  = Math.random() < 0.2 ? Math.random() * 0.3 : 0.4 + Math.random() * 0.6;');
  });

  it('MercuryCanvas owns one clock, configures it in render, hands it to every flow', () => {
    expect(canvasSrc).toContain('const [aetherClock] = useState(createAetherClock);');
    expect(canvasSrc).toContain('configureAetherClock(aetherClock, { speed: params.speed ?? 0.1, orbitalSpeed: params.orbitalSpeed ?? 1.2, calm });');
    expect(canvasSrc.match(/aetherClock=\{aetherClock\}/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/flowClock.test.js`
Expected: FAIL (no `aetherClock` import in the flows).

- [ ] **Step 3: Implement — the same pattern in every flow**

In **each** of the four flow files:

1. Add the import next to the other `../mercury/planet/...` imports:
   ```js
   import { createAetherClock, configureAetherClock, tickAetherClock } from '../mercury/planet/aetherClock';
   ```
2. Add `aetherClock = null,` as the last destructured prop of the default export.
3. Directly after the `const [uniforms] = useState(...)` block, add:
   ```js
   // The shared aether clock (MercuryCanvas); standalone use runs its own from the props.
   const [ownClock] = useState(createAetherClock);
   const clk = aetherClock ?? configureAetherClock(ownClock, { speed: SPEED_PROP, orbitalSpeed: ORBITAL_PROP, calm: false });
   ```
   Substitute the flow's own props:
   - ParticleFlow / ThermalFlow / SedimentFlow: `speed: speed, orbitalSpeed: 0`.
   - AtmosphericFlow: `speed: 0, orbitalSpeed: orbitalSpeed`.

   Write it on one line as shown. The test regex expects `const clk = aetherClock ?? configureAetherClock(ownClock, {`.
4. In the uniforms object:
   - replace the `uTime` entry with `uTime: { value: 0 },`;
   - add `uPhase: { value: 0 },`;
   - remove `uSpeed` (fluid, thermal, earth) or `uOrbitalSpeed` (air).
5. In `useFrame((state, delta) => { const mat = …; if (mat) {`:
   - replace `mat.uniforms.uTime.value += delta;` (and the `uSpeed`/`uOrbitalSpeed` assignment line) with:
     ```js
     tickAetherClock(clk, state.clock.elapsedTime, delta);
     mat.uniforms.uTime.value = clk.t;
     mat.uniforms.uPhase.value = clk.phase.ELEMENT;
     ```
     where `ELEMENT` is `fluid` / `thermal` / `earth` / `air`;
   - put `tickAetherClock` **before** the `if (mat)` so the clock ticks even before the material exists:
     ```js
     useFrame((state, delta) => {
       tickAetherClock(clk, state.clock.elapsedTime, delta);
       const mat = materialRef.current;
       if (mat) {
         mat.uniforms.uTime.value = clk.t;
         mat.uniforms.uPhase.value = clk.phase.ELEMENT;
         …the rest unchanged…
     ```
6. In the vertex shader:
   - replace the `uniform float uSpeed;` (or `uniform float uOrbitalSpeed;`) declaration with `uniform float uPhase;`;
   - change the motion lines.

**ParticleFlow.jsx, the VS motion line:**
```glsl
    float t = fract(aPhase + uPhase * (0.6 + aOffset * 0.4));
```

**AtmosphericFlow.jsx, the VS orbit lines.** Replace:
```glsl
    float orbitSpeed = uOrbitalSpeed * (0.4 + aSpeed * 0.7) * direction * ionSpeedMult;
    float angle      = aPhase * 6.28318 + uTime * orbitSpeed;
```
with:
```glsl
    float orbitRate  = (0.4 + aSpeed * 0.7) * direction * ionSpeedMult; // × orbitalSpeed lives in uPhase (the clock)
    float angle      = aPhase * 6.28318 + uPhase * orbitRate;
```

**ThermalFlow.jsx:**
```glsl
    float age = fract(aPhase + uPhase * lifeMult);
```

**SedimentFlow.jsx.** Replace the age line and the sink pair:
```glsl
    float age = fract(aPhase + uPhase * lifeMult);
```
```glsl
    float sinkRate   = aMass * 2.2;
    float sinkOffset = fract(aPhase + uPhase * sinkRate * 0.4);
```

`speed` / `orbitalSpeed` props stay in the signatures: the standalone fallback uses them. Remove any useFrame line
that wrote `uSpeed`/`uOrbitalSpeed`.

**MercuryCanvas.jsx:**
- Import line: `import { Suspense, useCallback, useLayoutEffect, useRef, useState } from 'react';`.
- Add `import { createAetherClock, configureAetherClock } from './planet/aetherClock';`.
- After `const calm = useCalm();`:
  ```js
  // One time base for the gas and the mirror sky (mirror-sky spec §1). Configured every render, ticked per frame.
  const [aetherClock] = useState(createAetherClock);
  configureAetherClock(aetherClock, { speed: params.speed ?? 0.1, orbitalSpeed: params.orbitalSpeed ?? 1.2, calm });
  ```
- Add `aetherClock={aetherClock}` to each of the four flow elements.

- [ ] **Step 4: Run the tests and the mercury suite**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/flowClock.test.js` → PASS.
Run: `npx vitest run src/terminal/mercury` → all pass. `flowLight.test.js` must still pass unchanged.

- [ ] **Step 5: Lint**

Run: `npm run lint`. Expected: 0 errors, warnings ≤ cap.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/fluid/ParticleFlow.jsx src/terminal/air/AtmosphericFlow.jsx src/terminal/thermal/ThermalFlow.jsx src/terminal/earth/SedimentFlow.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/planet/__tests__/flowClock.test.js
git commit -m "feat(mercury): element flows on the shared aether clock — integrated phases (slider no longer jumps), calm freezes the gas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7 (controller): live GPU compile.** Run a CDP probe: `openMercury`, switch through the four phases,
  `errors()` → `[]`. Look at one screenshot per element to confirm the gas still moves. Then reload with `?calm=1`:
  two frames 1 s apart are pixel-identical in the gas region.

---

### Task 3: The procedural sky chunk (`aetherSky.js`)

**Files:**
- Create: `src/terminal/mercury/planet/aetherSky.js`
- Create: `src/terminal/mercury/planet/__tests__/aetherSky.test.js`

**Interfaces:**
- Consumes (Task 1): `FLUID_SKY_RAD`, `AIR_SKY_RAD`, `AIR_LOWER_DIR`, `FIRE_SKY_RISE`, `EARTH_SKY_SINK`.
- Produces:
  - `AETHER_SKY_GLSL`: string defining `vec3 aetherSky(vec3 R, float rough)`. It reads the uniforms `uSkyT`
    (float), `uSkyPhase` (vec4: fluid, thermal, earth, air), `uSkyW` (vec4, same order) and `uSunDir` (vec3), which
    are declared elsewhere (Task 4).
  - Constants `SKY_OCTAVES`, `SKY_ROUGH_SHARP`, `SKY_ROUGH_FLAT`, `SKY_W_MIN`, `SKY_PING_EXP`, `SKY_PING_GAIN`.
  - `SKY_MEAN` = `{ fluid, thermal, earth, air }` (linear rgb arrays). Provisional values until Task 5 measures them.

Every helper is prefixed `sky`. The planet, droplet, bead and visitor shaders all include this chunk and already
define their own `hash13`/`snoise`-style helpers, so the prefix prevents name collisions.

- [ ] **Step 1: Write the failing test**

`src/terminal/mercury/planet/__tests__/aetherSky.test.js`:
```js
// The moving per-element mirror sky (mirror-sky spec §2): approved looks, bound to the shared clock.
import { describe, it, expect } from 'vitest';
import { glf, v3 } from '../../../gl/glf';
import {
  AETHER_SKY_GLSL, SKY_OCTAVES, SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN, SKY_MEAN,
} from '../aetherSky';
import { FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK } from '../aetherClock';
import { ROUGH_LIQUID, ROUGH_SOLID } from '../planetLook';

describe('aetherSky', () => {
  it('interpolates every constant from its owner', () => {
    for (const [n, v] of Object.entries({ FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK,
      SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, SKY_W_MIN, SKY_PING_EXP, SKY_PING_GAIN })) {
      expect(AETHER_SKY_GLSL).toContain(`const float ${n} = ${glf(v)};`);
    }
    expect(AETHER_SKY_GLSL).toContain(`const int SKY_OCTAVES = ${SKY_OCTAVES};`);
    for (const [el, rgb] of Object.entries(SKY_MEAN)) {
      expect(AETHER_SKY_GLSL).toContain(`const vec3 SKY_MEAN_${el.toUpperCase()} = ${v3(rgb)};`);
    }
  });

  it('the liquid and the glaze keep full detail; the polycrystalline crust is near-flat', () => {
    expect(ROUGH_LIQUID).toBeLessThanOrEqual(SKY_ROUGH_SHARP);
    expect(ROUGH_SOLID).toBeGreaterThan(SKY_ROUGH_SHARP + 0.8 * (SKY_ROUGH_FLAT - SKY_ROUGH_SHARP));
    expect(SKY_ROUGH_FLAT).toBeLessThan(1); // the frost/evaporite ambient lookups (rough 1) cost a constant
  });

  it('each element sky moves WITH its gas (sampled at minus the advected offset)', () => {
    expect(AETHER_SKY_GLSL).toContain('skyRotZ(R, -FLUID_SKY_RAD * uSkyPhase.x)');
    expect(AETHER_SKY_GLSL).toContain('(R.y - FIRE_SKY_RISE * uSkyPhase.y)');
    expect(AETHER_SKY_GLSL).toContain('R + vec3(0.0, EARTH_SKY_SINK * uSkyPhase.z, 0.0)');
    expect(AETHER_SKY_GLSL).toContain('az - AIR_SKY_RAD * uSkyPhase.w * dirS');
  });

  it('the knot centre turns +2·2π per knot phase about +Z, so the water sky rotates by minus it', () => {
    // ParticleFlow.knotCenter, verbatim in JS
    const knot = (t) => { const phi = t * 2 * Math.PI, R = 1, r = 0.4; return [(R + r * Math.cos(3 * phi)) * Math.cos(2 * phi), (R + r * Math.cos(3 * phi)) * Math.sin(2 * phi)]; };
    const ang = (t) => Math.atan2(knot(t)[1], knot(t)[0]);
    const d = ang(0.01) - ang(0);
    expect(d).toBeGreaterThan(0);
    expect(d / 0.01).toBeCloseTo(4 * Math.PI, 1);
  });

  it('the air contra-rotation: upper layer +1, lower layer AIR_LOWER_DIR', () => {
    expect(AETHER_SKY_GLSL).toContain('float dirS = s >= 0.0 ? s : s * -AIR_LOWER_DIR;');
  });

  it('only the weighted elements are evaluated; at or above SKY_ROUGH_FLAT the sky is its mean (no noise)', () => {
    for (const [i, f] of [['x', 'skyFluid'], ['y', 'skyThermal'], ['z', 'skyEarth'], ['w', 'skyAir']]) {
      expect(AETHER_SKY_GLSL).toContain(`if (uSkyW.${i} > SKY_W_MIN) s += uSkyW.${i} * ${f}(`);
    }
    expect(AETHER_SKY_GLSL).toContain('if (k >= 1.0) return mean;');
    expect(AETHER_SKY_GLSL).toContain('vec3 aetherSky(vec3 R, float rough) {');
  });

  it('octaves past the budget contribute their mean (brightness holds as rough rises)', () => {
    expect(AETHER_SKY_GLSL).toContain('s += a * (w > 0.0 ? mix(0.5, skyNoise(p), w) : 0.5);');
  });

  it('earth pings: rare, sharp, sunward, off on a rough mirror', () => {
    expect(AETHER_SKY_GLSL).toContain('pow(max(dot(m, hv), 0.0), SKY_PING_EXP)');
    expect(AETHER_SKY_GLSL).toContain('smoothstep(-0.3, 0.5, dot(R, uSunDir))');
    expect(AETHER_SKY_GLSL).toContain('* (1.0 - smoothstep(0.0, 0.15, k))');
  });

  it('collision-safe names; no lobes, no wall clock', () => {
    expect(AETHER_SKY_GLSL).not.toMatch(/\bfloat h\(|\bfloat vn\(|\bfloat fbm\(|\bvec3 rotY\(/);
    expect(AETHER_SKY_GLSL).not.toMatch(/uAeth|uTime/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherSky.test.js`
Expected: FAIL (cannot resolve `../aetherSky`).

- [ ] **Step 3: Implement**

`src/terminal/mercury/planet/aetherSky.js`:
```js
// src/terminal/mercury/planet/aetherSky.js — what the liquid mirror sees around it (mirror-sky spec §2).
//
// One procedural sky per element, the author-approved looks of 2026-10-05 (companion mirror-sky-v5): water's
// curling filaments, fire's rising self-lit tongues, earth's settling grainy dust with rare sharp Sun pings,
// air's contra-rotating streamlines. A dim, cold sky: black space dominates, the element shows as fine structure.
// Each moves at its gas's pace: every advected term reads its element's phase from the shared aether clock
// (uSkyPhase, aetherClock.js) and is sampled at MINUS the advected offset, so the pattern travels WITH the gas.
// Internal motion (warp, flicker, tumble) reads the calm-gated clock time uSkyT.
// Roughness drops octaves (dropped octaves contribute their mean) and, from SKY_ROUGH_FLAT, the sky is just its
// element's mean radiance: the frost and evaporite ambient lookups (rough 1) and the polycrystalline crust cost
// ~nothing. Every helper is sky-prefixed: this chunk lands in four shaders that define their own noise.
// Needs (declared by HG_MIRROR_DECLS_GLSL): uSkyT, uSkyPhase, uSkyW, uSunDir.

import { glf, v3 } from '../../gl/glf';
import { FLUID_SKY_RAD, AIR_SKY_RAD, AIR_LOWER_DIR, FIRE_SKY_RISE, EARTH_SKY_SINK } from './aetherClock';

export const SKY_OCTAVES = 5;
export const SKY_ROUGH_SHARP = 0.15; // ≤ this: full detail (liquid 0.14, glaze 0.1, quench 0.15)
export const SKY_ROUGH_FLAT = 0.6;   // ≥ this: the element's mean radiance, no noise
export const SKY_W_MIN = 0.004;      // a weight below this is not evaluated
export const SKY_PING_EXP = 250;     // earth ping lobe sharpness (approved cadence: 1–2 concurrent pings)
export const SKY_PING_GAIN = 10;
// Mean radiance of each sky over all directions (linear). PROVISIONAL: measured live in plan Task 5.
export const SKY_MEAN = Object.freeze({
  fluid: [0.02, 0.03, 0.05],
  thermal: [0.05, 0.012, 0.001],
  earth: [0.02, 0.012, 0.005],
  air: [0.01, 0.014, 0.018],
});

export const AETHER_SKY_GLSL = /* glsl */ `// ── aether sky (aetherSky.js) ──
const int SKY_OCTAVES = ${SKY_OCTAVES};
const float FLUID_SKY_RAD = ${glf(FLUID_SKY_RAD)};
const float AIR_SKY_RAD = ${glf(AIR_SKY_RAD)};
const float AIR_LOWER_DIR = ${glf(AIR_LOWER_DIR)};
const float FIRE_SKY_RISE = ${glf(FIRE_SKY_RISE)};
const float EARTH_SKY_SINK = ${glf(EARTH_SKY_SINK)};
const float SKY_ROUGH_SHARP = ${glf(SKY_ROUGH_SHARP)};
const float SKY_ROUGH_FLAT = ${glf(SKY_ROUGH_FLAT)};
const float SKY_W_MIN = ${glf(SKY_W_MIN)};
const float SKY_PING_EXP = ${glf(SKY_PING_EXP)};
const float SKY_PING_GAIN = ${glf(SKY_PING_GAIN)};
const vec3 SKY_MEAN_FLUID = ${v3(SKY_MEAN.fluid)};
const vec3 SKY_MEAN_THERMAL = ${v3(SKY_MEAN.thermal)};
const vec3 SKY_MEAN_EARTH = ${v3(SKY_MEAN.earth)};
const vec3 SKY_MEAN_AIR = ${v3(SKY_MEAN.air)};

float skyHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float skyNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(skyHash(i), skyHash(i + vec3(1, 0, 0)), f.x), mix(skyHash(i + vec3(0, 1, 0)), skyHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(skyHash(i + vec3(0, 0, 1)), skyHash(i + vec3(1, 0, 1)), f.x), mix(skyHash(i + vec3(0, 1, 1)), skyHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// fBm on an octave budget nOct (float): octaves past it contribute their mean, so a rougher mirror keeps the
// same brightness with less detail.
float skyFbm(vec3 p, float nOct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < SKY_OCTAVES; i++) {
    float w = clamp(nOct - float(i), 0.0, 1.0);
    s += a * (w > 0.0 ? mix(0.5, skyNoise(p), w) : 0.5);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
vec3 skyRotZ(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.y, s * v.x + c * v.y, v.z); }

// Water: curling filaments and folding sheets, forward-scattering (brighter toward the Sun). The knot's axis is +Z.
vec3 skyFluid(vec3 R, float nOct) {
  float t = uSkyT;
  vec3 q = skyRotZ(R, -FLUID_SKY_RAD * uSkyPhase.x) * 2.2;
  vec3 w = vec3(skyFbm(q + vec3(0.0, 0.0, t * 0.15), nOct), skyFbm(q + vec3(5.2, 1.3, -t * 0.12), nOct), skyFbm(q + vec3(2.1, 7.7, t * 0.1), nOct));
  float n = skyFbm(q * 1.1 + 1.8 * w, nOct);
  float ridge = pow(1.0 - abs(n * 2.0 - 1.0), 9.0);
  float sheet = smoothstep(0.40, 0.75, skyFbm(q * 0.6 + w * 1.2 + vec3(0.0, t * 0.05, 0.0), nOct));
  vec3 col = mix(vec3(0.22, 0.55, 0.78), vec3(0.52, 0.32, 0.85), smoothstep(0.3, 0.7, w.x));
  float fwd = 0.35 + 1.4 * pow(max(dot(R, uSunDir), 0.0), 3.0);
  return col * (ridge * 0.12 + sheet * ridge * 1.5 + sheet * 0.02) * fwd * 0.55;
}

// Fire: self-lit tongues rooted low, rising at the flame's own pace, flickering; blackbody ramp; ignores the Sun.
vec3 skyThermal(vec3 R, float nOct) {
  float t = uSkyT;
  float flick = 0.85 + 0.15 * skyNoise(vec3(t * 6.0, 0.0, 0.0));
  vec3 q = vec3(R.x * 3.2, (R.y - FIRE_SKY_RISE * uSkyPhase.y) * 1.3, R.z * 3.2);
  vec3 w = vec3(skyFbm(q * 0.8 + vec3(t * 0.3, 0.0, 0.0), nOct), skyFbm(q * 0.8 + vec3(3.0, t * 0.2, 1.0), nOct), 0.0);
  float n = skyFbm(q + vec3(w.xy * 1.5, 0.0), nOct);
  float base = smoothstep(0.55, -0.7, R.y);
  float tg = smoothstep(0.42 + 0.35 * (1.0 - base), 0.92, n) * flick;
  vec3 ember = vec3(0.45, 0.05, 0.0), orange = vec3(1.0, 0.38, 0.04), yellow = vec3(1.0, 0.82, 0.45);
  vec3 c = mix(ember, orange, smoothstep(0.0, 0.5, tg));
  c = mix(c, yellow, smoothstep(0.5, 1.0, tg));
  return c * tg * (0.25 + 0.9 * base) * 0.9;
}

// Earth: dim ochre haze + sparse grains settling at the sediment's pace, backscattering (brightest opposite the
// Sun); each grain a tumbling facet that rarely flashes a sharp Sun ping on the sunward, haze-dark side.
// The tumble phase is t × a constant per-grain rate: integrated by construction; calm freezes t.
vec3 skyEarth(vec3 R, float nOct, float k) {
  float t = uSkyT;
  vec3 Rs = R + vec3(0.0, EARTH_SKY_SINK * uSkyPhase.z, 0.0);
  vec3 q = Rs * 3.0;
  float haze = smoothstep(0.35, 0.85, skyFbm(q + skyFbm(q * 1.5, nOct) * 0.8, nOct));
  vec3 g = Rs * 70.0;
  vec3 gi = floor(g);
  float hh = skyHash(gi);
  float isGrain = step(0.93, hh);
  float dg = length(fract(g) - 0.5);
  float grain = isGrain * smoothstep(0.45, 0.0, dg) * (0.6 + 0.4 * sin(t * 1.3 + hh * 40.0));
  float opp = 0.25 + 1.6 * pow(max(dot(R, -uSunDir), 0.0), 4.0);
  float h2 = skyHash(gi + 17.0), h3 = skyHash(gi + 41.0), h4 = skyHash(gi + 73.0);
  vec3 m = normalize(vec3(sin(t * (0.7 + h2) + h3 * 40.0), sin(t * (0.5 + h3) + h4 * 40.0), sin(t * (0.6 + h4) + h2 * 40.0)));
  vec3 hv = normalize(uSunDir - R);
  float spec = pow(max(dot(m, hv), 0.0), SKY_PING_EXP);
  float sunward = smoothstep(-0.3, 0.5, dot(R, uSunDir));
  float dc = length(g - normalize(gi + 0.5) * length(g));
  float core = smoothstep(0.55, 0.0, dc);
  vec3 ping = vec3(1.0, 0.93, 0.78) * spec * core * sunward * isGrain * SKY_PING_GAIN * (1.0 - smoothstep(0.0, 0.15, k));
  return vec3(0.78, 0.47, 0.20) * (haze * 0.10 + grain * 0.9) * opp + ping;
}

// Air: thin fast streamlines along the orbit, the upper layer one way, the lower AIR_LOWER_DIR the other;
// Rayleigh-weighted.
vec3 skyAir(vec3 R, float nOct) {
  float az = atan(R.z, R.x);
  float s = clamp(R.y * 5.0, -1.0, 1.0);
  s = s * (1.5 - 0.5 * s * s);
  float dirS = s >= 0.0 ? s : s * -AIR_LOWER_DIR;
  float ph = az - AIR_SKY_RAD * uSkyPhase.w * dirS;
  vec3 q = vec3(cos(ph) * 1.2, sin(ph) * 1.2, R.y * 8.0);
  float n = skyFbm(q + vec3(0.0, 0.0, skyFbm(q * 0.5, nOct) * 2.0), nOct);
  float lines = pow(1.0 - abs(n * 2.0 - 1.0), 18.0);
  float gust = smoothstep(0.45, 0.8, skyFbm(vec3(cos(ph + 0.6 * s) * 0.9, sin(ph + 0.6 * s) * 0.9, R.y * 2.0) + 4.0, nOct));
  float band = smoothstep(0.95, 0.2, abs(R.y));
  float mu = dot(R, uSunDir);
  return vec3(0.55, 0.76, 0.98) * lines * gust * band * (0.5 + 0.5 * (1.0 + mu * mu)) * 0.6;
}

// The active element's sky (two during a switch), in a mirror of roughness rough.
vec3 aetherSky(vec3 R, float rough) {
  float k = smoothstep(SKY_ROUGH_SHARP, SKY_ROUGH_FLAT, rough);
  vec3 mean = uSkyW.x * SKY_MEAN_FLUID + uSkyW.y * SKY_MEAN_THERMAL + uSkyW.z * SKY_MEAN_EARTH + uSkyW.w * SKY_MEAN_AIR;
  if (k >= 1.0) return mean;
  float nOct = mix(float(SKY_OCTAVES), 1.0, k);
  vec3 s = vec3(0.0);
  if (uSkyW.x > SKY_W_MIN) s += uSkyW.x * skyFluid(R, nOct);
  if (uSkyW.y > SKY_W_MIN) s += uSkyW.y * skyThermal(R, nOct);
  if (uSkyW.z > SKY_W_MIN) s += uSkyW.z * skyEarth(R, nOct, k);
  if (uSkyW.w > SKY_W_MIN) s += uSkyW.w * skyAir(R, nOct);
  return mix(s, mean, k);
}`;
```

Notes for the implementer:
- The mockup's `dc` used `gp*70 − normalize(gi+.5)*length(gp)*70`, which equals `g − normalize(gi+.5)*length(g)`
  with `g = gp*70`. The form above is that identity.
- `atan(y, x)` is GLSL's two-argument atan.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/aetherSky.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/aetherSky.js src/terminal/mercury/planet/__tests__/aetherSky.test.js
git commit -m "feat(mercury): per-element moving aether sky chunk — approved water/fire/earth-ping/air looks bound to the clock, roughness LOD

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The mirror reflects the sky; the 16 lobes are removed

**Files:**
- Modify: `src/terminal/mercury/planet/hgMirrorGlsl.js`
- Modify: `src/terminal/mercury/planet/mercuryPlanetShader.js` (imports ~l.47-48; `PLANET_UNIFORMS` ~l.60-66;
  uniform block ~l.130-138; consts ~l.206-207 and the `AETHER_FRINGE_*` const lines)
- Modify: `src/terminal/mercury/planet/planetLook.js` (`AETHER_FRINGE_LO/HI` exports; `PLANET_TUNE` lobe knobs)
- Modify: `src/terminal/mercury/MercuryPlanet.jsx`
- Modify: `src/terminal/mercury/MercuryCanvas.jsx` (MercuryPlanet props)
- Create: `src/terminal/mercury/planet/prng.js`; modify `src/terminal/mercury/planet/hgBeads.js:9`
- Delete: `src/terminal/mercury/planet/aetherLobes.js`, `src/terminal/mercury/planet/__tests__/aetherLobes.test.js`
- Modify tests:
  - `__tests__/hgMirrorGlsl.test.js`, `__tests__/mercuryPlanetShader.test.js`, `__tests__/hgBeads.test.js:6`;
  - file snapshots `__tests__/__snapshots__/planetShader.full.fs.glsl` (re-pinned),
    `planetShader.pre-slow-noon.fs.glsl` and `planetShader.pre-visitors.fs.glsl` (patched with the same aether
    diff).

**Interfaces:**
- Consumes:
  - from Task 3: `AETHER_SKY_GLSL`;
  - from Task 1: `tickAetherClock`, `skyWeights`.
- Produces:
  - `HG_MIRROR_UNIFORMS` now contains `uSkyT`, `uSkyPhase`, `uSkyW` and no lobe uniforms;
  - `MercuryPlanet` props `aetherClock`, `pendingPhase`, `skyOpacities`.

- [ ] **Step 1: Confirm the snapshots are clean in git**

`git status --short src/terminal/mercury/planet/__tests__/__snapshots__/` must print nothing. Step 6 builds its
patch from `git diff` of the full snapshot.

- [ ] **Step 2: Update the tests first (they will fail)**

`__tests__/hgMirrorGlsl.test.js`:
- Remove `AETHER_SHAPE_GLSL` from the import and the line `expect(PLANET_FS).toContain(AETHER_SHAPE_GLSL);`.
- Add `import { AETHER_SKY_GLSL } from '../aetherSky';`.
- Add a test:
```js
  it('the mirror reflects the moving aether sky, through the shared chunk', () => {
    expect(HG_ENV_GLSL).toContain(AETHER_SKY_GLSL);
    expect(HG_ENV_GLSL).toContain('return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(aetherSky(R, rough)));');
    for (const u of ['uSkyT', 'uSkyPhase', 'uSkyW']) expect(HG_MIRROR_UNIFORMS).toContain(u);
    for (const gone of ['uAethDir', 'uAethCol', 'uAetherSinW', 'uAetherEdge', 'uAetherStretch', 'uAetherCurve', 'uAetherCore']) {
      expect(HG_MIRROR_UNIFORMS).not.toContain(gone);
    }
    expect(HG_ENV_GLSL).not.toMatch(/aetherStreak|AETHER_SHAPE|AETHER_LOBES/);
  });
```

`__tests__/mercuryPlanetShader.test.js`:
- Remove `AETHER_FRINGE_LO, AETHER_FRINGE_HI` from the `../planetLook` import and from the constants loop object.
- Remove the import line `import { AETHER_LOBES, AETHER_SHAPES } from '../aetherLobes';`.
- Remove the line ``expect(PLANET_FS).toContain(`const int AETHER_LOBES = ${AETHER_LOBES};`);``.
- Add `import { AETHER_SKY_GLSL } from '../aetherSky';`.
- In the test `'reflects the aether as AETHER_LOBES soft lobes, …'`:
  - rename it to `'reflects the moving aether sky, attenuated on the night side by the surface normal'`;
  - **delete these assertion lines** (match by content): the two `uAethDir`/`uAethCol` uniform lines, `uAetherEdge`,
    `uAetherStretch`, `vec2 aetherStreak(`, `float silhouette =`, `float body =`,
    `return aetherHue(col) * mix(uAetherCore`, `not.toContain('peak * uAetherCore')`,
    `a += aetherStreakColor(`, `uAetherCurve`, `uAetherCore`, the `AETHER_SHAPE[` line, `uAetherSinW`;
  - **keep** all the others (`uAetherGain`, `dayW`, `float m = max(x.r…`, `softShoulder(x.r…`,
    `AETHER_PATH_WHITE`, `uAetherSilver`, `return mix(col, vec3(l), uAetherSilver);`, `AETHER_SIN_W`, the
    `liquid = fresnelHg…` regex, `frozenAether`, `aetherDiffuse`, `return c + aetherMirror(R, rough, nW);`, and
    anything after);
  - add:
  ```js
    expect(PLANET_FS).toContain('uniform float uSkyT;');
    expect(PLANET_FS).toContain('uniform vec4 uSkyPhase;');
    expect(PLANET_FS).toContain('uniform vec4 uSkyW;');
    expect(PLANET_FS).toContain(AETHER_SKY_GLSL);
    for (const gone of ['uAethDir', 'uAethCol', 'uAetherSinW', 'uAetherEdge', 'uAetherStretch', 'uAetherCurve', 'uAetherCore', 'AETHER_SHAPE', 'aetherStreak', 'AETHER_LOBES', 'AETHER_FRINGE']) {
      expect(PLANET_FS).not.toContain(gone);
    }
  ```

`__tests__/hgBeads.test.js:6`: `import { mulberry32 } from '../prng';`.

Delete `__tests__/aetherLobes.test.js`. Its `mulberry32` determinism is covered by `hgBeads.test.js`'s use of it.
Add the small test below so the PRNG keeps a direct test.

`src/terminal/mercury/planet/__tests__/prng.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../prng';

describe('mulberry32', () => {
  it('is deterministic and in [0, 1)', () => {
    const a = mulberry32(0x4867), b = mulberry32(0x4867);
    for (let i = 0; i < 1000; i++) { const x = a(); expect(x).toBe(b()); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
});
```

- [ ] **Step 3: Run the planet tests to see the expected failures**

Run: `npx vitest run src/terminal/mercury/planet`
Expected: FAIL in `hgMirrorGlsl`, `mercuryPlanetShader` and `prng` (unresolved `../prng`). Nothing else should
fail yet.

- [ ] **Step 4: Implement the shader side**

`src/terminal/mercury/planet/prng.js` (moved verbatim from `aetherLobes.js`):
```js
// src/terminal/mercury/planet/prng.js — a tiny seeded PRNG (mulberry32), for deterministic sims and tests.
export function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```
`hgBeads.js:9` → `import { mulberry32 } from './prng';`.

`hgMirrorGlsl.js`:
- Replace the `aetherLobes` import with `import { AETHER_SKY_GLSL } from './aetherSky';`.
- Remove `AETHER_FRINGE_LO, AETHER_FRINGE_HI` from the `./planetLook` import.
- Delete the `AETHER_SHAPE_GLSL` export.
- `HG_MIRROR_UNIFORMS`:
  ```js
  export const HG_MIRROR_UNIFORMS = [
    'uSunDir', 'uSunIrr', 'uSunSinR', 'uExposure', 'uEmitPos', 'uEmitCol', 'uSunGlint', 'uEmitGain',
    'uSkyT', 'uSkyPhase', 'uSkyW', 'uAetherGain', 'uAetherSilver', 'uRoughLiquid',
  ];
  ```
- `HG_MIRROR_DECLS_GLSL`:
  - replace the two lobe uniform lines with `'uniform float uSkyT;', 'uniform vec4 uSkyPhase;', 'uniform vec4 uSkyW;',`;
  - delete the lines for `uAetherSinW`, `uAetherEdge`, `uAetherStretch`, `uAetherCurve` and `uAetherCore`;
  - delete `const int AETHER_LOBES`, `AETHER_SHAPE_GLSL`, `AETHER_FRINGE_LO` and `AETHER_FRINGE_HI`;
  - keep everything else in order.
- Update the header comment. The old one says the planet FS "stays byte-identical"; it now reads: "PLANET_FS is
  pinned by its file snapshot; the 2026-10-05 mirror-sky change re-pinned it."
- `HG_ENV_GLSL`:
  - delete the `aetherStreak` function with its comment block, and `aetherStreakColor` with its comment;
  - in `aetherHue`'s comment, change "An aether lobe's colour" to "The sky's colour";
  - insert `${AETHER_SKY_GLSL}` (on its own line, followed by a blank line) immediately before the
    `aetherMirror` comment;
  - replace `aetherMirror` with:
  ```glsl
  // The aether in a mirror of roughness rough: the active element's moving sky (aetherSky.js), night-tinted,
  // rolled off. Shared by the liquid (envRadiance) and the planet's frozen Hg (a rough, dark mirror of the same sky).
  vec3 aetherMirror(vec3 R, float rough, vec3 nW) {
    return aetherTint(nW) * aetherShoulder(uAetherGain * aetherHue(aetherSky(R, rough)));
  }
  ```

`mercuryPlanetShader.js`:
- Delete `import { AETHER_LOBES } from './aetherLobes';`.
- Change the hgMirrorGlsl import to `import { HG_FRESNEL_GLSL, HG_ENV_GLSL } from './hgMirrorGlsl';`.
- `PLANET_UNIFORMS`: replace the two rows
  `'uAethDir', 'uAethCol', 'uAetherGain', 'uAetherSinW', 'uAetherSilver',` /
  `'uAetherEdge', 'uAetherStretch', 'uAetherCurve', 'uAetherCore',` with
  `'uSkyT', 'uSkyPhase', 'uSkyW', 'uAetherGain', 'uAetherSilver',`.
- In the FS uniform block, replace the nine lines from `uniform vec3 uAethDir[…];` to `uniform float uAetherCore;`
  with:
  ```glsl
  uniform float uSkyT;
  uniform vec4 uSkyPhase;
  uniform vec4 uSkyW;
  uniform float uAetherGain;
  uniform float uAetherSilver;
  ```
- Delete the FS lines `const int AETHER_LOBES = ${AETHER_LOBES};` and `${AETHER_SHAPE_GLSL}`.
- Find the `AETHER_FRINGE_LO`/`AETHER_FRINGE_HI` const lines with
  `grep -n "AETHER_FRINGE" src/terminal/mercury/planet/mercuryPlanetShader.js`, delete them, and remove the two
  names from the `./planetLook` import.

`planetLook.js`:
- Delete the exports `AETHER_FRINGE_LO` and `AETHER_FRINGE_HI` (lines 43-44).
- Delete the `PLANET_TUNE` keys `aetherSinW`, `aetherEdge`, `aetherStretch`, `aetherCurve` and `aetherCore`.
- Change the `aetherGain` comment to `// liquid mirror + frozen ambient: aether sky gain (re-tuned in the mirror-sky look round)`.
- `roughLiquid`'s comment mentions "the aether streaks are ~insensitive to it". Change that to "the aether sky keeps
  full detail up to SKY_ROUGH_SHARP".

Then check that nothing else references the removed names:
```bash
grep -rn "aetherLobes\|AETHER_LOBE\|AETHER_SHAPE\|AETHER_FRINGE\|aetherSinW\|aetherEdge\|aetherStretch\|aetherCurve\|aetherCore\|uAethDir\|uAethCol" src
```
Expected: matches only in `MercuryPlanet.jsx` (fixed next). Fix any other match the same way.

Finally:
```bash
git rm src/terminal/mercury/planet/aetherLobes.js src/terminal/mercury/planet/__tests__/aetherLobes.test.js
```

- [ ] **Step 5: Implement the runtime side**

`MercuryPlanet.jsx`:
- Imports:
  - delete `import { AETHER_BASE_DIRS, aetherLobeColors, aetherLobeDirs } from './planet/aetherLobes';`;
  - add `import { tickAetherClock, skyWeights } from './planet/aetherClock';`.
- Signature: add `aetherClock = null, pendingPhase = null, skyOpacities = null` to the destructured props.
  The useFrame callback already destructures `{ clock }` from r3f state, hence the prop name `aetherClock`.
- Uniforms:
  - delete `uAethDir`, `uAethCol`, `uAetherSinW`, `uAetherEdge`, `uAetherStretch`, `uAetherCurve` and `uAetherCore`;
  - add after `uEmitGain`:
    ```js
    uSkyT: { value: 0 },
    uSkyPhase: { value: new THREE.Vector4() },
    uSkyW: { value: new THREE.Vector4(1, 0, 0, 0) },
    ```
- Replace the `aether` useMemo (dirs/cols/light) with `const skyW = useMemo(() => [1, 0, 0, 0], []);`.
  Keep `emitRef`: it still drives `uEmitCol`.
- Delete `aetherT: 0,` from `surf`.
- In the useFrame:
  - delete the five `PLANET_TUNE` lines for the removed keys (`uAetherSinW`, `uAetherEdge`, `uAetherStretch`,
    `uAetherCurve`, `uAetherCore`);
  - replace the block from `if (!calm) surf.aetherT += delta;` through the `for (let i = 0; i < aether.dirs.length; …) {…}`
    loop with:
  ```js
      // The mirror sky (aetherSky.js) on the gas's own clock; only the active element (two during a switch).
      if (aetherClock) {
        tickAetherClock(aetherClock, t, delta);
        u.uSkyT.value = aetherClock.t;
        u.uSkyPhase.value.set(aetherClock.phase.fluid, aetherClock.phase.thermal, aetherClock.phase.earth, aetherClock.phase.air);
      }
      skyWeights(activePhase, pendingPhase, skyOpacities, skyW);
      u.uSkyW.value.set(skyW[0], skyW[1], skyW[2], skyW[3]);
  ```
  `t` here is the useFrame's `clock.elapsedTime`, the same stamp the flows use.
- `grep -n "aether\.\|aetherLightAt\|aetherT" src/terminal/mercury/MercuryPlanet.jsx` must return nothing. Remove an
  import that became unused (e.g. `aetherLight`) if lint flags it.

`MercuryCanvas.jsx`, on `<MercuryPlanet …>`: add
```jsx
          aetherClock={aetherClock}
          pendingPhase={pendingPhase}
          skyOpacities={phaseOpacities}
```

- [ ] **Step 6: Re-pin the full snapshot, then patch the two historical snapshots with the same diff**

```bash
npx vitest run src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js -u
git diff -- src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl > ../ms-aether.patch
patch src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-visitors.fs.glsl < ../ms-aether.patch
patch src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-slow-noon.fs.glsl < ../ms-aether.patch
```
- Expected: both patches apply. Fuzz/offset messages are fine; `.rej` files are not.
- If a hunk rejects: STOP and report. It means an aether hunk overlaps a slow-noon/visitor-marked line. Do not
  hand-edit the pre-snapshots to make the test pass.
- Check the full-snapshot diff by eye: `git diff --stat` on it, plus a skim. It must contain only the uniform
  block, the removed consts, the removed streak functions, the inserted sky chunk, and the new `aetherMirror` body.

- [ ] **Step 7: Run everything**

- `npx vitest run src/terminal/mercury` → all pass (count = 706 + new − the deleted aetherLobes tests).
- `npm run lint` → 0 errors, warnings ≤ cap.

- [ ] **Step 8: Commit**

```bash
git add src/terminal/mercury/planet/hgMirrorGlsl.js src/terminal/mercury/planet/mercuryPlanetShader.js src/terminal/mercury/planet/planetLook.js src/terminal/mercury/planet/prng.js src/terminal/mercury/planet/hgBeads.js src/terminal/mercury/MercuryPlanet.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/planet/__tests__/hgMirrorGlsl.test.js src/terminal/mercury/planet/__tests__/mercuryPlanetShader.test.js src/terminal/mercury/planet/__tests__/hgBeads.test.js src/terminal/mercury/planet/__tests__/prng.test.js src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.full.fs.glsl src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-visitors.fs.glsl src/terminal/mercury/planet/__tests__/__snapshots__/planetShader.pre-slow-noon.fs.glsl
git commit -m "feat(mercury): the liquid mirrors the moving element sky — 16 static aether lobes removed; planet snapshot re-pinned

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(The `git rm` from Step 4 is already staged.)

---

### Task 5 (controller): live compile, mean radiances, motion and ping checks

No implementer subagent: the controller runs CDP against the :5175 dev server (preview config `scale94-dev-5175`).

- [ ] **Step 1: Compile.**
  - Probe `ms-sky.mjs`, modelled on `dustLook.mjs`: `openMercury`, `melt(25)`, wait 9 s.
  - For each element: switch, wait 2.5 s, `errors()` → `[]`, shot `ms-sky-<el>.png` (900 px).
  - Also fire a strike, `window.__mercuryTune.strike('fluid')`, so the visitor shader compiles. The beads and
    droplets compile on boot and on a fling (`breakNow(12)`).
  - **View every image before reporting.**
- [ ] **Step 2: Mean radiances.**
  - In the page, for each element: build a 64×32 float render target and a full-screen quad whose FS is the planet's
    `HG_MIRROR_DECLS_GLSL` + `AETHER_SKY_GLSL`.
  - Each pixel's equirect direction gives R; output `aetherSky(R, 0.0)` with `uSkyW` = the element's one-hot, at
    5 values of `uSkyT`/`uSkyPhase` (0, 7, 19, 31, 53 s with phases × default rates).
  - Read back, average with cos(latitude) weights.
  - Write the four results into `SKY_MEAN` in `aetherSky.js` (4 significant digits), with the comment:
    `// measured <date> by plan Task 5 (64x32 equirect, cos-lat weighted, 5 clock samples, rough 0)`.
  - Run `npx vitest run src/terminal/mercury/planet` → PASS (the test reads `SKY_MEAN` itself). The full snapshot
    changes: re-run the Task 4 Step 6 commands for the full snapshot only. The SKY_MEAN lines live in the sky
    chunk, which is in all three snapshots, so patch the pre-snapshots too.
  - Commit `fix(mercury): measured aether sky mean radiances (rough LOD floor)`.
- [ ] **Step 3: Rough-sweep continuity.**
  - With `__mercuryTune.planet.roughLiquid` swept 0.14 → 0.7 in 8 steps, take crops of the liquid.
  - The mean brightness of the crop must be monotone-smooth, with no step above 10 % between neighbours.
  - Report the numbers.
- [ ] **Step 4: Moves with the gas.**
  - For each element, take two shots 0.5 s apart. Crop the planet disc and an annulus of gas around it.
  - Report the mean absolute frame difference of the disc (it must be > 0, where it was ~0 with the lobes) and its
    dominant motion direction against the gas annulus. Eyeball check: air upper band moves the same way as the
    upper gas, water turns about the screen normal.
- [ ] **Step 5: Earth ping cadence.**
  - Earth active, liquid planet: run 240 frames of `readPixels` on the planet disc. Count connected bright
    warm-white blobs above the haze level per frame.
  - Expected: mean 1–2 concurrent, never a field of them. Report the mean, the max, and the fraction of frames with
    ≥ 1.
- [ ] **Step 6: Calm.** Reload with `?calm=1`. Two shots 1 s apart: the planet disc and the gas are identical (diff 0).
- [ ] **Step 7: Switch cross-fade.** Switch fluid → air. Take shots at 0, 100, 300, 500, 700 and 900 ms. Read
  `uSkyW` from the planet material at each point: it holds ≤ 2 non-zero weights and moves monotonically, with no
  pop.
- [ ] **Step 8: Frame time.**
  - Use `?hud=1` / `window.__mercuryPerf` on desktop and on the CDP phone profile (the existing phone probe recipe).
    For the baseline, run `git worktree add ../ms-base ac8fa425` and a dev server there on :5176, measured the same
    way. Remove the worktree after.
  - Gate: phone p50 regression ≤ 1 ms.
  - If over: apply the spec §2 fallbacks in order (water warp 3 → 2 fbm; then `skyOctaves` per tier) as a fix task.
- [ ] **Step 9:** Record everything in `.superpowers/sdd/progress.md` under `## Mirror sky + gas filaments`.

---

### Task 6: The gas streak + lane chunk (`gasStreak.js`)

**Files:**
- Create: `src/terminal/mercury/planet/gasStreak.js`
- Create: `src/terminal/mercury/planet/__tests__/gasStreak.test.js`
- Modify: `src/terminal/mercury/planet/planetLook.js` (`PLANET_TUNE` gas knobs)

**Interfaces:**
- Produces:
  - `GAS_STREAK_VS` (string). It needs `uViewportPx` and `snoise(vec3)` declared before it, and it declares the
    uniforms `uPhaseRate`, `uStreakGain`, `uGasSize`, `uGasAlpha`, `uMaskFreq`, `uMaskSharp`, `uMaskDepth` and the
    varyings `vStreakDir` (vec2), `vStreakCap` (vec2), `vLane` (float). It defines:
    - `float gasStreak(vec4 clipNow, vec4 clipPrev, float size, float stretchMax)`, which returns `gl_PointSize`;
    - `float gasLane(vec3 laneCoord, float t)`;
    - the consts `STREAK_DT`, `GAS_PX_FLOOR`, `MASK_EVOLVE`, `STRETCH_MAX` and `FIRE_EMBER_STRETCH`.
  - `GAS_STREAK_FS` (string): the matching varyings + `float gasStreakDist(vec2 pc)`.
  - JS constants `STREAK_DT`, `STRETCH_MAX`, `FIRE_EMBER_STRETCH`, `GAS_PX_FLOOR`, `MASK_EVOLVE`.
  - `PLANET_TUNE` keys `streakGain`, `gasSize`, `gasAlpha`, `maskFreq`, `maskSharp`, `maskDepth`.
  - `GAS_TUNE_UNIFORMS(tune)` → `{ uStreakGain, uGasSize, uGasAlpha, uMaskFreq, uMaskSharp, uMaskDepth }` (fresh
    uniform objects), and `writeGasTune(uniforms, tune)` (per-frame copy, no allocation).

- [ ] **Step 1: Write the failing test**

`src/terminal/mercury/planet/__tests__/gasStreak.test.js`:
```js
// Gas filaments (mirror-sky spec §3): velocity-aligned capsules + the lane mask.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  GAS_STREAK_VS, GAS_STREAK_FS, STREAK_DT, STRETCH_MAX, FIRE_EMBER_STRETCH, GAS_PX_FLOOR, MASK_EVOLVE,
  GAS_TUNE_UNIFORMS, writeGasTune,
} from '../gasStreak';
import { PLANET_TUNE } from '../planetLook';

describe('gasStreak', () => {
  it('constants: stretch ≤ 3, fire embers ≤ 1.5, no sub-pixel sprites', () => {
    expect(STRETCH_MAX).toBe(3);
    expect(FIRE_EMBER_STRETCH).toBe(1.5);
    expect(GAS_PX_FLOOR).toBe(1.5);
    for (const [n, v] of Object.entries({ STREAK_DT, STRETCH_MAX, FIRE_EMBER_STRETCH, GAS_PX_FLOOR, MASK_EVOLVE })) {
      expect(GAS_STREAK_VS).toContain(`const float ${n} = ${glf(v)};`);
    }
  });

  it('the streak is the on-screen velocity × the shutter, capped at (stretchMax − 1) × size', () => {
    expect(GAS_STREAK_VS).toContain('float gasStreak(vec4 clipNow, vec4 clipPrev, float size, float stretchMax) {');
    expect(GAS_STREAK_VS).toContain('v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;');
    expect(GAS_STREAK_VS).toContain('float L = min(sp * uStreakGain, max(stretchMax - 1.0, 0.0) * size);');
    expect(GAS_STREAK_VS).toContain('vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);'); // point coords: y down
    expect(GAS_STREAK_VS).toContain('size = max(size, GAS_PX_FLOOR);');
  });

  it('the lane mask is ridged noise in the flow\'s labels, evolving in time', () => {
    expect(GAS_STREAK_VS).toContain('float gasLane(vec3 laneCoord, float t) {');
    expect(GAS_STREAK_VS).toContain('snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE))');
    expect(GAS_STREAK_VS).toContain('return mix(1.0, pow(1.0 - abs(n), uMaskSharp), uMaskDepth);');
  });

  it('FS: capsule distance, equal to the old round radius when the streak is 0', () => {
    expect(GAS_STREAK_FS).toContain('float gasStreakDist(vec2 pc) {');
    expect(GAS_STREAK_FS).toContain('float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);');
    expect(GAS_STREAK_FS).toContain('return length(q - vStreakDir * a) / vStreakCap.y;');
    // JS replica: L = 0 → cap (0, 0.5) → distance = 2·|pc − 0.5|, the old `length(gl_PointCoord - 0.5) * 2.0`
    const dist = (pc, dir, cap) => {
      const q = [pc[0] - 0.5, pc[1] - 0.5];
      const a = Math.min(Math.max(q[0] * dir[0] + q[1] * dir[1], -cap[0]), cap[0]);
      return Math.hypot(q[0] - dir[0] * a, q[1] - dir[1] * a) / cap[1];
    };
    expect(dist([0.8, 0.3], [1, 0], [0, 0.5])).toBeCloseTo(2 * Math.hypot(0.3, 0.2), 12);
    // a 3x capsule along x: its end cap at the sprite edge is exactly on the rim
    const total = 3, L = 2, size = 1;
    expect(dist([1, 0.5], [1, 0], [0.5 * L / total, 0.5 * size / total])).toBeCloseTo(1, 12);
  });

  it('every varying is declared on both sides', () => {
    for (const v of ['varying vec2 vStreakDir;', 'varying vec2 vStreakCap;', 'varying float vLane;']) {
      expect(GAS_STREAK_VS).toContain(v);
      expect(GAS_STREAK_FS).toContain(v);
    }
  });

  it('tune knobs: defaults live in PLANET_TUNE, copied per frame without allocation', () => {
    for (const k of ['streakGain', 'gasSize', 'gasAlpha', 'maskFreq', 'maskSharp', 'maskDepth']) expect(typeof PLANET_TUNE[k]).toBe('number');
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(u.uStreakGain.value).toBe(PLANET_TUNE.streakGain);
    const objs = Object.values(u);
    writeGasTune(u, { ...PLANET_TUNE, maskDepth: 0.25 });
    expect(u.uMaskDepth.value).toBe(0.25);
    expect(Object.values(u)).toEqual(objs);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/gasStreak.test.js` → FAIL (unresolved import).

- [ ] **Step 3: Implement**

`src/terminal/mercury/planet/planetLook.js`: add to `PLANET_TUNE`, after `aetherPenumbra`:
```js
  streakGain: 0.08,  // gas streak shutter (s): a streak shows this much of a particle's on-screen motion (mirror-sky spec §3b)
  gasSize: 0.34,     // gas sprite size × this (density ×3 → size ⅓; floored at GAS_PX_FLOOR px)
  gasAlpha: 3,       // gas alpha × this, so the smaller sprites keep the nebula's brightness (look round)
  maskFreq: 2.5,     // lane mask frequency in the flows' label space
  maskSharp: 3,      // lane ridge sharpness (higher = thinner filaments)
  maskDepth: 0.6,    // 0 = no mask, 1 = everything off-ridge is carved away
```

`src/terminal/mercury/planet/gasStreak.js`:
```js
// src/terminal/mercury/planet/gasStreak.js — gas filaments for the element flows (mirror-sky spec §3).
//
// Velocity-aligned capsules. Each flow evaluates its big analytic motion twice: at the clock's phase now and
// STREAK_DT of clock time earlier (phase − STREAK_DT · uPhaseRate). gasStreak() turns the two clip positions into
// the on-screen velocity and stretches the round sprite along it, by speed × uStreakGain (a shutter), at most
// (stretchMax − 1) × its size. Calm zeroes uPhaseRate, so the sprites go round. gasStreakDist() is the capsule's
// normalised distance (0 on the axis, 1 at the rim); with no streak it equals the old round radius, so each
// element keeps its own falloff profile. gasLane(): a ridged simplex in the flow's own cross-stream labels, so
// carved regions are lanes of particles (filaments) travelling with the current, slowly evolving (never a lattice).
// Needs uViewportPx (PLANET_WINDOW_VS) and the flow's snoise(vec3) declared before GAS_STREAK_VS.

import { glf } from '../../gl/glf';

export const STREAK_DT = 1 / 30;
export const STRETCH_MAX = 3;
export const FIRE_EMBER_STRETCH = 1.5;
export const GAS_PX_FLOOR = 1.5;
export const MASK_EVOLVE = 0.03;

export const GAS_STREAK_VS = /* glsl */ `
uniform float uPhaseRate;
uniform float uStreakGain;
uniform float uGasSize;
uniform float uGasAlpha;
uniform float uMaskFreq;
uniform float uMaskSharp;
uniform float uMaskDepth;
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
const float STREAK_DT = ${glf(STREAK_DT)};
const float STRETCH_MAX = ${glf(STRETCH_MAX)};
const float FIRE_EMBER_STRETCH = ${glf(FIRE_EMBER_STRETCH)};
const float GAS_PX_FLOOR = ${glf(GAS_PX_FLOOR)};
const float MASK_EVOLVE = ${glf(MASK_EVOLVE)};

float gasStreak(vec4 clipNow, vec4 clipPrev, float size, float stretchMax) {
  size = max(size, GAS_PX_FLOOR);
  vec2 v = vec2(0.0);
  if (clipNow.w > 1e-4 && clipPrev.w > 1e-4) {
    v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;
  }
  float sp = length(v);
  float L = min(sp * uStreakGain, max(stretchMax - 1.0, 0.0) * size);
  float total = size + L;
  vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);
  vStreakCap = vec2(0.5 * L / total, 0.5 * size / total);
  return total;
}

float gasLane(vec3 laneCoord, float t) {
  float n = snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE));
  return mix(1.0, pow(1.0 - abs(n), uMaskSharp), uMaskDepth);
}
`;

export const GAS_STREAK_FS = /* glsl */ `
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
float gasStreakDist(vec2 pc) {
  vec2 q = pc - 0.5;
  float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);
  return length(q - vStreakDir * a) / vStreakCap.y;
}
`;

const GAS_TUNE = [['uStreakGain', 'streakGain'], ['uGasSize', 'gasSize'], ['uGasAlpha', 'gasAlpha'],
  ['uMaskFreq', 'maskFreq'], ['uMaskSharp', 'maskSharp'], ['uMaskDepth', 'maskDepth']];

export function GAS_TUNE_UNIFORMS(tune) {
  return Object.fromEntries(GAS_TUNE.map(([u, k]) => [u, { value: tune[k] }]));
}

export function writeGasTune(uniforms, tune) {
  for (let i = 0; i < GAS_TUNE.length; i++) uniforms[GAS_TUNE[i][0]].value = tune[GAS_TUNE[i][1]];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/gasStreak.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/terminal/mercury/planet/gasStreak.js src/terminal/mercury/planet/__tests__/gasStreak.test.js src/terminal/mercury/planet/planetLook.js
git commit -m "feat(mercury): gas streak chunk — velocity-aligned capsule sprites + ridged lane mask, tune knobs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Filaments in the fluid and air flows

**Files:**
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx`
- Modify: `src/terminal/mercury/planet/__tests__/flowLight.test.js` (one regex)
- Create: `src/terminal/mercury/planet/__tests__/flowStreak.test.js`

**Interfaces:**
- Consumes:
  - from Task 6: `GAS_STREAK_VS`, `GAS_STREAK_FS`, `GAS_TUNE_UNIFORMS`, `writeGasTune`;
  - from Task 2: `clk`, `uPhase`.
- Produces: the pattern Task 8 repeats.
  - `uPhaseRate` written from `clk.rate.<el>` each frame;
  - a `<core>Pos(float ph, …)` GLSL function per flow;
  - `prev` = core at `uPhase - STREAK_DT * uPhaseRate` + the same perturbation offset;
  - `gl_PointSize = gasStreak(...)`;
  - the FS distance from `gasStreakDist`;
  - alpha × `vLane`.

- [ ] **Step 1: Write the failing test**

`src/terminal/mercury/planet/__tests__/flowStreak.test.js`:
```js
// Gas filaments in each flow (mirror-sky spec §3). Read from the sources.
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';

const STREAKED = {
  fluid: { src: particleSrc, core: 'vec3 knotPos(float ph, out vec3 center) {', stretch: 'STRETCH_MAX' },
  air: { src: atmoSrc, core: 'vec3 orbitPos(float ph, out float angle) {', stretch: 'STRETCH_MAX' },
};

describe('gas filaments', () => {
  for (const [el, { src, core, stretch }] of Object.entries(STREAKED)) {
    it(`${el}: core motion sampled twice, capsule sprite, lane mask, live knobs`, () => {
      expect(src).toContain('${GAS_STREAK_VS}');
      expect(src).toContain('${GAS_STREAK_FS}');
      expect(src.indexOf('${GAS_STREAK_VS}')).toBeGreaterThan(src.indexOf('float snoise('));
      expect(src).toContain(core);
      expect(src).toContain('uPhase - STREAK_DT * uPhaseRate');
      expect(src).toMatch(new RegExp(`gl_PointSize = gasStreak\\(gl_Position, projectionMatrix \\* mvPrev, size, ${stretch}\\);`));
      expect(src).toContain('vLane = gasLane(');
      expect(src).toContain('* vLane');
      expect(src).toMatch(/float d = gasStreakDist\(gl_PointCoord\);/);
      expect(src).toContain(`mat.uniforms.uPhaseRate.value = clk.rate.${el};`);
      expect(src).toContain('...GAS_TUNE_UNIFORMS(PLANET_TUNE),');
      expect(src).toContain('writeGasTune(mat.uniforms, PLANET_TUNE);');
      expect(src).toContain('uPhaseRate: { value: 0 },');
      expect(src).toContain('prev *= 1.0 - uCondense * uCondense;');
      expect(src).toContain('* uGasSize');
    });
  }
});
```

In `flowLight.test.js`, change the regex line
`expect(src).toMatch(/aetherLightVS\(mv\w*\.xyz, gl_PointSize\);/);` to
`expect(src).toMatch(/aetherLightVS\(mv\w*\.xyz, (gl_PointSize|size)\);/);`. The light's sprite diameter uses
the round size, not the streak.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/flowStreak.test.js` → FAIL.

- [ ] **Step 3: Implement ParticleFlow.jsx**

- Import: `import { GAS_STREAK_VS, GAS_STREAK_FS, GAS_TUNE_UNIFORMS, writeGasTune } from '../mercury/planet/gasStreak';`.
- VS: insert `${GAS_STREAK_VS}` on its own line right before `void main() {`. That is after `snoise`, `curlNoise`
  and `knotCenter`, and after the `${PLANET_WINDOW_VS}` chunk at the top, which declares `uViewportPx`.
- Replace the whole `void main() { … }` of the VS with:
```glsl
  // The knot drift alone (the big motion) at knot phase ph: the particle's place in its tube.
  vec3 knotPos(float ph, out vec3 center) {
    float t = fract(aPhase + ph * (0.6 + aOffset * 0.4));
    center = knotCenter(t);

    // Tangent + local Frenet frame
    vec3 tangent = normalize(knotCenter(t + 0.001) - center);
    vec3 up = abs(tangent.y) < 0.99 ? vec3(0, 1, 0) : vec3(1, 0, 0);
    vec3 normal = normalize(cross(tangent, up));
    vec3 binormal = cross(tangent, normal);

    // ── Gravity bias: project world-down onto local frame ──
    vec3 gravity = vec3(0.0, -1.0, 0.0);
    float gravNormal = dot(gravity, normal) * 0.015;
    float gravBinormal = dot(gravity, binormal) * 0.015;

    // ── Tube offset: sand-grain position inside tube ──
    float angle = aOffset * 6.283185307;
    float rad = aRadius * uTubeRadius;
    return center + normal * (cos(angle) * rad + gravNormal) + binormal * (sin(angle) * rad + gravBinormal);
  }

  void main() {
    // ── Primary motion: tangential drift along knot (now, and STREAK_DT of clock time ago) ──
    vec3 center, centerPrev;
    vec3 basePos = knotPos(uPhase, center);
    vec3 prevCore = knotPos(uPhase - STREAK_DT * uPhaseRate, centerPrev);

    // ── Per-particle granular jitter (sand shimmer) ──
    float jx = snoise(basePos * 8.0 + vec3(uTime, 0.0, 0.0)) * 0.012;
    float jy = snoise(basePos * 8.0 + vec3(0.0, uTime, 0.0)) * 0.012;
    float jz = snoise(basePos * 8.0 + vec3(0.0, 0.0, uTime)) * 0.012;

    // ── Subtle curl drift (environmental, not primary) ──
    vec3 curl = curlNoise(center * 2.0 + uTime * 0.1) * uCurlAmp;

    vec3 pos = basePos + vec3(jx, jy, jz) + curl;
    vec3 prev = prevCore + (pos - basePos); // the streak shows the current, not the shimmer

    // ── Harmonic color cycling ──
    vHue = fract(aPhase + uTime * 0.05 + uChromatic * 0.33);
    vBrightness = 0.8 + 0.2 * sin(aPhase * 6.283185307 + uTime * 0.3);

    // Nebula condensation: contract the post-sim field into the drop.
    // Squared ease = gravity well (slow drift, fast swallow); the sphere's
    // depth buffer occludes arrivals. Applies to pos, NOT the raw attribute.
    pos *= 1.0 - uCondense * uCondense;
    prev *= 1.0 - uCondense * uCondense;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vec4 mvPrev = modelViewMatrix * vec4(prev, 1.0);
    float size = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite) * uGasSize;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = gasStreak(gl_Position, projectionMatrix * mvPrev, size, STRETCH_MAX);
    // Lanes across the tube (its cross-section) and, slowly, along it: threads that ride the knot.
    float laneA = aOffset * 6.283185307;
    vLane = gasLane(vec3(cos(laneA) * aRadius * 3.0, sin(laneA) * aRadius * 3.0, aPhase * 1.5), uTime) * uGasAlpha;
    planetWindowVS(mvPosition.xyz);
    aetherLightVS(mvPosition.xyz, size);
  }
```
- FS: insert `${GAS_STREAK_FS}` right after `${aetherLightFS('fluid')}`. Replace
  `float d = length(gl_PointCoord - 0.5) * 2.0;` with `float d = gasStreakDist(gl_PointCoord);`. Change the output
  to `gl_FragColor = vec4(color, (alpha * 0.95 * uOpacity * vLane) * planetWindow() + dither);`.
- Uniforms object: add `uPhaseRate: { value: 0 },` and `...GAS_TUNE_UNIFORMS(PLANET_TUNE),`. `PLANET_TUNE` is
  already imported.
- useFrame, inside `if (mat)`, after the `uPhase` line:
  ```js
        mat.uniforms.uPhaseRate.value = clk.rate.fluid;
        writeGasTune(mat.uniforms, PLANET_TUNE);
  ```

- [ ] **Step 4: Implement AtmosphericFlow.jsx**

- Same import. Insert `${GAS_STREAK_VS}` right before `void main(){`.
- Replace the VS `main` from its start through `pos += curl * uTurbulence * 0.3;` and the shimmer lines, up to and
  including the `gl_PointSize`/`gl_Position` lines and the two chunk calls, with:
```glsl
  // The cyclone orbit alone (the big motion) at air phase ph.
  vec3 orbitPos(float ph, out float angle) {
    // Orbital radius: widest at mid-altitude (eye-wall), narrows at base and top
    float eyeWall     = sin(aAlt * 3.14159);           // peaks at mid-altitude
    float baseRadius  = (0.15 + eyeWall * 1.1) * uSpread;
    // Ionosphere particles orbit faster at larger radius
    float ionRadius   = 1.35 * uSpread;
    float radius      = mix(baseRadius, ionRadius, aIon);
    // Orbit height spans full geode
    float orbitHeight = -1.2 + aAlt * 2.5;
    // Contra-rotating layers: lower half CW, upper half CCW (realistic cyclone)
    float direction  = aAlt > 0.5 ? 1.0 : -0.85;
    float ionSpeedMult = mix(1.0, 2.8, aIon); // ionosphere is fast
    float orbitRate  = (0.4 + aSpeed * 0.7) * direction * ionSpeedMult; // × orbitalSpeed lives in uPhase (the clock)
    angle            = aPhase * 6.28318 + ph * orbitRate;
    return vec3(cos(angle) * radius, orbitHeight, sin(angle) * radius);
  }

  void main(){
    // ── Cyclone / helical orbit (now, and STREAK_DT of clock time ago) ──
    float angle, anglePrev;
    vec3 core = orbitPos(uPhase, angle);
    vec3 prevCore = orbitPos(uPhase - STREAK_DT * uPhaseRate, anglePrev);
    vec3 pos = core;
    pos.y += snoise(vec3(angle * 0.25, uTime * 0.07, aAlt * 4.0)) * 0.15;

    // ── Atmospheric eddies (slow curl turbulence) ────────────────────────
    float t = uTime * 0.08;
    vec3 curl = curlNoise(pos * 0.9 + vec3(t, t * 0.6, t * 0.8));
    pos += curl * uTurbulence * 0.3;

    // Fine molecular shimmer
    float st = uTime * 0.6;
    pos.x += snoise(pos * 5.0 + vec3(st, 0.0, aPhase)) * 0.03;
    pos.z += snoise(pos * 5.0 + vec3(aPhase, 0.0, st * 1.1)) * 0.03;
    vec3 prev = prevCore + (pos - core); // the streak shows the current, not the eddies

    // Altitude from actual height + inherent layer
    float normY   = clamp((pos.y + 1.2) / 2.5, 0.0, 1.0);
    vAltitude = mix(aAlt, normY, 0.35);
    vSpeed    = aSpeed;
    vIon      = aIon;

    // Air particles barely shrink — they persist at full size
    float baseSize = aSize * 5.0;

    // Nebula condensation — see ParticleFlow.jsx for the physics note.
    pos *= 1.0 - uCondense * uCondense;
    prev *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vec4 mvPrev = modelViewMatrix * vec4(prev, 1.0);
    float size = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite) * uGasSize;
    gl_Position  = projectionMatrix * mvPos;
    gl_PointSize = gasStreak(gl_Position, projectionMatrix * mvPrev, size, STRETCH_MAX);
    // Lanes across the cyclone: by altitude layer and ionosphere, slowly along the orbit.
    vLane = gasLane(vec3(aAlt * 4.0, aIon * 2.0 + aSpeed, aPhase * 1.5), uTime) * uGasAlpha;
    planetWindowVS(mvPos.xyz);
    aetherLightVS(mvPos.xyz, size);
  }
```
  Keep any VS lines between the shimmer and the size code that aren't shown here, in order. Compare with the
  current file: `vAltitude`/`vSpeed`/`vIon` are shown above. The old `float altSq = aAlt * aAlt;` was unused and
  goes away.
- FS: insert `${GAS_STREAK_FS}` after `${aetherLightFS('air')}`. Replace `float d = length(gl_PointCoord - 0.5) * 2.0;`
  with `float d = gasStreakDist(gl_PointCoord);`. Change the output to
  `gl_FragColor = vec4(col, (alpha * alphaScale * uOpacity * vLane) * planetWindow() + dither);`.
- Uniforms + useFrame as in ParticleFlow, with `clk.rate.air`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/terminal/mercury` → all pass (flowStreak, flowLight, flowClock).
Run: `npm run lint` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/fluid/ParticleFlow.jsx src/terminal/air/AtmosphericFlow.jsx src/terminal/mercury/planet/__tests__/flowStreak.test.js src/terminal/mercury/planet/__tests__/flowLight.test.js
git commit -m "feat(mercury): fluid + air gas filaments — velocity-aligned capsules from the clocked core motion, lane mask

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7 (controller):** Live compile (`errors()` → `[]`) with fluid and air active. Take shots and look at
  them: streaks visible along the knot and the orbit, threads in the fluid tube.

> **Done 39cd6d94: compile OK, LOOK FAIL.**
> - The plan's premise of several-px sprites was wrong: the real sprites are ~100–260 px.
> - This recipe rendered opaque blobs (fluid) and white pills (air).
> - The author ruled Option A (spec §3, amended in session 2). **Task 7b** rebuilds the chunk and retrofits fluid
>   and air.
> - Tasks 8 and 9 below are rewritten for Option A.

---

### Task 7b: Option A, two gas roles in one draw (shared chunk, fluid + air retrofit, tier density)

**Why.** Task 7's look failed. Its recipe assumed several-px sprites, but the real ones are ~100–260 px, so it
rendered opaque blobs and white pills. The author ruled **Option A** (spec §3b–3g, amended 2026-10-05 session 2):

- **Fog role** (`aRole` 0): the old sprite, a little dimmer.
- **Filament role** (`aRole` 1): thin, lane-masked micro-streaks. The width is decoupled from the length, the
  length runs up to ~8× the width, and a per-particle jitter of ±30 % varies it.
- **Counts:** the fog count is tied to the base count, and the density multiplier feeds the filaments.

This task rebuilds the shared chunk, retrofits the two flows already built (fluid, air) and wires the tier
density. Fire and earth follow in Task 8.

**Files:**
- Modify: `src/terminal/mercury/planet/gasStreak.js` (role-aware chunk, role split and counts)
- Modify: `src/terminal/mercury/planet/__tests__/gasStreak.test.js` (full rewrite below)
- Modify: `src/terminal/mercury/planet/planetLook.js` (`PLANET_TUNE` gas knobs)
- Modify: `src/terminal/fluid/ParticleFlow.jsx`, `src/terminal/air/AtmosphericFlow.jsx`
- Modify: `src/terminal/mercury/MercuryCanvas.jsx` (tier multiplier + fog count for all four flows)
- Modify: `src/terminal/mercury/planet/__tests__/flowStreak.test.js` (full rewrite below)
- Controller only, never staged: `.superpowers/sdd/tools/ms-look.mjs`

**Interfaces:**
- Produces in `gasStreak.js`:
  - **JS constants:** `STREAK_DT`, `FIL_ASPECT` (8), `FIL_JITTER` (0.3), `FIRE_EMBER_STRETCH` (1.5),
    `FIRE_EMBER_GAIN` (20), `GAS_PX_FLOOR` (1.5), `GAS_Z_REF` (4.43), `MASK_EVOLVE`, `FOG_SHARE` (0.25),
    `GAS_DENSITY_REF` (3). `STRETCH_MAX` is **removed**.
  - **Pure functions:** `gasFogCount(base, total)` and `gasRoles(count, nFog)` → `Float32Array` (0 fog / 1 filament).
  - **`GAS_STREAK_VS`**. It needs `uViewportPx` and `snoise(vec3)` declared before it. It declares the uniforms
    `uPhaseRate`, `uStreakGain`, `uFilWidth`, `uFilAlpha`, `uFogAlpha`, `uMaskFreq`, `uMaskSharp` and
    `uMaskDepth`, and the varyings `vStreakDir`, `vStreakCap` and `vLane`. It defines:
    - `gasHash(a, b)`;
    - `gasFilWidth(depth, s01, bite)`;
    - `gasSprite(clipNow, clipPrev, role, size, aspectMax, jit)`, which returns `gl_PointSize`;
    - `gasLane(laneCoord, t)`;
    - `gasAlpha(role, laneCoord, t)`;
    - `gasRoleAlpha(role)`.
  - **`GAS_STREAK_FS`:** unchanged.
  - **`GAS_TUNE_UNIFORMS` / `writeGasTune`** over the knobs `streakGain`, `filWidth`, `filAlpha`, `fogAlpha`,
    `maskFreq`, `maskSharp` and `maskDepth`.
- Produces in the flows:
  - a `fogCount` prop (default `round(count · FOG_SHARE)` for standalone use);
  - an `aRole` attribute;
  - the pattern Task 8 repeats: `fogSize` (old formula) / `filW` → `size` → `gasSprite` → `vLane = gasAlpha(...)`.
- Produces in `MercuryCanvas`: `densityFor` (base × `TIERS[TIER].gasDensity` when active) and `fogFor`.

**Pixel targets** (spec §3g; drawing-buffer px; probe window 1600 × 1000; fitted camera z 4.43; FOV 42° → ~294 px per
world unit at the centre):
- **Fog:** unchanged (fluid 102–237 px, air mean ~113 px).
- **Filament core:** `filWidth` 2.2 px at z 4.43, ±25 % → 1.5–3.3 px after the 1.5 px floor.
- **Length:** `streakGain` 0.03 s. Fluid mean ~355 px/s → +10.7 px → ~6× the width. Air mean ~145 px/s → ~3×.
  Ionosphere → the cap, 8× ± 30 %.
- **Fog alpha:** `fogAlpha` 0.9 → the fog body ≈ 0.75 × 0.9 ≈ 0.68 of the old one where alpha is low.
- **Filament alpha:** `filAlpha` 1 = the element's own per-particle alpha.
- **Mask:** `maskDepth` 0.7, now on filaments only.

- [ ] **Step 1: Rewrite the chunk test (it will fail)**

`src/terminal/mercury/planet/__tests__/gasStreak.test.js` (replace the whole file):
```js
// Gas filaments (mirror-sky spec §3, Option A): two roles in one draw — fog (the old sprite, passed through)
// and filament capsules (width decoupled from length, jittered). JS replicas mirror the GLSL lines pinned below.
import { describe, it, expect } from 'vitest';
import { glf } from '../../../gl/glf';
import {
  GAS_STREAK_VS, GAS_STREAK_FS, STREAK_DT, FIL_ASPECT, FIL_JITTER, FIRE_EMBER_STRETCH, FIRE_EMBER_GAIN, GAS_PX_FLOOR,
  GAS_Z_REF, MASK_EVOLVE, FOG_SHARE, GAS_DENSITY_REF, gasFogCount, gasRoles, GAS_TUNE_UNIFORMS, writeGasTune,
} from '../gasStreak';
import { PLANET_TUNE } from '../planetLook';
import { TIERS } from '../planetQuality';

// Replica of gasSprite(): role 0 passes the size through; role 1 = floored width + jittered, capped length.
const sprite = (role, size, sp, aspect = FIL_ASPECT, jit = 0.5, gain = PLANET_TUNE.streakGain) => {
  if (role < 0.5) return { total: size, w: size };
  const w = Math.max(size, GAS_PX_FLOOR);
  const L = Math.min(sp * gain, Math.max(aspect - 1, 0) * w) * (1 + FIL_JITTER * (2 * jit - 1));
  return { total: w + L, w };
};
// Replica of gasFilWidth() (the floor is applied in gasSprite).
const filWidth = (depth, s, bite = 1) => PLANET_TUNE.filWidth * (GAS_Z_REF / Math.max(depth, 0.5)) * (0.75 + 0.5 * s) * bite;

describe('gasStreak constants', () => {
  it('filament cap ~8x ±30 %, fire embers ≤ 1.5x, no sub-pixel filaments; the old 3x cap is gone', () => {
    expect(FIL_ASPECT).toBe(8);
    expect(FIL_JITTER).toBe(0.3);
    expect(FIRE_EMBER_STRETCH).toBe(1.5);
    expect(FIRE_EMBER_GAIN).toBe(20);
    expect(GAS_PX_FLOOR).toBe(1.5);
    expect(GAS_Z_REF).toBe(4.43);
    for (const [n, v] of Object.entries({ STREAK_DT, FIL_ASPECT, FIL_JITTER, FIRE_EMBER_STRETCH, FIRE_EMBER_GAIN, GAS_PX_FLOOR, GAS_Z_REF, MASK_EVOLVE })) {
      expect(GAS_STREAK_VS).toContain(`const float ${n} = ${glf(v)};`);
    }
    expect(GAS_STREAK_VS).not.toContain('STRETCH_MAX');
    for (const u of ['uPhaseRate', 'uStreakGain', 'uFilWidth', 'uFilAlpha', 'uFogAlpha', 'uMaskFreq', 'uMaskSharp', 'uMaskDepth']) {
      expect(GAS_STREAK_VS).toContain(`uniform float ${u};`);
    }
    expect(GAS_STREAK_VS).not.toMatch(/uGasSize|uGasAlpha/);
  });
});

describe('gas roles (spec §3b, §3e)', () => {
  it('the fog count follows the base, not the multiplier: 25 % at the full tier, 0.75 x base everywhere', () => {
    expect(FOG_SHARE).toBe(0.25);
    expect(GAS_DENSITY_REF).toBe(TIERS.full.gasDensity);
    expect(gasFogCount(1200, 3600)).toBe(900);  // full, active
    expect(gasFogCount(600, 1800)).toBe(450);   // phone x3
    expect(gasFogCount(600, 1200)).toBe(450);   // phone x2
    expect(gasFogCount(1200, 1200)).toBe(900);  // lite x1
    expect(gasFogCount(300, 300)).toBe(225);    // ghost
    expect(gasFogCount(1000, 500)).toBe(500);   // never more fog than particles
  });

  it('gasRoles: exact fog count, deterministic, evenly spread, 0/1 floats', () => {
    const r = gasRoles(3600, 900);
    expect(r).toBeInstanceOf(Float32Array);
    expect(r.length).toBe(3600);
    expect(r.filter((x) => x === 0).length).toBe(900);
    expect(r.every((x) => x === 0 || x === 1)).toBe(true);
    expect(gasRoles(3600, 900)).toEqual(r);
    for (let i = 0; i + 40 <= 3600; i += 40) {
      const fog = r.subarray(i, i + 40).filter((x) => x === 0).length;
      expect(Math.abs(fog - 10)).toBeLessThanOrEqual(1);
    }
    expect(gasRoles(10, 0).every((x) => x === 1)).toBe(true);
    expect(gasRoles(10, 10).every((x) => x === 0)).toBe(true);
    expect(gasRoles(0, 0).length).toBe(0);
  });
});

describe('gasSprite (spec §3c)', () => {
  it('fog passes the old size straight through: round, no floor, no stretch', () => {
    expect(GAS_STREAK_VS).toContain('float gasSprite(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit) {');
    expect(GAS_STREAK_VS).toMatch(/if \(role < 0\.5\) \{\s*vStreakDir = vec2\(1\.0, 0\.0\);\s*vStreakCap = vec2\(0\.0, 0\.5\);\s*return size;\s*\}/);
    expect(sprite(0, 0.4, 999).total).toBe(0.4);
    expect(sprite(0, 237, 999).total).toBe(237);
  });

  it('filament: floored width; length = speed x shutter, capped at (aspect - 1) x width, jitter on both', () => {
    expect(GAS_STREAK_VS).toContain('float w = max(size, GAS_PX_FLOOR);');
    expect(GAS_STREAK_VS).toContain('v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;');
    expect(GAS_STREAK_VS).toContain('float L = min(sp * uStreakGain, max(aspectMax - 1.0, 0.0) * w) * (1.0 + FIL_JITTER * (2.0 * jit - 1.0));');
    expect(GAS_STREAK_VS).toContain('vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);'); // point coords: y down
    expect(GAS_STREAK_VS).toContain('vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);');
    expect(sprite(1, 0.5, 0).total).toBe(GAS_PX_FLOOR);                 // calm or sub-pixel → a 1.5 px round dot
    const f = sprite(1, 2.2, 355);                                      // spec §3g: fluid mean speed, 2.2 px core
    expect(f.total / f.w).toBeGreaterThan(5);
    expect(f.total / f.w).toBeLessThan(7);
    expect(sprite(1, 2.2, 5000).total / 2.2).toBeCloseTo(FIL_ASPECT, 9);           // capped, jitter 0.5
    expect(sprite(1, 2.2, 5000, FIL_ASPECT, 0).total / 2.2).toBeCloseTo(1 + 7 * 0.7, 9);
    expect(sprite(1, 2.2, 5000, FIL_ASPECT, 1).total / 2.2).toBeCloseTo(1 + 7 * 1.3, 9);
    expect(sprite(1, 2.2, 5000, FIRE_EMBER_STRETCH, 0.5).total / 2.2).toBeCloseTo(1.5, 9); // embers pass jit 0.5
  });

  it('filament width: the knob is px at GAS_Z_REF, ±25 % by a size label, perspective, condensation bite', () => {
    expect(GAS_STREAK_VS).toContain('float gasFilWidth(float depth, float s01, float bite) {');
    expect(GAS_STREAK_VS).toContain('return uFilWidth * (GAS_Z_REF / max(depth, 0.5)) * mix(0.75, 1.25, s01) * bite;');
    expect(filWidth(GAS_Z_REF, 0.5)).toBeCloseTo(PLANET_TUNE.filWidth, 12);
    // spec §3g: fluid depths 3.7..5.2 → a 1.5..3.3 px core after the floor
    expect(Math.max(filWidth(5.2, 0), GAS_PX_FLOOR)).toBe(GAS_PX_FLOOR);
    expect(filWidth(3.7, 1)).toBeLessThan(3.4);
  });

  it('per-particle jitter hash', () => {
    expect(GAS_STREAK_VS).toContain('float gasHash(float a, float b) {');
    expect(GAS_STREAK_VS).toContain('return fract(sin(a * 91.7 + b * 47.3) * 43758.5453);');
  });
});

describe('lane mask + role alpha (spec §3d)', () => {
  it('ridged noise in the flow labels, evolving; only filaments are carved', () => {
    expect(GAS_STREAK_VS).toContain('float gasLane(vec3 laneCoord, float t) {');
    expect(GAS_STREAK_VS).toContain('snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE))');
    expect(GAS_STREAK_VS).toContain('return mix(1.0, pow(max(1.0 - abs(n), 0.0), uMaskSharp), uMaskDepth);');
    expect(GAS_STREAK_VS).toMatch(/float gasAlpha\(float role, vec3 laneCoord, float t\) \{\s*if \(role < 0\.5\) return uFogAlpha;\s*return gasLane\(laneCoord, t\) \* uFilAlpha;\s*\}/);
    expect(GAS_STREAK_VS).toMatch(/float gasRoleAlpha\(float role\) \{\s*return role < 0\.5 \? uFogAlpha : uFilAlpha;\s*\}/);
  });
});

describe('FS + varyings', () => {
  it('capsule distance equals the old round radius when the streak is 0', () => {
    expect(GAS_STREAK_FS).toContain('float gasStreakDist(vec2 pc) {');
    expect(GAS_STREAK_FS).toContain('float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);');
    expect(GAS_STREAK_FS).toContain('return length(q - vStreakDir * a) / vStreakCap.y;');
    const dist = (pc, dir, cap) => {
      const q = [pc[0] - 0.5, pc[1] - 0.5];
      const a = Math.min(Math.max(q[0] * dir[0] + q[1] * dir[1], -cap[0]), cap[0]);
      return Math.hypot(q[0] - dir[0] * a, q[1] - dir[1] * a) / cap[1];
    };
    expect(dist([0.8, 0.3], [1, 0], [0, 0.5])).toBeCloseTo(2 * Math.hypot(0.3, 0.2), 12); // the fog role
    // an 8x capsule along a diagonal: its end cap touches the rim on the axis, inside the sprite square
    const w = 1, L = 7, total = w + L, d = [Math.SQRT1_2, Math.SQRT1_2];
    const end = 0.5 * total / total; // centre → tip along the axis = (L/2 + w/2) / total = 0.5
    expect(dist([0.5 + d[0] * end, 0.5 + d[1] * end], d, [0.5 * L / total, 0.5 * w / total])).toBeCloseTo(1, 12);
  });

  it('every varying is declared on both sides', () => {
    for (const v of ['varying vec2 vStreakDir;', 'varying vec2 vStreakCap;', 'varying float vLane;']) {
      expect(GAS_STREAK_VS).toContain(v);
      expect(GAS_STREAK_FS).toContain(v);
    }
  });
});

describe('tune knobs (spec §3g)', () => {
  it('defaults are derived from the px targets; the old gasSize/gasAlpha are gone', () => {
    expect(PLANET_TUNE).toMatchObject({ filWidth: 2.2, streakGain: 0.03, filAlpha: 1, fogAlpha: 0.9, maskFreq: 2.5, maskSharp: 3, maskDepth: 0.7 });
    expect(PLANET_TUNE.fogAlpha).toBeLessThan(1);
    expect('gasSize' in PLANET_TUNE).toBe(false);
    expect('gasAlpha' in PLANET_TUNE).toBe(false);
  });

  it('copied per frame without allocation', () => {
    const u = GAS_TUNE_UNIFORMS(PLANET_TUNE);
    expect(Object.keys(u).sort()).toEqual(['uFilAlpha', 'uFilWidth', 'uFogAlpha', 'uMaskDepth', 'uMaskFreq', 'uMaskSharp', 'uStreakGain']);
    expect(u.uFilWidth.value).toBe(PLANET_TUNE.filWidth);
    const objs = Object.values(u);
    writeGasTune(u, { ...PLANET_TUNE, fogAlpha: 0.5 });
    expect(u.uFogAlpha.value).toBe(0.5);
    expect(Object.values(u)).toEqual(objs);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/gasStreak.test.js` → FAIL (missing exports).

- [ ] **Step 3: Implement `gasStreak.js`** (replace the whole file)

```js
// src/terminal/mercury/planet/gasStreak.js — gas filaments for the element flows (mirror-sky spec §3, Option A).
//
// Two particle roles in ONE draw per flow (author, 2026-10-05). aRole 0 = fog: the flow's old round sprite,
// passed through untouched (size, shape), unmasked, alpha × uFogAlpha. It keeps the nebula's body and colour
// blending. aRole 1 = filament: a thin capsule whose WIDTH is uFilWidth px at GAS_Z_REF (perspective, ±25 % by a
// size label, floored at GAS_PX_FLOOR). Its LENGTH beyond the round core is the on-screen speed × uStreakGain (a
// shutter), capped at (aspectMax − 1) × width, both scaled by a ±FIL_JITTER per-particle jitter so dashes never
// read uniform. The alpha is lane-masked × uFilAlpha. Each flow samples its big analytic motion twice (phase now,
// and STREAK_DT of clock time earlier); calm zeroes uPhaseRate, so filaments go round. gasLane() is a ridged
// simplex in the flow's own cross-stream labels: lanes of particles travelling with the current, slowly evolving.
// Counts (spec §3e): the fog count is tied to the BASE density (gasFogCount), so the tier multiplier feeds the
// filaments. gasRoles() spreads the fog slots evenly (exact count, deterministic).
// Needs uViewportPx (PLANET_WINDOW_VS) and the flow's snoise(vec3) declared before GAS_STREAK_VS.

import { glf } from '../../gl/glf';

export const STREAK_DT = 1 / 30;
export const FIL_ASPECT = 8;          // filament length cap (× width), author 2026-10-05 (was 3)
export const FIL_JITTER = 0.3;        // ± per-particle length jitter (cap included)
export const FIRE_EMBER_STRETCH = 1.5;
export const FIRE_EMBER_GAIN = 20;    // fire embers: the old 0.006–0.018 alpha was sized for big overlapping discs
export const GAS_PX_FLOOR = 1.5;      // filaments never go sub-pixel (fog keeps its old size, unfloored)
export const GAS_Z_REF = 4.43;        // fitted desktop camera distance (look probe 1600×1000): uFilWidth is px here
export const MASK_EVOLVE = 0.03;
export const FOG_SHARE = 0.25;        // fog share of the particles at GAS_DENSITY_REF
export const GAS_DENSITY_REF = 3;     // = TIERS.full.gasDensity

// Fog particles for a flow whose density is `base` before the tier multiplier and `total` after it.
export function gasFogCount(base, total) {
  return Math.min(total, Math.round(base * FOG_SHARE * GAS_DENSITY_REF));
}

// Per-particle role (0 fog / 1 filament): exactly nFog fog slots, evenly spread (Bresenham), deterministic.
export function gasRoles(count, nFog) {
  const roles = new Float32Array(count);
  for (let i = 0; i < count; i++) roles[i] = Math.floor(((i + 1) * nFog) / count) > Math.floor((i * nFog) / count) ? 0 : 1;
  return roles;
}

export const GAS_STREAK_VS = /* glsl */ `
uniform float uPhaseRate;
uniform float uStreakGain;
uniform float uFilWidth;
uniform float uFilAlpha;
uniform float uFogAlpha;
uniform float uMaskFreq;
uniform float uMaskSharp;
uniform float uMaskDepth;
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
const float STREAK_DT = ${glf(STREAK_DT)};
const float FIL_ASPECT = ${glf(FIL_ASPECT)};
const float FIL_JITTER = ${glf(FIL_JITTER)};
const float FIRE_EMBER_STRETCH = ${glf(FIRE_EMBER_STRETCH)};
const float FIRE_EMBER_GAIN = ${glf(FIRE_EMBER_GAIN)};
const float GAS_PX_FLOOR = ${glf(GAS_PX_FLOOR)};
const float GAS_Z_REF = ${glf(GAS_Z_REF)};
const float MASK_EVOLVE = ${glf(MASK_EVOLVE)};

float gasHash(float a, float b) {
  return fract(sin(a * 91.7 + b * 47.3) * 43758.5453);
}

float gasFilWidth(float depth, float s01, float bite) {
  return uFilWidth * (GAS_Z_REF / max(depth, 0.5)) * mix(0.75, 1.25, s01) * bite;
}

float gasSprite(vec4 clipNow, vec4 clipPrev, float role, float size, float aspectMax, float jit) {
  if (role < 0.5) {
    vStreakDir = vec2(1.0, 0.0);
    vStreakCap = vec2(0.0, 0.5);
    return size;
  }
  float w = max(size, GAS_PX_FLOOR);
  vec2 v = vec2(0.0);
  if (clipNow.w > 1e-4 && clipPrev.w > 1e-4) {
    v = (clipNow.xy / clipNow.w - clipPrev.xy / clipPrev.w) * 0.5 * uViewportPx / STREAK_DT;
  }
  float sp = length(v);
  float L = min(sp * uStreakGain, max(aspectMax - 1.0, 0.0) * w) * (1.0 + FIL_JITTER * (2.0 * jit - 1.0));
  float total = w + L;
  vStreakDir = sp > 1e-3 ? vec2(v.x, -v.y) / sp : vec2(1.0, 0.0);
  vStreakCap = vec2(0.5 * L / total, 0.5 * w / total);
  return total;
}

float gasLane(vec3 laneCoord, float t) {
  float n = snoise(laneCoord * uMaskFreq + vec3(0.0, 0.0, t * MASK_EVOLVE));
  return mix(1.0, pow(max(1.0 - abs(n), 0.0), uMaskSharp), uMaskDepth);
}

float gasAlpha(float role, vec3 laneCoord, float t) {
  if (role < 0.5) return uFogAlpha;
  return gasLane(laneCoord, t) * uFilAlpha;
}

float gasRoleAlpha(float role) {
  return role < 0.5 ? uFogAlpha : uFilAlpha;
}
`;

export const GAS_STREAK_FS = /* glsl */ `
varying vec2 vStreakDir;
varying vec2 vStreakCap;
varying float vLane;
float gasStreakDist(vec2 pc) {
  vec2 q = pc - 0.5;
  float a = clamp(dot(q, vStreakDir), -vStreakCap.x, vStreakCap.x);
  return length(q - vStreakDir * a) / vStreakCap.y;
}
`;

const GAS_TUNE = [['uStreakGain', 'streakGain'], ['uFilWidth', 'filWidth'], ['uFilAlpha', 'filAlpha'],
  ['uFogAlpha', 'fogAlpha'], ['uMaskFreq', 'maskFreq'], ['uMaskSharp', 'maskSharp'], ['uMaskDepth', 'maskDepth']];

export function GAS_TUNE_UNIFORMS(tune) {
  return Object.fromEntries(GAS_TUNE.map(([u, k]) => [u, { value: tune[k] }]));
}

export function writeGasTune(uniforms, tune) {
  for (let i = 0; i < GAS_TUNE.length; i++) uniforms[GAS_TUNE[i][0]].value = tune[GAS_TUNE[i][1]];
}
```

- [ ] **Step 4: `planetLook.js` knobs**

In `PLANET_TUNE`, replace the six gas lines (`streakGain` … `maskDepth`, added by Task 6) with:
```js
  streakGain: 0.03,  // filament shutter (s): length beyond the core = on-screen speed × this; fluid ~355 px/s → ~6× width (mirror-sky spec §3g)
  filWidth: 2.2,     // filament core width, drawing-buffer px at GAS_Z_REF (±25 % per particle, floored at GAS_PX_FLOOR)
  filAlpha: 1,       // filament alpha × this, on the element's own per-particle alpha (fire embers: × FIRE_EMBER_GAIN too)
  fogAlpha: 0.9,     // fog role (the old sprite) alpha × this: "a little dimmer" (body ≈ 0.75 count × 0.9)
  maskFreq: 2.5,     // lane mask frequency in the flows' label space
  maskSharp: 3,      // lane ridge sharpness (higher = thinner filaments)
  maskDepth: 0.7,    // filaments only: 0 = no mask, 1 = everything off-ridge is carved away
```

Run: `npx vitest run src/terminal/mercury/planet/__tests__/gasStreak.test.js` → PASS.

- [ ] **Step 5: Rewrite the flow test (it will fail)**

`src/terminal/mercury/planet/__tests__/flowStreak.test.js` (replace the whole file):
```js
// Gas filaments in each flow (mirror-sky spec §3, Option A: fog + filament roles in one draw). Read from the sources.
import { describe, it, expect } from 'vitest';
import particleSrc from '../../../fluid/ParticleFlow.jsx?raw';
import atmoSrc from '../../../air/AtmosphericFlow.jsx?raw';
import canvasSrc from '../../MercuryCanvas.jsx?raw';

const STREAKED = {
  fluid: {
    src: particleSrc,
    core: 'vec3 knotPos(float ph, out vec3 center) {',
    fogSize: 'float fogSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPosition.z, aRadius, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius));',
  },
  air: {
    src: atmoSrc,
    core: 'vec3 orbitPos(float ph, out float angle) {',
    fogSize: 'float fogSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);',
    filW: 'float filW = gasFilWidth(-mvPos.z, aSize, 1.0 - uCondense * uCondenseSizeBite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aSeed));',
  },
};

describe('gas filaments: two roles in one draw', () => {
  for (const [el, { src, core, fogSize, filW, sprite }] of Object.entries(STREAKED)) {
    it(`${el}: core sampled twice; fog = the old sprite, filament = thin capsule; role alpha; live knobs`, () => {
      expect(src).toContain('${GAS_STREAK_VS}');
      expect(src).toContain('${GAS_STREAK_FS}');
      expect(src.indexOf('${GAS_STREAK_VS}')).toBeGreaterThan(src.indexOf('float snoise('));
      expect(src).toContain(core);
      expect(src).toContain('uPhase - STREAK_DT * uPhaseRate');
      expect(src).toContain('prev *= 1.0 - uCondense * uCondense;');
      expect(src).toContain('attribute float aRole;');
      expect(src).toContain(fogSize);
      expect(src).toContain(filW);
      expect(src).toContain('float size = aRole < 0.5 ? fogSize : filW;');
      expect(src).toContain(sprite);
      expect(src).toContain('vLane = gasAlpha(aRole, ');
      expect(src).toContain('* vLane');
      expect(src).toMatch(/float d = gasStreakDist\(gl_PointCoord\);/);
      expect(src).toContain(`mat.uniforms.uPhaseRate.value = clk.rate.${el};`);
      expect(src).toContain('...GAS_TUNE_UNIFORMS(PLANET_TUNE),');
      expect(src).toContain('writeGasTune(mat.uniforms, PLANET_TUNE);');
      expect(src).toContain('uPhaseRate: { value: 0 },');
      for (const gone of ['uGasSize', 'uGasAlpha', 'STRETCH_MAX', 'gasStreak(']) expect(src).not.toContain(gone);
    });

    it(`${el}: buffers carry the deterministic role split; the geometry remounts when the split changes`, () => {
      expect(src).toContain('fogCount = null,');
      expect(src).toContain('const N_FOG = fogCount ?? Math.round(PARTICLE_COUNT * FOG_SHARE);');
      expect(src).toContain('useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG])');
      expect(src).toContain('function buildBuffers(count, nFog) {');
      expect(src).toContain('roles: gasRoles(count, nFog)');
      expect(src).toContain('<bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>');
      expect(src).toContain('<bufferAttribute attach="attributes-aRole" array={buffers.roles} count={PARTICLE_COUNT} itemSize={1} />');
    });
  }

  it('canvas: the active flow takes the tier multiplier, the fog count follows the base (spec §3e), ghosts unchanged', () => {
    expect(canvasSrc).toContain('const gasBase = params.density ?? (isMobile ? 600 : 1200);');
    expect(canvasSrc).toContain('phase === activePhase ? Math.round(gasBase * TIERS[TIER].gasDensity) : GHOST_DENSITY;');
    expect(canvasSrc).toContain('const fogFor = (phase) => gasFogCount(phase === activePhase ? gasBase : GHOST_DENSITY, densityFor(phase));');
    for (const el of ['fluid', 'thermal', 'earth', 'air']) expect(canvasSrc).toContain(`fogCount={fogFor('${el}')}`);
  });
});
```

Run: `npx vitest run src/terminal/mercury/planet/__tests__/flowStreak.test.js` → FAIL.

- [ ] **Step 6: Retrofit `ParticleFlow.jsx`**

- **Import:** extend the gasStreak import to
  `import { GAS_STREAK_VS, GAS_STREAK_FS, GAS_TUNE_UNIFORMS, writeGasTune, gasRoles, FOG_SHARE } from '../mercury/planet/gasStreak';`.
- **VS attribute:** after `attribute float aOffset;`, add
  `attribute float aRole;   // 0 = fog (the old sprite), 1 = filament (mirror-sky spec §3b)`.
- **VS tail:** replace from `float size = (1.5 + aRadius * 2.0) …` through `aetherLightVS(mvPosition.xyz, size);` with:
```glsl
    // Fog = the old sprite, untouched; filament = a thin capsule (mirror-sky spec §3b/§3c).
    float fogSize = (1.5 + aRadius * 2.0) * (300.0 / -mvPosition.z) * (1.0 - uCondense * uCondenseSizeBite);
    float filW = gasFilWidth(-mvPosition.z, aRadius, 1.0 - uCondense * uCondenseSizeBite);
    float size = aRole < 0.5 ? fogSize : filW;
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aRadius));
    // Fog: × fogAlpha. Filaments: lanes across the tube (its cross-section) and, slowly, along it, × filAlpha.
    float laneA = aOffset * 6.283185307;
    vLane = gasAlpha(aRole, vec3(cos(laneA) * aRadius * 3.0, sin(laneA) * aRadius * 3.0, aPhase * 1.5), uTime);
    planetWindowVS(mvPosition.xyz);
    aetherLightVS(mvPosition.xyz, size);
```
- **FS:** unchanged. It already uses `gasStreakDist` and `* vLane`.
- **`buildBuffers`:**
  - change the signature to `function buildBuffers(count, nFog) {`;
  - change the return to `return { positions, phases, radii, offsets, roles: gasRoles(count, nFog) };`.
- **Component:**
  - add the prop `fogCount = null,` after `density = null,`;
  - after the `PARTICLE_COUNT` line, add
    `const N_FOG = fogCount ?? Math.round(PARTICLE_COUNT * FOG_SHARE); // MercuryCanvas passes the base-tied count (spec §3e)`;
  - change the memo to
    `const buffers = useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG]);`;
  - change the geometry to `<bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>`;
  - add, after the `aOffset` attribute line,
    `<bufferAttribute attach="attributes-aRole" array={buffers.roles} count={PARTICLE_COUNT} itemSize={1} />`.

- [ ] **Step 7: Retrofit `AtmosphericFlow.jsx`**

- **Import:** the same, adding `gasRoles` and `FOG_SHARE`.
- **VS attribute:** after `attribute float aIon` (keep its comment), add
  `attribute float aRole;   // 0 = fog (the old sprite), 1 = filament (mirror-sky spec §3b)`.
- **VS tail:** replace from `float size = baseSize * (260.0 / -mvPos.z) …` through `aetherLightVS(mvPos.xyz, size);` with:
```glsl
    // Fog = the old sprite, untouched; filament = a thin capsule (mirror-sky spec §3b/§3c).
    float fogSize = baseSize * (260.0 / -mvPos.z) * (1.0 - uCondense * uCondenseSizeBite);
    float filW = gasFilWidth(-mvPos.z, aSize, 1.0 - uCondense * uCondenseSizeBite);
    float size = aRole < 0.5 ? fogSize : filW;
    gl_Position  = projectionMatrix * mvPos;
    gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, FIL_ASPECT, gasHash(aPhase, aSeed));
    // Fog: × fogAlpha. Filaments: lanes by altitude layer and ionosphere, slowly along the orbit, × filAlpha.
    vLane = gasAlpha(aRole, vec3(aAlt * 4.0, aIon * 2.0 + aSpeed, aPhase * 1.5), uTime);
    planetWindowVS(mvPos.xyz);
    aetherLightVS(mvPos.xyz, size);
```
- **FS:** unchanged.
- **`buildBuffers(count, nFog)`:** return `{ positions, phases, speeds, seeds, sizes, alts, ions, roles: gasRoles(count, nFog) }`.
- **Component:** add `fogCount = null,`, `N_FOG`, the memo, the geometry key, and an `aRole` attribute line after the
  `aIon` line, exactly as in ParticleFlow.

- [ ] **Step 8: Wire the tier density in `MercuryCanvas.jsx`**

- Import `import { gasFogCount } from './planet/gasStreak';`. `TIERS` and `TIER` are already in scope.
- Replace `densityFor` with:
```js
  // Gas density (mirror-sky spec §3e): the active flow × the tier multiplier; the fog count stays tied to the base,
  // so the multiplier feeds the filament role. Ghosts keep GHOST_DENSITY (same rule, multiplier 1).
  const gasBase = params.density ?? (isMobile ? 600 : 1200);
  const densityFor = (phase) =>
    phase === activePhase ? Math.round(gasBase * TIERS[TIER].gasDensity) : GHOST_DENSITY;
  const fogFor = (phase) => gasFogCount(phase === activePhase ? gasBase : GHOST_DENSITY, densityFor(phase));
```
- Add `fogCount={fogFor('<el>')}` after each flow's `density={densityFor('<el>')}` line, for all four flows.
  - Fire and earth ignore the prop until Task 8, so for now they run old-style at ×3 the count.
  - **Don't judge fire or earth until Task 8.**

- [ ] **Step 9: Run the tests**

- `npx vitest run src/terminal/mercury` → all pass: gasStreak, flowStreak, flowLight (its regex accepts `size`),
  flowClock and planetQuality.
- `npm run lint` → 0 errors, warnings ≤ 143.

- [ ] **Step 10: Commit**

```bash
git add src/terminal/mercury/planet/gasStreak.js src/terminal/mercury/planet/__tests__/gasStreak.test.js src/terminal/mercury/planet/planetLook.js src/terminal/fluid/ParticleFlow.jsx src/terminal/air/AtmosphericFlow.jsx src/terminal/mercury/MercuryCanvas.jsx src/terminal/mercury/planet/__tests__/flowStreak.test.js
git commit -m "feat(mercury): gas Option A — fog + filament roles in one draw (fluid, air); 8x jittered thin filaments, base-tied fog count, tier gas density

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11 (controller): live compile + the look sheet. Look first, then theorise.**

Dev server preview `scale94-dev-5175`.

**1. Rewrite the probe.** Replace `.superpowers/sdd/tools/ms-look.mjs` (controller scratch; never staged) with the
role-variant probe below. Its tiles are **1:1 crops**. A 2 px filament vanishes when a 900 px shot is resized to
450, and the Task 7 sheet was resized.

```js
// Gas look, Option A (plan Task 7b/8): role variants per element as 1:1 crops + an overview; role-count readback.
// node ms-look.mjs [tag] [elements=fluid,air]
import sharp from 'sharp';
import { openMercury, OUT, sleep } from './openMercury.mjs';
const { launch } = await import(new URL('file:///F:/scale_9.4/scripts/cdp.mjs'));
const TAG = process.argv[2] ?? 'b';
const ELS = (process.argv[3] ?? 'fluid,air').split(',');
const page = await launch({ url: 'about:blank', width: 1600, height: 1000 });
const log = [];
const switchTo = (phase) => page.eval(`(() => { const b = [...document.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label').endsWith('switch to ${phase} phase')); b.click(); return 1; })()`);
const DEF = { fogAlpha: 0.9, filWidth: 2.2, filAlpha: 1, streakGain: 0.03, maskFreq: 2.5, maskSharp: 3, maskDepth: 0.7 };
const VARIANTS = [
  ['default', {}],
  ['fog-only', { filAlpha: 0 }],
  ['fil-only', { fogAlpha: 0 }],
  ['thin-long', { filWidth: 1.6, streakGain: 0.05 }],
  ['bold', { filWidth: 3, filAlpha: 1.5 }],
  ['deep-lanes', { maskDepth: 0.9, maskSharp: 4 }],
];
// role counts per flow: fluid/air/earth carry aRole, fire carries aEmber (its role); opacity tells active vs ghost
const roles = () => page.eval(`(() => { const out = []; window.__mercury.scene.traverse((o) => { const g = o.geometry && o.geometry.attributes; const a = g && (g.aRole || g.aEmber); const u = o.material && o.material.uniforms; if (a && u && u.uOpacity) { let fog = 0; for (let i = 0; i < a.count; i++) if (a.array[i] === 0) fog++; out.push({ attr: g.aRole ? 'aRole' : 'aEmber', n: a.count, fog, op: +u.uOpacity.value.toFixed(2) }); } }); return out; })()`);
const SHOT = 900, CROP = 450;
try {
  const m = await openMercury(page);
  await sleep(1500);
  log.push({ cam: await page.eval(`(() => { const c = window.__mercury.camera; return { z: +c.position.length().toFixed(2), dpr: window.devicePixelRatio, bufH: window.__mercury.gl.domElement.height }; })()`) });
  const rows = [];
  for (const el of ELS) {
    await switchTo(el); await sleep(2500);
    // REFREEZE TRAP: the melted planet refreezes in ~30-60 s of probing. Melt per element and shoot right after,
    // logging uTau per element, so the mirror under the gas is the liquid one the author will judge.
    await m.melt(25); await sleep(9000);
    log.push({ el, st: await m.st(), roles: await roles() });
    const row = [];
    for (const [name, v] of VARIANTS) {
      await page.eval(`Object.assign(window.__mercuryTune.planet, ${JSON.stringify({ ...DEF, ...v })}); 1`); await sleep(700);
      const p = `${OUT}/ms-look-${TAG}-${el}-${name}.png`; await m.shot(p, SHOT);
      // 1:1 crop: the right-middle of the frame (the planet's limb + the gas beside it)
      const c = `${OUT}/ms-look-${TAG}-${el}-${name}-crop.png`;
      await sharp(p).extract({ left: SHOT - CROP, top: (SHOT - CROP) >> 1, width: CROP, height: CROP }).toFile(c);
      row.push(name === 'default' ? [p, c] : [c]);
    }
    log.push({ el, tauEnd: (await m.st()).tau });
    rows.push(row.flat());
  }
  await page.eval(`Object.assign(window.__mercuryTune.planet, ${JSON.stringify(DEF)}); 1`);
  const cols = 1 + VARIANTS.length; // overview (resized) + the 1:1 crops
  const tiles = [];
  for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r].length; k++) {
    tiles.push({ input: await sharp(rows[r][k]).resize(CROP, CROP).toBuffer(), left: k * CROP, top: r * CROP });
  }
  await sharp({ create: { width: cols * CROP, height: rows.length * CROP, channels: 3, background: '#000' } })
    .composite(tiles).png().toFile(`${OUT}/ms-look-${TAG}-sheet.png`);
  log.push({ errors: await m.errors() });
} catch (e) { log.push({ FAIL: e.message }); } finally { console.log(JSON.stringify(log)); await page.close(); process.exit(0); }
```

**2. Run it:** `node .superpowers/sdd/tools/ms-look.mjs b fluid,air`.

**3. Pass criteria.**
- `errors` → `[]`.
- **Role readback** (desktop, density 1200): the active flow has `n` 3600 and `fog` 900; each ghost has `n` 300
  and `fog` 225.
- `st.tau` is liquid at the start of each element. If `tauEnd` shows crust, re-run that element.

**4. View the images before claiming anything.** Do this before any theory:
- the sheet `ms-look-b-sheet.png`;
- **each `-default-crop.png` at full size**.

The author's bar:
- **Fog body.** A soft continuous body, similar to the old look and a little dimmer (compare with `fog-only`).
- **Threads.** Thin threads read *inside* it, following the knot and the orbit.
- **Never:**
  - opaque blobs or white pills (the Task 7 failure);
  - dashed confetti tracks or a vector-field plot (the rejected B: compare with `fil-only`);
  - uniform dash lengths (the jitter must show).

**5. If the defaults miss,** tune live through `window.__mercuryTune.planet` and re-run with a new tag:
- the fog/filament balance via `fogAlpha` / `filAlpha`;
- the thread weight via `filWidth`;
- the dash length via `streakGain`;
- the threads-vs-confetti read via `maskDepth` / `maskSharp`.

Change one knob family at a time. When a set reads right, write it into `PLANET_TUNE` **and** the `toMatchObject`
line of `gasStreak.test.js`, re-run the mercury suite, and commit
`fix(mercury): gas look defaults from the Option A contact sheet (<knob=value, …>)`.

**6. Record** in the ledger: the px numbers the probe logged (z, DPR, bufH), the role counts, the defaults kept or
changed, and the sheet path.
- If DPR ≠ 1, note it. The px targets are drawing-buffer px, so on a DPR-2 panel the filament core is ~half as
  wide in CSS px (spec §3g DPR note: an author call).

**7. Hand the sheet to the author** before Task 8: Option A's look is theirs to rule.

---

### Task 8: Fire (flame-body fog + embers) and earth (dust fog + settling streaks) on the two-role scheme

**Files:**
- Modify: `src/terminal/thermal/ThermalFlow.jsx`, `src/terminal/earth/SedimentFlow.jsx`
- Modify: `src/terminal/mercury/planet/__tests__/flowStreak.test.js`, `src/terminal/mercury/planet/__tests__/flowClock.test.js`

**Interfaces:**
- **Consumes:**
  - from Task 7b: the chunk (`gasSprite`, `gasFilWidth`, `gasHash`, `gasAlpha`, `gasRoleAlpha`, `FIRE_EMBER_STRETCH`,
    `FIRE_EMBER_GAIN`, `FIL_ASPECT`, `gasRoles`, `FOG_SHARE`);
  - the `fogCount` prop, which `MercuryCanvas` already passes;
  - from Task 2: `clk` and `uPhase`.
- **Fire (spec §3f).**
  - The role attribute **is** `aEmber`: fog = flame body (0), filament = ember (1). It is built by `gasRoles`,
    replacing the random 15 % ember draw.
  - Body: the old flame sprite, round, unmasked, × `fogAlpha`.
  - Embers: small round dots, width `gasFilWidth(depth, aSize, bite · sizeFactor)`, ≤ `FIRE_EMBER_STRETCH`, no
    lane, alpha × `filAlpha` × `FIRE_EMBER_GAIN`.
- **Earth.**
  - `aRole`: fog = the old dust sprite.
  - Filament = fine settling streaks: the §3c capsule (`FIL_ASPECT`), lane-masked by spawn direction and mass, no
    streak across a sink or life respawn.

**Open author call (do not resolve silently).** The §3e count rule, applied to fire, makes the full tier 900 body +
2700 embers (old: ~1020 body + ~180 embers), a ~15× ember count. It follows from decisions 3 + 4 taken together.
- Step 7 shows it on the sheet.
- If the author wants fewer embers, the escape hatch is a fire-only fog count: for example `fogFor('thermal')` =
  N × 0.85 (embers 15 %).
- That is a one-line canvas change plus its test, applied only on the author's word.

- [ ] **Step 1: Extend the test (it will fail)**

In `flowStreak.test.js`:
- add the imports `import thermalSrc from '../../../thermal/ThermalFlow.jsx?raw';` and
  `import sedimentSrc from '../../../earth/SedimentFlow.jsx?raw';`;
- add to `STREAKED`:
```js
  earth: {
    src: sedimentSrc,
    core: 'vec3 sedimentPos(float ph, out float age, out float sinkOffset) {',
    fogSize: 'float fogSize = baseSize * ageFactor * (280.0 / -mvPos.z) * bite;',
    filW: 'float filW = gasFilWidth(-mvPos.z, aSize, bite);',
    sprite: 'gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, sedStretch, gasHash(aPhase, aSeed));',
  },
```
Then add:
```js
describe('earth (spec §3f): settling streaks', () => {
  it('no streak across a sink or life respawn', () => {
    expect(sedimentSrc).toContain('float sedStretch = (agePrev > age || sinkPrev > sinkOffset) ? 1.0 : FIL_ASPECT;');
    expect(sedimentSrc).toContain('vLane = gasAlpha(aRole, vec3(sin(theta) * cos(phi) * 2.0, cos(theta) * 2.0, aMass * 2.0), uTime);');
  });
});

describe('fire (spec §3f): fog = the flame body, filament = embers only', () => {
  it('core sampled twice; the role IS aEmber, built by gasRoles (no random ember draw)', () => {
    expect(thermalSrc).toContain('${GAS_STREAK_VS}');
    expect(thermalSrc).toContain('${GAS_STREAK_FS}');
    expect(thermalSrc.indexOf('${GAS_STREAK_VS}')).toBeGreaterThan(thermalSrc.indexOf('float snoise('));
    expect(thermalSrc).toContain('vec3 flamePos(float ph, out float age) {');
    expect(thermalSrc).toContain('uPhase - STREAK_DT * uPhaseRate');
    expect(thermalSrc).toContain('prev *= 1.0 - uCondense * uCondense;');
    expect(thermalSrc).toContain('function buildBuffers(count, nFog) {');
    expect(thermalSrc).toContain('const embers    = gasRoles(count, nFog);');
    for (const gone of ['emberCutoff', 'emberShrink', 'attribute float aRole;', 'uGasSize', 'STRETCH_MAX']) expect(thermalSrc).not.toContain(gone);
  });

  it('body: the old flame sprite; embers: small round dots ≤ 1.5x, never across a respawn, unmasked, boosted', () => {
    expect(thermalSrc).toContain('float fogSize = min(baseSize * sizeFactor * (80.0 / depth), uPointSizeMax) * bite;');
    expect(thermalSrc).toContain('float filW = gasFilWidth(depth, aSize, bite * sizeFactor);');
    expect(thermalSrc).toContain('float size = aEmber < 0.5 ? fogSize : filW;');
    expect(thermalSrc).toContain('float emberStretch = agePrev > age ? 1.0 : FIRE_EMBER_STRETCH;');
    expect(thermalSrc).toContain('gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aEmber, size, emberStretch, 0.5);');
    expect(thermalSrc).toContain('vLane = gasRoleAlpha(aEmber) * mix(1.0, FIRE_EMBER_GAIN, aEmber);');
    expect(thermalSrc).not.toContain('gasLane(');
    expect(thermalSrc).not.toContain('gasAlpha(');
    expect(thermalSrc).toMatch(/float d\s*= gasStreakDist\(pc\);/);
    expect(thermalSrc).toContain('(finalAlpha * uOpacity * vLane)');
  });

  it('fire: live knobs, fog count, remount key', () => {
    expect(thermalSrc).toContain('mat.uniforms.uPhaseRate.value = clk.rate.thermal;');
    expect(thermalSrc).toContain('...GAS_TUNE_UNIFORMS(PLANET_TUNE),');
    expect(thermalSrc).toContain('writeGasTune(mat.uniforms, PLANET_TUNE);');
    expect(thermalSrc).toContain('uPhaseRate: { value: 0 },');
    expect(thermalSrc).toContain('fogCount = null,');
    expect(thermalSrc).toContain('const N_FOG = fogCount ?? Math.round(PARTICLE_COUNT * FOG_SHARE);');
    expect(thermalSrc).toContain('useMemo(() => buildBuffers(PARTICLE_COUNT, N_FOG), [PARTICLE_COUNT, N_FOG])');
    expect(thermalSrc).toContain('<bufferGeometry key={`${PARTICLE_COUNT}:${N_FOG}`}>');
  });
});
```
In `flowClock.test.js`, the life and sink phases now read the core function's argument:
- change `'fract(aPhase + uPhase * lifeMult)'` to `'fract(aPhase + ph * lifeMult)'`;
- change `'fract(aPhase + uPhase * sinkRate * 0.4)'` to `'fract(aPhase + ph * sinkRate * 0.4)'`;
- leave the other lines unchanged.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/terminal/mercury/planet/__tests__/flowStreak.test.js src/terminal/mercury/planet/__tests__/flowClock.test.js` → FAIL (thermal/earth).

- [ ] **Step 3: Implement `ThermalFlow.jsx`**

- **Imports:**
  - `import { R_SCENE, PLANET_TUNE } from '../mercury/planet/planetLook';` (fire didn't import `PLANET_TUNE`);
  - `import { GAS_STREAK_VS, GAS_STREAK_FS, GAS_TUNE_UNIFORMS, writeGasTune, gasRoles, FOG_SHARE } from '../mercury/planet/gasStreak';`.
- **VS:**
  - change the `aEmber` attribute comment to `// role: 0 = flame body (fog), 1 = ember (filament) — mirror-sky spec §3f`;
  - insert `${GAS_STREAK_VS}` on its own line right before `void main(){`, after `snoise` and `curlNoise`;
  - replace the `main` start, from `void main(){` through the `vec3 pos = vec3( … );` construction, with:
```glsl
  // The flame's own motion alone (rise, taper, ember escape) at life phase ph; age out (respawn guard).
  vec3 flamePos(float ph, out float age) {
    // Per-particle lifecycle: age 0 = newborn at base, 1 = ash at tip
    float lifeMult = 0.4 + aSpeed * 0.6;
    age = fract(aPhase + ph * lifeMult);
    // ── Spawn: uniform disk via sqrt for even area distribution ─────────
    float spawnR     = sqrt(aSeed) * uFlameWidth;
    float spawnAngle = fract(aSeed * 6.3791 + 0.17) * 6.28318;
    float sx = spawnR * cos(spawnAngle);
    float sz = spawnR * sin(spawnAngle);
    // ── Flame particles: rise with tapering cone shape; embers drift sideways, escaping the cone ──
    float riseSpeed  = mix(2.4, 3.5, aTemp);   // hot particles rise faster
    float riseY      = age * riseSpeed;
    float taper      = max(0.0, 1.0 - age * 1.35);  // cone narrows to a tip
    float emberDrift = aEmber * age * 1.8;
    // Ember lateral escape direction encoded in aSeed
    float escapeAngle = fract(aSeed * 9.137 + 0.43) * 6.28318;
    return vec3(sx * taper + cos(escapeAngle) * emberDrift, -1.1 + riseY, sz * taper + sin(escapeAngle) * emberDrift);
  }

  void main(){
    float age, agePrev;
    vec3 core = flamePos(uPhase, age);
    vec3 prevCore = flamePos(uPhase - STREAK_DT * uPhaseRate, agePrev);
    vAge = age;
    float spawnR = sqrt(aSeed) * uFlameWidth;   // the temperature block's coreProx reads it
    vec3 pos = core;
```
- **Keep unchanged:** the turbulence, shimmer, temperature and alpha blocks. They read `pos`, `age`, `spawnR`,
  `aTemp` and `aEmber`. If one reads another local that moved into `flamePos`, redeclare it in `main` from the same
  expression.
- After the shimmer block, add `vec3 prev = prevCore + (pos - core); // the streak shows the current, not the turbulence`.
- Delete the line `float emberShrink = mix(1.0, 0.5, aEmber);` and its comment line. Body particles are the fog
  role (aEmber 0, where the shrink was 1), and embers take the filament width.
- Replace the tail, from `// Nebula condensation` through `planetWindowVS(mvPos.xyz);`, with:
```glsl
    // Nebula condensation — see ParticleFlow.jsx for the physics note.
    pos *= 1.0 - uCondense * uCondense;
    prev *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vec4 mvPrev = modelViewMatrix * vec4(prev, 1.0);
    float depth  = max(-mvPos.z, 0.5);
    float bite = 1.0 - uCondense * uCondenseSizeBite;
    // Fog = the old flame-body sprite; embers = small round dots that shrink with age (mirror-sky spec §3f).
    float fogSize = min(baseSize * sizeFactor * (80.0 / depth), uPointSizeMax) * bite;
    float filW = gasFilWidth(depth, aSize, bite * sizeFactor);
    float size = aEmber < 0.5 ? fogSize : filW;
    gl_Position  = projectionMatrix * mvPos;
    // Embers stretch ≤ 1.5x (jitter pinned at 0.5 so the cap is exact), never across a respawn.
    float emberStretch = agePrev > age ? 1.0 : FIRE_EMBER_STRETCH;
    gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aEmber, size, emberStretch, 0.5);
    // No lane mask on fire: body × fogAlpha; embers × filAlpha × FIRE_EMBER_GAIN (the old alpha was sized for big discs).
    vLane = gasRoleAlpha(aEmber) * mix(1.0, FIRE_EMBER_GAIN, aEmber);
    planetWindowVS(mvPos.xyz);
```
- **FS:**
  - insert `${GAS_STREAK_FS}` after `${PLANET_WINDOW_FS}`;
  - replace `float d     = length(pc - 0.5) * 2.0;` with `float d     = gasStreakDist(pc);`;
  - change the output to `gl_FragColor = vec4(col, (finalAlpha * uOpacity * vLane) * planetWindow() + dither);`.
- **`buildBuffers`:**
  - change it to `function buildBuffers(count, nFog) {`;
  - delete `const emberCutoff = 0.85;` with its comment, `const embers    = new Float32Array(count);`,
    `const r = Math.random();` and `embers[i]  = r > emberCutoff ? 1.0 : 0.0;`;
  - after the other array declarations, add
    `const embers    = gasRoles(count, nFog);   // the filament role IS the ember (mirror-sky spec §3f; was a random 15 %)`;
  - the return object stays as is.
- **Component:**
  - add the prop `fogCount = null,`, `N_FOG`, the memo and the geometry key exactly as in ParticleFlow (Task 7b
    Step 6);
  - the uniforms object gets `uPhaseRate: { value: 0 },` and `...GAS_TUNE_UNIFORMS(PLANET_TUNE),`;
  - in useFrame, after the `uPhase` line, add `mat.uniforms.uPhaseRate.value = clk.rate.thermal;` and
    `writeGasTune(mat.uniforms, PLANET_TUNE);`.

- [ ] **Step 4: Implement `SedimentFlow.jsx`**

- **Import:** `import { GAS_STREAK_VS, GAS_STREAK_FS, GAS_TUNE_UNIFORMS, writeGasTune, gasRoles, FOG_SHARE } from '../mercury/planet/gasStreak';`.
- **VS:**
  - add `attribute float aRole;    // 0 = fog (the old dust sprite), 1 = settling streak (mirror-sky spec §3f)` after `aErupt`;
  - insert `${GAS_STREAK_VS}` right before `void main(){`;
  - replace from the `main` start through `pos = mix(pos, eruptPos, aErupt);` with:
```glsl
  // The sediment's own motion alone (sink, eruption arc) at phase ph; age and sinkOffset out (respawn guard).
  vec3 sedimentPos(float ph, out float age, out float sinkOffset) {
    // Per-particle lifecycle
    float lifeMult = 0.5 + aSpeed * 0.5;
    age = fract(aPhase + ph * lifeMult);
    // Spawn on sphere surface (uniform distribution via spherical coords)
    float theta  = fract(aSeed * 3.9301) * 3.14159;
    float phi    = fract(aSeed * 7.1731) * 6.28318;
    vec3 spawnPos = vec3(sin(theta) * cos(phi) * 1.1, cos(theta) * 1.1, sin(theta) * sin(phi) * 1.1);
    // ── Sediment particles: drift toward base under mass ─────────────────
    // Heavy particles sink faster; light ones stay higher
    float sinkRate   = aMass * 2.2;
    sinkOffset = fract(aPhase + ph * sinkRate * 0.4);
    // Y oscillates from spawn height downward, then resets
    vec3 pos = vec3(spawnPos.x, spawnPos.y - sinkOffset * 2.4, spawnPos.z);
    // ── Eruption particles: shoot upward then arc back ───────────────────
    float eruptY   = -1.2 + sin(age * 3.14159) * 2.5 * uEruptStrength;
    float eruptR   = fract(aSeed * 5.713) * 0.5;
    float eruptAng = fract(aSeed * 2.391) * 6.28318;
    vec3 eruptPos  = vec3(cos(eruptAng)*eruptR, eruptY, sin(eruptAng)*eruptR);
    return mix(pos, eruptPos, aErupt);
  }

  void main(){
    float age, agePrev, sinkOffset, sinkPrev;
    vec3 core = sedimentPos(uPhase, age, sinkOffset);
    vec3 prevCore = sedimentPos(uPhase - STREAK_DT * uPhaseRate, agePrev, sinkPrev);
    vec3 pos = core;
    float theta = fract(aSeed * 3.9301) * 3.14159;
    float phi   = fract(aSeed * 7.1731) * 6.28318;
```
- **Keep unchanged:** the turbulence, shimmer, strata and alpha blocks.
  - If any of them reads a local that moved into `sedimentPos` (`spawnPos`, `sinkRate`, `eruptPos`), redeclare that
    local in `main` from the same expression. Don't change the expression.
  - Add `vec3 prev = prevCore + (pos - core);` after the shimmer.
- **Tail:** replace from `// Nebula condensation` through `aetherLightVS(mvPos.xyz, gl_PointSize);` with:
```glsl
    // Nebula condensation — see ParticleFlow.jsx for the physics note.
    pos *= 1.0 - uCondense * uCondense;
    prev *= 1.0 - uCondense * uCondense;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    vec4 mvPrev = modelViewMatrix * vec4(prev, 1.0);
    float bite = 1.0 - uCondense * uCondenseSizeBite;
    // Fog = the old dust sprite, untouched; filament = a fine settling streak (mirror-sky spec §3f).
    float fogSize = baseSize * ageFactor * (280.0 / -mvPos.z) * bite;
    float filW = gasFilWidth(-mvPos.z, aSize, bite);
    float size = aRole < 0.5 ? fogSize : filW;
    gl_Position  = projectionMatrix * mvPos;
    float sedStretch = (agePrev > age || sinkPrev > sinkOffset) ? 1.0 : FIL_ASPECT;
    gl_PointSize = gasSprite(gl_Position, projectionMatrix * mvPrev, aRole, size, sedStretch, gasHash(aPhase, aSeed));
    // Fog: × fogAlpha. Filaments: lanes by spawn direction and mass (strata of dust), × filAlpha.
    vLane = gasAlpha(aRole, vec3(sin(theta) * cos(phi) * 2.0, cos(theta) * 2.0, aMass * 2.0), uTime);
    planetWindowVS(mvPos.xyz);
    aetherLightVS(mvPos.xyz, size);
```
- **FS:**
  - insert `${GAS_STREAK_FS}` after `${aetherLightFS('earth')}`;
  - replace `float d = length(gl_PointCoord - 0.5) * 2.0;` with `float d = gasStreakDist(gl_PointCoord);`;
  - change the output to `gl_FragColor = vec4(col, (alpha * vAlpha * (0.5 + (1.0 - vStrata) * 0.4) * uOpacity * vLane) * planetWindow() + dither);`.
- **`buildBuffers(count, nFog)`:** add `roles: gasRoles(count, nFog)` to the return.
- **Component:**
  - add `fogCount = null,`, `N_FOG`, the memo, the geometry key, and the `aRole` attribute line, as in ParticleFlow;
  - the uniforms get `uPhaseRate: { value: 0 },` and `...GAS_TUNE_UNIFORMS(PLANET_TUNE),` (`PLANET_TUNE` is
    already imported);
  - useFrame gets `mat.uniforms.uPhaseRate.value = clk.rate.earth;` and `writeGasTune(mat.uniforms, PLANET_TUNE);`.

- [ ] **Step 5: Run everything**

- `npx vitest run src/terminal/mercury` → all pass.
- `npm run lint` → 0 errors, warnings ≤ 143. Check `no-unused-vars` on the removed fire `r`.
- `npx vitest run` (full suite) → only the known `artComposite compositeDpr` failure.

- [ ] **Step 6: Commit**

```bash
git add src/terminal/thermal/ThermalFlow.jsx src/terminal/earth/SedimentFlow.jsx src/terminal/mercury/planet/__tests__/flowStreak.test.js src/terminal/mercury/planet/__tests__/flowClock.test.js
git commit -m "feat(mercury): fire + earth on the two-role gas — flame-body fog + round embers (≤1.5x, unmasked), dust fog + settling streaks; no streak across respawns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7 (controller): live compile + look**

**1. Run the probe:** `node .superpowers/sdd/tools/ms-look.mjs c thermal,earth`. For fire, add to `VARIANTS` for
this run:
- `['embers-dim', { filAlpha: 0.3 }]`;
- `['body-full', { fogAlpha: 1 }]`.

**2. Pass criteria.**
- `errors` → `[]`.
- Fire role readback (`attr` aEmber): active `n` 3600, `fog` 900.
- Earth (`attr` aRole): active `n` 3600, `fog` 900.

**3. View every default crop at full size.**
- **Fire:** the body reads as the old flame, a little dimmer, and the embers are small round sparks. Nothing is
  stretched beyond 1.5×, and no lanes are visible in the fire.
- **Earth:** dust with fine settling streaks, and the eruption arcs visibly longer. If the earth streaks read as
  round dots (expected aspect ~1.5×), report it. A per-flow gain is the escape hatch; don't add one unasked.

**4. Hand the fire sheet to the author with the ember-count question.** Under the §3e rule fire has 900 body +
2700 embers, against the old ~1020 + ~180. Show `embers-dim` beside `default`.

---

### Task 9 (controller): live checks, frame time, phone gate, gates

No implementer subagent: the controller runs CDP against preview `scale94-dev-5175`.

- [ ] **Step 1: Compile everywhere.** Probe `ms-flows.mjs t9`, extended or run alongside `ms-sky.mjs`:
  - all four elements active in turn, a strike (`__mercuryTune.strike('fluid')`) and a fling (`breakNow(12)`);
  - `errors()` → `[]` after each.
- [ ] **Step 2: Role counts.** With the `roles()` readback from `ms-look.mjs`, for each element active in turn:
  - the active flow has N = 3600 and fog = 900 (desktop);
  - each ghost has 300 / 225;
  - with `?tier=lite` (or the tier override the HUD uses), the active flow has 1200 / 900.
- [ ] **Step 3: Look sheet, all four.**
  - Run `node .superpowers/sdd/tools/ms-look.mjs d fluid,thermal,earth,air` and view the sheet plus every default crop.
  - **Lanes evolve, never a lattice:** take two default shots per element 3 s apart. The crop's mean abs diff
    must be > 0. Eyeball both: the threads move with the flow, with no fixed bands.
- [ ] **Step 4: Calm.**
  - Reload with `?calm=1` and take two shots 1 s apart per element: the gas crop diff is 0. The only allowed
    residue is the pre-existing node handles and thread line.
  - At 3× zoom, the filaments are round dots (`L` = 0) and the mirror sky is frozen.
- [ ] **Step 5: Cross-fade.**
  - Switch fluid → air, with shots at 0, 100, 300, 500, 700 and 900 ms.
  - `uSkyW` has ≤ 2 non-zero weights and is monotone. The gas cross-fades with no pop.
  - **Watch the switch frame:** `densityFor` changes both flows' counts at the switch (active 3600 ↔ ghost 300),
    so their geometries remount with fresh random attributes. This is pre-existing, but now 12× the jump. If a pop
    is visible, record it for the final review; don't fix it here.
- [ ] **Step 6: Frame time, desktop, against `ac8fa425`.**
  - **Baseline worktree:**
    - `git worktree add ../ms-base ac8fa425`, then `cmd /c mklink /J ..\ms-base\node_modules node_modules` (or
      `npm ci` there);
    - start `npx vite --port 5176 --strictPort` in it.
  - **Measure:** `?hud=1` / `window.__mercuryPerf`, p50/p95 over 10 s per element, same window size, both servers,
    one at a time.
  - **Record** the numbers. There is no hard desktop gate, but flag p50 > +2 ms.
  - **Clean up:** remove the worktree (`git worktree remove ../ms-base --force`) and delete the junction first if
    one was made.
- [ ] **Step 7: Phone gate. It decides `TIERS.phone.gasDensity`.**
  - Use the CDP phone profile (the existing phone probe recipe) on both servers, p50/p95 per element at
    `gasDensity` 3.
  - **If phone p50 regresses > 2 ms** against the baseline:
    - set `TIERS.phone.gasDensity = 2` in `src/terminal/mercury/planet/planetQuality.js`. `planetQuality.test.js`
      already allows 2–3, so no test edit is needed;
    - re-measure and record both;
    - commit `perf(mercury): phone gas density 2 (phone gate: p50 <a> → <b> ms)`.
    - Under §3e the phone fog stays 450, and the filaments drop from 1350 to 750.
  - **If it is still over at 2,** stop and report. The spec §2 sky fallbacks (water warp 3 → 2 fbm, then
    `skyOctaves`) are a separate fix task.
  - The author's hardware check is an open call; don't claim it.
- [ ] **Step 8: Snapshot discipline.**
  - Tasks 7b and 8 touch no `aetherSky.js` or `hgMirrorGlsl.js` code, so no planet snapshot may change. If the
    mercury suite reports a snapshot diff, STOP: a shared chunk changed.
  - If a re-pin is genuinely intended, use the handover recipe:
    1. `-u` the full snapshot;
    2. `git diff` it into a patch written to `$TEMP` (never `../`);
    3. `patch` both `pre-*.fs.glsl` files; a reject means stop;
    4. delete the `.orig` files.
- [ ] **Step 9: Gates.**
  - `npm run lint`: 0 errors, warnings ≤ 143 (137 at 39cd6d94; record the count).
  - `npx vitest run src/terminal/mercury`: all pass (record the count; 733 + 2 skipped at 39cd6d94, plus the new
    tests).
  - `npx vitest run`: only the known `artComposite compositeDpr` failure.
- [ ] **Step 10: Ledger.** Record Steps 1–9 in `.superpowers/sdd/progress.md` under `## Mirror sky + gas filaments`:
  numbers, sheet paths, the phone decision and the gate counts.
- [ ] **Step 11: Final whole-branch review (controller-run, not an implementer step).** The reviewer must triage:
  - every Minor listed in the ledger section;
  - float precision of the unbounded sky phases and the flows' `uPhase` over installation uptime;
  - the earth ping cadence (~3.45 concurrent vs the approved 1–2; knob `SKY_PING_EXP`);
  - the truth-bound pace shift (spec §5 table);
  - air streamline contrast in the ±0.12 equatorial cross-fade;
  - fire's ember count (Task 8 author call);
  - `filWidth` vs DPR (spec §3g);
  - the phase-switch geometry remount (Step 5);
  - the phone hardware check (the author's);
  - the stray `F:\ms-aether.patch` / `F:\ms-air.patch` outside the repo.
- [ ] **Step 12: Report to the author.**
  - The look-round knobs: `aetherGain`, `aetherSilver`, `streakGain`, `filWidth` / `filAlpha` / `fogAlpha`,
    `maskDepth` / `maskSharp` / `maskFreq`, and the truth-bound pace shift (spec §5 table).
  - The sheets.
  - The open calls above.
  - **NOT pushed.**
