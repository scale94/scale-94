import { useState, useEffect } from 'react';

function splitSentences(text) {
  return text.split(/(?<=\.)\s+/).filter(Boolean);
}

export default function SixteenPanel({ mind, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mind) return null;

  const isCanon = mind.caste === 'canon';
  const accent = isCanon ? '#FFD700' : '#00FFAA';
  const casteLabel = isCanon ? 'CANON GEOMETRY · INSTRUMENT BUILDER' : 'SIDELINED SYSTEMIC · INSTRUMENT READER';
  const dimTag = `[dim:${String(mind.dimIndex).padStart(2, '0')}] ${mind.dimName}`;
  const sentences = splitSentences(mind.body);
  const mono = "'Geist Mono', ui-monospace, monospace";

  return (
    <>
      <div
        data-testid="sixteen-panel-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.55)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(480px, 100vw)', zIndex: 50,
          background: '#04040a',
          borderLeft: `1px solid ${accent}33`,
          overflowY: 'auto', padding: '40px 32px',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 350ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <button
          data-testid="sixteen-panel-close"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', color: accent,
            fontSize: 18, cursor: 'pointer', opacity: 0.7, lineHeight: 1,
          }}
        >✕</button>

        <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 400ms 50ms, transform 400ms 50ms' }}>
          {dimTag}
        </div>

        <div style={{ fontFamily: mono, fontSize: 9, color: `${accent}99`, letterSpacing: '0.25em', marginBottom: 10, opacity: visible ? 1 : 0, transition: 'opacity 400ms 90ms' }}>
          {casteLabel}
        </div>

        <h2 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: accent, letterSpacing: '0.04em', margin: '0 0 4px 0', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)', transition: 'opacity 400ms 120ms, transform 400ms 120ms' }}>
          {mind.anchorName}
        </h2>
        <div style={{ fontFamily: mono, fontSize: 11, color: 'rgba(232,121,249,0.6)', marginBottom: 20 }}>{mind.era}</div>

        <div style={{ fontFamily: mono, fontSize: 16, color: '#FFD700', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.18)', borderRadius: 4, padding: '12px 14px', margin: '0 0 20px 0', opacity: visible ? 1 : 0, transition: 'opacity 400ms 160ms', overflowX: 'auto' }}>
          {mind.coreEquation}
        </div>

        <blockquote style={{ margin: '0 0 20px 0', paddingLeft: 12, borderLeft: `2px solid ${accent}44`, fontFamily: mono, fontSize: 13, fontStyle: 'italic', color: accent, opacity: visible ? 1 : 0, transition: 'opacity 400ms 200ms' }}>
          {mind.epigraph}
        </blockquote>

        <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(0,255,170,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 18, opacity: visible ? 1 : 0, transition: 'opacity 400ms 240ms' }}>
          ▸ {mind.systemDirective}
        </div>

        <p style={{ fontFamily: mono, fontSize: 13, lineHeight: 1.9, color: 'rgba(232,121,249,0.75)', margin: 0 }}>
          {sentences.map((s, i) => (
            <span key={i} style={{ opacity: visible ? 1 : 0, transition: `opacity 500ms ${280 + i * 60}ms` }}>
              {s}{i < sentences.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>
      </div>
    </>
  );
}
