// ── Inverse Extinction Engine ─────────────────────────────────────────────────
// TRANSMISSION tab · subthreshold harvest + inversion pipeline.
//
// Harvests low-visibility, high-signal posts (ecology, mutual aid, local tech)
// from the FREE public Bluesky AppView and inverts the attention economy's
// math: each post is weighted by 1/log(2 + engagement) — the quieter the
// signal, the louder it counts. GraphTracks is never called; that key stays
// reserved for the BSKY tab's top-posts panel.

export const ENGINE_TUNING = {
  TTL_MS: 8 * 60 * 60 * 1000,        // one harvest per client per 8 h window
  SUBTHRESHOLD_MAX: 24,               // likes+reposts above this → attention economy already has it
  MAX_POST_AGE_MS: 14 * 24 * 60 * 60 * 1000,
  MAX_PER_AUTHOR: 2,
  SATURATION_K: 12,                   // healing index saturation constant
  SICKNESS_THROTTLE: 0.5,             // bandwidth = H · (1 − 0.5·S)
  PROBE_LIMIT: 25,                    // posts per searchPosts call
  SIGNAL_DISPLAY_COUNT: 8,
  GROWTH_OFFSET_MAX: 0.5,             // GROWTH_MANDATE pp reduction at H=100
  SARG_LIFT_MAX: 0.15,                // SARG coherence lift fraction at H=100
};

// 4 rotation groups × 3 probes. groupIndex = floor(now / TTL) % 4, so every
// visitor in the same 8 h window fires the same queries (cache-friendly load).
export const PROBE_GROUPS = [
  ['mutual aid', 'community garden', 'repair cafe'],
  ['watershed restoration', 'rewilding', 'seed library'],
  ['community solar', 'library of things', 'open source ecology'],
  ['permaculture', 'community land trust', 'tool library'],
];

export const HEALING_LEXICON = {
  'mutual aid': 3, 'seed library': 3, 'community garden': 3, 'food forest': 3,
  'tool library': 3, 'repair cafe': 3, 'land back': 3,
  rewild: 3, rewilding: 3,
  restore: 2, restoration: 2, commons: 2, cooperative: 2, solidarity: 2,
  permaculture: 2, watershed: 2, repair: 2, regenerative: 2, compost: 2,
  pollinator: 2, 'land trust': 2, 'community solar': 2, 'native plants': 2,
  mycelium: 2, agroforestry: 2,
  share: 1, free: 1, 'open source': 1, volunteer: 1, neighbors: 1,
  neighbours: 1, garden: 1, coop: 1, local: 1, library: 1,
};

export const SICKNESS_LEXICON = {
  'everyone needs to see this': 3, "you won't believe": 3,
  outrage: 2, terrifying: 2, horrifying: 2, panic: 2, doomed: 2,
  apocalypse: 2, catastrophe: 2, rage: 2, fury: 2, collapse: 2,
  'wake up': 2, disgusting: 2, unhinged: 2,
  viral: 1, destroy: 1, war: 1, slams: 1, destroys: 1,
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRegex = (term) => new RegExp(`\\b${escapeRe(term)}\\b`, 'i');

export function lexiconScore(text, lexicon) {
  if (!text) return 0;
  let score = 0;
  for (const [term, weight] of Object.entries(lexicon)) {
    if (termRegex(term).test(text)) score += weight;
  }
  return score;
}

export function sicknessScore(text) {
  if (!text) return 0;
  let score = lexiconScore(text, SICKNESS_LEXICON);
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  const caps = (text.match(/[A-Z]/g) || []).length;
  if (letters > 20 && caps / letters > 0.3) score += 2; // shouting
  if ((text.match(/!/g) || []).length >= 3) score += 1; // engagement-bait punctuation
  return score;
}

// The inversion made literal: engagement 0 → ≈1.44, engagement 24 → ≈0.31.
export const inverseViralityWeight = (likes, reposts) =>
  1 / Math.log(2 + (likes || 0) + (reposts || 0));

export function scorePost(post) {
  const healingScore = lexiconScore(post.text, HEALING_LEXICON);
  const sScore = sicknessScore(post.text);
  const weight = inverseViralityWeight(post.likes, post.reposts);
  const contribution = Math.max(0, healingScore - sScore) * weight;
  return { ...post, healingScore, sicknessScore: sScore, weight, contribution };
}

// Keep only what the attention economy discards: engagement ≤ cap, recent,
// max 2 signals per author.
export function subthresholdFilter(posts, now = Date.now()) {
  const kept = [];
  const perAuthor = {};
  for (const p of posts) {
    if (((p.likes || 0) + (p.reposts || 0)) > ENGINE_TUNING.SUBTHRESHOLD_MAX) continue;
    const ts = p.createdAt ? Date.parse(p.createdAt) : NaN;
    if (Number.isNaN(ts) || now - ts > ENGINE_TUNING.MAX_POST_AGE_MS) continue;
    perAuthor[p.handle] = (perAuthor[p.handle] || 0) + 1;
    if (perAuthor[p.handle] > ENGINE_TUNING.MAX_PER_AUTHOR) continue;
    kept.push(p);
  }
  return kept;
}

// H = 100·(1 − e^(−Σc/K)) — smooth 0→100 saturation, no cliffs.
export function healingIndex(scored) {
  const total = scored.reduce((s, p) => s + (p.contribution || 0), 0);
  return 100 * (1 - Math.exp(-total / ENGINE_TUNING.SATURATION_K));
}

// Fraction of the kept corpus where sickness beats healing.
export function sicknessCap(scored) {
  if (!scored.length) return 0;
  return scored.filter(p => p.sicknessScore > p.healingScore).length / scored.length;
}

export const bandwidth = (H, S) => H * (1 - ENGINE_TUNING.SICKNESS_THROTTLE * S);

export const activeProbeGroup = (now = Date.now()) =>
  PROBE_GROUPS[Math.floor(now / ENGINE_TUNING.TTL_MS) % PROBE_GROUPS.length];

// ── Ecocide injection math ────────────────────────────────────────────────────
const clampH = (H) => Math.max(0, Math.min(100, H || 0));

// Healing Index → GROWTH_MANDATE reduction in percentage points (max 0.5pp).
export const healingGrowthOffset = (H) =>
  ENGINE_TUNING.GROWTH_OFFSET_MAX * (clampH(H) / 100);

// Healing Index → SARG coherence lift (max +15%, hard ceiling 10). Enough to
// pull a borderline score out of the red, never enough to mask violated paradoxes.
export const healingSargLift = (sarg, H) =>
  Math.min(10, sarg * (1 + ENGINE_TUNING.SARG_LIFT_MAX * (clampH(H) / 100)));

// at://did:plc:xxx/app.bsky.feed.post/rkey → bsky.app permalink
export const postUrl = (signal) =>
  `https://bsky.app/profile/${signal.handle}/post/${signal.uri.split('/').pop()}`;
