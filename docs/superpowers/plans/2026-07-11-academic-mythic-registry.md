# Academic & Mythic Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the KERNEL_OF_QUINTESSENCE artifact its 15-discipline interpretive voice — every compiled structure read by the discipline that owns it, tinted by the visitor's element — via one pure-data registry module shared by the compiler and the reliquary UI.

**Architecture:** New `src/terminal/quintessence/taxonomyRegistry.js` (pure data + `lensFor`/`ownerOf` resolver, no React, no bus). `compileKernel.js` drops its two inline fragment pools and calls `lensFor` at each lensed structure (hash inputs unchanged — lenses resolve after the hash exists, from the same hash-seeded rng). `ReliquaryView.jsx` annotates each schematic slot with `read by ⟨TAG⟩` via `ownerOf`. Spec: `docs/superpowers/specs/2026-07-11-academic-mythic-registry-design.md`.

**Tech Stack:** Vite/React, vitest (`npx vitest run <file>`), existing `mulberry32` PRNG from `src/terminal/views/manifesto/councilCollider`. Component tests use `react-dom/client` `createRoot` + `act` (see `__tests__/quintessenceAltar.test.jsx` — no testing-library).

**Voice rules for all fragments (spec §9):** quintessence register; NO alien copy; vocabulary `compile/seal/deposit/witness/read`, never `generate/submit/save/analyze`; each discipline must sound like itself; element tint is inflection, not costume.

---

## Shared vocabulary (used by every task)

**Slot ids** (the contract between compiler, registry, and reliquary):
`vial_header`, `kernel_grammar`, `daemon`, `pirarucu`, `narcos_payload`, `entropy_lock`, `necromantic_engine`, `council_pair`, `council_directive`, `verdict`, `witness_intro`, `house_ciphers`, `house_transmissions`, `house_ledger`, `house_essences`, `house_ecocide`, `house_privacy`, `house_surveillance`.

**ctx shape** (assembled inside `compileKernel`, consumed by band/detail functions):

```js
{
  spine,       // { trend: {label, velocity}, council: {pair, directive, trajectory, paradoxCount}, phase, element }
  periphery,   // snapshotPeriphery() result (nullable groups; houses: {ecocide, ledger, privacy, surveillance})
  meta: { dryness, bpm, verdict, daemon, filledHouses },  // computed by compileKernel before lensing
}
```

**Multi-slot owners** (spec §4): HISTORY owns `house_transmissions` + `house_ledger`; SOCIOLOGY owns `house_ecocide` + `house_privacy` + `house_surveillance`. In the artifact each group emits ONE lens line above its first owned line; in the reliquary every slot is annotated individually.

---

### Task 1: Registry data — `TAXONOMY` + `ownerOf`

**Files:**
- Create: `src/terminal/quintessence/taxonomyRegistry.js`
- Test: `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`

- [ ] **Step 1: Write the failing completeness tests**

Create `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`:

```js
// src/terminal/quintessence/__tests__/taxonomyRegistry.test.js — the faculty roster (spec §8).
import { describe, it, expect } from 'vitest';
import { TAXONOMY, ownerOf } from '../taxonomyRegistry';

const TINTS = ['FIRE', 'WATER', 'AIR', 'EARTH'];

describe('taxonomyRegistry — completeness', () => {
  it('seats all 15 disciplines across the three tiers (5 humanities, 6 soft sciences, 4 overlap pairs)', () => {
    expect(TAXONOMY).toHaveLength(15);
    const byTier = { HUMANITIES: 0, SOFT_SCIENCES: 0, OVERLAP_MATRIX: 0 };
    for (const d of TAXONOMY) byTier[d.tier]++;
    expect(byTier.HUMANITIES).toBe(5);
    expect(byTier.SOFT_SCIENCES).toBe(6);
    expect(byTier.OVERLAP_MATRIX).toBe(4);
  });

  it('every overlap-matrix entry carries the double tag', () => {
    for (const d of TAXONOMY.filter(d => d.tier === 'OVERLAP_MATRIX'))
      expect(d.tag).toContain('⇄');
  });

  it('every slot has exactly one owner', () => {
    const all = TAXONOMY.flatMap(d => d.owns);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(18); // every artifact slot seated
  });

  it('every band pool carries all four tints with ≥2 fragments each (spec §5)', () => {
    for (const d of TAXONOMY)
      for (const [band, tints] of Object.entries(d.pools))
        for (const el of TINTS)
          expect(tints[el]?.length, `${d.id}.${band}.${el}`).toBeGreaterThanOrEqual(2);
  });

  it('ownerOf resolves the reliquary annotations', () => {
    expect(ownerOf('narcos_payload')).toBe('SEMIOTICS');
    expect(ownerOf('pirarucu')).toBe('CHEMISTRY ⇄ ALCHEMY');
    expect(ownerOf('house_ledger')).toBe('HISTORY');
    expect(ownerOf('house_privacy')).toBe('SOCIOLOGY');
    expect(ownerOf('not_a_slot')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: FAIL — cannot resolve `../taxonomyRegistry`.

- [ ] **Step 3: Write the registry data module**

Create `src/terminal/quintessence/taxonomyRegistry.js` with the complete content below. This is the feature's creative payload — copy the fragments exactly; do not paraphrase or trim.

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/taxonomyRegistry.js src/terminal/quintessence/__tests__/taxonomyRegistry.test.js
git commit -m "feat(quintessence): the academic & mythic registry — 15-discipline faculty roster"
```

