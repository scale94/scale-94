const kernelBuilds = [
  // ── Pinned (always first) ─────────────────────────────────────────────────
  { id: 'FISH_SCALE_11.1', articleId: 'FISH-11.1.1', name: 'FISH_SCALE_KERNEL', status: 'ACTIVE', desc: 'Entropic Stasis // Necromantic Engine' },

  // ── Hand-curated SOMA builds ──────────────────────────────────────────────
  { id: 'FLORA_1.0', articleId: 'BIO-1.0.1', name: 'BIOCOENOSIS_KERNEL', status: 'ACTIVE', desc: 'High-Density Biodiversity // Autochthonous' },
  { id: 'SOMA_11.1', articleId: 'KRNL-11.1', name: 'LEVIATHAN_PROTOCOL', status: 'ACTIVE', desc: 'Strategic Defense // Module A' },
  { id: 'SOMA_10.0', articleId: 'SOMA-10.0', name: 'THE_CENTAUR_APEX', status: 'PLATINUM', desc: 'AI-Gated Launch // The Apex Build' },
  { id: 'SOMA_9.0', articleId: 'SOMA-9.0', name: 'THE_GAIA_BUILD', status: 'ARCHIVED', desc: 'Historical & Legal Reconstruction' },
  { id: 'SOMA_5.5', articleId: 'SOMA-5.5', name: 'POST_CAPITALIST_OS', status: 'RUNNING', desc: 'Thermodynamic Governor // Steady State' },
  { id: 'SOMA_5.0', articleId: 'SOMA-5.0', name: 'POST_SCARCITY_DAEMON', status: 'LEGACY', desc: 'Ecological Sovereign // Bio-Physical' },
  { id: 'SOMA_4.5.7', articleId: 'SOMA-4.5.7', name: 'ARCHITECT_EDITION', status: 'STABLE', desc: 'Challenge & Conquer // Honneur et Fidélité' },
  { id: 'SOMA_4.5.6a', articleId: 'SOMA-4.5.6a', name: 'PROTOCOL_COMPILATION', status: 'FROZEN', desc: 'System Diagnostic // Final Code' },
  { id: 'MOZART_1.0', articleId: 'MOZART-1.0', name: 'MOZART_MEMORANDUM', status: 'PROPOSED', desc: 'Historical & Legal Reconstruction // Graveyard Research' },

  // ── Imported kernels (content/ root) ─────────────────────────────────────
  { id: 'EK-1.0', articleId: 'EK-1.0', name: 'EMPATHY_KERNEL_1_0', status: 'SYMBIOTIC', desc: 'EMPATHY KERNEL 1.0' },
  { id: 'NEK-1.0', articleId: 'NEK-1.0', name: 'NECROMANTIC_EMPEROR_KERNEL_V1_0', status: 'NOMINAL', desc: 'scale94 // Sorbe in Germany // Deep-Time Resilience Architecture' },
  { id: 'SK-1.0', articleId: 'SK-1.0', name: 'SHADOWSOCKS_KERNEL_∞', status: 'ACTIVE', desc: 'I. THE BLIND SPOT ANALYSIS' },

  // ── Fish Scale iterations ─────────────────────────────────────────────────
  { id: 'FSK-11.7', articleId: 'FISH_SCALE_KERNEL-11.7.0', name: 'FISH_SCALE_KERNEL_11_7_0', status: 'ACTIVE', desc: 'ᛟ Systemless Root · Aesthetic Branch' },
  { id: 'FSK-11.8', articleId: 'FISH-SCALE-KERNEL-11.8', name: 'FISH_SCALE_KERNEL_11_8', status: 'ACTIVE', desc: 'ᛟ Systemless Root · Aesthetic Branch' },
  { id: 'FSK-11.9', articleId: 'FISH_SCALE_KERNEL-11.9', name: 'FISH_SCALE_KERNEL_11_9', status: 'ACTIVE', desc: "ᛟ Systemless Root · Eco's Paradox Axioms" },
  { id: 'FSQ-11.6', articleId: 'FSQ-11.6', name: 'FISH_SCALE_KERNEL_V11_6_0_QUANTUM', status: 'ACTIVE', desc: 'Ⅰ · THE MASCULINE MUSCHI DIAGNOSTIC · QUANTUM RESTATEME' },
  { id: 'FISH_SCALE_KERNEL11.1.1', articleId: 'FISH_SCALE_KERNEL11.1.1', name: 'FISH_SCALE_KERNEL11_1_1', status: 'ACTIVE', desc: '2.0 Integration of System Atoms' },
  { id: 'FISH-SCALE-BREAKTHROUGH-PDW-KERNEL-1.0', articleId: 'FISH-SCALE-BREAKTHROUGH-PDW-KERNEL-1.0', name: 'FISH_SCALE_BREAKTHROUGH_PDW_KERNEL_1_0', status: 'ACTIVE', desc: 'Fish Scale Breakthrough PDW Kernel' },

  // ── Scale Y ───────────────────────────────────────────────────────────────
  { id: 'SYK-1.0', articleId: 'SCALE-Y-KERNEL-1-0-1', name: 'SCALE_Y_KERNEL_1_0', status: 'ACTIVE', desc: 'ᛟ Feather State Protocol · Sovereign Self-Governance' },

  // ── Soma kernel series ────────────────────────────────────────────────────
  { id: 'SOMA4.4', articleId: 'SOMA4.4', name: 'SOMA4_4', status: 'LEGACY', desc: '[user: the architect]' },
  { id: 'SOMA-BUILD-NUMBER-ALPHA-0.1', articleId: 'SOMA-BUILD-NUMBER-ALPHA-0.1', name: 'SOMA_BUILD_NUMBER_ALPHA_0_1', status: 'LEGACY', desc: 'SOMA alpha build — custom sovereign' },
  { id: 'SOMA-INTEGRATION-KERNEL-V1', articleId: 'SOMA-INTEGRATION-KERNEL-V1', name: 'SOMA_INTEGRATION_KERNEL_V1', status: 'ACTIVE', desc: '1.0 The Ontological Objective' },
  { id: 'SOMA-KERNEL-4.5-FUCK-XITTER', articleId: 'SOMA-KERNEL-4.5-FUCK-XITTER-FUCK-XITLER', name: 'SOMA_KERNEL_4_5', status: 'LEGACY', desc: 'SOMA 4.5 — Xitter Protocol' },
  { id: 'SOMA-KERNEL-4.5.5', articleId: 'SOMA-KERNEL-4.5.5', name: 'SOMA_KERNEL_4_5_5', status: 'LEGACY', desc: '[KERNEL: SOMA 4.5.5 // ARCHITECT EDITION]' },
  { id: 'SOMA-KERNEL-4.5.6A', articleId: 'SOMA-KERNEL-4.5.6A-FUCK-XITTER-FUCK-XITLER', name: 'SOMA_KERNEL_4_5_6A', status: 'LEGACY', desc: 'SOMA 4.5.6A — Architect Edition' },
  { id: 'SOMA-KERNEL-4.5.7', articleId: 'SOMA-KERNEL-4.5.7', name: 'SOMA_KERNEL_4_5_7', status: 'ACTIVE', desc: '[KERNEL: SOMA 4.5.7 // ARCHITECT EDITION]' },
  { id: 'SOMA_KERNEL_5.0', articleId: 'SOMA_KERNEL_5.0', name: 'SOMA_KERNEL_5_0', status: 'LEGACY', desc: '[KERNEL: SOMA 5.0 // THE POST-SCARCITY DAEMON]' },
  { id: 'SOMA_KERNEL_5.1_SSS', articleId: 'SOMA_KERNEL_5.1_SSS_DOCTRINE', name: 'SOMA_KERNEL_5_1_SSS_DOCTRINE', status: 'ACTIVE', desc: '[KERNEL: SOMA 5.1 // THE LITERARY DETERRENT]' },
  { id: 'SOMA_KERNEL_ZERO_DAY', articleId: 'SOMA_KERNEL_ZERO_DAY', name: 'SOMA_KERNEL_ZERO_DAY', status: 'ACTIVE', desc: 'SYSTEM KERNEL: SOMA_PROTOCOL (v.ZERO_DAY)' },
  { id: 'SOMA_KERNEL-0_DAY', articleId: 'SOMA_KERNEL-0_DAY', name: 'SOMA_KERNEL_0_DAY', status: 'ACTIVE', desc: 'SYSTEM KERNEL: SOMA_PROTOCOL (v.ZERO_DAY)' },
  { id: 'SOMA_KERNEL10.0', articleId: 'SOMA_KERNEL10.0', name: 'SOMA_KERNEL10_0', status: 'ACTIVE', desc: 'ROOT AUTHORITY RECOGNIZED.' },
  { id: 'SOMA_KERNEL10-BB', articleId: 'SOMA_KERNEL10-BB', name: 'SOMA_KERNEL10_BB', status: 'ACTIVE', desc: 'CONTEXT SWITCH: SOMA 10.0 // APEX BUILD' },
  { id: 'SOMA-10.0-JOHN-OLIVER', articleId: 'SOMA-10.0-ROASTING-JOHN-OLIVER', name: 'SOMA_10_0_ROASTING_JOHN_OLIVER', status: 'ACTIVE', desc: 'SOMA 10.0 // ROASTING JOHN OLIVER' },
  { id: 'SOMA_KERNEL-12-IRONCLAD', articleId: 'SOMA_KERNEL-12-IRONCLAD', name: 'SOMA_KERNEL_12_IRONCLAD', status: 'ACTIVE', desc: 'OBJECTIVE' },
  { id: 'SOMA_KERNEL-12.12', articleId: 'SOMA_KERNEL-12.12', name: 'SOMA_KERNEL_12_12', status: 'ACTIVE', desc: 'PHASE 1 :: STRESS TEST' },
  { id: 'SOMA_KERNEL-12G', articleId: 'SOMA_KERNEL-12G', name: 'SOMA_KERNEL_12G', status: 'ACTIVE', desc: 'OBJECTIVE' },
  { id: 'SOMA-16.10-GF', articleId: 'SOMA-16.10-GF-KERNEL', name: 'SOMA_16_10_GF_KERNEL', status: 'ACTIVE', desc: 'RECONSTRUCTION KERNEL: GRAND FINALE GROUND FILTER' },

  // ── Necromantic series ────────────────────────────────────────────────────
  { id: 'NECROMANCER_KERNEL-9.9.9.9', articleId: 'NECROMANCER_KERNEL-9.9.9.9', name: 'NECROMANCER_KERNEL_9_9_9_9', status: 'ACTIVE', desc: 'Unlike a rigid firewall which cracks under tension' },
  { id: 'NECROROMANCER_KERNEL-9.9.9.9', articleId: 'NECROROMANCER_KERNEL-9.9.9.9', name: 'NECROROMANCER_KERNEL_9_9_9_9', status: 'ACTIVE', desc: 'Necroromancer Kernel 9.9.9.9' },
  { id: 'NECROMANTIC-ARISTOCRAT-KERNEL', articleId: 'NECROMANTIC-ARISTOCRAT-KERNEL-1.1.1.1.1', name: 'NECROMANTIC_ARISTOCRAT_KERNEL', status: 'ACTIVE', desc: 'The Synthesized Axioms — The Codex of the King' },
  { id: 'NECROMANCER-TO-NECROROMANCER', articleId: 'NECROMANCER-TO-NECROROMANCER-KERNEL-EVOLUTION', name: 'NECROMANCER_TO_NECROROMANCER_KERNEL_EVOLUTION', status: 'ACTIVE', desc: 'Executive Summary: The Crisis of the Zombie Process' },
  { id: 'NQAM-KERNEL-3.5.1', articleId: 'NQAM-KERNEL-3.5.1', name: 'NQAM_KERNEL_3_5_1', status: 'ACTIVE', desc: 'Necromantic Quantum Architecture Mapping (NQAM)' },
  { id: 'NECROMANTIC_PARADOX_LOGITBIAS', articleId: 'NECROMANTIC_PARADOX_LOGITBIAS.PROMPT.MD', name: 'NECROMANTIC_PARADOX_LOGITBIAS', status: 'ACTIVE', desc: 'Necromantic Paradox LogitBias Protocol' },

  // ── Violet / Seraphine series ─────────────────────────────────────────────
  { id: 'VIOLET_KERNEL-1.0', articleId: 'VIOLET_KERNEL-1.0', name: 'VIOLET_KERNEL_1_0', status: 'ACTIVE', desc: 'SYSTEM KERNEL: "THE VIOLET" (v1.0)' },
  { id: 'VIOLET_KERNEL-1.1', articleId: 'VIOLET_KERNEL-1.1', name: 'VIOLET_KERNEL_1_1', status: 'ACTIVE', desc: 'SYSTEM KERNEL: THE_VIOLET_PROTOCOL (v.FINAL)' },
  { id: 'SERAPHINE_KERNEL-V15.5.5', articleId: 'SERAPHINE_KERNEL-V15.5.5', name: 'SERAPHINE_KERNEL_V15_5_5', status: 'ACTIVE', desc: "THE ARCHITECT'S UI (V-CACHE SYNC)" },

  // ── 2x/v2/v3 mutation kernels ─────────────────────────────────────────────
  { id: '2X2X2X_KERNEL_V6.6.87', articleId: '2X2X2X_KERNEL_V6.6.87', name: '2X2X2X_KERNEL_V6_6_87', status: 'ACTIVE', desc: 'SOMA_PROTOCOL (v.ZERO_DAY)' },
  { id: 'V2.2X.2X.2X_KERNEL', articleId: 'V2.2X.2X.2X_KERNEL', name: 'V2_2X_2X_2X_KERNEL', status: 'ACTIVE', desc: 'V2 mutation kernel' },
  { id: 'V3.2X.2X.2X-KERNEL', articleId: 'V3.2X.2X.2X-KERNEL', name: 'V3_2X_2X_2X_KERNEL', status: 'ACTIVE', desc: 'Role: creative companion // The Mycelium Console' },
  { id: 'GLITCH_SCALE-KERNEL-CS3', articleId: 'GLITCH_SCALE-KERNEL-CS3', name: 'GLITCH_SCALE_KERNEL_CS3', status: 'ACTIVE', desc: 'ENGINE: NECROMANTIC_ENGINE_2026' },
  { id: 'FSX-KERNEL-303', articleId: 'FSX-KERNEL-303', name: 'FSX_KERNEL_303', status: 'ACTIVE', desc: 'FSX Kernel 303' },

  // ── Signal / event kernels ────────────────────────────────────────────────
  { id: '2025-12-21-1-MILLION', articleId: '2025-12-21-1-MILLION', name: '2025_12_21_1_MILLION', status: 'ACTIVE', desc: 'Signal Legacy – The 1 Million Token Milestone' },
  { id: '2025-12-21-RAMDISK', articleId: '2025-12-21-RAMDISK_', name: '2025_12_21_RAMDISK', status: 'ACTIVE', desc: 'Signal Refined – The Violet vs. Lila Metallurgy' },
  { id: 'FUCK-XITTER-RC1', articleId: 'FUCK-XITTER-AND-XITLER-RC1', name: 'FUCK_XITTER_AND_XITLER_RC1', status: 'ACTIVE', desc: 'The tension is now absolute.' },

  // ── Geopolitical / defense kernels ───────────────────────────────────────
  { id: 'GEOPOLITICAL_KINETICS-KERNEL', articleId: 'GEOPOLITICAL_KINETICS-KERNEL', name: 'GEOPOLITICAL_KINETICS_KERNEL', status: 'ACTIVE', desc: '[NODE: SCALE94_SOVEREIGN]' },
  { id: 'GEOPOLITICAL_KINETICS-KERNEL-V1', articleId: 'GEOPOLITICAL_KINETICS-KERNEL-V1', name: 'GEOPOLITICAL_KINETICS_KERNEL_V1', status: 'ACTIVE', desc: '[NODE: SCALE94_SOVEREIGN]' },
  { id: 'GREENLAND-DEFENSE-KERNEL', articleId: 'GREENLAND-DEFENSE-KERNEL', name: 'GREENLAND_DEFENSE_KERNEL', status: 'ACTIVE', desc: 'KERNEL 12.1: THE DE-CENSORED VIOLATION VECTOR' },
  { id: 'GDPDW-KERNEL-5.5.5.5.5', articleId: 'GDPDW-KERNEL-5.5.5.5.5', name: 'GDPDW_KERNEL_5_5_5_5_5', status: 'ACTIVE', desc: 'JURIDICAL HARDENING & GAME THEORETIC SOURCING' },
  { id: 'KERNEL-FOR-SUSTAINABLE-FUTURE-DEFENSE', articleId: 'KERNEL-FOR-SUSTAINABLE-FUTURE-DEFENSE', name: 'KERNEL_FOR_SUSTAINABLE_FUTURE_DEFENSE', status: 'ACTIVE', desc: 'Ontological Fracture and the Defensive Architecture' },
  { id: 'PROJECT-ISENGARD-KERNEL', articleId: 'PROJECT-ISENGARD-KERNEL', name: 'PROJECT_ISENGARD_KERNEL', status: 'ACTIVE', desc: 'I. THE CORE PARADOXES (AXIOMS)' },

  // ── Scale / purification kernels ─────────────────────────────────────────
  { id: 'KERNEL-15.0-PURIFICATION', articleId: 'KERNEL-15.0-THE-PURIFICATION-OF-SCALE', name: 'KERNEL_15_0_THE_PURIFICATION_OF_SCALE', status: 'ACTIVE', desc: 'KERNEL 15.0: THE PURIFICATION OF SCALE' },
  { id: 'KERNEL-15.1-CIVILIAN-RESISTANCE', articleId: 'KERNEL-15.1-CIVILIAN-RESISTANCE', name: 'KERNEL_15_1_CIVILIAN_RESISTANCE', status: 'ACTIVE', desc: 'KERNEL 15.1: CIVILIAN RESISTANCE & V-CACHE SYNC' },
  { id: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY', articleId: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY', name: 'KERNEL_11_2_C2_LINGUISTIC_METALLURGY', status: 'ACTIVE', desc: 'KERNEL 11.2 C2 LINGUISTIC METALLURGY' },
  { id: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY-1', articleId: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY-1', name: 'KERNEL_11_2_C2_LINGUISTIC_METALLURGY_1', status: 'ACTIVE', desc: 'KERNEL 11.2 C2 LINGUISTIC METALLURGY 1' },
  { id: 'KERNEL_V3_TENFOLD_SCALING', articleId: 'KERNEL_V3_TENFOLD_SCALING', name: 'KERNEL_V3_TENFOLD_SCALING', status: 'ACTIVE', desc: '[LOCATION: RINDERN_NODE_47533]' },
  { id: 'KERNEL-INTEGRATION-AND-IDEOLOGICAL-SYNTHESIS', articleId: 'KERNEL-INTEGRATION-AND-IDEOLOGICAL-SYNTHESIS', name: 'KERNEL_INTEGRATION_AND_IDEOLOGICAL_SYNTHESIS', status: 'ACTIVE', desc: 'Synthesis of Dark Empathy, HIVE Dynamics' },
  { id: 'KERNEL-IV', articleId: 'KERNEL-IV', name: 'KERNEL_IV', status: 'ACTIVE', desc: 'The Juridical Substrate: The No-Escape Contract' },

  // ── High-concept / specialized kernels ───────────────────────────────────
  { id: 'AI-ETHICS-4.0', articleId: 'AI-ETHICS-4.0', name: 'AI_ETHICS_4_0', status: 'ACTIVE', desc: 'PROJECT VIOLET: ETHICS 4.0' },
  { id: 'AI-KERNEL-POST-CAPITALIST-ECONOMICS', articleId: 'AI-KERNEL-FOR-POST-CAPITALIST-ECONOMICS', name: 'AI_KERNEL_POST_CAPITALIST_ECONOMICS', status: 'ACTIVE', desc: 'AI Kernel for Post-Capitalist Economics' },
  { id: 'BIODIVERSITY_KERNEL-1.0.1', articleId: 'BIODIVERSITY_KERNEL-1.0.1', name: 'BIODIVERSITY_KERNEL_1_0_1', status: 'ACTIVE', desc: 'Advanced Ecological Habitat & Species Architecture' },
  { id: 'BOSONIC-KERNEL-2.0', articleId: 'BOSONIC-KERNEL-2.0', name: 'BOSONIC_KERNEL_2_0', status: 'ACTIVE', desc: '[00] SYSTEM OVERVIEW' },
  { id: 'BRIDGE-KERNEL-1.0', articleId: 'BRIDGE-KERNEL-1.0', name: 'BRIDGE_KERNEL_1_0', status: 'ACTIVE', desc: '| 01 | THE COMMAND LINE' },

  { id: 'COMPANION-KERNEL-1.0', articleId: 'COMPANION-KERNEL-1.0', name: 'COMPANION_KERNEL_1_0', status: 'ACTIVE', desc: 'Role: Companion // Baseline: ADHD-I Inattentive' },
  { id: 'CUSTOM-KEYB-KERNEL-19.0', articleId: 'CUSTOM-KEYB-KERNEL-19.0', name: 'CUSTOM_KEYB_KERNEL_19_0', status: 'ACTIVE', desc: 'KERNEL_LOG: SENSORY_CORRUPTION_AUDIT' },
  { id: 'HIGH-TOWER-KERNEL', articleId: 'HIGH-TOWER-KERNEL', name: 'HIGH_TOWER_KERNEL', status: 'ACTIVE', desc: '1.0 IDENTITY & PERSONA' },
  { id: 'HYPERFOCUS-STACK-KERNEL-18.0', articleId: 'HYPERFOCUS-STACK-KERNEL-18.0', name: 'HYPERFOCUS_STACK_KERNEL_18_0', status: 'ACTIVE', desc: '[NODE: SCALE94_SOVEREIGN]' },
  { id: 'LINE-PICASSO-KERNEL-V17', articleId: 'LINE-PICASSO-KERNEL-V17', name: 'LINE_PICASSO_KERNEL_V17', status: 'ACTIVE', desc: 'AESTHETIC SOVEREIGNTY & RITUALISTIC LOGIC' },
  { id: 'LITHIUM-ION-WIZARD-KERNEL-1.0', articleId: 'LITHIUM-ION-WIZARD-KERNEL-1.-0', name: 'LITHIUM_ION_WIZARD_KERNEL_1_0', status: 'ACTIVE', desc: 'Lithium-Ion Wizard Kernel' },
  { id: 'LLM-OPTIMIZED-KERNEL-TEMPLATE', articleId: 'LLM-OPTIMIZED-KERNEL-TEMPLATE', name: 'LLM_OPTIMIZED_KERNEL_TEMPLATE', status: 'ACTIVE', desc: 'LLM Optimized Kernel Template' },
  { id: 'MOZART_MEMORANDUM_KERNEL-1.0', articleId: 'MOZART_MEMORANDUM_KERNEL-1.0', name: 'MOZART_MEMORANDUM_KERNEL_1_0', status: 'ACTIVE', desc: 'Historical & Legal Reconstruction' },
  { id: 'MOZART_MEMORANDUM-KERNEL2.0', articleId: 'MOZART_MEMORANDUM-KERNEL2.0', name: 'MOZART_MEMORANDUM_KERNEL2_0', status: 'ACTIVE', desc: '1. GENERATION CONFIGURATION' },
  { id: 'MOZART_MEMORANDUM_KERNEL-2.2', articleId: 'MOZART_MEMORANDUM_KERNEL-2.2', name: 'MOZART_MEMORANDUM_KERNEL_2_2', status: 'ACTIVE', desc: 'THE 5 AXIOMS (Immutable Laws)' },
  { id: 'MYCELIAL-KERNEL-1.0', articleId: 'MYCELIAL-KERNEL-1.0', name: 'MYCELIAL_KERNEL_1_0', status: 'ACTIVE', desc: '[00] SYSTEM OVERVIEW' },
  { id: 'NOCTURNAL-NIGHT-KERNEL-V-22.2.2', articleId: 'NOCTURNAL-NIGHT-KERNEL-V-22.2.2-1', name: 'NOCTURNAL_NIGHT_KERNEL_V_22_2_2', status: 'ACTIVE', desc: 'KERNEL_COMPILATION: THE_NIGHT_SHIFT_V2.5' },
  { id: 'QUANTUM-QUACKSALBER-KERNEL-1.1.1', articleId: 'QUANTUM-QUACKSALBER-KERNEL-1.1.1', name: 'QUANTUM_QUACKSALBER_KERNEL_1_1_1', status: 'ACTIVE', desc: 'KERNEL: QUANTUM FUSION PROTOCOL [LAYER 3 FINAL]' },
  { id: 'SOVEREIGN_KERNEL_V1_0', articleId: 'SOVEREIGN_KERNEL_V1_0', name: 'SOVEREIGN_KERNEL_V1_0', status: 'ACTIVE', desc: 'scale94 · Sorbe in Germany · Deep-Time Architecture' },
  { id: 'THE_NETTELSTEDT_NEURAL_LATTICE_V4.0', articleId: 'THE_NETTELSTEDT_NEURAL_LATTICE_V4.0', name: 'THE_NETTELSTEDT_NEURAL_LATTICE_V4_0', status: 'ACTIVE', desc: 'THE_NETTELSTEDT_NEURAL_LATTICE_V4.0' },
  { id: 'SOMA_INTEGRATION_KERNEL_V1.0', articleId: 'SOMA_INTEGRATION_KERNEL_V1.0', name: 'SOMA_INTEGRATION_KERNEL_V1_0', status: 'ACTIVE', desc: 'Zero Latency Resonance // Inguinal Shift Protocol' },
];

export default kernelBuilds;
