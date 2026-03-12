// ── useEcologicalRam ─────────────────────────────────────────────────────────
// Ecological entropy model for the RAM bar.
// Maps terminal commands to planetary resource cost (0-100).
// High cost → RAM drains, system throttles, log warning fires.
// Recovery is intentionally slow — the planet heals painfully.

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Cost mapping ──────────────────────────────────────────────────────────────
// Keyed by WASM alias (first alias wins in dispatch, matches wasm.generated.js).
// Commands not in the map get a baseline cost of 20.
export const ECOLOGICAL_ENTROPY_MAP = {
  // ── Idle / passive ──────────────────────────────────────────────────────────
  idle:              2,

  // ── Low footprint — commons, cooperation, ecological economics ──────────────
  soma91:            5,   // static boot banner — negligible
  banner:            5,
  biodiversity:      10,  // Lotka-Volterra biocoenosis model
  biocoenosis:       10,
  ecological:        8,   // Daly thermodynamics — appropriate low cost
  daly:              8,
  entropy_econ:      8,
  replicator:        12,  // Ostrom cooperative games
  ostrom_game:       12,
  commons:           12,
  ceei:              15,  // allocation engine
  allocation:        15,
  soma_plus:         15,  // social capital
  social_capital:    15,
  pragmatic:         12,  // DRK Pragmatic<T> type system
  drk:               12,
  dh_ec:             60,  // Diffie-Hellman / ECDH key exchange
  chrono:            35,  // deep-time ecological audit

  // ── Medium footprint — simulations, economic models ─────────────────────────
  strangler:         20,  // logistic adoption transition
  transition:        20,
  soma55:            20,
  nexteconomy:       20,
  soma_live:         28,  // live soma pilot — streaming state
  pilot:             28,
  somapilot:         28,
  cynicrealist:      30,  // dissipative systems — England entropy engine
  dissipative:       30,
  kuramoto:          40,  // oscillator coupling
  synchrony:         40,
  bosonic:           45,  // quantum lattice simulation
  bosonic_lattice:   45,
  necromantic:       45,  // fish-scale economic power law
  fishscale:         45,

  // ── High footprint — heavy compute, adversarial, surveillance ───────────────
  feigenbaum:        55,  // chaos / period doubling cascade
  bifurcation:       55,
  chaos:             55,
  ising:             58,  // Monte Carlo phase transition
  monte_carlo:       58,
  consensus:         58,
  geopolitics:       62,  // geopolitical kinetics
  kinetics:          62,
  statecraft:        62,
  climate:           68,  // atmospheric model — computational cost = thematic irony
  atmospheric:       68,
  thermosphere:      68,
  breach:            65,  // Breach Protocol ICE penetration
  surveillance:      75,  // panopticon — high social entropy cost
  panopticon:        75,

  // ── Critical footprint — PQC crypto, PDE solvers, stress bench ──────────────
  grayscott:         80,  // reaction-diffusion PDE solver — heavy numerical
  reaction_diffusion: 80,
  turing:            80,
  classified:        85,  // ML-KEM-768 post-quantum cryptography
  mlkem:             85,
  pqc:               85,
  postquantum:       85,
  leviathan:         90,  // vcache stress benchmark — explicit CPU burnout
  benchmark:         90,
  stress:            90,
  vcache_burn:       90,

  // ── Conceptual extremes (future kernels / thematic) ──────────────────────────
  train_agentic_model: 95,
  deep_research_loop:  80,
  crypto_pow:          90,
  local_synthesis:     10,
};

const IDLE_COST   = 2;
const RECOVER_MS  = 3000;   // 1 cost unit shed every 3s — painfully slow
const WARN_THRESH = 70;     // log injection threshold

export function useEcologicalRam({ appendSystemLog }) {
  const [ecoCost, setEcoCost] = useState(IDLE_COST);
  // Stable ref so the recovery interval never needs to be recreated
  const appendRef = useRef(appendSystemLog);
  useEffect(() => { appendRef.current = appendSystemLog; });

  // Slow recovery — planet heals at 1 unit / 3s, never below idle
  useEffect(() => {
    const t = setInterval(() => {
      setEcoCost(c => (c > IDLE_COST ? c - 1 : IDLE_COST));
    }, RECOVER_MS);
    return () => clearInterval(t);
  }, []);

  // Called by dispatch with a kernel alias or raw cost number
  const applyEcoCost = useCallback((aliasOrCost) => {
    const cost = typeof aliasOrCost === 'number'
      ? aliasOrCost
      : (ECOLOGICAL_ENTROPY_MAP[aliasOrCost] ?? 20);

    setEcoCost(Math.min(100, cost));

    if (cost > WARN_THRESH) {
      const t = new Date().toLocaleTimeString('en-US', { hour12: false });
      appendRef.current({
        time: t,
        msg: `[ENTROPY WARNING] Planetary resource cost critical. Local RAM throttled to simulate ecological load.`,
      });
    }
  }, []);

  const ramPct    = 100 - ecoCost;
  const isCritical = ramPct < 20;      // < 20% RAM remaining
  const isWarning  = ramPct < 50;      // amber zone

  return { ramPct, ecoCost, applyEcoCost, isCritical, isWarning };
}
