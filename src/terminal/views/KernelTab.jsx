import React from 'react';
import { Database, GitBranch, Shield, ChevronRight, Cpu } from 'lucide-react';

const KernelTab = ({ kernelAxioms = [], kernelBuilds = [], handleKernelClick, loadingKernel, visibleLogs = [], logRef, searchFilter, onClearFilter, listRef }) => (
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
      @keyframes sk-kernelShimmer {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      @keyframes sk-subReveal {
        from { opacity: 0; transform: translateX(-10px); }
        to   { opacity: 1; transform: translateX(0); }
      }
    `}</style>

    {searchFilter && (
      <div className="flex items-center gap-3 mb-4 px-3 py-2 border border-cyan-500/30 bg-cyan-900/10 rounded-sm text-xs font-bold tracking-widest">
        <span className="text-fuchsia-500">{'>_'}</span>
        <span className="text-cyan-400">FILTER: <span className="text-[#39ff14]">{searchFilter.toUpperCase()}</span></span>
        <span className="text-cyan-600 ml-1">— {kernelBuilds.length} result{kernelBuilds.length !== 1 ? 's' : ''}</span>
        <button onClick={onClearFilter} className="ml-auto text-cyan-900/70 hover:text-cyan-400 transition-colors tracking-wide">[CLEAR]</button>
      </div>
    )}
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-cyan-900/50 pb-4 mb-8">
      <div>
        <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
          <Cpu 
            className="w-8 h-8 shrink-0 text-[#39ff14]" 
            style={{ animation: 'sk-kernelIconReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          />
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-[#39ff14] via-[#00ffff] to-cyan-700"
            style={{
              backgroundSize: '300% auto',
              // Combines the custom green glow reveal with a continuous shimmer.
              // 300% size + green→white→cyan gives a clearly visible sweep highlight
              // rather than the near-invisible green→slightly-different-green range.
              animation: 'sk-kernelTextReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards, sk-kernelShimmer 4s ease-in-out infinite'
            }}
          >
            SYSTEM_KERNEL
          </span>
        </h2>
        <div
          className="text-sm font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-[#39ff14]"
          style={{ 
            backgroundSize: '200% auto',
            opacity: 0, // Starts invisible, revealed by animation
            animation: 'sk-subReveal 0.6s ease-out 0.4s forwards, sk-kernelShimmer 4s ease-in-out infinite'
          }}
        >
          VERSION: SOMA-9.1 // BUILD: GAIA // OSTROM_PROTOCOL
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 md:mt-0">
        <div className="flex items-center gap-2 text-xs border border-cyan-500/30 px-3 py-1 bg-cyan-900/10 text-cyan-400 rounded-sm">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,1)]"></div> OPERATIONAL
        </div>
        <div className="flex items-center gap-2 text-xs border border-fuchsia-500/30 px-3 py-1 bg-fuchsia-900/10 text-fuchsia-400 rounded-sm">
          <Shield className="w-3 h-3" /> LEVIATHAN: ACTIVE
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-12">
      <div className="border border-cyan-900/50 p-6 bg-black/50 backdrop-blur-sm relative group hover:border-cyan-500/50 transition-colors duration-500 rounded-lg h-fit">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-fuchsia-400">
          <Database className="w-5 h-5" /> AXIOMATIC_CORE
        </h3>
        <div className="space-y-4">
          {kernelAxioms.map((axiom, idx) => (
            <div key={idx} className="group/item hover:bg-cyan-900/10 p-3 -mx-2 transition-all rounded-sm border-l-2 border-transparent hover:border-cyan-500 cursor-default min-w-0">
              <div className="flex flex-wrap justify-between items-center gap-y-3 mb-1 gap-2">
                <span className="font-bold text-cyan-400 text-lg min-w-0 break-words">0{idx + 1} :: {axiom.name?.toUpperCase() || "UNKNOWN"}</span>
                <span className="text-[10px] font-bold tracking-widest bg-cyan-900/30 text-cyan-200 px-2 py-0.5 rounded-full shrink-0">{axiom.field || "SYS"}</span>
              </div>
              <p className="text-sm text-[#39ff14] leading-relaxed group-hover/item:text-green-300 transition-colors break-words">{axiom.desc || "Axiom details unresolvable."}</p>
            </div>
          ))}
        </div>
      </div>

      <div id="kernel-container" className="space-y-8">
        <div className="border border-fuchsia-900/50 p-6 bg-black/50 backdrop-blur-sm hover:border-fuchsia-500/50 transition-colors rounded-lg flex flex-col h-[500px] overflow-hidden">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-cyan-400">
            <GitBranch className="w-4 h-4" /> ACTIVE_MODULES
          </h3>
          <ul ref={listRef} className="space-y-4 text-sm font-mono text-[#39ff14] overflow-y-auto custom-scrollbar pr-2 flex-grow">
            {kernelBuilds.map((kernel, idx) => {
              const isLoading = loadingKernel === kernel.id;
              return (
                <li
                  key={kernel.id}
                  onClick={() => handleKernelClick && handleKernelClick(kernel)}
                  className={`flex flex-wrap justify-between items-center gap-y-3 border-b border-fuchsia-900/30 pb-4 mb-2 cursor-pointer p-3 rounded transition-all group gap-3
                    ${isLoading ? 'bg-cyan-900/20 border-cyan-500/50 animate-pulse' : 'hover:bg-cyan-900/10'}`}
                  style={{ animation: `sk-kernelModuleIn 0.22s ease-out ${idx * 40}ms both` }}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-cyan-400 text-base mb-1 group-hover:text-cyan-300 transition-colors break-words">{kernel.name}</div>
                    <div className="text-xs text-[#39ff14] font-bold tracking-wide break-words">
                      {isLoading ? 'INITIALIZING...' : kernel.desc}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-auto">
                    <div className="text-[10px] font-bold px-3 py-1 rounded border bg-transparent tracking-widest whitespace-nowrap border-cyan-500 text-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.3)]">
                      {isLoading ? '...' : '[LOAD]'}
                    </div>
                    <ChevronRight className={`w-5 h-5 transition-colors ${isLoading ? 'text-cyan-400 animate-bounce' : 'text-cyan-500/50 group-hover:text-cyan-400'}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border border-cyan-900/30 p-6 rounded-lg">
          <h4 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2"><span className="text-fuchsia-500">{'>_'}</span> SYSTEM LOG (live)</h4>
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