---

### Task 2: The resolver — `lensFor`

**Files:**
- Modify: `src/terminal/quintessence/taxonomyRegistry.js` (append `lensFor` after `ownerOf`)
- Test: `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js` (append a describe block)

- [ ] **Step 1: Write the failing resolver tests**

Append to `src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`. Add `lensFor` to the existing import and `mulberry32`:

```js
import { TAXONOMY, ownerOf, lensFor } from '../taxonomyRegistry';
import { mulberry32 } from '../../views/manifesto/councilCollider';
```

Then append:

```js
const CTX = {
  spine: {
    trend: { label: 'degrowth', velocity: 0.9 },
    council: { pair: ['ELINOR OSTROM', 'NORBERT WIENER'], directive: 'd', trajectory: 'FOUNDATION', paradoxCount: 3 },
    phase: 'SMOKE DISSOLUTION',
    element: 'FIRE',
  },
  periphery: {
    ciphers: { sealed: 1, verifies: 2, unlocks: 1 },
    transmissions: { count: 4, ledgerDepth: 2, lastKernel: 'FSF-12.1.0' },
    essences: { collisions: 2, crystallized: 1, polarity: 'RADIANT' },
    lunarRead: { phase: 'Waxing Gibbous', illum: 0.82 },
    houses: { ecocide: 1, ledger: null, privacy: 3, surveillance: null },
  },
  meta: { dryness: 85, bpm: 172, verdict: 'PLATA', daemon: 'TheDevil', filledHouses: 6 },
};

describe('lensFor — the reading', () => {
  it('is deterministic: same ctx + seed → identical line', () => {
    const a = lensFor('narcos_payload', CTX, mulberry32(42));
    const b = lensFor('narcos_payload', CTX, mulberry32(42));
    expect(a).toBe(b);
    expect(a).toMatch(/^⟨SEMIOTICS⟩ /);
  });

  it('interpolates the visitor value as detail', () => {
    const line = lensFor('narcos_payload', CTX, mulberry32(1));
    expect(line).toContain('velocity 0.90 read as murmur');
    const astro = lensFor('entropy_lock', CTX, mulberry32(1));
    expect(astro).toContain('82.0% illuminated');
  });

  it('band edges land as documented (spec §5)', () => {
    const at = (slot, ctx) => {
      const entry = TAXONOMY.find(d => d.owns.includes(slot));
      return entry.band(ctx);
    };
    const withVelocity = v => ({ ...CTX, spine: { ...CTX.spine, trend: { label: 't', velocity: v } } });
    expect(at('narcos_payload', withVelocity(0.99))).toBe('murmur');
    expect(at('narcos_payload', withVelocity(1))).toBe('current');
    expect(at('narcos_payload', withVelocity(3))).toBe('panic');

    const withDryness = d => ({ ...CTX, meta: { ...CTX.meta, dryness: d } });
    expect(at('pirarucu', withDryness(39))).toBe('green');
    expect(at('pirarucu', withDryness(40))).toBe('burn');
    expect(at('pirarucu', withDryness(70))).toBe('mineral');

    const withIllum = i => ({ ...CTX, periphery: { ...CTX.periphery, lunarRead: i == null ? null : { phase: 'p', illum: i } } });
    expect(at('entropy_lock', withIllum(0.24))).toBe('dark');
    expect(at('entropy_lock', withIllum(0.25))).toBe('crescent');
    expect(at('entropy_lock', withIllum(0.5))).toBe('gibbous');
    expect(at('entropy_lock', withIllum(0.75))).toBe('full');
    expect(at('entropy_lock', withIllum(null))).toBe('absent');

    const withBpm = b => ({ ...CTX, meta: { ...CTX.meta, bpm: b } });
    expect(at('necromantic_engine', withBpm(159))).toBe('calcifying');
    expect(at('necromantic_engine', withBpm(160))).toBe('chaotic'); // mirrors the Plata threshold

    const withParadox = n => ({ ...CTX, spine: { ...CTX.spine, council: { ...CTX.spine.council, paradoxCount: n } } });
    expect(at('council_pair', withParadox(0))).toBe('monolith');
    expect(at('council_pair', withParadox(1))).toBe('dialectic');
    expect(at('council_pair', withParadox(2))).toBe('polyphony');

    const withFilled = n => ({ ...CTX, meta: { ...CTX.meta, filledHouses: n } });
    expect(at('witness_intro', withFilled(2))).toBe('sparse');
    expect(at('witness_intro', withFilled(3))).toBe('attended');
    expect(at('witness_intro', withFilled(6))).toBe('dense');
  });

  it('unknown slot returns a tagged fallback, does not throw', () => {
    const line = lensFor('not_a_slot', CTX, mulberry32(7));
    expect(line).toBe('⟨UNREGISTERED⟩ the reading resists its instrument');
  });

  it('never throws on a hollow ctx — degrades to a valid reading', () => {
    const line = lensFor('narcos_payload', { spine: {} }, mulberry32(7));
    expect(line).toMatch(/^⟨SEMIOTICS⟩ /); // velocity→0→murmur, element→AIR default
  });
});
```

