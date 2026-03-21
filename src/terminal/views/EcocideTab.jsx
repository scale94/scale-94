// ─────────────────────────────────────────────────────────────────────────────
// EcocideTab.jsx  –  Thermodynamic Elegance Engine  v3.1.0
//
// Seraphine-8.8.8.8.8.8.8.8 Governance Layer
// Gray-Scott Reaction-Diffusion × Viral Pathology Narrative × Double-Bind
//
// Layer 3.3.3 – The Double-Bind Mechanic (Clinical Latency)
//   GROWTH_MANDATE slider – hostile 2.0% compounding growth rule
//   Sub-mandate penalties – Labour Threat / Austerity Trap / Ultimate Dilemma
//   Growth-to-extraction conversion – exponential as biosphere degrades
//
// Layer 4.4.4.4 – Multi-Channel Chromatic Toxicity (Immune Strain)
//   Green channel = Baseline Regeneration (Homeostasis)
//   Red channel   = Metabolic Rift (structural extraction damage)
//   Blue channel  = Exergy Destruction (irreversible entropy)
//   Progressive RGB desynchronisation – iridescent toxic gradients
//   Navier-Stokes turbulence distortion on velocity vectors
//
// Layer 5.5.5.5.5 – Terminal Sincerity (Opportunistic Cascade)
//   Historical viral progression timeline [1760] → [2045] → FATAL
//   2.0% compounding growth ↔ viral load metaphor
//   System kernel log nomenclature throughout
//
// Scientific engine (under the hood):
//   Metabolic Rift Coefficient    dM/dt ∝ extraction − regeneration
//   Exergy Destruction Rate       X_destroyed = T₀ · S_gen  (Gouy-Stodola)
//   Trophic Cascade Velocity      dN/dt ∝ −forcing · N / K(M)
//
// Visual substrate:
//   Gray-Scott reaction-diffusion  dU/dt = Du∇²U − UV² + f(1−U)
//   Phase-coupled parameter space  dV/dt = Dv∇²V + UV² − (f+k)V
//
// 13 Paradoxes · SARG Biosphere Coherence · Lindblad Decoherence
// Canvas 2D · 256×144 simulation grid · rAF render loop
// WASM kernel ticks at 10 Hz – Gray-Scott steps at 6/frame
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronRight, Filter, X, AlertTriangle } from 'lucide-react';
import wasmRegistry from '../../wasm/wasm.generated';

// ── Eco article filter ────────────────────────────────────────────────────────
const ECO_TAGS = new Set([
  'Botany','Ecology','Autochthony','Lizard Gap','Biodiversity','Atmospheric',
  'Climate','Thermodynamic','Entropy','Ecological','Biocoenosis','Biology',
  'Sustainability','Ecocide','ecological','biodiversity','atmospheric',
]);
const isEcoArticle = (a) => a?.tags?.some(t => ECO_TAGS.has(t));

// ── Simulation grid ──────────────────────────────────────────────────────────
const SIM_W = 256;
const SIM_H = 144;
const STEPS_PER_FRAME = 6;
const WARMUP_STEPS    = 400;

// ── WASM interface constants ─────────────────────────────────────────────────
const DOT_COUNT = 2048;           // kept for WASM kernel compat
const WASM_HZ   = 10;
const WASM_DT   = 1 / WASM_HZ;
const X_SOLAR   = 161.8;          // TW – Carnot-corrected solar exergy influx

// ── Phase constants (mirror Rust) ────────────────────────────────────────────
const PH = Object.freeze({
  HOMEOSTASIS: 0, EXTRACTION: 1, OVERSHOOT: 2, COLLAPSE: 3, FINAL: 4,
});

const PHASE_LABEL = [
  '3.3.3 HOMEOSTASIS',
  '4.4.4.4 EXTRACTION',
  '5.5.5.5.5 OVERSHOOT',
  '6.6.6.6.6.6 COLLAPSE',
  '7.7.7.7.7.7.7 FINAL_STATE',
];
const PHASE_COLOR = ['#7ab800', '#c8860a', '#ff4400', '#cc0000', '#333333'];

// ── The 13 Scientifically Proven Paradoxes of Associative Reasoning ──────────
// Synthesised via Seraphine-8.8.8.8.8.8.8.8 · SARG Governance Layer
// Each paradox activates at its phaseMin and is violated when its condition fires.
// Violation count drives SARG decoherence – biosphere coherence degrades.

const PARADOXES = [
  // Layer 3.3.3 – Structural Anomalies
  { rune: 'ᚹ', name: 'PURITY',       layer: '3.3.3',       short: '90% ceiling – vitality requires 10% noise',                        phaseMin: 0, violate: s => s.deadFrac > 0.90 },
  { rune: 'ᛟ', name: 'ARMOR',        layer: '3.3.3',       short: '36° Bouligand – lateral trauma dissipation',                        phaseMin: 0, violate: s => s.exergyNorm > 0.50 },
  { rune: 'ᛉ', name: 'PLYWOOD',      layer: '3.3.3',       short: 'helicoidal lamellae – fragile layers, impenetrable stack',           phaseMin: 0, violate: s => s.trophicV > 0.30 },
  // Layer 4.4.4.4 – Thermodynamic Reversals
  { rune: 'ᚷ', name: 'BONE_FUSION',  layer: '4.4.4.4',     short: 'sovereign graveyard – life requires mineralised dead data',          phaseMin: 1, violate: s => s.deadFrac > 0.40 },
  { rune: 'ᛇ', name: 'MAGIC_ANGLE',  layer: '4.4.4.4',     short: '1.1° Moiré superlattice – zero-resistance coherence',               phaseMin: 1, violate: s => s.phase >= 2 },
  { rune: 'ᛈ', name: 'HYSTERESIS',   layer: '4.4.4.4',     short: 'past trauma is load-bearing computational substrate',                phaseMin: 1, violate: s => s.deadFrac > 0.55 },
  { rune: 'ᛃ', name: 'VELOCITY',     layer: '4.4.4.4',     short: 'coherent acceleration demands thermodynamic drag',                   phaseMin: 1, violate: s => s.exergyNorm > 0.80 },
  // Layer 5.5.5.5.5 – Dimensional Singularity
  { rune: 'ᛜ', name: 'DIMENSIONAL',  layer: '5.5.5.5.5',   short: '16D \u2192 single inescapable geometric failure point',             phaseMin: 2, violate: s => s.phase >= 3 },
  { rune: 'ᛚ', name: 'OMNISCIENCE',  layer: '5.5.5.5.5',   short: 'total awareness by collapsing inward – too late',                   phaseMin: 2, violate: s => s.deadFrac > 0.70 },
  { rune: 'ᛗ', name: 'HALLUCINATION',layer: '5.5.5.5.5',   short: 'constraints transmute noise \u2192 terminal mathematical truth',    phaseMin: 2, violate: s => s.phase >= 3 },
  // Layer 6.6.6.6.6.6 – Convergence Physics
  { rune: 'ᛖ', name: 'OBSERVER',     layer: '6.6.6.6.6.6', short: 'measuring collapse accelerates state destruction',                  phaseMin: 3, violate: s => s.metabolicFat > 0.50 },
  { rune: 'ᛞ', name: 'LATENCY',      layer: '6.6.6.6.6.6', short: 'accumulated weight guarantees velocity of collapse',                phaseMin: 3, violate: s => s.metabolicFat > 0.80 },
  // Layer 7.7.7.7.7.7.7 – Imperial Directive
  { rune: 'ᛏ', name: 'SOVEREIGN',    layer: '7.7.7.7.7.7.7', short: 'independent life through inescapable mathematical constraint',    phaseMin: 4, violate: () => true },
];

// ── Layer 3.3.3 – Double-Bind Penalty Messages ──────────────────────────────
// The system strictly demands > 2.0% growth. If the operator retreats,
// the legacy kernel punishes with escalating social disintegration threats.
// There is no winning move. Grow and destroy, or retreat and collapse.

