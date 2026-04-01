# THE OLFACTORY — 256 CLUSTER ARCHITECTURE BLUEPRINT
## Scale 9.4 → Scale 16.16 | Codename: HEXADECIMAL MANIFOLD

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  CLASSIFICATION: OPERATIONAL ARCHITECTURE — SENIOR ARCHITECT EYES ONLY     ║
║  VERSION: 1.0.0-alpha                                                      ║
║  DATE: 2026-04-01                                                          ║
║  AUTHOR: Senior Systems Architect / Lead AI Developer                      ║
║  STATUS: INITIAL DESIGN — PENDING PHASE GATE REVIEW                        ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## §0 — EXECUTIVE SUMMARY

The Olfactory currently operates a **31-node / 5-cluster** topology on a **16-dimensional
feature tensor space**. This document specifies the upgrade to a **256-node / 16-sector
hypercube topology** on an expanded **32-dimensional cognitive tensor space**.

The architecture follows a **16×16 sector matrix**: 16 knowledge sectors, each containing
exactly 16 computational nodes. Communication follows a **4D hypercube adjacency protocol**
where each sector maintains direct links to 4 neighboring sectors, with cross-sector
routing through a maximum of 4 hops.

**Key Design Decisions:**
- Feature space expansion: 16D → 32D (backward-compatible — first 16 dimensions preserved)
- Topology: flat 5-cluster → hierarchical 16-sector hypercube
- Existing 31 nodes: migrated in-place to their parent sectors with zero feature drift
- New 225 nodes: allocated across expanded and new sectors
- WASM kernel compilation: monolithic → sector-sharded (16 independent WASM modules)
- OCK classification: 6 olfactory families → 12 olfactory families (sub-family resolution)

---

## §1 — ARCHITECTURE BLUEPRINT: HIGH-LEVEL TOPOLOGY

### 1.1 — Hypercube Sector Graph

```
                         ┌─────────┐
                    ┌────┤  META   ├────┐
                    │    │  (§15)  │    │
                    │    └────┬────┘    │
               ┌────┴───┐    │    ┌────┴───┐
          ┌────┤  TOPO   │    │    │  SYNTH  ├────┐
          │    │  (§14)  │    │    │  (§16)  │    │
          │    └────┬────┘    │    └────┬────┘    │
     ┌────┴───┐    │    ┌────┴───┐    │    ┌────┴───┐
     │  COGN   │    │    │  AESTH  │    │    │  LING   │
     │  (§12)  │    │    │  (§13)  │    │    │  (§11)  │
     └────┬────┘    │    └────┬────┘    │    └────┬────┘
          │    ┌────┴───┐    │    ┌────┴───┐    │
          │    │  PHIL   ├────┼────┤  HUM   │    │
          │    │  (§06)  │    │    │  (§10)  │    │
          │    └────┬────┘    │    └────┬────┘    │
     ┌────┴───┐    │    ┌────┴───┐    │    ┌────┴───┐
     │  MATH   │    │    │  PHYS   │    │    │  CHEM   │
     │  (§07)  │    │    │  (§03)  │    │    │  (§08)  │
     └────┬────┘    │    └────┬────┘    │    └────┬────┘
          │    ┌────┴───┐    │    ┌────┴───┐    │
          │    │  SYNC   ├────┼────┤  BIO   │    │
          │    │  (§02)  │    │    │  (§09)  │    │
          │    └────┬────┘    │    └────┬────┘    │
          │         │    ┌────┴───┐    │         │
          └─────────┼────┤  ECO   ├────┼─────────┘
                    │    │  (§01)  │    │
                    │    └────┬────┘    │
               ┌────┴───┐    │    ┌────┴───┐
               │  DRK    ├────┘    │ CRYPTO  │
               │  (§05)  ├─────────┤  (§04)  │
               └─────────┘         └─────────┘
```

