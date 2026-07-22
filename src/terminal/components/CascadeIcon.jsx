// CascadeIcon.jsx — the CHAOS tab glyph.
//
// The period-doubling cascade: one branch forks to two, two fork to four.
// This is the Feigenbaum bifurcation the tab actually runs (see ArtTab's
// FEIGENBAUM_FADE / R_CHAOS), not a decorative squiggle — the old `Waves`
// glyph read as air or water, which the tab has never been about.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside Hexagon / Leaf / Lock / KeyRound
// and inherits className + style exactly like its neighbours do.

import React from 'react';

const CascadeIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    className={className}
    {...props}
  >
    {/* r below the first bifurcation — a single fixed point */}
    <path d="M2 12h4" />
    {/* period 2 */}
    <path d="M6 12c3.5 0 1.5-5 5-5" />
    <path d="M6 12c3.5 0 1.5 5 5 5" />
    {/* period 4 */}
    <path d="M11 7c3.5 0 1.5-3 5-3" />
    <path d="M11 7c3.5 0 1.5 3 5 3" />
    <path d="M11 17c3.5 0 1.5-3 5-3" />
    <path d="M11 17c3.5 0 1.5 3 5 3" />
  </svg>
));

CascadeIcon.displayName = 'CascadeIcon';

export default CascadeIcon;
