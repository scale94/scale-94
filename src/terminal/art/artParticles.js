// artParticles.js — Particle Ecology subsystem for ArtTab
// Lightweight SoA particle pool: edge energy flow, node bursts, bifurcation trails.
//
// Draws from the sphere's OWN stream, not Math.random. Every value here shapes
// a particle, and particles are the layer with the most to lose from a stream
// something else is also drawing on — see artRandom.js.
import { artRandom } from './artRandom.js';
import { decayOverFrames, driftOverFrames } from './artRateGate.js';

export const MAX_PARTICLES = 400;

// ── Particle pool — flat SoA layout, ring-buffer allocation ─────────────────
// Each particle has: position (x,y,z on unit sphere), velocity (vx,vy,vz),
// life (0→maxLife frames), hue (0-360), sat (0-100), size (px), and a
// hueTarget for smooth in-flight color blending.

export function createParticlePool() {
  return {
    xs:        new Float32Array(MAX_PARTICLES),
    ys:        new Float32Array(MAX_PARTICLES),
    zs:        new Float32Array(MAX_PARTICLES),
    vxs:       new Float32Array(MAX_PARTICLES),
    vys:       new Float32Array(MAX_PARTICLES),
    vzs:       new Float32Array(MAX_PARTICLES),
    lifes:     new Float32Array(MAX_PARTICLES),   // current age (frames)
    maxLifes:  new Float32Array(MAX_PARTICLES),   // total lifespan
    hues:      new Float32Array(MAX_PARTICLES),   // current hue
    hueTargets:new Float32Array(MAX_PARTICLES),   // blend destination hue
    sats:      new Float32Array(MAX_PARTICLES),   // saturation
    sizes:     new Float32Array(MAX_PARTICLES),   // base radius (px)
    txs:       new Float32Array(MAX_PARTICLES),   // target x — the node it flies to
    tys:       new Float32Array(MAX_PARTICLES),
    tzs:       new Float32Array(MAX_PARTICLES),
    pulls:     new Float32Array(MAX_PARTICLES),   // 0 = no target, 1 = full rate
    pxs:       new Float32Array(MAX_PARTICLES),   // position at the END of the
    pys:       new Float32Array(MAX_PARTICLES),   // previous step — the streak's
    pzs:       new Float32Array(MAX_PARTICLES),   // tail anchor
    next: 0,   // ring write head
    count: 0,  // live count
    // DEV INSTRUMENT, monotonic and never read by the artwork. `next` is a ring
    // head that wraps every MAX_PARTICLES writes, so it cannot answer "how many
    // particles were emitted in this window" — which is the only question that
    // falsifies an emission rate. __artCadenceState is its sole reader.
    emitted: 0,
  };
}

export function emitParticle(pool, x, y, z, vx, vy, vz, hue, hueTarget, sat, size, maxLife,
                             tx = 0, ty = 0, tz = 0, pull = 0) {
  const i = pool.next % MAX_PARTICLES;
  pool.next = (i + 1) % MAX_PARTICLES;
  pool.xs[i] = x;   pool.ys[i] = y;   pool.zs[i] = z;
  pool.vxs[i] = vx; pool.vys[i] = vy; pool.vzs[i] = vz;
  // Seeded to the current position, not left at whatever the slot's previous
  // occupant wrote: a newborn's streak is zero-length, which takes the disc
  // fallback on its first frame (see streakTail's degenerate branch).
  pool.pxs[i] = x; pool.pys[i] = y; pool.pzs[i] = z;
  pool.lifes[i] = 0;
  pool.maxLifes[i] = maxLife;
  pool.hues[i] = hue;
  pool.hueTargets[i] = hueTarget;
  pool.sats[i] = sat;
  pool.sizes[i] = size;
  pool.txs[i] = tx; pool.tys[i] = ty; pool.tzs[i] = tz;
  pool.pulls[i] = pull;
  pool.count = Math.min(pool.count + 1, MAX_PARTICLES);
  pool.emitted++;      // DEV instrument only — see createParticlePool
}

// ── The integrator's per-frame constants, as they shipped ───────────────────
//
// Both are exported because the tests assert the dt=1 case against them rather
// than against re-typed literals: the whole point of the conversion is that one
// authored frame is untouched, and a second copy of 0.964 is a second thing to
// be wrong.
export const PARTICLE_DRAG = 0.964;        // velocity retained per authored frame
export const PARTICLE_HUE_BLEND = 0.018;   // fraction of the hue gap closed per frame