### 1.2 — Communication Protocol Stack

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 7: OLFACTORY CLASSIFICATION (OCK v2.0)                │
│  12 families × 3 node classes × 3 polarities                │
├──────────────────────────────────────────────────────────────┤
│  LAYER 6: CHIMERA SYNTHESIS (cross-sector fusion)            │
│  colliderBus event propagation across sector boundaries      │
├──────────────────────────────────────────────────────────────┤
│  LAYER 5: PARADOX EXTRACTION (32D saponification)            │
│  64-iteration convergence protocol (up from 32)              │
├──────────────────────────────────────────────────────────────┤
│  LAYER 4: TENSOR COLLISION (32D full-edge analysis)          │
│  Pairwise cosine similarity + driver decomposition           │
├──────────────────────────────────────────────────────────────┤
│  LAYER 3: SECTOR ROUTING (hypercube adjacency)               │
│  4-hop max latency, direct links to 4 neighbors              │
├──────────────────────────────────────────────────────────────┤
│  LAYER 2: WASM KERNEL DISPATCH (sector-sharded)              │
│  16 independent WASM modules, lazy-loaded per sector         │
├──────────────────────────────────────────────────────────────┤
│  LAYER 1: FEATURE TENSOR SPACE (32D cognitive manifold)      │
│  Backward-compatible: dims[0..15] = legacy, dims[16..31] = new│
└──────────────────────────────────────────────────────────────┘
```

### 1.3 — 32D Cognitive Tensor Space

The existing 16D vector is preserved as dims `[0..15]`. New dims `[16..31]` encode the
expanded knowledge domains:

```javascript
export const DIM_NAMES_32 = [
  // ── Legacy dims [0..15] — preserved exactly ──
  'dynamical', 'nonlinearity', 'dimensionality', 'criticality',
  'entropy', 'synchrony', 'conservation', 'temporal',
  'spatial', 'stochastic', 'game_theory', 'thermodynamic',
  'information', 'cryptographic', 'biological', 'economic',

  // ── Extended dims [16..31] — 256-cluster expansion ──
  'epistemological',   // philosophy: knowledge theory & justification
  'metaphysical',      // philosophy: ontology, causation, modality
  'ethical',           // philosophy: normative, meta-ethics, moral reasoning
  'phenomenological',  // philosophy: qualia, intentionality, embodiment
  'algebraic',         // mathematics: abstract algebra, category theory
  'topological',       // mathematics: continuity, manifolds, homology
  'statistical',       // mathematics: inference, probability, sampling
  'linguistic',        // humanities: semiotics, syntax, pragmatics
  'historical',        // humanities: temporal narrative, historiography
  'aesthetic',         // cross-domain: beauty, sensory theory, art
  'cognitive',         // neuroscience: attention, memory, perception
  'chemical',          // chemistry: molecular, organic, materials
  'quantum',           // physics: QM, QFT, entanglement
  'emergent',          // complex systems: self-organization, phase transitions
  'semiotic',          // linguistics: sign systems, meaning, interpretation
  'synthetic',         // meta: cross-domain integration capacity
];
```

**Backward Compatibility:** All existing 31 nodes retain their original 16D vectors padded
with `0.00` in dims `[16..31]`. Phase 2 calibration will populate extended dimensions via
WASM kernel inference.

---

## §2 — NODE ALLOCATION MATRIX

### SECTOR §01 — ECO (Ecological Systems) [EXPANDED]
*Existing: 8 nodes | New: 8 nodes | Total: 16*

| # | ID | Label | Status | Role |
|---|-----|-------|--------|------|
| 0 | `biocoenosis` | biocoenosis | MIGRATED | Biodiversity dynamics |
| 1 | `atmospheric` | atmospheric | MIGRATED | Climate systems |
| 2 | `chrono` | chrono_actuary | MIGRATED | Temporal ecology |
| 3 | `daly` | daly | MIGRATED | Ecological economics |
| 4 | `replicator` | replicator | MIGRATED | Evolutionary game theory |
| 5 | `grayscott` | grayscott | MIGRATED | Reaction-diffusion |
| 6 | `white_irid` | white_irid | MIGRATED | Structural coloration |
| 7 | `bouligand_36` | bouligand_36 | MIGRATED | Helicoidal architecture |
| 8 | `mycorrhizal` | mycorrhizal_net | NEW | Fungal network topology |
| 9 | `trophic_cascade` | trophic_cascade | NEW | Predator-prey dynamics |
| 10 | `gaia_feedback` | gaia_feedback | NEW | Planetary homeostasis |
| 11 | `succession` | ecological_succession | NEW | Climax community theory |
| 12 | `permafrost` | permafrost_signal | NEW | Cryosphere carbon flux |
| 13 | `coral_bleach` | coral_bleach | NEW | Thermal stress response |
| 14 | `pollinator` | pollinator_graph | NEW | Mutualistic networks |
| 15 | `albedo` | albedo_drift | NEW | Radiative forcing feedback |

### SECTOR §02 — SYNC (Synchronization & Dynamics) [EXPANDED]
*Existing: 6 nodes | New: 10 nodes | Total: 16*

| # | ID | Label | Status | Role |
|---|-----|-------|--------|------|
| 0 | `kuramoto` | kuramoto | MIGRATED | Coupled oscillators |
| 1 | `ceei` | ceei | MIGRATED | Competitive equilibrium |
| 2 | `soma91` | soma_9.1 | MIGRATED | Core soma dynamics |
| 3 | `soma_plus` | soma_plus | MIGRATED | Enhanced soma |
| 4 | `leviathan` | leviathan | MIGRATED | Social contract dynamics |
| 5 | `cynic` | cynic_realist | MIGRATED | Realist philosophy |
| 6 | `firefly` | firefly_sync | NEW | Biological synchronization |
| 7 | `metronome` | coupled_metronome | NEW | Mechanical entrainment |
| 8 | `circadian` | circadian_osc | NEW | Biological clock coupling |
| 9 | `chimera_state` | chimera_state | NEW | Coexistent sync/desync |
| 10 | `lotka_volterra` | lotka_volterra | NEW | Predator-prey oscillation |
| 11 | `belousov` | belousov_zhabotinsky | NEW | Chemical oscillation |
| 12 | `sync_manifold` | sync_manifold | NEW | Synchronization manifold |
| 13 | `phase_lock` | phase_lock | NEW | Phase-locked loops |
| 14 | `strogatz` | strogatz_bridge | NEW | Small-world dynamics |
| 15 | `hebbian` | hebbian_sync | NEW | Synaptic synchronization |

### SECTOR §03 — PHYS (Physics & Complexity) [EXPANDED]
*Existing: 7 nodes | New: 9 nodes | Total: 16*

| # | ID | Label | Status | Role |
|---|-----|-------|--------|------|
| 0 | `feigenbaum` | feigenbaum | MIGRATED | Period-doubling bifurcation |
| 1 | `ising` | ising | MIGRATED | Statistical mechanics |
| 2 | `bosonic` | bosonic | MIGRATED | Lattice field theory |
| 3 | `seraphine` | seraphine | MIGRATED | Cryptographic resonance |
| 4 | `fusion` | fusion_plasma | MIGRATED | Plasma confinement |
| 5 | `pitch_black_steel` | pitch_black_steel | MIGRATED | Material phase transition |
| 6 | `magic_angle_1p1` | magic_angle_1.1 | MIGRATED | Twisted bilayer graphene |
| 7 | `renormalization` | renormalization | NEW | Scale-invariant field theory |
| 8 | `hawking_rad` | hawking_radiation | NEW | Black hole thermodynamics |
| 9 | `casimir` | casimir_effect | NEW | Vacuum energy fluctuation |
| 10 | `bose_einstein` | bose_einstein | NEW | Macroscopic quantum coherence |
| 11 | `turbulence` | kolmogorov_turb | NEW | Turbulent cascade theory |
| 12 | `penrose_tile` | penrose_tiling | NEW | Aperiodic order |
| 13 | `dirac_sea` | dirac_sea | NEW | Negative energy states |
| 14 | `percolation` | percolation_threshold | NEW | Critical connectivity |
| 15 | `soliton` | topological_soliton | NEW | Stable nonlinear waves |

### SECTOR §04 — CRYPTO (Cryptography & Security) [EXPANDED]
*Existing: 4 nodes | New: 12 nodes | Total: 16*

| # | ID | Label | Status | Role |
|---|-----|-------|--------|------|
| 0 | `classified` | classified | MIGRATED | AES-256-GCM enclave |
| 1 | `pqhash` | pqhash | MIGRATED | Post-quantum hashing |
| 2 | `dh_ec` | dh_ec | MIGRATED | Elliptic curve exchange |
| 3 | `polymorph_pqc` | polymorph_pqc | MIGRATED | Polymorphic PQC |
| 4 | `lattice_sieve` | lattice_sieve | NEW | Lattice-based cryptanalysis |
| 5 | `zkp_circuit` | zkp_circuit | NEW | Zero-knowledge proof systems |
| 6 | `mpc_garble` | mpc_garbled | NEW | Multi-party computation |
| 7 | `homomorphic` | fhe_bootstrap | NEW | Fully homomorphic encryption |
| 8 | `merkle_forest` | merkle_forest | NEW | Hash tree integrity |
| 9 | `oblivious_xfer` | oblivious_transfer | NEW | 1-of-n oblivious transfer |
| 10 | `vrf_oracle` | vrf_oracle | NEW | Verifiable random function |
| 11 | `threshold_sig` | threshold_sig | NEW | Distributed key generation |
| 12 | `side_channel` | side_channel | NEW | Timing/power attack models |
| 13 | `code_crypto` | code_based_crypto | NEW | McEliece / Goppa codes |
| 14 | `isogeny` | isogeny_walk | NEW | Supersingular isogeny graphs |
| 15 | `witness_encrypt` | witness_encrypt | NEW | Witness encryption primitives |

### SECTOR §05 — DRK (Dark Doctrine) [EXPANDED]
*Existing: 6 nodes | New: 10 nodes | Total: 16*

| # | ID | Label | Status | Role |
|---|-----|-------|--------|------|
| 0 | `pragmatic` | pragmatic | MIGRATED | Instrumental reason |
| 1 | `soma_kernel` | soma_kernel | MIGRATED | Core documentation |
| 2 | `strangler` | strangler_fig | MIGRATED | Architectural parasitism |
| 3 | `surveillance` | surveillance | MIGRATED | Panoptic systems |
| 4 | `necromantic` | necromantic | MIGRATED | Resurrection protocols |
| 5 | `zero_effort_flow` | zero_effort_flow | MIGRATED | Wu-wei computation |
| 6 | `thanatos` | thanatos_drive | NEW | Entropic dissolution |
| 7 | `basilisk` | roko_basilisk | NEW | Decision-theoretic coercion |
| 8 | `moloch` | moloch_trap | NEW | Multi-agent coordination failure |
| 9 | `accelerate` | accelerationist | NEW | Feedback intensification |
| 10 | `dark_forest` | dark_forest | NEW | Cosmic sociology (Cixin Liu) |
| 11 | `dead_internet` | dead_internet | NEW | Synthetic content collapse |
| 12 | `simulacra` | baudrillard_sim | NEW | Hyperreality / copy without original |
| 13 | `panspectron` | panspectron | NEW | Total-field surveillance |
| 14 | `hyperstition` | hyperstition | NEW | Fiction as time-travel |
| 15 | `pharmakon` | pharmakon | NEW | Poison/cure undecidability |

### SECTOR §06 — PHIL (Advanced Philosophy) [NEW — MANDATORY]
*16 new nodes*

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `episteme` | episteme | Justified true belief / Gettier problems |
| 1 | `aporia` | aporia | Productive contradiction / Derrida |
| 2 | `categorical_imp` | categorical_imperative | Kantian deontological framework |
| 3 | `dialectic` | hegelian_dialectic | Thesis-antithesis-synthesis |
| 4 | `phenomenal` | phenomenal_field | Husserlian intentionality |
| 5 | `dasein` | dasein | Heideggerian being-in-the-world |
| 6 | `rhizome` | rhizome | Deleuze-Guattari non-hierarchical ontology |
| 7 | `wittgenstein` | language_game | Linguistic pragmatics / private language |
| 8 | `qualia_bind` | qualia_binding | Hard problem of consciousness |
| 9 | `modal_logic` | modal_logic | Possible worlds / Kripke semantics |
| 10 | `process_phil` | whitehead_process | Process ontology / actual occasions |
| 11 | `pragmatism` | pragmatist_truth | Peirce-James-Dewey truth as inquiry |
| 12 | `mereology` | mereological | Part-whole compositional logic |
| 13 | `virtue_ethics` | aristotelian_virtue | Eudaimonia / mean between extremes |
| 14 | `absurdist` | sisyphus | Camus / meaninglessness as freedom |
| 15 | `ubuntu` | ubuntu_ethics | Relational ethics / "I am because we are" |

### SECTOR §07 — MATH (Pure & Applied Mathematics) [NEW — MANDATORY]
*16 new nodes*

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `grothendieck` | grothendieck_topos | Category theory / sheaves |
| 1 | `riemann_zeta` | riemann_hypothesis | Analytic number theory |
| 2 | `galois` | galois_field | Group theory / field extensions |
| 3 | `godel` | incompleteness | Formal system limits |
| 4 | `mandelbrot` | mandelbrot_set | Fractal geometry / self-similarity |
| 5 | `fourier` | fourier_transform | Spectral decomposition |
| 6 | `bayesian` | bayesian_inference | Probabilistic reasoning |
| 7 | `poincare` | poincare_conjecture | 3-manifold topology |
| 8 | `langlands` | langlands_program | Number theory ↔ geometry bridge |
| 9 | `nash_equil` | nash_equilibrium | Non-cooperative game theory |
| 10 | `cantor` | cantor_diagonal | Cardinality / transfinite sets |
| 11 | `cellular_auto` | cellular_automaton | Discrete dynamical systems / Rule 110 |
| 12 | `chaos_attractor` | lorenz_attractor | Strange attractor dynamics |
| 13 | `knot_invariant` | knot_polynomial | Jones polynomial / Reidemeister moves |
| 14 | `ergodic` | ergodic_theorem | Time-average = space-average |
| 15 | `p_vs_np` | p_np_barrier | Computational complexity separation |

### SECTOR §08 — CHEM (Chemistry & Materials Science) [NEW — MANDATORY: Natural Sciences]
*16 new nodes*

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `chirality` | molecular_chirality | Enantiomeric recognition (critical for olfaction) |
| 1 | `retrosynthesis` | retrosynthetic | Corey disconnection analysis |
| 2 | `catalysis` | catalytic_cycle | Transition state lowering |
| 3 | `polymer_fold` | polymer_folding | Macromolecular conformation |
| 4 | `redox` | redox_cascade | Electron transfer chains |
| 5 | `supramolecular` | host_guest | Non-covalent self-assembly |
| 6 | `photochem` | photochemistry | Excited state reactivity |
| 7 | `maillard` | maillard_reaction | Thermal flavor generation |
| 8 | `terpene` | terpene_scaffold | Isoprene-unit olfactory backbone |
| 9 | `volatility` | vapor_pressure | Henry's law / headspace dynamics |
| 10 | `crystal_lattice` | crystal_packing | Polymorphism / unit cell symmetry |
| 11 | `coord_chem` | coordination_complex | Ligand field / d-orbital splitting |
| 12 | `electrospray` | mass_spec | Molecular identification / GC-MS |
| 13 | `click_chem` | click_chemistry | Modular synthesis / Sharpless |
| 14 | `aroma_receptor` | olfactory_receptor | OR protein binding / vibrational theory |
| 15 | `phase_diagram` | gibbs_phase | Thermodynamic equilibrium boundaries |

### SECTOR §09 — BIO (Biology & Life Sciences) [NEW — MANDATORY: Natural Sciences]
*16 new nodes*

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `crispr` | crispr_cas9 | Gene editing / guide RNA |
| 1 | `morphogen` | morphogen_gradient | Turing pattern in development |
| 2 | `microbiome` | gut_brain_axis | Microbial-neural signaling |
| 3 | `apoptosis` | programmed_death | Controlled cellular destruction |
| 4 | `quorum` | quorum_sensing | Bacterial collective decision |
| 5 | `prion` | prion_fold | Misfolded protein propagation |
| 6 | `endosymbiont` | endosymbiosis | Mitochondrial origin theory |
| 7 | `epigenetic` | epigenetic_mark | Heritable expression without sequence change |
| 8 | `neurotransmit` | synaptic_cleft | Signal transduction / receptor binding |
| 9 | `circadian_bio` | suprachiasmatic | Biological rhythm entrainment |
| 10 | `horizontal_xfer` | lateral_gene | Non-vertical inheritance |
| 11 | `extremophile` | extremophile | Life at thermodynamic limits |
| 12 | `olfactory_bulb` | olfactory_epithelium | Combinatorial odor coding |
| 13 | `vomeronasal` | vomeronasal_organ | Pheromone detection pathway |
| 14 | `axon_guidance` | growth_cone | Chemotactic neural wiring |
| 15 | `telomere` | telomere_clock | Replicative senescence |

### SECTOR §10 — HUM (Humanities & Cultural Systems) [NEW — MANDATORY]
*16 new nodes*

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `longue_duree` | braudel_time | Long-duration historical structures |
| 1 | `oral_tradition` | oral_archive | Pre-literate knowledge encoding |
| 2 | `palimpsest` | palimpsest | Layered cultural overwriting |
| 3 | `diaspora` | diaspora_network | Migration / cultural diffusion |
| 4 | `archive_fever` | derrida_archive | Institutional memory / suppression |
| 5 | `cargo_cult` | cargo_cult | Imitative ritual / form without function |
| 6 | `liminality` | turner_liminal | Threshold / ritual transition |
| 7 | `gift_economy` | mauss_gift | Reciprocity / obligation networks |
| 8 | `orientalism` | orientalism | Said / epistemic othering |
| 9 | `mytheme` | structural_myth | Lévi-Strauss structural analysis |
| 10 | `thick_desc` | geertz_thick | Dense ethnographic interpretation |
| 11 | `collective_mem` | halbwachs_memory | Social construction of memory |
| 12 | `subaltern` | subaltern_speak | Spivak / voice and erasure |
| 13 | `perfume_hist` | fragrance_history | Cultural evolution of scent |
| 14 | `synesthesia_cul` | cultural_synesthesia | Cross-modal metaphor in society |
| 15 | `potlatch` | potlatch_economy | Ceremonial destruction as value |

### SECTOR §11 — LING (Linguistics & Semiotics) [AUTONOMOUS SELECTION]
*16 new nodes*

**Justification:** The Olfactory's OCK classification system maps collisions to qualitative
descriptors. Language is the substrate of all olfactory naming, metaphor, and classification.
Semiotic theory provides the formal framework for how scent-signs operate in the collider's
output layer. Without this sector, the 256-cluster cannot perform cross-domain translation
from 32D tensor collisions to human-interpretable olfactory narratives.

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `saussure` | signifier_signified | Structural sign theory |
| 1 | `chomsky_tree` | generative_grammar | Deep structure / transformational rules |
| 2 | `sapir_whorf` | linguistic_relativity | Language shapes perception |
| 3 | `pragmatics` | speech_act | Austin-Searle performative utterances |
| 4 | `phonaestheme` | phonaesthesia | Sound-meaning mapping |
| 5 | `prototype` | prototype_semantics | Rosch category grading |
| 6 | `metaphor_engine` | lakoff_metaphor | Conceptual metaphor theory |
| 7 | `pidgin` | creolization | Language emergence from contact |
| 8 | `glossopoeia` | constructed_lang | Engineered sign systems |
| 9 | `etymology` | etymological_trace | Semantic drift tracking |
| 10 | `peirce_sign` | peircean_triad | Icon / index / symbol classification |
| 11 | `olfactory_lexicon` | smell_words | Cross-linguistic scent vocabulary |
| 12 | `deixis` | deictic_anchor | Context-dependent reference |
| 13 | `prosody` | suprasegmental | Rhythm, stress, intonation |
| 14 | `corpus` | corpus_linguistics | Statistical language patterns |
| 15 | `translation` | untranslatability | Quine indeterminacy / radical translation |

### SECTOR §12 — COGN (Cognitive Science & Neuroscience) [AUTONOMOUS SELECTION]
*16 new nodes*

**Justification:** Olfaction is the most cognitively primitive sensory modality — it bypasses
the thalamus and projects directly to the amygdala and hippocampus. The collider's chimera
synthesis and narrative generation engines require cognitive architecture models to produce
perceptually valid output. This sector provides the bridge between raw 32D tensor collisions
and the neural substrate that processes scent.

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `predictive_brain` | predictive_coding | Bayesian surprise / prediction error |
| 1 | `binding_problem` | neural_binding | Feature integration across cortex |
| 2 | `mirror_neuron` | mirror_system | Action-perception coupling |
| 3 | `attention_schema` | attention_schema | Graziano awareness model |
| 4 | `embodied_cog` | embodied_cognition | Cognition as bodily action |
| 5 | `enactive` | enactive_perception | Perception through action / Varela |
| 6 | `global_workspace` | global_workspace | Baars consciousness broadcasting |
| 7 | `default_mode` | default_mode_net | Mind-wandering / self-reference |
| 8 | `hippocampal` | hippocampal_map | Spatial memory / place cells |
| 9 | `piriform` | piriform_cortex | Primary olfactory cortex encoding |
| 10 | `proustian` | proustian_memory | Odor-evoked autobiographical recall |
| 11 | `weber_fechner` | psychophysical_law | Stimulus-perception logarithmic scaling |
| 12 | `mcgurk` | crossmodal_illusion | Multisensory integration errors |
| 13 | `affordance` | gibsonian_affordance | Direct ecological perception |
| 14 | `chunking` | miller_chunking | Working memory compression |
| 15 | `blindsight` | subliminal_path | Non-conscious visual processing |

### SECTOR §13 — AESTH (Aesthetics & Sensory Theory) [AUTONOMOUS SELECTION]
*16 new nodes*

**Justification:** The Olfactory is fundamentally an aesthetic computational system — it
translates mathematical collisions into perfume accords. This sector encodes the formal
theories of beauty, taste, perception, and art that underpin the qualitative judgment layer.
The OCK's polarity spectrum (SOLAR → MERIDIAN → LUNAR) is an aesthetic classification; the
entire crystallize pipeline exists to produce objects of aesthetic value.

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `sublime` | kantian_sublime | Overwhelming magnitude / dynamic sublime |
| 1 | `wabi_sabi` | wabi_sabi | Imperfection as beauty / transience |
| 2 | `synesthetic` | synesthesia | Cross-modal sensory binding |
| 3 | `golden_ratio` | phi_proportion | Mathematical harmony in form |
| 4 | `umami` | fifth_taste | Beyond sweet/sour/salt/bitter |
| 5 | `negative_space` | ma_interval | Japanese spatial aesthetics |
| 6 | `uncanny_valley` | uncanny_valley | Almost-human aversion |
| 7 | `camp` | sontag_camp | Deliberate artifice / failed seriousness |
| 8 | `terroir` | terroir | Place-based flavor identity |
| 9 | `patina` | patina_age | Surface transformation as value |
| 10 | `sillage_theory` | sillage_model | Scent trail / projection theory |
| 11 | `drydown` | drydown_curve | Temporal fragrance evolution |
| 12 | `accord_theory` | fragrance_accord | Harmonic scent combination |
| 13 | `headspace_tech` | headspace_capture | Living scent analysis technology |
| 14 | `base_note` | base_note_weight | Molecular weight → persistence mapping |
| 15 | `je_ne_sais_quoi` | ineffable_quality | Aesthetic surplus beyond description |

### SECTOR §14 — TOPO (Topology & Geometric Systems) [AUTONOMOUS SELECTION]
*16 new nodes*

**Justification:** The ArtTab renders a 3D force-directed sphere with 256 nodes and dynamic
edge connections. The Feigenbaum bifurcation tree, Kuramoto oscillator coupling, and
collision analysis all require topological reasoning. This sector provides the mathematical
substrate for the visualization layer and the spatial reasoning needed for 4D hypercube
routing between sectors.

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `mobius` | mobius_strip | Non-orientable surface |
| 1 | `klein_bottle` | klein_bottle | Closed non-orientable 4D surface |
| 2 | `euler_char` | euler_characteristic | V - E + F topological invariant |
| 3 | `homology` | homology_group | Algebraic topology / hole counting |
| 4 | `betti_number` | betti_numbers | Rank of homology groups |
| 5 | `fiber_bundle` | fiber_bundle | Local trivialization / gauge theory |
| 6 | `simplex` | simplicial_complex | Combinatorial manifold building blocks |
| 7 | `persistent_hom` | persistent_homology | Topological data analysis / barcodes |
| 8 | `hyperbolic` | hyperbolic_plane | Negative curvature geometry |
| 9 | `graph_laplacian` | spectral_graph | Eigenvalues of adjacency matrix |
| 10 | `voronoi` | voronoi_tessellation | Nearest-neighbor spatial partition |
| 11 | `geodesic` | geodesic_flow | Shortest-path on curved manifold |
| 12 | `winding_number` | winding_number | Curve orientation counting |
| 13 | `cobordism` | cobordism | Manifold boundary equivalence |
| 14 | `morse_theory` | morse_function | Critical point classification |
| 15 | `tda_mapper` | mapper_algorithm | Topological shape of data |

### SECTOR §15 — META (Metasystems & Emergence) [AUTONOMOUS SELECTION]
*16 new nodes*

**Justification:** The 256-cluster is itself an emergent system — 256 nodes producing
olfactory accords that no single node could generate. Meta-systemic theory governs how
clusters interact, how phase transitions in the collider produce qualitatively new outputs,
and how the system exhibits self-organization. This sector is the cluster's self-model.

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `autopoiesis` | autopoietic | Self-producing system boundary |
| 1 | `stigmergy` | stigmergic | Environment-mediated coordination |
| 2 | `criticality` | self_organized_crit | SOC / sandpile dynamics |
| 3 | `downward_cause` | downward_causation | Macro constrains micro |
| 4 | `dissipative` | prigogine_struct | Far-from-equilibrium order |
| 5 | `cybernetic` | second_cybernetics | Observing systems / von Foerster |
| 6 | `strange_loop` | hofstadter_loop | Self-referential tangled hierarchy |
| 7 | `phase_trans` | order_parameter | Symmetry breaking at criticality |
| 8 | `swarm` | swarm_intelligence | Decentralized collective behavior |
| 9 | `attractor_land` | attractor_landscape | Waddington epigenetic landscape |
| 10 | `edge_chaos` | edge_of_chaos | Maximal computational capacity |
| 11 | `scale_free` | scale_free_net | Power-law degree distribution |
| 12 | `holarchy` | holonic_system | Part-whole recursive nesting |
| 13 | `teleology` | systemic_purpose | Goal-directedness in complex systems |
| 14 | `bootstrap` | bootstrap_paradox | Self-causing / self-referencing |
| 15 | `omega_point` | teilhard_omega | Convergent complexity thesis |

### SECTOR §16 — SYNTH (Synthetic Integration & Cross-Domain Fusion) [AUTONOMOUS SELECTION]
*16 new nodes*

**Justification:** This is the architectural keystone. The Olfactory's purpose is to
synthesize across domains — to find the accord between `feigenbaum` and `biocoenosis`, to
crystallize the collision between `ising` and `categorical_imperative`. The SYNTH sector
contains nodes purpose-built for cross-domain bridging. These are the relay stations in the
hypercube, the nodes with the highest `synthetic` dimension values, optimized for chimera
generation and inter-sector translation.

| # | ID | Label | Role |
|---|-----|-------|------|
| 0 | `analogy` | analogical_engine | Structure-mapping across domains |
| 1 | `bisociation` | koestler_bisociation | Creative collision of matrices |
| 2 | `consilience` | wilson_consilience | Unity of knowledge principle |
| 3 | `abduction` | peircean_abduction | Inference to best explanation |
| 4 | `metaphor_bridge` | conceptual_blend | Fauconnier-Turner blending |
| 5 | `transdiscipline` | transdisciplinary | Beyond disciplinary boundaries |
| 6 | `boundary_object` | star_boundary | Shared concept across communities |
| 7 | `isomorphism` | structural_iso | Form-preserving cross-domain map |
| 8 | `resonance_bridge` | harmonic_bridge | Frequency coupling across systems |
| 9 | `polysemy` | polysemic_node | Single form, multiple domain meanings |
| 10 | `hybrid_vigor` | heterosis | Combinatorial superiority |
| 11 | `chimera_forge` | chimera_synthesis | Multi-node fusion engine |
| 12 | `translation_layer` | rosetta_node | Inter-sector protocol translation |
| 13 | `ock_v2` | olfactory_kernel_v2 | 12-family OCK classification |
| 14 | `decay_engine` | subatomic_decay | Phase 2 collision → qualitative output |
| 15 | `omega_collider` | omega_collider | Full 256-node simultaneous collision |

---

## §3 — SUPPLEMENTARY SELECTIONS: ARCHITECTURAL JUSTIFICATION

### 3.1 — Why These Six Autonomous Sectors?

The four mandatory sectors (PHIL, MATH, CHEM/BIO as Natural Sciences, HUM) are foundational
knowledge domains. The six autonomous selections were chosen to **maximize the collision
surface area** of the 256-cluster:

| Sector | Synergy with Core | Synergy with Olfactory |
|--------|-------------------|------------------------|
| **LING** | Bridges PHIL↔HUM; formalizes how collision outputs become language | Scent naming, olfactory vocabulary, cross-linguistic smell words |
| **COGN** | Bridges BIO↔PHIL; neural basis for philosophical problems | Olfactory cognition is the primary use case; piriform cortex modeling |
| **AESTH** | Bridges PHIL↔HUM↔CHEM; formal beauty theory | The entire OCK output layer is aesthetic judgment; accord theory |
| **TOPO** | Bridges MATH↔PHYS; spatial reasoning substrate | ArtTab sphere rendering; hypercube routing; TDA on collision data |
| **META** | Bridges all sectors; emergence theory for complex systems | The 256-cluster is itself an emergent system requiring self-model |
| **SYNTH** | IS the bridge; cross-domain fusion is its only purpose | Houses OCK v2.0, chimera forge, and the omega collider |

### 3.2 — Coverage Analysis

```
Mandatory Domain        → Sectors Covering It
────────────────────────────────────────────────────
Advanced Philosophy     → PHIL (primary), DRK (applied), COGN (empirical)
Mathematics             → MATH (primary), TOPO (geometric), PHYS (applied)
Natural Sciences        → PHYS + CHEM + BIO (primary triad), ECO (applied)
Humanities              → HUM (primary), LING (linguistic), AESTH (aesthetic)

