import React, { useState } from 'react';
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText, Cpu } from 'lucide-react';

const ScalingTab = ({ setArchitectThesis, setCurrentPath, loadKernel }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEth = () => {
    const address = '0xd05dDf143ce87942E528D96cDACf07800679898c';
    navigator.clipboard.writeText(address)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy ETH address:', err);
      });
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto mt-8">
      <style>{`
        @keyframes sc-slideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes sc-subReveal {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sc-hexSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes sc-hexColor {
          0%   { color: #d946ef; filter: drop-shadow(0 0 10px rgba(217,70,239,0.9)); opacity: 1; }
          20%  { color: #06b6d4; filter: drop-shadow(0 0 10px rgba(6,182,212,0.9));  opacity: 0.5; }
          40%  { color: #39ff14; filter: drop-shadow(0 0 10px rgba(57,255,20,0.9));  opacity: 1; }
          60%  { color: #f43f5e; filter: drop-shadow(0 0 10px rgba(244,63,94,0.9));  opacity: 0.4; }
          80%  { color: #818cf8; filter: drop-shadow(0 0 10px rgba(129,140,248,0.9)); opacity: 1; }
          100% { color: #d946ef; filter: drop-shadow(0 0 10px rgba(217,70,239,0.9)); opacity: 1; }
        }
      `}</style>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-fuchsia-900/40 pb-4 mb-8 gap-3">
        <div>
          <h2 className="text-4xl font-bold tracking-tight flex items-center gap-3 mb-1">
            <Hexagon
              className="w-8 h-8 shrink-0"
              style={{ animation: 'sc-hexSpin 10s linear infinite, sc-hexColor 5.3s ease-in-out infinite' }}
            />
            <span
              className="text-transparent bg-clip-text uppercase"
              style={{
                backgroundImage: 'linear-gradient(90deg, #d946ef 0%, #7c3aed 50%, #06b6d4 100%)',
                animation: 'sc-slideIn 0.6s cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >KERNEL_BUILDING_SERVICES</span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-fuchsia-400/80 uppercase"
            style={{ opacity: 0, animation: 'sc-subReveal 0.5s cubic-bezier(0.16,1,0.3,1) 0.4s forwards' }}
          >
            SOVEREIGN ARCHITECTURE // SCALE94 DEPLOYMENT STACK
          </div>
        </div>
      </div>

      {/* Main Service Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* SEED_KERNEL */}
        <div className="border border-cyan-900/30 bg-black/40 p-6 rounded-lg hover:border-cyan-500/50 transition-all group relative overflow-hidden">
          <div className="text-lg font-bold text-cyan-400 mb-2 group-hover:text-cyan-300">SEED_KERNEL</div>
          <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-widest mb-4">[BASIC]</div>
          <p className="text-sm text-[#39ff14] mb-8 leading-relaxed h-20">
            A single, robust system prompt tailored to a specific user persona or goal.
          </p>
          <a href="mailto:scale0097@gmail.com" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
            <ChevronRight className="w-4 h-4" /> DEPLOY
          </a>
        </div>

        {/* SYSTEM_ARCH (Recommended) */}
        <div className="border border-fuchsia-500/30 bg-fuchsia-900/5 p-6 rounded-lg hover:border-fuchsia-400/60 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-fuchsia-500 text-black text-[9px] font-bold px-2 py-1 uppercase tracking-wider">Recommended</div>
          <div className="text-lg font-bold text-fuchsia-400 mb-2 group-hover:text-fuchsia-300">SYSTEM_ARCH</div>
          <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-4">[STANDARD]</div>
          <p className="text-sm text-[#39ff14] mb-8 leading-relaxed h-20">
            Full OS design. Kernel + Modules + Implementation Guide for Claude/GPT/Gemini.
          </p>
          <a href="mailto:scale0097@gmail.com" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
            <ChevronRight className="w-4 h-4" /> DEPLOY
          </a>
        </div>

        {/* ENTERPRISE_PROTO */}
        <div className="border border-cyan-900/30 bg-black/40 p-6 rounded-lg hover:border-cyan-500/50 transition-all group relative overflow-hidden">
          <div className="text-lg font-bold text-cyan-400 mb-2 group-hover:text-cyan-300">ENTERPRISE_PROTO</div>
          <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-widest mb-4">[PREMIUM]</div>
          <p className="text-sm text-[#39ff14] mb-8 leading-relaxed h-20">
            Full integration. Departmental kernels (Sales/HR) and workflow analysis.
          </p>
          <a href="mailto:contact@scale94.com" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
            <ChevronRight className="w-4 h-4" /> CONTACT
          </a>
        </div>
      </div>

      {/* ARCHITECT THESIS LINK */}
      <div className="border-t border-cyan-900/30 pt-8 mb-8">
        <div className="border border-fuchsia-500/30 bg-fuchsia-900/5 p-6 rounded-lg hover:border-fuchsia-400/60 transition-all group relative overflow-hidden max-w-2xl mx-auto">
          <div className="text-lg font-bold text-fuchsia-400 mb-2 group-hover:text-fuchsia-300">ARCHITECT_THESIS</div>
          <div className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText className="w-3 h-3" /> CORE PROTOCOL (IDENTITY)</div>
          <p className="text-sm text-[#39ff14] mb-4 leading-relaxed">
            A deep dive into the philosophy of creation, friction, and the **Fermions/Bosons** collision model.
          </p>
          <button onClick={() => { setArchitectThesis(true); setCurrentPath('~/system/scaling/thesis'); }} className="flex items-center gap-2 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform cursor-pointer hover:text-white">
            <ChevronRight className="w-4 h-4" /> LOAD THESIS LOG
          </button>
        </div>
      </div>

      {/* SCALING CUBE PROTOCOL */}
      <div className="border-t border-cyan-900/30 pt-8 mb-8">
        <div className="border border-cyan-500/30 bg-cyan-900/5 p-6 rounded-lg hover:border-cyan-400/60 transition-all group relative overflow-hidden max-w-2xl mx-auto">
          <div className="text-lg font-bold text-cyan-400 mb-2 group-hover:text-cyan-300">SCALING_CUBE_PROTOCOL</div>
          <div className="text-[10px] font-bold text-fuchsia-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Cpu className="w-3 h-3" /> UNCUT STATE / PLATONIC FORM / ENTROPIC STASIS
          </div>
          <p className="text-sm text-[#39ff14] mb-4 leading-relaxed font-mono">
            The default cube sits at the center of the viewport; a perfect 2x2x2 meter block of digital
            matter. It is the Platonic ideal; symmetrical, flawless, and completely dead. It represents
            the &#39;Uncut&#39; state; absolute purity that leads to entropic stasis.
          </p>
          <button
            onClick={() => loadKernel && loadKernel('SCALING-CUBE-PROTOCOL')}
            className="flex items-center gap-2 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform cursor-pointer hover:text-white"
          >
            <ChevronRight className="w-4 h-4" /> LOAD PROTOCOL
          </button>
        </div>
      </div>

      {/* TRANSACTION MODULE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-cyan-900/30 mt-8">
        {/* BSKY */}
        <div className="border border-cyan-900/30 bg-black/40 p-4 rounded-lg flex flex-col justify-center items-center hover:bg-cyan-900/10 transition-colors">
          <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
            <Globe className="w-4 h-4" /> BSKY:
          </div>
          <a href="https://bsky.app/profile/scale94.com" target="_blank" rel="noreferrer" className="text-cyan-300 text-sm hover:underline hover:text-white transition-colors">@scale94.com</a>
        </div>

        {/* SIGNAL */}
        <div className="border border-fuchsia-900/30 bg-black/40 p-4 rounded-lg flex flex-col justify-center items-center hover:bg-fuchsia-900/10 transition-colors">
          <div className="flex items-center gap-2 text-fuchsia-400 font-bold mb-1">
            <MessageSquare className="w-4 h-4" /> SIGNAL:
          </div>
          <span className="text-fuchsia-300 text-sm">@scale.94</span>
        </div>

        {/* Wallet */}
        <div className="border border-[#39ff14]/30 bg-[#39ff14]/5 p-4 rounded-lg flex flex-col justify-center hover:bg-[#39ff14]/10 transition-colors relative group">
          <div className="flex items-center gap-2 text-[#39ff14] font-bold mb-2 uppercase tracking-widest">
            <Zap className="w-4 h-4 fill-current" /> PLATA o DONO
          </div>
          <div className="text-[10px] text-cyan-500 font-mono mb-1 uppercase tracking-widest">eth:</div>
          <div
            className="font-mono text-[10px] text-cyan-300 break-all select-all cursor-pointer hover:text-white transition-colors"
            title="Click to copy ETH address"
            onClick={handleCopyEth}
          >
            0xd05dDf143ce87942E528D96cDACf07800679898c
          </div>
          <div className="text-[9px] font-mono mt-2 uppercase tracking-widest transition-colors duration-300">
            {copied
              ? <span className="text-[#39ff14] animate-pulse">[ ✓ COPIED ]</span>
              : <span className="text-[#39ff14]/40">[ click to copy ]</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ScalingTab);
