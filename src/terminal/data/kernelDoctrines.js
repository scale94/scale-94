// src/terminal/data/kernelDoctrines.js — the mythic register (chaos spec §5).
// Every KERNEL OUTPUT keeps its theory: citations untouched; the sphere's 25
// kernels (plus the hopfield field that binds them) gain one paired doctrine
// line — the alchemy to the theory's chemistry, astrology to its astronomy.
// Scope v1: sphere kernels only. Non-sphere kernels return null: untranslated.
//
// Matching mirrors mobileWasmMap.js: ordered UPPERCASE substring patterns over
// the WASM registry id. First match wins — specific before generic.

const DOCTRINES = {
  associative:  'the cue is a summons · the basin is a séance · memory is a place the field falls into',
  biocoenosis:  'every species is a rumor the forest tells about itself · extinction is the forest forgetting',
  atmospheric:  'the sky is a ledger written in pressure · weather is the debt collector',
  chrono:       'time is an actuary with a séance license · every premium is paid in futures',
  daly:         'the economy is a candle that believes it is the sun · steady state is the wick learning its length',
  replicator:   'what copies itself owns the future · fitness is a prophecy that grades itself',
  grayscott:    'two chemicals argue and the argument grows spots · form is a quarrel that reached equilibrium',
  kuramoto:     'fireflies do not agree to flash together · agreement is what flashing together is called afterward',
  ceei:         'fairness is an auction where every wallet holds the same coin · envy is the proof of failure',
  soma91:       'the system banner is a heartbeat wearing a uniform',
  soma_plus:    'the dose that heals and the dose that kills share a bottle · the label is the only alchemy',
  leviathan:    'the state is a cellular automaton that dreams it has a face',
  cynic:        'the lamp is lit in daylight · honesty is entropy given a walking stick',
  feigenbaum:   'one butterfly · one constant · every route to chaos climbs the same staircase',
  ising:        'opinion is a magnet cooling · consensus is just the temperature dropping',
  bosonic:      'particles that share a state without jealousy · trust is a condensate',
  seraphine:    'reason kneels in the machine and calls it prayer · the angel is an inference rule',
  fusion:       'two nuclei overcome their hatred and light appears · the sun is reconciliation at pressure',
  classified:   'the lattice keeps a secret the way stone keeps a fossil · quantum patience cannot dig it out',
  pqhash:       'the hash is a fingerprint of a ghost · grover halves the haystack and still finds no needle',
  dh_ec:        'two strangers mix colors in public and share a secret no watcher can unmix',
  pragmatic:    'every task resolves to heat eventually · the type system just names the flame',
  soma_kernel:  'the drug is a schedule · the schedule is a state machine · euphoria compiles',
  strangler:    'the fig embraces the tree it replaces · migration is a slow-motion mercy',
  surveillance: 'the tower sees you the moment you imagine the tower · the gaze compiles to self-discipline',
  necromantic:  'the engine runs on friction between the dead and the living · perpetual, never resolved',
};

// Ordered: specific before generic (SOMA-PLUS before SOMA-KERNEL before SOMA-9.1;
// no bare SOMA pattern exists, so the three cannot shadow each other).
const ID_PATTERNS = [
  ['ASSOCIATIVE-FIELD', 'associative'],
  ['SOMA-PLUS', 'soma_plus'],   ['SOMA_PLUS', 'soma_plus'],
  ['SOMA-KERNEL', 'soma_kernel'], ['SOMA_KERNEL', 'soma_kernel'], ['SOMA-5', 'soma_kernel'],
  ['SOMA-9.1', 'soma91'],
  ['BIODIVERSITY', 'biocoenosis'], ['BIOCOENOSIS', 'biocoenosis'],
  ['ATMOSPHERIC', 'atmospheric'],  ['THERMOSPHERE', 'atmospheric'],
  ['CHRONO', 'chrono'],            ['ACTUARY', 'chrono'],
  ['DALY', 'daly'],
  ['REPLICATOR', 'replicator'],
  ['GRAY', 'grayscott'],           ['REACTION-DIFFUSION', 'grayscott'],
  ['KURAMOTO', 'kuramoto'],
  ['CEEI', 'ceei'],                ['ALLOCATION-ENGINE', 'ceei'],
  ['LEVIATHAN', 'leviathan'],      ['VCACHE', 'leviathan'], ['V-CACHE', 'leviathan'],
  ['CYNIC', 'cynic'],
  ['FEIGENBAUM', 'feigenbaum'],    ['BIFURCATION', 'feigenbaum'], ['FSF-', 'feigenbaum'],
  ['ISING', 'ising'],
  ['BOSONIC', 'bosonic'],
  ['SERAPHINE', 'seraphine'],
  ['FUSION', 'fusion'],            ['PLASMA', 'fusion'],
  ['CLASSIFIED', 'classified'],    ['ML-KEM', 'classified'],
  ['PQHASH', 'pqhash'],            ['HASH-AUDIT', 'pqhash'],
  ['DH-EC', 'dh_ec'],              ['DH_EC', 'dh_ec'],
  ['PRAGMATIC', 'pragmatic'],
  ['STRANGLER', 'strangler'],
  ['SURVEILLANCE', 'surveillance'], ['PANOPTICON', 'surveillance'],
  ['NECRO', 'necromantic'],        ['FISH', 'necromantic'],
];

export function doctrineFor(wasmId) {
  if (!wasmId) return null;
  const id = String(wasmId).toUpperCase();
  for (const [pattern, key] of ID_PATTERNS) {
    if (id.includes(pattern)) return DOCTRINES[key] ?? null;
  }
  return null;
}

// Log-entry block for the tty pipelines. Empty array = kernel stays untranslated.
export function doctrineLogLines(wasmId, time) {
  const d = doctrineFor(wasmId);
  if (!d) return [];
  return [
    { time, msg: '  doctrine:', rust: true },
    { time, msg: `  ${d}`, rust: true },
  ];
}
