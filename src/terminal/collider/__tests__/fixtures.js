// Hand-built result literals for the perfume-card parity pins (P0).
// Shape follows what buildPerfumeCard / buildTesseractProfile /
// generateManifestMarkdown read.
const acc = (o) => ({
  dominant: { id: 'citrus' },
  animalicIntensity: 0.1,
  polarity: 0.4,
  sillage: 0.6,
  fixation: 0.6,
  persists: true,
  nodeClass: { id: 'RTA' },
  polarityClass: { label: 'BALANCED' },
  evapCurve: [0.3, 0.4, 0.3],
  cleanRoom: 0.5,
  sovereignty: 0.5,
  ...o,
});

const res = (accord, o) => ({
  accord,
  novelty: 0.2,
  chimeraName: 'TEST CHIMERA',
  // Real-shaped axes, as the collider emits them: { name, contrib, vA, vB, delta }
  // and paradoxes { name, residual, original }.
  convergence: [{ name: 'entropy', contrib: 0.812, vA: 0.7, vB: 0.65, delta: 0.05 }],
  divergence: [{ name: 'synchrony', contrib: 0.06, vA: 0.1, vB: 0.6, delta: 0.5 }],
  paradoxes: [{ name: 'thermodynamic', residual: 0.21, original: 0.44 }],
  viability: 6,
  ...o,
});

export const FIXTURES = [
  {
    // citrus|woody interference, extrait tier (sillage 0.8)
    name: 'interference-extrait',
    domA: 0, domB: 10,
    result: res(acc({ dominant: { id: 'citrus' }, sillage: 0.8, fixation: 0.8, persists: true })),
  },
  {
    // novelty > 0.55 adds a third heart note; eau de parfum tier (0.6)
    name: 'novelty-third-heart-parfum',
    domA: 4, domB: 14,
    result: res(acc({ dominant: { id: 'floral' }, sillage: 0.6 }), { novelty: 0.7 }),
  },
  {
    // animalic base branch (animalicIntensity > 0.45); eau de toilette tier (0.4)
    name: 'animalic-base-toilette',
    domA: 7, domB: 11,
    result: res(acc({
      dominant: { id: 'spicy' }, animalicIntensity: 0.6, sillage: 0.4, fixation: 0.5, persists: false,
      nodeClass: { id: 'ANX' }, polarityClass: { label: 'ANIMALIC' }, evapCurve: [0.2, 0.3, 0.5],
    })),
  },
  {
    // woody base branch (polarity > 0.65); eau de cologne tier (0.1)
    name: 'woody-base-cologne',
    domA: 5, domB: 20,
    result: res(acc({
      dominant: { id: 'fresh' }, polarity: 0.8, sillage: 0.1, fixation: 0.3, persists: false,
      polarityClass: { label: 'POLAR' }, evapCurve: [0.5, 0.3, 0.2],
    })),
  },
  {
    // missing accord: every default path
    name: 'missing-accord-defaults',
    domA: 2, domB: 3,
    result: { novelty: 0.1, viability: undefined },
  },
  {
    // planet domains (id >= 32), no interference
    name: 'planet-domains',
    domA: 71, domB: 80,
    result: res(acc({ dominant: { id: 'animalic' }, animalicIntensity: 0.2, sillage: 0.55, fixation: 0.9 }), { chimeraName: 'MERCURY × PLUTO' }),
  },
  {
    // no interference, chimeraName used for the card name
    name: 'plain-chimera-name',
    domA: 1, domB: 13,
    result: res(acc({ dominant: { id: 'resinous' }, sillage: 0.3, fixation: 0.6, persists: true, cleanRoom: 0.9, sovereignty: 0.2 }), { chimeraName: 'Abyss Echo!', convergence: [], divergence: [] }),
  },
];
