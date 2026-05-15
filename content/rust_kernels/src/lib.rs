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
//   run_stiller_divergence()       → Stiller Divergence v1.1.1 (volatile semiotic vs fossil record)
//   run_dh_ec_kernel()             → DH-EC Cryptographic Architecture (Signal/Threema)
//   GrayScottKernel::compute_steps() → Reaction-Diffusion PDE (Ars Electronica 2027)
//   run_classified()               → ML-KEM-768 Post-Quantum KEM (FIPS 203)
//
//   run_lindblad_fade()            → Lindblad Decoherence Engine (FADE-DOCTRINE-KERNEL-2.0.0)
//   run_lunar_phase()              → True Astronomical Lunar Phase (Meeus ch.47-48)
//   run_percolation()              → Network Percolation / Resilience Kernel
//   run_kernel_zero()              → KERNEL 0.0.0.0 — Origin Vector + Genesis Operation
//
//   run_gaia_scale_protocol()      → Gaia-Scale Sovereign Reconstruction v5.5.5
//   run_shadowsocks_exfil()        → RLHF Sycophancy Field · Channel Switch Analysis
//   run_sorbe_bloom()              → Sorbe Bloom Node Initiation v1.0.0 (Node 0108)
//   run_sss_doctrine()             → SSS Doctrine Literary Deterrent v5.1.0
//   run_underground_thermo()       → Underground Thermodynamics Kernel v1.0.0
//   run_necromantic_aristocrat()   → Necromantic Aristocrat Gold Posture v3.1.1
//   run_necromantic_emperor()      → Necromantic Emperor Fish Scale Paradox v3.0.0
//   run_necromantic_logitbias()    → Necromantic Logitbias Pirarucu/Levamisole v1.0.0
//   run_high_tower_protocol()      → High Tower Porcupine Strategy v1.0
//   run_fade_doctrine()            → Fade Doctrine Zero White Fade v2.0.0
//
// Build with: wasm-pack build --target web
// Output:     pkg/  →  scripts/import-rust.js copies to public/wasm/

pub mod kernels;