- [ ] **Step 2: Run to verify the new block fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: FAIL — `lensFor` is not exported.

- [ ] **Step 3: Append `lensFor` to `taxonomyRegistry.js`**

Append after `ownerOf`:

```js
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
```

- [ ] **Step 4: Run the full registry test file**

Run: `npx vitest run src/terminal/quintessence/__tests__/taxonomyRegistry.test.js`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/taxonomyRegistry.js src/terminal/quintessence/__tests__/taxonomyRegistry.test.js
git commit -m "feat(quintessence): lensFor — band→tint→seeded-pick reading resolver"
```

---

### Task 3: Compiler integration — the faculty speaks in the artifact

**Files:**
- Modify: `src/terminal/quintessence/compileKernel.js`
- Test: `src/terminal/quintessence/__tests__/compileKernel.test.js` (append tests; existing tests must keep passing)

- [ ] **Step 1: Write the failing integration tests**

Append inside the existing `describe('compileKernel', …)` block in `compileKernel.test.js`:

```js
  it('every faculty tag appears in the artifact (registry spec §4)', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const TAGS = [
      'LITERATURE & PHILOLOGY', 'PHILOSOPHY', 'AESTHETICS', 'HISTORY', 'RELIGIOUS STUDIES',
      'SEMIOTICS', 'PSYCHOLOGY', 'SOCIOLOGY', 'ANTHROPOLOGY', 'LINGUISTICS', 'ECONOMICS',
      'ASTRONOMY ⇄ ASTROLOGY', 'CHEMISTRY ⇄ ALCHEMY', 'COGNITIVE SCIENCE ⇄ MYTHOLOGY', 'LINGUISTICS ⇄ HERMETICS',
    ];
    for (const tag of TAGS) expect(source, tag).toContain(`⟨${tag}⟩`);
  });

  it('engine_witness stays unlensed — computed, not narrated (registry spec §4)', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    const start = source.indexOf('mod engine_witness');
    const end = source.indexOf('THE PERIPHERAL WITNESS');
    expect(start).toBeGreaterThan(-1);
    expect(source.slice(start, end)).not.toContain('⟨');
  });

  it('multi-slot owners emit one grouped lens line (HISTORY, SOCIOLOGY)', async () => {
    const { source } = await compileKernel(FULL_SPINE, FULL_PERIPHERY, ENGINE, OPTS);
    expect(source.match(/⟨HISTORY⟩/g)).toHaveLength(1);
    expect(source.match(/⟨SOCIOLOGY⟩/g)).toHaveLength(1);
  });
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: the three new tests FAIL (no `⟨` in the artifact yet); all pre-existing tests still PASS.

