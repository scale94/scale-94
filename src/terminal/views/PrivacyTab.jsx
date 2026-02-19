import React from 'react';
import { AlertTriangle } from 'lucide-react';
import renderContent from '../utils/renderContent';
import { privacyContent } from '../data/content';

const PrivacyTab = () => (
  <div className="animate-in fade-in duration-500 max-w-2xl mx-auto mt-12 border border-red-900/30 p-8 rounded-lg bg-red-950/5 backdrop-blur">
    <div className="flex items-center gap-3 mb-6 text-red-400">
      <AlertTriangle className="w-6 h-6" />
      <h2 className="text-2xl font-bold">PRIVACY_PROTOCOL</h2>
    </div>
    <div className="prose prose-invert prose-red max-w-none font-mono text-sm md:text-base leading-relaxed">
      {renderContent(privacyContent)}
    </div>
  </div>
);

export default PrivacyTab;
