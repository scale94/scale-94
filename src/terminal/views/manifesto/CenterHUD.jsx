import React from 'react';

/**
 * CenterHUD — the ◉ pupil that sits at the mandala center and absorbs
 * all informative chrome. Three states:
 *   - idle: observer / architect / thesis lines
 *   - hover: beacon id + quote (or chapter id + epigraph)
 *   - selected: × close affordance while a card is open
 *
 * All three states render inside a circular black disk with a
 * subtle stroke, visually reading as the mandala's pupil.
 */
const CenterHUD = ({
  radius,
  hover,          // { type: 'beacon' | 'chapter', data: object } | null
  selected,       // truthy if a beacon card is currently open
  onOpenThesis,
  onClose,
}) => {
  const clickable = !selected && hover == null;

  return (
    <g
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      onClick={
        selected
          ? onClose
          : (hover == null ? onOpenThesis : undefined)
      }
    >
      <circle
        r={radius}
        fill="rgba(0,0,0,0.6)"
        stroke="#164e63"
        strokeWidth="0.5"
      />
      {selected && (
        <text
          y="3"
          textAnchor="middle"
          fill="#f87171"
          fontFamily="monospace"
          fontSize="9"
        >
          × close
        </text>
      )}

      {!selected && hover == null && (
        <g textAnchor="middle" fontFamily="monospace" fontSize="8">
          <text y="-18" fill="#06b6d4" fontSize="12">◉</text>
          <text y="-4" fill="#06b6d4" opacity="0.75">observer: mercury</text>
          <text y="7"  fill="#06b6d4" opacity="0.6">architect: active</text>
          <text y="18" fill="#06b6d4" opacity="0.6">thesis: still running</text>
          <text y="30" fill="#06b6d4" opacity="0.5">↻</text>
        </g>
      )}

      {!selected && hover?.type === 'beacon' && (
        <g textAnchor="middle" fontFamily="monospace">
          <text y="-18" fill="#06b6d4" fontSize="12">◉</text>
          <text y="-4" fill="#06b6d4" fontSize="9" fontWeight="bold">{hover.data.nodeId}</text>
          <text y="7"  fill="#06b6d4" fontSize="7" opacity="0.6">sector: {hover.data.cluster}</text>
          <text y="20" fill="#39ff14" fontSize="7">
            {hover.data.quote.length > 32
              ? hover.data.quote.slice(0, 30) + '…'
              : hover.data.quote}
          </text>
        </g>
      )}

      {!selected && hover?.type === 'chapter' && (
        <g textAnchor="middle" fontFamily="monospace">
          <text y="-18" fill="#06b6d4" fontSize="12">◉</text>
          <text y="-4" fill="#06b6d4" fontSize="9" fontWeight="bold">
            {hover.data.number} {hover.data.title}
          </text>
          <text y="14" fill="#39ff14" fontSize="7">
            {hover.data.epigraph.length > 36
              ? hover.data.epigraph.slice(0, 34) + '…'
              : hover.data.epigraph}
          </text>
        </g>
      )}
    </g>
  );
};

export default React.memo(CenterHUD);
