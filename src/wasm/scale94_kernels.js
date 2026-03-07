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
