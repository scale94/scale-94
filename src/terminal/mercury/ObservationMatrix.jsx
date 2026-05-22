// ObservationMatrix.jsx — §C: Live observation log.
// Pushes entries on phase change, minute tick, and threshold crossings.
// Capped at 24 entries (FIFO). Markdown export (download + copy).

import { useState, useEffect, useRef, useMemo } from 'react';
import { generateEntry, detectThresholds, buildMarkdownLog,
         PHRASES, categoryForEvent, ctxForEvent, renderPhrase } from './observationLog';
import { subscribe, getTotals } from '../../observatory/observatoryBus';

const PHASE_GLYPHS = { fluid: '🜍', thermal: '🜂', earth: '🜃', air: '🜁' };
const MAX_ENTRIES  = 24;

function glyphForCategory(cat) {
  return { transmissions: '⌬', essences: '❋', ciphers: '⟁',
           gaze: '☍', edge: '⌖' }[cat] ?? '◈';
}

function shortTail(evt) {
  const p = evt.payload ?? {};
  switch (evt.kind) {
    case 'kernel_completed': return `${p.kernelId ?? '—'} · ${p.durationMs ?? '—'}ms`;
    case 'ledger_appended':  return `depth ${p.depth ?? '—'}`;
    case 'collision_fired':  return `${p.polarity ?? '—'} · ${p.noteCount ?? '—'} notes`;
    case 'polarity_shifted': return `→ ${p.polarity ?? '—'}`;
    case 'cipher_sealed':    return `hash ${(p.hashPrefix ?? '').slice(0, 8)}…`;
    case 'sphere_clicked':   return p.sphere ?? '—';
    case 'lunar_read':       return `${p.phase ?? '—'} ${p.illum != null ? Math.round(p.illum * 100) + '%' : ''}`.trim();
    case 'tab_navigated':    return p.tab ?? '—';
    case 'gate_answered':    return p.result ?? '—';
    case 'eye_phase':        return p.phase ?? '—';
    case 'manifesto_opened': return `chapter ${p.chapter ?? '—'}`;
    default: return evt.kind;
  }
}

function buildRegistryMarkdownBlock(totals) {
  function fmtTs(ts) { return ts ? new Date(ts).toTimeString().slice(0, 8) : '—'; }
  const t = totals;
  const rows = [
    ['TRANSMISSION LATTICE', fmtTs(t.transmissions.lastTs), `${t.transmissions.count} transmissions · ledger depth ${t.transmissions.ledgerDepth}`],
    ['BOTTLED VOWS',         fmtTs(t.essences.lastTs),      `${t.essences.count} essences · ${t.essences.crystallized} crystallized · ${t.essences.polarity ?? '—'}`],
    ['SEALED VOLUMES',       fmtTs(t.ciphers.lastTs),       `${t.ciphers.sealed} sealed · ${t.ciphers.unlocks} unlocks`],
    ['BACKWARD GAZE',        fmtTs(t.gaze.lastTs),          `moon ${t.gaze.lastLunar?.phase ?? '—'} · ${t.gaze.sphereClicks} spheres`],
    ['PERMEABLE EDGE',       fmtTs(t.edge.lastTs),          `gate ${t.edge.gate} · eye ${t.edge.eye} · manifesto ${t.edge.manifestoChapter ?? '—'}`],
  ];
  const header = `## COSMOS REGISTRY — session totals\n| category | last event | totals |\n| :--- | :--- | :--- |\n`;
  const body   = rows.map(([cat, ts, totalsLine]) => `| ${cat} | ${ts} | ${totalsLine} |`).join('\n');
  return header + body + '\n';
}

