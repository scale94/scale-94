// KernelCoreIcon.jsx — the KERNEL nav glyph.
//
// A processor package with its bus pins, but the die at its centre is a
// diamond, not the generic square of every chip icon: this is the kernel
// that compiles the site's lore into running code, not any CPU. The old
// `Cpu` was that generic chip, stroke for stroke.
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
    {/* the bus pins, two per side */}
    <path d="M9 1.5v2.5M15 1.5v2.5M9 20v2.5M15 20v2.5M1.5 9h2.5M1.5 15h2.5M20 9h2.5M20 15h2.5" />
  </svg>
));

KernelCoreIcon.displayName = 'KernelCoreIcon';

export default KernelCoreIcon;
