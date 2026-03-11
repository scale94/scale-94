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