export default function ObservationMatrix({ mercury, instruments, activePhase }) {
  const [entries, setEntries] = useState([]);
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState('ALL');
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
      setEntries(prev => [{ ...entry, category: 'MERCURY' }, ...prev].slice(0, MAX_ENTRIES));
      prevPhaseRef.current = activePhase;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhase]);

  // Threshold crossings
  useEffect(() => {
    if (!instruments || !prevInstrumentsRef.current) return;
    const fired = detectThresholds(prevInstrumentsRef.current, instruments);
    if (fired.length > 0 && mercury) {
      const newEntries = fired.map(trigger => ({
        ...generateEntry({ trigger, timestamp: new Date(), mercury, instruments, activePhase }),
        category: 'MERCURY',
      }));
      setEntries(prev => [...newEntries, ...prev].slice(0, MAX_ENTRIES));
    }
    prevInstrumentsRef.current = instruments;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments]);

  // Keep liveRef current so the interval closure always reads fresh state
  useEffect(() => { liveRef.current = { mercury, instruments, activePhase }; });

  // Seed one entry immediately on mount, then tick every 60s
  useEffect(() => {
    const fire = () => {
      const { mercury: m, instruments: ins, activePhase: ap } = liveRef.current;
      if (!m || !ins) return;
      const trigger = m.daysToNextPerihelion < 5 ? 'perihelion_approach' : 'minute_tick';
      const entry = generateEntry({
        trigger,
        timestamp: new Date(),
        mercury: m, instruments: ins, activePhase: ap,
      });
      setEntries(prev => [{ ...entry, category: 'MERCURY' }, ...prev].slice(0, MAX_ENTRIES));
    };
    fire();
    const id = setInterval(fire, 60_000);
    return () => clearInterval(id);
  }, []);

  // Cross-site events from observatoryBus → log entries
  useEffect(() => {
    return subscribe((evt) => {
      const phraseCat = categoryForEvent(evt);
      if (!phraseCat) return;
      const pool = PHRASES[phraseCat];
      if (!pool || pool.length === 0) return;
      const tsSec = Math.floor(evt.ts / 1000);
      const template = pool[tsSec % pool.length];
      const phrase = renderPhrase(template, ctxForEvent(evt, getTotals()));
      setEntries(prev => [{
        timestamp:    new Date(evt.ts),
        trigger:      evt.kind,
        triggerLabel: `${glyphForCategory(evt.category)}  ${evt.category}/${evt.kind}`,
        line:         phrase,
        tail:         shortTail(evt),
        activePhase:  null,
        category:     evt.category.toUpperCase(),
      }, ...prev].slice(0, MAX_ENTRIES));
    });
  }, []);

  const markdown = useMemo(() => {
    const base = buildMarkdownLog({
      entries, mercury, instruments, activePhase,
      sessionStart: sessionStartRef.current,
    });
    const registryBlock = buildRegistryMarkdownBlock(getTotals());
    // Splice the registry block between CURRENT INSTRUMENTS table and ## ENTRIES
    return base.replace(/\n## ENTRIES\n/, `\n\n${registryBlock}\n## ENTRIES\n`);
  }, [entries, mercury, instruments, activePhase]);

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
    setEntries(prev => [{ ...entry, category: 'MERCURY' }, ...prev].slice(0, MAX_ENTRIES));
  }

  if (!mercury || !instruments) return null;

  const visibleEntries = entries.filter(e => {
    if (filter === 'ALL') return true;
    return e.category === filter;
  });

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

      {/* Filter chips */}
      <div className="px-4 py-2 border-b border-zinc-700/[0.15] flex flex-wrap gap-1">
        {['ALL', 'MERCURY', 'TRANSMISSIONS', 'ESSENCES', 'CIPHERS', 'GAZE', 'EDGE'].map(chip => (
          <button
            key={chip}
            onClick={() => setFilter(chip)}
            className="text-[7px] font-mono tracking-[0.16em] uppercase px-2 py-0.5 rounded-sm transition-colors"
            style={{
              color:      filter === chip ? 'rgba(232,210,138,0.95)' : 'rgba(192,192,192,0.55)',
              background: filter === chip ? 'rgba(232,210,138,0.10)' : 'rgba(192,192,192,0.04)',
              border:     filter === chip ? '1px solid rgba(232,210,138,0.30)' : '1px solid rgba(192,192,192,0.08)',
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="divide-y divide-zinc-700/[0.06] max-h-96 overflow-y-auto">
        {visibleEntries.length === 0 && (
          <div className="px-4 py-6 text-[8px] font-mono text-zinc-600 italic text-center">
            {`// observation log empty · interact with the canvas to begin`}
          </div>
        )}
        {visibleEntries.map((e, i) => (
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
        FIFO {MAX_ENTRIES} · phase transit · minute tick · threshold crossings · cross-site bus · markdown export available
      </div>
    </div>
  );
}
