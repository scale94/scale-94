// src/terminal/views/manifesto/useCouncilCollider.js
// RAF particle sim + SKS interaction state machine for the Council collider.
// Sim state lives in refs; interaction state lives in a pure reducer whose
// persistent truth is the councilLedger (SKS §3 — component state is a cache).
import { useRef, useState, useEffect, useCallback, useMemo, useReducer } from 'react';
import { SIXTEEN_MINDS, mindProfile } from '../../data/sixteenMinds';
import { polarToXY } from './councilRingMath';
import { expand, collide, composeLine, pickPair } from './councilCollider';
import { councilBus } from './councilBus';
import { councilLedger } from './councilLedger';
import { initialCouncilState, councilReducer } from './councilStateMachine';
import { mindEntry, synthesize } from './councilSynthesis';

const CX = 320, CY = 320;
const R_FOUNDATION = 150, R_SEAT = 220, R_CEILING = 290;
const VIEW_W = 980, VIEW_X0 = -170; // desktop SVG viewBox "-170 0 980 640"

// Cycle timing (ms)
const T_INFALL = 2600, T_FLASH = 380, T_EJECT = 1100, T_COOLDOWN = 3200;
const STREAM_N_AMBIENT = 22;
const STREAM_N_USER = 44;          // user collisions feel heavier (spec §1 FIRING)
const SPIRAL_GAIN = 0.9;
const CORE_R = 10;
const ARMED_TIMEOUT_MS = 45000;

const easeInCubic = (t) => t * t * t;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const mindByDim = (d) => SIXTEEN_MINDS.find(m => m.dimIndex === d);

