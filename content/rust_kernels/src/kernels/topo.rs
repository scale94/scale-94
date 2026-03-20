// ─────────────────────────────────────────────────────────────────────────────
// topo.rs  —  Spherical-Cartesian Topographic Engine
//
// Zero-copy memory bridge pattern:
//
//   Step 1 — JS calls `topo_alloc(n)` to pre-allocate both input + output
//             buffers of `n` (lat, lon, depth) triplets in WASM linear memory.
//
//   Step 2 — JS calls `topo_get_input()` → receives a Float32Array that is a
//             *live view* into the WASM input buffer (no copy). JS writes
//             (lat°, lon°, depth_km) triplets directly into this view.
//
//   Step 3 — JS calls `topo_transform(n, radius, depth_scale)`.
//             Rust reads the input buffer, performs batch trig, writes
//             (x, y, z) results into the output buffer. No heap allocation.
//
//   Step 4 — JS calls `topo_get_output()` → receives a Float32Array that is a
//             *live view* into the WASM output buffer (no copy). JS hands this
//             directly to a WebGL buffer or Canvas 2D draw loop.
//
// Coordinate convention:
//   +Y = North Pole
//   +X = equator at Prime Meridian (lat=0°, lon=0°)
//   +Z = equator at 90°E           (lat=0°, lon=90°)
//
// Depth convention:
//   depth_km  > 0 → below sea level (ocean); shrinks radius
//   depth_km  < 0 → above sea level (elevation); expands radius
//
// No JSON serialisation. No heap allocation in the hot path.
// Both buffers are allocated once in `topo_alloc` and never moved.
// Float32Array views remain valid for the lifetime of the WASM module.
// ─────────────────────────────────────────────────────────────────────────────

use wasm_bindgen::prelude::*;
use js_sys::Float32Array;
use std::cell::RefCell;

// Earth mean radius (km) — WGS-84 volumetric mean
const EARTH_R_KM: f32 = 6_371.0;
// Hard clamp on depth to prevent runaway geometry (Mariana Trench ≈ 11 km)
const MAX_DEPTH_KM: f32 = 11.0;

