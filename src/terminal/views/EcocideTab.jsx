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
import { ChevronRight, Filter, X, AlertTriangle, Globe } from 'lucide-react';
import wasmRegistry from '../../wasm/wasm.generated';
import { loadWasm } from '../../wasm/wasmSingleton';
import WorldMap from '../components/WorldMap';
import { toMapXY, COUNTRIES, SPHERE_PATH, GRATICULE_PATH, EQUATOR_PATH, BORDERS_PATH } from '../data/worldMapPolys';

// ── Coupling Event Bus ─────────────────────────────────────────────────────
// Simple pub/sub for cross-tab phase coupling.
// ArtTab.jsx can subscribe via: ecocideBus.on(handler)
// The coupling can feed into the Hopfield field's r parameter.
export const ecocideBus = {
  _listeners: [],
  emit(data) { this._listeners.forEach(fn => fn(data)); },
  on(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(f => f !== fn); }; },
};

// ── Eco article filter ────────────────────────────────────────────────────────
const ECO_TAGS = new Set([
  'Botany','Ecology','Autochthony','Lizard Gap','Biodiversity','Atmospheric',
  'Climate','Thermodynamic','Entropy','Ecological','Biocoenosis','Biology',
  'Sustainability','Ecocide','ecological','biodiversity','atmospheric',
]);
const isEcoArticle = (a) => a?.tags?.some(t => ECO_TAGS.has(t));

