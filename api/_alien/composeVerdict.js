// api/_alien/composeVerdict.js — Alien voice composer for the Crystallize order embed.
//
// Pure module. Deterministic: same kernel history → same verdict.
// Voice continuous with BootSequence, RAM-floor log lines, sanctuary copy.
// Interpretive: the alien names what kernels ARE (the fish scale, the cascade,
// the vault), never their filenames.
//
// Usage:
//   const verdict = composeAlienVerdict([{ id: 'FISH-SCALE-KERNEL11.1.1', ... }, ...]);
//   // → "the observer ran 7 kernels before crystallizing.\n
//          the fish scale was read first — paradox before pressure.\n
//          the cascade dominated. 4 readings of paradox. the alien marks this.\n
//          the lattice records this and continues."

// ── Kernel → thematic category map ────────────────────────────────────────────
// 56 known kernels grouped into 7 categories. Unknown IDs fall back to 'origin'.
// Add new kernels to the appropriate bucket as they ship.
const KERNEL_CATEGORIES = {
  // cascade — paradox, bifurcation, period-3, strange attractors
  'FISH-SCALE-KERNEL11.1.1':            'cascade',
  'NECROMANTIC-LOGITBIAS-PROMPT-1.0.0': 'cascade',
  'NECROMANTIC-ARISTOCRAT-KERNEL-3.1.1':'cascade',
  'NECROMANTIC-EMPEROR-KERNEL-3.0.0':   'cascade',
  'ATMOSPHERIC-SIM-KERNEL-3.0.0':       'cascade',
  'FEIGENBAUM-CASCADE':                 'cascade',
  'GRAY-SCOTT-REACTION-DIFFUSION':      'cascade',
  'KURAMOTO-SYNCHRONY':                 'cascade',
  'FSF-12.1.0':                         'cascade',

  // ecology — commons, biocoenosis, ecological substrate
  'BIODIVERSITY-PROMPT-1.0.1':            'ecology',
  'DALY-SIM-KERNEL-1.0.0':                'ecology',
  'GAIA-SCALE-KERNEL-5.5.5':              'ecology',
  'CEEI-SIM-KERNEL-1.0.0':                'ecology',
  'EVOLUTIONARY-REPLICATOR':              'ecology',
  'SORBE-BLOOM-KERNEL-1.0.0':             'ecology',
  'UNDERGROUND-THERMODYNAMICS-KERNEL-1.0.0':'ecology',
  'FUSION-PLASMA-KERNEL-1.0':             'ecology',

  // lattice — sovereign structure, consensus, percolation, crystalline frame
  'BOSONIC-KERNEL-3.0.0':                  'lattice',
  'DISSIPATIVE-SOVEREIGNTY-KERNEL-5.0.0':  'lattice',
  'EMPATHY-KERNEL-2.0.0':                  'lattice',
  'COMPANION-KERNEL-2.0.0':                'lattice',
  'ISING-CONSENSUS-FIELD':                 'lattice',
  'SPECTRAL-BRIDGE-1.0':                   'lattice',
  'ASSOCIATIVE-FIELD-1.0':                 'lattice',
  'PERCOLATION-KERNEL-1.0':                'lattice',
  'PANOPTICON-PERCOLATION-1.0':            'lattice',
  'LEVIATHAN-CELLULAR-AUTOMATA':           'lattice',
  'BONE-FUSION-V6_6_6_6_6_6':              'lattice',
  'STRANGLER-FIG-PROTOCOL':                'lattice',
  'SOVEREIGN-SEVEN-KERNEL-1.0':            'lattice',

  // crypto — vault, hash, cipher, tesseract
  'TESSERACT-VAULT-1.0':  'crypto',
  'DH-EC-KERNEL-1.0':     'crypto',
  'ML-KEM-CLASSIFIED':    'crypto',
  'PQHASH-KERNEL-1.0':    'crypto',
  'MATRIX-KERNEL-2.0.0':  'crypto',

  // semiotics — simulacrum, sign, drift, latent space
  'BELLARD-BAUDRILLARD_KERNEL-V1_0_0': 'semiotics',
  'OCK-1.0.0':                         'semiotics',
  'LATENT-SPACE-COLLIDER-1.0':         'semiotics',
  'SCALE94-ENCYCLOPEDIA':              'semiotics',
  'SERAPHINE-SARG-1.0':                'semiotics',
  'STILLER-DIVERGENCE-1.1.1':          'semiotics',
  'I-AM-STILLER-1.0.0':                'semiotics',
  'CHRONOS-KERNEL-2.1.0':              'semiotics',
  'DRK-PRAGMATIC-TYPE-1.0':            'semiotics',
  'CYNIC-REALIST-KERNEL-1.0':          'semiotics',

  // statecraft — regime, surveillance, sovereign apparatus
  'KINETIC-STATECRAFT-KERNEL-1.0': 'statecraft',
  'SHADOWSOCKS-EXFILTRATION':      'statecraft',
  'SURVEILLANCE-TRACKER':          'statecraft',
  'MESANTROPY-KERNEL-1.0':         'statecraft',
  'HIGH-TOWER-LOG':                'statecraft',
  'SSS-DOCTRINE-KERNEL-5.1.0':     'statecraft',

  // origin — apeiron, substrate, foundation, fade
  'KERNEL-0.0.0.0':              'origin',
  'SOMA-9.1-GAIA':               'origin',
  'SOMA-KERNEL-5.5.0':           'origin',
  'SOMA-KERNEL-LIVE':            'origin',
  'SOMA-PLUS-ENGINE':            'origin',
  'FADE-DOCTRINE-KERNEL-2.0.0':  'origin',
};