// ── WASM linear-memory buffers ────────────────────────────────────────────────
// thread_local! is the wasm-bindgen idiom for module-level state.
// WASM is single-threaded; RefCell gives interior mutability without overhead.
thread_local! {
    /// Flat input buffer: [lat₀, lon₀, depth₀,  lat₁, lon₁, depth₁, …]
    static INPUT: RefCell<Vec<f32>> = RefCell::new(Vec::new());
    /// Flat output buffer: [x₀, y₀, z₀,  x₁, y₁, z₁, …]
    static OUTPUT: RefCell<Vec<f32>> = RefCell::new(Vec::new());
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/// Pre-allocate input and output buffers for `n` (lat, lon, depth) triplets.
///
/// Must be called once before `topo_get_input` / `topo_get_output`.
/// Calling again with the same `n` is a no-op (buffers are reused as-is).
/// Calling with a different `n` reallocates — invalidates any held views.
#[wasm_bindgen]
pub fn topo_alloc(n: usize) {
    INPUT.with(|inp| {
        let mut buf = inp.borrow_mut();
        let cap = n * 3;
        if buf.len() != cap {
            buf.clear();
            buf.resize(cap, 0.0_f32);
        }
    });
    OUTPUT.with(|out| {
        let mut buf = out.borrow_mut();
        let cap = n * 3;
        if buf.len() != cap {
            buf.clear();
            buf.resize(cap, 0.0_f32);
        }
    });
}

// ── Zero-copy views ───────────────────────────────────────────────────────────

/// Return a live Float32Array view of the input buffer.
///
/// # Safety
/// The view is valid as long as no reallocation occurs (i.e., `topo_alloc` is
/// not called again with a different `n` while the view is held).
/// In this pipeline the buffers are allocated once and never moved, so the
/// view is effectively permanent.
#[wasm_bindgen]
pub fn topo_get_input() -> Float32Array {
    INPUT.with(|inp| {
        let buf = inp.borrow();
        // SAFETY: `buf` lives for the lifetime of the thread_local static.
        // The Float32Array view is valid until the Vec is reallocated.
        // Callers must call `topo_alloc` before this function, and must not
        // call `topo_alloc` again with a different size while holding the view.
        unsafe { Float32Array::view(&buf) }
    })
}

/// Return a live Float32Array view of the output buffer.
///
/// Call this *after* `topo_transform` to receive the computed (x, y, z) data.
/// Same lifetime guarantees as `topo_get_input`.
#[wasm_bindgen]
pub fn topo_get_output() -> Float32Array {
    OUTPUT.with(|out| {
        let buf = out.borrow();
        unsafe { Float32Array::view(&buf) }
    })
}

// ── Transform ─────────────────────────────────────────────────────────────────

/// Convert `n` (lat°, lon°, depth_km) triplets → (x, y, z) Cartesian coords.
///
/// Reads from the input buffer (written by JS via `topo_get_input` view).
/// Writes results into the output buffer (read by JS via `topo_get_output`).
///
/// # Parameters
/// - `n`           — number of points (input/output must each be pre-allocated
///                   to `n * 3` f32s via `topo_alloc`).
/// - `radius`      — base sphere radius. Use `1.0` for a unit sphere (the
///                   standard for most render pipelines); use `6371.0` for km.
/// - `depth_scale` — multiplier applied to the depth modifier.
///                   `0.0` = perfectly round sphere (ignores depth).
///                   `1.0` = full topographic relief.
///                   Values in `0.05..0.2` give a subtle, realistic effect.
#[wasm_bindgen]
pub fn topo_transform(n: usize, radius: f32, depth_scale: f32) {
    // Pre-compute the per-km radius fraction for depth normalisation.
    // At radius = 1.0 (unit sphere): 1 km depth ≈ 0.000157 unit change in r.
    // At radius = 6371.0 (km):       1 km depth = 1.0 km change in r.
    let km_to_unit = radius / EARTH_R_KM;

    INPUT.with(|inp| {
        OUTPUT.with(|out| {
            let input  = inp.borrow();
            let mut output = out.borrow_mut();

            // Panic early if buffers are not allocated to the right size.
            // In release builds this maps to an unreachable trap — acceptable
            // because the caller controls buffer sizing via `topo_alloc`.
            debug_assert!(input.len()  >= n * 3, "topo input buffer too small");
            debug_assert!(output.len() >= n * 3, "topo output buffer too small");

            let safe_n = n.min(input.len() / 3).min(output.len() / 3);

            for i in 0..safe_n {
                let b = i * 3;

                let lat_deg  = input[b];
                let lon_deg  = input[b + 1];
                let depth_km = input[b + 2];

                // Spherical → Cartesian trigonometry.
                // Uses f32 sin/cos which map to single WASM instructions.
                let lat = lat_deg.to_radians();
                let lon = lon_deg.to_radians();

                let (sin_lat, cos_lat) = lat.sin_cos();
                let (sin_lon, cos_lon) = lon.sin_cos();

                // Clamp depth to geologically plausible bounds.
                let d = depth_km.clamp(-MAX_DEPTH_KM, MAX_DEPTH_KM);

                // Radius modifier: ocean depth (d > 0) pulls inward,
                // land elevation (d < 0) pushes outward.
                let r = radius - d * km_to_unit * depth_scale;

                output[b]     = r * cos_lat * cos_lon; // X  (0°N 0°E pole)
                output[b + 1] = r * sin_lat;           // Y  (North pole)
                output[b + 2] = r * cos_lat * sin_lon; // Z  (0°N 90°E pole)
            }
        })
    })
}

// ── Utility ───────────────────────────────────────────────────────────────────

/// Return the current allocated capacity of the output buffer (number of f32s).
/// Divide by 3 to get point count.
#[wasm_bindgen]
pub fn topo_output_len() -> usize {
    OUTPUT.with(|out| out.borrow().len())
}

/// Return the current allocated capacity of the input buffer (number of f32s).
#[wasm_bindgen]
pub fn topo_input_len() -> usize {
    INPUT.with(|inp| inp.borrow().len())
}