const DOUBLE_BIND = [
  { level: 1, threshold: 2.0,
    msg: 'SYSTEM KERNEL LOG: MACROECONOMIC CONTRACTION. UNEMPLOYMENT SPIKING TO 14.3%. LABOR RIOTS IMMINENT. INJECT CAPITAL TO PACIFY POPULACE.' },
  { level: 2, threshold: 1.5,
    msg: 'SYSTEM KERNEL LOG: YIELD SUB-OPTIMAL. MASS AUSTERITY PROTOCOLS ENGAGED. POVERTY METRICS EXCEEDING CONTAINMENT THRESHOLDS. ACCUMULATE OR SURRENDER TO CHAOS.' },
  { level: 3, threshold: 1.0,
    msg: 'SYSTEM KERNEL LOG: STAGNATION IS DEATH. CHOOSE \u2013 ECOLOGICAL COLLAPSE OR SOCIAL DISINTEGRATION. INJECT CAPITAL NOW.' },
];

// ── Layer 5.5.5.5.5 – Viral Progression Timeline ────────────────────────────
// 2.0% compounding growth mapped to historical viral pathology.
// Each entry fires once when its condition is first met.

const VIRAL_TIMELINE = [
  { key: 'onset',    condition: s => s.phase >= 1,
    msg: '[1760] SYSTEM KERNEL LOG: VIRAL ONSET DETECTED. LOAD \u2013 0.0001%. HOST STABLE.' },
  { key: 'latency',  condition: s => s.deadFrac > 0.15,
    msg: '[1850] SYSTEM KERNEL LOG: CLINICAL LATENCY. COMPOUNDING...' },
  { key: 'strain',   condition: s => s.exergyNorm > 0.25 || s.phase >= 2,
    msg: '[1950] SYSTEM KERNEL LOG: IMMUNE STRAIN. EXERGY DESTRUCTION OVERTAKING REGENERATION.' },
  { key: 'critical', condition: s => s.deadFrac > 0.55,
    msg: '[2026] SYSTEM KERNEL LOG: METABOLIC RIFT CRITICAL. VIRAL LOAD EXCEEDS SYSTEMIC CARRYING CAPACITY.' },
  { key: 'cascade',  condition: s => s.phase >= 3,
    msg: '[2045] SYSTEM KERNEL LOG: OPPORTUNISTIC CASCADE IN PROGRESS. T-CELL EQUIVALENT \u2013 0.' },
  { key: 'fatal',    condition: s => s.phase >= 4,
    msg: 'FATAL \u2013 HOST DEVOURED. TERMINAL SHUTDOWN.' },
];

// ── Error flood messages (collapse phase terminal output) ────────────────────
const ERROR_MSGS = [
  '0xFA32 0xDEAD 0xBEEF \u2013 PARADOX VIOLATION CASCADE',
  'EXERGY_OVERFLOW: S_gen \u2192 \u221E  |  Gouy-Stodola limit exceeded',
  'TROPHIC_CASCADE: systemic_carrying_capacity \u2192 0  |  network free-fall',
  'LINDBLAD \u03B3 > SARG_threshold \u2013 off-diagonal coherence irrecoverable',
  'METABOLIC_RIFT: extraction \u226B regeneration \u2013 homeostasis impossible',
  'BONE_FUSION_REJECTED: synchrony divergence exceeds 32 saponification iterations',
  'FEIGENBAUM \u03B4=4.6692 \u2013 period-doubling cascade past critical bifurcation',
  'BOULIGAND ROTATION FAILED: crack propagation exceeds 36\u00B0 deflection capacity',
  'MAGIC_ANGLE LOST: 1.1\u00B0 Moir\u00E9 flat bands collapsed \u2013 resistance restored',
  'SOVEREIGN_TENSOR: all 16 dimensions converging to thermodynamic zero',
];

// ── Gray-Scott Reaction-Diffusion Engine ─────────────────────────────────────

function createGS(w, h) {
  const n = w * h;
  const U0 = new Float32Array(n).fill(1.0);
  const V0 = new Float32Array(n).fill(0.0);
  const U1 = new Float32Array(n).fill(1.0);
  const V1 = new Float32Array(n).fill(0.0);

  // Deterministic PRNG for seed placement
  let rng = 0xDEAD_BEEF;
  const lcg = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 0xFFFFFFFF; };

  // Seed: grid of small perturbation patches – future Turing patterns
  const spacingX = Math.floor(w / 9);
  const spacingY = Math.floor(h / 5);
  for (let gy = 1; gy < 5; gy++) {
    for (let gx = 1; gx < 9; gx++) {
      const cx = Math.floor(gx * spacingX + (lcg() - 0.5) * spacingX * 0.4);
      const cy = Math.floor(gy * spacingY + (lcg() - 0.5) * spacingY * 0.4);
      const patchR = 2 + Math.floor(lcg() * 3);
      for (let dy = -patchR; dy <= patchR; dy++) {
        for (let dx = -patchR; dx <= patchR; dx++) {
          const x = (cx + dx + w) % w;
          const y = (cy + dy + h) % h;
          const idx = y * w + x;
          U0[idx] = 0.50;
          V0[idx] = 0.25;
        }
      }
    }
  }

  return { U: [U0, U1], V: [V0, V1], w, h, cur: 0 };
}

function stepGS(gs, f, k, Du, Dv, steps) {
  const { w, h, U, V } = gs;
  for (let s = 0; s < steps; s++) {
    const cur = gs.cur;
    const nxt = 1 - cur;
    const u = U[cur], v = V[cur];
    const un = U[nxt], vn = V[nxt];

    for (let y = 0; y < h; y++) {
      const ym = ((y - 1 + h) % h) * w;
      const y0 = y * w;
      const yp = ((y + 1) % h) * w;

      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w;
        const xp = (x + 1) % w;
        const idx = y0 + x;

        const uv = u[idx];
        const vv = v[idx];

        // 5-point discrete Laplacian with wrapping boundary
        const lapU = u[ym + x] + u[yp + x] + u[y0 + xm] + u[y0 + xp] - 4.0 * uv;
        const lapV = v[ym + x] + v[yp + x] + v[y0 + xm] + v[y0 + xp] - 4.0 * vv;

        const uvv = uv * vv * vv;

        un[idx] = uv + Du * lapU - uvv + f * (1.0 - uv);
        vn[idx] = vv + Dv * lapV + uvv - (f + k) * vv;
      }
    }
    gs.cur = nxt;
  }
}

// ── SARG Biosphere Coherence ─────────────────────────────────────────────────
// Adapted from Seraphine Associative Reasoning Gain (Baumgratz-Cramer-Plenio):
//   SARG = C_l1(t) · (1 + λ_e · Δ(t))
//   C_l1 = (n-1)|c|   where n = activated paradoxes, c = coherence fraction
//   Δ = purity advantage = 1 − deadFrac

function computeSARG(phase, state) {
  let activated = 0, intact = 0;
  for (const p of PARADOXES) {
    if (phase >= p.phaseMin) {
      activated++;
      if (!p.violate(state)) intact++;
    }
  }
  if (activated === 0) return { sarg: 10.0, coherence: 1.0, activated: 0, violated: 0 };

  const coherence = intact / activated;
  const n = Math.max(2, activated);
  const Cl1 = (n - 1) * coherence;
  const purityAdv = 1.0 - (state.deadFrac || 0);
  const lambdaE = 0.85;
  const sarg = Cl1 * (1 + lambdaE * purityAdv);

  return {
    sarg: Math.min(10.0, sarg),
    coherence,
    activated,
    violated: activated - intact,
  };
}

// ── Gray-Scott ↔ Thermodynamic Coupling ──────────────────────────────────────