// ── Ecological stress hotspots (lon, lat, severity 1–5, label) ──────────────
const ECO_HOTSPOTS = [
  { lon: -60, lat: -3,  sev: 5, label: 'AMAZON'    },
  { lon: 22,  lat: 0,   sev: 4, label: 'CONGO'     },
  { lon: 115, lat: 1,   sev: 5, label: 'BORNEO'    },
  { lon: 149, lat: -18, sev: 4, label: 'GBR'       },
  { lon: 0,   lat: 76,  sev: 5, label: 'ARCTIC'    },
  { lon: 47,  lat: -19, sev: 4, label: 'MADAGASCAR' },
  { lon: 10,  lat: 13,  sev: 3, label: 'SAHEL'     },
  { lon: 100, lat: 30,  sev: 3, label: 'HIMALAYA'  },
  { lon: -70, lat: -65, sev: 5, label: 'ANTARCTIC' },
  { lon: 135, lat: -25, sev: 3, label: 'OUTBACK'   },
  { lon: -90, lat: 45,  sev: 3, label: 'GREAT LAKES' },
  { lon: 30,  lat: -2,  sev: 4, label: 'RIFT VALLEY' },
];
const ECO_SEV_HEX   = { 5: '#dc2626', 4: '#ea580c', 3: '#ca8a04', 2: '#65a30d', 1: '#16a34a' };
const ECO_SEV_LABEL = {
  5: 'CRITICAL — systemic collapse risk',
  4: 'SEVERE — acute ecosystem stress',
  3: 'ELEVATED — chronic degradation',
  2: 'MODERATE — measurable pressure',
  1: 'MONITORED — early-stage indicators',
};

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
  const wasmRef   = useRef(null);
  const rafRef    = useRef(null);  // rAF ID for glitch re-render loop
  const tickRef   = useRef(null);

  // Thermodynamic state refs – written at 10 Hz by WASM tick, read by rAF loop
  const phaseRef        = useRef(PH.HOMEOSTASIS);
  const metabolicFatRef = useRef(0);
  const statsRef        = useRef({ viable: DOT_COUNT, dead: 0, capital: 0, s_gen: 0, x_dest: 0, dx_dt: 0 });
  const trophicVRef     = useRef(0);
  const prevDeadRef     = useRef(0);
  const prevPhaseRef    = useRef(PH.HOMEOSTASIS);
  const deadFracRef     = useRef(0);
  const exergyNormRef   = useRef(0);
  const sargHistoryRef  = useRef([]);          // SARG sparkline buffer (80 readings @ 10 Hz = 8 s)

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
  // Map animation state — driven by WASM tick, CSS transitions interpolate to 60fps
  const [mapState, setMapState] = useState({ deadFrac: 0, phase: 0, exergyNorm: 0, trophicV: 0, metabolicFat: 0 });
  const [activeSpot, setActiveSpot] = useState(null);

  const growthRateRef  = useRef(2.5);
  const wasmStuckRef   = useRef(false);  // true if WASM state is stale (bypasses to JS integrator)
  const firstTickRef   = useRef(true);   // detect stale WASM on first tick only
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

    // Reset stale-detection state for this mount cycle.
    firstTickRef.current = true;
    wasmStuckRef.current = false;

    // Attempt to reset WASM Rust static state before the first tick.
    // NOTE: run_ecocide with reset=1.0 may not fully reinitialize the singleton —
    // the first-tick probe below detects and handles persistent stale state.
    try { wasm.run_ecocide(1.0, WASM_DT, 1.0); } catch { /* non-fatal */ }

    tickRef.current = setInterval(() => {
      const gr = growthRateRef.current;

      // ── Try WASM run_ecocide; fall back to JS integrator if unavailable ──
      let deadCount, deadFrac, exergyNorm, phase, metabolicFat, x_dest, dx_dt, capital, s_gen;

      // On the first tick, probe WASM for stale state (persistent singleton may
      // carry FINAL_STATE from a previous session despite the reset calls).
      if (firstTickRef.current && !wasmStuckRef.current) {
        firstTickRef.current = false;
        try {
          const probe = wasm.run_ecocide(1.0, WASM_DT, 1.0);
          const probeData = probe ? JSON.parse(probe) : null;
          if (probeData && (probeData.phase ?? 0) > PH.HOMEOSTASIS && deadFracRef.current < 0.05) {
            // WASM returned a collapsed state while JS refs are fresh — singleton is stale.
            // Force JS integrator for this session so animation starts at HOMEOSTASIS.
            wasmStuckRef.current = true;
          }
        } catch { wasmStuckRef.current = true; }
      }

      let wasmOk = false;
      let raw;
      if (!wasmStuckRef.current) {
        try { raw = wasm.run_ecocide(growthToGdp(gr, deadFracRef.current), WASM_DT, 0.0); wasmOk = true; } catch { /* fall through */ }
      }

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
        // EMA-smooth exergyNorm so it ramps up gradually rather than jumping
        // instantly from 0 → 0.875 on the first tick (which causes a harsh visual skip).
        const rawExergyNorm = Math.min(1.0, extraction * 0.35 + deadFrac * 0.65);
        exergyNorm   = exergyNormRef.current + (rawExergyNorm - exergyNormRef.current) * 0.04;
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

      // ── Coupling: emit phase data for ArtTab Hopfield field ───────────
      ecocideBus.emit({ type: 'ECOCIDE_PHASE', phase, metabolicRift: metabolicFat, exergyRate: exergyNorm });

      // Accumulate sparkline history (capped at 80 ticks ≈ 8 s of data)
      const _hist = sargHistoryRef.current;
      _hist.push(sarg.sarg);
      if (_hist.length > 80) _hist.shift();
      setUiMetrics({ metabolicFat, trophicV, deadFrac, exergyNorm });
      setMapState({ deadFrac, phase, exergyNorm, trophicV, metabolicFat });

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

  // ── rAF for glitch/pulse re-renders (only runs during overshoot+) ──────────
  useEffect(() => {
    let id;
    const tick = () => {
      if (phaseRef.current >= PH.OVERSHOOT || penaltyLevelRef.current > 0) {
        // Trigger a re-render so Date.now()-based glitch effects animate smoothly
        setMapState(s => ({ ...s }));
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    rafRef.current = id;
    return () => cancelAnimationFrame(id);
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
    sargHistoryRef.current = [];
    setUiMetrics({ metabolicFat: 0, trophicV: 0, deadFrac: 0, exergyNorm: 0 });
    setMandateActive(false);
    setPenaltyLevel(0);
    setPenaltyMsg('');
    setLastViralMsg('');

    setMapState({ deadFrac: 0, phase: 0, exergyNorm: 0, trophicV: 0, metabolicFat: 0 });
  }, []);

  // ── Per-country cell state (driven by WASM kernel metrics) ──────────────────
  // Computed 10 Hz; CSS transitions on the SVG elements interpolate to 60 fps.
  //
  // localStress = deadFrac × (baseMult + vuln × stressMult) + seed×jitter
  //   → each country breaks at a different threshold based on biome vulnerability
  //
  // transform = translate(centroid + drift) scale(shrink) translate(-centroid)
  //   → cells shrink toward their centre, revealing the ocean beneath
  //   → cells drift outward as collapse deepens ("skeletal lattice" effect)
  const countryCells = useMemo(() => {
    const { deadFrac: df, phase, exergyNorm: en, trophicV: tv } = mapState;

    // Phase multipliers: how aggressively the map breaks per phase
    const driftMult = [0.0, 0.05, 0.22, 0.65, 1.4][phase] ?? 0;
    const scaleMult = [0.0, 0.04, 0.18, 0.55, 1.2][phase] ?? 0;

    return COUNTRIES.map(({ d, cx, cy, dx, dy, vuln, seed, seed2 }) => {
      // Per-country stress: tropics / poles die first, temperate last
      const localStress = Math.min(1, df * (0.55 + vuln * 0.45 + seed * 0.22) + seed * 0.08 * df * 2.5 + en * 0.12 * vuln);

      // ── Drift (outward from map centre) ────────────────────────────────
      const driftDist   = Math.pow(localStress, 1.6) * 95 * driftMult;
      const tx          = cx + dx * driftDist;
      const ty          = cy + dy * driftDist;

      // ── Scale toward centroid (cracks open as cells shrink) ─────────────
      const cellScale   = Math.max(0.01, 1 - localStress * 0.52 * scaleMult);

      // SVG transform: translate centroid to drift pos, scale, translate back
      const transform   = `translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${cellScale.toFixed(4)}) translate(${(-cx).toFixed(1)},${(-cy).toFixed(1)})`;

      // ── Fill colour: deep forest green → olive → amber → dark red → void ──
      let fill;
      if (localStress < 0.18) {
        const g = Math.round(74 + (1 - localStress / 0.18) * 30);
        fill = `rgb(8,${g},8)`;
      } else if (localStress < 0.42) {
        const t2 = (localStress - 0.18) / 0.24;
        fill = `rgb(${Math.round(8 + t2 * 85)},${Math.round(88 - t2 * 30)},8)`;
      } else if (localStress < 0.72) {
        const t2 = (localStress - 0.42) / 0.30;
        fill = `rgb(${Math.round(93 + t2 * 58)},${Math.round(58 - t2 * 52)},6)`;
      } else {
        const t2 = Math.min(1, (localStress - 0.72) / 0.28);
        fill = `rgb(${Math.round(151 - t2 * 143)},${Math.round(6 - t2 * 4)},4)`;
      }

      // ── Opacity: cells flicker then vanish at high stress ────────────────
      const opacity = localStress > 0.88
        ? Math.max(0, 1 - (localStress - 0.88) / 0.10)
        : 1;

      // ── Wobble amplitude: scales with trophicV ───────────────────────────
      const wobbleAmp  = tv * 7 * (0.4 + localStress * 0.6);
      const wobbleDur  = (2.2 + seed * 3.5).toFixed(2);
      const wobbleDelA = (seed  * 2.0).toFixed(2);
      const wobbleDelB = (seed2 * 1.8).toFixed(2);
      const wx = ((seed  - 0.5) * wobbleAmp).toFixed(2);
      const wy = ((seed2 - 0.5) * wobbleAmp * 0.8).toFixed(2);

      return { d, transform, fill, opacity, wobbleDur, wobbleDelA, wobbleDelB, wx, wy };
    });
  }, [mapState.deadFrac, mapState.phase, mapState.exergyNorm, mapState.trophicV]);

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
    <div className="flex flex-col bg-black font-mono select-none">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-[#1a2d00]/70 tracking-widest uppercase overflow-hidden"
           style={{ textShadow: glitchShadow, fontWeight: 800, fontSize: '13px' }}>
        <span className="text-[#5a8a00]/70">ECOCIDE</span>
        <span className="text-[#7ab800]/30 select-none px-0.5">|</span>
        <span className="text-[#3a5500]/60">Thermodynamic Elegance Engine</span>
        <span className="text-[#7ab800]/30 select-none px-0.5">|</span>
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

      {/* ════════════════════════════════════════════════════════════════
           HERO: COLLAPSING WORLD MAP
           Deep blue sphere · 177 country cells · fracture via WASM entropy
           ════════════════════════════════════════════════════════════════ */}
      <div className="relative w-full overflow-hidden" style={{ height: 'clamp(260px, 50vw, 500px)' }}>

        {/* ── World map SVG ───────────────────────────────────────────── */}
        <svg
          viewBox="0 0 800 400"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%', display: 'block' }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="eco-hero-clip">
              <path d={SPHERE_PATH} />
            </clipPath>
            {/* Graticule glow for collapse phase */}
            <filter id="eco-grat-glow">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Neon edge glow for near-dead countries */}
            <filter id="eco-cell-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* ── Ocean: deep blue sphere fill ────────────────────────────── */}
          <path
            d={SPHERE_PATH}
            fill={['#07152a','#060f20','#050a18','#030710','#010409'][uiPhase] ?? '#07152a'}
            style={{ transition: 'fill 4s ease' }}
          />

          <g clipPath="url(#eco-hero-clip)">
            {/* ── Graticule — pulse amplitude grows with exergyNorm ──────── */}
            <path
              d={GRATICULE_PATH}
              fill="none"
              stroke={`rgba(0,255,80,${0.04 + exergyNorm * 0.08})`}
              strokeWidth={0.3 + exergyNorm * 0.4}
              filter={exergyNorm > 0.5 ? 'url(#eco-grat-glow)' : undefined}
            >
              <animate attributeName="opacity"
                values={`${0.5 + exergyNorm * 0.3};1;${0.5 + exergyNorm * 0.3}`}
                dur={`${5 - exergyNorm * 2}s`}
                repeatCount="indefinite" />
            </path>
            <path
              d={EQUATOR_PATH}
              fill="none"
              stroke={`rgba(0,255,80,${0.10 + exergyNorm * 0.15})`}
              strokeWidth={0.6 + exergyNorm * 0.5}
              style={{ transition: 'stroke 3s ease' }}
            />

            {/* ── Country cells: the fracturing lattice ──────────────────── */}
            {countryCells.map(({ d, transform, fill, opacity, wobbleDur, wobbleDelA, wobbleDelB, wx, wy }, i) => (
              <g
                key={i}
                transform={transform}
                style={{
                  transition: 'transform 3s cubic-bezier(0.4,0,0.2,1)',
                  willChange: 'transform',
                }}
              >
                <path
                  d={d}
                  fill={fill}
                  opacity={opacity}
                  style={{ transition: 'fill 3.5s ease, opacity 2.5s ease' }}
                >
                  {/* Organic wobble: additive to parent transform, scales with trophicV */}
                  {mapState.trophicV > 0.04 && (
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      values={`0,0; ${wx},${wy}; 0,0`}
                      dur={`${wobbleDur}s`}
                      begin={`${wobbleDelA}s`}
                      repeatCount="indefinite"
                      additive="sum"
                    />
                  )}
                </path>
              </g>
            ))}

            {/* ── Country border lattice: brightens as cells separate ─────── */}
            <path
              d={BORDERS_PATH ?? ''}
              fill="none"
              stroke={`rgba(0,255,80,${0.03 + mapState.deadFrac * 0.22})`}
              strokeWidth={0.2 + mapState.deadFrac * 0.4}
              style={{ transition: 'stroke 4s ease, stroke-width 4s ease' }}
              opacity={0.6 + mapState.deadFrac * 0.4}
            />

            {/* ── Collapse: phosphene scan lines ───────────────────────────── */}
            {uiPhase >= PH.COLLAPSE && (
              <rect x="0" y="0" width="800" height="400"
                fill="none"
                stroke="none"
                style={{
                  background: 'repeating-linear-gradient(to bottom,transparent 0,transparent 3px,rgba(0,40,10,0.12) 3px,rgba(0,40,10,0.12) 4px)',
                }}
              />
            )}
          </g>

          {/* ── Sphere border ─────────────────────────────────────────────── */}
          <path
            d={SPHERE_PATH}
            fill="none"
            stroke={`rgba(0,255,80,${0.15 + exergyNorm * 0.25})`}
            strokeWidth={0.8 + exergyNorm * 0.6}
            style={{ transition: 'stroke 3s ease' }}
          />
        </svg>

        {/* ── CRT scanlines overlay ───────────────────────────────────── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'repeating-linear-gradient(to bottom,transparent 0,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)' }}
        />

        {/* ── Radial vignette ─────────────────────────────────────────── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(0,0,0,${0.55 + mFat * 0.35}) 100%)`, transition: 'background 3s ease' }}
        />

        {/* ── Paradox governance overlay — desktop only ───────────────── */}
        <div
          className="absolute left-0 top-0 bottom-0 overflow-hidden pointer-events-none hidden md:block"
          style={{
            width: '280px',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.50) 72%, rgba(0,0,0,0) 100%)',
            textShadow: glitchShadow,
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
                  <span style={{ color: violated ? '#cc0000' : '#5a9000', fontSize: '14px', fontWeight: 800 }}>{p.rune}</span>
                  <span style={{ color: violated ? '#bb2200' : '#6a9a10', minWidth: '80px', lineHeight: '1.6', fontWeight: 800 }}>{p.name}</span>
                  <span style={{ color: violated ? '#992200' : '#3a6a00', fontSize: '10px', letterSpacing: '0.12em', fontWeight: 800 }}>{violated ? 'VIOLATED' : 'HOLDING'}</span>
                </div>
                <div className="tracking-wide mt-px" style={{ color: violated ? '#773300' : '#3a5a08', fontWeight: 800, lineHeight: '1.5', fontSize: '9.5px' }}>{p.short}</div>
                {i < PARADOXES.length - 1 && PARADOXES[i + 1].layer !== p.layer && uiPhase >= PARADOXES[i + 1].phaseMin && (
                  <div className="mt-1.5 mb-0.5 tracking-[0.25em] uppercase" style={{ color: '#3a5500', borderTop: '1px solid #2a400028', paddingTop: '4px', lineHeight: '1.6', fontSize: '9px', fontWeight: 800 }}>
                    Layer {PARADOXES[i + 1].layer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── SARG score ──────────────────────────────────────────────────
             Desktop: top-right with full detail
             Mobile:  bottom-left, number only — avoids collision with map  */}
        <div
          className="absolute pointer-events-none overflow-hidden
                     bottom-2 left-3 text-left
                     md:top-3 md:right-4 md:bottom-auto md:left-auto md:text-right"
          style={{ textShadow: glitchShadow }}
        >
          {/* Label — hidden on mobile to save vertical space */}
          <div className="hidden md:block tracking-[0.25em] uppercase" style={{ color: '#3a5a00', lineHeight: '1.5', fontSize: '10.5px', fontWeight: 800 }}>SARG</div>
          <div className="leading-none" style={{ fontSize: '24px', fontWeight: 800, color: uiSarg.sarg > 6 ? '#7ab800' : uiSarg.sarg > 3 ? '#c8860a' : '#cc0000', textShadow: `0 0 20px ${uiSarg.sarg > 6 ? '#7ab80040' : uiSarg.sarg > 3 ? '#c8860a40' : '#cc000040'}` }}>
            <span className="md:hidden" style={{ fontSize: '10px', fontWeight: 800, opacity: 0.6, letterSpacing: '0.2em' }}>SARG </span>
            {uiSarg.sarg.toFixed(2)}
          </div>
          {/* Detail lines — desktop only */}
          <div className="hidden md:block tracking-wide mt-0.5" style={{ color: '#3a5a10', lineHeight: '1.6', fontSize: '10px', fontWeight: 800 }}>
            C{'\u2097\u2081'} = {uiSarg.coherence.toFixed(3)} {'\u00b7'} {uiSarg.violated}/{uiSarg.activated} violated
          </div>
          <div className="hidden md:block tracking-wide" style={{ color: '#2d4a08', lineHeight: '1.6', fontSize: '9px', fontWeight: 800 }}>
            {'\u0394'}(t) = {(1 - deadFrac).toFixed(3)} {'\u00b7'} {'\u03bb'}{'\u2091'} = 0.85
          </div>
        </div>

        {/* ── Phase warning — bottom-centre, truncated on mobile ────────── */}
        {uiPhase >= PH.OVERSHOOT && (
          <div className="absolute bottom-8 md:bottom-auto md:top-0 left-0 right-0 text-center px-2 md:pt-1 pointer-events-none overflow-hidden" style={{ textShadow: glitchShadow }}>
            <span
              className="block truncate text-[9px] md:text-[10px] tracking-[0.1em] md:tracking-[0.15em]"
              style={{
                color: isCollapse ? '#cc0000' : '#8b2200',
                opacity: isCollapse ? 0.5 + Math.abs(Math.sin(Date.now() / 300)) * 0.5 : 0.45,
              }}
            >
              {isCollapse
                ? '\u2013 LINDBLAD DECOHERENCE DOMINANT \u2013 PARADOXES CONVERGING \u2013'
                : '\u2013 EXERGY OVERSHOOT \u2013 COHERENCE DEGRADING \u2013'}
            </span>
          </div>
        )}

        {/* ── Thermodynamic readings — desktop only ───────────────────── */}
        <div className="hidden md:block absolute bottom-2 right-4 text-right pointer-events-none tracking-wider overflow-hidden"
             style={{ color: '#3a5a10', textShadow: glitchShadow, lineHeight: '1.6', fontSize: '10.5px', fontWeight: 800 }}>
          <div>X{'\u1d35'} = T{'\u2080'} {'\u00b7'} S{'\u2092\u1d07\u2099'} ={' '}<span style={{ color: '#c8860a' }}>{uiStats.x_dest.toFixed(2)} TJ</span></div>
          <div>dX/dt ={' '}<span style={{ color: uiStats.dx_dt > X_SOLAR ? '#ff4400' : '#5a8a10' }}>{uiStats.dx_dt.toFixed(1)} TW</span>{' / '}{X_SOLAR} TW</div>
          {growthRate > 0.1 && <div className="mt-1" style={{ color: '#4a3000' }}>EXTRACTION_COST {'\u2013'} {extractionCost.toFixed(2)}{'\u00d7'}</div>}
        </div>
      </div>

      {/* ── Three-variable gauges + stats ── */}
      <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 items-start px-4 py-2 border-t border-[#111a00]/60 tracking-widest uppercase overflow-hidden"
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
            <span className="flex items-center gap-1.5">
              {sargHistoryRef.current.length > 4 && (() => {
                const hist = sargHistoryRef.current;
                const sw = 54, sh = 13;
                const mn = Math.min(...hist);
                const range = Math.max(...hist) - mn;
                const r = range < 0.05 ? 0.05 : range;
                const pts = hist.map((v, i) => {
                  const x = ((i / Math.max(hist.length - 1, 1)) * sw).toFixed(1);
                  const y = (sh - 1 - ((v - mn) / r) * (sh - 2.5)).toFixed(1);
                  return `${x},${y}`;
                }).join(' ');
                const sc = uiSarg.sarg > 7 ? '#3a7a10' : uiSarg.sarg > 4 ? '#c8860a' : '#cc2200';
                return (
                  <svg width={sw} height={sh} style={{ display: 'inline-block', verticalAlign: 'middle', opacity: 0.9, flexShrink: 0 }}>
                    <polyline points={pts} fill="none" stroke={sc} strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                );
              })()}
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

      {/* ── Ecological Stress Map ──────────────────────────────────────── */}
      <div className="mt-4 border rounded-sm p-3 overflow-hidden" style={{ borderColor: 'rgba(57,255,20,0.12)', background: 'rgba(0,0,0,0.3)' }}>
        <div className="text-[9px] font-mono tracking-widest uppercase mb-2 flex items-center gap-2" style={{ color: 'rgba(57,255,20,0.4)' }}>
          <Globe className="w-2.5 h-2.5" /> BIOSPHERE STRESS DISTRIBUTION
        </div>
        <WorldMap palette="green" height={200} scanDur={7}>
          {ECO_HOTSPOTS.map(({ lon, lat, sev, label }) => {
            const [cx, cy] = toMapXY(lon, lat);
            const r     = 3 + sev * 1.5;
            const color = ECO_SEV_HEX[sev] || '#65a30d';
            return (
              <g
                key={label}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setActiveSpot({ label, sev, cx, cy, color })}
                onMouseLeave={() => setActiveSpot(null)}
                onClick={() => setActiveSpot(s => s?.label === label ? null : { label, sev, cx, cy, color })}
              >
                <circle cx={cx} cy={cy} r={r + 4} fill={color} opacity="0.12">
                  <animate attributeName="r" values={`${r + 2};${r + 8};${r + 2}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.12;0.04;0.12" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx={cx} cy={cy} r={r} fill={color} opacity="0.8">
                  <animate attributeName="r" values={`${r};${r + 2};${r}`} dur="3s" repeatCount="indefinite" />
                </circle>
                <text x={cx} y={cy + r + 11} textAnchor="middle" fill={color} fontSize="7" fontFamily="monospace" opacity="0.55">
                  {label}
                </text>
              </g>
            );
          })}
          {activeSpot && (() => {
            const { cx, cy, color, label, sev } = activeSpot;
            const tw = 148, th = 34;
            let tx = cx + 12;
            let ty = cy - th - 8;
            if (tx + tw > 790) tx = cx - tw - 12;
            if (ty < 4) ty = cy + 12;
            return (
              <g key="tooltip" pointerEvents="none">
                <rect x={tx} y={ty} width={tw} height={th} rx="2"
                  fill="rgba(0,0,0,0.88)" stroke={color} strokeWidth="0.7" strokeOpacity="0.7" />
                <text x={tx + 7} y={ty + 12} fill={color} fontSize="8.5" fontFamily="monospace" fontWeight="bold" opacity="0.95">{label}</text>
                <text x={tx + 7} y={ty + 26} fill={color} fontSize="6.5" fontFamily="monospace" opacity="0.65">{ECO_SEV_LABEL[sev]}</text>
              </g>
            );
          })()}
        </WorldMap>
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
