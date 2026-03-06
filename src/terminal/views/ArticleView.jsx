import React, { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import HackerText from '../components/HackerText';
import renderContent from '../utils/renderContent';

const ArticleView = ({ article, originTab, handleReturnToRoot }) => {
  // Strip the first # heading from content — ArticleView already renders article.title
  // above as its own <h1>, so leaving it in the body causes a duplicate heading.
  // article.body is the canonical field; article.content is kept as an alias.
  const contentBody = (article.body || article.content || '')
    .replace(/^#(?!#)[ \t]+[^\n]*\n?/, '')
    .trimStart();

  // Generate once per article, not on every re-render
  const sig = useMemo(() => Math.random().toString(36).substring(7), [article.id]);

  return (
  <div className="max-w-4xl mx-auto animate-in zoom-in-95 duration-300">
    <button onClick={handleReturnToRoot} className="mb-8 flex items-center text-xs font-bold tracking-widest text-cyan-600 hover:text-white transition-colors border border-cyan-900/50 hover:border-cyan-500 px-3 py-2 -ml-2 w-fit uppercase bg-[#09090b] rounded-sm">
      <ArrowLeft className="w-3 h-3 mr-2" /> Return_To_{(originTab || '').toUpperCase()}
    </button>

    <div className="border-l-2 border-fuchsia-500/50 pl-8 relative">
      <div className="flex flex-wrap gap-4 text-[10px] font-bold tracking-widest text-cyan-600 mb-8 font-mono uppercase">
        <span className="text-fuchsia-500">LOG: {article.id}</span>
        <span>//</span>
        <span>DATE: {article.date || 'UNDATED'}</span>
        <span>//</span>
        <span>LEN: {article.len || article.readTime || '0 WDS'}</span>
      </div>

      {/*
       * Kinetic Dampener: CSS Grid reserves a rigid floor for the scramble.
       * - display:grid + grid-template-rows:1fr → h1 occupies one grid track,
       *   so its height change during scramble is contained within the track.
       * - alignItems:start → h1 anchors to the top of the track; text grows
       *   downward and never pushes content above.
       * - minHeight:120px → guarantees a solid floor for up to ~2 wrapped lines
       *   at 14pt. Everything below sees a floor that never shrinks below this.
       * - overflow:hidden → clips any transient paint bleed between frames.
       */}
      <div style={{
        display: 'grid',
        gridTemplateRows: '1fr',
        // clamp: 120px floor → scales with vh on small screens → 200px ceiling.
        // 'contain: size' uses the resolved height as the element's intrinsic size,
        // so clamp() is fully respected even with containment active.
        height: 'clamp(120px, 20vh, 200px)',
        lineHeight: '1.2',
        overflow: 'hidden',
        alignItems: 'start',
        // Nuclear containment: layout prevents external reflow propagation;
        // size declares that children cannot influence this element's dimensions.
        contain: 'layout size',
      }}>
        <h1
          className="text-[14pt] font-bold mb-4 text-cyan-400 tracking-tighter leading-tight"
          style={{
            // Firefox Android artificially boosts font sizes for readability.
            // Disabling this keeps the 14pt calculation honest across engines.
            WebkitTextSizeAdjust: 'none',
            textSizeAdjust: 'none',
            // 'anywhere' allows wrap at any character boundary — prevents long
            // random-glyph sequences from overflowing the cage horizontally.
            // 'none' disables Gecko's invisible soft-hyphen insertion, which
            // changes the apparent character count and breaks the line-count
            // assumption our 120px floor is built on.
            overflowWrap: 'anywhere',
            hyphens: 'none',
          }}
        >
          <HackerText text={article.title} />
        </h1>
      </div>
      <h2 className="text-[12pt] text-fuchsia-400 mb-12 font-light tracking-wide">{article.subtitle}</h2>

      <div className="prose prose-invert prose-cyan max-w-none font-mono text-sm md:text-base leading-relaxed">
        {renderContent(contentBody)}
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
