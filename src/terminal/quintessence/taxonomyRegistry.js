// src/terminal/quintessence/taxonomyRegistry.js — THE ACADEMIC & MYTHIC REGISTRY.
// (spec: docs/superpowers/specs/2026-07-11-academic-mythic-registry-design.md)
// Pure data + resolver, no React, no bus. Fifteen disciplines — five humanities,
// six soft sciences, four ⇄ overlap pairs — each OWNING one or more kernel
// structures and reading the visitor's value as a tagged doc-comment lens.
// Selection is band → tint → seeded pick; deterministic under a seeded rng.
// The element tints every register: FIRE mythic-active · WATER alchemical-
// dissolving · AIR semiotic-analytic · EARTH historical-material.

const TINT_DEFAULT = 'AIR';
const FALLBACK_FRAGMENT = 'the reading resists its instrument';

export const TAXONOMY = [
  // ── HUMANITIES ──────────────────────────────────────────────────────────
  {
    id: 'literature_philology',
    tier: 'HUMANITIES',
    tag: 'LITERATURE & PHILOLOGY',
    owns: ['vial_header'],
    band: () => 'vial',
    detail: null,
    pools: {
      vial: {
        FIRE:  ['a text that burns is still a text · this one was written to ignite',
                'the epic compresses to one vial · every line still armed'],
        WATER: ['a document dissolved and re-lettered · the ink remembers being sea',
                'philology of a fluid tongue · the vial holds the solvent draft'],
        AIR:   ['a text parsed to its skeleton · syntax laid bare for carrying',
                'one session annotated in the margin of a larger work'],
        EARTH: ['a manuscript stratum · this session pressed between older pages',
                'the codex accretes · one more leaf bound into the spine'],
      },
    },
  },
  {
    id: 'philosophy',
    tier: 'HUMANITIES',
    tag: 'PHILOSOPHY',
    owns: ['council_pair'],
    band: (ctx) => {
      const n = ctx?.spine?.council?.paradoxCount ?? 0;
      return n === 0 ? 'monolith' : n === 1 ? 'dialectic' : 'polyphony';
    },
    detail: null, // paradox count already printed on the adjacent line
    pools: {
      monolith: {
        FIRE:  ['no paradox survived the burn · one will, totalized',
                'a single flame of argument · consistency as conquest'],
        WATER: ['all tension dissolved · the system settles into one solution',
                'no residue in the flask · agreement, suspiciously clear'],
        AIR:   ['the logic closes without remainder · ontology in one breath',
                'zero contradictions on record · the syllogism seals itself'],
        EARTH: ['one stratum of thought · no fault lines detected',
                'a monolith raised · ethics and logic quarried from one stone'],
      },
      dialectic: {
        FIRE:  ['one paradox kept alight · the friction is the fuel',
                'thesis and antithesis share a flame · synthesis withheld'],
        WATER: ['one tension held in suspension · neither force precipitates',
                'a single unresolved salt · the dialectic stays dissolved'],
        AIR:   ['one contradiction, load-bearing · the argument breathes through it',
                'a sanctioned antinomy · logic agrees to disagree once'],
        EARTH: ['one fault line, mapped and kept · the ground holds by flexing',
                'a productive fissure in the record · the structure leans on it'],
      },
      polyphony: {
        FIRE:  ['many fires refuse one hearth · the council burns plural',
                'paradoxes multiply · will braided from opposing flames'],
        WATER: ['tensions held in the same solution · a polyphonic suspension',
                'many salts refusing to settle · richness as turbidity'],
        AIR:   ['contradictions in counterpoint · the logic scored for many voices',
                'irreducible plural · ontology as open parliament'],
        EARTH: ['many fault lines, one standing structure · strength as argument',
                'strata that disagree and still stack · the record keeps them all'],
      },
    },
  },
  {
    id: 'aesthetics',
    tier: 'HUMANITIES',
    tag: 'AESTHETICS',
    owns: ['house_essences'],
    band: (ctx) => (ctx?.periphery?.essences ? 'witnessed' : 'absent'),
    detail: null,
    pools: {
      witnessed: {
        FIRE:  ['form struck at collision heat · beauty as controlled burn',
                'the senses fired in proportion · composition witnessed live'],
        WATER: ['essence poured into glass · form holding fragrance in solution',
                'sensory values dissolved and rebottled · the vow took shape'],
        AIR:   ['proportion measured on the wing · geometry of a passing scent',
                'the layout of sensation read closely · balance found in the field'],
        EARTH: ['form settled into matter · the accord given body and base',
                'beauty deposited · a crystallized proportion enters the record'],
      },
      absent: {
        FIRE:  ['no collision struck · the forge of form stayed cold',
                'beauty unattempted · no heat shaped these senses'],
        WATER: ['no essence bottled · the glass waits empty and clean',
                'the vow undistilled · sensation never reached solution'],
        AIR:   ['no proportion measured · the field held no geometry today',
                'the senses unconsulted · form remains hypothetical'],
        EARTH: ['nothing crystallized · the record holds no shaped matter',
                'no deposition of beauty · the stratum stays plain'],
      },
    },
  },
  {
    id: 'history',
    tier: 'HUMANITIES',
    tag: 'HISTORY',
    owns: ['house_transmissions', 'house_ledger'],
    band: (ctx) =>
      (ctx?.periphery?.transmissions || ctx?.periphery?.houses?.ledger) ? 'witnessed' : 'absent',
    detail: null,
    pools: {
      witnessed: {
        FIRE:  ['events set alight and logged · the chronicle gains a bright entry',
                'the record witnessed dispatch · history written at ignition'],
        WATER: ['the chronicle absorbs another current · log files of a moving river',
                'entries poured into the record · the ledger holds water'],
        AIR:   ['chronological log files updated · organization leaving syntax behind',
                'the append-only memory extended · friction dated and filed'],
        EARTH: ['another stratum in the chronicle · the record compacts and keeps',
                'events pressed into the ledger · archaeology in advance'],
      },
      absent: {
        FIRE:  ['nothing dispatched, nothing lit · the chronicle skips this fire',
                'no entry burned into the record · history looked elsewhere'],
        WATER: ['no current entered the chronicle · the river ran unrecorded',
                'the ledger stayed dry · no depth accrued'],
        AIR:   ['no log lines written · organization without a witness',
                'the append-only memory unappended · a dated silence'],
        EARTH: ['a gap in the strata · this era left no deposit',
                'the chronicle records an absence · even silence is dated'],
      },
    },
  },
  {
    id: 'religious_studies',
    tier: 'HUMANITIES',
    tag: 'RELIGIOUS STUDIES',
    owns: ['house_ciphers'],
    band: (ctx) => (ctx?.periphery?.ciphers ? 'witnessed' : 'absent'),
    detail: null,
    pools: {
      witnessed: {
        FIRE:  ['the sealed volumes approached with a torch · ritual verification performed',
                'rites of proof enacted · the flame read the reliquary'],
        WATER: ['ablutions before the vault · the seals touched with wet hands',
                'the mystery approached by immersion · some seals gave way'],
        AIR:   ['liturgy of verification · signatures spoken and answered',
                'the ritual network engaged · belief tested against the cipher'],
        EARTH: ['pilgrimage to the vault recorded · offerings left at the seals',
                'the reliquary visited · devotion entered into the register'],
      },
      absent: {
        FIRE:  ['no flame carried to the sealed volumes · the mystery unlit',
                'the rites unperformed · the altar of proofs stayed cold'],
        WATER: ['the sealed volumes never approached · the font undisturbed',
                'no immersion in the mystery · the vault stays dry'],
        AIR:   ['no liturgy attempted · the ciphers keep their silence',
                'the ritual network dormant · belief neither tested nor spent'],
        EARTH: ['no pilgrimage made · the vault absent from this record',
                'the reliquary unvisited · faith left no artifact here'],
      },
    },
  },

  // ── SOFT SCIENCES ───────────────────────────────────────────────────────
  {
    id: 'semiotics',
    tier: 'SOFT_SCIENCES',
    tag: 'SEMIOTICS',
    owns: ['narcos_payload'],
    band: (ctx) => {
      const v = ctx?.spine?.trend?.velocity ?? 0;
      return v < 1 ? 'murmur' : v < 3 ? 'current' : 'panic';
    },
    detail: (ctx, band) =>
      `velocity ${(ctx?.spine?.trend?.velocity ?? 0).toFixed(2)} read as ${band}`,
    pools: {
      murmur: {
        FIRE:  ['a low sign smolders · meaning banked like coals',
                'the signal whispers · ignition deferred'],
        WATER: ['the sign drifts under the surface · referent undisturbed',
                'a slow current of meaning · barely a ripple in the code'],
        AIR:   ['a quiet signifier · the network barely inflects it',
                'low-frequency sign · denotation still attached'],
        EARTH: ['a sign settling into sediment · slow enough to date',
                'the murmur enters the record · minor but archived'],
      },
      current: {
        FIRE:  ['the sign carries live heat · meaning in active circulation',
                'a burning referent passed hand to hand'],
        WATER: ['the sign rides a real current · connotation trailing like wake',
                'meaning mid-stream · the referent still visible from here'],
        AIR:   ['the signifier circulates at speed · syntax of the crowd engaged',
                'an active code · the sign trading above its printed value'],
        EARTH: ['a sign with traction · grooves forming in the record',
                'circulation deep enough to leave strata'],
      },
      panic: {
        FIRE:  ['the sign outruns its referent · pure ignition, no object',
                'semiotic wildfire · meaning consumed as fuel'],
        WATER: ['the signified drowned · the signifier swims on alone',
                'a flood of the same sign · dilution as panic'],
        AIR:   ['the sign outran its referent · velocity as the whole message',
                'empty signifier at maximum circulation · the crowd is the code'],
        EARTH: ['a stampede in the record · the stratum will read as fever',
                'the sign moves too fast to fossilize · panic noted'],
      },
    },
  },
  {
    id: 'psychology',
    tier: 'SOFT_SCIENCES',
    tag: 'PSYCHOLOGY',
    owns: ['necromantic_engine'],
    band: (ctx) => ((ctx?.meta?.bpm ?? 0) >= 160 ? 'chaotic' : 'calcifying'),
    detail: (ctx, band) =>
      `bpm ${ctx?.meta?.bpm ?? 0} · ${band === 'chaotic' ? 'past' : 'beneath'} the 160 gate`,
    pools: {
      calcifying: {
        FIRE:  ['the loop damps its own spark · arousal below ignition',
                'feedback banked · the drive idles and hardens'],
        WATER: ['the feedback loop cools toward stillness · affect settling out',
                'low pulse in deep water · the system self-soothes into set'],
        AIR:   ['gating holds · stimulus filtered to a manageable hum',
                'the loop reads sub-threshold · homeostasis as habit'],
        EARTH: ['the pulse slows into structure · habit fossilizing',
                'low-frequency feedback · character as accumulated sediment'],
      },
      chaotic: {
        FIRE:  ['the loop feeds itself past the gate · arousal as engine',
                'chaos onset · the drive eats its own governor'],
        WATER: ['the feedback overflows its channel · affect past containment',
                'turbulent solution · the psyche mixing what it meant to keep apart'],
        AIR:   ['gating anomaly · every stimulus admitted at once',
                'the loop exceeds its filter · signal and self trading places'],
        EARTH: ['tremor in the foundation · the pattern shakes its own strata',
                'the pulse outruns the record · structure yielding to storm'],
      },
    },
  },
  {
    id: 'sociology',
    tier: 'SOFT_SCIENCES',
    tag: 'SOCIOLOGY',
    owns: ['house_ecocide', 'house_privacy', 'house_surveillance'],
    band: (ctx) => {
      const h = ctx?.periphery?.houses ?? {};
      return (h.ecocide || h.privacy || h.surveillance) ? 'witnessed' : 'absent';
    },
    detail: null,
    pools: {
      witnessed: {
        FIRE:  ['the institutions entered with the lights on · friction inspected at source',
                'collective heat observed · the visitor walked the burning wings'],
        WATER: ['the visitor moved through institutional channels · current mapped from inside',
                'the institutional watershed traced · pressure read at the pipes'],
        AIR:   ['institutional logic surveyed · the panopticon examined from the walkway',
                'collective patterns read in circulation · norms caught mid-air'],
        EARTH: ['the load-bearing institutions toured · foundations checked for rot',
                'systemic friction cored and sampled · the visitor dug where it hurts'],
      },
      absent: {
        FIRE:  ['the burning wings unvisited · institutional heat unexamined',
                'no inspection of the collective fire · the structure burns unobserved'],
        WATER: ['the institutional channels unswum · pressure unread at the pipes',
                'no soundings taken · the collective depth stays notional'],
        AIR:   ['the panopticon unexamined · surveillance of the surveillers declined',
                'institutional logic unsurveyed · norms circulate unread'],
        EARTH: ['the foundations unchecked · systemic rot neither found nor cleared',
                'no core samples of the collective · the strata keep their friction'],
      },
    },
  },
  {
    id: 'anthropology',
    tier: 'SOFT_SCIENCES',
    tag: 'ANTHROPOLOGY',
    owns: ['witness_intro'],
    band: (ctx) => {
      const n = ctx?.meta?.filledHouses ?? 0;
      return n < 3 ? 'sparse' : n < 6 ? 'attended' : 'dense';
    },
    detail: (ctx) => `${ctx?.meta?.filledHouses ?? 0} of 8 houses witnessed`,
    pools: {
      sparse: {
        FIRE:  ['a brief visitation · the fieldworker logs a passing flame',
                'few hearths lit · the settlement barely entered'],
        WATER: ['shallow immersion · the visitor skimmed the culture’s surface',
                'few vessels touched · the fieldnotes mostly water'],
        AIR:   ['thin observation · a survey taken from altitude',
                'sparse traces · the informant kept their distance'],
        EARTH: ['a light footprint in the midden · little for future digs',
                'few artifacts deposited · the site reads as passage, not dwelling'],
      },
      attended: {
        FIRE:  ['several hearths visited · the ritual round half-completed',
                'a warming presence · the fieldwork found its fires'],
        WATER: ['a real immersion · several vessels entered and tasted',
                'the visitor waded in · fieldnotes damp with participation'],
        AIR:   ['a fair census · most customs observed at close range',
                'attentive traverse · the informant walked and was walked with'],
        EARTH: ['a habitation layer forms · the site was genuinely lived',
                'several artifacts in situ · dwelling, not just passing'],
      },
      dense: {
        FIRE:  ['every hearth found burning · full ceremonial attendance',
                'the visitor fed all the fires · initiation-grade presence'],
        WATER: ['total immersion · the culture and the visitor exchange minerals',
                'every vessel entered · the fieldnotes are saturated'],
        AIR:   ['exhaustive observation · the lattice mapped house by house',
                'a complete census · nothing in the settlement unrecorded'],
        EARTH: ['a thick habitation layer · future digs will call this a city',
                'dense deposition · the visitor became part of the stratigraphy'],
      },
    },
  },
  {
    id: 'linguistics',
    tier: 'SOFT_SCIENCES',
    tag: 'LINGUISTICS',
    owns: ['kernel_grammar'],
    band: () => 'grammar',
    detail: null,
    pools: {
      grammar: {
        FIRE:  ['a dead tongue that still executes · imperative mood throughout',
                'syntax forged to run · every clause a command'],
        WATER: ['borrowed grammar in fluid use · the core lends two words',
                'a tongue that pours · morphology dissolved into use'],
        AIR:   ['two imports · the kernel’s entire grammar on loan from the core',
                'minimal phonology, strict syntax · a language of declarations'],
        EARTH: ['a grammar quarried from core · no standard-library dialect',
                'old roots, load-bearing · etymology as foundation'],
      },
    },
  },
  {
    id: 'economics',
    tier: 'SOFT_SCIENCES',
    tag: 'ECONOMICS',
    owns: ['verdict'],
    band: (ctx) => (ctx?.meta?.verdict === 'PLATA' ? 'plata' : 'plomo'),
    detail: null,
    pools: {
      plata: {
        FIRE:  ['silver taken at the barrel · liquidity chosen over purity',
                'the market for vitality clears · corruption pays its dividend'],
        WATER: ['silver flows · the system priced its own contamination and paid',
                'liquid settlement · solvency through admitted impurity'],
        AIR:   ['the ledger prefers a live debtor · silver as rational choice',
                'incentives read correctly · the bribe is cheaper than the funeral'],
        EARTH: ['silver enters the ground rich · the estate survives compromised',
                'the account stays open · value hoarded in impure ore'],
      },
      plomo: {
        FIRE:  ['lead chosen · purity spends its last heat on refusal',
                'the offer declined · the fire pays in full, in ash'],
        WATER: ['lead sinks · the solution seizes rather than trade',
                'no settlement · the account freezes at the bottom'],
        AIR:   ['a priced refusal · scarcity of compromise, surplus of stone',
                'the model predicts calcification · the agent obliges'],
        EARTH: ['lead in the stratum · the estate closes clean and dead',
                'purity banked forever · a vault no one can spend'],
      },
    },
  },

  // ── OVERLAP MATRIX ──────────────────────────────────────────────────────
  {
    id: 'astronomy_astrology',
    tier: 'OVERLAP_MATRIX',
    tag: 'ASTRONOMY ⇄ ASTROLOGY',
    owns: ['entropy_lock'],
    band: (ctx) => {
      const i = ctx?.periphery?.lunarRead?.illum;
      if (typeof i !== 'number') return 'absent';
      return i < 0.25 ? 'dark' : i < 0.5 ? 'crescent' : i < 0.75 ? 'gibbous' : 'full';
    },
    detail: (ctx, band) =>
      band === 'absent' ? null : `${(ctx.periphery.lunarRead.illum * 100).toFixed(1)}% illuminated`,
    pools: {
      dark: {
        FIRE:  ['new moon · the archetype banks its fire and waits',
                'orbital dark · will without witness'],
        WATER: ['the tide pulls from an unlit body · undertow horoscope',
                'dark water, dark satellite · the pull is still exact'],
        AIR:   ['near-zero albedo · the chart reads as held breath',
                'a dark transit measured precisely · absence with coordinates'],
        EARTH: ['the unlit moon still moves the ground · gravity keeps records',
                'dark phase entered into the almanac · the field rests'],
      },
      crescent: {
        FIRE:  ['first light on the limb · the archetype striking its match',
                'a crescent whets itself · intention taking edge'],
        WATER: ['a thin tide begins · the vessel tilts toward filling',
                'crescent pull · the solution starts to lean'],
        AIR:   ['a measured sliver · the ephemeris says beginning',
                'partial phase · the sign ascending on schedule'],
        EARTH: ['the crescent plows its first furrow · sowing phase logged',
                'thin light on old stone · the cycle re-inscribed'],
      },
      gibbous: {
        FIRE:  ['the disc nearly ablaze · momentum past its hinge',
                'gibbous surge · the archetype leans into fullness'],
        WATER: ['a swelling tide · most of the vessel already claimed',
                'gibbous water rising · the pull past argument'],
        AIR:   ['the curve approaches unity · forecast tightening',
                'waxing gibbous read as commitment · the chart agrees'],
        EARTH: ['heavy light on the field · harvest within reach',
                'the almanac marks late waxing · stores accumulating'],
      },
      full: {
        FIRE:  ['full disc · the memory palace floodlit',
                'the archetype at maximum exposure · nothing withheld'],
        WATER: ['spring tide of the psyche · every channel filled',
                'full illumination on open water · no shadow to hide the reading'],
        AIR:   ['albedo at ceiling · orbital fact and omen agree tonight',
                'the chart and the telescope reconcile · full phase'],
        EARTH: ['full light on the strata · every layer legible',
                'harvest moon in the record · the ground gives up its accounting'],
      },
      absent: {
        FIRE:  ['no transit taken · the fire never looked up',
                'the sky unconsulted · the archetype travels unlit'],
        WATER: ['no tide table drawn · the vessel sails by feel',
                'the moon unread · the water keeps its own counsel'],
        AIR:   ['the clock was never wound · zero written where the sky should be',
                'no ephemeris consulted · the chart is a held breath'],
        EARTH: ['no almanac entry · the field went unmeasured this season',
                'the sky left out of the record · strata without stars'],
      },
    },
  },
  {
    id: 'chemistry_alchemy',
    tier: 'OVERLAP_MATRIX',
    tag: 'CHEMISTRY ⇄ ALCHEMY',
    owns: ['pirarucu'],
    band: (ctx) => {
      const d = ctx?.meta?.dryness ?? 0;
      return d < 40 ? 'green' : d < 70 ? 'burn' : 'mineral';
    },
    detail: (ctx, band) => `dryness ${ctx?.meta?.dryness ?? 0} read as ${band}`,
    pools: {
      green: {
        FIRE:  ['sap meets flame · saponification barely begun',
                'green matter offered early to the burn'],
        WATER: ['still wet with beginnings · the lye has not yet spoken',
                'emergence in solution · nothing precipitated yet'],
        AIR:   ['volatiles rising · the reaction reads as opening',
                'early ester notes · the equation still unbalanced'],
        EARTH: ['unfired clay · the phase holds its water',
                'green stratum · purification pending'],
      },
      burn: {
        FIRE:  ['mid-saponification · the Pottasche does its violent mercy',
                'the burn window open · matter spiritualizing on schedule'],
        WATER: ['dissolution at working temperature · salts trading places',
                'the tincture concentrates · water leaving as intended'],
        AIR:   ['equilibrium in transit · the reaction breathing both ways',
                'measured combustion · products and reagents in argument'],
        EARTH: ['the kiln holds · matter pressed toward its refined form',
                'half-calcined · the stratum learning to be stone'],
      },
      mineral: {
        FIRE:  ['the fire has finished speaking · ash as achievement',
                'calcination complete · what remains cannot burn again'],
        WATER: ['all water surrendered · the crystal keeps its lattice silence',
                'dry precipitate · the solution’s final confession'],
        AIR:   ['no volatiles left · the reading is pure salt',
                'mineral stillness · the equation closed and balanced'],
        EARTH: ['stone at last · purification recorded in the stratum',
                'the ascetic residue · matter refined past appetite'],
      },
    },
  },
  {
    id: 'cogsci_mythology',
    tier: 'OVERLAP_MATRIX',
    tag: 'COGNITIVE SCIENCE ⇄ MYTHOLOGY',
    owns: ['daemon'],
    band: (ctx) => (ctx?.meta?.daemon === 'TheDevil' ? 'devil' : 'mask'),
    detail: null,
    pools: {
      mask: {
        FIRE:  ['the mask holds even here · persona over pulse',
                'armor worn on the face · the archetype defers the flame'],
        WATER: ['the persona floats · what is beneath stays beneath',
                'the mask is a meniscus · surface tension as psyche'],
        AIR:   ['persona as protocol · the gate stays gated',
                'the mask measures what it hides · sensory gating intact'],
        EARTH: ['the mask calcifies into a face · stratum over shadow',
                'persona sedimented · the shadow keeps its cave'],
      },
      devil: {
        FIRE:  ['the shadow steps forward unmasked · will without persona',
                'the trickster takes the fire card · archetype in open flame'],
        WATER: ['the shadow surfaces · what was dissolved now speaks',
                'unmasked in solution · the daemon wets its lips'],
        AIR:   ['the shadow names itself in clear syntax · no gate, no gauze',
                'unmasked signal · the archetype reads back its own trace'],
        EARTH: ['the shadow unearthed · the oldest layer walks',
                'the daemon leaves the stratum · record of an open face'],
      },
    },
  },
  {
    id: 'linguistics_hermetics',
    tier: 'OVERLAP_MATRIX',
    tag: 'LINGUISTICS ⇄ HERMETICS',
    owns: ['council_directive'],
    band: () => 'cipher',
    detail: null,
    pools: {
      cipher: {
        FIRE:  ['the directive is a spoken spell · text meant to alter its reader',
                'an incantation in imperative case · say it and the world shifts'],
        WATER: ['a cipher poured into a listening vessel · the words work by soaking',
                'language as solvent · the directive dissolves what it names'],
        AIR:   ['a statistical rune · syntax engineered to execute elsewhere',
                'the sentence is the mechanism · grammar warping its referent'],
        EARTH: ['a carved instruction · rune-logic pressed into the record',
                'words with foundations · the directive builds where it is read'],
      },
    },
  },
];

