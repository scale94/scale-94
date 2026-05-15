// chimeraGlyph.js — Pure procedural SVG sigil generator for Olfactory Collider accords.
// Deterministic from accord SHA-256 hash + OCK dim values.
//
// Output: 240x240 SVG string, transparent background.
//   - Outer ring with 16 anchor points (one per OCK dim)
//   - Inner geometry: 16 chords whose endpoints encode dim contributions
//   - Center mark: N-pointed star (3=RTA, 4=DPA, 5=R2A)
//   - Hash stamp: last 8 hex chars at bottom edge

const DIM_ORDER = [
  'dynamical','nonlinearity','dimensionality','criticality',
  'entropy','synchrony','conservation','temporal',
  'spatial','stochastic','game_theory','thermodynamic',
  'information','cryptographic','biological','economic',
];

function dimValue(name, dims) {
  const c = dims.convergence?.find(x => x.name === name);
  if (c) return Math.min(1, c.contrib);
  const d = dims.divergence?.find(x => x.name === name);
  if (d) return Math.min(1, d.delta);
  const p = dims.paradoxes?.find(x => x.name === name);
  if (p) return Math.min(1, p.residual);
  return 0;
}

function nPointStar(cx, cy, n, r, rotDeg) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rotDeg * Math.PI) / 180;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function buildChimeraGlyph({ accordHash, dims, hueA, hueB, viability, nodeClass }) {
  const cx = 120, cy = 120, R = 100;
  const safeHash = (accordHash || '0'.repeat(64)).toLowerCase();
  const hashRotation = parseInt(safeHash.slice(0, 4), 16) % 16;
  const hueMid = ((hueA + hueB) / 2) % 360;
  const visOpacity = Math.min(1, Math.max(0.3, viability / 10));

  // Inner geometry — 16 chords
  const chords = [];
  for (let i = 0; i < 16; i++) {
    const dimIdx = (i + hashRotation) % 16;
    const dimName = DIM_ORDER[dimIdx];
    const value = dimValue(dimName, dims);
    if (value < 0.05) continue;
    const a1 = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const targetIdx = (i + Math.round(value * 16)) % 16;
    const a2 = (targetIdx / 16) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
    const x2 = cx + Math.cos(a2) * R, y2 = cy + Math.sin(a2) * R;
    const opacity = (0.2 + value * 0.7).toFixed(2);
    const width = (0.6 + value * 1.8).toFixed(2);
    chords.push(`<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="url(#cg-grad-${i})" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round"/>`);
  }

  // Per-chord gradients
  const grads = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * 360;
    grads.push(`<linearGradient id="cg-grad-${i}" gradientTransform="rotate(${angle.toFixed(1)})"><stop offset="0%" stop-color="hsl(${hueA.toFixed(0)},70%,55%)"/><stop offset="100%" stop-color="hsl(${hueB.toFixed(0)},70%,55%)"/></linearGradient>`);
  }

  // Center star
  const starN = nodeClass === 'DPA' ? 4 : nodeClass === 'R2A' ? 5 : 3;
  const starRot = parseInt(safeHash.slice(4, 6), 16);
  const starPts = nPointStar(cx, cy, starN, 18, starRot);
  const starColor = `hsla(${hueMid.toFixed(0)},60%,50%,${visOpacity.toFixed(2)})`;

  // Outer ring (dashed pattern from hash bytes 6..14)
  const dashBytes = [];
  for (let i = 6; i < 14; i += 2) dashBytes.push(parseInt(safeHash.slice(i, i + 2), 16) % 24 + 2);
  const dashArray = dashBytes.join(' ');
  const ringColor = `hsla(${hueMid.toFixed(0)},30%,50%,0.4)`;

  // Hash stamp (last 8 hex chars, uppercase)
  const stamp = safeHash.slice(-8).toUpperCase();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">` +
    `<defs>${grads.join('')}</defs>` +
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${ringColor}" stroke-width="0.8" stroke-dasharray="${dashArray}"/>` +
    `${chords.join('')}` +
    `<polygon points="${starPts}" fill="${starColor}" stroke="hsl(${hueMid.toFixed(0)},70%,60%)" stroke-width="0.5"/>` +
    `<text x="${cx}" y="230" font-family="Courier New, monospace" font-size="7" fill="rgba(255,215,0,0.4)" text-anchor="middle" letter-spacing="2">${stamp}</text>` +
    `</svg>`;
}

// Synthesize plausible dims from a hash alone (used by /api/sigil/[hash] when dims not available)
export function synthDimsFromHash(hash) {
  const safe = (hash || '0'.repeat(64)).toLowerCase();
  const conv = [], div = [], para = [];
  for (let i = 0; i < 16; i++) {
    const byte = parseInt(safe.slice(i * 2, i * 2 + 2), 16);
    const name = DIM_ORDER[i];
    const value = byte / 255;
    if (value > 0.66) conv.push({ name, contrib: value });
    else if (value > 0.33) div.push({ name, delta: value });
    else para.push({ name, residual: value });
  }
  return { convergence: conv, divergence: div, paradoxes: para };
}
