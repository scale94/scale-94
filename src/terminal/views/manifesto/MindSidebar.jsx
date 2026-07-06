// Thinker profile card flanking the torus while a pair is selected (spec §3).
// Pure presentational. side: 'left' | 'right'. mind: a SIXTEEN_MINDS entry or
// null (renders the AWAITING placeholder frame).
const MONO = "'Geist Mono', ui-monospace, monospace";

export default function MindSidebar({ mind, side, hue, onDossier }) {
  if (!mind) {
    return (
      <div style={{ border: '1px dashed rgba(120,140,200,0.25)', borderRadius: 4, padding: '14px 12px', fontFamily: MONO, fontSize: 10, color: 'rgba(120,140,200,0.45)', letterSpacing: '0.2em', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180 }}>
        AWAITING SECOND MIND
      </div>
    );
  }
  const accent = hue || '#FFD700';
  return (
    <div style={{ border: `1px solid ${accent}44`, borderRadius: 4, padding: '12px 12px 14px', fontFamily: MONO, background: '#04040a', maxHeight: 420, overflowY: 'auto', textAlign: side === 'right' ? 'right' : 'left' }}>
      <div style={{ fontSize: 9, color: accent, letterSpacing: '0.2em' }}>
        [dim:{String(mind.dimIndex).padStart(2, '0')}] {mind.dimName}
      </div>
      <div style={{ fontSize: 15, color: '#FFD700', fontWeight: 700, marginTop: 3 }}>{mind.anchorName}</div>
      <div style={{ fontSize: 9, color: 'rgba(232,232,240,0.5)', marginTop: 2 }}>{mind.era} · {mind.caste.toUpperCase()}</div>
      <div style={{ fontSize: 12, color: '#FFD700', marginTop: 10 }}>{mind.coreEquation}</div>
      <div style={{ fontSize: 9, color: 'rgba(0,255,170,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 8 }}>▸ {mind.systemDirective}</div>
      <div style={{ fontSize: 10, color: 'rgba(232,232,240,0.75)', fontStyle: 'italic', marginTop: 10, lineHeight: 1.5 }}>&quot;{mind.epigraph}&quot;</div>
      <div style={{ fontSize: 10, color: `${accent}bb`, marginTop: 8, lineHeight: 1.5 }}>&quot;{mind.excerpt}&quot;</div>
      <button
        onClick={() => onDossier(mind)}
        style={{ marginTop: 12, background: 'none', border: `1px solid ${accent}55`, borderRadius: 3, color: accent, fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em', padding: '3px 10px', cursor: 'pointer' }}
      >
        [dossier]
      </button>
    </div>
  );
}
