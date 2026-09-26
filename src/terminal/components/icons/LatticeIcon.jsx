// LatticeIcon.jsx — the CRYPTOGRAPHY nav glyph.
//
// The hidden lattice point: ML-KEM, the key-encapsulation scheme the tab
// runs, is lattice-based, and its secret is a point hidden in a lattice.
// Eight lattice points, and the ringed one at the centre. The old
// `KeyRound` was a door key, an odd emblem for post-quantum cryptography.
// The dots are zero-length subpaths that the round caps turn into points.
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
    {/* the lattice */}
    <path d="M5 5h0M12 5h0M19 5h0M5 12h0M19 12h0M5 19h0M12 19h0M19 19h0" />
    {/* the hidden point */}
    <path d="M12 12h0" />
    {/* the ring that marks it */}
    <circle cx="12" cy="12" r="3.5" />
  </svg>
));

LatticeIcon.displayName = 'LatticeIcon';

export default LatticeIcon;