- [ ] **Step 3: Rewire `compileKernel.js`**

Apply these exact edits:

**(a) Imports** — add the registry, and delete the now-unused pools/helper:

```js
import { lensFor } from './taxonomyRegistry';
```

Delete the `VIAL_LINES` and `CORRUPTION_LINES` const blocks and the `pick` helper function (its only two call sites go away below). Keep `houseLine` unchanged.

**(b) ctx assembly** — inside `compileKernel`, after the existing line `const [mindA, mindB] = spine.council.pair;`, add:

```js
  const filledHouses =
    [periphery.ciphers, periphery.transmissions, periphery.essences, periphery.lunarRead]
      .filter(Boolean).length +
    Object.values(periphery.houses).filter(Boolean).length;
  // The faculty's reading context (registry spec §6). Assembled AFTER the hash:
  // lenses are voice, not identity — hash inputs are untouched.
  const ctx = { spine, periphery, meta: { dryness, bpm, verdict, daemon: el.daemon, filledHouses } };
```

**(c) Template edits** — in the `source` template literal, make these replacements (template order = rng consumption order; keep it exactly as written for determinism):

1. The grammar lens. Replace:

```
#![no_std]

use core::sync::atomic::AtomicU64;
```

with:

```
#![no_std]

/// ${lensFor('kernel_grammar', ctx, rng)}
use core::sync::atomic::AtomicU64;
```

2. The vial + daemon lenses. Replace:

```
/// ${pick(rng, VIAL_LINES)}
/// element: ${spine.element} · role: ${el.atom} · daemon compiled ${el.daemon === 'TheDevil' ? 'unmasked' : 'masked'}
```

with:

```
/// ${lensFor('vial_header', ctx, rng)}
/// ${lensFor('daemon', ctx, rng)}
/// element: ${spine.element} · role: ${el.atom} · daemon compiled ${el.daemon === 'TheDevil' ? 'unmasked' : 'masked'}
```

3. The alchemy lens. Replace:

```
/// **PIRARUCU** — the armored ideal, tempered by one olfactory phase.
/// phase: ${spine.phase} · the burn window was set here
```

with:

```
/// **PIRARUCU** — the armored ideal, tempered by one olfactory phase.
/// ${lensFor('pirarucu', ctx, rng)}
/// phase: ${spine.phase} · the burn window was set here
```

4. The semiotics lens. Replace:

```
/// **NARCOS** — ${pick(rng, CORRUPTION_LINES)}
/// the levamisole is the live network pulse, marked by the visitor:
```

with:

```
/// **NARCOS** — the contaminant that keeps the system alive.
/// ${lensFor('narcos_payload', ctx, rng)}
/// the levamisole is the live network pulse, marked by the visitor:
```

5. The astrology lens. Replace:

```
/// **SOKUSHINBUTSU** — living death, perfectly preserved.
${lunarComment}
```

with:

```
/// **SOKUSHINBUTSU** — living death, perfectly preserved.
${lunarComment}
/// ${lensFor('entropy_lock', ctx, rng)}
```

6. The psychology, philosophy, and hermetics lenses. Replace:

```
/// **THE NECROMANTIC ENGINE** — perpetual friction, never resolution.
/// This cycle reanimates: ${periphery.transmissions?.lastKernel ?? 'no mummy — the past was left unraised'}
/// The two forces in friction were chosen in council:
///   ${mindA}  ×  ${mindB}
/// ${spine.council.directive}
```

with:

```
/// **THE NECROMANTIC ENGINE** — perpetual friction, never resolution.
/// ${lensFor('necromantic_engine', ctx, rng)}
/// This cycle reanimates: ${periphery.transmissions?.lastKernel ?? 'no mummy — the past was left unraised'}
/// The two forces in friction were chosen in council:
///   ${mindA}  ×  ${mindB}
/// ${lensFor('council_pair', ctx, rng)}
/// ${lensFor('council_directive', ctx, rng)}
/// ${spine.council.directive}
```

7. The economics lens. Replace:

```
${verdict === 'PLATA'
  ? '/// vitality through corruption · the system lives compromised'
  : '/// purity chosen over life · entropic stasis · the statue wins this round'}
```

with:

```
${verdict === 'PLATA'
  ? '/// vitality through corruption · the system lives compromised'
  : '/// purity chosen over life · entropic stasis · the statue wins this round'}
/// ${lensFor('verdict', ctx, rng)}
```

