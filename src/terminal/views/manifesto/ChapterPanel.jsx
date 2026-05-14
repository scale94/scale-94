import { useState, useEffect } from 'react';

// Split opening text into sentences for staggered animation.
// Splits on ". " keeping the period with the preceding sentence.
function splitSentences(text) {
  return text.split(/(?<=\.)\s+/).filter(Boolean);
}

export default function ChapterPanel({ chapter, chapterIndex, onClose }) {
  const [visible, setVisible] = useState(false);

  // Next-frame flip triggers CSS transitions.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Escape key dismiss.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const hue     = (chapterIndex * 60) % 360;
  const accent  = `hsl(${hue}, 70%, 60%)`;
  const sentences = splitSentences(chapter.opening);

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="chapter-panel-backdrop"
        onClick={onClose}
        style={{
          position:   'fixed',
          inset:      0,
          zIndex:     40,
          background: 'rgba(0,0,0,0.55)',
          opacity:    visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          bottom:     0,
          width:      'min(480px, 100vw)',
          zIndex:     50,
          background: '#04040a',
          borderLeft: `1px solid ${accent}33`,
          overflowY:  'auto',
          padding:    '40px 32px',
          transform:  visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 350ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Close button */}
        <button
          data-testid="chapter-panel-close"
          onClick={onClose}
          style={{
            position:   'absolute',
            top:        16,
            right:      16,
            background: 'none',
            border:     'none',
            color:      accent,
            fontSize:   18,
            cursor:     'pointer',
            opacity:    0.7,
            lineHeight: 1,
          }}
          aria-label="Close chapter"
        >
          ✕
        </button>

        {/* Chapter number */}
        <div
          style={{
            fontFamily:    'monospace',
            fontSize:      11,
            fontWeight:    700,
            color:         accent,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom:  8,
            opacity:       visible ? 1 : 0,
            transform:     visible ? 'translateY(0)' : 'translateY(8px)',
            transition:    'opacity 400ms 50ms, transform 400ms 50ms',
          }}
        >
          {chapter.number}
        </div>

        {/* Title */}
        <h2
          style={{
            fontFamily:    'monospace',
            fontSize:      22,
            fontWeight:    700,
            color:         accent,
            letterSpacing: '0.04em',
            margin:        '0 0 24px 0',
            opacity:       visible ? 1 : 0,
            transform:     visible ? 'translateY(0)' : 'translateY(12px)',
            transition:    'opacity 400ms 120ms, transform 400ms 120ms',
          }}
        >
          {chapter.title}
        </h2>

        {/* Gradient rule */}
        <div
          style={{
            height:       1,
            background:   `linear-gradient(90deg, ${accent}66, transparent)`,
            marginBottom: 20,
            opacity:      visible ? 1 : 0,
            transition:   'opacity 400ms 180ms',
          }}
        />

        {/* Epigraph */}
        <blockquote
          style={{
            margin:      '0 0 24px 0',
            paddingLeft: 12,
            borderLeft:  `2px solid ${accent}44`,
            fontFamily:  'monospace',
            fontSize:    13,
            fontStyle:   'italic',
            color:       accent,
            opacity:     visible ? 1 : 0,
            transition:  'opacity 400ms 220ms',
          }}
        >
          {chapter.epigraph}
        </blockquote>

        {/* Body — staggered sentences */}
        <p style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.9, color: 'rgba(232,121,249,0.75)', margin: 0 }}>
          {sentences.map((s, i) => (
            <span
              key={i}
              style={{
                opacity:    visible ? 1 : 0,
                transition: `opacity 500ms ${260 + i * 50}ms`,
              }}
            >
              {s}{i < sentences.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>
      </div>
    </>
  );
}
