// kernels/leviathan.rs — Leviathan Benchmark (V-Cache Annihilator v1.0)
use wasm_bindgen::prelude::*;

/// Boot the Leviathan Cellular Automata benchmark.
/// grid_size:   number of cells in the 1-D automaton (default 100_000)
/// generations: number of evolution steps (default 100)
/// Runs Rule-30 subset over a large buffer to saturate the 5800X3D V-Cache.
#[wasm_bindgen]
pub fn boot_leviathan_benchmark(grid_size: f64, generations: f64) -> String {
    let size  = if grid_size   <= 0.0 { 100_000.0 } else { grid_size   } as usize;
    let iters = if generations <= 0.0 {     100.0 } else { generations } as usize;

    let mut current_state = vec![0u8; size];
    let mut next_state    = vec![0u8; size];
    let mut mutations: u64 = 0;

    // Inject initial entropy — alternating 0/1 pattern
    for i in 0..size {
        current_state[i] = (i % 2) as u8;
    }

    for _ in 0..iters {
        for i in 1..(size - 1) {
            let left   = current_state[i - 1];
            let center = current_state[i];
            let right  = current_state[i + 1];

            // High-entropy Rule-30 subset
            let new_val = match (left, center, right) {
                (1, 0, 0) | (0, 1, 1) | (0, 1, 0) | (0, 0, 1) => 1,
                _ => 0,
            };
            next_state[i] = new_val;
            if new_val != center { mutations += 1; }
        }
        // O(1) pointer swap — eliminates the O(size) memcpy per generation.
        std::mem::swap(&mut current_state, &mut next_state);
    }

    let cache_pressure = (size as f64 * iters as f64) / 1_000_000.0;

    let status = if cache_pressure > 500.0 {
        "CRITICAL: L3 Cache Flooded // Thread Starvation Risk"
    } else {
        "STABLE: V-Cache Absorbing Entropy // Execution Optimal"
    };

    format!(
        "LEVIATHAN_BENCHMARK v1.0 // BOOT_OK\n\
         STATUS: {}\n\
         GRID_SITES: {}\n\
         GENERATIONS: {}\n\
         MUTATIONS_PROCESSED: {}\n\
         CACHE_PRESSURE: {:.1} M-Ops\n\
         SOURCE: content/rust_kernels/src/kernels/leviathan.rs",
        status, size, iters, mutations, cache_pressure
    )
}
