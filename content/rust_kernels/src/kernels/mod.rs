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
pub mod feigenbaum;      // run_feigenbaum_cascade
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
