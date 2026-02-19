import React from 'react';
import HackerText from '../components/HackerText';

const renderContent = (content) => {
  if (!content) return null;

  const lines = content.split('\n');
  const nodes = [];
  let buffer = [];
  let state = 'text';

  const flush = () => {
    if (!buffer.length) return;
    if (state === 'list') {
      nodes.push(
        <ul key={nodes.length} className="mb-6 space-y-2 list-none pl-0">
          {buffer.map((item, i) => (
            <li key={i} className="text-[#39ff14] flex items-start gap-2">
              <span className="text-cyan-500 mt-1.5 text-[8px] shrink-0">&#9632;</span>
              <span className="break-words w-full" dangerouslySetInnerHTML={{ __html: item.replace(/^[-*] /, '').replace(/(\*\*|__)(.*?)\1/g, '<strong class="text-[#39ff14]">$2</strong>') }} />
            </li>
          ))}
        </ul>
      );
    } else if (state === 'code') {
      const codeText = buffer.join('\n').replace(/^```.*\n?|```$/g, '');
      nodes.push(
        <div key={nodes.length} className="bg-black/80 border border-cyan-900/30 p-4 mb-6 rounded text-xs text-cyan-300 font-mono whitespace-pre-wrap overflow-x-auto shadow-inner">
          {codeText}
        </div>
      );
    } else if (state === 'table') {
      const rows = buffer.filter(r => r.trim() !== '' && !r.includes('---'));
      nodes.push(
        <div key={nodes.length} className="overflow-x-auto mb-6 border border-cyan-900/30 rounded">
          <table className="w-full text-left text-xs md:text-sm text-[#39ff14] min-w-[500px]">
            <tbody>
              {rows.map((row, rIdx) => {
                const cols = row.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
                if (cols.length === 0) return null;
                return (
                  <tr key={rIdx} className={rIdx === 0 ? "bg-cyan-900/20 text-cyan-400 font-bold" : "border-t border-cyan-900/30"}>
                    {cols.map((col, cIdx) => (
                      <td key={cIdx} className="p-2 border-r border-cyan-900/30 last:border-0" dangerouslySetInnerHTML={{ __html: col.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#39ff14]">$1</strong>') }}></td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    } else {
      const textContent = buffer.join('\n').trim();
      if (textContent) {
        const formattedText = textContent.replace(/(\*\*|__)(.*?)\1/g, '<strong class="text-[#39ff14]">$2</strong>');
        nodes.push(<p key={nodes.length} className="mb-6 text-[#39ff14] leading-relaxed whitespace-pre-line max-w-3xl" dangerouslySetInnerHTML={{ __html: formattedText }} />);
      }
    }
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (state === 'code') {
        buffer.push(line);
        flush();
        state = 'text';
      } else {
        flush();
        state = 'code';
        buffer.push(line);
      }
      continue;
    }

    if (state === 'code') {
      buffer.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      flush();
      state = 'text';
      const level = trimmed.match(/^#+/)[0].length;
      const text = trimmed.replace(/^#+\s*/, '');
      if (level === 1) nodes.push(<h1 key={nodes.length} className="text-[14pt] font-bold mb-4 text-cyan-400 tracking-tighter leading-none"><HackerText text={text} /></h1>);
      else if (level === 2) nodes.push(<h2 key={nodes.length} className="text-[12pt] text-fuchsia-400 mb-12 font-light tracking-wide">{text}</h2>);
      else nodes.push(<h3 key={nodes.length} className="text-lg font-bold mt-8 mb-4 text-fuchsia-400 flex items-center gap-2"><span className="text-cyan-500">::</span> {text}</h3>);
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (state !== 'list') {
        flush();
        state = 'list';
      }
      buffer.push(line);
      continue;
    }

    if (trimmed.startsWith('|')) {
      if (state !== 'table') {
        flush();
        state = 'table';
      }
      buffer.push(line);
      continue;
    }

    if (trimmed.includes('---') && state === 'table') {
      buffer.push(line);
      continue;
    }

    if (trimmed === '') {
      if (state !== 'code') {
        flush();
        state = 'text';
      } else {
        buffer.push(line);
      }
      continue;
    }

    if (state !== 'text') {
      flush();
      state = 'text';
    }
    buffer.push(line);
  }

  flush();
  return nodes;
};

export default renderContent;
