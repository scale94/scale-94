import React from 'react';
import { Eye, Shield, Activity } from 'lucide-react';

const ManifestoTab = ({ systemArticles = {} }) => {
  const manifesto = systemArticles['MANIFESTO'];
  const thesis = systemArticles['ARCHITECT-THESIS'];
  return (
    <div className="tab-fade-v2 relative">
      <style>{`
        @keyframes mn-reveal {
          from { opacity: 0; transform: translateY(-8px); filter: blur(6px); }
          to   { opacity: 1; transform: translateY(0);   filter: blur(0); }
        }
        @keyframes mn-iconReveal {
          0%   { opacity: 0; transform: rotate(-45deg) scale(0.5); filter: drop-shadow(0 0 20px #06b6d4); }
          100% { opacity: 1; transform: rotate(0deg)  scale(1);   filter: drop-shadow(0 0 8px rgba(6,182,212,0.6)); }
        }
        @keyframes mn-iconPulse {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(6,182,212,0.4)); }
          50%       { filter: drop-shadow(0 0 12px rgba(6,182,212,0.9)) drop-shadow(0 0 24px rgba(6,182,212,0.25)); }
        }
        @keyframes mn-borderBreath {
          0%, 100% { box-shadow: 0 0 8px rgba(6,182,212,0.06); }
          50%       { box-shadow: 0 0 22px rgba(6,182,212,0.18); }
        }
        @keyframes mn-subReveal {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-cyan-900/50 pb-4 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-4xl font-bold mb-3 tracking-tight flex items-center gap-3">
            <Eye
              className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 shrink-0 text-cyan-400"
              style={{ animation: 'mn-iconReveal 0.8s cubic-bezier(0.16,1,0.3,1) forwards, mn-iconPulse 5s ease-in-out 0.8s infinite' }}
            />
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(135deg, #06b6d4 0%, #d946ef 50%, #39ff14 100%)',
                animation: 'mn-reveal 1.2s cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >architects_architecture</span>
          </h2>
          <div
            className="text-sm font-bold tracking-widest text-cyan-400"
            style={{ opacity: 0, animation: 'mn-subReveal 0.5s ease 0.4s forwards' }}
          >
            manifesto // mercury-9.4 // ostrom_protocol
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-2 text-xs border border-cyan-500/30 px-3 py-1 bg-cyan-900/10 text-cyan-400 rounded-sm">
            <Activity className="w-3 h-3" /> architect: active
          </div>
          <div className="flex items-center gap-2 text-xs border border-[#39ff14]/30 px-3 py-1 bg-green-900/10 text-[#39ff14] rounded-sm">
            <Shield className="w-3 h-3" /> clearance: sovereign
          </div>
        </div>
      </div>

      {/* Two-column layout (5:11): thesis | manifesto */}
      <div className="overflow-x-auto">
        <div className="flex gap-6" style={{ minWidth: '720px' }}>

          {/* Architect Thesis */}
          <div className="flex-[5] shrink-0 flex flex-col">
            <div
              style={{
                padding: '1.5px',
                background: 'linear-gradient(135deg, rgba(217,70,239,0.5), rgba(6,182,212,0.3))',
                borderRadius: '6px',
                flex: 1,
              }}
            >
              <div className="bg-black/90 backdrop-blur-sm px-6 py-6 rounded-[5px] h-full">
                <div className="flex flex-wrap gap-3 text-[10px] font-bold tracking-widest mb-6 font-mono">
                  <span className="text-cyan-500">log: architect_thesis</span>
                  <span className="text-fuchsia-600">//</span>
                  <span className="text-fuchsia-600">date: {thesis?.date || '2025-12-08'}</span>
                  <span className="text-fuchsia-600">//</span>
                  <span className="text-fuchsia-600">status: active_protocol</span>
                </div>
                <div
                  className="font-mono text-sm leading-relaxed
                    prose prose-invert prose-sm max-w-none
                    prose-headings:text-cyan-300 prose-headings:font-bold prose-headings:tracking-wide
                    prose-p:text-[#39ff14] prose-p:leading-relaxed
                    prose-strong:text-cyan-300
                    prose-li:text-[#39ff14]
                    prose-code:text-[#39ff14] prose-code:bg-transparent"
                  dangerouslySetInnerHTML={{ __html: thesis?.html ?? '' }}
                />
              </div>
            </div>
          </div>

          {/* Manifesto */}
          <div className="flex-[11] shrink-0 flex flex-col">
            <div
              style={{
                padding: '1.5px',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.5), rgba(217,70,239,0.3), rgba(57,255,20,0.4))',
                borderRadius: '6px',
                flex: 1,
              }}
            >
              <div
                className="bg-black/90 backdrop-blur-sm px-8 py-8 rounded-[5px] h-full"
                style={{ animation: 'mn-borderBreath 6s ease-in-out infinite' }}
              >
                <div
                  className="font-mono text-sm md:text-base leading-relaxed
                    prose prose-invert prose-sm max-w-none
                    prose-headings:text-cyan-300 prose-headings:font-bold prose-headings:tracking-wide
                    prose-p:text-[#39ff14] prose-p:leading-relaxed
                    prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:text-cyan-200
                    prose-strong:text-cyan-300
                    prose-li:text-[#39ff14]
                    prose-code:text-[#39ff14] prose-code:bg-transparent"
                  dangerouslySetInnerHTML={{ __html: manifesto?.html ?? '' }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default React.memo(ManifestoTab);
