// InterceptIcon.jsx — the SURVEILLANCE nav glyph.
//
// The tap: a packet's route runs through an intercept node and still
// arrives, while a copy of it drops away to where it is kept. That is what
// the tab's intercept lattice does to every route the laws in force touch.
// The old `ShieldAlert` said "warning"; this tab is about interception.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const InterceptIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the route in */}
    <path d="M2 9h7" />
    {/* the route out: the packet still arrives */}
    <path d="M15 9h7" />
    {/* the intercept node */}
    <circle cx="12" cy="9" r="3" />
    {/* the tapped copy, dropping away */}
    <path d="M12 12v7" />
    {/* where the copy is kept */}
    <path d="M8.5 21h7" />
  </svg>
));

InterceptIcon.displayName = 'InterceptIcon';

export default InterceptIcon;