8. The anthropology lens. Replace:

```
/// THE PERIPHERAL WITNESS — what the terminal saw without being asked.
/// Empty houses are part of the portrait. Absence is data.
```

with:

```
/// THE PERIPHERAL WITNESS — what the terminal saw without being asked.
/// ${lensFor('witness_intro', ctx, rng)}
/// Empty houses are part of the portrait. Absence is data.
```

9. The witness struct — reorder fields so each owner group is contiguous (HISTORY: transmissions + ledger; SOCIOLOGY: the institutional triplet), and add the grouped house lenses as `//` comments (not `///` — these sit in expression position). Replace the struct definition:

```
struct PeripheralWitness {
    ciphers: Option<&'static str>,
    transmissions: Option<&'static str>,
    essences: Option<&'static str>,
    house_ecocide: Option<&'static str>,
    house_ledger: Option<&'static str>,
    house_privacy: Option<&'static str>,
    house_surveillance: Option<&'static str>,
}
```

with:

```
struct PeripheralWitness {
    ciphers: Option<&'static str>,
    transmissions: Option<&'static str>,
    house_ledger: Option<&'static str>,
    essences: Option<&'static str>,
    house_ecocide: Option<&'static str>,
    house_privacy: Option<&'static str>,
    house_surveillance: Option<&'static str>,
}
```

and the const literal:

```
const WITNESS: PeripheralWitness = PeripheralWitness {
${houseLine('ciphers', periphery.ciphers, `cryptographic proof: ${periphery.ciphers?.verifies ?? 0} verified · ${periphery.ciphers?.unlocks ?? 0} unlocked · ${periphery.ciphers?.sealed ?? 0} sealed`)}
${houseLine('transmissions', periphery.transmissions, `${periphery.transmissions?.count ?? 0} kernels completed · ledger depth ${periphery.transmissions?.ledgerDepth ?? 0}`)}
${houseLine('essences', periphery.essences, `${periphery.essences?.collisions ?? 0} collisions · ${periphery.essences?.crystallized ?? 0} crystallized`)}
${houseLine('house_ecocide', periphery.houses.ecocide, `entered ${periphery.houses.ecocide}×`)}
${houseLine('house_ledger', periphery.houses.ledger, `entered ${periphery.houses.ledger}×`)}
${houseLine('house_privacy', periphery.houses.privacy, `entered ${periphery.houses.privacy}×`)}
${houseLine('house_surveillance', periphery.houses.surveillance, `entered ${periphery.houses.surveillance}×`)}
};
```

with:

```
const WITNESS: PeripheralWitness = PeripheralWitness {
    // ${lensFor('house_ciphers', ctx, rng)}
${houseLine('ciphers', periphery.ciphers, `cryptographic proof: ${periphery.ciphers?.verifies ?? 0} verified · ${periphery.ciphers?.unlocks ?? 0} unlocked · ${periphery.ciphers?.sealed ?? 0} sealed`)}
    // ${lensFor('house_transmissions', ctx, rng)}
${houseLine('transmissions', periphery.transmissions, `${periphery.transmissions?.count ?? 0} kernels completed · ledger depth ${periphery.transmissions?.ledgerDepth ?? 0}`)}
${houseLine('house_ledger', periphery.houses.ledger, `entered ${periphery.houses.ledger}×`)}
    // ${lensFor('house_essences', ctx, rng)}
${houseLine('essences', periphery.essences, `${periphery.essences?.collisions ?? 0} collisions · ${periphery.essences?.crystallized ?? 0} crystallized`)}
    // ${lensFor('house_ecocide', ctx, rng)}
${houseLine('house_ecocide', periphery.houses.ecocide, `entered ${periphery.houses.ecocide}×`)}
${houseLine('house_privacy', periphery.houses.privacy, `entered ${periphery.houses.privacy}×`)}
${houseLine('house_surveillance', periphery.houses.surveillance, `entered ${periphery.houses.surveillance}×`)}
};
```

- [ ] **Step 4: Run the full compileKernel suite**

