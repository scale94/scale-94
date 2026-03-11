import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import HackerText from '../components/HackerText';
import renderContent from '../utils/renderContent';

const ArticleView = ({ article, originTab, handleReturnToRoot, onNeuralLink }) => {
  const isAcademic = article.type === 'academic';
  // Fallback for static articles without pre-rendered html:
  // strip the first # heading since ArticleView renders article.title separately.
  const contentBody = (article.body || article.content || '')
    .replace(/^#(?!#)[ \t]+[^\n]*\n?/, '')
    .trimStart();

  // Event delegation for neural-link buttons inside pre-rendered HTML chunks.
  const contentRef = useRef(null);
  const handleContentClick = useCallback((e) => {
    const btn = e.target.closest('.neural-link');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    if (cmd && onNeuralLink) onNeuralLink(cmd);
  }, [onNeuralLink]);

  // ── Terminal Soundscape — high-speed data downlink simulation ────────────────
  // Splits pre-rendered HTML into top-level block elements, then reveals them
  // in batches via setTimeout to mimic a Sorbe Node data stream.
  const [htmlChunks, setHtmlChunks] = useState([]);
  const [streamIdx,  setStreamIdx]  = useState(0);

  // Parse HTML → array of block outerHTML strings whenever the article changes.
  useEffect(() => {
    if (!article.html) { setHtmlChunks([]); setStreamIdx(0); return; }
    const doc    = new DOMParser().parseFromString(article.html, 'text/html');
    const chunks = Array.from(doc.body.children).map(n => n.outerHTML);
    setHtmlChunks(chunks);
    setStreamIdx(0);
  }, [article.id, article.html]);

  // Tick: reveal 4 elements every 22 ms — full article streams in ~165–220 ms.
  useEffect(() => {
    if (streamIdx >= htmlChunks.length) return;
    const t = setTimeout(() => setStreamIdx(i => Math.min(i + 4, htmlChunks.length)), 22);
    return () => clearTimeout(t);
  }, [streamIdx, htmlChunks.length]);

  const displayedChunks = htmlChunks.slice(0, streamIdx);

  // Generate once per article load — article.id is the intentional trigger,
  // not a value used inside the callback (Math.random needs no deps).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sig = useMemo(() => Math.random().toString(36).substring(7), [article.id]);

  // Academic: amber palette. Lore: fuchsia/cyan palette.
  const accentBorder  = isAcademic ? 'border-amber-500/50'  : 'border-fuchsia-500/50';
  const accentIdColor = isAcademic ? 'text-amber-400'       : 'text-fuchsia-500';
  const accentBtn     = isAcademic
    ? 'text-amber-600 hover:text-white border-amber-900/50 hover:border-amber-500'
    : 'text-cyan-600 hover:text-white border-cyan-900/50 hover:border-cyan-500';

  return (
  <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-300">
    <button onClick={handleReturnToRoot} className={`mb-8 flex items-center text-xs font-bold tracking-widest transition-colors border px-3 py-2 -ml-2 w-fit uppercase bg-[#09090b] rounded-sm ${accentBtn}`}>
      <ArrowLeft className="w-3 h-3 mr-2" /> Return_To_{(originTab || '').toUpperCase()}
    </button>

    {/* Academic classification banner */}
    {isAcademic && (
      <div className="mb-4 flex items-center gap-3 border border-amber-900/40 bg-amber-950/10 px-4 py-2 rounded-sm font-mono text-[10px] font-bold tracking-widest uppercase">
        <span className="text-amber-400">CLASSIFICATION: ACADEMIC // PHD CORPUS // CS2_ANALYSIS</span>
        <span className="ml-auto text-amber-700">type: static_thesis</span>
      </div>
    )}

    <div className={`border-l-2 ${accentBorder} pl-8 relative`}>
      <div className="flex flex-wrap gap-4 text-[10px] font-bold tracking-widest text-cyan-600 mb-8 font-mono uppercase">
        <span className={accentIdColor}>LOG: {article.id}</span>
        <span>{'//'}</span>
        <span>DATE: {article.date || 'UNDATED'}</span>
        {article.lastModified && article.lastModified !== article.date && (
          <>
            <span>{'//'}</span>
            <span className="text-cyan-400">UPDATED: {article.lastModified}</span>
          </>
        )}
        <span>{'//'}</span>
        <span>LEN: {article.len || article.readTime || '0 WDS'}</span>
      </div>

      {/*
       * ── Title Isolation Cell ────────────────────────────────────────────────
       *
       * Strategy: the body text below is anchored to the BOTTOM of this fixed-
       * height cell, not to the bottom of the title text itself. This means the
       * body's Y coordinate is 100% invariant regardless of how many lines the
       * scramble or final title occupies.
       *
       * Geometry:
       *   display:grid + grid-template-rows:1fr  → single auto-sized track that
       *     fills the full cell height.
       *   align-items:end  → h1 is pinned to the BOTTOM of the track; text
       *     wraps UPWARD into the reserved space, never pushing the body down.
       *   height:8rem  → hard ceiling (128px). At 14pt / lh:1.2, covers up to
       *     ~4 wrapped lines (4 × 14pt × 1.2 ≈ 100px) + mb-4 (16px) = 116px.
       *     Nothing below ever sees a Y-shift larger than 0px.
       *   overflow:hidden  → clips upward bleed on extreme wraps; the body
       *     never moves because the bottom of the cell is the anchor, not the
       *     bottom of the text.
       *   contain:layout size  → Gecko-specific: isolates this element from the
       *     global reflow graph. Scramble-induced internal reflows cannot escape.
       *     'size' tells the engine the box dimensions are externally determined
       *     (height:8rem), so children's intrinsic size is irrelevant.
       *   line-height:1.2  → locks the Gecko line-height metric so preseed
       *     glyphs and final glyphs produce identical line counts.
       */}
      <div style={{
        display: 'grid',
        gridTemplateRows: '1fr',
        height: '8rem',
        lineHeight: '1.2',
        overflow: 'hidden',
        alignItems: 'end',
        contain: 'layout size',
      }}>
        <h1
          key={article.id}
          className="av-glitch-title text-[14pt] font-bold mb-4 tracking-tighter leading-tight text-transparent bg-clip-text"
          data-text={article.title}
          style={{
            backgroundImage: 'linear-gradient(90deg, #39ff14, #06b6d4, #d946ef, #ef4444, #38bdf8, #39ff14)',
            WebkitTextSizeAdjust: 'none',
            textSizeAdjust: 'none',
            overflowWrap: 'anywhere',
            hyphens: 'none',
            backgroundSize: '300% auto',
            animation: 'av-titleReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) both, av-titleShimmer 3s ease-in-out infinite',
          }}
        >
          <HackerText text={article.title} />
        </h1>
      </div>
      <h2
        key={`sub-${article.id}`}
        className="text-[12pt] text-[#39ff14] mb-12 font-light tracking-wide"
        style={{ animation: 'av-titleReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.12s both' }}
      >{article.subtitle}</h2>

      <div
        className="prose prose-invert prose-cyan max-w-none font-mono text-sm md:text-base leading-relaxed"
        ref={contentRef}
        onClick={handleContentClick}
      >
        {article.html
          ? displayedChunks.map((chunk, i) => (
              <div
                key={i}
                dangerouslySetInnerHTML={{ __html: chunk }}
                style={{ animation: 'av-blockIn 0.18s ease-out both' }}
              />
            ))
          : renderContent(contentBody)?.map((node, i) =>
              React.cloneElement(node, {
                style: { ...node.props.style, animation: `av-blockIn 0.18s ease-out ${i * 35}ms both` },
              })
            )
        }
      </div>

      <div className={`mt-16 pt-8 border-t ${isAcademic ? 'border-amber-900/30' : 'border-cyan-900/30'} flex justify-between items-center text-[10px] font-bold tracking-widest text-gray-600 uppercase`}>
        <span>{isAcademic ? 'END OF THESIS // ACADEMIC ARCHIVE' : 'END OF TRANSMISSION'}</span>
        <span>SIG: {sig}</span>
      </div>
    </div>
  </div>
  );
};

export default React.memo(ArticleView);
