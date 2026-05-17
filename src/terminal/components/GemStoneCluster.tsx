import React, { useState } from 'react';

// ── Data Model ───────────────────────────────────────────────────────────────

type Polarity = 'LUNAR' | 'SOLAR' | 'VOID';
type EncryptionState = 'SEALED' | 'DECRYPTED';
type FacetType = 'center' | 'flank-left' | 'flank-right' | 'top-cap' | 'bottom-cap';

interface FacetNode {
  id: string;
  polarity: Polarity;
  encryptionState: EncryptionState;
  coordinates: string;
  colorRefraction: string;
  facetType: FacetType;
}

// ── Deterministic Clip Paths ─────────────────────────────────────────────────
// Five interlocking polygons that tile a bounding box with zero gap.
//
// Layout schematic (normalized to 100×100 viewport):
//
//        0,0 ─────────── 50,0 ─────────── 100,0
//         │  \   TOP-CAP   / │               │
//         │    \          /   │               │
//         │      25,30──75,30 │               │
//         │      / FLANK  \   │  FLANK-RIGHT  │
//         │    /   LEFT     \ │               │
//         │  /    CENTER      50,50           │
//         │ \                / │               │
//         │   \             /  │               │
//         │     25,70──75,70   │               │
//         │       \       /    │               │
//         │  BOTTOM-CAP  /     │               │
//        0,100────50,100──────100,100
//
// Vertices are shared across adjacent facets for seamless interlocking.

const CLIP_PATHS: Record<FacetType, string> = {
  'top-cap':
    'polygon(0% 0%, 100% 0%, 75% 42.86%, 50% 0%, 25% 42.86%)',
  'flank-left':
    'polygon(0% 0%, 25% 42.86%, 50% 50%, 25% 100%, 0% 100%)',
  'center':
    'polygon(25% 42.86%, 75% 42.86%, 75% 100%, 50% 71.43%, 25% 100%)',
  'flank-right':
    'polygon(75% 42.86%, 100% 0%, 100% 100%, 75% 100%, 50% 50%)',
  'bottom-cap':
    'polygon(0% 100%, 25% 100%, 50% 71.43%, 75% 100%, 100% 100%, 50% 100%)',
};

// ── Tight tessellation: 5 facets tile a single rhomboid cell.
// Two rows of cells create the full lattice. Each cell is positioned
// absolutely inside a relative container; cells in row 2 offset by
// half a cell width to produce the crystalline interlock.

// Per-cell facet positions (% of cell). Every facet is position:absolute
// and sized to fill the cell, then clipped.
const FACET_LAYOUT: Record<FacetType, React.CSSProperties> = {
  'top-cap':     { position: 'absolute', inset: 0 },
  'flank-left':  { position: 'absolute', inset: 0 },
  'center':      { position: 'absolute', inset: 0 },
  'flank-right': { position: 'absolute', inset: 0 },
  'bottom-cap':  { position: 'absolute', inset: 0 },
};

const POLARITY_GLYPH: Record<Polarity, string> = {
  LUNAR: '☽',
  SOLAR: '☉',
  VOID:  '◌',
};

const POLARITY_ACCENT: Record<Polarity, string> = {
  LUNAR:  'text-indigo-300/80',
  SOLAR:  'text-amber-300/80',
  VOID:   'text-neutral-500/60',
};

const ENCRYPTION_INDICATOR: Record<EncryptionState, { glyph: string; cls: string }> = {
  SEALED:    { glyph: '◈', cls: 'text-rose-400/70' },
  DECRYPTED: { glyph: '◇', cls: 'text-emerald-400/70' },
};

// ── Single Facet ─────────────────────────────────────────────────────────────

interface FacetProps {
  node: FacetNode;
}

