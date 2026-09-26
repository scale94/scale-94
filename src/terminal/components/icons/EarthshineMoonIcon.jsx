// EarthshineMoonIcon.jsx — the LUNAR nav glyph.
//
// A waxing crescent, lit on the right, with the rest of the disc drawn in
// earthshine: a faint 1px limb, so the glyph reads as a whole moon in
// transit rather than the weather-app crescent the old `Moon` was. The tab
// computes the true phase; this is the phase the glyph shows.
//
// The earthshine path is deliberately 1px at 55% opacity, the one stroke in
// the nav bar that is not 2px. At 2px it reads as a full disc and the
// crescent disappears. Do not normalise it.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const EarthshineMoonIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the waxing crescent, lit on the right */}
    <path d="M12 3a9 9 0 0 1 0 18a5 9 0 0 0 0-18z" />
    {/* the dark limb, in earthshine */}
    <path d="M12 3a9 9 0 0 0 0 18" strokeWidth="1" opacity="0.55" />
  </svg>
));

EarthshineMoonIcon.displayName = 'EarthshineMoonIcon';

export default EarthshineMoonIcon;
