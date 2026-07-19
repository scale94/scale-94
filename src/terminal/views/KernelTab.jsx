import React, { useState, useRef, useCallback, useEffect, useReducer } from 'react';
import { createPortal } from 'react-dom';
import { Database, GitBranch, Cpu } from 'lucide-react';
import { getSpine, subscribeSpine, missingVertebrae } from '../quintessence/spineStore';
import { subscribe as subscribeBus } from '../../observatory/observatoryBus';
import { loadSealedArtifact, clearSealedArtifact } from '../quintessence/sealedArtifact';
import MercuryTerminator from '../components/MercuryTerminator';
import MercuryTapToast from '../components/MercuryTapToast';
import { useSevenTaps } from '../components/useSevenTaps';
import { unlockMercuryKernel } from '../mercury/mercuryKernelUnlock';
import { useCompileFrontier } from '../components/useCompileFrontier';
import { legendLine } from '../components/frontier';

// ── Mini rotating sphere hero canvas ────────────────────────────────────────
function useMiniSphere(canvasRef, fireRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 180, H = 180;
    const cx = W / 2, cy = H / 2, R = 65;
    const colors = ['#39ff14', '#06b6d4', '#d946ef'];
    const dots = Array.from({ length: 12 }, (_, i) => {
      const phi = Math.acos(1 - 2 * (i + 0.5) / 12);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      return { phi, theta, energy: 0 };
    });
    // Burst particles spawned on fire
    const particles = [];
    let raf, lastFireTs = 0;
    const draw = (t) => {
      ctx.clearRect(0, 0, W, H);
      const rot = t * 0.0008;

      // Check for fire trigger
      const fire = fireRef?.current;
      if (fire && fire.ts > lastFireTs) {
        lastFireTs = fire.ts;
        // Energize all dots in a staggered cascade
        dots.forEach((d, idx) => { d.energy = 1.0 - idx * 0.055; });
        // Spawn particles from each dot's projected position (like feigenbaum tab)
        dots.forEach((d, i) => {
          const sp = Math.sin(d.phi);
          const x3 = sp * Math.cos(d.theta + t * 0.0008);
          const z3 = sp * Math.sin(d.theta + t * 0.0008);
          const y3 = Math.cos(d.phi);
          const scale = 1 / (1.8 - z3 * 0.5);
          const sx = cx + x3 * R * scale;
          const sy = cy + y3 * R * scale;
          const col = colors[i % 3];
          const burst = z3 > -0.3 ? 6 : 2; // more from front-facing dots
          for (let p = 0; p < burst; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.6 + Math.random() * 2.2;
            particles.push({
              x: sx, y: sy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 0.7 + Math.random() * 0.3,
              maxLife: 0.7 + Math.random() * 0.3,
              size: 1.2 + Math.random() * 2.0,
              col,
            });
          }
        });
        // Cap pool to prevent runaway growth
        if (particles.length > 300) particles.splice(0, particles.length - 300);
      }

      // Wireframe ring — glow stronger when any dot has energy
      const maxEnergy = Math.max(0, ...dots.map(d => d.energy));
      const ringAlpha = 0.12 + maxEnergy * 0.25;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(6,182,212,${ringAlpha.toFixed(3)})`;
      ctx.lineWidth = 1 + maxEnergy * 1.5;
      ctx.stroke();
      // Equator ellipse
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.05) {
        const x = cx + R * Math.cos(a);
        const y = cy + R * 0.35 * Math.sin(a);
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(57,255,20,${(0.08 + maxEnergy * 0.12).toFixed(3)})`;
      ctx.stroke();
      // Burst particles drawn first — dots render on top so they're always visible
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 0.018;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        const lifeRatio = p.life / (p.maxLife ?? 1.0);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.size ?? 1.5) * lifeRatio, 0, Math.PI * 2);
        ctx.fillStyle = p.col;
        ctx.globalAlpha = lifeRatio * 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // Dots — halos first pass (atmosphere), then cores on top
      dots.forEach((d, i) => {
        const sp = Math.sin(d.phi);
        const x3 = sp * Math.cos(d.theta + rot);
        const z3 = sp * Math.sin(d.theta + rot);
        const y3 = Math.cos(d.phi);
        const scale = 1 / (1.8 - z3 * 0.5);
        const sx = cx + x3 * R * scale;
        const sy = cy + y3 * R * scale;
        const baseR = (2.5 + scale * 2) * (0.6 + z3 * 0.4);
        const r = baseR + d.energy * 3;
        const col = colors[i % 3];
        // Subtle halo — kept small so dot core stays distinct
        if (d.energy > 0.05) {
          const haloR = r + d.energy * 6;
          ctx.beginPath();
          ctx.arc(sx, sy, haloR, 0, Math.PI * 2);
          ctx.fillStyle = col;
          ctx.globalAlpha = d.energy * 0.12;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        // Dot core — always drawn last so it's never covered
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, r), 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.5 + z3 * 0.5 + d.energy * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        // Decay energy
        d.energy *= 0.96;
        if (d.energy < 0.01) d.energy = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, fireRef]);
}

// ── ATMOSPHERIC-ENTROPY climate simulation — fires on SOMA-5.5 ▶ press ──────
function runClimateSim(appendSystemLog) {
  const now   = () => new Date().toLocaleTimeString('en-US', { hour12: false });
  const rnd   = (min, max) => +(Math.random() * (max - min) + min).toFixed(2);
  const rndI  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const carbonPpm     = rnd(418, 458);
  const drag          = rnd(0.52, 0.97);
  const sink          = rnd(0.12, 0.74);
  const deltaT        = rnd(1.1, 4.2);
  const seaRise       = rnd(0.18, 1.12);
  const events        = rndI(4, 31);
  const fragIdx       = +((carbonPpm / 280 - 1) * drag / sink).toFixed(3);
  const critical      = fragIdx > 0.8;
  const statusLine    = critical
    ? `⚠  FRAGMENTATION INDEX: ${fragIdx}  →  STATECRAFT FAILURE // THERMODYNAMICS OVERRIDES`
    : `FRAGMENTATION INDEX: ${fragIdx}  →  within bounds (limit: 0.8)`;

  const lines = [
    '── ATMOSPHERIC-ENTROPY-KERNEL-3.0 // SOMA-5.5 RUNTIME ──',
    `   --carbon-ppm      ${carbonPpm} ppm  (Δ +${(carbonPpm - 280).toFixed(1)} from pre-industrial)`,
    `   --industrial-drag ${drag}  (economic inertia coefficient)`,
    `   --ocean-sink      ${sink}  (hydrosphere absorption capacity)`,
    `   --delta-T         +${deltaT}°C  |  sea-level +${seaRise}m  |  events: ${events}/yr`,
    `   ${statusLine}`,
    '────────────────────────────────────────────────────────',
  ];

  lines.forEach((msg, i) => {
    setTimeout(() => appendSystemLog({ time: now(), msg, rust: true }), i * 90);
  });
}