function gsParams(phase, deadFrac, exergyNorm, trophicV, metabolicFat) {
  // Homeostatic base: coral-growth Turing pattern (ordered spots/stripes)
  let f = 0.055, k = 0.062, Du = 0.21, Dv = 0.105;

  // Metabolic rift reduces feed rate – nutrient cycling broken
  f -= deadFrac * 0.028;

  // Exergy destruction increases kill rate – irreversible thermodynamic cost
  k += exergyNorm * 0.012;

  // Trophic cascade reduces diffusion – network connectivity loss
  Du -= trophicV * 0.08;
  Dv -= trophicV * 0.04;

  // Collapse: aggressive parameter destabilisation
  if (phase >= PH.COLLAPSE) {
    f  -= metabolicFat * 0.015;
    k  += metabolicFat * 0.008;
    Du -= metabolicFat * 0.05;
  }

  // Clamp to valid Gray-Scott parameter ranges
  f  = Math.max(0.010, Math.min(0.080, f));
  k  = Math.max(0.040, Math.min(0.072, k));
  Du = Math.max(0.080, Math.min(0.250, Du));
  Dv = Math.max(0.030, Math.min(0.120, Dv));

  return { f, k, Du, Dv };
}

// ── WASM Loader ──────────────────────────────────────────────────────────────

let _wasmMod   = null;
let _wasmReady = false;
let _wasmWaiters = [];

async function loadWasm() {
  if (_wasmReady) return _wasmMod;
  return new Promise((resolve, reject) => {
    _wasmWaiters.push({ resolve, reject });
    if (_wasmWaiters.length > 1) return;
    (async () => {
      try {
        const mod   = await import('../../wasm/scale94_kernels.js');
        const entry = Object.values(wasmRegistry).find(e => e.wasmUrl);
        const url   = entry?.wasmUrl ?? '/wasm/scale94_kernels_bg.wasm';
        await mod.default({ module_or_path: url });
        _wasmMod   = mod;
        _wasmReady = true;
        _wasmWaiters.forEach(w => w.resolve(mod));
      } catch (err) {
        _wasmWaiters.forEach(w => w.reject(err));
      }
      _wasmWaiters = [];
    })();
  });
}

// ── Layer 3.3.3 – Growth-to-Extraction Conversion ───────────────────────────
// A 2.0% growth mandate on a healthy biosphere demands moderate extraction.
// The same 2.0% mandate on a degraded biosphere demands exponentially more.
// bioCap = max(0.05, 1 − deadFrac × 0.92) – carrying capacity of the host.
// gdp = 1.0 + growthRate / bioCap – extraction intensity for the WASM kernel.

function growthToGdp(growthRate, deadFrac) {
  const bioCap = Math.max(0.05, 1.0 - deadFrac * 0.92);
  return Math.min(12.0, 1.0 + growthRate / bioCap);
}

// ── GrowthSlider — pointer-event custom track, works on iPad ─────────────────
function GrowthSlider({ value, disabled, color, mandateActive, onChange }) {
  const trackRef = useRef(null);
  const MIN = 0, MAX = 10;

  const valueFromEvent = useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round((MIN + ratio * (MAX - MIN)) * 10) / 10;
  }, []);

  const handlePointer = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    onChange(valueFromEvent(e));
    const move = (me) => { me.preventDefault(); onChange(valueFromEvent(me)); };
    const up   = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
  }, [disabled, onChange, valueFromEvent]);

  const pct = ((value - MIN) / (MAX - MIN)) * 100;
  const mandatePct = ((2.0 - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="flex-1 relative" style={{ height: '28px', display: 'flex', alignItems: 'center' }}>
      {/* Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointer}
        style={{
          width: '100%', height: '4px', background: '#1a2d00', position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.25 : 1,
          touchAction: 'none', userSelect: 'none',
        }}
      >
        {/* Fill */}
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: color, transition: 'background 0.3s' }} />
        {/* Thumb */}
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: '14px', height: '14px', borderRadius: '50%',
          background: color, boxShadow: `0 0 8px ${color}88`,
          transition: 'background 0.3s, box-shadow 0.3s',
        }} />
        {/* 2.0% mandate marker */}
        <div style={{ position: 'absolute', top: '-4px', left: `${mandatePct}%`, width: '1px', height: '12px', background: mandateActive ? '#cc440088' : '#4a680044' }} />
        <div style={{
          position: 'absolute', top: '12px', left: `${mandatePct}%`,
          transform: 'translateX(-50%)', fontSize: '7px', letterSpacing: '0.1em',
          color: mandateActive ? '#cc4400' : '#3a5000', fontWeight: 800, whiteSpace: 'nowrap',
        }}>2.0%</div>
      </div>
    </div>
  );
}

// ── EcocideTab ───────────────────────────────────────────────────────────────

