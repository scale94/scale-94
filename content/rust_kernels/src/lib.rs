// lib.rs — Scale 9.4 // Rust Kernel Execution Layer
// SOMA-9.1 // GAIA BUILD
//
// Routing membrane: this file declares the kernels module tree.
// All simulation logic lives in isolated vesicles under src/kernels/.
// This file must remain free of simulation logic.
//
// Kernel manifest (wasm-bindgen exports):
//   soma_91_banner()               → SOMA-9.1 Gaia Build boot banner
//   BiocoenosisKernel::boot        → Biodiversity Kernel 1.0.1
//   NecromanticEngine::boot        → Fish Scale Kernel 11.1.1
//   boot_bosonic_lattice()         → Bosonic Lattice Simulator 2.0
//   boot_thermosphere_protocol()   → Atmospheric Entropy Kernel 3.0
//   boot_geopolitical_kinetics()   → Kinetic Statecraft Kernel 1.0
//   boot_leviathan_benchmark()     → Leviathan Cellular Automata 1.0
//   boot_soma55()                  → soma_kernel_5.5 boot diagnostic
//   run_daly_thermo_simulation()   → Daly Rules ODE simulation
//   run_ceei_allocation_engine()   → A-CEEI Walrasian allocation
//   run_soma_plus_engine()         → Soma Plus social capital engine
//   run_strangler_fig_transition() → Strangler Fig logistic transition
//   SomaKernel::execute_cycle()    → Stateful socioeconomic simulator
//   run_surveillance_index()       → Panopticon Index (grey-c0 dataset)
//   run_kuramoto_synchrony()       → Kuramoto phase-coupled oscillators
//   run_evolutionary_replicator()  → 3-strategy replicator dynamics
//   run_ising_consensus()          → 2-D Ising social consensus field
//   run_feigenbaum_cascade()       → Bifurcation cascade (δ = 4.6692…)
//   run_dh_ec_kernel()             → DH-EC Cryptographic Architecture (Signal/Threema)
//   GrayScottKernel::compute_steps() → Reaction-Diffusion PDE (Ars Electronica 2027)
//   run_classified()               → ML-KEM-768 Post-Quantum KEM (FIPS 203)
//
//   run_percolation()              → Network Percolation / Resilience Kernel
//
// Build with: wasm-pack build --target web
// Output:     pkg/  →  scripts/import-rust.js copies to public/wasm/

pub mod kernels;
