import React from 'react';

// A small disc with one loop of field standing on its upper-right limb: both
// feet of the loop sit on the limb and its two legs cross once just above the
// surface, which is the twist. No rays, so it cannot read as a generic sun, and
// the two-footed loop keeps it from reading as a circle with a single spoke.
// Two strokes stay legible at w-3 h-3 (12px). Stroke language matches
// lucide-react so it sits correctly in the nav row.
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
    <circle cx="9" cy="15" r="6" />
    {/* the loop: foot to foot on the limb, legs crossing once */}
    <path d="M11.5 9.6C15 9 22 9 20.5 4.5C19.5 1.5 15 3 14.4 12.5" />
  </svg>
);

export default SolGlyph;
