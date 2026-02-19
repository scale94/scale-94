import React from 'react';

const OctagonGrid = ({ visible }) => (
  <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
    <svg className="w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <defs>
        <pattern id="octagon-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M12 0 L28 0 L40 12 L40 28 L28 40 L12 40 L0 28 L0 12 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-cyan-500"
          />
          <circle cx="20" cy="20" r="1" className="fill-fuchsia-500/50" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#octagon-pattern)" />
    </svg>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] opacity-60"></div>
  </div>
);

export default OctagonGrid;
