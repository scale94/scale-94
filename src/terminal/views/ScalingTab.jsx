import React from 'react';
import { Hexagon, ChevronRight, Globe, MessageSquare, Zap, FileText } from 'lucide-react';

const ScalingTab = ({ setArchitectThesis, setCurrentPath }) => (
  <div className="animate-in fade-in duration-500 max-w-6xl mx-auto mt-8">
    <div className="flex items-center gap-3 mb-8 text-cyan-400 border-b border-cyan-900/50 pb-4">
      <Hexagon className="w-8 h-8 animate-spin-slow" />
      <h2 className="text-3xl font-bold tracking-tighter uppercase">KERNEL_BUILDING_SERVICES</h2>
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
        <a href="[https://drive.google.com/drive/folders/1JSkPxnxX0xez_s0QKEUXXjZHhjzlNOA2?usp=sharing](https://drive.google.com/drive/folders/1JSkPxnxX0xez_s0QKEUXXjZHhjzlNOA2?usp=sharing)" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
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
        <a href="[https://drive.google.com/drive/folders/1JSkPxnxX0xez_s0QKEUXXjZHhjzlNOA2?usp=sharing](https://drive.google.com/drive/folders/1JSkPxnxX0xez_s0QKEUXXjZHhjzlNOA2?usp=sharing)" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-[#39ff14] group-hover:translate-x-1 transition-transform cursor-pointer hover:text-cyan-400">
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

    {/* TRANSACTION MODULE */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-cyan-900/30 mt-8">
      {/* BSKY */}
      <div className="border border-cyan-900/30 bg-black/40 p-4 rounded-lg flex flex-col justify-center items-center hover:bg-cyan-900/10 transition-colors">
        <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1">
          <Globe className="w-4 h-4" /> BSKY:
        </div>
        <a href="[https://bsky.app/profile/scale94.com](https://bsky.app/profile/scale94.com)" target="_blank" rel="noreferrer" className="text-cyan-300 text-sm hover:underline hover:text-white transition-colors">@scale94.com</a>
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
        <div className="font-mono text-[10px] text-cyan-300 break-all select-all cursor-pointer hover:text-white transition-colors"
             title="Click to copy ETH address"
             onClick={() => {
               const address = '0xd05dDf143ce87942E528D96cDACf07800679898c';
               navigator.clipboard.writeText(address).catch(() => {
                 const tempInput = document.createElement('input');
                 tempInput.value = address;
                 document.body.appendChild(tempInput);
                 tempInput.select();
                 document.execCommand('copy');
                 document.body.removeChild(tempInput);
               });
             }}>
          0xd05dDf143ce87942E528D96cDACf07800679898c
        </div>
        <div className="text-[9px] text-[#39ff14]/40 font-mono mt-2 uppercase tracking-widest">[ click to copy ]</div>
      </div>
    </div>
  </div>
);

export default ScalingTab;
