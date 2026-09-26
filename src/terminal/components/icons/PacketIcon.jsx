// PacketIcon.jsx — the TRANSMISSION nav glyph.
//
// A packet in flight: one diamond heading out, with a split slipstream
// behind it. The tab is a dispatch pipeline (the inverse-extinction
// harvest, telemetry sent onward), so the glyph is directional, not
// broadcast. It replaces the desktop `⌖` text and the mobile `Radio`, which
// never matched. Two wake lines, not three: a longer middle line made the
// wake converge into a fast-forward chevron at 12px.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const PacketIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the split slipstream */}
    <path d="M2 9h7" />
    <path d="M2 15h7" />
    {/* the packet, heading out */}
    <path d="M17 6.5l5.5 5.5-5.5 5.5-5.5-5.5z" />
  </svg>
));

PacketIcon.displayName = 'PacketIcon';

export default PacketIcon;