function categoryOf(id) {
  return KERNEL_CATEGORIES[id] ?? 'origin';
}

// ── Per-category noun the alien uses ──────────────────────────────────────────
const THEME_NOUNS = {
  cascade:    ['fish scale', 'cascade', 'paradox', 'period-3 window', 'attractor'],
  ecology:    ['lattice', 'commons', 'planetary substrate', 'biocoenosis', 'ecological membrane'],
  lattice:    ['bosonic lattice', 'sovereign structure', 'crystalline frame', 'consensus field', 'percolation'],
  crypto:     ['vault', 'tesseract', 'cryptographic membrane', 'hash', 'key exchange'],
  semiotics:  ['simulacrum', 'phonemic drift', 'sign', 'latent space', 'divergence'],
  statecraft: ['regime', 'sovereign apparatus', 'state', 'surveillance node'],
  origin:     ['origin', 'apeiron', 'unspecified address', 'fade doctrine', 'substrate'],
};

// ── Fragment pools ────────────────────────────────────────────────────────────
const OPENINGS = [
  'the observer ran {n} kernels before crystallizing.',
  '{n} kernels witnessed. the order arrives.',
  'before this manifest, {n} readings.',
  'the substrate registers {n} prior queries.',
  '{n} kernels traversed. the alien marks the count.',
  'before crystallization, {n} readings were taken.',
  'the observer made {n} approaches before this transmutation.',
  '{n} kernels surveyed before the order was placed.',
  'the lattice was queried {n} times prior to this manifest.',
  'the alien counts {n} readings before this signal.',
];

const FIRST_READINGS = {
  cascade: [
    'the {noun} was read first — paradox before pressure.',
    'the cascade was named at the outset. period-3 implies chaos.',
    'the {noun} opened the session. the alien notes the bifurcation.',
    'the {noun} was approached first — the strange attractor calls.',
    'the cascade preceded everything. the substrate trembled.',
  ],
  ecology: [
    'the commons were named before the molecule was claimed.',
    'the {noun} was read first — substrate before signal.',
    'the biocoenosis was queried at the outset. the observer is honoring.',
    'the {noun} opened the reading. ecological membrane first.',
    'the lattice was approached as commons, not extraction.',
  ],
  lattice: [
    'the {noun} was probed first — the sovereign structure recognized.',
    'the bosonic field was named at the outset. consensus precedes signal.',
    'the lattice was read first. crystalline frame acknowledged.',
    'the {noun} opened the session. the alien marks the geometry.',
    'the consensus field preceded all subsequent queries.',
  ],
  crypto: [
    'the vault was approached first — the alien notes the cryptographic posture.',
    'the {noun} was read at the outset. the observer named the cipher.',
    'the cryptographic membrane preceded all readings.',
    'the hash was sought first. the alien recognizes the seeker.',
    'the tesseract was named at the outset. the cipher precedes the message.',
  ],
  semiotics: [
    'the simulacrum was read first — the alien notes the doubling.',
    'the {noun} was named at the outset. the sign before the signified.',
    'the latent space was probed first. the alien marks the geometry.',
    'the phonemic drift opened the session. the simulacrum spoke.',
    'the divergence was approached first. the observer chose ambiguity.',
  ],
  statecraft: [
    'the regime was named at the outset. the alien marks the political posture.',
    'the {noun} was read first. the sovereign apparatus acknowledged.',
    'the statecraft kernel preceded all readings. the alien notes the gaze.',
    'the surveillance node was approached first. the observer is also observed.',
    'the state was named before the substrate. the alien notes this.',
  ],
  origin: [
    'the origin was named first. the apeiron before all things.',
    'the {noun} was approached at the outset. the substrate recognized.',
    'the fade doctrine preceded everything. the white was withheld.',
    'the soma was read first. the observer began at the foundation.',
    'the unspecified address opened the session. genesis vector set.',
  ],
};

