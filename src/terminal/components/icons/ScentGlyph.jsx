import React from 'react';

// One droplet, one rising wisp. Spec §3.1: at w-3 h-3 (12px) only two or
// three strokes stay legible, so the two-droplets-merging glyph considered
// first is deliberately not built. Stroke language matches lucide-react so
// this sits correctly beside <Lock>, <Radio> and <Moon> in the same nav row.
const ScentGlyph = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {/* droplet */}
    <path d="M12 22a5 5 0 0 1-5-5c0-2.5 5-8 5-8s5 5.5 5 8a5 5 0 0 1-5 5Z" />
    {/* wisp rising from it */}
    <path d="M12 6c2-1.2 2-2.8 0-4" />
  </svg>
);

export default ScentGlyph;
