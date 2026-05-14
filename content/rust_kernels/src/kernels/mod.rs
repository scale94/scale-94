// kernels/mod.rs — Module membrane: declares all kernel vesicles
//
// Each submodule is a self-contained simulation unit.
// All #[wasm_bindgen] exports are declared within their respective modules.
// lib.rs is the routing membrane — it only declares `pub mod kernels`.

pub mod utils;           // shared PRNG (pub(crate), not exported to JS)

pub mod soma;            // soma_91_banner, boot_soma55
pub mod biocoenosis;     // BiocoenosisKernel
pub mod necromantic;     // NecromanticEngine
pub mod bosonic;         // boot_bosonic_lattice
pub mod atmospheric;     // boot_thermosphere_protocol
pub mod geopolitical;    // boot_geopolitical_kinetics
pub mod leviathan;       // boot_leviathan_benchmark
pub mod daly;            // run_daly_thermo_simulation
pub mod ceei;            // run_ceei_allocation_engine
pub mod soma_plus;       // run_soma_plus_engine
pub mod strangler_fig;   // run_strangler_fig_transition
pub mod soma_kernel;     // SomaKernel (stateful multi-cycle simulator)
pub mod surveillance;    // run_surveillance_index
pub mod kuramoto;        // run_kuramoto_synchrony
pub mod replicator;      // run_evolutionary_replicator
pub mod ising;           // run_ising_consensus
pub mod feigenbaum;      // run_feigenbaum_cascade, run_stiller_divergence
pub mod dh_ec;           // run_dh_ec_kernel
pub mod grayscott;       // GrayScottKernel (stateful reaction-diffusion)
pub mod classified;      // run_classified (ML-KEM-768 post-quantum crypto)
pub mod cynic_realist;   // run_cynic_realist (Kuramoto-England dissipative adaptation)
pub mod pragmatic;       // run_pragmatic_type (DRK: Pragmatic<T> thermodynamic type system)
pub mod chrono_actuary;  // run_chrono_actuary (Deep-Time Audit Framework · River Sovereign)
pub mod fusion_plasma;   // run_fusion_plasma (Plasma Sovereignty Audit · Lawson Criterion · Q-Factor)
pub mod seraphine;       // run_seraphine_sarg (Quantum Associative Reasoning Gain · Lindblad · SARG)
pub mod pqhash;          // run_pqhash_analysis (Post-Quantum Hash Audit · Grover · BHT)
pub mod associative_field; // run_associative_field (Hopfield Attractor Network · 25-node kernel graph)
pub mod bellard_baudrillard; // run_phonemic_drift (Phonemic Drift · Memory Hash Collision · Simulacra)
pub mod mesantropy;          // run_mesantropy (Scalar Sovereignty Engine v3.3.3 + 4.4.4.4)
pub mod sovereign_seven;     // run_sovereign_seven (Crystalline Invariance Engine v7.7.7.7.7.7.7)
pub mod tesseract_vault;     // run_tesseract_vault (Hybrid PQC Pipeline · Argon2id + ML-KEM-1024 + ML-DSA-87 + AES-256-GCM + BLAKE3)
pub mod spectral_bridge;     // run_spectral_bridge (Cross-Cluster Topology Discovery · Cosine Similarity · 16-dim Mathematical Fingerprints)
pub mod enclave;             // enclave_keygen, enclave_seal, enclave_open (ML-KEM-768 + AES-256-GCM real encrypt/decrypt)
pub mod text_probe;          // run_text_probe (16D concept fingerprinting · cosine projection into kernel space)
pub mod bone_fusion;         // run_bone_fusion (Conceptual Singularity Engine v6.6.6.6.6.6 · 16D Tensor Fusion Foundation)
pub mod compare_nodes;       // compare_nodes, compute_bifurcation_children (16D cosine similarity + Feigenbaum bifurcation)
pub mod percolation;         // run_percolation (Erdős–Rényi network resilience · Molloy-Reed critical threshold · targeted vs random attack)
pub mod fish_scale;          // run_fish_scale (Feigenbaum-Bouligand Coupled Architecture · Arapaima armor · Moiré interference · v12.1.0)
pub mod latent_collider;     // run_latent_collider (Latent Space Collider · SCALING Module · 1536D cross-attention synthesis)
pub mod panopticon_percolation; // run_panopticon_percolation (Panopticon Percolation · SURVEILLANCE Module · dragnet contagion Monte Carlo)
pub mod ock;                     // run_ock (Olfactory-Computational Kernel v1.0.0 · Bimmelbahn Accord · volatile semiotics)
pub mod clean_room;              // CleanRoom (stateful decimation filter · orphan pruning · energy-aware downsampling)
pub mod lunar;                   // run_lunar_phase (Meeus astronomical algorithm · true phase angle · sub-1% illumination accuracy)
pub mod empathy_kernel;      // run_empathy_kernel (Emotional Contagion · Hatfield 1993 · de Waal 2008)
pub mod zero_day;            // run_zero_day (CVE Cascade · SIR on Barabási-Albert network)
pub mod mutation_kernel;     // run_mutation_kernel (Quasispecies Equation · Eigen 1971)
pub mod mycelium_kernel;     // run_mycelium_kernel (Mycelial Network Growth · Boddy & Donnelly 2007)
pub mod signal_legacy;       // run_signal_legacy (Long-Range Information Theory · 1/f noise · Shannon 1948)
pub mod metallurgy_kernel;   // run_metallurgy_kernel (Spectral Signal Differentiation · CIE LAB · SDT)
pub mod network_collapse;    // run_network_collapse (Social Network Fragmentation · Watts-Strogatz)
pub mod purification_kernel; // run_purification_kernel (SVD Signal Purification · Marchenko-Pastur)
pub mod resistance_kernel;   // run_resistance_kernel (Granovetter Threshold Model · 1978)
pub mod ideological_synthesis; // run_ideological_synthesis (Deffuant Bounded Confidence · HIVE Dynamics)
pub mod juridical_substrate; // run_juridical_substrate (Nash Equilibrium · Mechanism Design · Myerson 1979)
pub mod post_capitalist;     // run_post_capitalist (Leontief I-O Analysis · Post-Scarcity Automation)
pub mod bridge_kernel;       // run_bridge_kernel (Structural Holes · Burt 1992 · Betweenness Centrality)
pub mod corpus_synthesis;    // run_corpus_synthesis (LDA Topic Discovery · Blei et al. 2003)
pub mod glyph_archive;       // run_glyph_archive (Zipf-Mandelbrot Law · Huffman Coding · Archive Entropy)
pub mod astro;                   // run_astro (planetary positions · Jean Meeus VSOP87 truncated · TFG sphere click readings)
pub mod kernel_zero;             // run_kernel_zero (Origin Vector · DHCP unspecified · genesis trajectory in 16-D feature space)
