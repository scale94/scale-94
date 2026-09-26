// LedgerSealIcon.jsx — the LEDGER nav glyph.
//
// A river written into the ledger: the site a visitor submits, flowing over
// ruled lines, and the newest entry, short and still being written, with
// its verdict's seal pressed into the gap beside it. It replaces the `ᛟ`
// text glyph, which rendered in whatever font the browser picked, so its
// weight never matched the bar. ᛟ stays in-tab as the axiomatic-law marker.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const LedgerSealIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the river */}
    <path d="M3 6q2.25-3.5 4.5 0t4.5 0t4.5 0t4.5 0" />
    {/* a ruled ledger line */}
    <path d="M3 12h18" />
    {/* the newest entry, still being written */}
    <path d="M3 19h9" />
    {/* its seal */}
    <circle cx="18.5" cy="19" r="2.5" />
  </svg>
));

LedgerSealIcon.displayName = 'LedgerSealIcon';

export default LedgerSealIcon;
