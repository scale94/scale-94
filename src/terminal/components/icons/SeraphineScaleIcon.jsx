// SeraphineScaleIcon.jsx — the ECOCIDE nav glyph.
//
// Seraphine's Scale: the world resting on the curved cradle that holds it,
// the same sagging-curve family SeraphineScale.jsx draws over the map. The
// tab's scale tips at collapse and holds level through bloom. The old `Leaf` was
// the green cliché the tab's degrowth gate argues against.
// The cradle rises past the world's lower half and the world carries an
// equator: a circle over a shallow arc reads as a head over shoulders (a
// generic user icon) at nav size, which the first cut did.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const SeraphineScaleIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the world */}
    <circle cx="12" cy="9.5" r="6" />
    {/* its equator */}
    <path d="M6 9.5h12" />
    {/* the cradle */}
    <path d="M2.5 13.5Q12 24.5 21.5 13.5" />
  </svg>
));

SeraphineScaleIcon.displayName = 'SeraphineScaleIcon';

export default SeraphineScaleIcon;