export function useCouncilCollider({ seated, enabled }) {
  const canvasRef = useRef(null);
  const simRef = useRef({ phase: 'IDLE', t0: 0, pair: null, product: null, ordinal: 0, particles: [], userPair: null });
  const rafRef = useRef(0);
  const armedTimerRef = useRef(0);

  const [ui, dispatch] = useReducer(councilReducer, initialCouncilState);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const [lastCollision, setLastCollision] = useState(null);
  const [activePairIds, setActivePairIds] = useState([]);
  const [running, setRunning] = useState(false);

  // Precompute every mind's 1536-D vector once.
  const expanded = useMemo(() => seated.map(m => expand(mindProfile(m))), [seated]);

  // ── SKS §3 rehydration: ledger head → reducer, once on mount ──────────────
  // Shape translation: deriveUiState() speaks {mode, armed:{dimIndex}, record}
  // while the reducer speaks {mode, armedDim, pair, record} — pair is rebuilt
  // from record.pair for SYNTHESIZED restores.
  useEffect(() => {
    const derived = councilLedger.deriveUiState();
    if (derived.mode === 'SYNTHESIZED' && derived.record) {
      const [pA, pB] = derived.record.pair;
      dispatch({
        type: 'HYDRATE',
        state: {
          mode: 'SYNTHESIZED', armedDim: null,
          pair: [pA.dimIndex ?? null, pB.dimIndex ?? null],
          record: derived.record,
        },
      });
      setLastCollision({ line: derived.record.line, trajectory: derived.record.metrics.trajectory });
    } else if (derived.mode === 'ARMED' && derived.armed?.dimIndex != null) {
      dispatch({ type: 'HYDRATE', state: { mode: 'ARMED', armedDim: derived.armed.dimIndex, pair: null, record: null } });
    }
  }, []);

  // ── Interaction API ────────────────────────────────────────────────────────
  const onNodeClick = useCallback((mind) => {
    const state = uiRef.current;
    if (state.mode === 'FIRING') return; // input lock
    if (state.mode === 'ARMED' && state.armedDim === mind.dimIndex) {
      councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: mind.dimIndex } });
    } else if (state.mode === 'ARMED') {
      councilLedger.append({ v: 1, kind: 'EVENT', event: 'FIRE', ts: Date.now(), subject: { kind: 'pair', dims: [state.armedDim, mind.dimIndex] } });
    } else {
      councilLedger.append({ v: 1, kind: 'EVENT', event: 'ARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: mind.dimIndex } });
    }
    dispatch({ type: 'NODE_CLICK', dimIndex: mind.dimIndex });
  }, []);

  const disarm = useCallback(() => {
    if (uiRef.current.mode !== 'ARMED') return;
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: uiRef.current.armedDim } });
    dispatch({ type: 'DISARM' });
  }, []);

  const reset = useCallback(() => {
    councilLedger.append({ v: 1, kind: 'EVENT', event: 'RESET', ts: Date.now(), subject: null });
    dispatch({ type: 'RESET' });
    setLastCollision(null);
    setActivePairIds([]);
  }, []);

  // ARMED timeout → auto-disarm
  useEffect(() => {
    clearTimeout(armedTimerRef.current);
    if (ui.mode === 'ARMED') {
      armedTimerRef.current = setTimeout(() => {
        councilLedger.append({ v: 1, kind: 'EVENT', event: 'DISARM', ts: Date.now(), subject: { kind: 'mind', dimIndex: uiRef.current.armedDim } });
        dispatch({ type: 'TIMEOUT' });
      }, ARMED_TIMEOUT_MS);
    }
    return () => clearTimeout(armedTimerRef.current);
  }, [ui.mode, ui.armedDim]);

  // When the reducer enters FIRING, stage the user pair for the RAF loop.
  useEffect(() => {
    if (ui.mode === 'FIRING' && ui.pair) {
      const [dA, dB] = ui.pair;
      simRef.current.userPair = [
        seated.findIndex(m => m.dimIndex === dA),
        seated.findIndex(m => m.dimIndex === dB),
      ];
    }
  }, [ui.mode, ui.pair, seated]);

  // Gate: enabled flag, prefers-reduced-motion, viewport visibility.
  useEffect(() => {
    if (!enabled) { setRunning(false); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) { setRunning(false); return; }
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting));
    io.observe(canvas);
    return () => io.disconnect();
  }, [enabled]);

  // ── The RAF loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let scale = 1;

    const resize = () => {
      // Guard the zero-size edge (display:none ancestor): a 0-width canvas
      // yields scale=0 and silently draws everything at a point.
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      scale = canvas.width / VIEW_W;
      ctx.fillStyle = '#04040a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const jitter = (seed, ordinal) => {
      let h = Math.imul(seed + ordinal * 97, 2654435761) >>> 0;
      return (h % 1000) / 1000;
    };

    const spawnStreams = (ia, ib, streamN, now) => {
      const sim = simRef.current;
      sim.pair = [ia, ib];
      sim.phase = 'INFALL';
      sim.t0 = now;
      sim.particles = [];
      [ia, ib].forEach((seatIdx, s) => {
        const mind = seated[seatIdx];
        for (let i = 0; i < streamN; i++) {
          sim.particles.push({
            angle: mind.angle,
            hue: mind.hue,
            delay: jitter(s * streamN + i, sim.ordinal) * 900,
            wobble: (jitter(s * streamN + i + 500, sim.ordinal) - 0.5) * 14,
          });
        }
      });
      setActivePairIds([seated[ia].dimIndex, seated[ib].dimIndex]);
    };

    const startAmbientCycle = (now) => {
      const sim = simRef.current;
      const [ia, ib] = pickPair(sim.ordinal, null);
      sim.isUser = false;
      spawnStreams(ia, ib, STREAM_N_AMBIENT, now);
    };

    const startUserCycle = (now) => {
      const sim = simRef.current;
      const [ia, ib] = sim.userPair;
      sim.userPair = null;
      sim.isUser = true;
      spawnStreams(ia, ib, STREAM_N_USER, now);
    };

    const runCollision = (now) => {
      const sim = simRef.current;
      const [ia, ib] = sim.pair;
      const result = collide(expanded[ia], expanded[ib]);
      const mindA = seated[ia], mindB = seated[ib];
      const line = composeLine(mindA, mindB, result, sim.ordinal);
      const domSeat = seated.findIndex(m => m.dimIndex === result.dominantDim);
      sim.product = {
        angle: seated[domSeat].angle,
        targetR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING + 28,
        boundaryR: result.trajectory === 'FOUNDATION' ? R_FOUNDATION : R_CEILING,
        color: result.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA',
      };
      sim.collideResult = result;
      sim.phase = 'FLASH';
      sim.t0 = now;
      setLastCollision({ line, trajectory: result.trajectory });
      councilBus.emit({
        type: 'COUNCIL_COLLISION',
        pair: [mindA.dimIndex, mindB.dimIndex],
        cosine: result.cosine, trajectory: result.trajectory,
        dominantDim: result.dominantDim, energies: result.energies,
        line, ordinal: sim.ordinal, ts: Date.now(),
        source: sim.isUser ? 'user' : 'ambient',
      });
    };

    // Animation gate (spec §1): synthesis computes ONLY after EJECT completes.
    const completeUserSynthesis = () => {
      // Mirror the reducer's SYNTHESIS_READY guard: if the user RESET (or
      // otherwise left FIRING) mid-flight, the synthesis must not be recorded —
      // a SYNTHESIS appended after RESET would win the ledger walk-back and
      // resurrect the panel the user explicitly cleared (SKS §3).
      if (uiRef.current.mode !== 'FIRING') return;
      const sim = simRef.current;
      const [ia, ib] = sim.pair;
      const entryA = mindEntry(seated[ia]);
      const entryB = mindEntry(seated[ib]);
      const record = synthesize(entryA, entryB, sim.collideResult, sim.ordinal);
      councilLedger.append(record);
      councilBus.emit({ type: 'COUNCIL_SYNTHESIS', recordId: record.id, ordinal: sim.ordinal, ts: record.ts });
      dispatch({ type: 'SYNTHESIS_READY', record });
    };

    const dot = (x, y, r, color) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const draw = (now) => {
      const sim = simRef.current;
      const mode = uiRef.current.mode;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(4, 4, 10, 0.16)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -VIEW_X0 * scale, 0);

      const t = now - sim.t0;

      if (sim.phase === 'IDLE') {
        if (mode === 'FIRING' && sim.userPair) {
          startUserCycle(now);
        } else if (mode === 'AMBIENT') {
          startAmbientCycle(now);
        }
        // ARMED / SYNTHESIZED without a staged pair: canvas idles (trails fade)
      } else if (sim.phase === 'INFALL') {
        // A user arming mid-ambient-flight lets the ambient cycle finish visually,
        // but if FIRING was requested, the staged user pair takes over at IDLE.
        let allDone = true;
        for (const p of sim.particles) {
          const prog = Math.min(1, Math.max(0, (t - p.delay) / T_INFALL));
          if (prog < 1) allDone = false;
          if (prog <= 0) continue;
          const r = R_SEAT * (1 - easeInCubic(prog));
          const theta = p.angle + p.wobble * prog
            + (SPIRAL_GAIN * 180 / Math.PI) * (1 - r / R_SEAT);
          const { x, y } = polarToXY(theta, r, CX, CY);
          dot(x, y, sim.isUser ? 2.6 : 2.2, p.hue);
        }
        if (allDone) runCollision(now);
      } else if (sim.phase === 'FLASH') {
        const prog = Math.min(1, t / T_FLASH);
        const flashR = CORE_R + (sim.isUser ? 38 : 26) * prog;
        dot(CX, CY, flashR, `rgba(255, 215, 0, ${(sim.isUser ? 0.95 : 0.85) * (1 - prog)})`);
        if (prog >= 1) { sim.phase = 'EJECT'; sim.t0 = now; }
      } else if (sim.phase === 'EJECT') {
        const prog = Math.min(1, t / T_EJECT);
        const r = sim.product.targetR * easeOutCubic(prog);
        const { x, y } = polarToXY(sim.product.angle, r, CX, CY);
        dot(x, y, sim.isUser ? 4.5 : 3.5, sim.product.color);
        if (r >= sim.product.boundaryR - 2) {
          ctx.beginPath();
          ctx.arc(CX, CY, sim.product.boundaryR, 0, Math.PI * 2);
          ctx.strokeStyle = sim.product.color;
          ctx.globalAlpha = 0.5 * (1 - prog);
          ctx.lineWidth = sim.isUser ? 3 : 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (prog >= 1) {
          if (sim.isUser) completeUserSynthesis(); // ← animation gate opens here
          sim.ordinal += 1;
          sim.phase = 'COOLDOWN';
          sim.t0 = now;
        }
      } else if (sim.phase === 'COOLDOWN') {
        // A staged user pair skips the dead cooldown — the second click should
        // feel instant (spec §1); ambient-to-ambient keeps the full breather.
        if (t >= T_COOLDOWN || (mode === 'FIRING' && sim.userPair)) sim.phase = 'IDLE';
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    // simRef holds a stable object (mutated, never reassigned) — capturing it
    // satisfies react-hooks/exhaustive-deps for the cleanup without behavior change.
    const sim = simRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      sim.phase = 'IDLE';
      sim.particles = [];
    };
    // seated/expanded MUST be referentially stable across renders (CouncilRing
    // memoizes seated with [] deps — load-bearing). If that memo breaks, this
    // effect tears down and restarts every render and the sim never advances.
  }, [running, seated, expanded]);

  const armedMind = ui.armedDim != null ? mindByDim(ui.armedDim) : null;
  const pairMinds = ui.pair ? ui.pair.map(d => (d != null ? mindByDim(d) : null)) : null;

  return {
    canvasRef,
    mode: ui.mode,
    armedMind,
    pairMinds,
    synthesisRecord: ui.record,
    activePairIds,
    lastCollision,
    onNodeClick,
    disarm,
    reset,
  };
}
