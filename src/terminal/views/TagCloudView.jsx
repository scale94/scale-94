import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';

// ── Frequency tiers ────────────────────────────────────────────────────────────
// Colors + sizing scale with how many kernels share a tag.
// Tier boundaries are relative to the corpus maximum for robustness.

function tierClasses(count, max) {
  if (count >= Math.max(Math.ceil(max * 0.55), 5))
    return { color: 'text-cyan-300 border-cyan-400/40 bg-cyan-950/30',  size: 'text-[11px] font-bold' };
  if (count >= Math.max(Math.ceil(max * 0.30), 3))
    return { color: 'text-fuchsia-400 border-fuchsia-400/30 bg-fuchsia-950/20', size: 'text-[10px] font-semibold' };
  if (count >= 2)
    return { color: 'text-[#39ff14] border-[#39ff14]/20 bg-black/40',   size: 'text-[10px]' };
  return   { color: 'text-gray-500 border-gray-700/40 bg-black/20',     size: 'text-[9px]' };
}

const LEGEND = [
  { color: 'text-cyan-300',    label: 'HIGH_SIGNAL'  },
  { color: 'text-fuchsia-400', label: 'MID_SIGNAL'   },
  { color: 'text-[#39ff14]',   label: 'ACTIVE'       },
  { color: 'text-gray-500',    label: 'TRACE'        },
];

const TagCloudView = ({ handleReturnToRoot, tagIndex }) => {
  const tagList = useMemo(() => {
    return Object.entries(tagIndex)
      .map(([tag, kernels]) => ({ tag, count: kernels.length }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [tagIndex]);

  const maxCount = tagList[0]?.count || 1;
  const totalKernels = useMemo(() => {
    const ids = new Set(
      Object.values(tagIndex).flat().map(k => k.id)
    );
    return ids.size;
  }, [tagIndex]);

  return (
    <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-300">
      <button
        onClick={handleReturnToRoot}
        className="mb-8 flex items-center text-xs font-bold tracking-widest text-cyan-600 hover:text-white transition-colors border border-cyan-900/50 hover:border-cyan-500 px-3 py-2 -ml-2 w-fit uppercase bg-[#09090b] rounded-sm"
      >
        <ArrowLeft className="w-3 h-3 mr-2" /> Return_To_KERNEL
      </button>

      <div className="border-l-2 border-cyan-500/50 pl-8">
        <div className="flex flex-wrap gap-4 text-[10px] font-bold tracking-widest text-fuchsia-600 mb-8 font-mono uppercase">
          <span className="text-cyan-400">LOG: TAG_INDEX</span>
          <span>{'//'}</span>
          <span>{tagList.length} UNIQUE TAGS</span>
          <span>{'//'}</span>
          <span>{totalKernels} KERNELS INDEXED</span>
          <span>{'//'}</span>
          <span>STATUS: ACTIVE_CORPUS</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-12">
          {tagList.map(({ tag, count }) => {
            const { color, size } = tierClasses(count, maxCount);
            return (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono rounded-sm ${color} ${size}`}
              >
                {tag}
                <span className="opacity-40 text-[8px] ml-0.5 tabular-nums">{count}</span>
              </span>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-6 pt-6 border-t border-cyan-900/20 text-[10px] font-bold tracking-widest uppercase">
          {LEGEND.map(({ color, label }) => (
            <span key={label} className="flex items-center gap-2 text-gray-600">
              <span className={`${color} text-sm leading-none`}>■</span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(TagCloudView);