/**
 * The per-frame fraction of the remaining gap a fully-pulled particle closes.
 * `retain = 1 - PARTICLE_PULL * pulls[i]`, raised to dt.
 */
export const PARTICLE_PULL = 0.02;

/**
 * Advances the pool by `dtFrames` AUTHORED frames.
 *
 * This used to age and integrate once per DRAW, which made the whole ecology
 * run at the display's refresh rate: at 360Hz every particle lived and moved
 * six times too fast. It is the same defect as the emission cadences (see
 * artRateGate.js) one layer down, and the two CANCELLED while both were broken
 * — emission 6x faster into a pool that also died 6x faster left the population
 * roughly right and only the tempo wrong. Fixing emission alone broke the
 * cancellation, which is how this site was found.
 *
 * `dtFrames` is REQUIRED, deliberately. A default of 1 would silently restore
 * the per-draw behaviour for any caller that forgot it, which is precisely the
 * bug this function is being changed to remove.
 *
 * ── Why these forms and not `x += v * dt; v *= DRAG` ────────────────────────
 *
 * Velocity decays geometrically, so displacement over a step is the integral of
 * a decaying quantity, not `v * dt`. Sub-stepping the naive form six times does
 * not land where one whole step lands — MEASURED, it falls ~1.5% short per
 * authored frame, compounding over a ~140-frame life.
 *
 *   decay = DRAG^dt                    exact, and DRAG at dt = 1
 *   move  = (DRAG^dt - 1)/(DRAG - 1)   exact, and 1 at dt = 1
 *
 * `move` is the one worth staring at: it is the geometric sum that the per-draw
 * loop was implicitly accumulating, normalised so that one authored frame moves
 * by exactly the raw velocity. It COMPOSES — N steps of dt/N equal one step of
 * dt — so no refresh rate is privileged, and it returns the shipped arithmetic
 * unrounded at dt = 1, so no reference image moves. Both are the same for every
 * particle, so they are computed ONCE per call and not per slot.
 */
export function stepParticles(pool, dtFrames) {
  // In-place update — no compaction (avoids index aliasing bug)
  // Dead particles (life >= maxLife) are simply skipped during render.
  // Ring buffer naturally recycles slots.
  if (!(dtFrames > 0)) return;          // a floored-at-zero clock passes no time
  const decay = decayOverFrames(PARTICLE_DRAG, dtFrames);
  // No extra factor here: this adds the RAW velocity and decays after, so one
  // authored frame moves by exactly 1. The rotation decays first and needs one
  // more `retain` — see stepAutoRotation, where getting that wrong reads
  // correctly at 60fps and nowhere else.
  const move = driftOverFrames(PARTICLE_DRAG, dtFrames);
  // Exponential approach, for the same compositional reason: the hue gap is
  // multiplied by (1 - BLEND) each authored frame, so the fraction closed over
  // dt frames is 1 - (1 - BLEND)^dt, never BLEND * dt.
  const blend = 1 - decayOverFrames(1 - PARTICLE_HUE_BLEND, dtFrames);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pool.lifes[i] >= pool.maxLifes[i]) continue;
    // Captured before the integration, not derived from velocity afterwards:
    // once the arrival term is in, displacement is no longer `v * move`.
    pool.pxs[i] = pool.xs[i];
    pool.pys[i] = pool.ys[i];
    pool.pzs[i] = pool.zs[i];
    pool.lifes[i] += dtFrames;
    pool.xs[i] += pool.vxs[i] * move;
    pool.ys[i] += pool.vys[i] * move;
    pool.zs[i] += pool.vzs[i] * move;
    pool.vxs[i] *= decay;  // drag
    pool.vys[i] *= decay;
    pool.vzs[i] *= decay;
    // ARRIVAL — an exponential approach on POSITION, deliberately the same law
    // as the hue drift below and for the same reason: it COMPOSES. N sub-steps
    // of dt/N land exactly where one step of dt lands, so no refresh rate is
    // privileged.
    //
    // A spring (`v += (T - P) * k * dt`) does not compose, and it agrees with
    // the correct form at dt = 1 — which is precisely why a dt = 1 parity test
    // cannot catch the difference. That is the shape of the bug that hid in
    // the emission cadences for years.
    //
    // The strength scales the RATE, i.e. the base of the exponent, NOT the
    // composed result. `(1 - k^dt) * pulls[i]` would break composition per
    // particle while looking identical at dt = 1 — the same trap one level in.
    // At pulls[i] = 0 the base is exactly 1, 1^dt is exactly 1, and the
    // approach is exactly 0: every untargeted emitter is bit-identical.
    const pull = pool.pulls[i];
    if (pull > 0) {
      const approach = 1 - decayOverFrames(1 - PARTICLE_PULL * pull, dtFrames);
      pool.xs[i] += (pool.txs[i] - pool.xs[i]) * approach;
      pool.ys[i] += (pool.tys[i] - pool.ys[i]) * approach;
      pool.zs[i] += (pool.tzs[i] - pool.zs[i]) * approach;
    }
    // Hue drift toward target (smooth color blend)
    const dh = pool.hueTargets[i] - pool.hues[i];
    const shortPath = dh > 180 ? dh - 360 : dh < -180 ? dh + 360 : dh;
    pool.hues[i] += shortPath * blend;
  }
}