Autonomous Domain       → Sectors Covering It
────────────────────────────────────────────────────
Linguistics & Semiotics → LING (primary), HUM (cultural), COGN (neuro)
Cognitive Science       → COGN (primary), BIO (neural), PHIL (philosophy of mind)
Aesthetics              → AESTH (primary), PHIL (formal), CHEM (molecular)
Topology                → TOPO (primary), MATH (algebraic), PHYS (gauge theory)
Metasystems             → META (primary), SYNC (dynamical), ECO (complex)
Synthetic Integration   → SYNTH (primary) — references all other 15 sectors
```

### 3.3 — Sectors Considered But Rejected

| Candidate | Reason for Rejection |
|-----------|---------------------|
| Economics | Already covered by `economic` dim + DRK/SYNC nodes (ceei, daly, leviathan) |
| Computer Science | CRYPTO covers security; MATH covers computability; META covers emergence |
| Psychology | Absorbed by COGN (neural) + PHIL (phenomenology) + HUM (cultural) |
| Medicine | Too applied; relevant aspects covered by BIO + CHEM |
| Engineering | Too applied; PHYS provides theoretical substrate; TOPO provides structural |
| Art History | Subsumed by AESTH (theory) + HUM (cultural context) |

---

## §4 — DEPLOYMENT & SCALING STRATEGY

### Phase 0: Foundation (Weeks 1–2)
**Objective:** Backward-compatible 32D tensor space without breaking existing 31 nodes.

```
DELIVERABLES:
├── Expand DIM_NAMES → DIM_NAMES_32 in nodeFeatures.js
├── Pad existing FEATURES arrays: [...existing16D, ...new Array(16).fill(0)]
├── Update cosineSim(), topDrivers(), analyzeEdge() for variable-length vectors
├── Add DIM_COUNT constant (default 32, fallback 16 for legacy)
├── Verify: all existing collisions produce IDENTICAL results
├── Update WASM compare_nodes.rs to accept 32D tensors
└── Deploy: zero-visible-change release
```

**Risk Gate:** If any existing collision result changes by more than ε=1e-10, HALT.

### Phase 1: Sector Scaffold (Weeks 3–5)
**Objective:** Register all 256 nodes with provisional 32D feature vectors.

```
DELIVERABLES:
├── Generate nodeFeatures_256.js with all 256 node definitions
├── Populate dims [0..15] for new nodes via domain-appropriate heuristics
├── Populate dims [16..31] for ALL nodes (existing + new) via calibration kernels
├── Implement sector topology in new module: sectorGraph.js
│   ├── SECTOR_ADJACENCY: 16×16 boolean matrix
│   ├── routeSector(from, to): shortest path through hypercube
│   └── sectorNodes(sectorId): return 16 nodes in sector
├── Update ArtTab.jsx: sector-colored rendering (16 colors)
├── Update LatentCollider.jsx: sector-aware collision routing
├── Implement lazy WASM module loading per sector
└── Deploy: all 256 nodes visible on sphere, collisions work
```

**Parallelization:** WASM sector modules can be compiled independently and in parallel.
Each sector's 16 nodes compile to a ~45KB WASM module (vs current 716KB monolith).

### Phase 2: Cognitive Calibration (Weeks 6–9)
**Objective:** Tune 32D feature vectors through automated collision testing.

```
DELIVERABLES:
├── Build calibration harness: collide every pair (32,640 pairs for 256 nodes)
├── Score each collision against domain-expert ground truth
│   ├── PHIL×MATH collisions should activate algebraic + epistemological dims
│   ├── CHEM×AESTH collisions should activate chemical + aesthetic dims
│   ├── BIO×COGN collisions should activate biological + cognitive dims
│   └── (defined in calibration_truth.json for 500 sentinel pairs)
├── Gradient descent on feature vectors to minimize ground-truth loss
├── Re-verify: legacy 31 nodes still produce compatible results
├── OCK v2.0: expand from 6 → 12 olfactory families
│   ├── Legacy: citrus, floral, woody, animalic, aromatic, ozonic
│   ├── New: chypre, fougère, gourmand, aquatic, leather, mineral
│   └── Sub-family resolution: each family has 4 sub-families (48 total)
└── Deploy: calibrated 256-node system with OCK v2.0
```

### Phase 3: Hypercube Routing & Cross-Sector Chimera (Weeks 10–12)
**Objective:** Enable multi-sector collision chains and chimera synthesis.

```
DELIVERABLES:
├── Implement hypercube routing protocol (4-hop max)
├── Cross-sector colliderBus: events propagate through sector boundaries
├── Multi-node chimera synthesis: 3+ nodes from different sectors
├── SYNTH sector activation: omega_collider can accept N-node input
├── Paradox extraction upgraded: 64-iteration convergence on 32D space
├── ArtTab: sector-boundary visualization (translucent hull meshes)
├── Performance budget: 256-node sphere at 60fps (WebGPU fallback path)
└── Deploy: full cross-sector chimera synthesis operational
```

### Phase 4: Production Hardening (Weeks 13–16)
**Objective:** Optimize, cache, and ship.

```
DELIVERABLES:
├── Service Worker: sector-sharded WASM caching strategy
├── Lazy loading: only load active sector WASM modules
├── Pre-compute: top-100 most-collided pairs cached in Vercel KV
├── Tesseract Protocol v2: OCK v2.0 12-family accords in order embeds
├── Discord embed update: 32D tensor visualization in order receipts
├── Performance: <3s cold boot with 256 nodes (vs current <1.5s for 31)
├── Documentation: update CONTRIBUTING.md with sector contribution protocol
└── Ship: Scale 16.16 release
```

---

## §5 — RESOURCE ESTIMATES

### Compute Budget

| Component | Current (31 nodes) | Target (256 nodes) | Growth Factor |
|-----------|-------------------|---------------------|---------------|
| Node pairs | 465 | 32,640 | 70× |
| WASM binary | 716KB (1 module) | ~720KB (16 × 45KB) | ~1× total |
| Feature tensor | 31 × 16 = 496 floats | 256 × 32 = 8,192 floats | 16.5× |
| ArtTab vertices | 31 | 256 | 8.3× |
| Edge budget (visible) | ~50 max | ~200 max (LOD culling) | 4× |
| Boot payload | ~1.2MB | ~2.8MB (lazy: ~1.4MB) | ~1.2× (lazy) |

### Performance Mitigations

1. **Sector-local collision priority:** Only compute intra-sector collisions eagerly;
   cross-sector on demand.
2. **LOD (Level of Detail):** ArtTab renders full sphere but only labels active sector nodes.
3. **WASM lazy loading:** Load sector WASM module only when a node in that sector is selected.
4. **WebGPU acceleration path:** For 256-node force-directed layout, offer WebGPU compute
   shader fallback (Phase 4).
5. **Collision cache:** Vercel KV stores top-100 most-requested collision results.

---

## §6 — MIGRATION SAFETY GUARANTEES

```
INVARIANT 1: All 31 existing nodes retain their original IDs, labels, and aliases.
INVARIANT 2: Existing 16D feature vectors are byte-identical after migration.
INVARIANT 3: cosineSim(nodeA, nodeB) for any legacy pair returns identical results.
INVARIANT 4: OCK v1.1 classifications remain available alongside OCK v2.0.
INVARIANT 5: Tesseract Protocol order embeds degrade gracefully to v1 format.
INVARIANT 6: Service Worker cache for legacy WASM module continues to function.
INVARIANT 7: No existing terminal command changes behavior.
```

---

## §7 — APPENDIX: SECTOR ADJACENCY MATRIX

Each sector connects to exactly 4 neighbors in the 4D hypercube topology.
A `1` indicates direct link; `0` requires routing through intermediate sectors.

```
     ECO SYN PHY CRY DRK PHI MAT CHE BIO HUM LIN COG AES TOP MET SYT
