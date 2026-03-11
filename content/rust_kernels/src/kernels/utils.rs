// kernels/utils.rs — Shared simulation utilities
//
// Park-Miller LCG: fast, deterministic, no `rand` crate needed in WASM.
// pub(crate) visibility: internal use only — not exported to JS.

/// Park-Miller LCG PRNG — good uniform distribution for simulation seeding.
#[inline]
pub(crate) fn lcg_next(state: &mut u64) -> f64 {
    *state = state.wrapping_mul(6_364_136_223_846_793_005)
                  .wrapping_add(1_442_695_040_888_963_407);
    ((*state >> 33) as f64) / (u32::MAX as f64)
}