// ── Idle ambient emitter — slow-drifting particles across the sphere ─────────
// Colors cycle through a warm→cool palette independent of user interaction.
let _idleHueDrift = 0;
export function emitIdleParticles(pool, nodes) {
  _idleHueDrift = (_idleHueDrift + 0.18) % 360;
  // Pick a random live node as origin
  if (!nodes || nodes.length === 0) return;
  const n = nodes[Math.floor(artRandom() * nodes.length)];
  const hue = _idleHueDrift;
  const hueTarget = (_idleHueDrift + 40 + artRandom() * 80) % 360;
  const theta = artRandom() * Math.PI * 2;
  const phi   = Math.acos(artRandom() * 2 - 1);
  const speed = 0.0005 + artRandom() * 0.0012;
  emitParticle(pool,
    n.x + (artRandom() - 0.5) * 0.08,
    n.y + (artRandom() - 0.5) * 0.08,
    n.z + (artRandom() - 0.5) * 0.08,
    Math.sin(phi) * Math.cos(theta) * speed,
    Math.sin(phi) * Math.sin(theta) * speed,
    Math.cos(phi) * speed,
    hue, hueTarget,
    55 + artRandom() * 30,   // sat
    0.6 + artRandom() * 0.8, // size
    120 + artRandom() * 180  // life
  );
}

// ── Click burst — radial explosion from node, hue = node cluster color ───────
export function emitNodeBurst(pool, x, y, z, hue, hueTarget, count) {
  for (let i = 0; i < count; i++) {
    const theta = artRandom() * Math.PI * 2;
    const phi   = Math.acos(artRandom() * 2 - 1);
    const speed = 0.003 + artRandom() * 0.009;
    emitParticle(pool, x, y, z,
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed,
      hue, hueTarget,
      75 + artRandom() * 20,
      1.2 + artRandom() * 2.2,
      90 + artRandom() * 100
    );
  }
}

// ── Edge stream — particles flowing along an edge ────────────────────────────

/**
 * An edge particle's launch speed, as a fraction of the edge vector PER
 * REMAINING EDGE FRACTION — i.e. per `(1 - t)`, not per whole edge. The
 * caller multiplies by that remaining fraction at the launch site, because a
 * particle is seeded at `t = artRandom()` along the edge, not at A.
 *
 * DERIVED, not chosen. Velocity decays geometrically, so total displacement is
 * `v0 * sum(DRAG^k)` = `v0 / (1 - DRAG)`. Covering an edge of length L
 * therefore needs `v0 = (1 - DRAG) * L`, which is what this is — but a
 * particle born at `t` only has `(1 - t) * L` left to cover to reach B, so
 * `v0` is scaled by that remaining fraction too. Without it, a particle's
 * displacement asymptotes to `t + 1` of the edge: it overshoots B by `t`
 * itself, MEASURED at a particle seeded at t=0.75 peaking at 1.364 and still
 * at 1.123 at frame 130 (lifespans run 60-130 frames) — about 60px past the
 * node at 900x700.
 *
 * It used to be 0.002, i.e. 5.5% of an edge. MEASURED: drag e-folds velocity in
 * 27.8 authored frames against lifespans of 60-130, so an edge particle spent
 * the overwhelming majority of its visible life motionless a few percent from
 * where it was born. The flow layer was wired, seeded along the edge and aimed
 * A to B with the hue blending from node A's colour to node B's — and it had
 * never once arrived, so the blend never completed either.
 *
 * Written against PARTICLE_DRAG rather than as a literal so the two cannot
 * drift: change the drag and the range follows it.
 *
 * THIS IS THE `pull = 0` CASE ONLY, and NO SHIPPING CALL SITE TAKES IT: both
 * emitters in ArtTab omit `pull`, so it defaults to 1 and they go through
 * `edgeLaunchK`. This survives as the anchor the identity test pins
 * `edgeLaunchK(0)` against, so the two forms cannot drift — not because some
 * emitter still launches at it.
 *
 * With the arrival term active the drag and the pull both aim at B and
 * SUPERPOSE, so this speed overshoots. See `edgeLaunchK`.
 */
