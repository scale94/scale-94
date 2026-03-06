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
       * Fixed 80px container locks the vertical space before the scramble starts.
       * display:flex + alignItems:flex-start pins the text to the top of the
       * reserved block so it never shifts surrounding content regardless of how
       * many characters are mid-scramble. overflow:hidden prevents transient
       * paint bleed during animation frames.
       */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr', height: '120px', overflow: 'hidden' }}>
        <h1 className="text-[14pt] font-bold mb-4 text-cyan-400 tracking-tighter leading-tight" style={{ alignSelf: 'start' }}>
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
