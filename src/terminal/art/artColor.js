// artColor.js — colour conversions, and nothing else.
//
// A LEAF, DELIBERATELY. This module imports nothing, which is the whole
// reason it exists: writeHsl lived in SphereEdges.js, and SphereEdges.js
// consumes artEdges.js constants at module top level to size its buffers. A
// back-import from artEdges.js would have closed that loop and put those
// top-level consts in the temporal dead zone -- a real crash, not a lint
// smell. Anything both the drawing arithmetic and the GL layer need belongs
// here rather than in either of them.

/** The same conversion from loose numbers, for the ortho bridge's synthesised
 *  hues — it never had a colour object, and building one per edge per frame
 *  would put the draw loop back on the allocation path. */
export function writeHsl(out, o, hue, sat, lit) {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, sat / 100));
  const l = Math.min(1, Math.max(0, lit / 100));
  const a = s * Math.min(l, 1 - l);
  // The CSS Color 4 reference implementation, verbatim.
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  out[o]     = f(0);
  out[o + 1] = f(8);
  out[o + 2] = f(4);
}
