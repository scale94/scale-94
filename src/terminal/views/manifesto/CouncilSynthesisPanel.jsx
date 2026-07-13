// src/terminal/views/manifesto/CouncilSynthesisPanel.jsx
// Staged synthesis breakdown below the ring (spec §6). Sections reveal
// sequentially (~250ms cadence); prefers-reduced-motion renders instantly.
import { useEffect, useState } from 'react';
import CopySpan from '../../components/CopySpan';

const MONO = "'Geist Mono', ui-monospace, monospace";
const STAGE_MS = 250;

function Section({ title, color, revealed, children }) {
  return (
    <div style={{ opacity: revealed ? 1 : 0, transition: 'opacity 300ms', marginTop: 18 }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.25em', color, borderBottom: `1px solid ${color}33`, paddingBottom: 4 }}>
        &sect; {title}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

const rowStyle = { fontFamily: MONO, fontSize: 11, color: 'rgba(232,232,240,0.85)', lineHeight: 1.6, marginTop: 6 };
const dimTagStyle = (c) => ({ color: c, fontSize: 10, letterSpacing: '0.1em' });

export default function CouncilSynthesisPanel({ record, onDossier, onReset, minds, onFragmentMarked }) {
  const [stage, setStage] = useState(0);
  const trajColor = record.metrics.trajectory === 'FOUNDATION' ? '#FF0088' : '#00FFAA';

  useEffect(() => {
    setStage(0);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setStage(5); return; }
    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      setStage(n);
      if (n >= 5) clearInterval(iv);
    }, STAGE_MS);
    return () => clearInterval(iv);
  }, [record.id]);

  const { sharedGround, frontier, angles, openQuestions, sanctuaries, seeds } = record.sections;

  return (
    <div id="council-synthesis-panel" style={{ background: '#04040a', border: '1px solid rgba(120,140,200,0.12)', borderRadius: 4, padding: '16px 18px 22px', marginTop: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, color: '#FFD700', fontWeight: 700 }}>
          {record.pair.map((p, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: 'rgba(232,232,240,0.5)' }}> &times; </span>}
              {p.anchorName || p.label}
              {p.kind === 'mind' && minds && (
                <button
                  onClick={() => onDossier(minds.find(m => m.dimIndex === p.dimIndex))}
                  style={{ background: 'none', border: 'none', color: 'rgba(120,140,200,0.7)', fontFamily: MONO, fontSize: 9, cursor: 'pointer', marginLeft: 4 }}
                >
                  [dossier]
                </button>
              )}
            </span>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: trajColor, letterSpacing: '0.15em' }}>
          {record.metrics.trajectory === 'FOUNDATION' ? '▼ SOCIAL FOUNDATION' : '▲ BIOPHYSICAL CEILING'} · 0x{(record.ordinal & 0xff).toString(16).padStart(2, '0').toUpperCase()}
          <button
            onClick={onReset}
            style={{ marginLeft: 14, background: 'none', border: '1px solid rgba(255,0,136,0.4)', borderRadius: 3, color: '#FF0088', fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em', padding: '2px 8px', cursor: 'pointer' }}
          >
            /RESET
          </button>
        </div>
      </div>

      {/* §1 Shared Ground & Innovation Frontier */}
      <Section title="SHARED GROUND & INNOVATION FRONTIER" color="#00FFAA" revealed={stage >= 1}>
        <div style={rowStyle}>{sharedGround.headline}</div>
        {sharedGround.fields.map(f => (
          <div key={f.dim} style={rowStyle}>
            <span style={dimTagStyle('#00FFAA')}>◈ {f.tag}</span> — {f.narrative} &middot; <span style={{ color: 'rgba(232,232,240,0.55)' }}>{f.dominance}</span>
          </div>
        ))}
        <div style={{ ...rowStyle, marginTop: 12 }}>{frontier.headline}</div>
        {frontier.fields.map(f => (
          <div key={f.dim} style={rowStyle}>
            <span style={dimTagStyle('#FF8C00')}>◇ {f.tag}</span> (&Delta;{f.delta.toFixed(2)}, held by {f.holder}) — {f.narrative}
          </div>
        ))}
      </Section>

      {/* §2 Semantic Vectors & Open Questions */}
      <Section title="SEMANTIC VECTORS & OPEN QUESTIONS" color="#00AAFF" revealed={stage >= 2}>
        {angles.map((a, i) => (
          <div key={i} style={rowStyle}>
            <span style={dimTagStyle('#00AAFF')}>▸ {a.tag}</span>
            <div style={{ marginTop: 2 }}>{a.vector}</div>
          </div>
        ))}
        {openQuestions.map((q, i) => (
          <div key={`q${i}`} style={{ ...rowStyle, color: 'rgba(212,166,255,0.85)' }}>
            ? {q.question}
          </div>
        ))}
        {openQuestions.length === 0 && (
          <div style={rowStyle}>No paradox survives saponification — this pair reconciles fully. The tension budget is zero; novelty must be imported.</div>
        )}
      </Section>

      {/* §3 Sanctuaries & Prompt Fragments */}
      <Section title="SANCTUARIES & PROMPT FRAGMENTS" color="#FFD700" revealed={stage >= 3}>
        {sanctuaries.map((s, i) => (
          <div key={`s${i}`} style={rowStyle}>
            <span style={dimTagStyle('#FFD700')}>⊙ SANCTUARY</span> {s.narrative}
            <div style={{ marginTop: 2 }}>
              ⌗ <CopySpan value={s.seed} color="#FFD700"
                  onCopy={(text) => onFragmentMarked?.({ text, kind: 'sanctuary', tag: s.narrative })} />
            </div>
          </div>
        ))}
        {seeds.map((s, i) => (
          <div key={`seed${i}`} style={rowStyle}>
            <span style={dimTagStyle('rgba(120,140,200,0.8)')}>[{s.source}]</span>{' '}
            <CopySpan value={s.text} color="rgba(232,232,240,0.9)"
              onCopy={(text) => onFragmentMarked?.({ text, kind: 'mind_seed', tag: s.source })} />
          </div>
        ))}
      </Section>

      {/* §4 Synthesis Directive */}
      <Section title="SYNTHESIS DIRECTIVE — COPY-PASTE ME" color={trajColor} revealed={stage >= 4}>
        <div style={{ ...rowStyle, border: `1px solid ${trajColor}33`, borderRadius: 3, padding: '10px 12px' }}>
          <CopySpan value={record.directive} color={trajColor} />
        </div>
      </Section>
    </div>
  );
}
