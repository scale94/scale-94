// ── Fade Doctrine alpha envelope ──────────────────────────────────────────────
// 0–15%:  quadratic ease-in
// 15–70%: hold at BASE_ALPHA
// 70–100%: power ease-out (exponent 2.2)
const BASE_ALPHA = 0.55;

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
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

// ── Rocket spawn ──────────────────────────────────────────────────────────────
// Returns 3–5 rockets staggered 80–150ms apart.
// Each rocket travels from near (screenX, screenY) to a random apex
// in the upper 40% of the canvas.
export function spawnRockets(element, screenX, screenY, canvasW, canvasH) {
  const count = randInt(3, 5);
  const rockets = [];
  let delay = 0;
  for (let i = 0; i < count; i++) {
    rockets.push({
      type: 'rocket',
      element,
      // Origin: near the clicked node with ±20px jitter
      x: screenX + rand(-20, 20),
      y: screenY + rand(-20, 20),
      prevX: screenX,
      prevY: screenY,
      // Apex: random point in upper 40% of canvas
      apexX: rand(canvasW * 0.1, canvasW * 0.9),
      apexY: rand(0, canvasH * 0.40),
      age: 0,
      lifespan: randInt(60, 80),
      hasExploded: false,
      delay,         // milliseconds before this rocket activates
      color: PALETTES[element]?.primary ?? '#ffffff',
    });
    delay += rand(80, 150);
  }
  return rockets;
}

// ── Burst spawn ───────────────────────────────────────────────────────────────
// Called when a rocket reaches its apex.
export function spawnBurst(element, x, y) {
  switch (element) {
    case 'thermal': return spawnEmbers(x, y);
    case 'fluid':   return spawnDroplets(x, y);
    case 'air':     return spawnRings(x, y);
    case 'earth':   return spawnShards(x, y);
    default:        return spawnEmbers(x, y);
  }
}

// FIRE — thin ember streaks shooting narrow-upward
function spawnEmbers(x, y) {
  const count = randInt(12, 18);
  const palette = PALETTES.thermal;
  return Array.from({ length: count }, () => {
    const angle = rand(-Math.PI / 2 - Math.PI / 9, -Math.PI / 2 + Math.PI / 9); // ±20° from up
    const speed = rand(1.5, 3.5);
    return {
      type: 'ember',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drift: rand(-0.05, 0.05), // horizontal jitter per frame
      age: 0,
      lifespan: randInt(180, 240),
      primary: palette.primary,
      secondary: palette.secondary[Math.floor(Math.random() * palette.secondary.length)],
    };
  });
}

// WATER — droplets in wide parabolic fan with gravity
function spawnDroplets(x, y) {
  const count = randInt(10, 14);
  const palette = PALETTES.fluid;
  return Array.from({ length: count }, () => {
    const angle = rand(-Math.PI / 2 - Math.PI * 4 / 9, -Math.PI / 2 + Math.PI * 4 / 9); // ±80° from up
    const speed = rand(2, 4.5);
    return {
      type: 'droplet',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.08,
      radius: rand(3, 4),
      age: 0,
      lifespan: randInt(100, 140),
      color: Math.random() < 0.5 ? palette.primary : palette.secondary[Math.floor(Math.random() * palette.secondary.length)],
    };
  });
}

// AIR — 2–3 expanding concentric rings
function spawnRings(x, y) {
  const count = randInt(2, 3);
  const palette = PALETTES.air;
  return Array.from({ length: count }, (_, i) => ({
    type: 'ring',
    x, y,
    radius: 0,
    maxRadius: rand(60, 90),
    age: 0,
    lifespan: randInt(60, 90),
    color: i % 2 === 0 ? palette.primary : palette.secondary[0],
  }));
}

// EARTH — chunky slow rotating shards
function spawnShards(x, y) {
  const count = randInt(8, 12);
  const palette = PALETTES.earth;
  return Array.from({ length: count }, () => {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(0.6, 1.8) * 0.6; // 0.6× normal speed
    return {
      type: 'shard',
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.12,           // 1.5× normal gravity
      rotation: rand(0, Math.PI * 2),
      rotVel: rand(-0.08, 0.08),
      w: rand(4, 8),
      h: rand(3, 6),
      age: 0,
      lifespan: randInt(180, 260),
      color: [palette.primary, ...palette.secondary][Math.floor(Math.random() * 3)],
    };
  });
}
