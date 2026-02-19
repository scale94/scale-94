import React from 'react';
import renderContent from '../utils/renderContent';
import { manifestoContent } from '../data/content';

const ManifestoTab = () => (
  <div className="animate-in fade-in duration-500 max-w-3xl mx-auto mt-12 border border-cyan-500/30 p-8 rounded-lg bg-black/50 backdrop-blur">
    <div className="prose prose-invert prose-cyan max-w-none font-mono text-sm md:text-base leading-relaxed">
      {renderContent(manifestoContent)}
    </div>
  </div>
);

export default ManifestoTab;
