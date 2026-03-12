import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Database, GitBranch, Shield, ChevronRight, Cpu, Play } from 'lucide-react';

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

const KernelTab = ({ kernelAxioms = [], kernelBuilds = [], handleKernelClick, loadingKernel, visibleLogs = [], logRef, searchFilter, onClearFilter, listRef, commandInput = '', onCommandInputChange, onCommandKeyDown, ramPct = 0, isCritical = false, isWarning = false, appendSystemLog, mobileChrome = true, mobileAutoRun }) => {
  // ── Gesture-gated mobile keyboard ─────────────────────────────────────────
  // Activation: double-tap + long-tap on the tty0 header strip.
  // Double-tap window: 350ms. Long-press threshold: 500ms.
  const [mobileInputVisible, setMobileInputVisible] = useState(false);
  const mobileInputRef  = useRef(null);
  const lastTapTimeRef  = useRef(0);
  const tapCountRef     = useRef(0);
  const longPressRef    = useRef(null);

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
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative md:flex md:flex-col md:h-[calc(100dvh-200px)] md:min-h-[540px]">

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
        0% { opacity: 0; transform: rotate(-45deg) scale(0.5); filter: drop-shadow(0 0 20px #39ff14); }
        100% { opacity: 1; transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 8px rgba(57, 255, 20, 0.6)); }
      }
      @keyframes sk-cpuYellowReveal {
        0% { opacity: 0; transform: rotate(-45deg) scale(0.5); filter: drop-shadow(0 0 20px #FFD700); }
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
      @keyframes sk-treeGlow {
        0%, 100% { filter: drop-shadow(0 0 3px rgba(6,182,212,0.4)); }
        50%       { filter: drop-shadow(0 0 10px rgba(6,182,212,1)) drop-shadow(0 0 20px rgba(6,182,212,0.35)); }
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
      .axiom-item:hover { box-shadow: inset 3px 0 0 #39ff14, inset 0 0 24px rgba(57,255,20,0.04); }
      /* Mobile tty0: hidden scrollbar */
      @media (max-width: 767px) {
        .sk-tty0-logs { scrollbar-width: none; }
        .sk-tty0-logs::-webkit-scrollbar { display: none; }
      }
    `}</style>

    {searchFilter && (
      <div className="flex items-center gap-3 mb-3 px-3 py-2 border border-cyan-500/30 bg-cyan-900/10 rounded-sm text-xs font-bold tracking-widest shrink-0">
        <span className="text-[#39ff14]">{'>_'}</span>
        <span className="text-cyan-400">filter: <span className="text-[#39ff14]">{searchFilter}</span></span>
        <span className="text-cyan-600 ml-1">— {kernelBuilds.length} result{kernelBuilds.length !== 1 ? 's' : ''}</span>
        <button onClick={onClearFilter} className="ml-auto text-cyan-900/70 hover:text-cyan-400 transition-colors tracking-wide">[clear]</button>
      </div>
    )}

    {/* ── system_kernel header — shrink-0 so it never flexes away ─────────── */}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-cyan-900/50 pb-3 mb-4 shrink-0">
      <div>
        <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
          <Cpu
            className="w-8 h-8 shrink-0"
            style={{ color: '#FFD700', animation: 'sk-cpuYellowReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards, sk-cpuYellowGlow 2.5s ease-in-out 0.8s infinite' }}
          />
          <span
            className="hidden md:inline text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(90deg, #FF8C00, #FFD700, #FFFF00, #FFD700, #FF8C00)',
              backgroundSize: '400% auto',
              animation: 'sk-kernelTextReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards, sk-kernelShimmer 2.5s ease-in-out infinite'
            }}
          >
            system_kernel
          </span>
        </h2>
        <div
          className="hidden md:block text-sm font-bold tracking-widest"
          style={{ color: '#fb923c', opacity: 0, animation: 'sk-subReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards' }}
        >
          version: soma-9.1 // build: gaia // ostrom_protocol
        </div>
      </div>
      <div className="hidden md:flex items-center gap-4 mt-3 md:mt-0 shrink-0">
        <div className="flex items-center gap-2 text-xs border border-cyan-500/30 px-3 py-1 bg-cyan-900/10 text-cyan-400 rounded-sm">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,1)]"></div> operational
        </div>
        <div className="flex items-center gap-2 text-xs border border-[#39ff14]/30 px-3 py-1 bg-green-900/10 text-[#39ff14] rounded-sm shadow-[0_0_6px_rgba(57,255,20,0.15)]">
          <Shield className="w-3 h-3" /> leviathan: active
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
              style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6, #D946EF, #A855F7)', opacity: 0, animation: 'sk-axiomHeadReveal 1s cubic-bezier(0.16,1,0.3,1) 0.2s forwards' }}
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
              style={{ animation: 'sk-kernelIconReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards, sk-treeGlow 2.5s ease-in-out 0.8s infinite' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #06b6d4, #d946ef, #39ff14)',
                backgroundSize: '200% auto',
                animation: 'sk-kernelShimmer 3s ease-in-out infinite',
              }}
            >active_modules</span>
          </h3>
          <ul ref={listRef} className="space-y-3 text-sm font-mono text-[#39ff14] md:overflow-y-auto custom-scrollbar pr-2 md:flex-1 md:min-h-0">
            {kernelBuilds.map((kernel, idx) => {
              const isLoading = loadingKernel === kernel.id;
              return (
                <li
                  key={kernel.id}
                  onClick={() => {
                    handleKernelClick && handleKernelClick(kernel);
                    if (mobileAutoRun && window.matchMedia('(max-width: 767px)').matches) {
                      setTimeout(() => mobileAutoRun(kernel.id), 900);
                    }
                  }}
                  className={`flex flex-wrap justify-between items-center gap-y-2 border-b pb-3 mb-1 cursor-pointer p-2 rounded transition-all group gap-2
                    ${isLoading ? 'bg-cyan-900/20 border-cyan-400/60 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)] backdrop-blur-sm animate-pulse' : 'border-cyan-900/20 hover:bg-cyan-900/10'}`}
                  style={{ animation: `sk-kernelModuleIn 0.22s ease-out ${idx * 40}ms both` }}
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div
                      className="font-bold text-sm mb-0.5 truncate text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef, #ef4444, #38bdf8, #39ff14)',
                        backgroundSize: '300% auto',
                        animation: 'sk-moduleNameShimmer 3.5s ease-in-out infinite',
                      }}
                    >{kernel.name}</div>
                    <div className="text-xs text-[#39ff14] font-bold tracking-wide truncate opacity-70">
                      {isLoading ? 'initializing...' : kernel.desc}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    {kernel.sim === 'climate' && appendSystemLog && (
                      <button
                        aria-label="Run climate simulation"
                        onClick={(e) => { e.stopPropagation(); runClimateSim(appendSystemLog); }}
                        className="flex items-center justify-center w-6 h-6 rounded-sm border border-fuchsia-500/60 bg-fuchsia-950/30 text-fuchsia-400 hover:bg-fuchsia-500/20 hover:border-fuchsia-400 hover:text-fuchsia-300 transition-all duration-150 active:scale-90 shrink-0"
                        style={{ boxShadow: '0 0 6px rgba(217,70,239,0.25)' }}
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    )}
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded border tracking-widest whitespace-nowrap transition-all ${isLoading ? 'bg-cyan-900/30 border-cyan-400 text-cyan-300' : 'bg-transparent border-cyan-500 text-cyan-500'}`}>
                      {isLoading ? '...' : '[load]'}
                    </div>
                    <ChevronRight className={`w-4 h-4 transition-colors ${isLoading ? 'text-cyan-400 animate-bounce' : 'text-cyan-500/50 group-hover:text-cyan-400'}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Bottom apex: /dev/tty0 — centered, triangle point ─────────────── */}
      <div
        className={`fixed bottom-14 left-0 right-0 h-36 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:h-auto md:flex-[4] md:min-h-0 border-t border-cyan-900/40 md:border md:border-cyan-900/30 md:rounded-lg flex flex-col md:mx-auto md:w-3/5 overflow-hidden bg-black/95 md:bg-black/50 backdrop-blur-sm transition-opacity duration-500 ${!mobileChrome ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto' : ''}`}
        style={{ animation: 'sk-ttyPulse 4s ease-in-out infinite' }}
      >
        {/* Header strip — double-tap + long-tap here to activate mobile keyboard */}
        <div
          className="flex items-center gap-3 px-4 py-2 border-b border-cyan-900/20 shrink-0"
          onTouchStart={handleTtyHeaderTouchStart}
          onTouchEnd={handleTtyHeaderTouchEnd}
          onTouchCancel={handleTtyHeaderTouchEnd}
        >
          {/* RAM bar — left side of tty0 header */}
          <div className="flex items-center gap-1.5 shrink-0" title={`ECO-RAM: ${ramPct}%`}>
            <span className={`text-[9px] font-black tracking-widest ${isCritical ? 'text-red-500' : 'text-cyan-900/50'}`}>RAM</span>
            <div className="flex gap-0">
              {Array.from({ length: 100 }).map((_, i) => {
                const filled = i < ramPct;
                return (
                  <div
                    key={i}
                    className={`w-px h-[8px]${isCritical && filled ? ' animate-pulse' : ''}`}
                    style={{
                      background: filled
                        ? (isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#39ff14')
                        : 'rgba(6,182,212,0.07)',
                      boxShadow: filled && !isCritical && !isWarning ? '0 0 2px rgba(57,255,20,0.35)' : 'none',
                    }}
                  />
                );
              })}
            </div>
            <span className={`text-[9px] font-black ${isCritical ? 'text-red-500/70' : 'text-cyan-900/35'}`}>{ramPct}%</span>
          </div>
          <span className="text-[#39ff14] tracking-widest font-mono text-xs font-bold shrink-0">/dev/tty0</span>
          <span className="text-[9px] font-bold tracking-widest text-cyan-900/35 shrink-0">system kernel logs</span>
          <span className="text-[9px] font-bold tracking-widest text-cyan-900/35 ml-auto hidden md:block shrink-0">
            run · help · list · breach · tags
          </span>
        </div>

        {/* Log output */}
        <div
          ref={logRef}
          className="sk-tty0-logs overflow-y-auto text-xs px-4 py-2 bg-black/70 font-mono custom-scrollbar flex-1 min-h-0"
        >
          {visibleLogs.map((l, i) => (
            <div key={`${l.time}-${i}`} className={`mb-1 break-words ${l.rust ? 'text-emerald-400' : 'text-[#39ff14]'}`}>
              <span className={`mr-2 ${l.rust ? 'text-cyan-300' : 'text-cyan-500'}`}>{l.time}</span>– {l.msg}
            </div>
          ))}
        </div>

        {/* Desktop inline command input */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 border-t border-cyan-900/20 shrink-0 bg-black/60">
          <span className="text-fuchsia-500 text-xs font-bold tracking-widest shrink-0 select-none">tty0:~$</span>
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
            <span className="text-fuchsia-500 text-xs font-bold tracking-widest shrink-0 select-none">tty0:~$</span>
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

    </div>
  </div>
  );
};

export default React.memo(KernelTab);