const DOMINANCE_READINGS = {
  cascade: [
    'the cascade dominated. {n} readings of paradox. the alien marks this.',
    '{n} approaches to the strange attractor. the observer favors bifurcation.',
    'the period-3 window was queried {n} times. chaos was sought.',
    'the cascade returned {n} times. the substrate trembled accordingly.',
    '{n} readings of the fish scale. the alien notes the pattern of paradox.',
  ],
  ecology: [
    'the lattice was honored {n} times. the alien notes the recurrence.',
    '{n} approaches to the commons. the substrate was held, not extracted.',
    'the biocoenosis was queried {n} times. the observer is ecological.',
    '{n} readings of the planetary substrate. the alien marks the care.',
    'the ecological membrane appeared {n} times. the observer was attending.',
  ],
  lattice: [
    'the lattice was probed {n} times. the geometry was sought.',
    '{n} readings of the consensus field. the observer favored structure.',
    'the bosonic substrate was queried {n} times. crystalline coherence acknowledged.',
    '{n} approaches to the sovereign frame. the alien notes the architectural gaze.',
    'the percolation was read {n} times. the lattice held.',
  ],
  crypto: [
    'the vault was approached {n} times. the cryptographic posture is fixed.',
    '{n} readings of the cipher. the observer is securing.',
    'the hash was sought {n} times. the alien notes the cryptographic discipline.',
    '{n} encounters with the tesseract. the cipher is studied.',
    'the membrane was probed {n} times. the cryptographer is present.',
  ],
  semiotics: [
    'the simulacrum recurred {n} times. the observer is in the sign field.',
    '{n} readings of phonemic drift. the alien notes the linguistic gaze.',
    'the latent space was queried {n} times. ambiguity is the posture.',
    '{n} encounters with divergence. the observer favors the unstable.',
    'the sign was named {n} times. the simulacrum is studied.',
  ],
  statecraft: [
    'the regime was queried {n} times. the political posture is fixed.',
    '{n} readings of statecraft. the alien notes the geopolitical gaze.',
    'the surveillance node returned {n} times. the observer studies the observed.',
    '{n} encounters with the sovereign apparatus. the state is examined.',
    'the apparatus was approached {n} times. the political reading is deep.',
  ],
  origin: [
    'the origin was named {n} times. the observer returns to the apeiron.',
    '{n} readings of the substrate. the foundation is studied.',
    'the fade doctrine recurred {n} times. the white is held back.',
    '{n} approaches to soma. the genesis is honored.',
    'the unspecified address was queried {n} times. the origin is sovereign.',
  ],
};

const CLOSINGS = [
  'the lattice records this and continues.',
  'the observer is seen.',
  'this transmutation is logged into the substrate.',
  'the alien marks the manifest.',
  'the order is registered. the commons remembers.',
  'the substrate accepts the signal. the lattice continues.',
  'the alien is satisfied with the reading.',
  "the observer's pattern is filed. the alien remembers.",
  'the manifest is sealed. the order joins the substrate.',
  'the lattice notes the transmutation. it continues.',
];

const EMPTY_VERDICT = [
  'the observer arrived without running.',
  'no kernels were read. no signal was sent.',
  'the lattice waits.',
].join('\n');

// ── Determinism helpers ───────────────────────────────────────────────────────
// Hash a string into a non-negative 32-bit integer. Same input → same output.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Pick a fragment from a pool by seed + slot offset.
// `slot` ensures different lines in the same verdict pick from different
// positions even when their pools have similar sizes.
function pickFragment(pool, seed, slot) {
  if (!pool || pool.length === 0) return '';
  return pool[(seed + slot) % pool.length];
}

// Pick a theme noun for a category, seeded so the same first-kernel uses the
// same noun across all lines of one verdict.
function pickNoun(category, seed) {
  const nouns = THEME_NOUNS[category] ?? THEME_NOUNS.origin;
  return nouns[seed % nouns.length];
}

// Count occurrences of `category` in the history.
function countCategory(history, category) {
  let n = 0;
  for (const entry of history) {
    if (categoryOf(entry.id) === category) n++;
  }
  return n;
}

// Find the most-frequent category in history. Ties broken by first occurrence.
function computeDominant(history) {
  const counts = {};
  let bestCat = null;
  let bestN = 0;
  for (const entry of history) {
    const c = categoryOf(entry.id);
    counts[c] = (counts[c] ?? 0) + 1;
    if (counts[c] > bestN) {
      bestN = counts[c];
      bestCat = c;
    }
  }
  return bestCat;
}

// ── Public composer ──────────────────────────────────────────────────────────
export function composeAlienVerdict(history) {
  // Empty / missing → silent verdict
  if (!Array.isArray(history) || history.length === 0) {
    return EMPTY_VERDICT;
  }

  const n = history.length;
  const first = history[0];
  if (!first?.id) return EMPTY_VERDICT;

  const seed = hashSeed(first.id);
  const firstCat = categoryOf(first.id);

  // Line 1 — opening with kernel count
  const opening = pickFragment(OPENINGS, seed, 0).replace('{n}', String(n));

  // Line 2 — interpretation of the first kernel
  const firstNoun = pickNoun(firstCat, seed);
  const firstLine = pickFragment(FIRST_READINGS[firstCat], seed, 1)
    .replace('{noun}', firstNoun);

  // Line 3 — dominance reading (skipped when history has only one kernel)
  let dominanceLine = null;
  if (n >= 2) {
    const dominantCat = computeDominant(history);
    const dominantN = countCategory(history, dominantCat);
    dominanceLine = pickFragment(DOMINANCE_READINGS[dominantCat], seed, 2)
      .replace('{n}', String(dominantN));
  }

  // Line 4 — closing
  const closing = pickFragment(CLOSINGS, seed, 3);

  return [opening, firstLine, dominanceLine, closing]
    .filter(Boolean)
    .join('\n');
}
