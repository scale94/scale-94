// LedgerMap.jsx — World map for the Ledger tab
// Renders animated pulse markers for each verdict using the shared WorldMap component.
// Follows the EcocideTab marker pattern exactly.

import { useState, useEffect } from 'react';
import WorldMap from '../../components/WorldMap';
import { toMapXY } from '../../data/worldMapPolys';

// ── Status → colour ────────────────────────────────────────────────────────────
const STATUS_COLOR = {
  APPROVED:       '#22c55e',
  CONDITIONAL:    '#eab308',
  REJECTED:       '#ef4444',
  EMERGENCY_VETO: '#ef4444',
};

const DEFAULT_COLOR = '#38bdf8'; // fallback sky-blue for unknown statuses

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toISOString().slice(0, 10);
  } catch {
    return String(ts).slice(0, 10);
  }
}

function statusLabel(status) {
  if (!status) return 'UNKNOWN';
  return status.replace(/_/g, ' ');
}

// How many verdicts of each status exist
function buildSummary(verdicts) {
  const counts = {};
  for (const v of verdicts) {
    const s = v.status || 'UNKNOWN';
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

// ── Component ──────────────────────────────────────────────────────────────────
// Props:
//   verdicts    — array of verdict objects:
//                 { hash, status, coordinates: { lat, lon }, input: { siteName }, timestamp }
//   latestHash  — hash of the most recently added verdict (for highlight animation)
//   height      — map height in px (default 320)
//   booted      — boolean, controls fade-in animation
const LedgerMap = ({ verdicts = [], latestHash = null, height = 320, booted = true }) => {
  const [tooltip, setTooltip] = useState(null); // { cx, cy, verdict }
  const [revealCount, setRevealCount] = useState(0);

  // Stagger markers in during boot — 60ms apart
  useEffect(() => {
    if (!booted || verdicts.length === 0) return;
    if (revealCount >= verdicts.length) return;
    const timer = setTimeout(() => {
      setRevealCount(prev => Math.min(prev + 1, verdicts.length));
    }, 60);
    return () => clearTimeout(timer);
  }, [booted, revealCount, verdicts.length]);

  // Ensure new verdicts added after boot are immediately visible
  useEffect(() => {
    if (booted && revealCount > 0 && revealCount < verdicts.length) {
      setRevealCount(verdicts.length);
    }
  }, [verdicts.length]);

  const summary = buildSummary(verdicts);

  // Build summary line, e.g. "12 APPROVED · 3 REJECTED · 1 CONDITIONAL"
  const summaryParts = Object.entries(summary).map(
    ([s, n]) => `${n} ${statusLabel(s)}`
  );

  return (
    <div
      style={{
        opacity: booted ? 1 : 0,
        transition: 'opacity 0.8s ease',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes ledger-marker-pop {
          0%   { opacity: 0; transform: scale(0.3); }
          60%  { opacity: 1; transform: scale(1.3); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <WorldMap palette="green" height={height} scanDur={9}>

        {/* ── Verdict markers — staggered reveal on boot ────────────── */}
        {verdicts.slice(0, revealCount).map((verdict, idx) => {
          const { hash, status, coordinates, input, timestamp } = verdict;
          if (!coordinates) return null;

          const { lat, lon } = coordinates;
          const [cx, cy] = toMapXY(lon, lat);
          const color = STATUS_COLOR[status] || DEFAULT_COLOR;
          const isLatest = hash && hash === latestHash;
          const r = isLatest ? 5 : 3.5;

          return (
            <g
              key={hash || `${lat}-${lon}`}
              style={{
                cursor: 'pointer',
                opacity: 0,
                animation: `ledger-marker-pop 0.4s ${idx * 0.06}s cubic-bezier(0.16,1,0.3,1) forwards`,
                transformBox: 'fill-box',
                transformOrigin: 'center',
              }}
              onMouseEnter={() => setTooltip({ cx, cy, verdict })}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Outer pulse ring */}
              <circle cx={cx} cy={cy} r={r + 4} fill={color} opacity="0.12">
                <animate
                  attributeName="r"
                  values={isLatest
                    ? `${r + 12};${r + 6};${r + 4};${r + 4}`
                    : `${r + 2};${r + 8};${r + 2}`}
                  dur={isLatest ? '1.8s' : '3s'}
                  repeatCount={isLatest ? '3' : 'indefinite'}
                />
                <animate
                  attributeName="opacity"
                  values={isLatest ? '0.5;0.2;0.12;0.12' : '0.12;0.04;0.12'}
                  dur={isLatest ? '1.8s' : '3s'}
                  repeatCount={isLatest ? '3' : 'indefinite'}
                />
              </circle>

              {/* Core dot */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                opacity={isLatest ? '1' : '0.82'}
              >
                {isLatest ? (
                  <>
                    <animate
                      attributeName="r"
                      values={`${r + 4};${r + 2};${r}`}
                      dur="0.6s"
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      values="1;0.95;0.82"
                      dur="0.6s"
                      fill="freeze"
                    />
                  </>
                ) : (
                  <animate
                    attributeName="r"
                    values={`${r};${r + 1.5};${r}`}
                    dur="3s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>

              {/* Flash ring on latest — fades out */}
              {isLatest && (
                <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={color} strokeWidth="1.5">
                  <animate attributeName="r" values={`${r + 4};${r + 14}`} dur="0.8s" fill="freeze" />
                  <animate attributeName="opacity" values="0.9;0" dur="0.8s" fill="freeze" />
                </circle>
              )}
            </g>
          );
        })}

        {/* ── Tooltip (inline SVG) ────────────────────────────────────── */}
        {tooltip && (() => {
          const { cx, cy, verdict } = tooltip;
          const { status, input, timestamp } = verdict;
          const color = STATUS_COLOR[status] || DEFAULT_COLOR;
          const siteName = input?.siteName || '';
          const line1 = siteName || statusLabel(status);
          const line2 = siteName ? statusLabel(status) : fmtDate(timestamp);
          const line3 = siteName ? fmtDate(timestamp) : null;

          const tw = 170;
          const th = line3 ? 46 : 34;
          let tx = cx + 12;
          let ty = cy - th - 8;
          if (tx + tw > 790) tx = cx - tw - 12;
          if (ty < 4) ty = cy + 12;

          return (
            <g key="ledger-tooltip" pointerEvents="none">
              <rect
                x={tx} y={ty} width={tw} height={th} rx="2"
                fill="rgba(0,0,0,0.90)"
                stroke={color}
                strokeWidth="0.7"
                strokeOpacity="0.8"
              />
              <text x={tx + 7} y={ty + 12} fill={color} fontSize="8.5" fontFamily="monospace" fontWeight="bold" opacity="0.95">
                {line1}
              </text>
              <text x={tx + 7} y={ty + 24} fill={color} fontSize="7" fontFamily="monospace" opacity="0.7">
                {line2}
              </text>
              {line3 && (
                <text x={tx + 7} y={ty + 36} fill={color} fontSize="6.5" fontFamily="monospace" opacity="0.55">
                  {line3}
                </text>
              )}
            </g>
          );
        })()}

        {/* ── Bottom-left: verdict count + summary ───────────────────── */}
        <g pointerEvents="none">
          <text
            x="8" y="388"
            fill="rgba(57,255,20,0.55)"
            fontSize="6.5"
            fontFamily="monospace"
          >
            {verdicts.length} VERDICT{verdicts.length !== 1 ? 'S' : ''} RECORDED
            {summaryParts.length > 0 ? `  ·  ${summaryParts.join('  ·  ')}` : ''}
          </text>
        </g>

        {/* ── Top-right: label ────────────────────────────────────────── */}
        <g pointerEvents="none">
          <text
            x="792" y="14"
            textAnchor="end"
            fill="rgba(57,255,20,0.35)"
            fontSize="7"
            fontFamily="monospace"
            letterSpacing="1.5"
          >
            THE OPEN LEDGER v1.0
          </text>
        </g>

      </WorldMap>
    </div>
  );
};

export default LedgerMap;
