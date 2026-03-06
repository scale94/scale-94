import React, { useMemo, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import HackerText from '../components/HackerText';
import renderContent from '../utils/renderContent';

const ArticleView = ({ article, originTab, handleReturnToRoot, onNeuralLink }) => {
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

  // Generate once per article load — article.id is the intentional trigger,
  // not a value used inside the callback (Math.random needs no deps).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sig = useMemo(() => Math.random().toString(36).substring(7), [article.id]);

  return (
  <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-300">
    <button onClick={handleReturnToRoot} className="mb-8 flex items-center text-xs font-bold tracking-widest text-cyan-600 hover:text-white transition-colors border border-cyan-900/50 hover:border-cyan-500 px-3 py-2 -ml-2 w-fit uppercase bg-[#09090b] rounded-sm">
      <ArrowLeft className="w-3 h-3 mr-2" /> Return_To_{(originTab || '').toUpperCase()}
    </button>

    <div className="border-l-2 border-fuchsia-500/50 pl-8 relative">
      <div className="flex flex-wrap gap-4 text-[10px] font-bold tracking-widest text-cyan-600 mb-8 font-mono uppercase">
        <span className="text-fuchsia-500">LOG: {article.id}</span>
        <span>{'//'}</span>
        <span>DATE: {article.date || 'UNDATED'}</span>
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
          className="text-[14pt] font-bold mb-4 text-cyan-400 tracking-tighter leading-tight"
          style={{
            // Prevents Firefox Android font-inflation from altering line count.
            WebkitTextSizeAdjust: 'none',
            textSizeAdjust: 'none',
            // Allows wrap at any codepoint — stops wide random glyphs from
            // overflowing the cell horizontally and creating false extra lines.
            overflowWrap: 'anywhere',
            // Kills Gecko soft-hyphen injection that changes effective char width.
            hyphens: 'none',
          }}
        >
          <HackerText text={article.title} />
        </h1>
      </div>
      <h2 className="text-[12pt] text-fuchsia-400 mb-12 font-light tracking-wide">{article.subtitle}</h2>

      <div
        className="prose prose-invert prose-cyan max-w-none font-mono text-sm md:text-base leading-relaxed"
        ref={contentRef}
        onClick={handleContentClick}
      >
        {article.html
          ? <div dangerouslySetInnerHTML={{ __html: article.html }} />
          : renderContent(contentBody)
        }
      </div>

      <div className="mt-16 pt-8 border-t border-cyan-900/30 flex justify-between items-center text-[10px] font-bold tracking-widest text-gray-600 uppercase">
        <span>END OF TRANSMISSION</span>
        <span>SIG: {sig}</span>
      </div>
    </div>
  </div>
  );
};

export default React.memo(ArticleView);
