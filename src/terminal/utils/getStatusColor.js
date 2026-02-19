const getStatusColor = (status) => {
  switch (status) {
    case 'ACTIVE': return 'border-cyan-500 text-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.3)]';
    case 'RUNNING': return 'border-[#39ff14] text-[#39ff14] shadow-[0_0_5px_rgba(57,255,20,0.3)]';
    case 'PLATINUM': return 'border-cyan-300 text-cyan-300 shadow-[0_0_5px_rgba(103,232,249,0.3)]';
    case 'STABLE': return 'border-blue-400 text-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.3)]';
    case 'PROPOSED': return 'border-fuchsia-400 text-fuchsia-400 shadow-[0_0_5px_rgba(232,121,249,0.3)]';
    case 'FROZEN': return 'border-indigo-400 text-indigo-400 shadow-[0_0_5px_rgba(129,140,248,0.3)]';
    case 'ARCHIVED': return 'border-gray-500 text-gray-500';
    case 'LEGACY': return 'border-gray-600 text-gray-600';
    default: return 'border-gray-500 text-gray-500';
  }
};

export default getStatusColor;
