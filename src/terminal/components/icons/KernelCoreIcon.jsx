// KernelCoreIcon.jsx — the KERNEL nav glyph.
//
// A processor package with its bus pins, but the die at its centre is a
// diamond, not the generic square of every chip icon: this is the kernel
// that compiles the site's lore into running code, not any CPU. The old
// `Cpu` was that generic chip, stroke for stroke. Pins run along the top and
// bottom edges only (a DIP package): with pins on all four sides the glyph
// blurred into a gear/settings cog at 12px.
//
// Drawn to lucide-react's grammar (24 viewBox, 2px stroke, round caps,
// currentColor) so it sits flush beside its neighbours and inherits
// className + style exactly like they do.

import React from 'react';

const KernelCoreIcon = React.forwardRef(({ className, ...props }, ref) => (
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
    {/* the package frame */}
    <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    {/* the diamond die */}
    <path d="M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5z" />
    {/* the bus pins, top and bottom only (a DIP package) */}
    <path d="M8 1.5v2.5M12 1.5v2.5M16 1.5v2.5M8 20v2.5M12 20v2.5M16 20v2.5" />
  </svg>
));

KernelCoreIcon.displayName = 'KernelCoreIcon';

export default KernelCoreIcon;