// ── Doctrine-tiered RAM color ─────────────────────────────────────────────────
// Mirrors the ECO message palette — healthy green degrades through gold,
// red-orange, and magenta as planetary standing collapses.
const ramColor = (pct) => {
  if (pct >= 70) return '#39ff14'; // neon green  — commons breathing
  if (pct >= 50) return '#88FF00'; // yellow-lime — mild strain
  if (pct >= 35) return '#FFD700'; // gold        — observer notices
  if (pct >= 20) return '#FF4400'; // red-orange  — cascade doctrine
  return '#FF0088';                // magenta     — floor signal
};

const KernelTab = ({ kernelAxioms = [], kernelBuilds = [], handleKernelClick, loadingKernel, visibleLogs = [], logRef, commandInput = '', onCommandInputChange, onCommandKeyDown, suggestions = [], activeSugg = -1, paramHint = '', onSelectSuggestion, ramPct = 0, isCritical = false, isWarning = false, appendSystemLog, mobileChrome = true, mobileAutoRun, bootDone = false, onNavigateToMercury }) => {
  // ── Mini sphere + sparkline canvas refs ───────────────────────────────────
  // Two sphere refs: one for the mobile canvas (below title), one for desktop
  const sphereCanvasMobileRef  = useRef(null); // mobile
  // sphereFireRef: write { ts: Date.now() } to trigger a burst on both spheres
  const sphereFireRef = useRef(null);
  useMiniSphere(sphereCanvasMobileRef, sphereFireRef);
  const { twilight, day, loaded, run, flare } = useCompileFrontier(kernelBuilds.length);

  // Desktop-exclusive (spec §9, non-goal "a mobile shader"): a CSS `hidden md:flex`
  // only display:none's the WebGL Mercury — React still mounts it and boots a webgl
  // context + rAF loop on the invisible canvas. Gate the *mount* on the md breakpoint
  // (768px), tracking resize so crossing the breakpoint mounts/unmounts it.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // ── Quintessence state (spec §5) — the reserved slot + tty0 monument ───────
  // The reliquary lives on Mercury now; the dashboard only reflects its state.
  // Deferred re-render: spine/bus events may fire during another component's
  // render (an emit inside a state updater) — a microtask keeps setState out of
  // that render phase, same discipline as ReliquaryView.
  const [, forceQuint] = useReducer(x => x + 1, 0);
  useEffect(() => subscribeSpine(() => queueMicrotask(forceQuint)), []);
  useEffect(() => subscribeBus(() => queueMicrotask(forceQuint)), []);
  const artifact = loadSealedArtifact();
  const spine    = getSpine();
  // Four vertebrae: trend · council · phase are witnessed on the journey and
  // gate the compile; element is the ceremonial fourth, forged at the altar.
  const vertebrae = [
    { key: 'trend',   filled: !!spine.trend },
    { key: 'council', filled: !!spine.council },
    { key: 'phase',   filled: !!spine.phase },
    { key: 'element', filled: !!spine.element },
  ];
  const missing = missingVertebrae();   // trend/council/phase only
  const armed   = missing.length === 0; // the altar will accept ignition
  const toMercury = () => { sphereFireRef.current = { ts: Date.now() }; onNavigateToMercury && onNavigateToMercury(); };
  // Developer-Options gesture: 7 taps on Mercury root the bypass (systemless);
  // a lone tap still navigates. Countdown + unlock toast render beside the planet.
  const mercuryTaps = useSevenTaps({
    onSingleTap: toMercury,
    onUnlock: () => { unlockMercuryKernel(); sphereFireRef.current = { ts: Date.now() }; },
  });
  // Fish Scale is the genome — the one pinned exhibition piece atop the panel.
  const fishScale = kernelBuilds.find(k => k.id === 'FISH-SCALE-11.1')
    || kernelBuilds.find(k => k.pinned)
    || { id: 'FISH-SCALE-11.1', articleId: 'FISH-SCALE-KERNEL11.1.1', name: 'FISH_SCALE_KERNEL11_1_1', desc: 'Entropic Stasis // Necromantic Engine' };
  // Lore kernels — the genome's chapters, pinned between it and the ∅ slot.
  const pinnedModules = [fishScale, ...kernelBuilds.filter(k => k.lore && k.id !== fishScale.id)];

  // Fire sphere on kernel-complete (loadingKernel → null transition)
  const prevKernelRef = useRef(null);
  // isSpinning stays true for one full rotation (0.9s) after loadingKernel clears,
  // so the branch icon completes its cycle and lands at 0° before the deceleration phase.
  const [isSpinning,     setIsSpinning]     = useState(false);
  const [isStopping,     setIsStopping]     = useState(false);
  const [isFading,       setIsFading]       = useState(false);
  const [firingKernelId, setFiringKernelId] = useState(null);
  const spinTimerRef   = useRef(null);
  const pendingStopRef = useRef(false);
  const lavaTimerRef   = useRef(null);
  const [breakingSeal, setBreakingSeal] = useState(false);
  useEffect(() => {
    if (loadingKernel) {
      clearTimeout(spinTimerRef.current);
      setIsStopping(false);
      setIsSpinning(true);
      pendingStopRef.current = false;
    } else if (prevKernelRef.current) {
      // Signal stop — consumed by onAnimationIteration so the icon lands at 0°
      pendingStopRef.current = true;
      sphereFireRef.current = { ts: Date.now() };
      // Safety fallback: 2 full spins max in case the iteration event misses
      spinTimerRef.current = setTimeout(() => {
        if (pendingStopRef.current) {
          pendingStopRef.current = false;
          setIsSpinning(false);
          setIsStopping(true);
        }
      }, 1800);
    }
    prevKernelRef.current = loadingKernel;
    return () => clearTimeout(spinTimerRef.current);
  }, [loadingKernel]);

  // ── Gesture-gated mobile keyboard ─────────────────────────────────────────
  // Activation: double-tap + long-tap on the tty0 header strip.
  // Double-tap window: 350ms. Long-press threshold: 500ms.
  const [mobileInputVisible, setMobileInputVisible] = useState(false);
  const mobileInputRef  = useRef(null);
  const lastTapTimeRef  = useRef(0);
  const tapCountRef     = useRef(0);
  const longPressRef    = useRef(null);

  // Portal the fixed terminal to body on mobile to bypass ancestor transform containing blocks.
  // On desktop (md:) the element uses relative positioning so no portal needed.
  const ttyPortalTarget = useRef(
    typeof window !== 'undefined' && window.innerWidth < 768 ? document.body : null
  );

  // ── tty0 mobile expand ────────────────────────────────────────────────────
  // On mobile, tap the [LOGS] button to expand the tty0 panel to 60vh.
  // Auto-expands briefly when a kernel run completes (loadingKernel → null).
  const [mobileLogExpanded, setMobileLogExpanded] = useState(false);

  // Auto-expand tty0 on mobile when a kernel run completes
  const prevLoadingRef = useRef(null);
  useEffect(() => {
    if (prevLoadingRef.current && !loadingKernel) {
      // Kernel just finished — pop open the log panel for 5 s
      setMobileLogExpanded(true);
      const t = setTimeout(() => setMobileLogExpanded(false), 5000);
      return () => clearTimeout(t);
    }
    prevLoadingRef.current = loadingKernel;
  }, [loadingKernel]);

  // ── tty0 idle fade ─────────────────────────────────────────────────────────
  // Fades to opacity-20 after 4s of no touch on the tty0 panel.
  // Any touch on the tty0 wakes it back to full opacity.
  const [ttyFaded, setTtyFaded] = useState(false);
  const ttyFadeTimerRef = useRef(null);
  const resetTtyFade = useCallback(() => {
    setTtyFaded(false);
    if (ttyFadeTimerRef.current) clearTimeout(ttyFadeTimerRef.current);
    ttyFadeTimerRef.current = setTimeout(() => setTtyFaded(true), 4000);
  }, []);
  useEffect(() => {
    ttyFadeTimerRef.current = setTimeout(() => setTtyFaded(true), 4000);
    return () => clearTimeout(ttyFadeTimerRef.current);
  }, []);

  useEffect(() => {
    if (mobileInputVisible && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [mobileInputVisible]);

  const handleTtyHeaderTouchStart = useCallback(() => {
    const now = Date.now();
    tapCountRef.current = (now - lastTapTimeRef.current < 350)
      ? tapCountRef.current + 1
      : 1;
    lastTapTimeRef.current = now;

    if (tapCountRef.current >= 2) {
      longPressRef.current = setTimeout(() => {
        setMobileInputVisible(true);
        tapCountRef.current = 0;
      }, 500);
    }
  }, []);

  const handleTtyHeaderTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  return (
  <div className="tab-fade-v2 relative md:flex md:flex-col md:h-[calc(100dvh-200px)] md:min-h-[540px]">

    <style>{`
      @keyframes sk-kernelTextReveal {
        0% {
          opacity: 0;
          transform: scale(0.95) translateY(-5px);
          text-shadow: 0 0 40px #39ff14, 0 0 80px rgba(57, 255, 20, 0.5);
        }
        50% {
          opacity: 1;
          transform: scale(1) translateY(0);
          text-shadow: 0 0 20px rgba(57, 255, 20, 0.7), 0 0 40px rgba(57, 255, 20, 0.3);
        }
        100% {
          opacity: 1;
          transform: scale(1) translateY(0);
          text-shadow: none;
        }
      }
      @keyframes sk-kernelIconReveal {
        0% { opacity: 0; transform: rotate(-45deg) scale(0.5); filter: drop-shadow(0 0 6px #39ff14); }
        100% { opacity: 1; transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 8px rgba(57, 255, 20, 0.6)); }
      }
      @keyframes sk-cpuYellowReveal {
        0% { opacity: 0; transform: rotate(-45deg) scale(0.5); filter: drop-shadow(0 0 6px #FFD700); }
        100% { opacity: 1; transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 8px rgba(255,215,0,0.7)); }
      }
      @keyframes sk-cpuYellowGlow {
        0%,100% { filter: drop-shadow(0 0 4px rgba(255,215,0,0.6)); }
        50%      { filter: drop-shadow(0 0 14px rgba(255,215,0,1)) drop-shadow(0 0 28px rgba(255,140,0,0.5)); }
      }
      @keyframes sk-kernelShimmer {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes sk-moduleNameShimmer {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes sk-subReveal {
        from { opacity: 0; transform: translateY(-6px); filter: blur(8px); }
        to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
      }
      @keyframes sk-tagReveal {
        0%   { opacity: 0; transform: scale(0.85); filter: blur(4px); }
        100% { opacity: 1; transform: scale(1);    filter: blur(0); }
      }
      @keyframes sk-activeModulesReveal {
        0%   { opacity: 0; filter: brightness(4) blur(6px); letter-spacing: 0.4em; }
        30%  { opacity: 1; filter: brightness(2.5) blur(1px); letter-spacing: 0.15em; }
        60%  { opacity: 0.7; filter: brightness(3) blur(0px); letter-spacing: 0.05em; }
        80%  { opacity: 1; filter: brightness(1.6) blur(0px); letter-spacing: 0.02em; }
        100% { opacity: 1; filter: brightness(1) blur(0px); letter-spacing: normal; }
      }
      @keyframes sk-treeReveal {
        0%   { opacity: 0; transform: rotate(0deg)   scale(0.5); filter: drop-shadow(0 0 8px rgba(6,182,212,0.9)); }
        100% { opacity: 1; transform: rotate(720deg) scale(1);   filter: drop-shadow(0 0 4px rgba(6,182,212,0.4)); }
      }
      @keyframes sk-treeGlow {
        0%, 100% { filter: drop-shadow(0 0 3px rgba(6,182,212,0.4)); }
        50%       { filter: drop-shadow(0 0 10px rgba(6,182,212,1)) drop-shadow(0 0 20px rgba(6,182,212,0.35)); }
      }
      @keyframes sk-branchSpin {
        0%   { transform: rotate(0deg);   filter: drop-shadow(0 0 6px rgba(6,182,212,0.9)); }
        100% { transform: rotate(360deg); filter: drop-shadow(0 0 12px rgba(6,182,212,1)) drop-shadow(0 0 24px rgba(6,182,212,0.4)); }
      }
      @keyframes sk-branchSpinStop {
        0%   { transform: rotate(0deg)   scale(1); filter: drop-shadow(0 0 12px rgba(6,182,212,1)) drop-shadow(0 0 24px rgba(6,182,212,0.4)); }
        100% { transform: rotate(720deg) scale(1); filter: drop-shadow(0 0 4px rgba(6,182,212,0.4)); }
      }
      @keyframes sk-branchClickFade {
        0%   { opacity: 1;    filter: drop-shadow(0 0 4px rgba(6,182,212,0.5)); }
        35%  { opacity: 0.04; filter: drop-shadow(0 0 0px rgba(6,182,212,0));   }
        100% { opacity: 1;    filter: drop-shadow(0 0 8px rgba(6,182,212,0.8)); }
      }
      @keyframes sk-axiomBreath {
        0%, 100% { box-shadow: 0 0 6px rgba(57,255,20,0.06), inset 0 0 20px rgba(0,0,0,0.4); }
        50%       { box-shadow: 0 0 18px rgba(57,255,20,0.12), inset 0 0 20px rgba(0,0,0,0.4); }
      }
      @keyframes sk-axiomIconPulse {
        0%, 100% { filter: drop-shadow(0 0 4px rgba(255,185,0,0.6)); }
        50%       { filter: drop-shadow(0 0 14px rgba(255,185,0,1)) drop-shadow(0 0 28px rgba(255,185,0,0.5)) drop-shadow(0 0 48px rgba(255,185,0,0.2)); }
      }
      @keyframes sk-axiomHeadReveal {
        0%   { opacity: 0; transform: translateY(-10px); filter: blur(16px); letter-spacing: 0.3em; }
        100% { opacity: 1; transform: translateY(0);    filter: blur(0);    letter-spacing: inherit; }
      }
      @keyframes sk-descReveal {
        0%   { opacity: 0; transform: translateY(6px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes sk-axiomNumGlow {
        0%, 100% { text-shadow: 0 0 8px rgba(139,92,246,0.7), 0 0 16px rgba(217,70,239,0.25); }
        50%       { text-shadow: 0 0 18px rgba(139,92,246,1), 0 0 36px rgba(217,70,239,0.7), 0 0 56px rgba(168,85,247,0.25); }
      }
      @keyframes sk-ttyPulse {
        0%, 100% { border-color: rgba(6,182,212,0.18); }
        50%       { border-color: rgba(6,182,212,0.4); }
      }
      @keyframes sk-ttyPulseWarn {
        0%, 100% { border-color: rgba(255,215,0,0.18); }
        50%       { border-color: rgba(255,215,0,0.48); }
      }
      @keyframes sk-ttyPulseCrit {
        0%, 100% { border-color: rgba(255,0,136,0.22); }
        50%       { border-color: rgba(255,0,136,0.58); }
      }
      @keyframes eco-log-in {
        0%   { opacity: 0; transform: translateX(-6px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes sk-logSlideUp {
        from { transform: translateY(100%); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }
      @keyframes sk-runLava {
        0%   { color: #8B5CF6; border-color: rgba(139,92,246,0.55);
               box-shadow: 0 0 6px rgba(139,92,246,0.25);
               text-shadow: 0 0 4px rgba(139,92,246,0.5); }
        15%  { color: #ffffff; border-color: rgba(255,255,255,0.95);
               box-shadow: 0 0 24px rgba(255,255,255,0.8), 0 0 10px rgba(200,180,255,0.6), inset 0 0 8px rgba(180,130,255,0.2);
               text-shadow: 0 0 16px rgba(255,255,255,1), 0 0 32px rgba(200,160,255,0.8); }
        50%  { color: #f87171; border-color: rgba(220,38,38,0.85);
               box-shadow: 0 0 28px rgba(185,28,28,0.65), inset 0 0 12px rgba(185,28,28,0.18);
               text-shadow: 0 0 10px rgba(220,38,38,0.95); }
        75%  { color: #fb923c; border-color: rgba(249,115,22,0.55);
               box-shadow: 0 0 10px rgba(249,115,22,0.3);
               text-shadow: 0 0 6px rgba(249,115,22,0.5); }
        100% { color: #8B5CF6; border-color: rgba(139,92,246,0.55);
               box-shadow: 0 0 6px rgba(139,92,246,0.25);
               text-shadow: 0 0 4px rgba(139,92,246,0.5); }
      }
      @keyframes sk-kernelGlow {
        0%, 100% { text-shadow: 0 0 8px rgba(255,215,0,0.2), 0 0 20px rgba(255,140,0,0); }
        50%      { text-shadow: 0 0 14px rgba(255,215,0,0.5), 0 0 36px rgba(255,140,0,0.25), 0 0 56px rgba(217,70,239,0.12); }
      }
      @keyframes sk-ttyTitleReveal {
        0%   { opacity: 0; letter-spacing: 0.4em; filter: blur(12px) brightness(3); }
        25%  { opacity: 1; filter: brightness(2.8) blur(2px); letter-spacing: 0.2em; }
        55%  { opacity: 0.65; filter: brightness(3.2) blur(0px); letter-spacing: 0.06em; }
        78%  { opacity: 1; filter: brightness(1.5) blur(0px); letter-spacing: 0.02em; }
        100% { opacity: 1; filter: brightness(1) blur(0px); letter-spacing: normal; }
      }
      @keyframes sk-ttyRainbow {
        0%   { background-position: 0% center; }
        100% { background-position: 400% center; }
      }
      @keyframes sk-ttyRainbowGlow {
        0%   { text-shadow: 0 0 8px rgba(255,0,128,0.8),   0 0 20px rgba(255,0,128,0.4); }
        17%  { text-shadow: 0 0 8px rgba(255,140,0,0.8),   0 0 20px rgba(255,140,0,0.4); }
        33%  { text-shadow: 0 0 8px rgba(57,255,20,0.8),   0 0 20px rgba(57,255,20,0.4); }
        50%  { text-shadow: 0 0 8px rgba(6,182,212,0.8),   0 0 20px rgba(6,182,212,0.4); }
        67%  { text-shadow: 0 0 8px rgba(139,92,246,0.8),  0 0 20px rgba(139,92,246,0.4); }
        83%  { text-shadow: 0 0 8px rgba(217,70,239,0.8),  0 0 20px rgba(217,70,239,0.4); }
        100% { text-shadow: 0 0 8px rgba(255,0,128,0.8),   0 0 20px rgba(255,0,128,0.4); }
      }
      @keyframes sk-loadFlash {
        0%   { background-color: rgba(6,182,212,0); box-shadow: none; }
        15%  { background-color: rgba(6,182,212,0.15); box-shadow: inset 0 0 30px rgba(6,182,212,0.12), 0 0 12px rgba(6,182,212,0.3); }
        100% { background-color: rgba(6,182,212,0); box-shadow: none; }
      }
      @keyframes sk-kernelLoading {
        0%, 100% { box-shadow: 0 0 0 1px rgba(6,182,212,0.1),  inset 0 0 12px rgba(6,182,212,0.03); }
        50%      { box-shadow: 0 0 0 1px rgba(6,182,212,0.38), inset 0 0 22px rgba(6,182,212,0.09), 0 0 18px rgba(6,182,212,0.09); }
      }
      .axiom-item:hover { box-shadow: inset 3px 0 0 #39ff14, inset 0 0 24px rgba(57,255,20,0.04); }
      /* ── Quintessence · the reserved slot + tty0 monument (fade-doctrine) ──
         Two-gold monochrome: #e8d28a body · #d4a82a emphasis. No pure white,
         no spin, no color cycle — only a slow breath and a fade-in. */
      @keyframes sk-quintBreath {
        0%, 100% { box-shadow: inset 0 0 0 rgba(212,168,42,0); }
        50%       { box-shadow: inset 0 0 18px rgba(212,168,42,0.05); }
      }
      @keyframes sk-quintArmed {
        0%, 100% { box-shadow: 0 0 4px rgba(212,168,42,0.15); border-color: rgba(251,191,36,0.55); }
        50%       { box-shadow: 0 0 14px rgba(212,168,42,0.4);  border-color: rgba(251,191,36,0.9); }
      }
      @keyframes sk-quintReveal { from { opacity: 0; } to { opacity: 1; } }
      .sk-quint-monument { animation: sk-quintReveal 0.9s ease-out both; }
      .sk-quint-marker {
        font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
        font-size: 9px; color: #d4a82a; letter-spacing: 0.35em; text-transform: uppercase;
      }
      .sk-quint-thesis {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-weight: 900; line-height: 1.0; letter-spacing: -0.02em;
        font-size: clamp(15px, 1.6vw, 21px); color: #e8d28a;
      }
      .sk-quint-thesis--emph { color: #d4a82a; }
      .sk-quint-accent { height: 2px; width: 64px; background: #d4a82a; border: 0; }
      /* Mobile tty0: hidden scrollbar */
      @media (max-width: 767px) {
        .sk-tty0-logs { scrollbar-width: none; }
        .sk-tty0-logs::-webkit-scrollbar { display: none; }
      }
    `}</style>

    {/* ── system_kernel header — shrink-0 so it never flexes away ─────────── */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-cyan-900/50 pb-3 mb-4 shrink-0">

      <div>
        <h2 className="text-4xl font-bold mb-3 tracking-tight flex items-center gap-3">
          <Cpu
            className="w-8 h-8 shrink-0"
            style={{ color: '#FFD700', animation: 'sk-cpuYellowReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards, sk-cpuYellowGlow 2.5s ease-in-out 0.8s infinite' }}
          />
          <span
            className="text-transparent bg-clip-text text-2xl md:text-4xl"
            style={{
              backgroundImage: 'linear-gradient(90deg, #FF8C00, #FFD700, #FFFF00, #d946ef, #FFD700, #FF8C00)',
              backgroundSize: '400% auto',
              animation: 'sk-ttyTitleReveal 1s cubic-bezier(0.7,0,0.3,1) forwards, sk-kernelShimmer 3.5s cubic-bezier(0.7,0,0.3,1) 1s infinite, sk-kernelGlow 5s ease-in-out 1.2s infinite',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >system_kernel</span>
        </h2>
        {/* Axiomatic law Ⅰ — the project's load-bearing claim, elevated from a
         * cramped tty0 banner to the terminal's defining statement (two-gold,
         * fade-doctrine). Permanent: it holds whether or not a kernel exists. */}
        <div style={{ opacity: 0, animation: 'sk-subReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards' }}>
          <div className="sk-quint-marker mb-1.5">ᛟ axiomatic law Ⅰ</div>
          <div className="sk-quint-thesis">
            THEORY THAT CANNOT BE COMPILED<br />
            <span className="sk-quint-thesis--emph">DOES NOT YET EXIST AS KNOWLEDGE</span>
          </div>
        </div>
        {/* Mobile Mercury — same compile-frontier state and tap gesture as
         * desktop's sphere, mounted only below the md breakpoint so exactly
         * one WebGL context ever exists. */}
        {!isDesktop && (
          <div className="relative mt-3" style={{ width: 120 }}>
            <MercuryTerminator
              twilight={twilight}
              day={day}
              flare={flare}
              size={120}
              onClick={mercuryTaps.onTap}
              title="☿ mercury — the compile frontier"
              ariaLabel="Mercury — the compile frontier; tap to open Mercury, 7 taps for hidden bypass"
            />
            <MercuryTapToast toast={mercuryTaps.toast} onDone={mercuryTaps.clearToast} />
          </div>
        )}
      </div>
      {/* Desktop: Mercury — the compile frontier — over its living legend line */}
      <div className="hidden md:flex flex-col items-end gap-2 shrink-0 relative">
        {isDesktop && (
          <MercuryTerminator
            twilight={twilight}
            day={day}
            flare={flare}
            size={180}
            onClick={mercuryTaps.onTap}
            title="☿ mercury — the compile frontier"
            ariaLabel="Mercury — the compile frontier; click to open Mercury"
          />
        )}
        <MercuryTapToast toast={mercuryTaps.toast} onDone={mercuryTaps.clearToast} />
        <div className="font-mono text-[10px] tracking-[0.15em] text-right select-none"
             style={{ color: 'rgba(232,210,138,0.55)' }}>
          {legendLine({ loaded, run })}
        </div>
      </div>
    </div>

    {/*
     * ── Triangle topology ─────────────────────────────────────────────────────
     *
     *   ┌─────────────────┬─────────────────┐
     *   │  axiomatic_core │  active_modules  │  ← flex-[6] (~65% height)
     *   └────────┬────────┴────────┬─────────┘
     *            │   /dev/tty0     │            ← flex-[4] (~35%), centered
     *            └─────────────────┘
     *
     * flex-col fills the remaining height. Top row and bottom terminal take
     * flex shares (6:4) so neither overflows and no external scroll is needed.
     * Only active_modules scrolls its kernel list internally.
     */}
    <div className="flex flex-col gap-4 md:flex-1 md:min-h-0 pb-[35vh] md:pb-0">

      {/* ── Top row: axiomatic_core | active_modules ─── */}
      <div id="kernel-container" className="flex flex-col md:grid md:grid-cols-2 gap-4 md:flex-[6] md:min-h-0">

        {/* axiomatic_core */}
        <div
          className="hidden md:flex border border-cyan-900/50 p-5 bg-black/50 backdrop-blur-sm relative hover:border-cyan-500/50 transition-colors duration-500 rounded-lg flex-col min-h-0 overflow-hidden"
          style={{ animation: 'sk-axiomBreath 5s ease-in-out infinite' }}
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 shrink-0">
            <Database
              className="w-4 h-4"
              style={{ color: '#FFB900', animation: 'sk-kernelIconReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards, sk-axiomIconPulse 5s ease-in-out 0.8s infinite' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #8B5CF6, #D946EF, #A855F7, #8B5CF6)',
                backgroundSize: '300% auto',
                opacity: 0,
                animation: 'sk-axiomHeadReveal 1s cubic-bezier(0.16,1,0.3,1) 0.2s forwards, sk-kernelShimmer 4s ease-in-out 1.2s infinite',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >axiomatic_core</span>
          </h3>
          <div className="space-y-3 overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0">
            {kernelAxioms.map((axiom, idx) => (
              <div
                key={idx}
                className="axiom-item group/item p-2 -mx-2 transition-all duration-200 rounded-sm border-l-2 border-transparent cursor-default min-w-0"
                style={{ opacity: 0, animation: `sk-subReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${0.1 + idx * 0.08}s forwards` }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="font-mono font-black text-transparent bg-clip-text text-xl shrink-0 tabular-nums leading-none"
                      style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6, #D946EF)', animation: `sk-axiomNumGlow 3.5s ease-in-out ${idx * 0.4}s infinite` }}
                    >
                      0{idx + 1}
                    </span>
                    <span className="text-cyan-800 font-mono text-xs font-bold leading-none shrink-0">::</span>
                    <span className="font-black text-sm tracking-tight truncate leading-tight text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #38bdf8, #a78bfa)' }}>
                      {axiom.name?.toLowerCase() || 'unknown'}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-bold tracking-widest bg-cyan-900/30 text-cyan-200 px-2 py-0.5 rounded-full shrink-0"
                    style={{ opacity: 0, animation: `sk-tagReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${0.3 + idx * 0.08}s forwards` }}
                  >{axiom.field || 'SYS'}</span>
                </div>
                <p
                  className="axiom-desc text-xs leading-relaxed break-words pl-8 text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6, #D946EF, #A855F7)', opacity: 0, animation: `sk-descReveal 0.6s cubic-bezier(0.16,1,0.3,1) ${0.4 + idx * 0.12}s forwards` }}
                >{axiom.desc || 'Axiom details unresolvable.'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* active_modules */}
        <div className="border border-cyan-900/50 p-5 bg-black/50 backdrop-blur-sm hover:border-cyan-500/50 transition-colors rounded-lg flex flex-col md:min-h-0 md:overflow-hidden">
          <h3 className="text-base font-bold mb-4 flex items-center gap-2 shrink-0">
            <GitBranch
              className="w-4 h-4 shrink-0 text-[#06b6d4]"
              onAnimationIteration={(e) => {
                if (e.animationName === 'sk-branchSpin' && pendingStopRef.current) {
                  pendingStopRef.current = false;
                  clearTimeout(spinTimerRef.current);
                  setIsSpinning(false);
                  setIsStopping(true);
                }
              }}
              onAnimationEnd={(e) => {
                if (e.animationName === 'sk-branchSpinStop') setIsStopping(false);
                if (e.animationName === 'sk-branchClickFade') setIsFading(false);
              }}
              style={{ animation: isSpinning
                ? 'sk-branchSpin 0.9s linear infinite'
                : isStopping
                ? 'sk-branchSpinStop 1.5s cubic-bezier(0.2, 0, 0.3, 1) forwards'
                : isFading
                ? 'sk-branchClickFade 0.35s ease-out'
                : 'sk-treeReveal 1.5s cubic-bezier(0.2, 0, 0.3, 1) forwards, sk-treeGlow 2.5s ease-in-out 1.5s infinite' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #06b6d4, #d946ef, #39ff14)',
                backgroundSize: '200% auto',
                animation: 'sk-activeModulesReveal 0.9s cubic-bezier(0.16,1,0.3,1) forwards, sk-kernelShimmer 3s ease-in-out 0.9s infinite',
              }}
            >active_modules</span>
          </h3>
          <ul className="space-y-3 text-sm font-mono text-[#39ff14] md:overflow-y-auto custom-scrollbar pr-2 md:flex-1 md:min-h-0">
            {/* ── Pinned exhibition pieces — the genome + its lore chapters ── */}
            {pinnedModules.map((mod) => {
              const isLoading = loadingKernel === mod.id;
              return (
                <li
                  key={mod.id}
                  onClick={() => {
                    setIsFading(true);
                    sphereFireRef.current = { ts: Date.now() };
                    handleKernelClick && handleKernelClick(mod);
                    if (mobileAutoRun && window.matchMedia('(max-width: 767px)').matches) {
                      setTimeout(() => mobileAutoRun(mod.id), 900);
                    }
                  }}
                  className={`flex flex-wrap justify-between items-center gap-y-2 border-b border-l-2 pb-3 mb-1 cursor-pointer p-2 pl-3 rounded transition-all group gap-2
                    ${isLoading ? 'border-cyan-400/60 border-l-cyan-400/60 backdrop-blur-sm' : 'border-cyan-900/20 border-l-transparent hover:border-l-cyan-500/40 hover:bg-cyan-900/10'}`}
                  style={{ animation: isLoading
                    ? 'sk-loadFlash 1.2s cubic-bezier(0.16,1,0.3,1) forwards, sk-kernelModuleIn 0.22s ease-out both, sk-kernelLoading 2s ease-in-out 1.2s infinite'
                    : 'sk-kernelModuleIn 0.22s ease-out both' }}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div
                      className="font-bold text-sm mb-0.5 truncate text-transparent bg-clip-text"
                      style={{
                        backgroundImage: isLoading
                          ? 'linear-gradient(90deg, #06b6d4, #00FFAA, #39ff14, #06b6d4, #00FFAA, #06b6d4)'
                          : 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef, #ef4444, #38bdf8, #39ff14)',
                        backgroundSize: '300% auto',
                        animation: isLoading
                          ? 'sk-moduleNameShimmer 1.1s linear infinite'
                          : 'sk-moduleNameShimmer 3.5s ease-in-out infinite',
                      }}
                    >{mod.name}</div>
                    <div className="text-xs text-[#39ff14] font-bold tracking-wide truncate opacity-70">
                      {isLoading ? 'initializing...' : mod.desc}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <div
                      onClick={(e) => { e.stopPropagation(); setIsFading(true); sphereFireRef.current = { ts: Date.now() }; handleKernelClick && handleKernelClick(mod); }}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer ${isLoading ? 'bg-cyan-900/30 border-cyan-400 text-cyan-300' : 'bg-transparent border-cyan-500/60 text-cyan-500 hover:bg-cyan-500/10 hover:border-cyan-400 hover:text-cyan-300'}`}
                    >
                      {isLoading ? '...' : '[load]'}
                    </div>
                    <button
                      aria-label={`Run ${mod.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        sphereFireRef.current = { ts: Date.now() };
                        mobileAutoRun && mobileAutoRun(mod.id);
                        resetTtyFade();
                        setFiringKernelId(mod.id);
                        clearTimeout(lavaTimerRef.current);
                        lavaTimerRef.current = setTimeout(() => setFiringKernelId(null), 700);
                      }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border bg-transparent tracking-widest whitespace-nowrap active:scale-95"
                      style={{
                        borderColor:  'rgba(139,92,246,0.55)',
                        color:        '#8B5CF6',
                        textShadow:   '0 0 4px rgba(139,92,246,0.4)',
                        animation:    firingKernelId === mod.id ? 'sk-runLava 700ms ease-out' : undefined,
                      }}
                    >
                      [run]
                    </button>
                  </div>
                </li>
              );
            })}

            {/* ── The reserved slot · the fifth essence ──────────────────────
             * Empty until forged at the Mercury altar. Post-compile it holds the
             * one quintessence kernel; [load ↗] carries the visitor to the seal.
             * Pre-compile it is the vertebrae assembly meter — never dead space. */}
            {artifact ? (
              breakingSeal ? (
                <li
                  className="flex flex-wrap justify-between items-center gap-y-2 border-b border-l-2 pb-3 mb-1 p-2 pl-3 rounded gap-2 border-red-900/40 border-l-red-500/60 bg-red-950/10"
                  style={{ animation: 'sk-kernelModuleIn 0.22s ease-out both' }}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-bold text-sm mb-0.5 truncate" style={{ color: '#f87171', textShadow: '0 0 8px rgba(239,68,68,0.25)' }}>
                      break seal 0x{artifact.hash.slice(0, 8).toUpperCase()}?
                    </div>
                    <div className="text-[11px] font-bold tracking-wide truncate" style={{ color: 'rgba(248,113,113,0.6)' }}>
                      the vial is destroyed · the altar re-arms · this cannot be undone
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <button
                      onClick={() => { clearSealedArtifact(); setBreakingSeal(false); toMercury(); }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-red-500/70 text-red-300 hover:bg-red-500/10 hover:border-red-300"
                    >
                      [forge anew]
                    </button>
                    <button
                      onClick={() => setBreakingSeal(false)}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-zinc-600/60 text-zinc-400 hover:bg-zinc-800/40"
                    >
                      [keep]
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  onClick={toMercury}
                  className="flex flex-wrap justify-between items-center gap-y-2 border-b border-l-2 pb-3 mb-1 cursor-pointer p-2 pl-3 rounded transition-all group gap-2 border-amber-900/30 border-l-amber-500/50 hover:bg-amber-950/20"
                  style={{ animation: 'sk-kernelModuleIn 0.22s ease-out 40ms both' }}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="font-bold text-sm mb-0.5 truncate" style={{ color: '#e8d28a', textShadow: '0 0 8px rgba(212,168,42,0.25)' }}>
                      QUINTESSENCE_KERNEL_0x{artifact.hash.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs font-bold tracking-wide truncate" style={{ color: 'rgba(212,168,42,0.78)' }}>
                      the fifth essence · {(artifact.meta.element || 'sealed').toLowerCase()} · verdict {artifact.meta.verdict}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    <div
                      onClick={(e) => { e.stopPropagation(); setBreakingSeal(true); }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-zinc-600/50 text-zinc-400 hover:bg-red-950/30 hover:border-red-500/50 hover:text-red-300"
                    >
                      [compile]
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); toMercury(); }}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer border-amber-500/60 text-amber-300 hover:bg-amber-500/10 hover:border-amber-300"
                    >
                      [load ↗]
                    </div>
                  </div>
                </li>
              )
            ) : (
              <li
                onClick={toMercury}
                className={`flex flex-wrap justify-between items-center gap-y-2 border-b border-dashed pb-3 mb-1 cursor-pointer p-2 pl-3 rounded transition-all gap-2 ${armed ? 'border-amber-600/40 hover:bg-amber-950/20' : 'border-zinc-800/60 hover:bg-zinc-900/20'}`}
                style={{ animation: 'sk-kernelModuleIn 0.22s ease-out 40ms both, sk-quintBreath 5s ease-in-out infinite' }}
                title="the fifth essence · uncompiled"
              >
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="font-bold text-sm mb-0.5 truncate tracking-wide" style={{ color: armed ? '#e8d28a' : 'rgba(232,210,138,0.42)' }}>
                    QUINTESSENCE_KERNEL_∅
                  </div>
                  <div className="text-[11px] font-bold tracking-wide truncate" style={{ color: 'rgba(212,168,42,0.55)' }}>
                    four bind the earth · the fifth is forged from your spine
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {/* Vertebrae assembly meter — fills as trend/council/phase/element are witnessed */}
                  <div className="flex items-center gap-1" aria-label={`${vertebrae.filter(v => v.filled).length} of 4 vertebrae witnessed`}>
                    {vertebrae.map(v => (
                      <span key={v.key} title={v.key}
                        style={{ color: v.filled ? '#d4a82a' : 'rgba(120,113,90,0.5)', textShadow: v.filled ? '0 0 6px rgba(212,168,42,0.55)' : 'none', fontSize: '13px', lineHeight: 1 }}>
                        {v.filled ? '▣' : '▢'}
                      </span>
                    ))}
                  </div>
                  <div
                    onClick={(e) => { e.stopPropagation(); toMercury(); }}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all cursor-pointer ${armed ? 'border-amber-400/70 text-amber-200 hover:bg-amber-500/10 hover:border-amber-300' : 'border-amber-800/50 text-amber-500/70 hover:bg-amber-950/30 hover:text-amber-300'}`}
                    style={armed ? { animation: 'sk-quintArmed 2.5s ease-in-out infinite' } : undefined}
                  >
                    [ compile ↗ ]
                  </div>
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* ── Bottom apex: /dev/tty0 — centered, triangle point ─────────────── */}
      {(() => {
        const ttyEl = (
          <div
            className={`fixed bottom-14 left-0 right-0 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:h-auto md:flex-[4] md:min-h-0 border-t border-cyan-900/40 md:border md:border-cyan-900/30 md:rounded-lg flex flex-col md:mx-auto md:w-3/5 overflow-hidden bg-black/95 md:bg-black/50 backdrop-blur-sm transition-[height,opacity] duration-300 ${(!mobileChrome || !bootDone) ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`}
            style={{
              animation:  isCritical
                ? 'sk-ttyPulseCrit 1.5s ease-in-out infinite'
                : isWarning
                ? 'sk-ttyPulseWarn 2.5s ease-in-out infinite'
                : 'sk-ttyPulse 4s ease-in-out infinite',
              boxShadow:  isCritical
                ? '0 0 0 1px rgba(255,0,136,0.2), 0 -8px 32px rgba(255,0,136,0.12), inset 0 0 20px rgba(255,0,136,0.04)'
                : isWarning
                ? '0 0 0 1px rgba(255,215,0,0.14), 0 -6px 24px rgba(255,215,0,0.08)'
                : undefined,
              transition:  'box-shadow 1.2s ease',
              willChange:  'opacity, transform',
              transform:   'translateZ(0)',
              height:      mobileLogExpanded ? 'min(60vh, 480px)' : '9rem',
            }}
          >
            {/* Header strip — double-tap + long-tap here to activate mobile keyboard */}
            <div
              className="flex items-center gap-3 px-4 py-2 border-b border-cyan-900/20 shrink-0"
              onTouchStart={handleTtyHeaderTouchStart}
              onTouchEnd={handleTtyHeaderTouchEnd}
              onTouchCancel={handleTtyHeaderTouchEnd}
            >
              {/* PF bar — left side of tty0 header */}
              <div className="flex items-center gap-1.5 shrink-0" title={`PF: ${ramPct}% available`}>
                <span className="text-[9px] font-black tracking-widest" style={{ color: ramColor(ramPct), transition: 'color 1s ease' }}>PF</span>
                <div className="flex gap-0">
                  {Array.from({ length: 100 }).map((_, i) => {
                    const filled = i < ramPct;
                    const col    = ramColor(ramPct);
                    return (
                      <div
                        key={i}
                        className={`w-px h-[8px]${isCritical && filled ? ' animate-pulse' : ''}`}
                        style={{
                          background:  filled ? col : 'rgba(6,182,212,0.07)',
                          boxShadow:   filled ? `0 0 2px ${col}55` : 'none',
                          transition:  'background 1s ease, box-shadow 1s ease',
                        }}
                      />
                    );
                  })}
                </div>
                <span className="text-[9px] font-black" style={{ color: `${ramColor(ramPct)}99`, transition: 'color 1s ease' }}>{ramPct}%</span>
              </div>
              <span
                className="tracking-widest font-mono text-xs font-bold shrink-0 text-transparent bg-clip-text"
                style={{
                  backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #39ff14)',
                  backgroundSize: '200% auto',
                  animation: 'sk-kernelShimmer 4s ease-in-out infinite',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >/dev/tty0</span>
              <span className="text-[9px] font-bold tracking-widest text-cyan-900/35 shrink-0">system kernel logs</span>
              <span className="text-[9px] font-bold tracking-widest text-cyan-900/35 ml-auto hidden md:block shrink-0">
                run · help · list · breach · tags
              </span>
              {/* Mobile-only: expand/collapse logs panel */}
              <button
                className="md:hidden ml-auto shrink-0 text-[9px] font-black tracking-widest border border-cyan-900/40 px-2 py-0.5 rounded-sm transition-colors"
                style={{ color: mobileLogExpanded ? '#39ff14' : 'rgba(6,182,212,0.45)', borderColor: mobileLogExpanded ? 'rgba(57,255,20,0.4)' : 'rgba(6,182,212,0.2)' }}
                onClick={() => setMobileLogExpanded(v => !v)}
              >
                {mobileLogExpanded ? 'LOGS ▼' : 'LOGS ▲'}
              </button>
            </div>

            {/* Log output */}
            <div
              ref={logRef}
              className="sk-tty0-logs overflow-y-auto text-xs px-4 py-2 bg-black/70 font-mono custom-scrollbar flex-1 min-h-0"
              onTouchMove={resetTtyFade}
            >
              {visibleLogs.map((l, i) => (
                <div key={`${l.time}-${i}`} className={`mb-1 break-words ${l.color ? '' : l.intrusion ? 'text-red-400' : l.rust ? 'text-emerald-400' : 'text-[#39ff14]'}`} style={l.color ? { color: l.color, animation: 'eco-log-in 0.28s ease-out both' } : undefined}>
                  <span className={`mr-2 ${l.intrusion ? 'text-red-400/70' : l.rust ? 'text-cyan-300' : 'text-cyan-500'}`} style={l.color ? { color: 'rgb(103 232 249 / 0.7)' } : undefined}>{l.time}</span>– {l.msg}
                  {l.btn && (
                    <button
                      onClick={() => { sphereFireRef.current = { ts: Date.now() }; mobileAutoRun && mobileAutoRun(l.btn.cmd); resetTtyFade(); }}
                      className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded-sm border border-fuchsia-500/60 text-fuchsia-400 bg-transparent hover:bg-fuchsia-500/10 hover:border-fuchsia-400 active:scale-95 tracking-widest whitespace-nowrap transition-all"
                    >
                      [{l.btn.label}]
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop inline command input */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 border-t border-cyan-900/20 shrink-0 bg-black/60 relative">
              {/* Param hint — floats above the tty0 input while run args are typed */}
              {paramHint && suggestions.length === 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-black border border-fuchsia-900/40 shadow-[0_-2px_12px_rgba(217,70,239,0.1)] z-50 rounded-sm">
                  <div className="px-4 py-2 flex items-center gap-2 text-xs font-mono">
                    <span className="text-fuchsia-500/70 shrink-0">{'>'}</span>
                    <span className="text-cyan-900/80 truncate">{commandInput}</span>
                    <span className="text-fuchsia-400/60 tracking-wide">{paramHint}</span>
                  </div>
                </div>
              )}
              {/* Autocomplete dropdown — floats above the tty0 input */}
              {suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-black border border-cyan-900/60 shadow-[0_-4px_24px_rgba(6,182,212,0.2)] z-50 rounded-sm overflow-hidden">
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                    {suggestions.map((k, i) => (
                      <div
                        key={k.id}
                        onMouseDown={(e) => { e.preventDefault(); onSelectSuggestion?.(k); }}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-cyan-900/20 last:border-0 transition-colors ${i === activeSugg ? 'bg-cyan-900/30 border-l-2 border-l-cyan-400' : 'hover:bg-cyan-900/10 border-l-2 border-l-transparent'}`}
                      >
                        <span className={`text-xs font-bold tracking-wider truncate ${i === activeSugg ? 'text-cyan-300' : 'text-cyan-400'}`}>
                          {i === activeSugg && <span className="text-fuchsia-400 mr-1 animate-pulse">▋</span>}{k.name}
                        </span>
                        <span className="text-[10px] text-fuchsia-400/60 truncate ml-auto shrink-0 max-w-[50%]">{k.desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-1.5 text-[10px] text-cyan-900/70 tracking-widest border-t border-cyan-900/20 bg-black">
                    ↑↓ navigate · Enter load · Tab complete · Esc dismiss
                  </div>
                </div>
              )}
              <span
                className="text-xs font-black tracking-widest shrink-0 select-none text-transparent bg-clip-text"
                style={isCritical ? {
                  backgroundImage: 'linear-gradient(90deg, #FF0088, #FF4400, #FFD700, #FF4400, #FF0088)',
                  backgroundSize: '300% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'sk-ttyRainbow 1.2s linear infinite',
                  filter: 'drop-shadow(0 0 5px rgba(255,0,136,0.7))',
                } : {
                  backgroundImage: 'linear-gradient(90deg, #ff0080, #ff8c00, #39ff14, #06b6d4, #8b5cf6, #e879f9, #ff0080, #ff8c00, #39ff14)',
                  backgroundSize: '400% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'sk-ttyRainbow 6s linear infinite, sk-ttyRainbowGlow 6s linear infinite',
                }}
              >tty0:~$</span>
              <input
                type="text"
                value={commandInput}
                onChange={onCommandInputChange}
                onKeyDown={onCommandKeyDown}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="bg-transparent border-none outline-none flex-grow text-cyan-400 text-xs font-bold font-mono placeholder-cyan-900/40"
                placeholder="enter command…"
              />
            </div>

            {/* Mobile keyboard — gesture-gated: double-tap + long-tap on header to unlock */}
            {mobileInputVisible && (
              <div className="md:hidden flex items-center gap-2 px-4 py-2 border-t border-fuchsia-900/40 shrink-0 bg-black/90">
                <span
                className="text-xs font-black tracking-widest shrink-0 select-none text-transparent bg-clip-text"
                style={isCritical ? {
                  backgroundImage: 'linear-gradient(90deg, #FF0088, #FF4400, #FFD700, #FF4400, #FF0088)',
                  backgroundSize: '300% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'sk-ttyRainbow 1.2s linear infinite',
                  filter: 'drop-shadow(0 0 5px rgba(255,0,136,0.7))',
                } : {
                  backgroundImage: 'linear-gradient(90deg, #ff0080, #ff8c00, #39ff14, #06b6d4, #8b5cf6, #e879f9, #ff0080, #ff8c00, #39ff14)',
                  backgroundSize: '400% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'sk-ttyRainbow 6s linear infinite, sk-ttyRainbowGlow 6s linear infinite',
                }}
              >tty0:~$</span>
                <input
                  ref={mobileInputRef}
                  type="text"
                  inputMode="text"
                  value={commandInput}
                  onChange={onCommandInputChange}
                  onKeyDown={onCommandKeyDown}
                  onBlur={() => setMobileInputVisible(false)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="bg-transparent border-none outline-none flex-grow text-cyan-400 text-xs font-bold font-mono placeholder-cyan-900/40"
                  placeholder="enter command…"
                />
              </div>
            )}
          </div>
        );
        return ttyPortalTarget.current ? createPortal(ttyEl, ttyPortalTarget.current) : ttyEl;
      })()}

    </div>
  </div>
  );
};

export default React.memo(KernelTab);
