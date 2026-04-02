// kernels/clean_room.rs -- SOMA-9.4 // FEIGENBAUM_FADE // Clean Room Protocol
//
// Stateful decimation filter that runs before the rendering loop.
// Solves the 272-node / 64-edge visual entropy problem by enforcing structural
// discipline: orphan pruning + energy-aware downsampling.
//
// Design constraints:
//   - Zero allocation in the hot path (pre-allocated buffers, reused each frame)
//   - O(E + N + S log S) per frame where S = survivors after pruning
//   - All state lives in a single WASM-exported struct for JS interop
//
// The filter produces a sorted index array of surviving nodes. The JS render
// loop reads this array and skips everything else -- no cloning, no GC pressure.
//
// Theory:
//   Molloy-Reed (1995) -- k-core decomposition as structural filter
//   Barabasi & Albert (1999) -- preferential attachment centrality ranking

use wasm_bindgen::prelude::*;

// ── Configuration constants ──────────────────────────────────────────────────

const DEFAULT_MIN_EDGES: u32  = 2;     // orphan threshold (degree < this = pruned)
const DEFAULT_CAP: usize      = 48;    // max rendered nodes when energy-constrained
const MAX_NODES: usize        = 512;   // hard ceiling -- pre-allocated buffer size
const ENERGY_THRESHOLD: f64   = 0.50;  // below this = constrained mode

// ── CleanRoom struct ─────────────────────────────────────────────────────────

#[wasm_bindgen]
pub struct CleanRoom {
    // Pre-allocated work buffers -- reused every frame, never re-allocated
    degree:    Vec<u32>,     // degree count per node
    weight:    Vec<f64>,     // accumulated edge weight per node (centrality proxy)
    survivors: Vec<u32>,     // output: indices that survive the filter
    sort_key:  Vec<f64>,     // composite score for ranking (weight + degree bonus)

    // Configuration
    min_edges:       u32,    // orphan pruning threshold
    constrained_cap: usize,  // max nodes under energy constraint
    node_cap:        usize,  // current allocated capacity
}

#[wasm_bindgen]
impl CleanRoom {
    /// Create a new CleanRoom filter pre-allocated for `max_nodes`.
    /// Typical: `CleanRoom::new(512)` -- covers any realistic graph expansion.
    #[wasm_bindgen(constructor)]
    pub fn new(max_nodes: u32) -> CleanRoom {
        let cap = (max_nodes as usize).min(MAX_NODES);
        CleanRoom {
            degree:    vec![0; cap],
            weight:    vec![0.0; cap],
            survivors: Vec::with_capacity(cap),
            sort_key:  vec![0.0; cap],
            min_edges:       DEFAULT_MIN_EDGES,
            constrained_cap: DEFAULT_CAP,
            node_cap:        cap,
        }
    }

    /// Override the minimum edge threshold for orphan pruning.
    /// Nodes with degree < `min_edges` are culled.
    pub fn set_min_edges(&mut self, min_edges: u32) {
        self.min_edges = min_edges;
    }

    /// Override the constrained-mode node cap.
    pub fn set_constrained_cap(&mut self, cap: u32) {
        self.constrained_cap = (cap as usize).min(self.node_cap);
    }

