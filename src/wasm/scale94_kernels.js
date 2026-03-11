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
 * coupling: dimensionless boson-boson coupling constant (0–1 typical)
 * thermal:  reduced thermal parameter kT/J (0–1 typical)
 * Returns a diagnostic string for the system kernel log.
 * @param {number} coupling
 * @param {number} thermal
 * @returns {string}
 */
export function boot_bosonic_lattice(coupling, thermal) {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.boot_bosonic_lattice(coupling, thermal);
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

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
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
const NecromanticEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_necromanticengine_free(ptr >>> 0, 1));
const SomaKernelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_somakernel_free(ptr >>> 0, 1));

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
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

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
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
