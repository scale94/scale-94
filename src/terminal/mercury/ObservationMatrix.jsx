// ObservationMatrix.jsx — §C: Live observation log.
// Pushes entries on phase change, minute tick, and threshold crossings.
// Capped at 24 entries (FIFO). Markdown export (download + copy).

import { useState, useEffect, useRef, useMemo } from 'react';
import { generateEntry, detectThresholds, buildMarkdownLog } from './observationLog';

const PHASE_GLYPHS = { fluid: '🜍', thermal: '🜂', earth: '🜃', air: '🜁' };
const MAX_ENTRIES  = 24;

export default function ObservationMatrix({ mercury, instruments, activePhase }) {
  const [entries, setEntries] = useState([]);
  const [copied, setCopied] = useState(false);
  const sessionStartRef = useRef(new Date());
  const prevPhaseRef = useRef(activePhase);
  const prevInstrumentsRef = useRef(instruments);
  const liveRef = useRef({ mercury, instruments, activePhase });

  // Phase transit trigger
  useEffect(() => {
    if (!mercury || !instruments) return;
    if (prevPhaseRef.current !== activePhase) {
      const entry = generateEntry({
        trigger: 'phase_transit',
        from: prevPhaseRef.current,
        to: activePhase,
        timestamp: new Date(),
        mercury, instruments, activePhase,
      });
      setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
      prevPhaseRef.current = activePhase;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhase]);

  // Threshold crossings
  useEffect(() => {
    if (!instruments || !prevInstrumentsRef.current) return;
    const fired = detectThresholds(prevInstrumentsRef.current, instruments);
    if (fired.length > 0 && mercury) {
      const newEntries = fired.map(trigger => generateEntry({
        trigger, timestamp: new Date(), mercury, instruments, activePhase,
      }));
      setEntries(prev => [...newEntries, ...prev].slice(0, MAX_ENTRIES));
    }
    prevInstrumentsRef.current = instruments;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments]);

  // Keep liveRef current so the interval closure always reads fresh state
  useEffect(() => { liveRef.current = { mercury, instruments, activePhase }; });

  // Minute tick — stable interval, reads live state through ref
  useEffect(() => {
    const id = setInterval(() => {
      const { mercury: m, instruments: ins, activePhase: ap } = liveRef.current;
      if (!m || !ins) return;
      const entry = generateEntry({
        trigger: 'minute_tick',
        timestamp: new Date(),
        mercury: m, instruments: ins, activePhase: ap,
      });
      setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const markdown = useMemo(() => buildMarkdownLog({
    entries, mercury, instruments, activePhase,
    sessionStart: sessionStartRef.current,
  }), [entries, mercury, instruments, activePhase]);

  function handleDownload() {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `mercury-observation-log-${new Date().toLocaleDateString('en-CA')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCopy() {
    navigator.clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  }

  function handleRefresh() {
    if (!mercury || !instruments) return;
    const entry = generateEntry({
      trigger: 'minute_tick',
      timestamp: new Date(),
      mercury, instruments, activePhase,
    });
    setEntries(prev => [entry, ...prev].slice(0, MAX_ENTRIES));
  }

  if (!mercury || !instruments) return null;

  const sessionTs = sessionStartRef.current.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const buttons = [
    { label: '↺',                            onClick: handleRefresh,  isCopied: false  },
    { label: '↓ .md',                        onClick: handleDownload, isCopied: false  },
    { label: copied ? '✓ copied' : '⊛ copy', onClick: handleCopy,     isCopied: copied },
  ];

  return (
    <div className="mt-8 border border-zinc-500/[0.15] rounded-lg bg-black/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-700/30 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono font-bold text-zinc-400/80 uppercase tracking-widest">
            ◈ OBSERVATION MATRIX
          </div>
          <div className="text-[7px] font-mono text-zinc-600 mt-0.5">
            {`// ${entries.length} entries · session began ${sessionTs} · alien architect`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {buttons.map((b, i) => (
            <button
              key={i}
              onClick={b.onClick}
              className="font-mono text-[7px] uppercase tracking-widest px-2 py-1 rounded-sm transition-all duration-200"
              style={{
                border: b.isCopied ? '1px solid rgba(192,192,192,0.7)' : '1px solid rgba(192,192,192,0.25)',
                color:  b.isCopied ? 'rgba(220,220,220,0.95)' : 'rgba(192,192,192,0.55)',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current state */}
      <div className="px-4 py-2.5 border-b border-zinc-700/[0.15] bg-black/20">
        <div className="text-[6.5px] font-mono text-zinc-600 uppercase tracking-widest mb-1">
          CURRENT STATE
        </div>
        <div className="text-[9px] font-mono text-zinc-400 tabular-nums">
          {PHASE_GLYPHS[activePhase] ?? '◉'} {activePhase} ·
          Mercury {mercury.heliocentricDistanceAU.toFixed(3)} AU ·
          subsolar {mercury.subsolarTempK.toFixed(0)} K ·
          next perihelion T−{mercury.daysToNextPerihelion.toFixed(0)}d
        </div>
      </div>

      {/* Entries */}
      <div className="divide-y divide-zinc-700/[0.06] max-h-96 overflow-y-auto">
        {entries.length === 0 && (
          <div className="px-4 py-6 text-[8px] font-mono text-zinc-600 italic text-center">
            {`// observation log empty · interact with the canvas to begin`}
          </div>
        )}
        {entries.map((e, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-center gap-2 text-[7px] font-mono text-zinc-600 mb-1">
              <span>{e.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span>{e.triggerLabel}</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-300 leading-relaxed mb-1">
              {e.line}
            </div>
            <div className="text-[7px] font-mono text-zinc-600 leading-relaxed">
              {e.tail}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-zinc-700/[0.15] text-[6.5px] font-mono text-zinc-600 leading-relaxed">
        FIFO {MAX_ENTRIES} · phase transit · minute tick · threshold crossings · markdown export available
      </div>
    </div>
  );
}
