/* @ts-self-types="./scale94_kernels.d.ts" */

export class BiocoenosisKernel {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BiocoenosisKernelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_biocoenosiskernel_free(ptr, 0);
    }
    /**
     * Static boot diagnostic — returns the kernel's initial state string.
     * Called by the terminal `run` command to populate the system log.
     * @returns {string}
     */
    static boot() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.biocoenosiskernel_boot();
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get_entropy_index() {
        const ret = wasm.biocoenosiskernel_get_entropy_index(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_species_count() {
        const ret = wasm.biocoenosiskernel_get_species_count(this.__wbg_ptr);
        return ret >>> 0;
    }
    constructor() {
        const ret = wasm.biocoenosiskernel_new();
        this.__wbg_ptr = ret >>> 0;
        BiocoenosisKernelFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Register N species. Recomputes Shannon entropy approximation.
     * @param {number} count
     */
    register_species(count) {
        wasm.biocoenosiskernel_register_species(this.__wbg_ptr, count);
    }
}
if (Symbol.dispose) BiocoenosisKernel.prototype[Symbol.dispose] = BiocoenosisKernel.prototype.free;

export class CleanRoom {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CleanRoomFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_cleanroom_free(ptr, 0);
    }
    /**
     * Run the full decimation pipeline.
     *
     * # Arguments
     * - `node_count`    -- total nodes in the graph this frame
     * - `edge_src`      -- flat array of edge source indices (length = E)
     * - `edge_dst`      -- flat array of edge destination indices (length = E)
     * - `edge_weights`  -- flat array of edge weights (length = E), or empty for uniform weight
     * - `energy_state`  -- system energy 0.0..1.0 (< 0.5 triggers constrained cap)
     *
     * # Returns
     * Number of survivors. Read the survivor indices via `get_survivors()`.
     *
     * # Complexity
     * O(E) to build degree/weight tables +
     * O(N) to scan for orphans +
     * O(S log S) to sort survivors by centrality.
     * Total: O(E + N + S log S) -- well within a 16ms frame budget for N < 512.
     * @param {number} node_count
     * @param {Uint32Array} edge_src
     * @param {Uint32Array} edge_dst
     * @param {Float64Array} edge_weights
     * @param {number} energy_state
     * @returns {number}
     */
    decimate(node_count, edge_src, edge_dst, edge_weights, energy_state) {
        const ptr0 = passArray32ToWasm0(edge_src, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray32ToWasm0(edge_dst, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF64ToWasm0(edge_weights, wasm.__wbindgen_malloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.cleanroom_decimate(this.__wbg_ptr, node_count, ptr0, len0, ptr1, len1, ptr2, len2, energy_state);
        return ret >>> 0;
    }
    /**
     * Return diagnostic stats from the last decimation as JSON.
     * Lightweight -- no allocations beyond the output string.
     * @param {number} node_count
     * @param {number} edge_count
     * @param {number} energy_state
     * @returns {string}
     */
    diagnostics(node_count, edge_count, energy_state) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.cleanroom_diagnostics(this.__wbg_ptr, node_count, edge_count, energy_state);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Read the survivor array after `decimate()`.
     * Returns a copy as a JS-visible `Uint32Array`.
     * @returns {Uint32Array}
     */
    get_survivors() {
        const ret = wasm.cleanroom_get_survivors(this.__wbg_ptr);
        var v1 = getArrayU32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * Check if a specific node index survived the last decimation.
     * O(log S) binary search on the sorted survivor array.
     * @param {number} idx
     * @returns {boolean}
     */
    is_visible(idx) {
        const ret = wasm.cleanroom_is_visible(this.__wbg_ptr, idx);
        return ret !== 0;
    }
    /**
     * Create a new CleanRoom filter pre-allocated for `max_nodes`.
     * Typical: `CleanRoom::new(512)` -- covers any realistic graph expansion.
     * @param {number} max_nodes
     */
    constructor(max_nodes) {
        const ret = wasm.cleanroom_new(max_nodes);
        this.__wbg_ptr = ret >>> 0;
        CleanRoomFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Return the degree of a node from the last decimation pass.
     * Useful for JS-side styling (thicker edges for high-degree nodes).
     * @param {number} idx
     * @returns {number}
     */
    node_degree(idx) {
        const ret = wasm.cleanroom_node_degree(this.__wbg_ptr, idx);
        return ret >>> 0;
    }
    /**
     * Return the accumulated edge weight of a node from the last pass.
     * @param {number} idx
     * @returns {number}
     */
    node_weight(idx) {
        const ret = wasm.cleanroom_node_weight(this.__wbg_ptr, idx);
        return ret;
    }
    /**
     * Override the constrained-mode node cap.
     * @param {number} cap
     */
    set_constrained_cap(cap) {
        wasm.cleanroom_set_constrained_cap(this.__wbg_ptr, cap);
    }
    /**
     * Override the minimum edge threshold for orphan pruning.
     * Nodes with degree < `min_edges` are culled.
     * @param {number} min_edges
     */
    set_min_edges(min_edges) {
        wasm.cleanroom_set_min_edges(this.__wbg_ptr, min_edges);
    }
}
if (Symbol.dispose) CleanRoom.prototype[Symbol.dispose] = CleanRoom.prototype.free;

/**
 * Stateful Gray-Scott kernel — grid persists between compute_steps() calls.
 * Each call continues the simulation from where the last left off.
 */
export class GrayScottKernel {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        GrayScottKernelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_grayscottkernel_free(ptr, 0);
    }
    /**
     * Advance the simulation by `frames` PDE steps then render the V-field.
     * Uses 5-point discrete Laplacian with Dirichlet (zero-flux) boundary.
     * Swap-based double-buffering avoids the full memcopy of copy_from_slice.
     * @param {number} feed
     * @param {number} kill
     * @param {number} frames
     * @returns {string}
     */
    compute_steps(feed, kill, frames) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.grayscottkernel_compute_steps(this.__wbg_ptr, feed, kill, frames);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Construct with default 60×20 grid seeded at centre.
     * No-arg constructor required by the WASM stateful kernel protocol.
     */
    constructor() {
        const ret = wasm.grayscottkernel_new();
        this.__wbg_ptr = ret >>> 0;
        GrayScottKernelFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) GrayScottKernel.prototype[Symbol.dispose] = GrayScottKernel.prototype.free;

export class NecromanticEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NecromanticEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_necromanticengine_free(ptr, 0);
    }
    /**
     * Static boot diagnostic — returns HarmonicResult string for the terminal.
     * @returns {string}
     */
    static boot() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.necromanticengine_boot();
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get_bpm() {
        const ret = wasm.necromanticengine_get_bpm(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {bigint}
     */
    get_cycle() {
        const ret = wasm.necromanticengine_get_cycle(this.__wbg_ptr);
        return BigInt.asUintN(64, ret);
    }
    /**
     * Returns a HarmonicResult string with current BPM and cycle count.
     * @returns {string}
     */
    harmonic_result() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.necromanticengine_harmonic_result(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    constructor() {
        const ret = wasm.necromanticengine_new();
        this.__wbg_ptr = ret >>> 0;
        NecromanticEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * Inject a resonance value. BPM is modulated by the resonance field.
     * Δbpm = sin(r × 7) × 11 — keeps oscillation within ±11 BPM of baseline.
     * @param {number} r
     */
    set_resonance(r) {
        wasm.necromanticengine_set_resonance(this.__wbg_ptr, r);
    }
}
if (Symbol.dispose) NecromanticEngine.prototype[Symbol.dispose] = NecromanticEngine.prototype.free;

export class SomaKernel {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SomaKernelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_somakernel_free(ptr, 0);
    }
    /**
     * Execute one annual policy cycle.
     * consumption    GJ/capita/yr  (legacy ~80; sustainable ~25)
     * waste          Mt CO2eq/yr   (legacy ~55000; sustainable <11000)
     * nr_depletion   fraction/yr   (legacy ~0.025; target <0.008)
     * compliance_mod delta to ostrom_compliance this cycle (-0.2 to +0.2)
     * @param {number} consumption
     * @param {number} waste
     * @param {number} nr_depletion
     * @param {number} compliance_mod
     * @returns {string}
     */
    execute_cycle(consumption, waste, nr_depletion, compliance_mod) {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.somakernel_execute_cycle(this.__wbg_ptr, consumption, waste, nr_depletion, compliance_mod);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {number}
     */
    get_adoption() {
        const ret = wasm.somakernel_get_adoption(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_entropy() {
        const ret = wasm.somakernel_get_entropy(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_soma_plus() {
        const ret = wasm.somakernel_get_soma_plus(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get_year() {
        const ret = wasm.somakernel_get_year(this.__wbg_ptr);
        return ret >>> 0;
    }
    constructor() {
        const ret = wasm.somakernel_new();
        this.__wbg_ptr = ret >>> 0;
        SomaKernelFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    reset() {
        wasm.somakernel_reset(this.__wbg_ptr);
    }
}
if (Symbol.dispose) SomaKernel.prototype[Symbol.dispose] = SomaKernel.prototype.free;

/**
 * Boot the Bosonic Lattice Simulator.
 *
 * * `n_nodes`   — Fermionic sovereign nodes (integer ≥ 1, passed as f64 for WASM)
 * * `coupling`  — boson-boson coupling constant [0–1]; bosonic field strength
 * * `thermal`   — reduced temperature kT/J [0–1]; 0=ground_state 1=decoherence
 * * `price_fix` — price measurement [0–1]; 0=gift_economy 1=fully_priced (kills trust)
 * @param {number} n_nodes
 * @param {number} coupling
 * @param {number} thermal
 * @param {number} price_fix
 * @returns {string}
 */
export function boot_bosonic_lattice(n_nodes, coupling, thermal, price_fix) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.boot_bosonic_lattice(n_nodes, coupling, thermal, price_fix);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Boot the Geopolitical Kinetics engine.
 * sanction:    economic pressure index (0–10 typical)
 * grid:        infrastructure/grid resilience (0–1; clamped to 0.1 minimum)
 * propaganda:  narrative control coefficient (0–1)
 * @param {number} sanction
 * @param {number} grid
 * @param {number} propaganda
 * @returns {string}
 */
export function boot_geopolitical_kinetics(sanction, grid, propaganda) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.boot_geopolitical_kinetics(sanction, grid, propaganda);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Boot the Leviathan Cellular Automata benchmark.
 * grid_size:   number of cells in the 1-D automaton (default 100_000)
 * generations: number of evolution steps (default 100)
 * Runs Rule-30 subset over a large buffer to saturate the 5800X3D V-Cache.
 * @param {number} grid_size
 * @param {number} generations
 * @returns {string}
 */
export function boot_leviathan_benchmark(grid_size, generations) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.boot_leviathan_benchmark(grid_size, generations);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Top-level boot diagnostic for soma_kernel_5.5.
 * Runs at default parameters to give a high-level status summary of all
 * four sub-systems: Daly Rules, A-CEEI, Soma Plus, Strangler Fig.
 * No parameters — callable as `run soma55` with zero flags.
 * @returns {string}
 */
export function boot_soma55() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.boot_soma55();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Boot the Thermosphere Protocol climate engine.
 * carbon_ppm:      atmospheric CO₂ concentration (ppm); pre-industrial baseline ~280
 * industrial_drag: dimensionless forcing multiplier (0–10 typical)
 * ocean_sink:      ocean carbon absorption efficiency (0–1; clamped to 0.01 minimum)
 * @param {number} carbon_ppm
 * @param {number} industrial_drag
 * @param {number} ocean_sink
 * @returns {string}
 */
export function boot_thermosphere_protocol(carbon_ppm, industrial_drag, ocean_sink) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.boot_thermosphere_protocol(carbon_ppm, industrial_drag, ocean_sink);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Autocomplete hint: single [reveal:0|1] parameter
 * @returns {Array<any>}
 */
export function classified_params() {
    const ret = wasm.classified_params();
    return ret;
}

/**
 * Compare two nodes by zero-based index.
 *
 * Returns a JSON string:
 * ```json
 * {
 *   "sim": 0.8734,
 *   "topDims": [
 *     { "name": "synchrony",   "contribution": 0.0625, "vA": 0.25, "vB": 0.25 },
 *     { "name": "spatial",     "contribution": 0.0423, "vA": 0.65, "vB": 0.65 },
 *     { "name": "stochastic",  "contribution": 0.0200, "vA": 0.20, "vB": 0.10 }
 *   ]
 * }
 * ```
 * @param {number} idx_a
 * @param {number} idx_b
 * @returns {string}
 */
export function compare_nodes(idx_a, idx_b) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.compare_nodes(idx_a, idx_b);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Compute period-doubling bifurcation children.
 *
 * `degrees_json` — JSON array of u32 connection degrees, one per node (length = N_NODES).
 *
 * Returns a JSON array of child specs for nodes in the top 15% by degree:
 * ```json
 * [
 *   {
 *     "parentIdx": 12,
 *     "childFeatures": [0.2987, 1.0000, 0.2532, ...]
 *   },
 *   ...
 * ]
 * ```
 * The JS layer is responsible for sphere placement, color inheritance, and birth animation.
 * @param {string} degrees_json
 * @returns {string}
 */
export function compute_bifurcation_children(degrees_json) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(degrees_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.compute_bifurcation_children(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Generate an ML-KEM-768 keypair. Stores the typed keypair in WASM memory
 * for subsequent seal/open calls. Returns formatted log + DATA: JSON with
 * hex-encoded ek (public) and dk (private).
 * @returns {string}
 */
export function enclave_keygen() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.enclave_keygen();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Decrypt a sealed blob using the decapsulation key from the most recent
 * `enclave_keygen()` call.
 * `sealed_hex` — hex-encoded sealed blob (kem_ct || nonce || aes_ct+tag)
 * Returns formatted log + DATA: JSON with the recovered plaintext.
 * @param {string} sealed_hex
 * @returns {string}
 */
export function enclave_open(sealed_hex) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(sealed_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.enclave_open(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Encrypt a plaintext message using ML-KEM-768 + AES-256-GCM.
 * Uses the encapsulation key from the most recent `enclave_keygen()` call.
 * Returns formatted log + DATA: JSON with the hex-encoded sealed blob.
 * @param {string} plaintext
 * @returns {string}
 */
export function enclave_seal(plaintext) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(plaintext, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.enclave_seal(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Autocomplete hint: returns parameter names for the terminal UI
 * @returns {Array<any>}
 */
export function grayscott_params() {
    const ret = wasm.grayscott_params();
    return ret;
}

/**
 * Wipe ephemeral noise buffers and simulated key fragments from WASM linear
 * memory after a classified session cycle ends.
 *
 * Uses `zeroize::Zeroize` which emits a compiler_fence(SeqCst) after the
 * zeroing loop — prevents LLVM from eliding the wipe as a dead-store
 * optimisation. In WASM, the erased bytes live in the linear memory heap;
 * while JS can still read WebAssembly.Memory, this ensures Rust's side of
 * any ephemeral key material is provably cleared before the function returns.
 *
 * The React frontend calls this via `mod.log_entropy_flush()` after the
 * decrypted payload has been delivered, logging the result to the system log.
 * @returns {string}
 */
export function log_entropy_flush() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.log_entropy_flush();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} seed_node
 * @param {number} temperature
 * @param {number} n_probes
 * @returns {string}
 */
export function run_associative_field(seed_node, temperature, n_probes) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_associative_field(seed_node, temperature, n_probes);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} unix_ms
 * @returns {string}
 */
export function run_astro(unix_ms) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_astro(unix_ms);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Community assembly simulation — power-law abundance distribution with
 * standard ecological diversity metrics and stochastic temporal drift.
 *
 * Parameters:
 *   n_species     : species richness (2–500)
 *   diversity_exp : Zipf rank-abundance exponent (0.1–3.0);
 *                   0.5 = near-even, 1.0 = natural community, 2.0 = dominated
 *   timesteps     : stochastic perturbation steps for temporal H drift (0–200)
 * @param {number} n_species
 * @param {number} diversity_exp
 * @param {number} timesteps
 * @returns {string}
 */
export function run_biocoenosis_simulation(n_species, diversity_exp, timesteps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_biocoenosis_simulation(n_species, diversity_exp, timesteps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_tensors
 * @param {number} n_cycles
 * @param {number} threshold
 * @returns {string}
 */
export function run_bone_fusion(n_tensors, n_cycles, threshold) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_bone_fusion(n_tensors, n_cycles, threshold);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_nodes
 * @param {number} edge_density
 * @param {number} bridge_strength
 * @param {number} samples
 * @param {number} threshold
 * @returns {string}
 */
export function run_bridge_kernel(n_nodes, edge_density, bridge_strength, samples, threshold) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_bridge_kernel(n_nodes, edge_density, bridge_strength, samples, threshold);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Simulates a simplified A-CEEI (Approximate Competitive Equilibrium from
 * Equal Incomes) preference-based allocation market.
 *
 * Based on Alvin Roth's Nobel-winning matching market theory.
 * Each agent gets equal budget; allocation maximises aggregate preference
 * satisfaction subject to market-clearing via Walrasian tâtonnement.
 *
 * Parameters:
 *   agents      number of allocation participants (2–50)
 *   goods       number of distinct goods/resources (2–20)
 *   inequality  budget spread / wealth inequality index (0–1; 0 = perfectly equal)
 *   diversity   preference diversity across agents (0–1; 1 = fully heterogeneous)
 * @param {number} agents
 * @param {number} goods
 * @param {number} inequality
 * @param {number} diversity
 * @returns {string}
 */
export function run_ceei_allocation_engine(agents, goods, inequality, diversity) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_ceei_allocation_engine(agents, goods, inequality, diversity);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run the Chrono-Actuary deep-time audit engine.
 *
 * temp_c:        baseline water temperature °C          (default 15.0)
 * do_conc:       current DO concentration mg/L          (default 8.5)
 * bod_load:      initial BOD at discharge point mg/L    (default 5.0)
 * delta_t:       project thermal discharge delta °C     (default 2.0)
 * epi:           Eutrophication Potential Index         (default 0.8)
 * nitrate:       Nitrate-N concentration mg/L           (default 2.0)
 * flow_ratio:    Q_project / Q_mean_annual              (default 0.4)
 * lsi:           Langelier Saturation Index             (default 0.1)
 * license_years: permit duration — IPCC projection horizon (default 30.0)
 * human_profit:  reported project profit EUR            (default 1_000_000.0)
 * @param {number} temp_c
 * @param {number} do_conc
 * @param {number} bod_load
 * @param {number} delta_t
 * @param {number} epi
 * @param {number} nitrate
 * @param {number} flow_ratio
 * @param {number} lsi
 * @param {number} license_years
 * @param {number} human_profit
 * @returns {string}
 */
export function run_chrono_actuary(temp_c, do_conc, bod_load, delta_t, epi, nitrate, flow_ratio, lsi, license_years, human_profit) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_chrono_actuary(temp_c, do_conc, bod_load, delta_t, epi, nitrate, flow_ratio, lsi, license_years, human_profit);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run a full ML-KEM-768 KEM round-trip and format as system kernel log.
 *
 * `reveal`:
 *   0 → decapsulation key (private) is redacted in output  [default]
 *   1 → private key is printed in full (WARNING display)
 *
 * The function always:
 *   1. Generates a fresh keypair via OS entropy
 *   2. Encapsulates a shared secret (simulates sender)
 *   3. Displays public key, ciphertext, and derived shared secret
 *   4. Conditionally displays the private decapsulation key
 * @param {number} reveal
 * @returns {string}
 */
export function run_classified(reveal) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_classified(reveal);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_topics
 * @param {number} n_docs
 * @param {number} vocab_size
 * @param {number} alpha
 * @param {number} iterations
 * @returns {string}
 */
export function run_corpus_synthesis(n_topics, n_docs, vocab_size, alpha, iterations) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_corpus_synthesis(n_topics, n_docs, vocab_size, alpha, iterations);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_agents
 * @param {number} temperature
 * @param {number} coupling
 * @param {number} steps
 * @returns {string}
 */
export function run_cynic_realist(n_agents, temperature, coupling, steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_cynic_realist(n_agents, temperature, coupling, steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run the soma_kernel_5.5 Daly Rules thermodynamic simulation.
 *
 * Integrates three coupled ODEs over `years` annual timesteps:
 *   1. Renewable resource stock  R(t)  — harvest vs regeneration
 *   2. Pollution accumulation    P(t)  — waste vs absorption
 *   3. Non-renewable reserves   NR(t)  — depletion vs substitution
 *
 * Entropy production follows irreversible thermodynamics (Prigogine):
 *   σ(t) = (C/G) · ln(C/G)   when C > G  (dissipation from overshoot)
 *
 * Parameters (all f64 for wasm-bindgen):
 *   consumption   GJ/capita/yr   (current global avg ~80; sustainable ~25–30)
 *   regeneration  GJ/capita/yr   (biosphere regen capacity ~30)
 *   waste         Mt CO₂eq/yr    (normalised; global ~55,000 Mt)
 *   absorption    Mt CO₂eq/yr    (natural sinks ~11,000 Mt)
 *   nr_depletion  fraction/yr    (fossil reserve draw-down rate; ~0.025)
 *   substitution  fraction/yr    (renewable substitution rate; ~0.008)
 *   years         simulation horizon (clamped 1–500)
 * @param {number} consumption
 * @param {number} regeneration
 * @param {number} waste
 * @param {number} absorption
 * @param {number} nr_depletion
 * @param {number} substitution
 * @param {number} years
 * @returns {string}
 */
export function run_daly_thermo_simulation(consumption, regeneration, waste, absorption, nr_depletion, substitution, years) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_daly_thermo_simulation(consumption, regeneration, waste, absorption, nr_depletion, substitution, years);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * DH-EC Cryptographic Architecture Kernel.
 *
 * mode:
 *   0 = full comparison (all sections)
 *   1 = Classical DH only
 *   2 = Curve25519 ECDH only
 *   3 = Signal X3DH only
 *   4 = Threema NaCl only
 *   5 = Comparison matrix only
 *
 * show_details:
 *   0 = compact (keys abbreviated to 16 hex chars)
 *   1 = verbose (full 32-byte hex keys + analysis notes)
 * @param {number} mode
 * @param {number} show_details
 * @returns {string}
 */
export function run_dh_ec_kernel(mode, show_details) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_dh_ec_kernel(mode, show_details);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_agents
 * @param {number} coupling
 * @param {number} decay
 * @param {number} noise
 * @param {number} steps
 * @returns {string}
 */
export function run_empathy_kernel(n_agents, coupling, decay, noise, steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_empathy_kernel(n_agents, coupling, decay, noise, steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} benefit
 * @param {number} cost
 * @param {number} punishment
 * @param {number} mutation
 * @param {number} generations
 * @returns {string}
 */
export function run_evolutionary_replicator(benefit, cost, punishment, mutation, generations) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_evolutionary_replicator(benefit, cost, punishment, mutation, generations);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} r_start
 * @param {number} r_end
 * @param {number} warmup
 * @param {number} samples
 * @returns {string}
 */
export function run_feigenbaum_cascade(r_start, r_end, warmup, samples) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_feigenbaum_cascade(r_start, r_end, warmup, samples);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Fish Scale Kernel — Feigenbaum-Bouligand Coupled Architecture v12.1.0
 *
 * Maps the universal period-doubling cascade onto Bouligand helicoidal armor.
 * Computes armor density, saponification windows, sanctuary nodes, and
 * Moir\u{00E9} interference spectrum across the full bifurcation topology.
 *
 * Parameters:
 *   r_pressure       : thermodynamic pressure coefficient (0.0–4.0)
 *   max_layers       : maximum Bouligand armor layers to resolve (1–64)
 *   theta_offset     : interlaminar rotation angle in degrees (1–90, default 36)
 *   burn_sensitivity : saponification window width multiplier (0.1–2.0)
 * @param {number} r_pressure
 * @param {number} max_layers
 * @param {number} theta_offset
 * @param {number} burn_sensitivity
 * @returns {string}
 */
export function run_fish_scale(r_pressure, max_layers, theta_offset, burn_sensitivity) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_fish_scale(r_pressure, max_layers, theta_offset, burn_sensitivity);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run the Fusion Plasma sovereign audit engine.
 *
 * temp_kev:       ion temperature in keV                  (default 10.0)
 * density:        electron density 10²⁰/m³                (default 1.0)
 * tau_e:          energy confinement time s                (default 3.7)
 * b_field:        toroidal magnetic field T                (default 5.3)
 * major_radius:   tokamak major radius R m                 (default 6.2)
 * minor_radius:   tokamak minor radius a m                 (default 2.0)
 * plasma_current: plasma current I_p MA                    (default 15.0)
 * input_power:    external heating power MW                (default 50.0)
 * elongation:     plasma elongation κ                      (default 1.7)
 * helium_fraction: He-4 ash fraction of total ion density  (default 0.05)
 * @param {number} temp_kev
 * @param {number} density
 * @param {number} tau_e
 * @param {number} b_field
 * @param {number} major_radius
 * @param {number} minor_radius
 * @param {number} plasma_current
 * @param {number} input_power
 * @param {number} elongation
 * @param {number} helium_fraction
 * @returns {string}
 */
export function run_fusion_plasma(temp_kev, density, tau_e, b_field, major_radius, minor_radius, plasma_current, input_power, elongation, helium_fraction) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_fusion_plasma(temp_kev, density, tau_e, b_field, major_radius, minor_radius, plasma_current, input_power, elongation, helium_fraction);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_glyphs
 * @param {number} zipf_exponent
 * @param {number} mandelbrot_offset
 * @param {number} entropy_target
 * @param {number} tiers
 * @returns {string}
 */
export function run_glyph_archive(n_glyphs, zipf_exponent, mandelbrot_offset, entropy_target, tiers) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_glyph_archive(n_glyphs, zipf_exponent, mandelbrot_offset, entropy_target, tiers);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_agents
 * @param {number} confidence_bound
 * @param {number} convergence_rate
 * @param {number} extremism_fraction
 * @param {number} dimensions
 * @returns {string}
 */
export function run_ideological_synthesis(n_agents, confidence_bound, convergence_rate, extremism_fraction, dimensions) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_ideological_synthesis(n_agents, confidence_bound, convergence_rate, extremism_fraction, dimensions);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} lattice_size
 * @param {number} temperature
 * @param {number} external_field
 * @param {number} mc_steps
 * @returns {string}
 */
export function run_ising_consensus(lattice_size, temperature, external_field, mc_steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_ising_consensus(lattice_size, temperature, external_field, mc_steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Models a 2-player repeated game with pre-commitment devices and mechanism design.
 *
 * coercion             threat/sanction capability index (0–10)
 * escape_cost          cost of breaking a binding commitment (0–10)
 * cooperation_bonus    payoff uplift when both cooperate (0–10)
 * defection_temptation extra payoff from unilateral defection (0–10)
 * time_horizon         number of repeated-game stages T (1–200)
 * @param {number} coercion
 * @param {number} escape_cost
 * @param {number} cooperation_bonus
 * @param {number} defection_temptation
 * @param {number} time_horizon
 * @returns {string}
 */
export function run_juridical_substrate(coercion, escape_cost, cooperation_bonus, defection_temptation, time_horizon) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_juridical_substrate(coercion, escape_cost, cooperation_bonus, defection_temptation, time_horizon);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_oscillators
 * @param {number} coupling
 * @param {number} freq_spread
 * @param {number} timesteps
 * @returns {string}
 */
export function run_kuramoto_synchrony(n_oscillators, coupling, freq_spread, timesteps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_kuramoto_synchrony(n_oscillators, coupling, freq_spread, timesteps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Latent Space Collider – SCALING Module v1.0.0
 *
 * Collides two conceptual domains in simulated 1536-dimensional latent space.
 * Computes cosine similarity, cross-attention, orthogonal projection, and
 * outputs a synthesized concept chimera.
 *
 * Parameters:
 *   domain_a      : global domain index (0–15 = Block I conceptual, 16–31 = Block II elemental)
 *   domain_b      : global domain index (0–15 = Block I conceptual, 16–31 = Block II elemental)
 *   attn_heads    : simulated attention head count (1–64, affects entropy)
 *   temperature   : softmax temperature – sharpness of conceptual focus (0.1–5.0)
 * @param {number} domain_a
 * @param {number} domain_b
 * @param {number} attn_heads
 * @param {number} temperature
 * @returns {string}
 */
export function run_latent_collider(domain_a, domain_b, attn_heads, temperature) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_latent_collider(domain_a, domain_b, attn_heads, temperature);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} unix_ms
 * @returns {string}
 */
export function run_lunar_phase(unix_ms) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_lunar_phase(unix_ms);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * SCALAR SOVEREIGNTY + MESANTROPY ENGINE
 *
 * Simulates N agents through Substrate (3.3.3) and Detonation (4.4.4.4) phases.
 *
 * Parameters:
 *   solar_yield  : available scalar energy as fraction of Eigenverbrauch ceiling (0.0–1.0)
 *                  0.0 = off-grid scarcity, 1.0 = 364 kWh full Sorbe sovereignty
 *   signal_depth : RSSI signal depth in dBm-relative units (-1.0 = deep, 0.0 = shallow)
 *                  reflects "Am Sender 13" signal quality; affects agent coupling strength
 *   n_agents     : number of agents in the simulation field (7–144)
 * @param {number} solar_yield
 * @param {number} signal_depth
 * @param {number} n_agents
 * @returns {string}
 */
export function run_mesantropy(solar_yield, signal_depth, n_agents) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_mesantropy(solar_yield, signal_depth, n_agents);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_samples
 * @param {number} separation
 * @param {number} noise_sigma
 * @param {number} passes
 * @param {number} threshold
 * @returns {string}
 */
export function run_metallurgy_kernel(n_samples, separation, noise_sigma, passes, threshold) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_metallurgy_kernel(n_samples, separation, noise_sigma, passes, threshold);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} mutation_rate
 * @param {number} selection
 * @param {number} seq_length
 * @param {number} steps
 * @param {number} sequences
 * @returns {string}
 */
export function run_mutation_kernel(mutation_rate, selection, seq_length, steps, sequences) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_mutation_kernel(mutation_rate, selection, seq_length, steps, sequences);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} grid_size
 * @param {number} branch_prob
 * @param {number} anastomosis
 * @param {number} nutrients
 * @param {number} steps
 * @returns {string}
 */
export function run_mycelium_kernel(grid_size, branch_prob, anastomosis, nutrients, steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_mycelium_kernel(grid_size, branch_prob, anastomosis, nutrients, steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Resonance trace simulation — sweeps N injection cycles through the Fish Scale
 * entropic stasis field, modulating BPM via sin(r×7)×11 with LCG noise drift.
 *
 * Parameters:
 *   resonance_seed : initial resonance value, wraps mod 2π (0.0–6.28)
 *   n_cycles       : resonance injection cycles to trace (1–64)
 *   amplitude      : BPM modulation amplitude multiplier (0.1–3.0)
 * @param {number} resonance_seed
 * @param {number} n_cycles
 * @param {number} amplitude
 * @returns {string}
 */
export function run_necromantic_simulation(resonance_seed, n_cycles, amplitude) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_necromantic_simulation(resonance_seed, n_cycles, amplitude);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} network_size
 * @param {number} deletion_rate
 * @param {number} cascade_threshold
 * @param {number} targeted_fraction
 * @param {number} steps
 * @returns {string}
 */
export function run_network_collapse(network_size, deletion_rate, cascade_threshold, targeted_fraction, steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_network_collapse(network_size, deletion_rate, cascade_threshold, targeted_fraction, steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run the Olfactory-Computational Kernel.
 *
 * Parameters:
 *   top         : top note intensity — flash signal strength (0.0–1.0)
 *   heart       : heart note intensity — persistent carrier (0.0–1.0)
 *   base        : base note intensity — deep-time archive (0.0–1.0)
 *   corruption  : animalic fixative level — managed corruption (0.0–1.0)
 *   temperature : ambient temperature — affects evaporation rates (0.0–1.0; 0.5 = 20°C)
 *   preset      : signal preset index (-1 = use manual params, 0–7 = preset)
 * @param {number} top
 * @param {number} heart
 * @param {number} base
 * @param {number} corruption
 * @param {number} temperature
 * @param {number} preset
 * @returns {string}
 */
export function run_ock(top, heart, base, corruption, temperature, preset) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_ock(top, heart, base, corruption, temperature, preset);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Panopticon Percolation Engine – SURVEILLANCE Module v1.0.0
 *
 * Monte Carlo simulation of dragnet contagion through 44 indexed
 * surveillance legislative instruments.
 *
 * Parameters:
 *   infection_prob : global infection probability multiplier (0.1–2.0)
 *   origin_node    : patient zero – starting legislative node (0–43)
 *   n_simulations  : Monte Carlo ensemble size (1–200)
 *   seed           : PRNG seed for reproducibility (any positive integer)
 * @param {number} infection_prob
 * @param {number} origin_node
 * @param {number} n_simulations
 * @param {number} seed
 * @returns {string}
 */
export function run_panopticon_percolation(infection_prob, origin_node, n_simulations, seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_panopticon_percolation(infection_prob, origin_node, n_simulations, seed);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_nodes
 * @param {number} mean_degree
 * @param {number} attack_mode
 * @param {number} removal_steps
 * @returns {string}
 */
export function run_percolation(n_nodes, mean_degree, attack_mode, removal_steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_percolation(n_nodes, mean_degree, attack_mode, removal_steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run the Phonemic Drift analysis.
 *
 * * `seed`        — PRNG seed (0 → uses internal default)
 * * `target`      — intended retrieval target: 0=Baudrillard 1=Bachelard 2=Abelard
 * * `drift_noise` — retrieval noise [0.0–1.0]; 0=clean semantic, 1=pure phonemic
 * @param {number} seed
 * @param {number} target
 * @param {number} drift_noise
 * @returns {string}
 */
export function run_phonemic_drift(seed, target, drift_noise) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_phonemic_drift(seed, target, drift_noise);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Leontief Input-Output Analysis with post-scarcity automation extension.
 *
 * automation_rate    base automation rate per sector per period (0–1)
 * redistribution     redistribution coefficient for UBI feasibility (0–1)
 * demand_growth      final demand growth rate per period (0–1)
 * n_sectors          number of economic sectors, clamped to 8
 * t_horizon          number of time periods to simulate (1–100)
 * @param {number} automation_rate
 * @param {number} redistribution
 * @param {number} demand_growth
 * @param {number} n_sectors
 * @param {number} t_horizon
 * @returns {string}
 */
export function run_post_capitalist(automation_rate, redistribution, demand_growth, n_sectors, t_horizon) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_post_capitalist(automation_rate, redistribution, demand_growth, n_sectors, t_horizon);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} input_bits
 * @param {number} hash_bits
 * @param {number} algorithm
 * @param {number} quantum_adv
 * @returns {string}
 */
export function run_pqhash_analysis(input_bits, hash_bits, algorithm, quantum_adv) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_pqhash_analysis(input_bits, hash_bits, algorithm, quantum_adv);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Dissipative Rust Kernel: Pragmatic<T> Type Demonstration
 *
 * Simulates N agents attempting computational tasks drawn from a power-law
 * cost distribution under a shared thermal budget. As budget depletes:
 *   Resolved → Synthetic → Dissolved
 *
 * Parameters:
 *   n_agents:       agents attempting resolution (4–128)
 *   thermal_budget: total energy available for all computations (10–10000)
 *   thermal_limit:  max cost for full-fidelity resolution (0.5–100)
 *   cost_exponent:  power-law exponent for task cost distribution (0.5–3.0)
 *                   lower = more extreme costs; higher = more uniform
 * @param {number} n_agents
 * @param {number} thermal_budget
 * @param {number} thermal_limit
 * @param {number} cost_exponent
 * @returns {string}
 */
export function run_pragmatic_type(n_agents, thermal_budget, thermal_limit, cost_exponent) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_pragmatic_type(n_agents, thermal_budget, thermal_limit, cost_exponent);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} signal_dim
 * @param {number} noise_level
 * @param {number} rank
 * @param {number} threshold_factor
 * @param {number} passes
 * @returns {string}
 */
export function run_purification_kernel(signal_dim, noise_level, rank, threshold_factor, passes) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_purification_kernel(signal_dim, noise_level, rank, threshold_factor, passes);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_agents
 * @param {number} threshold_mean
 * @param {number} threshold_sigma
 * @param {number} v_cache_bandwidth
 * @param {number} rounds
 * @returns {string}
 */
export function run_resistance_kernel(n_agents, threshold_mean, threshold_sigma, v_cache_bandwidth, rounds) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_resistance_kernel(n_agents, threshold_mean, threshold_sigma, v_cache_bandwidth, rounds);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} n_concepts
 * @param {number} coherence
 * @param {number} decoherence_rate
 * @param {number} entanglement
 * @param {number} steps
 * @returns {string}
 */
export function run_seraphine_sarg(n_concepts, coherence, decoherence_rate, entanglement, steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_seraphine_sarg(n_concepts, coherence, decoherence_rate, entanglement, steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} context_length
 * @param {number} window_ratio
 * @param {number} ks
 * @param {number} compression_passes
 * @param {number} noise_color
 * @returns {string}
 */
export function run_signal_legacy(context_length, window_ratio, ks, compression_passes, noise_color) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_signal_legacy(context_length, window_ratio, ks, compression_passes, noise_color);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Simulates Soma Plus — the social capital / commons-contribution system
 * at the heart of soma_kernel_5.5's post-scarcity status economy.
 *
 * Agents earn Soma Plus by contributing to the commons:
 *   Ecological Care  (reforesting, biodiversity monitoring)
 *   Social Care      (child-rearing, elderly care, education, arts)
 *   Each contribution accrues SP; SP decays slowly without contribution.
 *
 * Status tiers: INITIATE → CONTRIBUTOR → ARTISAN → SOVEREIGN
 *
 * Parameters:
 *   population    number of agents (10–10000)
 *   eco_share     fraction of agents doing ecological care (0–1)
 *   social_share  fraction of agents doing social care (0–1)
 *   arts_share    fraction of agents doing arts/culture (0–1)
 *   years         simulation cycles (1–200)
 * @param {number} population
 * @param {number} eco_share
 * @param {number} social_share
 * @param {number} arts_share
 * @param {number} years
 * @returns {string}
 */
export function run_soma_plus_engine(population, eco_share, social_share, arts_share, years) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_soma_plus_engine(population, eco_share, social_share, arts_share, years);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Seven-Fold Crystalline Invariance Kernel
 *
 * Simulates the 4-phase progression of the SCALE_SYSTEM_KERNEL v7.7.7.7.7.7.7.
 * N oscillators advance through Substrate → Detonation → Superfluid → Crystalline.
 *
 * Parameters:
 *   n_oscillators : number of coupled oscillators to simulate (7–77)
 *   coupling_gain : multiplicative scaling on all coupling constants (0.5–3.0)
 *                   < 1.0 weakens lock, > 1.0 accelerates crystallisation
 *   entropy_seed  : deterministic seed for phase initialisation (0–999)
 *                   0 = maximal disorder, large values = partial pre-ordering
 * @param {number} n_oscillators
 * @param {number} coupling_gain
 * @param {number} entropy_seed
 * @returns {string}
 */
export function run_sovereign_seven(n_oscillators, coupling_gain, entropy_seed) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_sovereign_seven(n_oscillators, coupling_gain, entropy_seed);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} threshold
 * @param {number} max_bridges
 * @param {number} detail
 * @returns {string}
 */
export function run_spectral_bridge(threshold, max_bridges, detail) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_spectral_bridge(threshold, max_bridges, detail);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run Stiller Divergence Analysis — Volatile Semiotic vs Fossil Record
 *
 * Translates the STILLER_DIVERGENCE kernel (v1.1.1) into a logistic-map simulation:
 *   AXIOM.00: Identity = broadcast, not cached fossil record
 *   AXIOM.01: Irreducible tension Δ persists — synthesis = "The Vitrified Wake"
 *   AXIOM.02: Combustion/Vaporization split — entropic grounding vs clean-room extraction
 *   AXIOM.03: Ecocide gate — growth > 3.9 (fully chaotic) → HOST_DEVOURED
 *   AXIOM.04: Bimmelbahn Accord — stream forward, macerate as annealing, maintain orthogonality
 *
 * Anchored to the Feigenbaum fade: the fossil base x* = (r−1)/r is the fixed point
 * the identity signal either transcends (sovereign) or collapses back into (fossil gravity).
 *
 * Parameters:
 *   r  — growth mandate [0.0, 4.0]; r_∞ = 3.5699 is the Feigenbaum chaos onset
 *   x0 — initial signal broadcast [0.01, 0.99]
 *   n  — iteration depth [100, 2000]
 * @param {number} r
 * @param {number} x0
 * @param {number} n
 * @returns {string}
 */
export function run_stiller_divergence(r, x0, n) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_stiller_divergence(r, x0, n);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Simulates the Strangler Fig transition strategy — building the new economic
 * system around the old one until the new system dominates.
 *
 * Uses a modified logistic growth ODE with legacy system resistance:
 *   dA/dt = r·A·(1-A) - ρ(t)·A·(1-A)
 *         = A·(1-A)·(r - ρ(t))
 *
 * where ρ(t) = ρ₀·exp(-λ·t)  — resistance decays as legacy system weakens.
 *
 * Tipping point: when r > ρ(t), growth flips from negative to positive.
 * Critical mass:  A ≥ 0.5 (new system is majority)
 *
 * Parameters:
 *   initial_adoption  starting adoption fraction (0.001–0.5)
 *   growth_rate       logistic growth coefficient r (0.01–2.0)
 *   resistance        initial legacy resistance ρ₀ (0–2.0)
 *   years             simulation horizon (1–200)
 * @param {number} initial_adoption
 * @param {number} growth_rate
 * @param {number} resistance
 * @param {number} years
 * @returns {string}
 */
export function run_strangler_fig_transition(initial_adoption, growth_rate, resistance, years) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_strangler_fig_transition(initial_adoption, growth_rate, resistance, years);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * @param {number} region_code
 * @param {number} category_code
 * @param {number} threshold
 * @returns {string}
 */
export function run_surveillance_index(region_code, category_code, threshold) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_surveillance_index(region_code, category_code, threshold);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Run the Tesseract-Vault 5-stage hybrid PQC pipeline.
 *
 * `verbose`:
 *   0 → truncated key material (first 8 bytes shown)  [default]
 *   1 → full 32-byte hex for master_key, shared_secret, and BLAKE3 hash
 * @param {number} verbose
 * @returns {string}
 */
export function run_tesseract_vault(verbose) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_tesseract_vault(verbose);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Map free-form text to the 16D kernel fingerprint space.
 * Returns terminal output + DATA: JSON for the ArtTab probe node.
 * @param {string} text
 * @returns {string}
 */
export function run_text_probe(text) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.run_text_probe(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {number} discovery_rate
 * @param {number} exploit_rate
 * @param {number} patch_rate
 * @param {number} network_size
 * @param {number} steps
 * @returns {string}
 */
export function run_zero_day(discovery_rate, exploit_rate, patch_rate, network_size, steps) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.run_zero_day(discovery_rate, exploit_rate, patch_rate, network_size, steps);
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Encrypt arbitrary bytes with Argon2id KDF + AES-256-GCM + BLAKE3 seal.
 * Returns the TV1. binary envelope, or empty Vec on error.
 * @param {Uint8Array} plaintext
 * @param {string} passphrase
 * @returns {Uint8Array}
 */
export function seal_markdown(plaintext, passphrase) {
    const ptr0 = passArray8ToWasm0(plaintext, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.seal_markdown(ptr0, len0, ptr1, len1);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * Returns the SOMA-9.1 Gaia Build boot banner for the terminal kernel log.
 * No parameters. Static diagnostic — call on first CLI load to confirm
 * system readiness and log the kernel version to the SYSTEM LOG.
 * @returns {string}
 */
export function soma_91_banner() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.soma_91_banner();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Autocomplete hint: single [verbose:0|1] parameter
 * @returns {Array<any>}
 */
export function tesseract_vault_params() {
    const ret = wasm.tesseract_vault_params();
    return ret;
}

/**
 * Decrypt a TV1. envelope. Returns plaintext bytes, or empty Vec on any
 * failure (wrong passphrase, tampered ciphertext, invalid envelope).
 * @param {Uint8Array} sealed
 * @param {string} passphrase
 * @returns {Uint8Array}
 */
export function unseal_markdown(sealed, passphrase) {
    const ptr0 = passArray8ToWasm0(sealed, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(passphrase, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.unseal_markdown(ptr0, len0, ptr1, len1);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_is_function_3c846841762788c1: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_781bc9f159099513: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_7ef6b97b02428fae: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_52709e72fb9f179c: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_2d781c1f4d5c0ef8: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_crypto_38df2bab126b63dc: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_getRandomValues_c44a50d8cfdaebeb: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_length_ea16607d7b61445b: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_msCrypto_bd5a034af96bcba6: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_new_with_length_825018a1616e9e55: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_node_84ea875411254db1: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_of_8bf7ed3eca00ea43: function(arg0) {
            const ret = Array.of(arg0);
            return ret;
        },
        __wbg_of_8fd5dd402bc67165: function(arg0, arg1, arg2) {
            const ret = Array.of(arg0, arg1, arg2);
            return ret;
        },
        __wbg_process_44c7a14e11e9f69e: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_d62e5099504357e6: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_randomFillSync_6c25eac9869eb53c: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_require_b4edbdcf3e2a1ef0: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_static_accessor_GLOBAL_8adb955bd33fac2f: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_ad356e0db91c7913: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_f207c857566db248: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_bb9f1ba69d61b386: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_subarray_a068d24e39478a8a: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_versions_276b2795b1c6a219: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./scale94_kernels_bg.js": import0,
    };
}

const BiocoenosisKernelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_biocoenosiskernel_free(ptr >>> 0, 1));
const CleanRoomFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_cleanroom_free(ptr >>> 0, 1));
const GrayScottKernelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_grayscottkernel_free(ptr >>> 0, 1));
const NecromanticEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_necromanticengine_free(ptr >>> 0, 1));
const SomaKernelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_somakernel_free(ptr >>> 0, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('scale94_kernels_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