function Facet({ node }: FacetProps) {
  const [hovered, setHovered] = useState(false);
  const enc = ENCRYPTION_INDICATOR[node.encryptionState];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute inset-0 transition-all duration-300 ease-out select-none"
      style={{ clipPath: CLIP_PATHS[node.facetType] }}
    >
      {/* Refraction layers */}
      <div
        className={`
          absolute inset-0
          bg-gradient-to-br ${node.colorRefraction}
          ${hovered ? 'opacity-100' : 'opacity-70'}
          transition-opacity duration-300
        `}
      />
      <div
        className={`
          absolute inset-0 bg-black/60
          ${hovered ? 'backdrop-blur-sm' : 'backdrop-blur-xl'}
          transition-all duration-300
        `}
      />

      {/* Internal gem edge */}
      <div
        className="absolute inset-0 ring-1 ring-inset ring-white/[0.07] shadow-inner"
        style={{ clipPath: CLIP_PATHS[node.facetType] }}
      />

      {/* Specular highlight on hover */}
      <div
        className={`
          absolute inset-0 pointer-events-none
          bg-gradient-to-tl from-transparent via-white/[0.04] to-transparent
          ${hovered ? 'opacity-100' : 'opacity-0'}
          transition-opacity duration-500
        `}
      />

      {/* Data overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none">
        <div className="flex items-center gap-1">
          <span className={`text-[7px] ${enc.cls}`}>{enc.glyph}</span>
          <span className="text-[8px] font-mono font-bold tracking-[0.15em] text-zinc-200 uppercase">
            {node.id}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[7px] ${POLARITY_ACCENT[node.polarity]}`}>
            {POLARITY_GLYPH[node.polarity]}
          </span>
          <span className="text-[6px] font-mono text-zinc-500 tracking-widest">
            {node.coordinates}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Cluster Cell ─────────────────────────────────────────────────────────────
// One rhomboid cell containing exactly 5 interlocking facets.

interface CellProps {
  facets: FacetNode[];
  style?: React.CSSProperties;
}

function Cell({ facets, style }: CellProps) {
  return (
    <div className="relative" style={{ aspectRatio: '1 / 1.4', ...style }}>
      {facets.map((f) => (
        <Facet key={f.id} node={f} />
      ))}
    </div>
  );
}

// ── GemStoneCluster ──────────────────────────────────────────────────────────

interface GemStoneClusterProps {
  nodes: FacetNode[];
  columns?: number;
}

export default function GemStoneCluster({ nodes, columns = 3 }: GemStoneClusterProps) {
  // Chunk nodes into cells of 5 (one per facet type)
  const FACET_ORDER: FacetType[] = ['top-cap', 'flank-left', 'center', 'flank-right', 'bottom-cap'];
  const cells: FacetNode[][] = [];

  for (let i = 0; i < nodes.length; i += 5) {
    const chunk = nodes.slice(i, i + 5);
    // Assign facetType deterministically if not already set correctly
    const cell = chunk.map((n, j) => ({
      ...n,
      facetType: FACET_ORDER[j % 5],
    }));
    cells.push(cell);
  }

  // Compute cell width percentage
  const cellW = 100 / columns;
  // Vertical overlap: cells interlock by 15%
  const cellH = 100 / Math.ceil(cells.length / columns);

  return (
    <div
      className="relative w-full bg-black overflow-hidden"
      style={{
        // Height scales with row count; each row ~140px base
        height: `${Math.ceil(cells.length / columns) * 180}px`,
      }}
    >
      {cells.map((cell, idx) => {
        const col = idx % columns;
        const row = Math.floor(idx / columns);
        // Odd rows offset half a cell for crystalline interlock
        const xOffset = row % 2 === 1 ? cellW / 2 : 0;
        const left = col * cellW + xOffset;
        // Vertical overlap: -12% per row for tight packing
        const top = row * 78;

        return (
          <Cell
            key={cell[0]?.id ?? idx}
            facets={cell}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: `${top}px`,
              width: `${cellW}%`,
            }}
          />
        );
      })}

      {/* Lattice vignette overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/30 via-transparent to-black/50" />
    </div>
  );
}

// ── Default dataset for standalone rendering ─────────────────────────────────

export const GEMSTONE_DEMO_DATA: FacetNode[] = [
  // Cell 1
  { id: 'AES-256',         polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-emerald-500/20 to-transparent',  facetType: 'top-cap' },
  { id: 'CISTUS',          polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-violet-500/25 to-transparent',   facetType: 'flank-left' },
  { id: 'CIVET',           polarity: 'SOLAR', encryptionState: 'SEALED',    coordinates: 'RTA',  colorRefraction: 'from-rose-500/20 to-transparent',     facetType: 'center' },
  { id: 'ML-KEM',          polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-cyan-500/20 to-transparent',     facetType: 'flank-right' },
  { id: 'OAKMOSS',         polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-emerald-700/20 to-transparent',  facetType: 'bottom-cap' },
  // Cell 2
  { id: 'ARGON2',          polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-indigo-500/20 to-transparent',   facetType: 'top-cap' },
  { id: 'NEROLI',          polarity: 'SOLAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-amber-500/20 to-transparent',    facetType: 'flank-left' },
  { id: 'AMBERGRIS',       polarity: 'LUNAR', encryptionState: 'SEALED',    coordinates: 'RTA',  colorRefraction: 'from-stone-500/20 to-transparent',    facetType: 'center' },
  { id: 'BLAKE3',          polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-sky-500/20 to-transparent',      facetType: 'flank-right' },
  { id: 'SAFFRON',         polarity: 'SOLAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-orange-500/20 to-transparent',   facetType: 'bottom-cap' },
  // Cell 3
  { id: 'ED25519',         polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-fuchsia-500/20 to-transparent',  facetType: 'top-cap' },
  { id: 'VETIVER',         polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'RTA',  colorRefraction: 'from-lime-500/20 to-transparent',     facetType: 'flank-left' },
  { id: 'CASTOREUM',       polarity: 'SOLAR', encryptionState: 'SEALED',    coordinates: 'DPA',  colorRefraction: 'from-red-500/20 to-transparent',      facetType: 'center' },
  { id: 'SHA3-512',        polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-teal-500/20 to-transparent',     facetType: 'flank-right' },
  { id: 'OUD',             polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'RTA',  colorRefraction: 'from-yellow-700/20 to-transparent',   facetType: 'bottom-cap' },
  // Cell 4 (second row — offset)
  { id: 'PQHASH',          polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-purple-500/20 to-transparent',   facetType: 'top-cap' },
  { id: 'LABDANUM',        polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-amber-700/20 to-transparent',    facetType: 'flank-left' },
  { id: 'ARAPAIMA',        polarity: 'SOLAR', encryptionState: 'SEALED',    coordinates: 'RTA',  colorRefraction: 'from-zinc-400/15 to-transparent',     facetType: 'center' },
  { id: 'HMAC-256',        polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-emerald-400/20 to-transparent',  facetType: 'flank-right' },
  { id: 'MYRRH',           polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-stone-600/20 to-transparent',    facetType: 'bottom-cap' },
  // Cell 5
  { id: 'KYBER',           polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-blue-500/20 to-transparent',     facetType: 'top-cap' },
  { id: 'BENZOIN',         polarity: 'SOLAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-orange-700/20 to-transparent',   facetType: 'flank-left' },
  { id: 'PLATA',           polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'RTA',  colorRefraction: 'from-neutral-400/15 to-transparent',  facetType: 'center' },
  { id: 'DILITHIUM',       polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-violet-400/20 to-transparent',   facetType: 'flank-right' },
  { id: 'FRANKINCENSE',    polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'DPA',  colorRefraction: 'from-yellow-500/20 to-transparent',   facetType: 'bottom-cap' },
  // Cell 6
  { id: 'GCM-IV',          polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-cyan-600/20 to-transparent',     facetType: 'top-cap' },
  { id: 'TONKA',           polarity: 'SOLAR', encryptionState: 'DECRYPTED', coordinates: 'RTA',  colorRefraction: 'from-amber-600/20 to-transparent',    facetType: 'flank-left' },
  { id: 'MOIRE',           polarity: 'SOLAR', encryptionState: 'SEALED',    coordinates: 'DPA',  colorRefraction: 'from-pink-500/15 to-transparent',     facetType: 'center' },
  { id: 'SPHINCS+',        polarity: 'VOID',  encryptionState: 'SEALED',    coordinates: 'R2A',  colorRefraction: 'from-green-500/20 to-transparent',    facetType: 'flank-right' },
  { id: 'PATCHOULI',       polarity: 'LUNAR', encryptionState: 'DECRYPTED', coordinates: 'RTA',  colorRefraction: 'from-emerald-800/20 to-transparent',  facetType: 'bottom-cap' },
];
