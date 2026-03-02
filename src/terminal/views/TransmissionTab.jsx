import React from 'react';
import HackerText from '../components/HackerText';

const TransmissionTab = ({ stories, onSelect }) => (
  <div className="animate-in fade-in duration-500">

    {/* Header */}
    <div className="mb-10 border-b border-fuchsia-900/30 pb-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-fuchsia-500 text-xl">⌖</span>
        <h1 className="text-[13pt] font-bold tracking-widest text-fuchsia-400 uppercase">
          <HackerText text="TRANSMISSION" />
        </h1>
      </div>
      <p className="text-xs font-bold tracking-widest text-cyan-700 uppercase">
        signal / fiction / dispatch — scale94 creative archive
      </p>
    </div>

    {/* Story grid */}
    {stories.length === 0 ? (
      <div className="text-center py-24 text-cyan-900 font-bold tracking-widest uppercase text-xs">
        [ NO TRANSMISSIONS FOUND ]
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {stories.map((story, i) => (
          <div
            key={story.id}
            onClick={() => onSelect(story)}
            className="group cursor-pointer border border-fuchsia-900/30 hover:border-fuchsia-500/60 bg-black/40 hover:bg-fuchsia-950/20 p-6 rounded-sm transition-all duration-300 relative overflow-hidden"
          >
            {/* Index */}
            <div className="text-[10px] font-bold tracking-widest text-fuchsia-900 group-hover:text-fuchsia-600 transition-colors mb-4 uppercase flex justify-between items-center">
              <span>TRANSMISSION_{String(i + 1).padStart(2, '0')}</span>
              <span className="text-fuchsia-800 group-hover:text-fuchsia-500 transition-colors">⌖</span>
            </div>

            {/* Title */}
            <h2 className="text-[11pt] font-bold tracking-tight text-fuchsia-300 group-hover:text-white transition-colors mb-2 leading-snug">
              {story.title}
            </h2>

            {/* Subtitle / first line */}
            {story.subtitle && (
              <p className="text-xs text-cyan-700 group-hover:text-cyan-500 transition-colors mb-5 leading-relaxed line-clamp-2">
                {story.subtitle}
              </p>
            )}

            {/* Meta footer */}
            <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase border-t border-fuchsia-900/20 group-hover:border-fuchsia-900/50 pt-3 mt-3 transition-colors">
              <span className="text-fuchsia-800 group-hover:text-fuchsia-500 transition-colors">
                {story.date}
              </span>
              <span className="text-cyan-900 group-hover:text-cyan-600 transition-colors">
                {story.readTime}
              </span>
            </div>

            {/* Hover accent line */}
            <div className="absolute bottom-0 left-0 w-0 group-hover:w-full h-[1px] bg-fuchsia-500 transition-all duration-500" />
          </div>
        ))}
      </div>
    )}

    {/* Footer signal */}
    <div className="mt-16 text-[10px] font-bold tracking-widest text-fuchsia-900/40 uppercase text-center">
      ⌖ signal received — scale94 transmission archive ⌖
    </div>
  </div>
);

export default React.memo(TransmissionTab);
