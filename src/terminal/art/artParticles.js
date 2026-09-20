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
    next: 0,   // ring write head
    count: 0,  // live count
    // DEV INSTRUMENT, monotonic and never read by the artwork. `next` is a ring
    // head that wraps every MAX_PARTICLES writes, so it cannot answer "how many
    // particles were emitted in this window" — which is the only question that
    // falsifies an emission rate. __artCadenceState is its sole reader.
    emitted: 0,
  };
}

export function emitParticle(pool, x, y, z, vx, vy, vz, hue, hueTarget, sat, size, maxLife) {
  const i = pool.next % MAX_PARTICLES;
  pool.next = (i + 1) % MAX_PARTICLES;
  pool.xs[i] = x;   pool.ys[i] = y;   pool.zs[i] = z;
  pool.vxs[i] = vx; pool.vys[i] = vy; pool.vzs[i] = vz;
  pool.lifes[i] = 0;
  pool.maxLifes[i] = maxLife;
  pool.hues[i] = hue;
  pool.hueTargets[i] = hueTarget;
  pool.sats[i] = sat;
  pool.sizes[i] = size;
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
    pool.lifes[i] += dtFrames;
    pool.xs[i] += pool.vxs[i] * move;
    pool.ys[i] += pool.vys[i] * move;
    pool.zs[i] += pool.vzs[i] * move;
    pool.vxs[i] *= decay;  // drag
    pool.vys[i] *= decay;
    pool.vzs[i] *= decay;
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
export function emitEdgeParticles(pool, ax, ay, az, bx, by, bz, hue, hueTarget, count) {
  for (let i = 0; i < count; i++) {
    const t = artRandom();
    emitParticle(pool,
      ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t,
      (bx - ax) * 0.002 + (artRandom() - 0.5) * 0.0008,
      (by - ay) * 0.002 + (artRandom() - 0.5) * 0.0008,
      (bz - az) * 0.002 + (artRandom() - 0.5) * 0.0008,
      hue, hueTarget,
      65 + artRandom() * 20,
      0.8 + artRandom() * 1.2,
      60 + artRandom() * 70
    );
  }
}
