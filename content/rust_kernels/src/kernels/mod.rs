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
pub mod bellard_baudrillard; // run_phonemic_drift (Phonemic Drift · Memory Hash Collision · Simulacra)
pub mod mesantropy;          // run_mesantropy (Scalar Sovereignty Engine v3.3.3 + 4.4.4.4)
pub mod sovereign_seven;     // run_sovereign_seven (Crystalline Invariance Engine v7.7.7.7.7.7.7)
pub mod tesseract_vault;     // run_tesseract_vault (Hybrid PQC Pipeline · Argon2id + ML-KEM-1024 + ML-DSA-87 + AES-256-GCM + BLAKE3)