ECO   -   1   1   1   1   0   0   0   0   0   0   0   0   0   0   0
SYN   1   -   1   0   0   1   0   0   0   0   0   0   0   0   0   0
PHY   1   1   -   0   0   0   1   0   0   0   0   0   0   0   0   0
CRY   1   0   0   -   1   0   0   1   0   0   0   0   0   0   0   0
DRK   1   0   0   1   -   0   0   0   1   0   0   0   0   0   0   0
PHI   0   1   0   0   0   -   1   0   0   1   0   0   0   0   0   0
MAT   0   0   1   0   0   1   -   0   0   0   0   0   0   1   0   0
CHE   0   0   0   1   0   0   0   -   1   0   0   0   1   0   0   0
BIO   0   0   0   0   1   0   0   1   -   0   0   1   0   0   0   0
HUM   0   0   0   0   0   1   0   0   0   -   1   0   0   0   0   1
LIN   0   0   0   0   0   0   0   0   0   1   -   0   1   0   0   1
COG   0   0   0   0   0   0   0   0   1   0   0   -   1   0   1   0
AES   0   0   0   0   0   0   0   1   0   0   1   1   -   0   0   0
TOP   0   0   0   0   0   0   1   0   0   0   0   0   0   -   1   1
MET   0   0   0   0   0   0   0   0   0   0   0   1   0   1   -   1
SYT   0   0   0   0   0   0   0   0   0   1   1   0   0   1   1   -
```

**Routing example:** `CHEM → PHIL` = CHEM → CRYPTO → ECO → SYNC → PHIL (3 hops)
**Max path:** Any sector to any sector ≤ 4 hops (4D hypercube diameter).

---

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  END OF ARCHITECTURE DOCUMENT — AWAITING PHASE GATE APPROVAL               ║
║  Next action: Architect confirmation → Phase 0 implementation begin         ║
╚══════════════════════════════════════════════════════════════════════════════╝
```
