// src/terminal/mercury/mercuryMarkdown.jsx — a focused silver renderer.
// NOT a markdown library and NOT renderContent.jsx (which is hard-wired neon).
// It handles exactly what the kernel .md uses, in the two-silver Mercury palette.
import React from 'react';

const SILVER = '#c0c0c0';
const SILVER_HI = '#e8e8e8';
const SILVER_LO = 'rgba(192,192,192,0.55)';

// Inline: **bold**, *italic*, `code`
function inline(text, keyBase) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g).filter(Boolean);
  return parts.map((p, i) => {
    const k = `${keyBase}-${i}`;
    if (/^\*\*.*\*\*$/.test(p)) return <strong key={k} style={{ color: SILVER_HI }}>{p.slice(2, -2)}</strong>;
    if (/^\*.*\*$/.test(p))     return <em key={k} style={{ color: SILVER_LO }}>{p.slice(1, -1)}</em>;
    if (/^`.*`$/.test(p))       return <code key={k} className="px-1 rounded-sm" style={{ background: 'rgba(192,192,192,0.1)', color: SILVER_HI, fontFamily: 'ui-monospace, monospace' }}>{p.slice(1, -1)}</code>;
    return <React.Fragment key={k}>{p}</React.Fragment>;
  });
}

export function renderMercuryMarkdown(md) {
  const lines = (md || '').split('\n');
  const nodes = [];
  let listBuf = [];

  const flushList = () => {
    if (!listBuf.length) return;
    const idx = nodes.length;
    nodes.push(
      <ul key={`ul-${idx}`} className="mb-4 space-y-1.5 list-none pl-0">
        {listBuf.map((item, k) => (
          <li key={k} className="flex items-start gap-2" style={{ color: SILVER }}>
            <span className="mt-1.5 text-[8px] shrink-0" style={{ color: SILVER_LO }}>◇</span>
            <span className="break-words text-xs leading-relaxed">{inline(item, `li-${idx}-${k}`)}</span>
          </li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();

    if (t === '<example>') {
      flushList();
      const buf = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '</example>') { buf.push(lines[i]); i++; }
      i++; // skip closing tag
      const idx = nodes.length;
      nodes.push(
        <div key={`ex-${idx}`} className="mb-4 border rounded p-3 text-xs font-mono"
          style={{ borderColor: 'rgba(192,192,192,0.18)', background: 'rgba(192,192,192,0.03)' }}>
          {buf.map((l, k) => {
            const s = l.trim();
            const col = /^Corpse:/.test(s) ? 'rgba(192,192,192,0.35)'
                      : /^Wet:/.test(s)    ? SILVER_HI
                      : SILVER_LO;
            return <div key={k} className="mb-1 break-words whitespace-pre-wrap" style={{ color: col }}>{l}</div>;
          })}
        </div>
      );
      continue;
    }

    if (t === '') { flushList(); i++; continue; }
    if (t.startsWith('- ')) { listBuf.push(t.slice(2)); i++; continue; }
    flushList();

    const idx = nodes.length;
    if (t.startsWith('### ')) {
      nodes.push(<h4 key={`h-${idx}`} className="text-xs font-bold tracking-[0.15em] uppercase mt-4 mb-1.5" style={{ color: SILVER }}>{inline(t.slice(4), `h4-${idx}`)}</h4>);
    } else if (t.startsWith('## ')) {
      nodes.push(<h3 key={`h-${idx}`} className="text-sm font-bold tracking-[0.2em] uppercase mt-5 mb-2" style={{ color: SILVER_HI }}>{inline(t.slice(3), `h3-${idx}`)}</h3>);
    } else if (t.startsWith('# ')) {
      nodes.push(<h2 key={`h-${idx}`} className="text-base font-bold tracking-[0.15em] uppercase mb-3" style={{ color: SILVER_HI }}>{inline(t.slice(2), `h2-${idx}`)}</h2>);
    } else if (t.startsWith('//')) {
      nodes.push(<div key={`c-${idx}`} className="text-[10px] font-mono mt-3 mb-1" style={{ color: 'rgba(192,192,192,0.4)' }}>{t}</div>);
    } else if (/^\*[^*].*\*$/.test(t)) {
      nodes.push(<p key={`p-${idx}`} className="text-xs italic mb-3 leading-relaxed" style={{ color: SILVER_LO }}>{t.slice(1, -1)}</p>);
    } else {
      nodes.push(<p key={`p-${idx}`} className="text-xs mb-2.5 leading-relaxed break-words" style={{ color: SILVER }}>{inline(t, `p-${idx}`)}</p>);
    }
    i++;
  }
  flushList();
  return nodes;
}
