// SeraphineScaleIcon.jsx — the ECOCIDE nav glyph.
//
// Seraphine's Scale: the world resting on the curved beam that cradles it,
// the same sagging-curve family SeraphineScale.jsx draws over the map. The
// beam tips at collapse and holds level through bloom. The old `Leaf` was
// the green cliché the tab's degrowth gate argues against.
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
    <circle cx="12" cy="10" r="6.5" />
    {/* the cradle beam */}
    <path d="M2 18.5Q12 22 22 18.5" />
  </svg>
));

SeraphineScaleIcon.displayName = 'SeraphineScaleIcon';

export default SeraphineScaleIcon;
