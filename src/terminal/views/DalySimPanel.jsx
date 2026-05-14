/**
 * DalySimPanel — inline WASM simulation for DALY-SIM-KERNEL-1.0.0
 * Seven-parameter thermodynamic governor: Daly Rules + ODE engine.
 */
import { useState, useEffect, useRef } from 'react';
import { loadWasm } from '../../wasm/wasmSingleton';

const PARAMS = [
  { key: 'consumption',  label: 'CONSUMPTION',  unit: 'GJ/cap/yr', min: 5,   max: 200,    step: 1,      def: 80,     desc: 'Renewable energy consumed' },
  { key: 'regeneration', label: 'REGENERATION', unit: 'GJ/cap/yr', min: 5,   max: 100,    step: 1,      def: 30,     desc: 'Biosphere regen capacity' },
  { key: 'waste',        label: 'WASTE',        unit: 'Mt CO₂/yr', min: 1000,max: 100000, step: 500,    def: 55000,  desc: 'Global pollution output' },
  { key: 'absorption',   label: 'ABSORPTION',   unit: 'Mt/yr',     min: 1000,max: 50000,  step: 500,    def: 11000,  desc: 'Natural sink capacity' },
  { key: 'nr_depletion', label: 'DEPLETION',    unit: '/yr',       min: 0,   max: 0.15,   step: 0.001,  def: 0.025,  desc: 'Non-renewable depletion rate' },
  { key: 'substitution', label: 'SUBSTITUTION', unit: '/yr',       min: 0,   max: 0.1,    step: 0.001,  def: 0.008,  desc: 'Renewable substitution rate' },
  { key: 'years',        label: 'HORIZON',      unit: 'yr',        min: 10,  max: 500,    step: 10,     def: 100,    desc: 'Simulation horizon' },
];

function statusColor(output) {
  if (!output) return 'text-zinc-500';
  if (output.includes('COLLAPSE'))  return 'text-red-400';
  if (output.includes('CRITICAL'))  return 'text-orange-400';
  if (output.includes('SOLVENT') || output.includes('STABLE')) return 'text-green-400';
  return 'text-yellow-400';
}

export default function DalySimPanel() {
  const defaults = Object.fromEntries(PARAMS.map(p => [p.key, p.def]));
  const [vals, setVals]   = useState(defaults);
  const [output, setOut]  = useState('');
  const [running, setRun] = useState(false);
  const modRef            = useRef(null);

  useEffect(() => {
    loadWasm().then(m => { modRef.current = m; }).catch(() => {});
  }, []);

  useEffect(() => {
    const mod = modRef.current;
    if (!mod?.run_daly_thermo_simulation) return;
    setRun(true);
    try {
      const result = mod.run_daly_thermo_simulation(
        vals.consumption, vals.regeneration, vals.waste,
        vals.absorption,  vals.nr_depletion, vals.substitution, vals.years
      );
      setOut(result ?? '');
    } catch (e) {
      setOut(`ERROR: ${e.message}`);
    } finally {
      setRun(false);
    }
  }, [vals, modRef.current]);

  const set = (key, val) => setVals(v => ({ ...v, [key]: val }));

  const rule1 = (vals.consumption / vals.regeneration).toFixed(2);
  const rule2 = (vals.waste / vals.absorption).toFixed(2);
  const rule3 = (vals.nr_depletion / vals.substitution).toFixed(2);
  const breaches = [rule1, rule2, rule3].filter(r => parseFloat(r) > 1.0).length;

  return (
    <div className="mt-6 mb-2 border border-red-900/30 bg-black/40 rounded-sm font-mono text-xs">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-red-900/20">
        <span className="text-red-400/80 text-[11px] tracking-widest uppercase">
          DALY THERMO SIMULATION
        </span>
        <span className="text-zinc-600 text-[10px]">
          {breaches === 0 ? (
            <span className="text-green-400/70">ALL RULES PASS</span>
          ) : (
            <span className="text-red-400/80">{breaches} RULE{breaches > 1 ? 'S' : ''} BREACHED</span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

        {/* Sliders */}
        <div className="px-4 py-3 space-y-3 border-r border-red-900/10">
          {PARAMS.map(p => (
            <div key={p.key}>
              <div className="flex justify-between mb-1">
                <span className="text-zinc-400 tracking-wider">{p.label}</span>
                <span className="text-cyan-300/80">
                  {p.step < 1
                    ? vals[p.key].toFixed(3)
                    : vals[p.key].toLocaleString()}
                  <span className="text-zinc-600 ml-1">{p.unit}</span>
                </span>
              </div>
              <input
                type="range"
                min={p.min} max={p.max} step={p.step}
                value={vals[p.key]}
                onChange={e => set(p.key, parseFloat(e.target.value))}
                className="w-full h-[3px] accent-red-500 cursor-pointer"
              />
              <div className="text-zinc-600 text-[10px] mt-0.5">{p.desc}</div>
            </div>
          ))}

          {/* Daly Rules live audit */}
          <div className="mt-2 pt-2 border-t border-red-900/20 space-y-1">
            {[
              { label: 'R1 Renewable',   ratio: rule1 },
              { label: 'R2 Pollution',   ratio: rule2 },
              { label: 'R3 Non-renew',   ratio: rule3 },
            ].map(({ label, ratio }) => {
              const breach = parseFloat(ratio) > 1.0;
              return (
                <div key={label} className="flex justify-between">
                  <span className="text-zinc-500">{label}</span>
                  <span className={breach ? 'text-red-400' : 'text-green-400/80'}>
                    {ratio}× [{breach ? 'BREACH' : 'PASS'}]
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Output */}
        <div className="px-4 py-3">
          <div className={`text-[10px] leading-relaxed whitespace-pre-wrap ${statusColor(output)}`}>
            {running ? 'RUNNING...' : (output || 'AWAITING MODULE...')}
          </div>
        </div>
      </div>

      <div className="px-4 py-1.5 border-t border-red-900/20 text-[10px] text-zinc-700">
        WASM · run_daly_thermo_simulation · daly-sim-kernel-1.0.0 · Daly (1990) / Prigogine (1967)
      </div>
    </div>
  );
}
