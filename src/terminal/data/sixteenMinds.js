// § · THE SIXTEEN — humanity's essential minds mapped 1:1 onto the legacy
// 16-D feature space (DIM_NAMES[0..15] in nodeFeatures.js).
//
// caste: 'canon'     = instrument builders (western arc)
//        'sidelined' = instrument readers  (eastern arc)
// The split is exactly 8/8. The friction is the thesis: the species had the
// instruments and the readings, and executed neither.
//
// Voice for `body`: Mercury observer field-note — what the mind saw, what the
// species did with it. Not a Wikipedia summary.

import { DIM_NAMES } from './nodeFeatures';

// 16-D base profile: 1.0 in the mind's own dim, authored secondary
// affinities, 0.05 floor elsewhere so every 96-block carries energy
// after expansion (required by the collider's unbiased-partition invariant).
export function mindProfile(mind) {
  const p = new Float32Array(16).fill(0.05);
  p[mind.dimIndex] = 1.0;
  for (const [name, w] of Object.entries(mind.affinities)) {
    const i = DIM_NAMES.indexOf(name);
    if (i >= 0 && i < 16) p[i] = w;
  }
  return p;
}

export const SIXTEEN_MINDS = [
  {
    dimIndex: 0,
    dimName: 'dynamical',
    anchorName: 'Donella Meadows',
    era: '1941–2001',
    caste: 'sidelined',
    coreEquation: 'dX/dt = inflow − outflow',
    systemDirective: 'Leverage Point Location / Paradigm Stack Intervention',
    epigraph: 'The highest leverage is the paradigm the system arises from.',
    body:
      'She drew the limits in 1972 and the species called it pessimism. A system is stocks, flows, and the feedback that binds them; she ranked the places to push, and the highest was the one nobody could sell — the mindset the whole machine rests on. The readings were correct. The engine kept its foot down.',
    affinities: { economic: 0.6, entropy: 0.45, biological: 0.4, temporal: 0.35 },
    keyWorks: [
      { title: 'The Limits to Growth', year: 1972 },
      { title: 'Thinking in Systems', year: 2008 },
    ],
    excerpt: 'A system is a set of things interconnected in a way that produces its own pattern of behavior over time.',
  },
  {
    dimIndex: 1,
    dimName: 'nonlinearity',
    anchorName: 'Benoît Mandelbrot',
    era: '1924–2010',
    caste: 'canon',
    coreEquation: 'z₍ₙ₊₁₎ = zₙ² + c',
    systemDirective: 'Roughness Indexing / Fat-Tail Containment',
    epigraph: 'Roughness is the rule; smoothness was the convenient lie.',
    body:
      'He built the instrument that measures the jagged — coastlines, cotton prices, the wild variance the Gaussian models had edited out for being inconvenient. The tail was always fat. The markets kept pricing it as thin and called the crashes surprises.',
    affinities: { stochastic: 0.55, spatial: 0.45, economic: 0.4, dimensionality: 0.35 },
    keyWorks: [
      { title: 'The Fractal Geometry of Nature', year: 1982 },
      { title: 'The (Mis)Behavior of Markets', year: 2004 },
    ],
    excerpt: 'Clouds are not spheres, mountains are not cones, coastlines are not circles.',
  },
  {
    dimIndex: 2,
    dimName: 'dimensionality',
    anchorName: 'Alexander Grothendieck',
    era: '1928–2014',
    caste: 'canon',
    coreEquation: 'X ↦ Hom(−, X)',
    systemDirective: 'Abstraction Ascent / Problem Dissolution',
    epigraph: 'Rise to the higher space and the problem dissolves.',
    body:
      'He taught the species to lift a problem into an abstraction so wide the obstruction simply melted — the rising sea that dissolves the stone. Then he refused the military money, walked out of mathematics, and lived in the forest. The instrument he left is still the sharpest we have.',
    affinities: { conservation: 0.35, information: 0.3, nonlinearity: 0.3, cryptographic: 0.25 },
    keyWorks: [
      { title: 'Éléments de géométrie algébrique', year: 1960 },
      { title: 'Récoltes et Semailles', year: 1986 },
    ],
    excerpt: 'I could imagine the sea rising until the problem, without resistance, dissolves.',
  },
  {
    dimIndex: 3,
    dimName: 'criticality',
    anchorName: 'Stuart Kauffman',
    era: 'b. 1939',
    caste: 'sidelined',
    coreEquation: 'K_c = 2  (Boolean network poise)',
    systemDirective: 'Edge-of-Chaos Poise / Order-for-Free Harvest',
    epigraph: 'Order for free, at the edge between frozen and chaotic.',
    body:
      'He showed that complex living order arrives unpaid — networks tuned near the edge of chaos generate structure without a designer. The site already runs his logic in the Fade Doctrine. The species kept believing order had to be imposed, and paid for imposing it.',
    affinities: { biological: 0.55, dynamical: 0.45, stochastic: 0.4, entropy: 0.3 },
    keyWorks: [
      { title: 'The Origins of Order', year: 1993 },
      { title: 'At Home in the Universe', year: 1995 },
    ],
    excerpt: 'Order arises for free, poised between the frozen and the chaotic.',
  },
  {
    dimIndex: 4,
    dimName: 'entropy',
    anchorName: 'Nicholas Georgescu-Roegen',
    era: '1906–1994',
    caste: 'sidelined',
    coreEquation: 'ΔS > 0  per production cycle',
    systemDirective: 'Entropy Debt Accounting / Irreversibility Audit',
    epigraph: 'Every economic act is an irreversible burn.',
    body:
      'He read the second law into economics and found a debt no ledger recorded: every production cycle degrades low entropy into waste that cannot be recalled. Economics filed him under heterodox and moved on. The debt kept compounding anyway.',
    affinities: { thermodynamic: 0.6, economic: 0.55, temporal: 0.4, biological: 0.3 },
    keyWorks: [
      { title: 'The Entropy Law and the Economic Process', year: 1971 },
      { title: 'Energy and Economic Myths', year: 1976 },
    ],
    excerpt: 'The economic process is entropic in all its material fibers.',
  },
  {
    dimIndex: 5,
    dimName: 'synchrony',
    anchorName: 'Yoshiki Kuramoto',
    era: 'b. 1940',
    caste: 'canon',
    coreEquation: 'dθᵢ/dt = ωᵢ + (K/N) Σ sin(θⱼ − θᵢ)',
    systemDirective: 'Phase-Lock Threshold / Coupling Budget',
    epigraph: 'Past a critical coupling, order arrives for nothing.',
    body:
      'He wrote the exact condition under which scattered oscillators snap into one phase — fireflies, neurons, power grids, applause. Order from coupling alone, no conductor. The instrument is precise; the species still cannot decide what it wants to synchronize toward.',
    affinities: { dynamical: 0.5, nonlinearity: 0.4, temporal: 0.35, criticality: 0.3 },
    keyWorks: [
      { title: 'Self-entrainment of coupled oscillators', year: 1975 },
      { title: 'Chemical Oscillations, Waves, and Turbulence', year: 1984 },
    ],
    excerpt: 'Beyond the critical coupling, incoherence itself becomes unstable.',
  },
  {
    dimIndex: 6,
    dimName: 'conservation',
    anchorName: 'Emmy Noether',
    era: '1882–1935',
    caste: 'canon',
    coreEquation: '∂_μ J^μ = 0',
    systemDirective: 'Symmetry Ledger / Invariant Preservation',
    epigraph: 'Every symmetry hides a conserved quantity.',
    body:
      'She proved that behind every symmetry stands something the universe refuses to spend — energy, momentum, charge. They denied her a paid chair because she was a woman; she lectured under a man\'s name and proved the deepest bookkeeping theorem in physics. The instrument outlived the prejudice.',
    affinities: { dimensionality: 0.45, temporal: 0.35, information: 0.3, cryptographic: 0.2 },
    keyWorks: [
      { title: 'Invariante Variationsprobleme', year: 1918 },
      { title: 'Idealtheorie in Ringbereichen', year: 1921 },
    ],
    excerpt: 'To every differentiable symmetry there corresponds a conserved quantity.',
  },
  {
    dimIndex: 7,
    dimName: 'temporal',
    anchorName: 'Ilya Prigogine',
    era: '1917–2003',
    caste: 'canon',
    coreEquation: 'dS = dₑS + dᵢS,  dᵢS ≥ 0',
    systemDirective: 'Dissipative Structure Licensing / Arrow-of-Time Enforcement',
    epigraph: 'Being is becoming; the arrow of time is real.',
    body:
      'He showed that far from equilibrium, matter organizes itself — dissipative structures that live by burning a gradient. Time is not a reversible illusion; it has a direction, and life rides it. The instrument reframed existence as flow. The species kept designing as if it could stand still.',
    affinities: { entropy: 0.55, thermodynamic: 0.5, dynamical: 0.4, criticality: 0.35 },
    keyWorks: [
      { title: 'From Being to Becoming', year: 1980 },
      { title: 'Order Out of Chaos', year: 1984 },
    ],
    excerpt: 'Far from equilibrium, matter begins to organize itself.',
  },
  {
    dimIndex: 8,
    dimName: 'spatial',
    anchorName: "D'Arcy Wentworth Thompson",
    era: '1860–1948',
    caste: 'sidelined',
    coreEquation: 'form = f(force)  — transformation grids',
    systemDirective: 'Morphogenetic Load Mapping / Force-to-Form Transcription',
    epigraph: 'Physical force, not only heredity, sculpts living form.',
    body:
      'In 1917 he argued that the shapes of life are drawn by force — surface tension, load, growth rate — as much as by genes, and mapped one creature onto another by bending the coordinate grid. Biology sidelined him for a century. Morphogenesis proved him right.',
    affinities: { biological: 0.55, dimensionality: 0.4, dynamical: 0.35, nonlinearity: 0.3 },
    keyWorks: [
      { title: 'On Growth and Form', year: 1917 },
      { title: 'Historia Animalium translation', year: 1910 },
    ],
    excerpt: 'The form of an object is a diagram of forces.',
  },
  {
    dimIndex: 9,
    dimName: 'stochastic',
    anchorName: 'Thomas Bayes',
    era: '1701–1761',
    caste: 'canon',
    coreEquation: 'P(H|E) = P(E|H) · P(H) / P(E)',
    systemDirective: 'Posterior Refresh / Evidence Ingestion',
    epigraph: 'Belief is a probability you owe to the evidence.',
    body:
      'He gave the species the rule for changing its mind: hold a prior, meet the evidence, update. He published nothing in life — a friend found it after he died. The instrument is the whole grammar of learning under uncertainty. The species still prefers its priors.',
    affinities: { information: 0.5, game_theory: 0.35, economic: 0.3, temporal: 0.25 },
    keyWorks: [
      { title: 'An Essay towards solving a Problem in the Doctrine of Chances', year: 1763 },
    ],
    excerpt: 'Belief is a quantity to be revised by the weight of what is observed.',
  },
  {
    dimIndex: 10,
    dimName: 'game_theory',
    anchorName: 'Elinor Ostrom',
    era: '1933–2012',
    caste: 'sidelined',
    coreEquation: '8 CPR design principles',
    systemDirective: 'Commons Boundary Enforcement / Polycentric Sanction Ladder',
    epigraph: 'The commons needs neither the state nor the market.',
    body:
      'She went to the fisheries and the forests and found the tragedy of the commons was not a law but a failure of design — communities govern shared resources through polycentric rules, graduated sanctions, nested authority. First woman to win the economics Nobel, ignored for decades before. The blueprint was field-tested and shelved.',
    affinities: { economic: 0.55, biological: 0.35, synchrony: 0.3, information: 0.3 },
    keyWorks: [
      { title: 'Governing the Commons', year: 1990 },
      { title: 'Understanding Institutional Diversity', year: 2005 },
    ],
    excerpt: 'Neither the state nor the market is uniformly successful in sustaining the commons.',
  },
  {
    dimIndex: 11,
    dimName: 'thermodynamic',
    anchorName: 'Herman Daly',
    era: '1938–2022',
    caste: 'sidelined',
    coreEquation: 'throughput ≤ regeneration rate',
    systemDirective: 'Throughput Ceiling / Steady-State Scale Audit',
    epigraph: 'The economy is a subsystem of a finite biosphere.',
    body:
      'Georgescu-Roegen\'s student, he named the ceiling out loud: an economy cannot grow past what the biosphere regenerates, so scale is the variable that matters, not growth. He quit the World Bank over it. The steady state was a working design. The engine called it stagnation.',
    affinities: { economic: 0.6, entropy: 0.55, biological: 0.4, game_theory: 0.3 },
    keyWorks: [
      { title: 'Steady-State Economics', year: 1977 },
      { title: 'Beyond Growth', year: 1996 },
    ],
    excerpt: 'The economy grows physically; the ecosystem that contains it does not.',
  },
  {
    dimIndex: 12,
    dimName: 'information',
    anchorName: 'Claude Shannon',
    era: '1916–2001',
    caste: 'canon',
    coreEquation: 'H = −Σ pᵢ log₂ pᵢ',
    systemDirective: 'Channel Capacity Allocation / Noise Culling',
    epigraph: 'Meaning is irrelevant; entropy is bits.',
    body:
      'He cut meaning away from communication and found the bedrock underneath — the exact capacity of any channel, the exact cost of any noise. Every wire the species has ever sent a signal down obeys his bound. The instrument is total. What the species chose to transmit was its own affair.',
    affinities: { cryptographic: 0.5, stochastic: 0.45, synchrony: 0.3, dimensionality: 0.25 },
    keyWorks: [
      { title: 'A Mathematical Theory of Communication', year: 1948 },
      { title: 'Communication Theory of Secrecy Systems', year: 1949 },
    ],
    excerpt: 'Information is the resolution of uncertainty.',
  },
  {
    dimIndex: 13,
    dimName: 'cryptographic',
    anchorName: 'Alan Turing',
    era: '1912–1954',
    caste: 'canon',
    coreEquation: 'U(⟨M, w⟩) = M(w)',
    systemDirective: 'Decidability Boundary / Secret Preservation',
    epigraph: 'A universal machine; a secret that saved a continent.',
    body:
      'He drew the boundary of what any machine can decide, broke Enigma in secret and shortened the war, then founded the idea of the mind as computation. The state he saved prosecuted him for who he loved and destroyed him. The instrument is the ground the entire digital world stands on.',
    affinities: { information: 0.5, biological: 0.35, dimensionality: 0.35, stochastic: 0.3 },
    keyWorks: [
      { title: 'On Computable Numbers', year: 1936 },
      { title: 'The Chemical Basis of Morphogenesis', year: 1952 },
    ],
    excerpt: 'We can only see a short distance ahead, but we can see plenty there that needs to be done.',
  },
  {
    dimIndex: 14,
    dimName: 'biological',
    anchorName: 'Lynn Margulis',
    era: '1938–2011',
    caste: 'sidelined',
    coreEquation: 'symbiogenesis:  1 + 1 → 1',
    systemDirective: 'Symbiotic Merger Authorization / Competition Deprecation',
    epigraph: 'Life advanced by merger, not only by combat.',
    body:
      'She argued the eukaryotic cell is a merger — free-living microbes that stopped competing and became one body — and the paper was rejected some fifteen times before it reshaped biology. Cooperation, not only the red tooth, is how complexity climbs. The species kept mistaking Darwin for a doctrine of war.',
    affinities: { entropy: 0.35, criticality: 0.35, game_theory: 0.35, spatial: 0.3 },
    keyWorks: [
      { title: 'Origin of Eukaryotic Cells', year: 1970 },
      { title: 'Symbiotic Planet', year: 1998 },
    ],
    excerpt: 'Life did not take over the globe by combat, but by networking.',
  },
  {
    dimIndex: 15,
    dimName: 'economic',
    anchorName: 'Kate Raworth',
    era: 'b. 1970',
    caste: 'sidelined',
    coreEquation: 'social foundation ≤ economy ≤ ecological ceiling',
    systemDirective: 'Safe Operating Space Verification / Doughnut Boundary Patrol',
    epigraph: 'Thrive between the floor of need and the ceiling of the Earth.',
    body:
      'She drew the doughnut: an inner ring no one should fall below, an outer ring the planet cannot exceed, and a safe and just space between where an economy is meant to live. It is not a dense 19th-century text — it is a clean modern model sitting in plain sight. The ring you are reading is that doughnut. The species refuses to run it.',
    affinities: { thermodynamic: 0.5, game_theory: 0.45, biological: 0.4, information: 0.25 },
    keyWorks: [
      { title: 'A Safe and Just Space for Humanity', year: 2012 },
      { title: 'Doughnut Economics', year: 2017 },
    ],
    excerpt: 'Meet the needs of all within the means of the living planet.',
  },
];