    /// Run the full decimation pipeline.
    ///
    /// # Arguments
    /// - `node_count`    -- total nodes in the graph this frame
    /// - `edge_src`      -- flat array of edge source indices (length = E)
    /// - `edge_dst`      -- flat array of edge destination indices (length = E)
    /// - `edge_weights`  -- flat array of edge weights (length = E), or empty for uniform weight
    /// - `energy_state`  -- system energy 0.0..1.0 (< 0.5 triggers constrained cap)
    ///
    /// # Returns
    /// Number of survivors. Read the survivor indices via `get_survivors()`.
    ///
    /// # Complexity
    /// O(E) to build degree/weight tables +
    /// O(N) to scan for orphans +
    /// O(S log S) to sort survivors by centrality.
    /// Total: O(E + N + S log S) -- well within a 16ms frame budget for N < 512.
    pub fn decimate(
        &mut self,
        node_count: u32,
        edge_src: &[u32],
        edge_dst: &[u32],
        edge_weights: &[f64],
        energy_state: f64,
    ) -> u32 {
        let n = (node_count as usize).min(self.node_cap);
        let e = edge_src.len().min(edge_dst.len());
        let has_weights = edge_weights.len() >= e;

        // ── Phase 1: Reset work buffers (O(N)) ──────────────────────────────
        for i in 0..n {
            self.degree[i] = 0;
            self.weight[i] = 0.0;
            self.sort_key[i] = 0.0;
        }
        self.survivors.clear();

        // ── Phase 2: Build degree + weight tables (O(E)) ────────────────────
        for ei in 0..e {
            let s = edge_src[ei] as usize;
            let d = edge_dst[ei] as usize;
            if s >= n || d >= n { continue; }

            let w = if has_weights { edge_weights[ei].max(0.001) } else { 1.0 };

            self.degree[s] += 1;
            self.degree[d] += 1;
            self.weight[s] += w;
            self.weight[d] += w;
        }

        // ── Phase 3: Orphan pruning (O(N)) ──────────────────────────────────
        // Drop nodes below the connectivity threshold.
        // Survivors are pushed into the output buffer.
        for i in 0..n {
            if self.degree[i] >= self.min_edges {
                self.survivors.push(i as u32);
            }
        }

        // ── Phase 4: Energy-aware downsampling ──────────────────────────────
        // If the system is energy-constrained, keep only the top-K by
        // composite centrality score = weighted_degree + degree_bonus.
        let constrained = energy_state < ENERGY_THRESHOLD;
        let cap = if constrained { self.constrained_cap } else { self.node_cap };

        if self.survivors.len() > cap {
            // Build composite sort keys for survivors only
            for &idx in &self.survivors {
                let i = idx as usize;
                // Weighted degree + small bonus for raw connectivity
                // -- approximates betweenness centrality without O(N^3) cost
                self.sort_key[i] = self.weight[i] + (self.degree[i] as f64) * 0.1;
            }

            // Partial sort: we only need top `cap`, but for N < 512 a full
            // sort_unstable is faster than a partial k-select due to cache locality
            self.survivors.sort_unstable_by(|&a, &b| {
                let ka = self.sort_key[a as usize];
                let kb = self.sort_key[b as usize];
                kb.partial_cmp(&ka).unwrap_or(core::cmp::Ordering::Equal)
            });

            self.survivors.truncate(cap);

            // Re-sort by index so the render loop can do stable iteration
            self.survivors.sort_unstable();
        }

        self.survivors.len() as u32
    }

    /// Read the survivor array after `decimate()`.
    /// Returns a copy as a JS-visible `Uint32Array`.
    pub fn get_survivors(&self) -> Vec<u32> {
        self.survivors.clone()
    }

    /// Check if a specific node index survived the last decimation.
    /// O(log S) binary search on the sorted survivor array.
    pub fn is_visible(&self, idx: u32) -> bool {
        self.survivors.binary_search(&idx).is_ok()
    }

    /// Return the degree of a node from the last decimation pass.
    /// Useful for JS-side styling (thicker edges for high-degree nodes).
    pub fn node_degree(&self, idx: u32) -> u32 {
        let i = idx as usize;
        if i < self.node_cap { self.degree[i] } else { 0 }
    }

    /// Return the accumulated edge weight of a node from the last pass.
    pub fn node_weight(&self, idx: u32) -> f64 {
        let i = idx as usize;
        if i < self.node_cap { self.weight[i] } else { 0.0 }
    }

    /// Return diagnostic stats from the last decimation as JSON.
    /// Lightweight -- no allocations beyond the output string.
    pub fn diagnostics(&self, node_count: u32, edge_count: u32, energy_state: f64) -> String {
        let n = node_count as usize;
        let s = self.survivors.len();
        let pruned = if n > s { n - s } else { 0 };
        let constrained = energy_state < ENERGY_THRESHOLD;

        // Compute mean degree of survivors only
        let mean_deg: f64 = if s > 0 {
            self.survivors.iter()
                .map(|&i| self.degree[i as usize] as f64)
                .sum::<f64>() / s as f64
        } else { 0.0 };

        format!(
            concat!(
                r#"{{"input_nodes":{},"input_edges":{},"survivors":{},"#,
                r#""pruned":{},"constrained":{},"energy":{:.3},"#,
                r#""mean_survivor_degree":{:.2},"cap":{}}}"#,
            ),
            node_count, edge_count, s,
            pruned, constrained, energy_state,
            mean_deg, if constrained { self.constrained_cap } else { self.node_cap },
        )
    }
}