export const EDGE_PARTICLE_SPEED_K = 1 - PARTICLE_DRAG;

/**
 * The launch speed that lands a particle on B with NO OVERSHOOT, given the
 * arrival term it will also be carrying.
 *
 * ── Why the plain (1 - DRAG) is wrong once `pull` is on ────────────────────
 *
 * Drag and arrival both aim at B and superpose. Sizing the drag budget for the
 * WHOLE remaining distance while the pull is also closing it means the particle
 * reaches B with velocity left over and sails past, then gets dragged back.
 * MEASURED at pull = 1: peak 1.124 of the way along the edge, i.e. ~40-60px
 * past the node at 900x700 for a low-`t` particle. The asymptote was always
 * right; the transient was not, and a particle lives 60-130 frames — squarely
 * inside the transient.
 *
 * ── The exact answer, and it is exact rather than tuned ────────────────────
 *
 * One authored frame is `x += v; v *= D;` then `x += (T - x) * p`. In terms of
 * the error `e = T - x` that is
 *
 *     e' = (e - v)(1 - p),    v' = v * D
 *
 * so with `r = D / (1 - p)`,
 *
 *     e_n = (1 - p)^n [ e_0 - v_0 (r^n - 1) / (r - 1) ]
 *
 * Choose `v_0 = e_0 (1 - r)` and the bracket collapses to `e_0 r^n`, giving
 *
 *     e_n = e_0 * D^n
 *
 * — a clean geometric approach to B that is never negative, so the particle
 * never passes the node at any point in its life. VERIFIED by simulation: peak
 * position 1.000000 at pull = 0, 0.5 and 1 alike, against 1.124018 for the
 * unadjusted speed at pull = 1.
 *
 * At `pull = 0` this is `1 - D / 1` = `1 - D` = EDGE_PARTICLE_SPEED_K exactly,
 * so the no-arrival case is unchanged and the two cannot drift — a test pins
 * that identity rather than restating the number.
 */
export function edgeLaunchK(pull) {
  // pull is 0..1 and PARTICLE_PULL is 0.02, so the denominator cannot approach
  // zero at any legal input; the clamp is against a caller, not against the
  // maths.
  const p = Math.min(0.99, Math.max(0, PARTICLE_PULL * pull));
  return 1 - PARTICLE_DRAG / (1 - p);
}

export function emitEdgeParticles(pool, ax, ay, az, bx, by, bz, hue, hueTarget, count, pull = 1) {
  // One value for the whole call — `pull` does not vary per particle here.
  const k = edgeLaunchK(pull);
  for (let i = 0; i < count; i++) {
    const t = artRandom();
    // The remaining fraction of the edge, so the asymptote is B itself rather
    // than t + 1 of the way there. See edgeLaunchK.
    const remaining = 1 - t;
    emitParticle(pool,
      ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t,
      (bx - ax) * k * remaining + (artRandom() - 0.5) * 0.0008,
      (by - ay) * k * remaining + (artRandom() - 0.5) * 0.0008,
      (bz - az) * k * remaining + (artRandom() - 0.5) * 0.0008,
      hue, hueTarget,
      65 + artRandom() * 20,
      0.8 + artRandom() * 1.2,
      60 + artRandom() * 70,
      bx, by, bz, pull
    );
  }
}
