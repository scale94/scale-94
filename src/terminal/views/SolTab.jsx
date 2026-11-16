import React from 'react';
import SolGlyph from '../components/icons/SolGlyph';
import SolCanvas from '../sol/SolCanvas';
import { useSolStar } from '../sol/useSolStar';

// The star fills the stage panel; its HUD mounts here in a later task.
const SolTab = () => {
  const star = useSolStar();
  return (
    <div className="tab-fade-v2 max-w-6xl mx-auto mt-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-yellow-200/25 pb-4 mb-8 gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-3 mb-3 text-yellow-100 uppercase">
            <SolGlyph className="w-7 h-7 md:w-8 md:h-8 shrink-0" />
            <span>SOL</span>
          </h2>
          <div className="text-xs sm:text-sm font-bold tracking-widest text-yellow-100/70 uppercase">
            G2V · MAIN SEQUENCE
          </div>
        </div>
      </div>

      <div
        data-testid="sol-stage"
        className="relative w-full min-h-[60vh] border border-yellow-200/25 rounded-sm overflow-hidden"
      >
        <SolCanvas star={star} />
      </div>
    </div>
  );
};

export default React.memo(SolTab);