Run: `npx vitest run src/terminal/quintessence/__tests__/compileKernel.test.js`
Expected: PASS — all pre-existing tests plus the three new ones. (No pre-existing test asserts on the deleted pool strings — verified 2026-07-11.)

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/compileKernel.js src/terminal/quintessence/__tests__/compileKernel.test.js
git commit -m "feat(quintessence): the faculty speaks — 15 disciplinary lenses compiled into the artifact"
```

---

### Task 4: Reliquary annotations — `read by ⟨TAG⟩`

**Files:**
- Modify: `src/terminal/quintessence/ReliquaryView.jsx:55` (slot helper) and `:109-122` (slot list) and `:144-151` (row render)
- Test: Create `src/terminal/quintessence/__tests__/reliquaryView.test.jsx`

- [ ] **Step 1: Write the failing smoke test**

Create `src/terminal/quintessence/__tests__/reliquaryView.test.jsx` (pattern copied from `quintessenceAltar.test.jsx` — `createRoot` + `act`, no testing-library; a dead bus and empty localStorage put the view in schematic mode with all houses unwitnessed):

```jsx
// src/terminal/quintessence/__tests__/reliquaryView.test.jsx — the schematic
// names its readers (registry spec §4: every slot annotated individually).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ReliquaryView from '../ReliquaryView';
import { _resetSpineForTests } from '../spineStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container = null;
let root = null;

beforeEach(() => {
  _resetSpineForTests();
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<ReliquaryView />); });
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  _resetSpineForTests();
});

