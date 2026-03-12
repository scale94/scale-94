import React from 'react';
import { Database, GitBranch, Shield, ChevronRight, Cpu } from 'lucide-react';

const KernelTab = ({ kernelAxioms = [], kernelBuilds = [], handleKernelClick, handleKernelRun, loadingKernel, visibleLogs = [], logRef, searchFilter, onClearFilter, listRef }) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
    
    {/* Inline keyframes to guarantee the green glow and fade survive the production build pipeline */}
    <style>{`
      @keyframes sk-kernelTextReveal {
        /*
         * text-shadow instead of filter: drop-shadow — critical for bg-clip-text.
         * Any non-"none" filter value held via forwards fill on a background-clip:text
         * element breaks gradient clipping in Blink/WebKit (text goes black).
         * text-shadow casts from glyph outlines even when color:transparent, so we
         * keep the green glow reveal without touching the compositing path.
         */
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
      @keyframes sk-axiomNumGlow {
        0%, 100% { text-shadow: 0 0 8px rgba(139,92,246,0.7), 0 0 16px rgba(217,70,239,0.25); }
        50%       { text-shadow: 0 0 18px rgba(139,92,246,1), 0 0 36px rgba(217,70,239,0.7), 0 0 56px rgba(168,85,247,0.25); }
      }
      @keyframes sk-descGlow {
        0%, 100% { text-shadow: 0 0 8px rgba(255,215,0,0.7), 0 0 16px rgba(255,140,0,0.25); }
        50%       { text-shadow: 0 0 18px rgba(255,215,0,1), 0 0 36px rgba(255,140,0,0.7), 0 0 56px rgba(255,215,0,0.25); }
      }
      .axiom-item:hover { box-shadow: inset 3px 0 0 #39ff14, inset 0 0 24px rgba(57,255,20,0.04); }
    `}</style>

    {searchFilter && (
      <div className="flex items-center gap-3 mb-4 px-3 py-2 border border-cyan-500/30 bg-cyan-900/10 rounded-sm text-xs font-bold tracking-widest">
        <span className="text-[#39ff14]">{'>_'}</span>
        <span className="text-cyan-400">filter: <span className="text-[#39ff14]">{searchFilter}</span></span>
        <span className="text-cyan-600 ml-1">— {kernelBuilds.length} result{kernelBuilds.length !== 1 ? 's' : ''}</span>
        <button onClick={onClearFilter} className="ml-auto text-cyan-900/70 hover:text-cyan-400 transition-colors tracking-wide">[clear]</button>
      </div>
    )}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-cyan-900/50 pb-4 mb-8">
      <div>
        <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
          <Cpu
            className="w-8 h-8 shrink-0"
            style={{ color: '#FFD700', animation: 'sk-cpuYellowReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards, sk-cpuYellowGlow 2.5s ease-in-out 0.8s infinite' }}
          />
          <span
            className="text-transparent bg-clip-text"
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
          className="text-sm font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#39ff14] via-[#00ffff] to-cyan-300"
          style={{
            backgroundSize: '300% auto',
            opacity: 0,
            animation: 'sk-subReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards, sk-kernelShimmer 3s ease-in-out infinite'
          }}
        >
          version: soma-9.1 // build: gaia // ostrom_protocol
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 md:mt-0">
        <div className="flex items-center gap-2 text-xs border border-cyan-500/30 px-3 py-1 bg-cyan-900/10 text-cyan-400 rounded-sm">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,1)]"></div> operational
        </div>
        <div className="flex items-center gap-2 text-xs border border-[#39ff14]/30 px-3 py-1 bg-green-900/10 text-[#39ff14] rounded-sm shadow-[0_0_6px_rgba(57,255,20,0.15)]">
          <Shield className="w-3 h-3" /> leviathan: active
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
      <div className="border border-cyan-900/50 p-6 bg-black/50 backdrop-blur-sm relative group hover:border-cyan-500/50 transition-colors duration-500 rounded-lg h-fit"
        style={{ animation: 'sk-axiomBreath 5s ease-in-out infinite' }}
      >
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Database
            className="w-5 h-5"
            style={{ color: '#FFB900', animation: 'sk-kernelIconReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards, sk-axiomIconPulse 5s ease-in-out 0.8s infinite' }}
          />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6, #D946EF, #A855F7)', opacity: 0, animation: 'sk-axiomHeadReveal 1s cubic-bezier(0.16,1,0.3,1) 0.2s forwards' }}>axiomatic_core</span>
        </h3>
        <div className="space-y-4">
          {kernelAxioms.map((axiom, idx) => (
            <div key={idx} className="axiom-item group/item p-3 -mx-2 transition-all duration-200 rounded-sm border-l-2 border-transparent cursor-default min-w-0"
              style={{ opacity: 0, animation: `sk-subReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${0.1 + idx * 0.08}s forwards` }}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="font-mono font-black text-transparent bg-clip-text text-2xl shrink-0 tabular-nums leading-none"
                    style={{ backgroundImage: 'linear-gradient(90deg, #8B5CF6, #D946EF)', animation: `sk-axiomNumGlow 3.5s ease-in-out ${idx * 0.4}s infinite` }}
                  >
                    0{idx + 1}
                  </span>
                  <span className="text-cyan-800 font-mono text-sm font-bold leading-none shrink-0">::</span>
                  <span className="font-black text-base tracking-tight truncate leading-tight text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #38bdf8, #a78bfa)' }}>
                    {axiom.name?.toLowerCase() || 'unknown'}
                  </span>
                </div>
                <span
                  className="text-[10px] font-bold tracking-widest bg-cyan-900/30 text-cyan-200 px-2 py-0.5 rounded-full shrink-0"
                  style={{ opacity: 0, animation: `sk-tagReveal 0.5s cubic-bezier(0.16,1,0.3,1) ${0.3 + idx * 0.08}s forwards` }}
                >{axiom.field || 'SYS'}</span>
              </div>
              <p className="axiom-desc text-sm text-[#6b5b7b] leading-relaxed break-words pl-9" style={{ animation: 'sk-descGlow 5s ease-in-out infinite' }}>{axiom.desc || 'Axiom details unresolvable.'}</p>
            </div>
          ))}
        </div>
      </div>

      <div id="kernel-container" className="space-y-8">
        <div className="border border-cyan-900/50 p-6 bg-black/50 backdrop-blur-sm hover:border-cyan-500/50 transition-colors rounded-lg flex flex-col h-[500px] overflow-hidden">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <GitBranch className="w-4 h-4 shrink-0 text-[#06b6d4]" style={{ animation: 'sk-kernelIconReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards, sk-treeGlow 2.5s ease-in-out 0.8s infinite' }} />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #06b6d4, #d946ef, #39ff14)',
                backgroundSize: '200% auto',
                animation: 'sk-kernelShimmer 3s ease-in-out infinite',
              }}
            >active_modules</span>
          </h3>
          <ul ref={listRef} className="space-y-4 text-sm font-mono text-[#39ff14] overflow-y-auto custom-scrollbar pr-2 flex-grow">
            {kernelBuilds.map((kernel, idx) => {
              const isLoading = loadingKernel === kernel.id;
              return (
                <li
                  key={kernel.id}
                  onClick={() => handleKernelClick && handleKernelClick(kernel)}
                  className={`flex flex-wrap justify-between items-center gap-y-3 border-b pb-4 mb-2 cursor-pointer p-3 rounded transition-all group gap-3
                    ${isLoading ? 'bg-cyan-900/20 border-cyan-400/60 shadow-[inset_0_0_20px_rgba(34,211,238,0.08)] backdrop-blur-sm animate-pulse' : 'border-cyan-900/20 hover:bg-cyan-900/10'}`}
                  style={{ animation: `sk-kernelModuleIn 0.22s ease-out ${idx * 40}ms both` }}
                >
                  <div className="min-w-0">
                    <div
                      className="font-bold text-base mb-1 break-words text-transparent bg-clip-text"
                      style={{
                        backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef, #ef4444, #38bdf8, #39ff14)',
                        backgroundSize: '300% auto',
                        animation: 'sk-moduleNameShimmer 3.5s ease-in-out infinite',
                      }}
                    >{kernel.name}</div>
                    <div className="text-xs text-[#39ff14] font-bold tracking-wide break-words">
                      {isLoading ? 'initializing...' : kernel.desc}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-auto">
                    <div
                      onClick={(e) => { e.stopPropagation(); handleKernelRun && handleKernelRun(kernel); }}
                      className="text-[10px] font-bold px-3 py-1 rounded border tracking-widest whitespace-nowrap transition-all cursor-pointer bg-transparent border-fuchsia-700/60 text-fuchsia-500 shadow-[0_0_5px_rgba(217,70,239,0.2)] hover:border-fuchsia-400 hover:text-fuchsia-300 hover:shadow-[0_0_10px_rgba(217,70,239,0.5)]"
                    >
                      [run]
                    </div>
                    <div className={`text-[10px] font-bold px-3 py-1 rounded border tracking-widest whitespace-nowrap transition-all ${isLoading ? 'bg-cyan-900/30 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.4)] backdrop-blur-sm' : 'bg-transparent border-cyan-500 text-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.3)]'}`}>
                      {isLoading ? '...' : '[load]'}
                    </div>
                    <ChevronRight className={`w-5 h-5 transition-colors ${isLoading ? 'text-cyan-400 animate-bounce' : 'text-cyan-500/50 group-hover:text-cyan-400'}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border border-cyan-900/30 p-6 rounded-lg">
          <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
            <span className="text-[#39ff14]">{'/dev/tty0'}</span>
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef, #ef4444, #38bdf8, #39ff14)',
                backgroundSize: '300% auto',
                animation: 'sk-kernelShimmer 5s ease-in-out infinite',
              }}
            >(live)</span>
          </h4>
          <div ref={logRef} className="max-h-48 overflow-y-auto text-xs p-2 bg-black/60 border border-cyan-900/20 rounded custom-scrollbar">
            {visibleLogs.map((l, i) => (
              <div key={`${l.time}-${i}`} className={`mb-1 break-words ${l.rust ? 'text-emerald-400' : 'text-[#39ff14]'}`}>
                <span className={`mr-2 ${l.rust ? 'text-cyan-300' : 'text-cyan-500'}`}>{l.time}</span>— {l.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default React.memo(KernelTab);