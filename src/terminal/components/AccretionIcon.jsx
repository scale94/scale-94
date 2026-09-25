// AccretionIcon.jsx — the ACCRETION tab glyph.
//
// Gargantua in three strokes, matching what the tab renders (CouncilField):
// the lensed far side of the disk arching over the hole, the shadow, and the
// near side of the 80°-inclined disk crossing in front. The old `Eye` glyph
// belonged to the manifesto; this tab is a black hole now.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const AccretionIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the far side of the disk, lensed up over the shadow */}
    <path d="M4.6 12.2a7.4 7 0 0 1 14.8 0" />
    {/* the shadow */}
    <circle cx="12" cy="12.4" r="3.1" />
    {/* the near side of the disk, seen almost edge-on */}
    <ellipse cx="12" cy="12.6" rx="10" ry="2.5" />
  </svg>
));

AccretionIcon.displayName = 'AccretionIcon';

export default AccretionIcon;
