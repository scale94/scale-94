import React from 'react';
import { Lock, Shield, Eye, Database } from 'lucide-react';

const PrivacyTab = ({ systemArticles = {} }) => {
  const privacy = systemArticles['PRIVACY-PROTOCOL'];
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <style>{`
        @keyframes pt-shimmer {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pt-reveal {
          from { opacity: 0; transform: translateY(-8px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
        }
        @keyframes pt-iconReveal {
          0%   { opacity: 0; transform: rotate(-45deg) scale(0.5); filter: drop-shadow(0 0 20px #f43f5e); }
          100% { opacity: 1; transform: rotate(0deg)  scale(1);   filter: drop-shadow(0 0 8px rgba(244,63,94,0.6)); }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-rose-900/50 pb-4 mb-8">
        <div>
          <h2 className="text-4xl font-bold mb-1 tracking-tight flex items-center gap-3">
            <Lock
              className="w-8 h-8 shrink-0 text-rose-400"
              style={{ animation: 'pt-iconReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef, #ef4444, #38bdf8, #39ff14)',
                backgroundSize: '300% auto',
                animation: 'pt-reveal 1.2s cubic-bezier(0.16,1,0.3,1) forwards, pt-shimmer 3s ease-in-out infinite',
              }}
            >PRIVACY_PROTOCOL</span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-rose-400/70"
            style={{ opacity: 0, animation: 'pt-reveal 0.7s cubic-bezier(0.16,1,0.3,1) 0.35s forwards' }}
          >
            DIRECTIVE: DATA_SOVEREIGNTY // CLASSIFICATION: OPEN
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-2 text-xs border border-rose-500/30 px-3 py-1 bg-rose-900/10 text-rose-300 rounded-sm">
            <Shield className="w-3 h-3" /> DATA POLICY
          </div>
          <div className="flex items-center gap-2 text-xs border border-cyan-500/30 px-3 py-1 bg-cyan-900/10 text-cyan-400 rounded-sm">
            <Eye className="w-3 h-3" /> TRANSPARENCY ACTIVE
          </div>
        </div>
      </div>

      {/* Content card */}
      <div className="max-w-3xl">
        <div
          style={{
            padding: '1.5px',
            background: 'linear-gradient(135deg, rgba(244,63,94,0.4), rgba(217,70,239,0.3), rgba(6,182,212,0.4))',
            borderRadius: '6px',
          }}
        >
          <div className="bg-black/90 backdrop-blur-sm px-8 py-8 rounded-[5px]">

            {/* Meta row */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-rose-900/30 text-[10px] font-bold tracking-widest font-mono uppercase">
              <Database className="w-3 h-3 text-rose-400" />
              <span className="text-rose-400/70">LOG: PRIVACY-PROTOCOL</span>
              <span className="text-cyan-900/60">//</span>
              <span className="text-cyan-600/60">NODE: scale-9.4</span>
              <span className="ml-auto text-rose-900/60">STATUS: ACTIVE</span>
            </div>

            {/* Body content */}
            <div
              className="prose prose-invert prose-sm max-w-none font-mono leading-relaxed
                prose-headings:text-rose-300 prose-headings:font-bold prose-headings:tracking-wide
                prose-p:text-cyan-100/70 prose-p:leading-relaxed
                prose-a:text-rose-400 prose-a:no-underline hover:prose-a:text-rose-200
                prose-strong:text-rose-300
                prose-code:text-[#39ff14] prose-code:bg-transparent"
              dangerouslySetInnerHTML={{ __html: privacy?.html ?? '<p class="text-rose-900/60 tracking-widest font-bold uppercase text-xs">PRIVACY PROTOCOL DATA STREAM UNAVAILABLE — NODE UNREACHABLE</p>' }}
            />

            {/* Footer */}
            <div className="mt-10 pt-6 border-t border-rose-900/20 flex justify-between items-center text-[10px] font-bold tracking-widest text-rose-900/50 uppercase font-mono">
              <span>END OF PROTOCOL // SOMA-9.1</span>
              <span className="text-cyan-900/40">SORBE NODE :: OSTROM_PROTOCOL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(PrivacyTab);
