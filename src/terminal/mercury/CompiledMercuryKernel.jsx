// src/terminal/mercury/CompiledMercuryKernel.jsx — the off-altar reveal.
// Locked → renders nothing (a normie sees an untouched tab). Unlocked → the
// artifact prints in silver, with download (the headline — this kernel is meant
// to be TAKEN) + copy, and the RTFM byline that is the joke's payload.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import mercuryKernelSource from '../../../content/mercury_kernel/MERCURY-SCALE-KERNEL.md?raw';
import { isMercuryKernelUnlocked, subscribeMercuryKernel } from './mercuryKernelUnlock';
import { renderMercuryMarkdown } from './mercuryMarkdown';

export default function CompiledMercuryKernel() {
  const [unlocked, setUnlocked] = useState(() => isMercuryKernelUnlocked());
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const copyTimer = useRef(null);

  useEffect(() => {
    setUnlocked(isMercuryKernelUnlocked());
    return subscribeMercuryKernel(() => setUnlocked(isMercuryKernelUnlocked()));
  }, []);
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(mercuryKernelSource); } catch { /* clipboard denied */ }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([mercuryKernelSource], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'MERCURY-SCALE-KERNEL.md' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  }, []);

  if (!unlocked) return null;

  return (
    <section className="mt-4 border rounded-lg p-5 bg-black/40" style={{ borderColor: 'rgba(192,192,192,0.18)' }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="font-mono text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(192,192,192,0.7)' }}>
          ◉ mercury-scale kernel · compiled off-altar · architect build
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownload}
            aria-label="Download the Mercury kernel as markdown"
            className="text-[9px] font-bold px-2 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all"
            style={{ borderColor: 'rgba(192,192,192,0.4)', color: downloaded ? '#e8e8e8' : '#c0c0c0' }}
          >
            {downloaded ? 'downloaded ✓' : '[ compile → download ]'}
          </button>
          <button
            onClick={handleCopy}
            aria-label="Copy the Mercury kernel source"
            className="text-[9px] font-bold px-2 py-0.5 rounded-sm border tracking-widest whitespace-nowrap transition-all"
            style={{ borderColor: 'rgba(192,192,192,0.25)', color: copied ? '#e8e8e8' : 'rgba(192,192,192,0.7)' }}
          >
            {copied ? 'copied ✓' : '[copy]'}
          </button>
        </div>
      </div>
      <div className="max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
        {renderMercuryMarkdown(mercuryKernelSource)}
      </div>
      <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(192,192,192,0.1)' }}>
        <div className="text-[10px] font-mono mb-1" style={{ color: 'rgba(192,192,192,0.5)' }}>// we read the fucking manual so you never have to</div>
        <div className="text-[9px] font-mono" style={{ color: 'rgba(192,192,192,0.3)' }}>// systemless · leaves no trace · you rooted this</div>
      </div>
    </section>
  );
}
