// artParticles.js — Particle Ecology subsystem for ArtTab
// Lightweight SoA particle pool: edge energy flow, node bursts, bifurcation trails.
// Zero external dependencies — pure JS, no imports required.

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
}

export function stepParticles(pool) {
  // In-place update — no compaction (avoids index aliasing bug)
  // Dead particles (life >= maxLife) are simply skipped during render.
  // Ring buffer naturally recycles slots.
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (pool.lifes[i] >= pool.maxLifes[i]) continue;
    pool.lifes[i] += 1;
    pool.xs[i] += pool.vxs[i];
    pool.ys[i] += pool.vys[i];
    pool.zs[i] += pool.vzs[i];
    pool.vxs[i] *= 0.964;  // drag
    pool.vys[i] *= 0.964;
    pool.vzs[i] *= 0.964;
    // Hue drift toward target (smooth color blend)
    const dh = pool.hueTargets[i] - pool.hues[i];
    const shortPath = dh > 180 ? dh - 360 : dh < -180 ? dh + 360 : dh;
    pool.hues[i] += shortPath * 0.018;
  }
}

// ── Idle ambient emitter — slow-drifting particles across the sphere ─────────
// Colors cycle through a warm→cool palette independent of user interaction.
let _idleHueDrift = 0;
export function emitIdleParticles(pool, nodes) {
  _idleHueDrift = (_idleHueDrift + 0.18) % 360;
  // Pick a random live node as origin
  if (!nodes || nodes.length === 0) return;
  const n = nodes[Math.floor(Math.random() * nodes.length)];
  const hue = _idleHueDrift;
  const hueTarget = (_idleHueDrift + 40 + Math.random() * 80) % 360;
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(Math.random() * 2 - 1);
  const speed = 0.0005 + Math.random() * 0.0012;
  emitParticle(pool,
    n.x + (Math.random() - 0.5) * 0.08,
    n.y + (Math.random() - 0.5) * 0.08,
    n.z + (Math.random() - 0.5) * 0.08,
    Math.sin(phi) * Math.cos(theta) * speed,
    Math.sin(phi) * Math.sin(theta) * speed,
    Math.cos(phi) * speed,
    hue, hueTarget,
    55 + Math.random() * 30,   // sat
    0.6 + Math.random() * 0.8, // size
    120 + Math.random() * 180  // life
  );
}

// ── Click burst — radial explosion from node, hue = node cluster color ───────
export function emitNodeBurst(pool, x, y, z, hue, hueTarget, count) {
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(Math.random() * 2 - 1);
    const speed = 0.003 + Math.random() * 0.009;
    emitParticle(pool, x, y, z,
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed,
      hue, hueTarget,
      75 + Math.random() * 20,
      1.2 + Math.random() * 2.2,
      90 + Math.random() * 100
    );
  }
}

// ── Edge stream — particles flowing along an edge ────────────────────────────
export function emitEdgeParticles(pool, ax, ay, az, bx, by, bz, hue, hueTarget, count) {
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    emitParticle(pool,
      ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t,
      (bx - ax) * 0.002 + (Math.random() - 0.5) * 0.0008,
      (by - ay) * 0.002 + (Math.random() - 0.5) * 0.0008,
      (bz - az) * 0.002 + (Math.random() - 0.5) * 0.0008,
      hue, hueTarget,
      65 + Math.random() * 20,
      0.8 + Math.random() * 1.2,
      60 + Math.random() * 70
    );
  }
}
