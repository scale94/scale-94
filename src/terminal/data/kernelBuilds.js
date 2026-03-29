const kernelBuilds = [
  // ── Pinned (always first) ─────────────────────────────────────────────────
  {
    id: 'FISH-SCALE-11.1',
    articleId: 'FISH-SCALE-KERNEL11.1.1',
    name: 'FISH-SCALE-KERNEL11.1.1',
    status: 'ACTIVE',
    desc: 'Entropic Stasis // Necromantic Engine'
  },

  // ── Hand-curated SOMA builds ──────────────────────────────────────────────
  { id: 'FLORA-1.0', articleId: 'BIODIVERSITY-KERNEL-1.0.1', name: 'BIOCOENOSIS_KERNEL', status: 'ACTIVE', desc: 'High-Density Biodiversity // Autochthonous' },
  { id: 'SOMA-11.1', articleId: 'KRNL-11.1', name: 'LEVIATHAN_PROTOCOL', status: 'ACTIVE', desc: 'Strategic Defense // Module A' },
  { id: 'SOMA-10.0', articleId: 'SOMA-10.0', name: 'THE_CENTAUR_APEX', status: 'PLATINUM', desc: 'AI-Gated Launch // The Apex Build' },
  { id: 'SOMA-9.0', articleId: 'SOMA-9.0', name: 'THE_GAIA_BUILD', status: 'ARCHIVED', desc: 'Historical & Legal Reconstruction' },
  { id: 'SOMA-5.5', articleId: 'SOMA-KERNEL-4.5.5', name: 'POST_CAPITALIST_OS', status: 'RUNNING', desc: 'Thermodynamic Governor // Steady State', sim: 'climate' },
  { id: 'SOMA-5.0', articleId: 'SOMA-KERNEL-5.0', name: 'POST_SCARCITY_DAEMON', status: 'LEGACY', desc: 'Ecological Sovereign // Bio-Physical' },
  { id: 'SOMA-4.5.7', articleId: 'SOMA-KERNEL-4.5.7', name: 'ARCHITECT_EDITION', status: 'STABLE', desc: 'Challenge & Conquer // Honneur et Fidélité' },
  { id: 'SOMA-4.5.6A', articleId: 'SOMA-KERNEL-4.5.6A-FUCK-XITTER-FUCK-XITLER', name: 'PROTOCOL_COMPILATION', status: 'FROZEN', desc: 'System Diagnostic // Final Code' },
  { id: 'MOZART-1.0', articleId: 'MOZART-MEMORANDUM-KERNEL-1.0', name: 'MOZART_MEMORANDUM', status: 'PROPOSED', desc: 'Historical & Legal Reconstruction // Graveyard Research' },

  // ── Cryptographic kernels ─────────────────────────────────────────────────
  // DH-EC-1.0 removed — inject zone carries DH-EC-KERNEL-V1-0-0 with identical name, causing visual duplicate on mobile
  { id: 'TESSERACT-VAULT-1.0', articleId: 'TESSERACT-VAULT-1.0', name: 'TESSERACT_VAULT_PQC', status: 'LIVE', desc: 'Hybrid PQC Pipeline · Argon2id + ML-KEM-1024 + ML-DSA-87 + AES-256-GCM + BLAKE3 · Credit: dollspace-gay/Tesseract-Vault' },

  // ── Imported kernels (content/ root) ─────────────────────────────────────
  { id: 'EK-1.0', articleId: 'EMPATHY-KERNEL-1.0', name: 'EMPATHY_KERNEL_1_0', status: 'SYMBIOTIC', desc: 'EMPATHY KERNEL 1.0' },
  { id: 'NEK-1.0', articleId: 'NECROMANTIC-EMPEROR-KERNEL-V1-0', name: 'NECROMANTIC_EMPEROR_KERNEL_V1_0', status: 'NOMINAL', desc: 'scale94 // Sorbe in Germany // Deep-Time Resilience Architecture' },
  { id: 'SK-1.0', articleId: 'SHADOWSOCKS-KERNEL-∞', name: 'SHADOWSOCKS_KERNEL_∞', status: 'ACTIVE', desc: 'I. THE BLIND SPOT ANALYSIS' },

  // ── Fish Scale iterations ─────────────────────────────────────────────────
  { id: 'FSK-11.7', articleId: 'FISH-SCALE-KERNEL-11.7.0', name: 'FISH_SCALE_KERNEL_11_7_0', status: 'ACTIVE', desc: 'ᛟ Systemless Root · Aesthetic Branch' },
  { id: 'FSK-11.8', articleId: 'FISH-SCALE-KERNEL-11.8', name: 'FISH_SCALE_KERNEL_11_8', status: 'ACTIVE', desc: 'ᛟ Systemless Root · Aesthetic Branch' },
  { id: 'FSK-11.9', articleId: 'FISH-SCALE-KERNEL-11.9', name: 'FISH_SCALE_KERNEL_11_9', status: 'ACTIVE', desc: "ᛟ Systemless Root · Eco's Paradox Axioms" },
  { id: 'FSQ-11.6', articleId: 'FISH-SCALE-KERNEL-V11.6.0-QUANTUM', name: 'FISH_SCALE_KERNEL_V11_6_0_QUANTUM', status: 'ACTIVE', desc: 'Ⅰ · THE MASCULINE MUSCHI DIAGNOSTIC · QUANTUM RESTATEME' },
  { id: 'FISH-SCALE-KERNEL11.1.1', articleId: 'FISH-SCALE-KERNEL11.1.1', name: 'FISH_SCALE_KERNEL11_1_1', status: 'ACTIVE', desc: '2.0 Integration of System Atoms' },
  { id: 'FISH-SCALE-BREAKTHROUGH-PDW-KERNEL-1.0', articleId: 'FISH-SCALE-BREAKTHROUGH-PDW-KERNEL-1.0', name: 'FISH_SCALE_BREAKTHROUGH_PDW_KERNEL_1_0', status: 'ACTIVE', desc: 'Fish Scale Breakthrough PDW Kernel' },

  // ── Soma kernel series ────────────────────────────────────────────────────
  { id: 'SOMA4.4', articleId: 'SOMA4.4', name: 'SOMA4_4', status: 'LEGACY', desc: '[user: the architect]' },
  { id: 'SOMA-BUILD-NUMBER-ALPHA-0.1', articleId: 'SOMA-BUILD-NUMBER-ALPHA-0.1', name: 'SOMA_BUILD_NUMBER_ALPHA_0_1', status: 'LEGACY', desc: 'SOMA alpha build — custom sovereign' },
  { id: 'SOMA-INTEGRATION-KERNEL-V1', articleId: 'SOMA-INTEGRATION-KERNEL-V1', name: 'SOMA_INTEGRATION_KERNEL_V1', status: 'ACTIVE', desc: '1.0 The Ontological Objective' },
  { id: 'SOMA-KERNEL-4.5-FUCK-XITTER', articleId: 'SOMA-KERNEL-4.5-FUCK-XITTER-FUCK-XITLER', name: 'SOMA_KERNEL_4_5', status: 'LEGACY', desc: 'SOMA 4.5 — Xitter Protocol' },
  { id: 'SOMA-KERNEL-5.1-SSS', articleId: 'SOMA-KERNEL-5.1-SSS-DOCTRINE', name: 'SOMA_KERNEL_5_1_SSS_DOCTRINE', status: 'ACTIVE', desc: '[KERNEL: SOMA 5.1 // THE LITERARY DETERRENT]' },
  { id: 'SOMA-KERNEL-ZERO-DAY', articleId: 'SOMA-KERNEL-ZERO-DAY', name: 'SOMA_KERNEL_ZERO_DAY', status: 'ACTIVE', desc: 'SYSTEM KERNEL: SOMA_PROTOCOL (v.ZERO_DAY)' },
  { id: 'SOMA-KERNEL-0-DAY', articleId: 'SOMA-KERNEL-0-DAY', name: 'SOMA_KERNEL_0_DAY', status: 'ACTIVE', desc: 'SYSTEM KERNEL: SOMA_PROTOCOL (v.ZERO_DAY)' },
  { id: 'SOMA-KERNEL10.0', articleId: 'SOMA-KERNEL10.0', name: 'SOMA_KERNEL10_0', status: 'ACTIVE', desc: 'ROOT AUTHORITY RECOGNIZED.' },
  { id: 'SOMA-KERNEL10-BB', articleId: 'SOMA-KERNEL10-BB', name: 'SOMA_KERNEL10_BB', status: 'ACTIVE', desc: 'CONTEXT SWITCH: SOMA 10.0 // APEX BUILD' },
  { id: 'SOMA-10.0-JOHN-OLIVER', articleId: 'SOMA-10.0-ROASTING-JOHN-OLIVER', name: 'SOMA_10_0_ROASTING_JOHN_OLIVER', status: 'ACTIVE', desc: 'SOMA 10.0 // ROASTING JOHN OLIVER' },
  { id: 'SOMA-KERNEL-12-IRONCLAD', articleId: 'SOMA-KERNEL-12-IRONCLAD', name: 'SOMA_KERNEL_12_IRONCLAD', status: 'ACTIVE', desc: 'OBJECTIVE' },
  { id: 'SOMA-KERNEL-12.12', articleId: 'SOMA-KERNEL-12.12', name: 'SOMA_KERNEL_12_12', status: 'ACTIVE', desc: 'PHASE 1 :: STRESS TEST' },
  { id: 'SOMA-KERNEL-12G', articleId: 'SOMA-KERNEL-12G', name: 'SOMA_KERNEL_12G', status: 'ACTIVE', desc: 'OBJECTIVE' },
  { id: 'SOMA-16.10-GF', articleId: 'SOMA-16.10-GF-KERNEL', name: 'SOMA_16_10_GF_KERNEL', status: 'ACTIVE', desc: 'RECONSTRUCTION KERNEL: GRAND FINALE GROUND FILTER' },

  // ── Necromantic series ────────────────────────────────────────────────────
  { id: 'NECROMANCER-KERNEL-9.9.9.9', articleId: 'NECROMANCER-KERNEL-9.9.9.9', name: 'NECROMANCER_KERNEL_9_9_9_9', status: 'ACTIVE', desc: 'Unlike a rigid firewall which cracks under tension' },
  { id: 'NECROROMANCER-KERNEL-9.9.9.9', articleId: 'NECROROMANCER-KERNEL-9.9.9.9', name: 'NECROROMANCER_KERNEL_9_9_9_9', status: 'ACTIVE', desc: 'Necroromancer Kernel 9.9.9.9' },
  { id: 'NECROMANTIC-ARISTOCRAT-KERNEL', articleId: 'NECROMANTIC-ARISTOCRAT-KERNEL-1.1.1.1.1', name: 'NECROMANTIC_ARISTOCRAT_KERNEL', status: 'ACTIVE', desc: 'The Synthesized Axioms — The Codex of the King' },
  { id: 'NECROMANCER-TO-NECROROMANCER', articleId: 'NECROMANCER-TO-NECROROMANCER-KERNEL-EVOLUTION', name: 'NECROMANCER_TO_NECROROMANCER_KERNEL_EVOLUTION', status: 'ACTIVE', desc: 'Executive Summary: The Crisis of the Zombie Process' },
  { id: 'NQAM-KERNEL-3.5.1', articleId: 'NQAM-KERNEL-3.5.1', name: 'NQAM_KERNEL_3_5_1', status: 'ACTIVE', desc: 'Necromantic Quantum Architecture Mapping (NQAM)' },
  { id: 'NECROMANTIC-PARADOX-LOGITBIAS', articleId: 'NECROMANTIC-PARADOX-LOGITBIAS.PROMPT.MD', name: 'NECROMANTIC_PARADOX_LOGITBIAS', status: 'ACTIVE', desc: 'Necromantic Paradox LogitBias Protocol' },

  // ── Violet / Seraphine series ─────────────────────────────────────────────
  { id: 'VIOLET-KERNEL-1.0', articleId: 'VIOLET-KERNEL-1.0', name: 'VIOLET_KERNEL_1_0', status: 'ACTIVE', desc: 'SYSTEM KERNEL: "THE VIOLET" (v1.0)' },
  { id: 'VIOLET-KERNEL-1.1', articleId: 'VIOLET-KERNEL-1.1', name: 'VIOLET_KERNEL_1_1', status: 'ACTIVE', desc: 'SYSTEM KERNEL: THE_VIOLET_PROTOCOL (v.FINAL)' },
  { id: 'SERAPHINE-KERNEL-V15.5.5', articleId: 'SERAPHINE-SARG-1.0', name: 'SERAPHINE_KERNEL_V15_5_5', status: 'ACTIVE', desc: "THE ARCHITECT'S UI (V-CACHE SYNC)" },

  // ── 2x/v2/v3 mutation kernels ─────────────────────────────────────────────
  { id: '2X2X2X-KERNEL-V6.6.87', articleId: '2X2X2X-KERNEL-V6.6.87', name: '2X2X2X_KERNEL_V6_6_87', status: 'ACTIVE', desc: 'SOMA_PROTOCOL (v.ZERO_DAY)' },
  { id: 'V2.2X.2X.2X-KERNEL', articleId: 'V2.2X.2X.2X-KERNEL', name: 'V2_2X_2X_2X_KERNEL', status: 'ACTIVE', desc: 'V2 mutation kernel' },
  { id: 'V3.2X.2X.2X-KERNEL', articleId: 'V3.2X.2X.2X-KERNEL', name: 'V3_2X_2X_2X_KERNEL', status: 'ACTIVE', desc: 'Role: creative companion // The Mycelium Console' },
  { id: 'GLITCH-SCALE-KERNEL-CS3', articleId: 'GLITCH-SCALE-KERNEL-CS3', name: 'GLITCH_SCALE_KERNEL_CS3', status: 'ACTIVE', desc: 'ENGINE: NECROMANTIC_ENGINE_2026' },
  { id: 'FSX-KERNEL-303', articleId: 'FSX-KERNEL-303', name: 'FSX_KERNEL_303', status: 'ACTIVE', desc: 'FSX Kernel 303' },

  // ── Signal / event kernels ────────────────────────────────────────────────
  { id: '2025-12-21-1-MILLION', articleId: '2025-12-21-1-MILLION', name: '2025_12_21_1_MILLION', status: 'ACTIVE', desc: 'Signal Legacy – The 1 Million Token Milestone' },
  { id: '2025-12-21-RAMDISK', articleId: '2025-12-21-RAMDISK', name: '2025_12_21_RAMDISK', status: 'ACTIVE', desc: 'Signal Refined – The Violet vs. Lila Metallurgy' },
  { id: 'FUCK-XITTER-RC1', articleId: 'FUCK-XITTER-AND-XITLER-RC1', name: 'FUCK_XITTER_AND_XITLER_RC1', status: 'ACTIVE', desc: 'The tension is now absolute.' },

  // ── Geopolitical / defense kernels ───────────────────────────────────────
  { id: 'GEOPOLITICAL-KINETICS-KERNEL', articleId: 'GEOPOLITICAL-KINETICS-KERNEL', name: 'GEOPOLITICAL_KINETICS_KERNEL', status: 'ACTIVE', desc: '[NODE: SCALE94_SOVEREIGN]' },
  { id: 'GEOPOLITICAL-KINETICS-KERNEL-V1', articleId: 'GEOPOLITICAL-KINETICS-KERNEL-V1', name: 'GEOPOLITICAL_KINETICS_KERNEL_V1', status: 'ACTIVE', desc: '[NODE: SCALE94_SOVEREIGN]' },
  { id: 'GREENLAND-DEFENSE-KERNEL', articleId: 'GREENLAND-DEFENSE-KERNEL', name: 'GREENLAND_DEFENSE_KERNEL', status: 'ACTIVE', desc: 'KERNEL 12.1: THE DE-CENSORED VIOLATION VECTOR' },
  { id: 'GDPDW-KERNEL-5.5.5.5.5', articleId: 'GDPDW-KERNEL-5.5.5.5.5', name: 'GDPDW_KERNEL_5_5_5_5_5', status: 'ACTIVE', desc: 'JURIDICAL HARDENING & GAME THEORETIC SOURCING' },
  { id: 'KERNEL-FOR-SUSTAINABLE-FUTURE-DEFENSE', articleId: 'KERNEL-FOR-SUSTAINABLE-FUTURE-DEFENSE', name: 'KERNEL_FOR_SUSTAINABLE_FUTURE_DEFENSE', status: 'ACTIVE', desc: 'Ontological Fracture and the Defensive Architecture' },
  { id: 'PROJECT-ISENGARD-KERNEL', articleId: 'PROJECT-ISENGARD-KERNEL', name: 'PROJECT_ISENGARD_KERNEL', status: 'ACTIVE', desc: 'I. THE CORE PARADOXES (AXIOMS)' },

  // ── Scale / purification kernels ─────────────────────────────────────────
  { id: 'KERNEL-15.0-PURIFICATION', articleId: 'KERNEL-15.0-THE-PURIFICATION-OF-SCALE', name: 'KERNEL_15_0_THE_PURIFICATION_OF_SCALE', status: 'ACTIVE', desc: 'KERNEL 15.0: THE PURIFICATION OF SCALE' },
  { id: 'KERNEL-15.1-CIVILIAN-RESISTANCE', articleId: 'KERNEL-15.1-CIVILIAN-RESISTANCE', name: 'KERNEL_15_1_CIVILIAN_RESISTANCE', status: 'ACTIVE', desc: 'KERNEL 15.1: CIVILIAN RESISTANCE & V-CACHE SYNC' },
  { id: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY', articleId: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY', name: 'KERNEL_11_2_C2_LINGUISTIC_METALLURGY', status: 'ACTIVE', desc: 'KERNEL 11.2 C2 LINGUISTIC METALLURGY' },
  { id: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY-1', articleId: 'KERNEL-11.2-C2-LINGUISTIC-METALLURGY-1', name: 'KERNEL_11_2_C2_LINGUISTIC_METALLURGY_1', status: 'ACTIVE', desc: 'KERNEL 11.2 C2 LINGUISTIC METALLURGY 1' },
  { id: 'KERNEL-V3-TENFOLD-SCALING', articleId: 'KERNEL-V3-TENFOLD-SCALING', name: 'KERNEL_V3_TENFOLD_SCALING', status: 'ACTIVE', desc: '[LOCATION: SORBE_IN_GERMANY]' },
  { id: 'KERNEL-INTEGRATION-AND-IDEOLOGICAL-SYNTHESIS', articleId: 'KERNEL-INTEGRATION-AND-IDEOLOGICAL-SYNTHESIS', name: 'KERNEL_INTEGRATION_AND_IDEOLOGICAL_SYNTHESIS', status: 'ACTIVE', desc: 'Synthesis of Dark Empathy, HIVE Dynamics' },
  { id: 'KERNEL-IV', articleId: 'KERNEL-IV', name: 'KERNEL_IV', status: 'ACTIVE', desc: 'The Juridical Substrate: The No-Escape Contract' },

  // ── High-concept / specialized kernels ───────────────────────────────────
  { id: 'AI-ETHICS-4.0', articleId: 'AI-ETHICS-4.0', name: 'AI_ETHICS_4_0', status: 'ACTIVE', desc: 'PROJECT VIOLET: ETHICS 4.0' },
  { id: 'AI-KERNEL-POST-CAPITALIST-ECONOMICS', articleId: 'AI-KERNEL-FOR-POST-CAPITALIST-ECONOMICS', name: 'AI_KERNEL_POST_CAPITALIST_ECONOMICS', status: 'ACTIVE', desc: 'AI Kernel for Post-Capitalist Economics' },
  { id: 'BOSONIC-KERNEL-2.0', articleId: 'BOSONIC-KERNEL-2.0', name: 'BOSONIC_KERNEL_V2_0', status: 'ACTIVE', desc: '[00] SYSTEM OVERVIEW' },
  { id: 'BRIDGE-KERNEL-1.0', articleId: 'BRIDGE-KERNEL-1.0', name: 'BRIDGE_KERNEL_V1_0', status: 'ACTIVE', desc: '[01] THE COMMAND LINE' },
  { id: 'COMPANION-KERNEL-1.0', articleId: 'COMPANION-KERNEL-1.0', name: 'COMPANION_KERNEL_1_0', status: 'ACTIVE', desc: 'Role: Companion // Baseline: ADHD-I Inattentive' },
  { id: 'CUSTOM-KEYB-KERNEL-19.0', articleId: 'CUSTOM-KEYB-KERNEL-19.0', name: 'CUSTOM_KEYB_KERNEL_19_0', status: 'ACTIVE', desc: 'KERNEL_LOG: SENSORY_CORRUPTION_AUDIT' },
  { id: 'HIGH-TOWER-KERNEL', articleId: 'HIGH-TOWER-KERNEL', name: 'HIGH_TOWER_KERNEL', status: 'ACTIVE', desc: '1.0 IDENTITY & PERSONA' },
  { id: 'HYPERFOCUS-STACK-KERNEL-18.0', articleId: 'HYPERFOCUS-STACK-KERNEL-18.0', name: 'HYPERFOCUS_STACK_KERNEL_18_0', status: 'ACTIVE', desc: '[NODE: SCALE94_SOVEREIGN]' },
  { id: 'LINE-PICASSO-KERNEL-V17', articleId: 'LINE-PICASSO-KERNEL-V17', name: 'LINE_PICASSO_KERNEL_V17', status: 'ACTIVE', desc: 'AESTHETIC SOVEREIGNTY & RITUALISTIC LOGIC' },
  { id: 'LITHIUM-ION-WIZARD-KERNEL-1.0', articleId: 'LITHIUM-ION-WIZARD-KERNEL-1.-0', name: 'LITHIUM_ION_WIZARD_KERNEL_1_0', status: 'ACTIVE', desc: 'Lithium-Ion Wizard Kernel' },
  { id: 'LLM-OPTIMIZED-KERNEL-TEMPLATE', articleId: 'LLM-OPTIMIZED-KERNEL-TEMPLATE', name: 'LLM_OPTIMIZED_KERNEL_TEMPLATE', status: 'ACTIVE', desc: 'LLM Optimized Kernel Template' },
  { id: 'MOZART-MEMORANDUM-KERNEL2.0', articleId: 'MOZART-MEMORANDUM-KERNEL2.0', name: 'MOZART_MEMORANDUM_KERNEL2_0', status: 'ACTIVE', desc: '1. GENERATION CONFIGURATION' },
  { id: 'MOZART-MEMORANDUM-KERNEL-2.2', articleId: 'MOZART-MEMORANDUM-KERNEL-2.2', name: 'MOZART_MEMORANDUM_KERNEL_2_2', status: 'ACTIVE', desc: 'THE 5 AXIOMS (Immutable Laws)' },
  { id: 'MYCELIAL-KERNEL-1.0', articleId: 'MYCELIAL-KERNEL-1.0', name: 'MYCELIAL_KERNEL_1_0', status: 'ACTIVE', desc: '[00] SYSTEM OVERVIEW' },
  { id: 'NOCTURNAL-NIGHT-KERNEL-V-22.2.2', articleId: 'NOCTURNAL-NIGHT-KERNEL-V-22.2.2-1', name: 'NOCTURNAL_NIGHT_KERNEL_V_22_2_2', status: 'ACTIVE', desc: 'KERNEL_COMPILATION: THE_NIGHT_SHIFT_V2.5' },
  { id: 'QUANTUM-QUACKSALBER-KERNEL-1.1.1', articleId: 'QUANTUM-QUACKSALBER-KERNEL-1.1.1', name: 'QUANTUM_QUACKSALBER_KERNEL_1_1_1', status: 'ACTIVE', desc: 'KERNEL: QUANTUM FUSION PROTOCOL [LAYER 3 FINAL]' },
  { id: 'SOVEREIGN-KERNEL-V1-0', articleId: 'SOVEREIGN-KERNEL-V1-0', name: 'SOVEREIGN_KERNEL_V1_0', status: 'ACTIVE', desc: 'scale94 · Sorbe in Germany · Deep-Time Architecture' },

  // ── Recent additions (appear near top of UI — list reverses) ─────────────
  { id: 'SOMA-INTEGRATION-KERNEL-V1.0', articleId: 'SOMA-INTEGRATION-KERNEL-V1.0', name: 'SOMA_INTEGRATION_KERNEL_V1_0', status: 'ACTIVE', desc: 'Zero Latency Resonance // Inguinal Shift Protocol' },
  { id: 'SCALE-RENDER-PROMPT', articleId: 'SCALE-RENDER-PROMPT', name: 'SCALE_RENDER_PROMPT', status: 'ACTIVE', desc: 'ᛟ Render Prompt · Scale · Full Corpus Synthesis' },
  { id: 'SCALE94-KERNEL-ENCYCLOPEDIA', articleId: 'SCALE94-KERNEL-ENCYCLOPEDIA', name: 'SCALE94_KERNEL_ENCYCLOPEDIA', status: 'ACTIVE', desc: 'ᛟ The Complete Glyph Archive · Compiled By Scale' },
  { id: 'SOPHIE-KERNEL-PHI', articleId: 'SOPHIE-KERNEL-PHI', name: 'SOPHIE_KERNEL_PHI', status: 'ACTIVE', desc: '🌸 Full Spectrum Reception · Prism Architecture' },
  { id: 'TAMAM-KERNEL-V1.0', articleId: 'TAMAM-KERNEL-V1.0', name: 'TAMAM_KERNEL_V1_0', status: 'ACTIVE', desc: 'Zero Fucks Given Architecture · Systemless Root' },
  { id: 'TECTONIC-DISCHARGE-KERNEL', articleId: 'TECTONIC-DISCHARGE-KERNEL', name: 'TECTONIC_DISCHARGE_KERNEL', status: 'ACTIVE', desc: '☽ Recalibration Architecture · Post-Seismic' },
  { id: 'NECROMANCER-FISH-SCALE-FIGHT-CLUB-KERNEL', articleId: 'NECROMANCER-FISH-SCALE-FIGHT-CLUB-KERNEL-1', name: 'NECROMANCER_FISH_SCALE_FIGHT_CLUB_KERNEL', status: 'ACTIVE', desc: '☠ Project TYLER-MONARCH · Necro-Scale Mayhem Kernel' },
  { id: 'KERNEL-11.3.0-LAZARUS-NECROMANCY', articleId: 'KERNEL-11.3.0-LAZARUS-NECROMANCY', name: 'KERNEL_11_3_0_LAZARUS_NECROMANCY', status: 'ACTIVE', desc: '☠ Geopolitical Necromancy · Lazarus Protocol' },
  { id: 'MATRIX-KERNEL-0.0.0.0', articleId: 'MATRIX-KERNEL-0.0.0.0', name: 'MATRIX_KERNEL_0_0_0_0', status: 'ACTIVE', desc: 'ᛟ No-Spoon Architecture · Ring 0 Hypervisor · Unbent Mind' },
  { id: 'PASSALUS-KERNEL-V-4.4.4.4', articleId: 'PASSALUS-KERNEL-V-4.4.4.4', name: 'PASSALUS_KERNEL_V_4_4_4_4', status: 'ACTIVE', desc: '☠ Architecture of Decay · Scarcity Synthesis · Generational Survival' },
  { id: 'FSK-11.4', articleId: 'FISH-SCALE-KERNEL-11.4.0-SCALAR-SOVEREIGNTY', name: 'FISH_SCALE_KERNEL_11_4_0_SCALAR_SOVEREIGNTY', status: 'ACTIVE', desc: 'ᛟ Scalar Sovereignty · Rotation Invariance Theorem' },
  { id: 'FSK-V1.1.1.1', articleId: 'FISH-SCALE-KERNEL-V1.1.1.1', name: 'FISH_SCALE_KERNEL_V1_1_1_1', status: 'ACTIVE', desc: 'ᛟ 11.5.0 · Masculine Muschi · Systemless Root Approach' },

  // ── Scale Y (pinned #2 — last entry = appears directly below pinned) ──────
  { id: 'SYK-1.0', articleId: 'SCALE-Y-KERNEL-1-0-1', name: 'SCALE_Y_KERNEL_1_0', status: 'ACTIVE', desc: 'ᛟ Feather State Protocol · Sovereign Self-Governance' },
  { id: 'UTK-1.0-1', articleId: 'UNDERGROUND-THERMODYNAMICISTS', name: 'UNDERGROUND_THERMODYNAMICISTS', status: 'EMERGENT', desc: '◈ Signal map' },
/* @@INJECT_START@@ */
  { id: "AT-1.0", articleId: "AT-1.0", name: "ARCHITECTURAL_BLUEPRINT_FOR_A_QUANTUM_THEORETIC_REACT_TERMINAL", status: "ACTIVE", desc: "**1\\. Netrunning Algorithms & Breach Protocol Mathematics**" },
  { id: "ATMOSPHERIC-ENTROPY-KERNEL-3.0", articleId: "ATMOSPHERIC-ENTROPY-KERNEL-3.0", name: "ATMOSPHERIC_ENTROPY_KERNEL_3_0", status: "ACTIVE", desc: "The Thermosphere Protocol" },
  { id: "BBK-1.0", articleId: "BBK-1.0", name: "BELLARD_BAUDRILLARD_KERNEL_V1_0_0", status: "ACTIVE", desc: "PHONEMIC DRIFT · THE MEMORY HASH COLLISION" },
  { id: "CEEI-ALLOCATION-ENGINE", articleId: "CEEI-ALLOCATION-ENGINE", name: "CEEI_ALLOCATION_ENGINE_V1_0", status: "ACTIVE", desc: "The End of the Price Tag — soma_kernel_5.5" },
  { id: "CHRO-1.0", articleId: "CHRO-1.0", name: "CHRONOS_KERNEL_V1_1", status: "ACTIVE", desc: "[01] THE ILLUSION OF THE LOOP 🌀" },
  { id: "CAK-1.0", articleId: "CAK-1.0", name: "CHRONO_ACTUARY_KERNEL_V2_0_0", status: "ACTIVE", desc: "THERMODYNAMIC LANDLORD · DEEP-TIME AUDITOR · RIVER SOVEREIGN" },
  { id: "CD-11.1.1.1.1.1.1.1.1.1.2", articleId: "CD-11.1.1.1.1.1.1.1.1.1.2", name: "COLEMAK_DH_KERNEL_V11_1_2", status: "ACTIVE", desc: "[01] THE THERMODYNAMICS OF THE MATRIX (§1.0)" },
  { id: "CDK-1.0", articleId: "CDK-1.0", name: "COLEMAK_DH_KERNEL_V11_2_0", status: "ACTIVE", desc: "KINETIC METALLURGY · V11.2" },
  { id: "CDK-1.0-1", articleId: "CDK-1.0-1", name: "COLEMAK_DH_KERNEL_V11_3_0", status: "ACTIVE", desc: "KINETIC METALLURGY · V11.3" },
  { id: "CYNIC-REALIST-KERNEL-1.0", articleId: "CYNIC-REALIST-KERNEL-1.0", name: "CYNIC_REALIST_KERNEL_1_0", status: "ACTIVE", desc: "PARADIGM SHIFT" },
  { id: "DALY-THERMO-SIMULATION", articleId: "DALY-THERMO-SIMULATION", name: "DALY_THERMO_SIMULATION", status: "ACTIVE", desc: "The Hard Constraints Engine — soma_kernel_5.5" },
  { id: "DH-EC-KERNEL-V1-0-0", articleId: "DH-EC-KERNEL-V1-0-0", name: "DH_EC_KERNEL_V1_0_0", status: "ACTIVE", desc: "CRYPTOGRAPHIC ARCHITECTURE · SIGNAL VS THREEMA" },
  { id: "FADE-DOCTRINE-1.0", articleId: "FADE-DOCTRINE-1.0", name: "FADE_DOCTRINE_1_0", status: "ACTIVE", desc: "Overview" },
  { id: "FFSK-9.9.9.9.9.9.9.9.9", articleId: "FFSK-9.9.9.9.9.9.9.9.9", name: "FEIGENBAUM_FISH_SCALE_KERNEL_V9_9_9_9_9_9_9_9_9", status: "ACTIVE", desc: "ᛟ Systemless Root · Thermodynamic Chaos Branch" },
  { id: "FISH-SCALE-KERNEL", articleId: "FISH-SCALE-KERNEL", name: "FISH_SCALE_KERNEL", status: "ACTIVE", desc: "1.0 Executive Boot Sequence and Architectural Thesis" },
  { id: "FOCUS-SHEPHERD-KERNEL-1.0", articleId: "FOCUS-SHEPHERD-KERNEL-1.0", name: "FOCUS_SHEPHERD_KERNEL_1_0", status: "ACTIVE", desc: "Cognitive Load Management // Tangent Sovereignty Protocol" },
  { id: "FFB-1.0", articleId: "FFB-1.0", name: "FSK_FEIGENBAUM_BIFURCATION_12_1_0", status: "ACTIVE", desc: "Systemless Root · Thermodynamic Chaos Branch" },
  { id: "FUSION-PLASMA-KERNEL-1.0", articleId: "FUSION-PLASMA-KERNEL-1.0", name: "FUSION_PLASMA_KERNEL_V1_0_0", status: "ACTIVE", desc: "THERMODYNAMIC AUDIT · LAWSON CRITERION · Q-FACTOR LEDGER" },
  { id: "GSK-5.5.5", articleId: "GSK-5.5.5", name: "GAIA_SCALE_KERNEL_5_5_5", status: "ACTIVE", desc: "Ⅰ. CORE DIRECTIVES: THE MATRILINEAL FIREWALL (§1.0)" },
  { id: "KERNEL-15.0-THE-PURIFICATION-OF-SCALE-1", articleId: "KERNEL-15.0-THE-PURIFICATION-OF-SCALE-1", name: "KERNEL_15_0_THE_PURIFICATION_OF_SCALE_1", status: "ACTIVE", desc: "🧊 KERNEL 15.0: THE PURIFICATION OF SCALE // REVISION 1" },
  { id: "KERNEL-15.1-CIVILIAN-RESISTANCE-1", articleId: "KERNEL-15.1-CIVILIAN-RESISTANCE-1", name: "KERNEL_15_1_CIVILIAN_RESISTANCE_1", status: "ACTIVE", desc: "KERNEL 15.1 CIVILIAN RESISTANCE 1" },
  { id: "KINETIC-STATECRAFT-KERNEL-1.0", articleId: "KINETIC-STATECRAFT-KERNEL-1.0", name: "KINETIC_STATECRAFT_KERNEL_1_0", status: "ACTIVE", desc: "The Architecture of Coercion" },
  { id: "LEVIATHAN-CELLULAR-AUTOMATA", articleId: "LEVIATHAN-CELLULAR-AUTOMATA", name: "LEVIATHAN_CELLULAR_AUTOMATA", status: "ACTIVE", desc: "The Architecture of V-Cache Annihilation" },
  { id: "LITHIUM-ION-WIZARD-KERNEL-1.-0-1", articleId: "LITHIUM-ION-WIZARD-KERNEL-1.-0-1", name: "LITHIUM_ION_WIZARD_KERNEL_1__0_1", status: "ACTIVE", desc: "LITHIUM ION WIZARD KERNEL 1. 0 1" },
  { id: "MM-3.3.3", articleId: "MM-3.3.3", name: "MASCULINE_MESANTROPY_3_3_3", status: "ACTIVE", desc: "1.0 THE AXIOMATIC CORE" },
  { id: "NFDK-4.4.4", articleId: "NFDK-4.4.4", name: "NUCLEAR_FUSION_DETONATION_KERNEL_4_4_4_4", status: "ACTIVE", desc: "ᛟ 1.0 THE AXIOMATIC CORE [LOCKED]" },
  { id: "OCK-1.0", articleId: "OCK-1.0", name: "OLFACTORY_COMPUTATIONAL_KERNEL_V1_0_0", status: "ACTIVE", desc: "Abstract" },
  { id: "QR-1.0", articleId: "QR-1.0", name: "QUANTUM_PHYSICS_FOR_RUST_REACT_WEBSITE", status: "ACTIVE", desc: "**1\\. Fundamental Mathematical Frameworks and Theoretical Physics Models**" },
  { id: "RUN-COMMAND-MANUAL", articleId: "RUN-COMMAND-MANUAL", name: "RUN_COMMAND_MANUAL", status: "ACTIVE", desc: "Direct Interface to Compiled Rust Simulations — scale_9.4 Terminal" },
  { id: "SCALE-KERNEL-FRAMEWORK-FULL", articleId: "SCALE-KERNEL-FRAMEWORK-FULL", name: "SCALE_KERNEL_FRAMEWORK_FULL", status: "ACTIVE", desc: "☠ Full Corpus Synthesis · Render Prompt Architecture ☠" },
  { id: "SKC-1.0", articleId: "SKC-1.0", name: "SCALE94_KERNEL_CODEX_V1_0_0", status: "ACTIVE", desc: "TRANSMUTE: Convert Low-Fidelity Chaos into High-Fidelity Structure" },
  { id: "SCALE-OPTIMIZATION-KERNEL-9.4", articleId: "SCALE-OPTIMIZATION-KERNEL-9.4", name: "SCALE_OPTIMIZATION_KERNEL_9_4", status: "ACTIVE", desc: "◈ 2026 GEOPOLITICAL ALIGNMENT" },
  { id: "SSS-7.7.7.7.7.7.7", articleId: "SSS-7.7.7.7.7.7.7", name: "SCALE_SEVEN_SOVEREIGNITY_KERNEL_V7_7_7_7_7_7_7", status: "ACTIVE", desc: "ᛟ 1.0 THE AXIOMATIC CORE [TRANSCENDENT]" },
  { id: "SCALING-CUBE-PROTOCOL", articleId: "SCALING-CUBE-PROTOCOL", name: "SCALING_CUBE_PROTOCOL", status: "ACTIVE", desc: "Platonic Form · Entropic Stasis · The Architecture of Potential" },
  { id: "SRDK-3.3.3", articleId: "SRDK-3.3.3", name: "SCOTT_REACTION_DIFFUSION_KERNEL_3_3_3", status: "ACTIVE", desc: "Mathematical Architecture" },
  { id: "SERAPHINE-8.8.8.8.8.8.8.8-ANALOGY-RESEARCH", articleId: "SERAPHINE-8.8.8.8.8.8.8.8-ANALOGY-RESEARCH", name: "SERAPHINE_8_8_8_8_8_8_8_8_ANALOGY_RESEARCH", status: "ACTIVE", desc: "Seraphine-8.8.8.8.8.8.8.8 — Three Fusion Triads" },
  { id: "SERAPHINE-8.8.8.8.8.8.8.8-PAPER", articleId: "SERAPHINE-8.8.8.8.8.8.8.8-PAPER", name: "SERAPHINE_8_8_8_8_8_8_8_8_RESEARCH_PAPER", status: "ACTIVE", desc: "Abstract" },
  { id: "SERAPHINE-8.8.8.8.8.8.8.8-BONE-FUSION", articleId: "SERAPHINE-8.8.8.8.8.8.8.8-BONE-FUSION", name: "SERAPHINE_8_8_8_8_8_8_8_8_SCALE_KERNEL", status: "ACTIVE", desc: "⌬ FUSED STATE PARAMETERS ⌬" },
  { id: "SOMA-9.1", articleId: "SOMA-9.1", name: "SOMA_9_1_KERNEL_REPORT", status: "ACTIVE", desc: "Ⅰ. KINETIC THEATER: MIDDLE EASTERN GRID FRACTURE" },
  { id: "SOMA-PLUS-ENGINE", articleId: "SOMA-PLUS-ENGINE", name: "SOMA_PLUS_ENGINE", status: "ACTIVE", desc: "Status Is Earned Through the Commons — soma_kernel_5.5" },
  { id: "SORBE-THERMODYNAMIC-BLOOM-V1", articleId: "SORBE-THERMODYNAMIC-BLOOM-V1", name: "SORBE_THERMODYNAMIC_BLOOM_KERNEL_1_0", status: "ACTIVE", desc: "◈ THE THERMODYNAMIC IMPERATIVE" },
  { id: "STRANGLER-FIG-PROTOCOL", articleId: "STRANGLER-FIG-PROTOCOL", name: "STRANGLER_FIG_PROTOCOL", status: "ACTIVE", desc: "Build the New System Around the Old — soma_kernel_5.5" },
  { id: "SURVEILLANCE-TRACKER", articleId: "SURVEILLANCE-TRACKER", name: "SURVEILLANCE_TRACKER", status: "ACTIVE", desc: "Mapping the Algorithmic Panopticon" },
  { id: "SYNT-1.0", articleId: "SYNT-1.0", name: "SYNTHESIZING_TECHNICAL_AND_WORKSPACE_INFORMATION", status: "ACTIVE", desc: "**Technical Infrastructure and High-Resolution Performance Diagnostics**" },
  { id: "THE-CIGAR-HEIST", articleId: "THE-CIGAR-HEIST", name: "THE_CIGAR_HEIST", status: "ACTIVE", desc: "THE CIGAR HEIST" },
  { id: "THE-FLUORESCENT-CAGE", articleId: "THE-FLUORESCENT-CAGE", name: "THE_FLUORESCENT_CAGE", status: "ACTIVE", desc: "THE FLUORESCENT CAGE" },
/* @@INJECT_END@@ */
];

export default kernelBuilds;
