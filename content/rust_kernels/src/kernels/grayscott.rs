// kernels/grayscott.rs — Gray-Scott Reaction-Diffusion Kernel
// Scale 9.4 // Ars Electronica 2027
//
// Solves the Gray-Scott PDE system on a fixed 60×20 ASCII terminal grid:
//   du/dt = Du·∇²u  -  u·v²  +  f·(1 - u)
//   dv/dt = Dv·∇²v  +  u·v²  -  (f + k)·v
//
// Exports:
//   GrayScottKernel::new()                    → stateful kernel (persists across calls)
//   GrayScottKernel::compute_steps(f, k, n)   → run n PDE steps, return ASCII log

use wasm_bindgen::prelude::*;

// ASCII density map: empty → dense (10 characters)
const DENSITY_MAP: &[u8] = b" .:-=+*#%@";

// Terminal display dimensions — fixed for system kernel log output
const DEFAULT_WIDTH:  usize = 60;
const DEFAULT_HEIGHT: usize = 20;

/// Autocomplete hint: returns parameter names for the terminal UI
#[wasm_bindgen]
pub fn grayscott_params() -> js_sys::Array {
    js_sys::Array::of3(
        &JsValue::from_str("[feed_rate]"),
        &JsValue::from_str("[kill_rate]"),
        &JsValue::from_str("[frames]"),
    )
}

/// Stateful Gray-Scott kernel — grid persists between compute_steps() calls.
/// Each call continues the simulation from where the last left off.
#[wasm_bindgen]
pub struct GrayScottKernel {
    width:  usize,
    height: usize,
    u:      Vec<f64>,
    v:      Vec<f64>,
    // Total steps elapsed — appended to log header for continuity tracking
    total_steps: usize,
}

#[wasm_bindgen]
impl GrayScottKernel {
    /// Construct with default 60×20 grid seeded at centre.
    /// No-arg constructor required by the WASM stateful kernel protocol.
    #[wasm_bindgen(constructor)]
    pub fn new() -> GrayScottKernel {
        let width  = DEFAULT_WIDTH;
        let height = DEFAULT_HEIGHT;
        let size   = width * height;

        let mut u = vec![1.0_f64; size];
        let mut v = vec![0.0_f64; size];

        // Seed centre patch with species V to initiate the reaction.
        // Clamp prevents usize underflow on very small grids.
        let cx = width  / 2;
        let cy = height / 2;
        for y in cy.saturating_sub(2)..=(cy + 2).min(height - 1) {
            for x in cx.saturating_sub(2)..=(cx + 2).min(width - 1) {
                u[y * width + x] = 0.5;
                v[y * width + x] = 0.25;
            }
        }

        GrayScottKernel { width, height, u, v, total_steps: 0 }
    }

    /// Advance the simulation by `frames` PDE steps then render the V-field.
    /// Uses 5-point discrete Laplacian with Dirichlet (zero-flux) boundary.
    /// Swap-based double-buffering avoids the full memcopy of copy_from_slice.
    pub fn compute_steps(&mut self, feed: f64, kill: f64, frames: usize) -> String {
        let du = 1.0_f64;   // Diffusion coefficient of species U
        let dv = 0.5_f64;   // Diffusion coefficient of species V
        let dt = 1.0_f64;   // Time step

        let mut next_u = self.u.clone();
        let mut next_v = self.v.clone();

        for _ in 0..frames {
            for y in 1..(self.height - 1) {
                for x in 1..(self.width - 1) {
                    let idx = y * self.width + x;

                    let u   = self.u[idx];
                    let v   = self.v[idx];
                    let uvv = u * v * v;

                    // 5-point discrete Laplacian approximation
                    let lap_u = self.u[idx - 1]            + self.u[idx + 1]
                              + self.u[idx - self.width]   + self.u[idx + self.width]
                              - 4.0 * u;

                    let lap_v = self.v[idx - 1]            + self.v[idx + 1]
                              + self.v[idx - self.width]   + self.v[idx + self.width]
                              - 4.0 * v;

                    // du/dt = Du·∇²u  -  u·v²  +  f·(1 - u)
                    next_u[idx] = u + (du * lap_u - uvv + feed * (1.0 - u)) * dt;
                    // dv/dt = Dv·∇²v  +  u·v²  -  (f + k)·v
                    next_v[idx] = v + (dv * lap_v + uvv - (feed + kill) * v) * dt;
                }
            }
            // O(1) buffer rotation — avoids full memcopy each frame
            std::mem::swap(&mut self.u, &mut next_u);
            std::mem::swap(&mut self.v, &mut next_v);
        }

        self.total_steps += frames;
        self.render_log(feed, kill, frames)
    }

    /// Render the V-field as an ASCII density map for the system kernel log.
    fn render_log(&self, feed: f64, kill: f64, frames: usize) -> String {
        let mut out = String::from("[SYS] GRAY-SCOTT REACTION-DIFFUSION KERNEL\n");
        out.push_str(&format!(
            "[SYS] F: {:.4} | K: {:.4} | FRAMES: {} | TOTAL_STEPS: {}\n",
            feed, kill, frames, self.total_steps
        ));
        out.push_str("[SYS] SOLVING PDEs — du/dt = Du·∇²u - uv² + f(1-u)\n");
        out.push_str("[SYS]               dv/dt = Dv·∇²v + uv² - (f+k)v\n\n");

        for y in 0..self.height {
            out.push_str("      ");
            for x in 0..self.width {
                let val = self.v[y * self.width + x].clamp(0.0, 1.0);
                let idx = ((val * DENSITY_MAP.len() as f64) as usize)
                    .min(DENSITY_MAP.len() - 1);
                out.push(DENSITY_MAP[idx] as char);
            }
            out.push('\n');
        }

        out.push_str("\n[SYS] STATE CAPTURED. GRID PERSISTS — CALL AGAIN TO CONTINUE.\n");
        out
    }
}
