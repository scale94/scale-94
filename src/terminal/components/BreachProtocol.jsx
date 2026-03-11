import React, { useState, useEffect, useCallback } from 'react';

const HEX_POOL  = ['1C', '55', 'BD', 'E9', '7A', 'FF', 'E3', '9A'];
const BUF_SIZE  = 6;
const GRID_SIZE = 6;
const TIMEOUT_S = 30;

const DAEMON_DEFS = [
  { name: 'DATAMINE_V1', reward: '¥ 1,500 eddies',    color: 'text-[#39ff14]',  borderSolved: 'border-[#39ff14]/60 bg-[#39ff14]/5' },
  { name: 'DATAMINE_V2', reward: '¥ 3,000 eddies',    color: 'text-cyan-400',   borderSolved: 'border-cyan-500/60 bg-cyan-900/10' },
  { name: 'ICEPICK',     reward: 'BREACH_ACCESS::GRANTED', color: 'text-fuchsia-400', borderSolved: 'border-fuchsia-500/60 bg-fuchsia-900/10' },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function genMatrix() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => pick(HEX_POOL))
  );
}

function genDaemons() {
  return DAEMON_DEFS.map((def, i) => ({
    ...def,
    sequence: Array.from({ length: 2 + i }, () => pick(HEX_POOL)),
    solved: false,
  }));
}

// Returns how many leading elements of `seq` appear consecutively in `buf`.
function prefixMatchLen(seq, buf) {
  const bufStr = buf.join(',');
  for (let len = seq.length; len >= 1; len--) {
    if (bufStr.includes(seq.slice(0, len).join(','))) return len;
  }
  return 0;
}

