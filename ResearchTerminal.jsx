import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Terminal, FileText, Share2 } from 'lucide-react';

// Adjusted for F: drive peer-level architecture
const kernels = import.meta.glob('./content/*.md', { as: 'raw', eager: true });

const ResearchTerminal = () => {
  const [activeKernel, setActiveKernel] = useState(Object.keys(kernels)[0] || '');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (activeKernel && kernels[activeKernel]) {
      setContent(kernels[activeKernel]);
    }
  }, [activeKernel]);

  return (
    <div className="flex h-screen bg-black text-violet-400 font-mono overflow-hidden">
      {/* Sidebar: Archive Navigation */}
      <div className="w-72 border-r border-violet-900/30 bg-neutral-950 p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-8 opacity-80">
          <Terminal size={18} />
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold">Soma Scale 9.4</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2">
          {Object.keys(kernels).map((path) => {
            const fileName = path.split('/').pop().replace('.md', '');
            return (
              <button
                key={path}
                onClick={() => setActiveKernel(path)}
                className={`w-full text-left px-3 py-2 rounded-sm text-sm transition-all duration-200 border-l-2 ${
                  activeKernel === path 
                  ? 'bg-violet-900/20 border-violet-500 text-violet-100 shadow-[0_0_15px_rgba(139,92,246,0.1)]' 
                  : 'border-transparent hover:bg-violet-900/10 hover:text-violet-200'
                }`}
              >
                {fileName}
              </button>
            );
          })}
        </div>

        {/* System Status Footer */}
        <div className="mt-6 pt-6 border-t border-violet-900/30 text-[10px] opacity-40 uppercase tracking-widest">
          Status: Air-Gapped / WPA3-SAE
        </div>
      </div>

      {/* Main Signal: High-Fidelity Content Rendering */}
      <div className="flex-1 overflow-y-auto bg-black relative">
        <div className="max-w-4xl mx-auto p-12 lg:p-20">
          <article className="prose prose-invert prose-violet prose-sm md:prose-base max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
};

export default ResearchTerminal;