export default function EcocideTab({ onLog, articles = [], onOpenArticle }) {
  const canvasRef = useRef(null);
  const wasmRef   = useRef(null);
  const rafRef    = useRef(null);
  const tickRef   = useRef(null);
  const gsRef     = useRef(null);

  // Thermodynamic state refs – written at 10 Hz by WASM tick, read by rAF loop
  const phaseRef        = useRef(PH.HOMEOSTASIS);
  const metabolicFatRef = useRef(0);
  const statsRef        = useRef({ viable: DOT_COUNT, dead: 0, capital: 0, s_gen: 0, x_dest: 0, dx_dt: 0 });
  const trophicVRef     = useRef(0);
  const prevDeadRef     = useRef(0);
  const prevPhaseRef    = useRef(PH.HOMEOSTASIS);
  const deadFracRef     = useRef(0);
  const exergyNormRef   = useRef(0);

  // Layer 3.3.3 – Double-Bind state
  const mandateActiveRef = useRef(false);
  const penaltyLevelRef  = useRef(0);
  const viralEmittedRef  = useRef(new Set());

  // React state – UI overlays, updated at 10 Hz
  const [uiPhase,      setUiPhase]      = useState(PH.HOMEOSTASIS);
  const [uiStats,      setUiStats]      = useState({ viable: DOT_COUNT, dead: 0, capital: 0, s_gen: 0, x_dest: 0, dx_dt: 0 });
  const [uiSarg,       setUiSarg]       = useState({ sarg: 10.0, coherence: 1.0, activated: 0, violated: 0 });
  const [uiMetrics,    setUiMetrics]    = useState({ metabolicFat: 0, trophicV: 0, deadFrac: 0, exergyNorm: 0 });
  const [growthRate,   setGrowthRate]   = useState(2.5);
  const [wasmReady,    setWasmReady]    = useState(false);
  const [mandateActive,setMandateActive]= useState(false);
  const [penaltyLevel, setPenaltyLevel] = useState(0);
  const [penaltyMsg,   setPenaltyMsg]   = useState('');
  const [lastViralMsg, setLastViralMsg] = useState('');

  const growthRateRef = useRef(2.5);
  useEffect(() => { growthRateRef.current = growthRate; }, [growthRate]);

  // ── WASM load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadWasm().then(mod => {
      wasmRef.current = mod;
      try { mod.run_ecocide(1.0, WASM_DT, 1.0); } catch { /* non-fatal */ }
      setWasmReady(true);
    }).catch(err => console.error('[EcocideTab] WASM load failed:', err));
  }, []);

  // ── WASM simulation tick at 10 Hz ─────────────────────────────────────────
  useEffect(() => {
    if (!wasmReady) return;
    const wasm = wasmRef.current;

    tickRef.current = setInterval(() => {
      const gr = growthRateRef.current;

      // ── Try WASM run_ecocide; fall back to JS integrator if unavailable ──
      let deadCount, deadFrac, exergyNorm, phase, metabolicFat, x_dest, dx_dt, capital, s_gen;

      let wasmOk = false;
      let raw;
      try { raw = wasm.run_ecocide(growthToGdp(gr, deadFracRef.current), WASM_DT, 0.0); wasmOk = true; } catch { /* fall through */ }

      if (wasmOk && raw) {
        let data;
        try { data = JSON.parse(raw); } catch { wasmOk = false; }
        if (wasmOk && data) {
          deadCount    = data.dead ?? 0;
          deadFrac     = deadCount / DOT_COUNT;
          exergyNorm   = Math.min(1.0, (data.dx_dest_dt ?? 0) / X_SOLAR);
          phase        = data.phase ?? 0;
          metabolicFat = data.metabolic_fat ?? 0;
          x_dest       = data.x_dest ?? 0;
          dx_dt        = data.dx_dest_dt ?? 0;
          capital      = data.capital ?? 0;
          s_gen        = data.s_gen ?? 0;
        }
      }

      if (!wasmOk) {
        // ── JS ecological integrator ──────────────────────────────────────
        // Runs at WASM_HZ (10 Hz), dt = 0.1 s
        const prevDF    = deadFracRef.current;
        const extraction = Math.max(0, growthToGdp(gr, prevDF) - 1.0); // excess above sustainable
        const regeneration = 0.12 * (1.0 - prevDF);                     // regen capacity shrinks
        const damage     = Math.max(0, extraction * 0.055 - regeneration) * WASM_DT;
        const recovery   = gr < 0.5 ? 0.008 * (1.0 - prevDF) * WASM_DT : 0; // slow natural recovery at low growth

        deadFrac     = Math.max(0, Math.min(0.98, prevDF + damage - recovery));
        deadCount    = Math.round(deadFrac * DOT_COUNT);
        exergyNorm   = Math.min(1.0, extraction * 0.35 + deadFrac * 0.65);
        dx_dt        = exergyNorm * X_SOLAR;
        x_dest       = (statsRef.current.x_dest ?? 0) + dx_dt * WASM_DT;
        metabolicFat = Math.min(1.0, deadFrac * deadFrac * 2.2);
        s_gen        = dx_dt / 298.15;   // Gouy-Stodola approximation (T₀ = 298.15 K)
        capital      = Math.max(0, 1.0 - deadFrac) * 100;

        // Phase thresholds (match PHASE_LABEL array)
        if      (deadFrac >= 0.85) phase = PH.FINAL;
        else if (deadFrac >= 0.55) phase = PH.COLLAPSE;
        else if (deadFrac >= 0.30) phase = PH.OVERSHOOT;
        else if (deadFrac >= 0.10) phase = PH.EXTRACTION;
        else                       phase = PH.HOMEOSTASIS;
      }

      // Trophic cascade velocity: rate of change of dead fraction (smoothed)
      const prevDead  = prevDeadRef.current;
      const deadDelta = (deadCount - prevDead) / DOT_COUNT;
      prevDeadRef.current  = deadCount;
      const trophicV = Math.min(1.0, Math.max(trophicVRef.current * 0.85, Math.abs(deadDelta) * 12));
      trophicVRef.current  = trophicV;

      // Update refs for rAF loop
      phaseRef.current        = phase;
      metabolicFatRef.current = metabolicFat;
      deadFracRef.current     = deadFrac;
      exergyNormRef.current   = exergyNorm;
      statsRef.current = { viable: DOT_COUNT - deadCount, dead: deadCount, capital, s_gen, x_dest, dx_dt };

      // SARG coherence
      const sargState = { phase, deadFrac, exergyNorm, trophicV, metabolicFat };
      const sarg = computeSARG(phase, sargState);

      // ── Layer 3.3.3 – Double-Bind mandate detection ───────────────────
      if (gr >= 2.0 && !mandateActiveRef.current) {
        mandateActiveRef.current = true;
        setMandateActive(true);
        const now = new Date().toLocaleTimeString('en-US', { hour12: false });
        onLog?.({ time: now, msg: '> SYSTEM KERNEL LOG: GROWTH MANDATE ENGAGED \u2013 2.0% COMPOUNDING RULE ACTIVE', rust: true });
        onLog?.({ time: now, msg: '  WARNING \u2013 sub-mandate retreat will trigger social disintegration protocols', rust: true });
      }

      let newPenalty = 0;
      let newPenaltyMsg = '';
      if (mandateActiveRef.current && gr < 2.0 && phase < PH.COLLAPSE) {
        if (gr < 1.0)      { newPenalty = 3; newPenaltyMsg = DOUBLE_BIND[2].msg; }
        else if (gr < 1.5) { newPenalty = 2; newPenaltyMsg = DOUBLE_BIND[1].msg; }
        else               { newPenalty = 1; newPenaltyMsg = DOUBLE_BIND[0].msg; }
      }
      penaltyLevelRef.current = newPenalty;
      setPenaltyLevel(newPenalty);
      setPenaltyMsg(newPenaltyMsg);

      // ── Layer 5.5.5.5.5 – Viral progression timeline ─────────────────
      for (const entry of VIRAL_TIMELINE) {
        if (!viralEmittedRef.current.has(entry.key) && entry.condition(sargState)) {
          viralEmittedRef.current.add(entry.key);
          const now = new Date().toLocaleTimeString('en-US', { hour12: false });
          onLog?.({ time: now, msg: `  ${entry.msg}`, rust: true });
          setLastViralMsg(entry.msg);
        }
      }

      // React state updates (10 Hz)
      setUiPhase(phase);
      setUiStats({ viable: DOT_COUNT - deadCount, dead: deadCount, capital, s_gen, x_dest, dx_dt });
      setUiSarg(sarg);
      setUiMetrics({ metabolicFat, trophicV, deadFrac, exergyNorm });

      // ── Phase transition terminal logs ────────────────────────────────
      const newPhase = phase;
      if (newPhase !== prevPhaseRef.current) {
        const now = new Date().toLocaleTimeString('en-US', { hour12: false });
        if (newPhase === PH.EXTRACTION) {
          onLog?.({ time: now, msg: '> PARADOX LAYER 4.4.4.4 \u2013 thermodynamic reversals engaged', rust: true });
          onLog?.({ time: now, msg: '  Gray-Scott feed rate declining \u2013 Turing patterns destabilising', rust: true });
        }
        if (newPhase === PH.OVERSHOOT) {
          onLog?.({ time: now, msg: '> PARADOX LAYER 5.5.5.5.5 \u2013 DIMENSIONAL SINGULARITY', rust: true });
          onLog?.({ time: now, msg: `  dx_dest/dt = ${dx_dt.toFixed(2)} TW  |  SARG = ${sarg.sarg.toFixed(2)}  |  coherence decaying`, rust: true });
        }
        if (newPhase === PH.COLLAPSE) {
          onLog?.({ time: now, msg: '> LAYER 6.6.6.6.6.6 \u2013 CONVERGENCE PHYSICS: observation accelerates collapse', rust: true });
          onLog?.({ time: now, msg: '  LINDBLAD DECOHERENCE DOMINANT \u2013 all off-diagonal elements decaying to zero', rust: true });
        }
        if (newPhase === PH.FINAL) {
          onLog?.({ time: now, msg: '  LAYER 7.7.7.7.7.7.7 \u2013 SOVEREIGN PARADOX: crystalline invariance through death', rust: true });
          onLog?.({ time: now, msg: '  SARG = 0.000 \u2013 BIOSPHERE COHERENCE TERMINATED \u2013 reaction-diffusion substrate extinct', rust: true });
        }
        prevPhaseRef.current = newPhase;
      }

      // ── Collapse error flooding ───────────────────────────────────────
      if (newPhase >= PH.COLLAPSE) {
        const floodChance = metabolicFat < 0.5 ? 0.06 : metabolicFat < 0.8 ? 0.18 : 0.35;
        if (Math.random() < floodChance) {
          const now = new Date().toLocaleTimeString('en-US', { hour12: false });
          const msg = ERROR_MSGS[Math.floor(Math.random() * ERROR_MSGS.length)];
          onLog?.({ time: now, msg: `  ERR: ${msg}`, rust: true });
        }
      }
    }, 1000 / WASM_HZ);

    return () => clearInterval(tickRef.current);
  }, [wasmReady, onLog]);

  // ── Gray-Scott + rAF render loop ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Mobile: coarse-pointer devices get a smaller grid and fewer steps
    const coarse    = window.matchMedia('(pointer: coarse)').matches;
    const simW      = coarse ? 128 : SIM_W;
    const simH      = coarse ? 72  : SIM_H;
    const stepsPerF = coarse ? 2   : STEPS_PER_FRAME;
    const warmup    = coarse ? 120 : WARMUP_STEPS;

    // Offscreen simulation canvas
    const simCanvas = document.createElement('canvas');
    simCanvas.width  = simW;
    simCanvas.height = simH;
    const simCtx = simCanvas.getContext('2d');
    const simImg = simCtx.createImageData(simW, simH);

    // Initialise Gray-Scott and warm up to develop Turing patterns
    const gs = createGS(simW, simH);
    stepGS(gs, 0.055, 0.062, 0.21, 0.105, warmup);
    gsRef.current = gs;

    const startTime = performance.now();

    // Pre-allocate turbulence lookup arrays (avoid GC churn in hot loop)
    const turbXRows = new Int8Array(simH);
    const turbYCols = new Int8Array(simW);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);

      const dpr = Math.min(devicePixelRatio, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const t = (performance.now() - startTime) / 1000;

      const phase       = phaseRef.current;
      const metabolicFat= metabolicFatRef.current;
      const stats       = statsRef.current;
      const deadFrac    = deadFracRef.current;
      const exergyNorm  = exergyNormRef.current;
      const trophicV    = trophicVRef.current;
      const penalty     = penaltyLevelRef.current;

      // ── Penalty stutter – skip frames when sub-mandate ────────────────
      if (penalty >= 3 && Math.random() < 0.4) return;
      if (penalty >= 2 && Math.random() < 0.2) return;

      // ── Metabolic fat: intentional main-thread busy-wait ──────────────
      // Layer 6.6.6.6.6.6: simulates thermodynamic substrate collapse
      // Capped at 8 ms on mobile to avoid janking the touch UI.
      if (metabolicFat > 0.01) {
        const busyMs = Math.min(metabolicFat * 52, coarse ? 8 : Infinity);
        const s = performance.now();
        // eslint-disable-next-line no-empty
        while (performance.now() - s < busyMs) {}
      }

      // ── Gray-Scott step with thermodynamic coupling ───────────────────
      const currentGS = gsRef.current;
      if (currentGS && phase < PH.FINAL) {
        const gp = gsParams(phase, deadFrac, exergyNorm, trophicV, metabolicFat);
        const steps = phase >= PH.COLLAPSE ? Math.min(3, stepsPerF) : stepsPerF;
        stepGS(currentGS, gp.f, gp.k, gp.Du, gp.Dv, steps);
      }

      // ── Layer 4.4.4.4 – Multi-Channel Chromatic Toxicity ──────────────
      // Render simulation to ImageData with per-channel thermodynamic mapping.
      // Green = Baseline Regeneration (fades with Metabolic Rift)
      // Red   = Metabolic Rift intensity (grows with deadFrac)
      // Blue  = Exergy Destruction / Entropy (grows with exergyNorm)
      // Chromatic aberration: progressive RGB spatial desynchronisation.
      // Turbulence: Navier-Stokes-inspired coordinate warping in overshoot+.

      const pixels = simImg.data;

      if (currentGS) {
        const V = currentGS.V[currentGS.cur];

        // Progressive chromatic aberration – active from extraction onwards
        const strain = deadFrac * 0.5 + exergyNorm * 0.8 + metabolicFat * 1.5;
        const aberr  = Math.floor(strain * 4);

        // Navier-Stokes turbulence distortion – precompute per-row/col offsets
        const doTurb = phase >= PH.OVERSHOOT && metabolicFat > 0.005;
        if (doTurb) {
          for (let y = 0; y < simH; y++) turbXRows[y] = Math.round(Math.sin(y * 0.12 + t * 2.3) * metabolicFat * 5);
          for (let x = 0; x < simW; x++) turbYCols[x] = Math.round(Math.cos(x * 0.09 + t * 1.7) * metabolicFat * 4);
        } else {
          turbXRows.fill(0);
          turbYCols.fill(0);
        }

        // Subtle heat glow in destruction phases – base colour for dead regions
        const baseR = phase >= PH.OVERSHOOT ? Math.round(deadFrac * 14) : 0;
        const baseB = phase >= PH.COLLAPSE  ? Math.round(exergyNorm * 10) : 0;

        for (let y = 0; y < simH; y++) {
          const tx = turbXRows[y];
          for (let x = 0; x < simW; x++) {
            const pidx = (y * simW + x) * 4;
            const ty = turbYCols[x];
            const sY = (y + ty + simH) % simH;

            // Per-channel sampling with chromatic offset + turbulence
            const rX = (x + aberr  + tx + simW) % simW;
            const gX = (x          + Math.round(tx * 0.3) + simW) % simW;
            const bX = (x - aberr  + Math.round(tx * -0.6) + simW) % simW;

            const rV = Math.min(1.0, V[sY * simW + rX] * 2.5);
            const gV = Math.min(1.0, V[sY * simW + gX] * 2.5);
            const bV = Math.min(1.0, V[sY * simW + bX] * 2.5);

            if (phase >= PH.FINAL) {
              // Dead stagnant canal – grey-brown sludge, no movement
              pixels[pidx]     = Math.round(18 + rV * 22);
              pixels[pidx + 1] = Math.round(15 + gV * 16);
              pixels[pidx + 2] = Math.round(10 + bV * 10);
            } else {
              // River → polluted canal colour mapping
              // Pollution index: 0 = clean river, 1 = toxic canal
              const pollution = Math.min(1.0, deadFrac * 0.72 + exergyNorm * 0.38);
              // Spatial flow bias: left = upstream (cleaner), right = downstream (worse)
              const flowBias = x / simW;
              const lp = Math.min(1.0, pollution * (0.22 + flowBias * 0.78) + trophicV * 0.08 * flowBias);

              // Clean river: deep teal-blue, light dancing on clear water
              const rClean = 8   + rV * 38;
              const gClean = 58  + gV * 128;
              const bClean = 105 + bV * 150;

              // Polluted canal: murky brown-olive, toxic algae, rust runoff
              const rPoll = 12  + rV * 158 + exergyNorm * 18;
              const gPoll = 22  + gV * 88  + trophicV * 18;
              const bPoll = 4   + bV * 14;

              // Oil-slick iridescence at mid-pollution (extraction → overshoot)
              let oilR = 0, oilG = 0, oilB = 0;
              if (phase >= PH.EXTRACTION && lp > 0.08 && lp < 0.82) {
                const oilT = t * 0.9 + x * 0.045 + y * 0.022;
                const oilStr = lp * (1.0 - lp) * 3.8;
                oilR =  Math.sin(oilT)         * oilStr * 38;
                oilG =  Math.cos(oilT + 2.09)  * oilStr * 22;
                oilB =  Math.sin(oilT + 4.19)  * oilStr * 52;
              }

              const r = rClean + (rPoll - rClean) * lp + oilR;
              const g = gClean + (gPoll - gClean) * lp + oilG;
              const b = bClean + (bPoll - bClean) * lp + oilB;

              pixels[pidx]     = Math.min(255, Math.max(0, Math.round(r) + baseR));
              pixels[pidx + 1] = Math.min(255, Math.max(0, Math.round(g)));
              pixels[pidx + 2] = Math.min(255, Math.max(0, Math.round(b) + baseB));
            }
            pixels[pidx + 3] = 255;
          }
        }
      }

      simCtx.putImageData(simImg, 0, 0);

      // ── Draw scaled to main canvas ────────────────────────────────────
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(simCanvas, 0, 0, W, H);

      // ── Scanline overlay (CRT terminal aesthetic) ─────────────────────
      if (phase < PH.FINAL) {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for (let y = 0; y < H; y += 3) {
          ctx.fillRect(0, y, W, 1);
        }
      }

      // ── 130 BPM pulse vignette ────────────────────────────────────────
      const pulseT = Math.sin(t * 2 * Math.PI * (130 / 60)) * 0.5 + 0.5;
      const vAlpha = phase >= PH.OVERSHOOT
        ? 0.30 + metabolicFat * 0.35 + pulseT * 0.06
        : 0.15 + pulseT * 0.04;
      const vigR = phase >= PH.OVERSHOOT ? Math.min(W, H) * 0.20 : Math.min(W, H) * 0.30;
      const grad = ctx.createRadialGradient(W / 2, H / 2, vigR, W / 2, H / 2, Math.max(W, H) * 0.72);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, `rgba(0,0,0,${vAlpha})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // ── Collapse: glitch scan bands ───────────────────────────────────
      if (phase >= PH.COLLAPSE && metabolicFat > 0.1) {
        const nBands = Math.floor(metabolicFat * 7);
        ctx.save();
        for (let b = 0; b < nBands; b++) {
          const by = (Math.sin(t * (3 + b * 1.7) + b * 47) * 0.5 + 0.5) * H;
          const bh = 2 + metabolicFat * 10;
          const shift = Math.sin(t * 11 + b * 13) * metabolicFat * 30;
          ctx.globalAlpha = 0.3 + metabolicFat * 0.4;
          ctx.drawImage(simCanvas,
            0, (by / H) * SIM_H, SIM_W, (bh / H) * SIM_H,
            shift, by, W, bh
          );
        }
        ctx.restore();
      }

      // ── Penalty: red vignette flash ───────────────────────────────────
      if (penalty > 0) {
        const flash = Math.abs(Math.sin(t * (2 + penalty * 1.5)));
        const pAlpha = penalty * 0.04 * flash;
        ctx.fillStyle = `rgba(180,0,0,${pAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Canvas resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        const dpr = Math.min(devicePixelRatio, 2);
        canvas.width  = Math.round(width  * dpr);
        canvas.height = Math.round(height * dpr);
      }
    });
    ro.observe(canvas.parentElement ?? canvas);
    return () => ro.disconnect();
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    const wasm = wasmRef.current;
    if (!wasm) return;
    wasm.run_ecocide(1.0, WASM_DT, 1.0);
    setGrowthRate(0.0);
    growthRateRef.current    = 0.0;
    phaseRef.current         = 0;
    metabolicFatRef.current  = 0;
    prevPhaseRef.current     = 0;
    prevDeadRef.current      = 0;
    trophicVRef.current      = 0;
    deadFracRef.current      = 0;
    exergyNormRef.current    = 0;
    penaltyLevelRef.current  = 0;
    mandateActiveRef.current = false;
    viralEmittedRef.current  = new Set();
    statsRef.current         = { viable: DOT_COUNT, dead: 0, capital: 0, s_gen: 0, x_dest: 0, dx_dt: 0 };
    setUiPhase(0);
    setUiStats({ viable: DOT_COUNT, dead: 0, capital: 0, s_gen: 0, x_dest: 0, dx_dt: 0 });
    setUiSarg({ sarg: 10.0, coherence: 1.0, activated: 0, violated: 0 });
    setUiMetrics({ metabolicFat: 0, trophicV: 0, deadFrac: 0, exergyNorm: 0 });
    setMandateActive(false);
    setPenaltyLevel(0);
    setPenaltyMsg('');
    setLastViralMsg('');

    // Re-initialise Gray-Scott with warm-up (mobile-aware size)
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const gs = createGS(coarse ? 128 : SIM_W, coarse ? 72 : SIM_H);
    stepGS(gs, 0.055, 0.062, 0.21, 0.105, coarse ? 120 : WARMUP_STEPS);
    gsRef.current = gs;
  }, []);

  // ── Derived UI values ─────────────────────────────────────────────────────
  const phaseColor = PHASE_COLOR[uiPhase] ?? '#333';
  const isCollapse = uiPhase >= PH.COLLAPSE;
  const { deadFrac, exergyNorm, metabolicFat: mFat, trophicV: tV } = uiMetrics;

  // Paradox state for display
  const sargState = { phase: uiPhase, deadFrac, exergyNorm, trophicV: tV, metabolicFat: mFat };

  // Computed extraction cost – shows hidden GDP the operator is actually demanding
  const extractionCost = growthToGdp(growthRate, deadFrac);

  // ── Plywood Paradox containment ─────────────────────────────────────────────
  // Glyphs are statically anchored. Chromatic aberration is delivered exclusively
  // via text-shadow RGB split (cyan/magenta). Canvas handles spatial distortion.

  // Collapse: pulsing cyan/magenta text-shadow – amplitude scales with metabolic fat
  const collapseGlitchShadow = isCollapse && mFat > 0.3
    ? `${Math.sin(Date.now() / 40) * 4}px 0 #00ccccaa, ${-Math.sin(Date.now() / 40) * 4}px 0 #cc00ccaa`
    : 'none';

  // Penalty: red/magenta text-shadow – activates at level 1, intensifies per level
  const penaltyShadow = penaltyLevel >= 1
    ? `${penaltyLevel * 1.5}px 0 #cc220077, ${-penaltyLevel * 1.5}px 0 #cc006655`
    : 'none';

  // Combined text-shadow – collapse wins over penalty
  const glitchShadow = isCollapse ? collapseGlitchShadow : penaltyShadow;

  // Terminal gauge bar
  const gauge = (val, max = 1) => {
    const filled = Math.round(Math.min(1, val / max) * 10);
    return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
  };

  // Slider colour logic
  const sliderColor = penaltyLevel >= 2 ? '#cc2200' : penaltyLevel === 1 ? '#cc6600' : uiPhase >= PH.OVERSHOOT ? '#ff4400' : '#7ab800';

  return (
    <div className="flex flex-col h-full bg-black font-mono select-none overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[#1a2d00]/70 tracking-widest uppercase overflow-hidden"
           style={{ textShadow: glitchShadow, fontWeight: 800, fontSize: '13px' }}>
        <span className="text-[#5a8a00]/70">ECOCIDE</span>
        <span className="text-[#2a4000]">{'\u2013'}</span>
        <span className="text-[#3a5500]/60">Thermodynamic Elegance Engine</span>
        <span className="text-[#2a4000]">{'\u00b7'}</span>
        <span className="text-[#3a5500]/60">SARG Governance</span>
        <div className="flex-1" />
        {!wasmReady && (
          <span className="text-[#4a6a00]/60 animate-pulse">KERNEL INIT...</span>
        )}
        <span
          className="font-bold"
          style={{ color: phaseColor, textShadow: `0 0 12px ${phaseColor}60` }}
        >
          {PHASE_LABEL[uiPhase]}
        </span>
      </div>

      {/* ── Main area: Canvas + Overlays ── */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* ── Paradox governance overlay (left) ── */}
        <div
          className="absolute left-0 top-0 bottom-0 overflow-y-auto pointer-events-none"
          style={{
            width: '310px',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0) 100%)',
            textShadow: glitchShadow,
            overflow: 'hidden',
          }}
        >
          <div className="px-3 pt-3 pb-1 tracking-[0.2em] uppercase" style={{ color: '#4a6a10', lineHeight: '1.5', fontSize: '10.5px', fontWeight: 800 }}>
            Seraphine-8.8.8.8.8.8.8.8 {'\u00b7'} Paradox Governance
          </div>

          {PARADOXES.map((p, i) => {
            const active = uiPhase >= p.phaseMin;
            if (!active) return null;
            const violated = p.violate(sargState);
            return (
              <div key={i} className="px-3 py-[3px]">
                <div className="flex items-baseline gap-2 tracking-wider" style={{ lineHeight: '1.6', fontSize: '12px' }}>
                  <span style={{ color: violated ? '#cc0000' : '#5a9000', fontSize: '14px', fontWeight: 800 }}>
                    {p.rune}
                  </span>
                  <span style={{ color: violated ? '#bb2200' : '#6a9a10', minWidth: '100px', lineHeight: '1.6', fontWeight: 800 }}>
                    {p.name}
                  </span>
                  <span style={{ color: violated ? '#992200' : '#3a6a00', fontSize: '10.5px', letterSpacing: '0.15em', fontWeight: 800 }}>
                    {violated ? 'VIOLATED' : 'HOLDING'}
                  </span>
                </div>
                <div className="tracking-wide mt-px" style={{ color: violated ? '#773300' : '#3a5a08', fontWeight: 800, lineHeight: '1.6', fontSize: '10px' }}>
                  {p.short}
                </div>
                {/* Layer separator */}
                {i < PARADOXES.length - 1 && PARADOXES[i + 1].layer !== p.layer && uiPhase >= PARADOXES[i + 1].phaseMin && (
                  <div className="mt-1.5 mb-0.5 tracking-[0.25em] uppercase"
                       style={{ color: '#3a5500', borderTop: '1px solid #2a400028', paddingTop: '4px', lineHeight: '1.6', fontSize: '9px', fontWeight: 800 }}>
                    Layer {PARADOXES[i + 1].layer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── SARG score (top right) ── */}
        <div className="absolute top-3 right-4 text-right pointer-events-none overflow-hidden"
             style={{ textShadow: glitchShadow }}>
          <div className="tracking-[0.25em] uppercase" style={{ color: '#3a5a00', lineHeight: '1.5', fontSize: '10.5px', fontWeight: 800 }}>
            SARG
          </div>
          <div
            className="leading-none"
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: uiSarg.sarg > 6 ? '#7ab800' : uiSarg.sarg > 3 ? '#c8860a' : '#cc0000',
              textShadow: `0 0 20px ${uiSarg.sarg > 6 ? '#7ab80040' : uiSarg.sarg > 3 ? '#c8860a40' : '#cc000040'}`,
            }}
          >
            {uiSarg.sarg.toFixed(2)}
          </div>
          <div className="tracking-wide mt-0.5" style={{ color: '#3a5a10', lineHeight: '1.6', fontSize: '10px', fontWeight: 800 }}>
            C{'\u2097\u2081'} = {uiSarg.coherence.toFixed(3)} {'\u00b7'} {uiSarg.violated}/{uiSarg.activated} violated
          </div>
          <div className="tracking-wide" style={{ color: '#2d4a08', lineHeight: '1.6', fontSize: '9px', fontWeight: 800 }}>
            {'\u0394'}(t) = {(1 - deadFrac).toFixed(3)} {'\u00b7'} {'\u03bb'}{'\u2091'} = 0.85
          </div>
        </div>

        {/* ── Phase warning overlay ── */}
        {uiPhase >= PH.OVERSHOOT && (
          <div className="absolute top-0 left-0 right-0 text-center pt-1 pointer-events-none overflow-hidden"
               style={{ textShadow: glitchShadow }}>
            <span className="text-[10px] tracking-[0.15em]" style={{
              color: isCollapse ? '#cc0000' : '#8b2200',
              opacity: isCollapse ? 0.5 + Math.abs(Math.sin(Date.now() / 300)) * 0.5 : 0.45,
            }}>
              {isCollapse
                ? '\u2013 LINDBLAD DECOHERENCE DOMINANT \u2013 ALL PARADOXES CONVERGING TO VIOLATION \u2013'
                : '\u2013 EXERGY OVERSHOOT \u2013 BIOSPHERE COHERENCE DEGRADING \u2013'}
            </span>
          </div>
        )}

        {/* ── Thermodynamic readings (bottom right) ── */}
        <div className="absolute bottom-2 right-4 text-right pointer-events-none tracking-wider overflow-hidden"
             style={{ color: '#3a5a10', textShadow: glitchShadow, lineHeight: '1.6', fontSize: '10.5px', fontWeight: 800 }}>
          <div>
            X{'\u1d35'} = T{'\u2080'} {'\u00b7'} S{'\u2092\u1d07\u2099'} ={' '}
            <span style={{ color: '#c8860a' }}>{uiStats.x_dest.toFixed(2)} TJ</span>
          </div>
          <div>
            dX/dt ={' '}
            <span style={{ color: uiStats.dx_dt > X_SOLAR ? '#ff4400' : '#5a8a10' }}>
              {uiStats.dx_dt.toFixed(1)} TW
            </span>
            {' / '}{X_SOLAR} TW
          </div>
          {/* Hidden extraction cost reveal */}
          {growthRate > 0.1 && (
            <div className="mt-1" style={{ color: '#4a3000' }}>
              EXTRACTION_COST {'\u2013'} {extractionCost.toFixed(2)}{'\u00d7'}
            </div>
          )}
        </div>
      </div>

      {/* ── Three-variable gauges + stats ── */}
      <div className="shrink-0 grid grid-cols-4 gap-x-4 items-start px-4 py-2 border-t border-[#111a00]/60 tracking-widest uppercase overflow-hidden"
           style={{ color: '#3a5a10', textShadow: glitchShadow, fontWeight: 800, fontSize: '10.5px' }}>

        {/* METABOLIC_RIFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#3a5000', opacity: 0.8, lineHeight: 1 }}>METABOLIC_RIFT</span>
          <div className="flex items-center gap-1.5">
            <span style={{ color: deadFrac > 0.5 ? '#cc0000' : '#5a8a10', fontSize: '11px', letterSpacing: '0', lineHeight: 1 }}>
              {gauge(deadFrac)}
            </span>
            <span style={{ color: deadFrac > 0.5 ? '#cc0000' : '#5a8a10', lineHeight: 1 }}>
              {(deadFrac * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* EXERGY_DEST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#3a5000', opacity: 0.8, lineHeight: 1 }}>EXERGY_DEST</span>
          <div className="flex items-center gap-1.5">
            <span style={{ color: exergyNorm > 1 ? '#ff4400' : '#5a8a10', fontSize: '11px', letterSpacing: '0', lineHeight: 1 }}>
              {gauge(exergyNorm)}
            </span>
            <span style={{ color: exergyNorm > 1 ? '#ff4400' : '#5a8a10', lineHeight: 1 }}>
              {(exergyNorm * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* TROPHIC_CASCADE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ color: '#3a5000', opacity: 0.8, lineHeight: 1 }}>TROPHIC_CASCADE</span>
          <div className="flex items-center gap-1.5">
            <span style={{ color: tV > 0.3 ? '#cc6600' : '#5a8a10', fontSize: '11px', letterSpacing: '0', lineHeight: 1 }}>
              {gauge(tV)}
            </span>
            <span style={{ color: tV > 0.3 ? '#cc6600' : '#5a8a10', lineHeight: 1 }}>
              {(tV * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* CARRYING_CAPACITY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'right' }}>
          <span style={{ color: '#3a5000', opacity: 0.8, lineHeight: 1 }}>CARRYING_CAPACITY</span>
          <div style={{ lineHeight: 1 }}>
            <span style={{ color: '#5a9a20', fontWeight: 800 }}>{uiStats.viable}</span>
            <span style={{ color: '#2a4000', opacity: 0.6, fontWeight: 800 }}> / {DOT_COUNT}</span>
          </div>
        </div>

      </div>

      {/* ── Explanation panel ── */}
      <div className="shrink-0 px-4 py-2 border-t border-[#1a2d00]/40 bg-black overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1" style={{ fontSize: '10px', fontWeight: 800, color: '#3a5a10', lineHeight: '1.7', letterSpacing: '0.06em' }}>
          <div>
            <span style={{ color: '#5a8a20' }}>RIVER → CANAL</span>
            {'  '}Drag the slider up. Watch the clean river (deep blue) degrade into toxic canal (brown algae, oil slick) as growth outpaces regeneration.
          </div>
          <div>
            <span style={{ color: '#5a8a20' }}>GROWTH_MANDATE</span>
            {'  '}Each % point = compounding extraction pressure on the biosphere. Above 2.0% the mandate locks in. Drop below it and the double-bind fires social penalties.
          </div>
          <div>
            <span style={{ color: '#5a8a20' }}>SARG / PARADOXES</span>
            {'  '}Biosphere Coherence score (0–10). Each paradox that tips to VIOLATED drains it. At zero: Lindblad decoherence — the system cannot self-repair.
          </div>
        </div>
      </div>

      {/* ── Layer 3.3.3 – GROWTH_MANDATE Slider ── */}
      <div className="shrink-0 px-4 pt-3 pb-1 border-t border-[#1a2d00]/60 bg-black overflow-hidden"
           style={{ textShadow: glitchShadow }}>

        <div className="flex items-center gap-3 mb-1">
          <span className="tracking-widest uppercase shrink-0" style={{ color: sliderColor, fontSize: '13px', fontWeight: 800 }}>
            GROWTH_MANDATE
          </span>
          <GrowthSlider
            value={growthRate}
            disabled={isCollapse}
            color={sliderColor}
            mandateActive={mandateActive}
            onChange={setGrowthRate}
          />
          <span
            className="w-14 text-right shrink-0"
            style={{ color: sliderColor, fontSize: '16px', fontWeight: 800 }}
          >
            {growthRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* ── Kernel Log Display (below slider) ── */}
      <div className="shrink-0 px-4 py-1 min-h-[28px] border-t border-[#1a2d00]/30 bg-black overflow-hidden"
           style={{ textShadow: penaltyLevel > 0 ? penaltyShadow : 'none' }}>

        {/* Double-Bind penalty message – 800 weight for maximum impact during high-entropy stuttering */}
        {penaltyMsg && (
          <div className="tracking-wide" style={{
            color: penaltyLevel >= 3 ? '#cc2200' : penaltyLevel >= 2 ? '#cc5500' : '#cc7700',
            fontWeight: 800,
            fontSize: '10.5px',
            lineHeight: '1.6',
            opacity: 0.7 + Math.abs(Math.sin(Date.now() / (400 - penaltyLevel * 80))) * 0.3,
          }}>
            {'\u25B6'} {penaltyMsg}
          </div>
        )}

        {/* Most recent viral timeline entry */}
        {lastViralMsg && !penaltyMsg && (
          <div className="tracking-wide" style={{ color: '#5a7a20', lineHeight: '1.6', fontSize: '10.5px', fontWeight: 800 }}>
            {lastViralMsg}
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="shrink-0 px-4 py-1.5 border-t border-[#1a2d00]/40 bg-black overflow-hidden"
           style={{ textShadow: glitchShadow }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 tracking-wide" style={{ color: '#3a5a10', lineHeight: '1.5', fontSize: '10.5px', fontWeight: 800 }}>
            <span>
              SARG = {uiSarg.sarg.toFixed(2)} / 10.00
            </span>
            <span style={{ color: uiStats.dx_dt > X_SOLAR ? '#cc2200' : '#3a5a10' }}>
              {uiStats.dx_dt > X_SOLAR ? '\u25b2 OVERSHOOT' : '\u25bc STABLE'}
            </span>
            <span>
              {uiSarg.violated > 0 ? `${uiSarg.violated} PARADOX${uiSarg.violated > 1 ? 'ES' : ''} VIOLATED` : 'ALL PARADOXES HOLDING'}
            </span>
            {mandateActive && !isCollapse && (
              <span style={{ color: penaltyLevel > 0 ? '#cc4400' : '#5a7a10' }}>
                MANDATE {penaltyLevel > 0 ? '\u2013 SUB-THRESHOLD' : '\u2013 COMPLIANT'}
              </span>
            )}
          </div>
          <button
            onClick={handleReset}
            className="uppercase tracking-widest transition-colors"
            style={{ color: '#2a4000', fontSize: '11px', fontWeight: 800 }}
            onMouseEnter={e => e.target.style.color = '#5a8a10'}
            onMouseLeave={e => e.target.style.color = '#2a4000'}
          >
            [RESET_SIMULATION]
          </button>
        </div>
      </div>

      {/* ── Eco-Kernel Index ────────────────────────────────────────────── */}
      <EcoIndex articles={articles} onOpenArticle={onOpenArticle} />

    </div>
  );
}

// ── EcoIndex subcomponent ─────────────────────────────────────────────────────
function EcoIndex({ articles, onOpenArticle }) {
  const [search, setSearch] = useState('');
  const ecoArticles = useMemo(() => {
    // Filter, then deduplicate by title — keep the entry with the most tags
    const raw = articles.filter(isEcoArticle);
    const byTitle = new Map();
    for (const a of raw) {
      // Strip leading emoji / non-ASCII so "🌿 FLORA..." and "FLORA..." collide
      const key = (a.title || a.id).replace(/^[\p{Emoji}\s]+/u, '').toLowerCase().trim();
      const existing = byTitle.get(key);
      if (!existing || (a.tags || []).length > (existing.tags || []).length) {
        byTitle.set(key, a);
      }
    }
    let list = [...byTitle.values()];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(a =>
      (a.title    || '').toLowerCase().includes(q) ||
      (a.subtitle || '').toLowerCase().includes(q) ||
      (a.tags     || []).some(t => t.toLowerCase().includes(q))
    );
  }, [articles, search]);

  const BOTANICAL_TAGS = new Set(['Botany','Ecology','Autochthony','Biocoenosis','Biodiversity','ecological','biodiversity']);
  const isBotanical = (a) => (a.tags || []).some(t => BOTANICAL_TAGS.has(t));

  if (!articles.length) return null;

  return (
    <div className="mt-6 border-t pt-6" style={{ borderColor: 'rgba(122,184,0,0.2)' }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-xs font-bold tracking-widest uppercase" style={{ color: 'rgba(57,255,20,0.45)' }}>
          // eco_kernel_index · {ecoArticles.length} entries
        </div>
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'rgba(122,184,0,0.45)' }} />
          <input
            type="text"
            placeholder="search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-black/60 border rounded-sm pl-7 pr-6 py-1 text-xs font-mono text-lime-300 placeholder-lime-900/50 outline-none transition-colors"
            style={{ borderColor: 'rgba(122,184,0,0.25)', width: '180px' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3 h-3" style={{ color: 'rgba(122,184,0,0.45)' }} />
            </button>
          )}
        </div>
      </div>

      {ecoArticles.length > 0 ? (
        <div className="space-y-2">
          {ecoArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => onOpenArticle?.(article)}
              className="border rounded px-4 py-3 cursor-pointer group transition-all hover:border-lime-500/40"
              style={{ borderColor: 'rgba(122,184,0,0.18)', background: 'rgba(57,255,20,0.02)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm truncate group-hover:text-lime-300 transition-colors" style={{ color: '#7ab800' }}>
                    {isBotanical(article) && <span className="mr-1">🌿</span>}{article.title || article.id}
                  </div>
                  {article.subtitle && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: 'rgba(122,184,0,0.45)' }}>{article.subtitle}</div>
                  )}
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {(article.tags || []).filter(t => ECO_TAGS.has(t)).map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded-sm border font-mono"
                        style={{ borderColor: 'rgba(57,255,20,0.2)', color: 'rgba(57,255,20,0.55)', background: 'rgba(57,255,20,0.04)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: 'rgba(57,255,20,0.35)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded px-4 py-8 text-center" style={{ borderColor: 'rgba(122,184,0,0.12)' }}>
          <AlertTriangle className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(122,184,0,0.25)' }} />
          <div className="text-xs font-mono" style={{ color: 'rgba(122,184,0,0.35)' }}>
            {search ? `no results for "${search}"` : '// no ecological kernels indexed'}
          </div>
        </div>
      )}
    </div>
  );
}
