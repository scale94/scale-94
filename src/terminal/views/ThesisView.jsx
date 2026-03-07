import React from 'react';
import { ArrowLeft } from 'lucide-react';
import HackerText from '../components/HackerText';

const ThesisView = ({ handleReturnToRoot, systemArticles = {} }) => {
  const thesis = systemArticles['ARCHITECT-THESIS'];
  return (
  <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-300">
    <button onClick={handleReturnToRoot} className="mb-8 flex items-center text-xs font-bold tracking-widest text-fuchsia-600 hover:text-white transition-colors border border-fuchsia-900/50 hover:border-fuchsia-500 px-3 py-2 -ml-2 w-fit uppercase bg-[#09090b] rounded-sm">
      <ArrowLeft className="w-3 h-3 mr-2" /> Return_To_SCALING
    </button>

    <div className="border-l-2 border-cyan-500/50 pl-8 relative">
      <div className="flex flex-wrap gap-4 text-[10px] font-bold tracking-widest text-fuchsia-600 mb-8 font-mono uppercase">
        <span className="text-cyan-500">LOG: ARCHITECT_THESIS</span>
        <span>{'//'}</span>
        <span>DATE: {thesis?.date || '2025-12-08'}</span>
        <span>{'//'}</span>
        <span>STATUS: ACTIVE_PROTOCOL</span>
      </div>

      <h1 className="text-[14pt] font-bold mb-4 text-fuchsia-400 tracking-tighter leading-none">
        <HackerText text={thesis?.title ?? 'The Calculated Injection of Mass'} />
      </h1>
      <h2 className="text-[12pt] text-cyan-400 mb-12 font-light tracking-wide">
        {thesis?.subtitle ?? 'From Default Geometry to Complex Systems'}
      </h2>

      <div
        className="font-mono text-sm md:text-base leading-relaxed"
        dangerouslySetInnerHTML={{ __html: thesis?.html ?? '' }}
      />

      <div className="mt-16 pt-8 border-t border-fuchsia-900/30 flex justify-between items-center text-[10px] font-bold tracking-widest text-gray-600 uppercase">
        <span>THESIS_COMPLETE</span>
        <span>SIG: {Math.random().toString(36).substring(7)}</span>
      </div>
    </div>
  </div>
  );
};

export default React.memo(ThesisView);