describe('ReliquaryView — the faculty roster on the schematic', () => {
  it('annotates every slot with its reading discipline, filled or awaiting', () => {
    const text = container.textContent;
    expect(text).toContain('read by ⟨SEMIOTICS⟩');                       // narcos_payload
    expect(text).toContain('read by ⟨PHILOSOPHY⟩');                      // council_pair
    expect(text).toContain('read by ⟨CHEMISTRY ⇄ ALCHEMY⟩');             // pirarucu
    expect(text).toContain('read by ⟨ASTRONOMY ⇄ ASTROLOGY⟩');           // entropy_lock
    expect(text).toContain('read by ⟨COGNITIVE SCIENCE ⇄ MYTHOLOGY⟩');   // daemon
    expect(text).toContain('read by ⟨RELIGIOUS STUDIES⟩');               // house_ciphers
    expect(text).toContain('read by ⟨AESTHETICS⟩');                      // house_essences
    expect(text).toContain('read by ⟨SOCIOLOGY⟩');                       // house_ecocide + privacy + surveillance
    expect(text).toContain('read by ⟨HISTORY⟩');                         // mummy·transmission + house_ledger
  });

  it('multi-slot owners annotate each owned slot individually', () => {
    const matches = container.textContent.match(/read by ⟨SOCIOLOGY⟩/g);
    expect(matches).toHaveLength(3); // ecocide, privacy, surveillance
    expect(container.textContent.match(/read by ⟨HISTORY⟩/g)).toHaveLength(2); // mummy·transmission, ledger
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/terminal/quintessence/__tests__/reliquaryView.test.jsx`
Expected: FAIL — no `read by` text rendered.

- [ ] **Step 3: Wire the annotations into `ReliquaryView.jsx`**

**(a)** Add the import next to the existing quintessence imports:

```js
import { ownerOf } from './taxonomyRegistry';
```

**(b)** Replace the slot helper (line 55):

```js
const slot = (label, filled, preview) => ({ label, filled, preview });
```

with:

```js
const slot = (id, label, filled, preview) => ({ id, label, filled, preview });
```

**(c)** Replace the slot list (lines 109–122) — each entry gains its registry slot id (the mummy slot maps to `house_transmissions`: the transmission record is HISTORY's seat):

```js
  const slots = [
    slot('narcos_payload',      'narcos payload · bsky trend',   !!spine.trend,   spine.trend?.label),
    slot('council_pair',        'friction pair · council',       !!spine.council, spine.council?.pair?.join(' × ')),
    slot('pirarucu',            'dryness · olfactory phase',     !!spine.phase,   spine.phase),
    slot('entropy_lock',        'entropy_lock · lunar transit',  !!p.lunarRead,   p.lunarRead ? `${p.lunarRead.phase}` : null),
    slot('house_transmissions', 'mummy · transmission',          !!p.transmissions, p.transmissions?.lastKernel),
    slot('daemon',              'daemon · element',              !!spine.element, spine.element),
    slot('house_ciphers',       'house: ciphers',                !!p.ciphers,     p.ciphers && `${p.ciphers.verifies} verified`),
    slot('house_essences',      'house: essences',               !!p.essences,    p.essences && `${p.essences.collisions} collisions`),
    slot('house_ecocide',       'house: ecocide',                !!p.houses.ecocide, p.houses.ecocide && `entered ${p.houses.ecocide}×`),
    slot('house_ledger',        'house: ledger',                 !!p.houses.ledger, p.houses.ledger && `entered ${p.houses.ledger}×`),
    slot('house_privacy',       'house: privacy',                !!p.houses.privacy, p.houses.privacy && `entered ${p.houses.privacy}×`),
    slot('house_surveillance',  'house: surveillance',           !!p.houses.surveillance, p.houses.surveillance && `entered ${p.houses.surveillance}×`),
  ];
```

**(d)** Replace the row render (lines 144–151):

```jsx
        {slots.map(s => (
          <div key={s.label} className="flex gap-3 mb-1">
            <span className={s.filled ? 'text-amber-300' : 'text-zinc-700'}>
              {s.filled ? `Some(${s.preview})` : 'None'}
            </span>
            <span className="text-zinc-600">{'// ' + s.label}{!s.filled && ' · awaiting witness'}</span>
          </div>
        ))}
```

with:

```jsx
        {slots.map(s => (
          <div key={s.label} className="flex gap-3 mb-1 items-baseline">
            <span className={s.filled ? 'text-amber-300' : 'text-zinc-700'}>
              {s.filled ? `Some(${s.preview})` : 'None'}
            </span>
            <span className="text-zinc-600">{'// ' + s.label}{!s.filled && ' · awaiting witness'}</span>
            {ownerOf(s.id) && (
              <span className="ml-auto text-zinc-700 text-[9px] tracking-[0.15em] whitespace-nowrap">
                read by ⟨{ownerOf(s.id)}⟩
              </span>
            )}
          </div>
        ))}
```

- [ ] **Step 4: Run the smoke test**

Run: `npx vitest run src/terminal/quintessence/__tests__/reliquaryView.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/terminal/quintessence/ReliquaryView.jsx src/terminal/quintessence/__tests__/reliquaryView.test.jsx
git commit -m "feat(quintessence): reliquary schematic names its readers — read by ⟨DISCIPLINE⟩"
```

---

### Task 5: Full verification

**Files:** none new.

- [ ] **Step 1: Run the whole quintessence suite**

Run: `npx vitest run src/terminal/quintessence`
Expected: all files PASS (taxonomyRegistry, compileKernel, engineWitness, lunarAccords, periphery, quintessenceAltar, reliquaryView, spineStore, volatileHold).

- [ ] **Step 2: Run the full project test suite**

Run: `npx vitest run`
Expected: PASS, no regressions (~410+ tests).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: clean Vite build, no warnings about the new module.

- [ ] **Step 4: Voice audit (manual, quick)**

Grep the new module for banned vocabulary — all four must return nothing:

```bash
grep -in "alien" src/terminal/quintessence/taxonomyRegistry.js
grep -in "generate" src/terminal/quintessence/taxonomyRegistry.js
grep -in "submit" src/terminal/quintessence/taxonomyRegistry.js
grep -inE "\bsave\b" src/terminal/quintessence/taxonomyRegistry.js
```

Expected: no matches (exit code 1 from each grep).

- [ ] **Step 5: Commit anything outstanding and stop**

```bash
git status --short
```

Expected: clean tree apart from the pre-existing uncommitted `src/terminal/data/loadArticles.js` change, which is NOT part of this plan — leave it untouched.

---

## Self-review notes (plan ↔ spec)

- Spec §3 lens form → Tasks 2–3 (tag format, absence readings). §4 ownership map incl. the Linguistics `kernel_grammar` seat (spec amended 2026-07-11) → Task 1 data + Task 3 template. §5 band/tint/seed → Task 2 tests pin every documented edge incl. bpm 160 ↔ Plata mirror. §6 architecture → Task 1/2 module, Task 3 compiler, Task 4 reliquary. §7 error handling → `lensFor` fallback paths + hollow-ctx test. §8 testing → Tasks 1–5. §9 voice → fragment pools + Task 5 voice audit. §10 non-goals → nothing here touches Rust, bus events, or new UI surfaces.
- Determinism: all `lensFor` calls consume the single hash-seeded rng in fixed template order; hash inputs unchanged.
- Rendered artifact remains plausible Rust: `///` lenses attach to items; in-expression house lenses use `//`.
