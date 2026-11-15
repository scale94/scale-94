import React from 'react';

// A disc with one twisted arch of field lifting off its upper-right limb: the
// star, and the loop of flux pulled out of its surface. No rays, so it cannot
// read as a generic sun. Three strokes keep it legible at w-3 h-3 (12px). Stroke
// language matches lucide-react so it sits correctly in the nav row. Two strokes.
const SolGlyph = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* the disc */}
    <circle cx="10" cy="14" r="7" />
    {/* one arch: leaves the limb at upper right, rises, and returns to the limb
        on a crossing path so the loop carries a visible twist */}
    <path d="M14 8.5C15 2.5 22 3 21 7C20 10 16 6 17.5 11" />
  </svg>
);

export default SolGlyph;
