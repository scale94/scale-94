// LatticeIcon.jsx — the CRYPTOGRAPHY nav glyph.
//
// The short vector: ML-KEM, the key-encapsulation scheme the tab runs, is
// lattice-based, and its security rests on how hard it is to find a short
// vector to a hidden lattice point. So: a skewed lattice (a real basis is
// never square), and one short vector reaching the hidden point. The old
// `KeyRound` was a door key, an odd emblem for post-quantum cryptography.
// A square grid with a ringed centre was tried first; at 12px it read as
// the sun icon. The dots are zero-length subpaths that round caps turn
// into points.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const LatticeIcon = React.forwardRef(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...props}
  >
    {/* the skewed lattice */}
    <path d="M4 3.5h0M10.5 5h0M17 6.5h0M6 10h0M19 13h0M14.5 18h0M21 19.5h0" />
    {/* the short vector, from a lattice point to the hidden one */}
    <path d="M8 16.5L12.5 11.5" />
    {/* the hidden point */}
    <circle cx="12.5" cy="11.5" r="1.6" />
  </svg>
));

LatticeIcon.displayName = 'LatticeIcon';

export default LatticeIcon;
