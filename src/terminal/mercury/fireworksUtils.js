// ── Fade Doctrine alpha envelope ──────────────────────────────────────────────
// 0–15%:  quadratic ease-in
// 15–70%: hold at BASE_ALPHA
// 70–100%: power ease-out (exponent 2.2)
const BASE_ALPHA = 0.75; // boosted from 0.55 — more visible

export function doctrineAlpha(age, lifespan) {
  const t = age / lifespan;
  if (t >= 1) return 0;
  if (t < 0.15) {
    const r = t / 0.15;
    return BASE_ALPHA * r * r;
  }
  if (t < 0.70) return BASE_ALPHA;
  const decay = (t - 0.70) / 0.30;
  return BASE_ALPHA * Math.pow(1 - decay, 2.2);
}

// ── Element palettes (semantic — never decorative) ────────────────────────────
export const PALETTES = {
  thermal: { primary: '#f97316', secondary: ['#fbbf24', '#ef4444'] },
  fluid:   { primary: '#6366f1', secondary: ['#818cf8', '#c7d2fe'] },
  air:     { primary: '#38bdf8', secondary: ['#bae6fd', '#0ea5e9'] },
  earth:   { primary: '#d97706', secondary: ['#fbbf24', '#92400e'] },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); } // inclusive of both ends

// ── Rocket spawn ──────────────────────────────────────────────────────────────
// Returns 5–8 rockets staggered 60–120ms apart.
export function spawnRockets(element, screenX, screenY, canvasW, canvasH) {
  const count = randInt(5, 8);
  const rockets = [];
  let delay = 0;
  for (let i = 0; i < count; i++) {
    rockets.push({
      type: 'rocket',
      element,
      x: screenX + rand(-30, 30),
      y: screenY + rand(-30, 30),
      prevX: screenX,
      prevY: screenY,
      // Apex: spread across full upper 35% — wide coverage
      apexX: rand(canvasW * 0.05, canvasW * 0.95),
      apexY: rand(canvasH * 0.02, canvasH * 0.35),
      age: 0,
      lifespan: randInt(50, 70),   // faster rockets
      hasExploded: false,
      delay,
      color: PALETTES[element]?.primary ?? '#ffffff',
    });
    delay += rand(60, 120);
  }
  return rockets;
}

// ── Burst spawn ───────────────────────────────────────────────────────────────
export function spawnBurst(element, x, y) {
  switch (element) {
    case 'thermal': return spawnEmbers(x, y);
    case 'fluid':   return spawnDroplets(x, y);
    case 'air':     return spawnRings(x, y);
    case 'earth':   return spawnShards(x, y);
    default:        return spawnEmbers(x, y);
  }
}

// FIRE — ember streaks, narrow-upward, long burn
function spawnEmbers(x, y) {
  const count = randInt(20, 30);   // was 12–18
  const palette = PALETTES.thermal;
  return Array.from({ length: count }, () => {
    const angle = rand(-Math.PI / 2 - Math.PI / 8, -Math.PI / 2 + Math.PI / 8);
    const speed = rand(2.5, 5.5);  // faster
    return {
      type: 'ember',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drift: rand(-0.08, 0.08),
      age: 0,
      lifespan: randInt(200, 280), // longer burn
      primary: palette.primary,
      secondary: palette.secondary[Math.floor(Math.random() * palette.secondary.length)],
    };
  });
}

// WATER — wide parabolic splash with gravity
function spawnDroplets(x, y) {
  const count = randInt(18, 26);   // was 10–14
  const palette = PALETTES.fluid;
  return Array.from({ length: count }, () => {
    const angle = rand(-Math.PI / 2 - Math.PI * 4 / 9, -Math.PI / 2 + Math.PI * 4 / 9);
    const speed = rand(3, 6.5);    // faster
    return {
      type: 'droplet',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.10,
      radius: rand(3.5, 5.5),     // bigger drops
      age: 0,
      lifespan: randInt(110, 160),
      color: Math.random() < 0.5 ? palette.primary : palette.secondary[Math.floor(Math.random() * palette.secondary.length)],
    };
  });
}

// AIR — expanding concentric rings, fast + wide
function spawnRings(x, y) {
  const count = randInt(3, 5);     // was 2–3
  const palette = PALETTES.air;
  return Array.from({ length: count }, (_, i) => ({
    type: 'ring',
    x, y,
    radius: 0,
    maxRadius: rand(90, 140),      // bigger rings
    age: i * 6,
    lifespan: randInt(70, 100),    // slightly longer
    color: i % 2 === 0 ? palette.primary : palette.secondary[0],
  }));
}

// EARTH — heavy shards, slow + chunky
function spawnShards(x, y) {
  const count = randInt(14, 20);   // was 8–12
  const palette = PALETTES.earth;
  return Array.from({ length: count }, () => {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1.0, 3.0) * 0.6;
    return {
      type: 'shard',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.14,
      rotation: rand(0, Math.PI * 2),
      rotVel: rand(-0.10, 0.10),
      w: rand(5, 11),              // chunkier
      h: rand(4, 8),
      age: 0,
      lifespan: randInt(200, 300),
      color: [palette.primary, ...palette.secondary][Math.floor(Math.random() * 3)],
    };
  });
}
