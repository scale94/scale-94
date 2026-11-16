import React from 'react';

// The star's limb: a disc larger than the icon, cropped by the svg's own edge,
// with one loop of field standing on it, both feet on the surface and the two
// legs crossing once (the twist). No rays, so it cannot read as a generic sun.
// The disc is cropped because a small whole circle with a loop at its upper
// right reads as the male symbol at 12px. Two strokes stay legible at w-3 h-3.
// Stroke language matches lucide-react so it sits correctly in the nav row.
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
    {/* the limb (extends past the left and bottom edges; the svg crops it) */}
    <circle cx="8" cy="18" r="9" />
    {/* the loop: foot to foot on the limb, legs crossing once */}
    <path d="M11.8 9.8C16 9.5 23 10 21.5 5C20.5 1.5 15.5 3 16.2 14.2" />
  </svg>
);

export default SolGlyph;