const BreachProtocol = ({ onClose, onSuccess }) => {
  const [matrix]   = useState(genMatrix);
  const [daemons,  setDaemons]  = useState(genDaemons);
  const [buffer,   setBuffer]   = useState([]);
  const [selected, setSelected] = useState([]); // [{row,col}]
  const [mode,     setMode]     = useState('row'); // 'row' | 'col'
  const [pinRow,   setPinRow]   = useState(0);
  const [pinCol,   setPinCol]   = useState(0);
  const [phase,    setPhase]    = useState('active'); // 'active'|'win'|'fail'
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_S);

  // Countdown
  useEffect(() => {
    if (phase !== 'active') return;
    if (timeLeft <= 0) { setPhase('fail'); return; }
    const t = setInterval(() => setTimeLeft(n => n - 1), 1000);
    return () => clearInterval(t);
  }, [phase, timeLeft]);

  const handleCellClick = useCallback((row, col) => {
    if (phase !== 'active') return;
    if (buffer.length >= BUF_SIZE) return;
    if (mode === 'row' && row !== pinRow) return;
    if (mode === 'col' && col !== pinCol) return;
    if (selected.some(s => s.row === row && s.col === col)) return;

    const hex       = matrix[row][col];
    const newBuf    = [...buffer, hex];
    const newSel    = [...selected, { row, col }];

    setBuffer(newBuf);
    setSelected(newSel);

    if (mode === 'row') { setMode('col'); setPinCol(col); }
    else                { setMode('row'); setPinRow(row); }

    const newDaemons = daemons.map(d => ({
      ...d,
      solved: d.solved || newBuf.join(',').includes(d.sequence.join(',')),
    }));
    setDaemons(newDaemons);

    const allSolved  = newDaemons.every(d => d.solved);
    const bufFull    = newBuf.length >= BUF_SIZE;
    const anySolved  = newDaemons.some(d => d.solved);

    if (allSolved || (bufFull && anySolved)) {
      setPhase('win');
      setTimeout(() => onSuccess?.(), 1800);
    } else if (bufFull) {
      setPhase('fail');
    }
  }, [phase, mode, pinRow, pinCol, buffer, selected, matrix, daemons, onSuccess]);

  const isSelectable = (row, col) =>
    phase === 'active' &&
    buffer.length < BUF_SIZE &&
    !selected.some(s => s.row === row && s.col === col) &&
    (mode === 'row' ? row === pinRow : col === pinCol);

  const isSelected  = (row, col) => selected.some(s => s.row === row && s.col === col);
  const isHighlight = (row, col) => !isSelected(row, col) && (mode === 'row' ? row === pinRow : col === pinCol);

  const timerPct    = (timeLeft / TIMEOUT_S) * 100;
  const timerColor  = timerPct > 50 ? '#39ff14' : timerPct > 25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="fixed inset-0 z-[200] bg-black/97 font-mono flex items-center justify-center p-2 md:p-4 backdrop-blur-sm">
      <div className="max-w-2xl w-full border border-cyan-500/40 bg-black shadow-[0_0_60px_rgba(6,182,212,0.15)] relative overflow-hidden">

        {/* Phase overlays */}
        {phase === 'win' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85">
            <div className="text-center space-y-2">
              <div className="text-[#39ff14] text-3xl md:text-4xl font-black tracking-widest" style={{ animation: 'bs-glitch 0.25s steps(1) 0s 3 forwards' }}>
                BREACH COMPLETE
              </div>
              <div className="text-cyan-400 text-xs tracking-widest">NETWORK ACCESS GRANTED // ICE DISSOLVED</div>
              <div className="text-[#39ff14]/50 text-[10px] mt-4">
                {daemons.filter(d => d.solved).map(d => d.name).join(' + ')} uploaded
              </div>
            </div>
          </div>
        )}
        {phase === 'fail' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85">
            <div className="text-center space-y-3">
              <div className="text-red-500 text-3xl md:text-4xl font-black tracking-widest">ICE_LOCK :: ACTIVE</div>
              <div className="text-red-400/60 text-xs tracking-widest">TRACE COMPLETE — COUNTERMEASURES DEPLOYED</div>
              <button onClick={onClose} className="mt-4 text-xs text-cyan-600 hover:text-cyan-400 border border-cyan-900/40 px-6 py-2 transition-colors tracking-widest">[JACK_OUT]</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="border-b border-cyan-900/40 px-4 md:px-6 py-3 flex justify-between items-center">
          <div className="text-[10px] tracking-widest uppercase flex items-center gap-3">
            <span className="text-fuchsia-500 font-black">BREACH_PROTOCOL</span>
            <span className="text-cyan-900/50">//</span>
            <span className="text-cyan-700">SCALE_9.4 ICE NODE</span>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className={`font-bold tracking-widest transition-colors ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-cyan-600'}`}>
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
            <button onClick={onClose} className="text-cyan-900 hover:text-red-400 transition-colors tracking-widest">[ABORT]</button>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-[2px] bg-cyan-950/80">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${timerPct}%`, background: timerColor, boxShadow: `0 0 8px ${timerColor}` }}
          />
        </div>

        {/* Mode indicator */}
        <div className="px-4 md:px-6 py-2 flex items-center gap-3 bg-cyan-950/10 border-b border-cyan-900/20 text-[10px] tracking-widest">
          <span className="text-fuchsia-500">{'>'}</span>
          <span className="text-cyan-600">SELECT:</span>
          <span className="text-[#39ff14] font-bold">
            {mode === 'row' ? `HORIZONTAL ROW ${pinRow + 1}` : `VERTICAL COL ${pinCol + 1}`}
          </span>
          <span className="ml-auto text-cyan-900/50">BUFFER {buffer.length}/{BUF_SIZE}</span>
        </div>

        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Matrix */}
          <div>
            <div className="text-[9px] tracking-widest text-cyan-900/50 mb-3 uppercase">DATAMINE MATRIX</div>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
            >
              {matrix.map((row, rIdx) =>
                row.map((hex, cIdx) => {
                  const sel  = isSelected(rIdx, cIdx);
                  const able = isSelectable(rIdx, cIdx);
                  const high = isHighlight(rIdx, cIdx);
                  return (
                    <button
                      key={`${rIdx}-${cIdx}`}
                      onClick={() => handleCellClick(rIdx, cIdx)}
                      disabled={!able || sel}
                      className={[
                        'text-[11px] font-black py-1.5 text-center transition-all duration-75 rounded-sm select-none',
                        sel  ? 'bg-transparent text-cyan-900/30 line-through cursor-default' : '',
                        able ? 'text-[#39ff14] bg-[#39ff14]/10 hover:bg-[#39ff14]/25 ring-1 ring-[#39ff14]/60 cursor-pointer shadow-[0_0_6px_rgba(57,255,20,0.3)]' : '',
                        high && !sel ? 'text-cyan-700/60' : '',
                        !sel && !able && !high ? 'text-cyan-900/40 cursor-default' : '',
                      ].join(' ')}
                    >
                      {hex}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right panel: daemons + buffer */}
          <div className="space-y-4">

            {/* Daemons */}
            <div>
              <div className="text-[9px] tracking-widest text-cyan-900/50 mb-2 uppercase">DAEMON SEQUENCE</div>
              <div className="space-y-2">
                {daemons.map((d, i) => {
                  const matchLen = prefixMatchLen(d.sequence, buffer);
                  return (
                    <div
                      key={i}
                      className={`border px-3 py-2 text-xs transition-all duration-300 ${d.solved ? d.borderSolved : 'border-cyan-900/25'}`}
                    >
                      <div className={`font-bold mb-1.5 flex justify-between items-center text-[10px] tracking-widest ${d.color}`}>
                        <span>{d.name}</span>
                        {d.solved
                          ? <span className="text-[#39ff14] animate-pulse">[UPLOADED]</span>
                          : <span className="text-cyan-900/40">{d.reward}</span>
                        }
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {d.sequence.map((h, j) => (
                          <span
                            key={j}
                            className={`px-1.5 py-0.5 border text-[10px] font-black transition-all ${
                              d.solved || j < matchLen
                                ? 'border-[#39ff14] text-[#39ff14] bg-[#39ff14]/10 shadow-[0_0_4px_rgba(57,255,20,0.4)]'
                                : 'border-cyan-900/40 text-cyan-800/60'
                            }`}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buffer */}
            <div>
              <div className="text-[9px] tracking-widest text-cyan-900/50 mb-2 uppercase">BUFFER MEMORY</div>
              <div className="flex gap-1">
                {Array.from({ length: BUF_SIZE }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-9 border flex items-center justify-center text-[11px] font-black transition-all duration-150 ${
                      i < buffer.length
                        ? 'border-cyan-500/80 text-cyan-300 bg-cyan-900/20 shadow-[0_0_4px_rgba(6,182,212,0.3)]'
                        : 'border-cyan-900/25 text-cyan-900/20'
                    }`}
                  >
                    {buffer[i] ?? '░░'}
                  </div>
                ))}
              </div>
            </div>

            {/* Shannon entropy strip — §4.1 lore element */}
            <div className="border border-cyan-900/20 p-2 text-[9px] tracking-wider font-mono">
              <div className="text-cyan-900/50 mb-1">ENTROPY_MONITOR :: H(X)</div>
              <div className="flex gap-px h-4 items-end">
                {Array.from({ length: 24 }).map((_, i) => {
                  const filled = i < Math.round((buffer.length / BUF_SIZE) * 24);
                  const height = filled ? `${40 + Math.sin(i * 1.3) * 30 + 30}%` : `${20 + Math.sin(i * 0.9) * 10 + 10}%`;
                  return (
                    <div
                      key={i}
                      className="flex-1 transition-all duration-200"
                      style={{
                        height,
                        background: filled
                          ? `rgba(57,255,20,${0.4 + (i / 24) * 0.6})`
                          : 'rgba(6,182,212,0.1)',
                      }}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-cyan-900/40">
                <span>NOISE</span>
                <span className={buffer.length > 0 ? 'text-[#39ff14]/60' : ''}>
                  {buffer.length > 0 ? '→ COMPRESSING' : 'IDLE'}
                </span>
                <span>ORDER</span>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-cyan-900/20 px-6 py-2 flex justify-between text-[9px] tracking-widest text-cyan-900/40">
          <span>CLICK HIGHLIGHTED CELLS TO SELECT</span>
          <span>ICE: MILITECH MANTIS v4.2</span>
        </div>
      </div>
    </div>
  );
};

export default BreachProtocol;