/** Reliquary annotation: which discipline reads this slot. null if unowned. */
export function ownerOf(slotId) {
  const entry = TAXONOMY.find(d => d.owns.includes(slotId));
  return entry ? entry.tag : null;
}

/**
 * The reading (spec §5): band → tint → seeded pick → tagged line.
 * Deterministic under a seeded rng. Never throws, never blocks a compile:
 * unknown slots and missing pools degrade to a tagged fallback fragment.
 * Returns the line WITHOUT the `/// ` prefix — the caller owns the comment form.
 */
export function lensFor(slotId, ctx, rng) {
  const entry = TAXONOMY.find(d => d.owns.includes(slotId));
  if (!entry) return `⟨UNREGISTERED⟩ ${FALLBACK_FRAGMENT}`;

  let band = null;
  try { band = entry.band(ctx); } catch (_) { band = null; }

  const tint = ctx?.spine?.element ?? TINT_DEFAULT;
  const pool = entry.pools[band]?.[tint] ?? entry.pools[band]?.[TINT_DEFAULT];
  const fragment = pool?.length ? pool[Math.floor(rng() * pool.length)] : FALLBACK_FRAGMENT;

  let detail = null;
  try { detail = entry.detail ? entry.detail(ctx, band) : null; } catch (_) { detail = null; }

  return `⟨${entry.tag}⟩ ${fragment}${detail ? ' · ' + detail : ''}`;
}
