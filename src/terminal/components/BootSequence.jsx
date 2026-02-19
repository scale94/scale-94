import React from 'react';

const BootSequence = () => (
  <div className="min-h-screen bg-black text-cyan-400 font-mono flex items-center justify-center p-4">
    <div className="max-w-md w-full relative">
      <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-fuchsia-600 rounded-lg blur opacity-20 animate-pulse"></div>
      <div className="relative">
        <div className="animate-pulse mb-4 text-xl font-bold lowercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
          init_scale_protocol...
        </div>
        <div className="space-y-1 text-sm opacity-90 text-cyan-500">
          <div><span className="text-fuchsia-500">{'>'}</span> MOUNTING VOLUMES... [OK]</div>
          <div><span className="text-fuchsia-500">{'>'}</span> LOADING SOMA_KERNEL_V5.5... [OK]</div>
          <div><span className="text-fuchsia-500">{'>'}</span> ESTABLISHING SECURE CONNECTION... [OK]</div>
          <div><span className="text-fuchsia-500">{'>'}</span> DECRYPTING ARCHIVES... [OK]</div>
          <div className="mt-4 text-[#39ff14] font-bold">scale_9.4 is active.</div>
        </div>
      </div>
    </div>
  </div>
);

export default BootSequence;
