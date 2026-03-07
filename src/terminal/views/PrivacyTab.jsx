import React from 'react';
import { AlertTriangle } from 'lucide-react';

const PrivacyTab = ({ systemArticles = {} }) => {
  const privacy = systemArticles['PRIVACY-PROTOCOL'];
  return (
  <div className="animate-in fade-in duration-500 max-w-2xl mx-auto mt-12 border border-red-900/30 p-8 rounded-lg bg-red-950/5 backdrop-blur">
    <div className="flex items-center gap-3 mb-6 text-red-400">
      <AlertTriangle className="w-6 h-6" />
    </div>
    <div
      className="font-mono text-sm md:text-base leading-relaxed"
      dangerouslySetInnerHTML={{ __html: privacy?.html ?? '' }}
    />
  </div>
  );
};

export default React.memo(PrivacyTab);
