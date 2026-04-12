import React from 'react';
import { X } from 'lucide-react';
import { NODE_IDX, FEATURES, DIM_NAMES } from '../../data/nodeFeatures';
import { CHAPTER_BY_ID } from '../../data/manifestoChapters';

/**
 * BeaconCard — inline-expansion card for a selected beacon.
 * On desktop: floating card centered on the viewport (positioned by CSS transform).
 * On mobile: bottom sheet covering the lower 60% of the viewport.
 */
const BeaconCard = ({ beacon, onClose, isMobile }) => {
  if (!beacon) return null;

  const idx = NODE_IDX[beacon.nodeId];
  const tensor = FEATURES[idx] || [];
  const chapter = CHAPTER_BY_ID[beacon.chapter];

  // Find the two highest-magnitude dims to color the tensor bars.
  const ranked = tensor.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const top1 = ranked[0]?.i ?? 0;
  const top2 = ranked[1]?.i ?? 1;

  const containerClass = isMobile
    ? 'fixed left-0 right-0 bottom-0 h-[60vh] bg-black/95 border-t border-cyan-900/50 p-6 overflow-y-auto'
    : 'absolute bg-black/95 border border-cyan-900/50 rounded-sm p-5 shadow-2xl';

  const containerStyle = isMobile
    ? { zIndex: 40 }
    : {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: '400px',
        maxHeight: '280px',
        zIndex: 40,
      };

  return (
    <div className={containerClass} style={containerStyle}>
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-cyan-400 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-sm font-bold" style={{ color: beacon.color }}>
          {beacon.nodeId}
        </span>
        <span className="font-mono text-[10px] text-cyan-500 opacity-70">
          sector: {beacon.cluster}
        </span>
        <span className="font-mono text-[10px] text-fuchsia-500 opacity-70 ml-auto">
          {chapter?.number} {chapter?.title}
        </span>
      </div>

      {/* Tensor strip — 32 tiny vertical bars. */}
      <div className="flex gap-[2px] items-end mb-4 h-[24px]">
        {tensor.map((v, i) => (
          <div
            key={i}
            title={`${DIM_NAMES[i] ?? `dim_${i}`}: ${v.toFixed(2)}`}
            style={{
              width: '6px',
              height: `${Math.max(2, v * 24)}px`,
              backgroundColor: i === top1 ? '#39ff14' : i === top2 ? '#06b6d4' : '#164e63',
              opacity: i === top1 || i === top2 ? 0.95 : 0.55,
            }}
          />
        ))}
      </div>

      {/* Quote. */}
      <p className="font-mono text-xs text-[#39ff14] leading-relaxed">
        "{beacon.quote}"
      </p>
    </div>
  );
};

export default React.memo(BeaconCard);
