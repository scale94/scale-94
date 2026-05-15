// api/sigil/[hash].js — Public deterministic glyph endpoint.
// Renders a Chimera Glyph SVG from a 64-char SHA-256 hash alone.
// Uses synthDimsFromHash to fabricate plausible OCK dims when the real
// collision data isn't available — meant for sharing/embedding, not authenticity.

import { buildChimeraGlyph, synthDimsFromHash } from '../../src/terminal/views/chimeraGlyph.js';

export default function handler(req, res) {
  const { hash } = req.query;
  const safe = (typeof hash === 'string' ? hash : '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(safe)) {
    res.setHeader('Content-Type', 'text/plain');
    res.status(400).send('hash must be 64 hex chars');
    return;
  }
  const dims = synthDimsFromHash(safe);
  const hueA = parseInt(safe.slice(0, 2), 16) * (360 / 256);
  const hueB = parseInt(safe.slice(2, 4), 16) * (360 / 256);
  const nodeClass = ['RTA','DPA','R2A'][parseInt(safe.slice(4, 6), 16) % 3];
  const svg = buildChimeraGlyph({ accordHash: safe, dims, hueA, hueB, viability: 5, nodeClass });
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.status(200).send(svg);
}
