import React from 'react';

const ManifestoTab = ({ systemArticles = {} }) => {
  const manifesto = systemArticles['MANIFESTO'];
  return (
  <div className="animate-in fade-in duration-500 max-w-3xl mx-auto mt-12 border border-cyan-500/30 p-8 rounded-lg bg-black/50 backdrop-blur">
    <div
      className="font-mono text-sm md:text-base leading-relaxed"
      dangerouslySetInnerHTML={{ __html: manifesto?.html ?? '' }}
    />
  </div>
  );
};

export default React.memo(ManifestoTab);
