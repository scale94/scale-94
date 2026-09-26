// AirgapIcon.jsx — the PRIVACY nav glyph.
//
// The airgap enclave: a hexagonal wall broken by one physical gap, and
// inside it a sovereign node that nothing touches. The gap is honest (the
// tab discloses every vector that does reach the visitor), but it doesn't
// reach the node. The old `Lock` was a checkout-button padlock.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const AirgapIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the enclave wall, broken on the right by the airgap */}
    <path d="M19.79 9.6V7.5L12 3 4.21 7.5v9L12 21l7.79-4.5v-2.1" />
    {/* the sovereign node, untouched */}
    <path d="M12 9.5l2.5 2.5-2.5 2.5-2.5-2.5z" />
  </svg>
));

AirgapIcon.displayName = 'AirgapIcon';

export default AirgapIcon;
