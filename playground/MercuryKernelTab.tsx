/**
 * MERCURY TERMINAL — Kernel Tab
 *
 * Post-Quantum Olfactory Sovereignty Protocol — kernel governance surface.
 *
 * Self-contained: drop into any Vite / Next.js layout that ships React 18+,
 * Tailwind, and lucide-react. No external state, no context, no providers.
 *
 * Architecture:
 *   ▸ 155 BPM heartbeat (one setInterval) drives ALL micro-fluctuations
 *     — vector telemetry jitter, process CPU/MEM drift, PQC hex roll,
 *       log emission, quantum-resistance walk. One clock, four subsystems.
 *   ▸ useReducer for process scheduler (KILL / RESTART / SPAWN / TICK)
 *     — keeps PID lifecycle pure; click handlers dispatch typed actions.
 *   ▸ Ring-buffered logs (cap = LOG_BUFFER_SIZE) — slice on every push,
 *     no leak, no scroll-window unbounded growth.
 *   ▸ Two interactive controls on the header (tempo halt / volatility ×2)
 *     mutate the tick coefficients; the entire surface visibly responds.
 *
 * Audio metaphor: the protocol is locked to a 155 BPM techno reference.
 * Halting the tempo freezes the surface — every panel reads "PAUSED".
 *
 * Palette: obsidian #09090b base · crushed crimson · tactical amber ·
 * phosphor green · cold cyan. Strict monospace.
 */

import {
  useEffect, useReducer, useRef, useState, useCallback, useMemo, type ReactNode,
} from 'react';
import {
  Activity, AlertTriangle, Atom, Binary, ChevronRight, Cpu, FlaskConical,
  GaugeCircle, Hexagon, Lock, Power, Radio, RefreshCw, Shield, Skull,
  Timer, Waves, Wind, Zap,
} from 'lucide-react';

/* ─── Tempo & Buffers ───────────────────────────────────────────────────── */

const TEMPO_BPM      = 155;
const TICK_MS        = Math.round(60_000 / TEMPO_BPM); // ≈ 387ms per beat
const LOG_BUFFER_SIZE = 96;
const HEX_GRID_COLS  = 32;
const HEX_GRID_ROWS  = 6;
const VECTOR_HISTORY = 40;

/* ─── Palette (industrial obsidian × neon) ──────────────────────────────── */

const C = {
  bg:       '#09090b',
  panel:    '#0a0a0e',
  panelHi:  '#0d0d12',
  border:   '#1a1a22',
  borderHi: '#2a2a35',
  grid:     '#13131a',
  crimson:  '#dc2626',
  crimsonD: '#7f1d1d',
  amber:    '#f59e0b',
  amberD:   '#78350f',
  phosphor: '#39ff14',
  phosphorD:'#166534',
  cyan:     '#06b6d4',
  cyanD:    '#164e63',
  fuchsia:  '#d946ef',
  dim:      '#52525b',
  text:     '#a1a1aa',
  textHi:   '#e4e4e7',
} as const;

/* ─── Types ─────────────────────────────────────────────────────────────── */

type ProcessStatus = 'RUNNING' | 'SLEEP' | 'IO_WAIT' | 'BLOCKED' | 'ZOMBIE' | 'KILLED';
type LogLevel      = 'OK' | 'INFO' | 'WARN' | 'ERR' | 'SYS' | 'DBG';
type PqcKeyState   = 'LATTICE-SECURE' | 'ROTATING' | 'DECRYPT_ATTEMPT' | 'KYBER-VALID' | 'DILITHIUM-OK' | 'KEM-COMMIT';

interface KernelProcess {
  pid:      number;
  name:     string;
  cpu:      number;     // %
  mem:      number;     // KiB
  status:   ProcessStatus;
  priority: number;     // -20…19
  nice:     number;     // -20…19
  ticks:    number;     // beats since spawn
}

interface LogLine {
  id:       number;
  beat:     number;
  level:    LogLevel;
  facility: string;
  msg:      string;
}

interface VectorMetric {
  key:     string;
  label:   string;
  value:   number;
  unit:    string;
  min:     number;
  max:     number;
  warn?:   number;     // value at/above which we shade amber
  crit?:   number;     // value at/above which we shade crimson
  invert?: boolean;    // if true, warn/crit fire when value is BELOW thresholds
  history: number[];
}

/* ─── Process Reducer ───────────────────────────────────────────────────── */

type ProcessAction =
  | { type: 'TICK'; volatility: number; beat: number }
  | { type: 'KILL'; pid: number }
  | { type: 'RESTART'; pid: number };

function processReducer(state: KernelProcess[], action: ProcessAction): KernelProcess[] {
  switch (action.type) {
    case 'TICK':
      return state.map(p => {
        if (p.status === 'KILLED' || p.status === 'ZOMBIE') {
          // Killed processes occasionally decay into ZOMBIE then auto-reap
          if (p.status === 'KILLED' && action.beat % 8 === 0) {
            return { ...p, status: 'ZOMBIE' as ProcessStatus, cpu: 0, mem: Math.max(64, p.mem * 0.5) };
          }
          return p;
        }
        // CPU jitter scaled by volatility; clamp [0.1, 99.9]
        const cpuDrift = (Math.random() - 0.5) * 6 * action.volatility;
        const memDrift = (Math.random() - 0.5) * 48 * action.volatility;
        // Status flicker — small chance to enter waiting states
        let status: ProcessStatus = 'RUNNING';
        const r = Math.random();
        if      (r < 0.04) status = 'IO_WAIT';
        else if (r < 0.06) status = 'SLEEP';
        else if (r < 0.07) status = 'BLOCKED';
        // High-volatility processes are more likely to be in I/O
        if (p.cpu > 25 && Math.random() < 0.15 * action.volatility) status = 'IO_WAIT';
        return {
          ...p,
          cpu:    clamp(p.cpu + cpuDrift, 0.1, 99.9),
          mem:    Math.max(64, p.mem + memDrift),
          status,
          ticks:  p.ticks + 1,
        };
      });
    case 'KILL':
      return state.map(p => p.pid === action.pid
        ? { ...p, status: 'KILLED' as ProcessStatus, cpu: 0 }
        : p);
    case 'RESTART':
      return state.map(p => p.pid === action.pid
        ? {
            ...p,
            status: 'RUNNING' as ProcessStatus,
            cpu:    4 + Math.random() * 18,
            mem:    512 + Math.random() * 2048,
            ticks:  0,
          }
        : p);
    default:
      return state;
  }
}

const INITIAL_PROCESSES: KernelProcess[] = [
  { pid:    1, name: 'systemd_olfactory',     cpu:  0.8, mem:  4096, status: 'RUNNING', priority: -20, nice:  0, ticks: 99421 },
  { pid:   42, name: 'sys_olfactory_bind',    cpu: 24.7, mem: 16384, status: 'RUNNING', priority:  10, nice:  0, ticks: 41203 },
  { pid:  137, name: 'pqc_key_shuffler',      cpu: 18.3, mem:  8192, status: 'RUNNING', priority:   5, nice: -5, ticks: 38104 },
  { pid:  256, name: 'techno_sync_daemon',    cpu: 12.1, mem:  2048, status: 'RUNNING', priority:  15, nice:  0, ticks: 88172 },
  { pid:  404, name: 'kyber_lattice_grinder', cpu: 22.4, mem: 32768, status: 'RUNNING', priority:   8, nice:  0, ticks: 12440 },
  { pid:  666, name: 'aroma_dma_scheduler',   cpu:  9.2, mem:  1024, status: 'RUNNING', priority:  12, nice:  0, ticks: 60011 },
  { pid:  808, name: 'bpm_pll_locker',        cpu:  2.1, mem:   512, status: 'RUNNING', priority:  20, nice:  0, ticks: 90334 },
  { pid: 1024, name: 'dilithium_signer',      cpu: 11.6, mem:  4096, status: 'RUNNING', priority:   7, nice:  0, ticks: 17822 },
  { pid: 1337, name: 'sdr_decoupler',         cpu:  7.3, mem:  2048, status: 'RUNNING', priority:  10, nice:  0, ticks: 44091 },
  { pid: 2048, name: 'gas_phase_modulator',   cpu:  6.9, mem:  1536, status: 'RUNNING', priority:  11, nice:  0, ticks: 23104 },
  { pid: 4096, name: 'molecular_packet_mux',  cpu:  4.4, mem:   768, status: 'RUNNING', priority:  13, nice:  0, ticks: 71009 },
  { pid: 8192, name: 'entropy_pool_keeper',   cpu:  3.1, mem:   256, status: 'RUNNING', priority:  18, nice: 10, ticks: 99988 },
];

/* ─── Initial Vector Telemetry ──────────────────────────────────────────── */

const INITIAL_VECTORS: VectorMetric[] = [
  { key: 'SKE', label: 'SCENT-KEY ENTROPY',      value: 7.21,  unit: 'bits/sample', min: 0,   max: 8,    warn: 6.5, crit: 5.0,  invert: true,  history: [] },
  { key: 'SDR', label: 'SENSORY DECOUPLE RATIO', value: 0.842, unit: 'SDR',         min: 0,   max: 1,    warn: 0.7, crit: 0.5,  invert: true,  history: [] },
  { key: 'GPV', label: 'GAS-PHASE VOLATILES',    value: 142.3, unit: 'sccm',        min: 0,   max: 250,  warn: 200, crit: 230,                history: [] },
  { key: 'ASB', label: 'AROMA SYNTH BUFFER',     value: 67.4,  unit: '%',           min: 0,   max: 100,  warn: 85,  crit: 95,                 history: [] },
  { key: 'MTD', label: 'MOLECULAR TRANSFER',     value: 4.81,  unit: 'pkt/beat',    min: 0,   max: 10,                                         history: [] },
  { key: 'TPJ', label: 'TEMPO PHASE JITTER',     value: 0.018, unit: 'ms RMS',      min: 0,   max: 0.5,  warn: 0.2, crit: 0.4,                history: [] },
];

/* ─── Log Generator ─────────────────────────────────────────────────────── */

interface LogTemplate { level: LogLevel; facility: string; tpl: string; weight: number; }

const LOG_TEMPLATES: LogTemplate[] = [
  { level: 'OK',   facility: 'pqc.kex',         tpl: 'PQXDH key exchange committed to hardware layer',                       weight: 8 },
  { level: 'OK',   facility: 'olfactory.bind',  tpl: 'sensor matrix bound at /dev/scent0',                                   weight: 5 },
  { level: 'OK',   facility: 'kyber-1024',      tpl: 'CRYSTALS-Kyber-1024 keypair rotated (gen=$HEX$)',                      weight: 6 },
  { level: 'OK',   facility: 'dilithium',       tpl: 'ML-DSA signature verified [sig_id=0x$HEX$]',                           weight: 7 },
  { level: 'OK',   facility: 'sched',           tpl: 'PID $PID$ nice=$NICE$ applied successfully',                           weight: 4 },
  { level: 'OK',   facility: 'audio.pll',       tpl: 'core clock phase-locked to $BPM$ BPM (drift $DRIFT$ms)',               weight: 5 },
  { level: 'OK',   facility: 'gas.dma',         tpl: 'volatile transfer ring buffer flushed ($PKT$ pkts)',                   weight: 5 },
  { level: 'OK',   facility: 'tesseract',       tpl: 'CAS formula vault committed [sha256=$HEX$]',                           weight: 3 },
  { level: 'INFO', facility: 'user',            tpl: 'operator session opened from /dev/tty/0',                              weight: 2 },
  { level: 'INFO', facility: 'gas.flow',        tpl: 'inflow $SCCM$ sccm · outflow $SCCM$ sccm',                             weight: 5 },
  { level: 'INFO', facility: 'ck.tempo',        tpl: 'tempo telemetry: bpm=$BPM$ jitter=$PCT$ms',                            weight: 4 },
  { level: 'INFO', facility: 'olfactory.poll',  tpl: 'molecular packet $PID$ acknowledged at depth $PKT$',                   weight: 5 },
  { level: 'WARN', facility: 'olfactory.buf',   tpl: 'aroma buffer variance $PCT$% — within tolerance',                      weight: 4 },
  { level: 'WARN', facility: 'pqc.entropy',     tpl: 'entropy pool drained below 0x800 — reseeding from /dev/hwrng',         weight: 3 },
  { level: 'WARN', facility: 'gas.phase',       tpl: 'volatile saturation drift detected (Δ=$PCT$%)',                        weight: 3 },
  { level: 'WARN', facility: 'sched',           tpl: 'PID $PID$ exceeded nominal CPU budget ($PCT$%)',                       weight: 3 },
  { level: 'ERR',  facility: 'pqc.kex',         tpl: 'lattice handshake failed — peer offered classical curve',              weight: 1 },
  { level: 'ERR',  facility: 'olfactory',       tpl: 'molecular packet corruption at offset 0x$HEX$',                        weight: 1 },
  { level: 'ERR',  facility: 'dilithium',       tpl: 'signature verification REJECTED [sig_id=0x$HEX$]',                     weight: 1 },
  { level: 'SYS',  facility: 'sched',           tpl: 'syncing core clock to external audio frequency ($BPM$ BPM)',           weight: 4 },
  { level: 'SYS',  facility: 'kernel',          tpl: 'mounting /dev/sensor_array (post-quantum capable)',                    weight: 2 },
  { level: 'SYS',  facility: 'pqc',             tpl: 'rotating ephemeral keys (cadence: 4 beats)',                           weight: 3 },
  { level: 'SYS',  facility: 'olfactory',       tpl: 'binding /proc/scent_vector to userspace',                              weight: 2 },
  { level: 'DBG',  facility: 'kyber.poly',      tpl: 'sampling polynomial coefficient batch $PID$',                          weight: 3 },
  { level: 'DBG',  facility: 'olfactory.adc',   tpl: 'ADC sample window $PID$ complete (chans=8 bits=24)',                   weight: 3 },
  { level: 'DBG',  facility: 'tesseract.dh',    tpl: 'DH-EC shared secret derived ($HEX$ truncated)',                        weight: 2 },
];

const TEMPLATE_TOTAL_WEIGHT = LOG_TEMPLATES.reduce((s, t) => s + t.weight, 0);

function pickLogTemplate(): LogTemplate {
  let r = Math.random() * TEMPLATE_TOTAL_WEIGHT;
  for (const t of LOG_TEMPLATES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return LOG_TEMPLATES[0];
}

function buildLogLine(id: number, beat: number): LogLine {
  const t = pickLogTemplate();
  const msg = t.tpl
    .replace(/\$HEX\$/g,  () => randHex(8))
    .replace(/\$PID\$/g,  () => String(Math.floor(Math.random() * 8192)))
    .replace(/\$NICE\$/g, () => String(Math.floor(Math.random() * 21) - 10))
    .replace(/\$BPM\$/g,  () => (TEMPO_BPM + (Math.random() - 0.5) * 0.4).toFixed(3))
    .replace(/\$DRIFT\$/g,() => (Math.random() * 0.05).toFixed(3))
    .replace(/\$PKT\$/g,  () => String(Math.floor(Math.random() * 4096)))
    .replace(/\$SCCM\$/g, () => (100 + Math.random() * 100).toFixed(1))
    .replace(/\$PCT\$/g,  () => (Math.random() * 5).toFixed(3));
  return { id, beat, level: t.level, facility: t.facility, msg };
}

/* ─── Utility ───────────────────────────────────────────────────────────── */

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function randHex(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return s;
}

function generateHexGrid(): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < HEX_GRID_ROWS; r++) {
    const row: string[] = [];
    for (let c = 0; c < HEX_GRID_COLS; c++) row.push(randHex(2));
    grid.push(row);
  }
  return grid;
}

function rollHexGrid(prev: string[][], volatility: number): string[][] {
  const churn = clamp(0.12 * volatility, 0.04, 0.6);
  return prev.map(row => row.map(cell => Math.random() < churn ? randHex(2) : cell));
}

function fmtMem(kb: number): string {
  if (kb < 1024)        return `${kb.toFixed(0)}K`;
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)}M`;
  return `${(kb / 1024 / 1024).toFixed(2)}G`;
}

function metricColor(v: VectorMetric): string {
  if (v.crit !== undefined && (v.invert ? v.value <= v.crit : v.value >= v.crit)) return C.crimson;
  if (v.warn !== undefined && (v.invert ? v.value <= v.warn : v.value >= v.warn)) return C.amber;
  return C.phosphor;
}

const STATUS_COLOR: Record<ProcessStatus, string> = {
  RUNNING: C.phosphor,
  SLEEP:   C.cyan,
  IO_WAIT: C.amber,
  BLOCKED: C.crimson,
  ZOMBIE:  C.dim,
  KILLED:  C.crimson,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  OK:   C.phosphor,
  INFO: C.cyan,
  WARN: C.amber,
  ERR:  C.crimson,
  SYS:  C.fuchsia,
  DBG:  C.dim,
};

/* ─── Sub-components ────────────────────────────────────────────────────── */

interface PanelProps { title: string; subtitle?: string; icon: ReactNode; accent?: string; children: ReactNode; rightSlot?: ReactNode; }
function Panel({ title, subtitle, icon, accent = C.phosphor, children, rightSlot }: PanelProps) {
  return (
    <section
      className="flex flex-col min-h-0"
      style={{ background: C.panel, border: `1px solid ${C.border}` }}
    >
      <header
        className="flex items-center justify-between px-3 py-2 shrink-0"
        style={{ borderBottom: `1px solid ${C.border}`, background: C.panelHi }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: accent }} className="shrink-0">{icon}</span>
          <h3 className="text-[11px] tracking-[0.18em] uppercase shrink-0" style={{ color: C.textHi }}>{title}</h3>
          {subtitle && (
            <span className="text-[9px] tracking-wider truncate" style={{ color: C.dim }}>
              · {subtitle}
            </span>
          )}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}

function Sparkline({ data, color, height = 24 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />;
  const w = 100, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="0.8" opacity="0.85" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.07" />
    </svg>
  );
}

function VectorRow({ v, beat }: { v: VectorMetric; beat: number }) {
  const col = metricColor(v);
  const pct = clamp(((v.value - v.min) / (v.max - v.min)) * 100, 0, 100);
  return (
    <div className="grid grid-cols-12 gap-2 items-center px-3 py-2" style={{ borderBottom: `1px solid ${C.grid}` }}>
      <div className="col-span-3 min-w-0">
        <div className="text-[10px] tracking-wider truncate" style={{ color: C.textHi }}>{v.label}</div>
        <div className="text-[8px] tracking-widest" style={{ color: C.dim }}>{v.key} · {v.unit}</div>
      </div>
      <div className="col-span-3 text-right tabular-nums">
        <span className="text-[14px] font-bold" style={{ color: col }}>
          {v.value < 10 ? v.value.toFixed(3) : v.value.toFixed(2)}
        </span>
      </div>
      <div className="col-span-3 h-2 rounded-sm overflow-hidden" style={{ background: C.grid }}>
        <div
          className="h-full transition-[width] duration-[420ms] ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${col}cc, ${col}66)`,
            boxShadow: `0 0 8px ${col}55`,
          }}
        />
      </div>
      <div className="col-span-3">
        <Sparkline data={v.history} color={col} />
      </div>
    </div>
  );
}

function HexGrid({ grid, keyState }: { grid: string[][]; keyState: PqcKeyState }) {
  const accent = keyState === 'DECRYPT_ATTEMPT' ? C.crimson
              : keyState === 'ROTATING'         ? C.amber
              : C.phosphor;
  return (
    <div
      className="p-2.5 select-none leading-[1.15]"
      style={{ background: C.bg, borderTop: `1px solid ${C.grid}`, borderBottom: `1px solid ${C.grid}` }}
    >
      {grid.map((row, ri) => (
        <div key={ri} className="flex gap-[3px]">
          {row.map((cell, ci) => {
            // Highlight a small wandering cluster — feels "alive"
            const isHot = (ri + ci + Math.floor(Date.now() / 400)) % 17 === 0;
            return (
              <span
                key={ci}
                className="text-[9px] font-mono tabular-nums"
                style={{
                  color:   isHot ? accent : C.dim,
                  opacity: isHot ? 1 : 0.55,
                  textShadow: isHot ? `0 0 6px ${accent}aa` : 'none',
                }}
              >
                {cell}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function PqcStateBadge({ state }: { state: PqcKeyState }) {
  const map: Record<PqcKeyState, { color: string; icon: ReactNode }> = {
    'LATTICE-SECURE':   { color: C.phosphor, icon: <Lock size={12} /> },
    'ROTATING':         { color: C.amber,    icon: <RefreshCw size={12} className="animate-spin" /> },
    'DECRYPT_ATTEMPT':  { color: C.crimson,  icon: <AlertTriangle size={12} /> },
    'KYBER-VALID':      { color: C.phosphor, icon: <Shield size={12} /> },
    'DILITHIUM-OK':     { color: C.cyan,     icon: <Atom size={12} /> },
    'KEM-COMMIT':       { color: C.fuchsia,  icon: <Binary size={12} /> },
  };
  const { color, icon } = map[state];
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] tracking-widest"
      style={{ color, border: `1px solid ${color}55`, background: `${color}11` }}
    >
      {icon}
      <span style={{ textShadow: `0 0 6px ${color}66` }}>{state}</span>
    </div>
  );
}

function ProcessRow({ p, onAction }: { p: KernelProcess; onAction: (pid: number, status: ProcessStatus) => void }) {
  const stColor = STATUS_COLOR[p.status];
  const dead = p.status === 'KILLED' || p.status === 'ZOMBIE';
  return (
    <button
      type="button"
      onClick={() => onAction(p.pid, p.status)}
      className="w-full grid items-center px-3 py-1.5 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:bg-white/10"
      style={{
        gridTemplateColumns: '56px 1fr 80px 80px 64px 110px 36px',
        borderBottom: `1px solid ${C.grid}`,
        opacity: dead ? 0.55 : 1,
      }}
    >
      <span className="text-[10px] tabular-nums" style={{ color: C.dim }}>{p.pid.toString().padStart(5, '0')}</span>
      <span className="text-[11px] tracking-wide truncate" style={{ color: dead ? C.dim : C.textHi }}>
        {dead && <span style={{ color: C.crimson }} className="mr-1">✗</span>}
        {p.name}
      </span>
      <span className="text-[10px] text-right tabular-nums" style={{ color: p.cpu > 25 ? C.amber : p.cpu > 50 ? C.crimson : C.text }}>
        {p.cpu.toFixed(1)}%
      </span>
      <span className="text-[10px] text-right tabular-nums" style={{ color: C.text }}>
        {fmtMem(p.mem)}
      </span>
      <span className="text-[9px] text-right tabular-nums" style={{ color: C.dim }}>
        {p.priority >= 0 ? `+${p.priority}` : p.priority}/{p.nice >= 0 ? `+${p.nice}` : p.nice}
      </span>
      <span
        className="text-[9px] tracking-widest text-center inline-flex items-center justify-center gap-1 mx-auto px-2 py-0.5"
        style={{ color: stColor, border: `1px solid ${stColor}44`, background: `${stColor}0f`, minWidth: 90 }}
      >
        <span className="inline-block w-1 h-1 rounded-full" style={{ background: stColor, boxShadow: `0 0 4px ${stColor}` }} />
        {p.status}
      </span>
      <span className="text-[10px] text-right" style={{ color: dead ? C.phosphor : C.crimson, opacity: 0.7 }}>
        {dead ? <RefreshCw size={11} /> : <Skull size={11} />}
      </span>
    </button>
  );
}

function LogRow({ line }: { line: LogLine }) {
  const col = LEVEL_COLOR[line.level];
  return (
    <div className="grid items-baseline gap-2 px-3 py-[3px] text-[10.5px] leading-tight font-mono"
         style={{ gridTemplateColumns: '74px 56px 168px 1fr' }}>
      <span className="tabular-nums" style={{ color: C.dim }}>
        T+{line.beat.toString().padStart(6, '0')}
      </span>
      <span
        className="text-[9px] text-center tracking-widest px-1 py-[1px]"
        style={{ color: col, border: `1px solid ${col}44`, background: `${col}0f` }}
      >
        {line.level}
      </span>
      <span className="truncate" style={{ color: C.cyan, opacity: 0.7 }}>{line.facility}</span>
      <span className="truncate" style={{ color: C.text }}>{line.msg}</span>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export default function MercuryKernelTab() {
  /* ─ State ─────────────────────────────────────────────────────────────── */
  const [tempoActive,    setTempoActive]    = useState(true);
  const [volatility,     setVolatility]     = useState(1.0);   // 1× normal, 2× chaotic
  const [beat,           setBeat]           = useState(0);
  const [processes,      dispatchProcesses] = useReducer(processReducer, INITIAL_PROCESSES);
  const [logs,           setLogs]           = useState<LogLine[]>([]);
  const [vectors,        setVectors]        = useState<VectorMetric[]>(INITIAL_VECTORS);
  const [pqcKeyState,    setPqcKeyState]    = useState<PqcKeyState>('LATTICE-SECURE');
  const [hexGrid,        setHexGrid]        = useState<string[][]>(() => generateHexGrid());
  const [quantumResist,  setQuantumResist]  = useState(98.7);
  const [filter,         setFilter]         = useState<LogLevel | 'ALL'>('ALL');

  const logIdRef    = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const heartbeatPulseRef = useRef<HTMLDivElement>(null);

  /* ─ Derived ───────────────────────────────────────────────────────────── */
  const totalCpu = useMemo(
    () => processes.filter(p => p.status !== 'KILLED' && p.status !== 'ZOMBIE').reduce((s, p) => s + p.cpu, 0),
    [processes],
  );
  const totalMem = useMemo(
    () => processes.filter(p => p.status !== 'KILLED' && p.status !== 'ZOMBIE').reduce((s, p) => s + p.mem, 0),
    [processes],
  );
  const aliveCount = useMemo(
    () => processes.filter(p => p.status !== 'KILLED' && p.status !== 'ZOMBIE').length,
    [processes],
  );
  const filteredLogs = useMemo(
    () => filter === 'ALL' ? logs : logs.filter(l => l.level === filter),
    [logs, filter],
  );

  /* ─ Heartbeat (155 BPM) — one clock, four subsystems ─────────────────── */
  useEffect(() => {
    if (!tempoActive) return;
    const id = setInterval(() => {
      setBeat(b => b + 1);

      // Heartbeat visual pulse
      const node = heartbeatPulseRef.current;
      if (node) {
        node.style.opacity = '1';
        setTimeout(() => { if (node) node.style.opacity = '0.25'; }, 120);
      }

      // ── Process scheduler tick
      dispatchProcesses({ type: 'TICK', volatility, beat: beatRef.current });

      // ── Vector telemetry — micro-fluctuations + history ringbuffer
      setVectors(prev => prev.map(v => {
        const range = v.max - v.min;
        const drift = (Math.random() - 0.5) * range * 0.035 * volatility;
        // Mean reversion (very gentle) keeps the values from wandering off
        const center = (v.min + v.max) / 2;
        const pull = (center - v.value) * 0.008;
        const next = clamp(v.value + drift + pull, v.min, v.max);
        return { ...v, value: next, history: [...v.history.slice(-(VECTOR_HISTORY - 1)), next] };
      }));

      // ── PQC state machine: most ticks stay, occasional rotation, rare attempt
      setPqcKeyState(prev => {
        const r = Math.random();
        if (r < 0.012 * volatility) return 'DECRYPT_ATTEMPT';
        if (r < 0.08  * volatility) return 'ROTATING';
        if (r < 0.12)               return prev === 'LATTICE-SECURE' ? 'KYBER-VALID' : 'LATTICE-SECURE';
        if (r < 0.16)               return 'DILITHIUM-OK';
        if (r < 0.19)               return 'KEM-COMMIT';
        return prev;
      });

      // ── Hex grid churn
      setHexGrid(prev => rollHexGrid(prev, volatility));

      // ── Quantum resistance random walk in [92, 99.99]
      setQuantumResist(prev => clamp(prev + (Math.random() - 0.5) * 0.45 * volatility, 92, 99.99));

      // ── Log emission — biased by volatility (more chaos = more chatter)
      const linesThisBeat = Math.random() < (0.55 + 0.4 * (volatility - 1)) ? (volatility >= 1.8 ? 2 : 1) : 0;
      if (linesThisBeat > 0) {
        setLogs(prev => {
          const next = [...prev];
          for (let i = 0; i < linesThisBeat; i++) {
            next.push(buildLogLine(logIdRef.current++, beatRef.current));
          }
          return next.length > LOG_BUFFER_SIZE ? next.slice(-LOG_BUFFER_SIZE) : next;
        });
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [tempoActive, volatility]);

  /* ─ beatRef mirror — keep reducer dispatches aligned without re-binding ─ */
  const beatRef = useRef(0);
  useEffect(() => { beatRef.current = beat; }, [beat]);

  /* ─ Auto-scroll TTY when new lines arrive ─────────────────────────────── */
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length, filter]);

  /* ─ Interactivity: process kill / restart ─────────────────────────────── */
  const handleProcessAction = useCallback((pid: number, status: ProcessStatus) => {
    const dead = status === 'KILLED' || status === 'ZOMBIE';
    if (dead) {
      dispatchProcesses({ type: 'RESTART', pid });
      setLogs(prev => [...prev.slice(-(LOG_BUFFER_SIZE - 1)), {
        id:       logIdRef.current++,
        beat:     beatRef.current,
        level:    'SYS',
        facility: 'sched',
        msg:      `PID ${pid} respawned via operator request`,
      }]);
    } else {
      dispatchProcesses({ type: 'KILL', pid });
      setLogs(prev => [...prev.slice(-(LOG_BUFFER_SIZE - 1)), {
        id:       logIdRef.current++,
        beat:     beatRef.current,
        level:    'WARN',
        facility: 'sched',
        msg:      `SIGKILL dispatched to PID ${pid} by operator`,
      }]);
    }
  }, []);

  const handleVolatilityToggle = useCallback(() => {
    setVolatility(v => v >= 1.8 ? 1.0 : 2.0);
    setLogs(prev => [...prev.slice(-(LOG_BUFFER_SIZE - 1)), {
      id:       logIdRef.current++,
      beat:     beatRef.current,
      level:    'SYS',
      facility: 'kernel',
      msg:      'entropy volatility coefficient mutated by operator',
    }]);
  }, []);

  const handleTempoToggle = useCallback(() => {
    setTempoActive(a => !a);
  }, []);

  /* ─ Render ────────────────────────────────────────────────────────────── */
  const qrColor = quantumResist > 97 ? C.phosphor : quantumResist > 94 ? C.amber : C.crimson;

  return (
    <div
      className="w-full h-full grid font-mono select-none"
      style={{
        background: C.bg,
        color: C.text,
        gridTemplateRows: 'auto 1fr 1fr auto',
        minHeight: 720,
      }}
    >
      {/* ════ HEADER STRIP ═══════════════════════════════════════════════ */}
      <header
        className="grid items-center px-4 py-2 gap-4"
        style={{
          borderBottom: `1px solid ${C.borderHi}`,
          background: `linear-gradient(180deg, ${C.panelHi}, ${C.panel})`,
          gridTemplateColumns: 'auto 1fr auto auto',
        }}
      >
        <div className="flex items-center gap-2">
          <Hexagon size={18} style={{ color: C.phosphor }} />
          <div className="leading-tight">
            <div className="text-[12px] tracking-[0.3em]" style={{ color: C.textHi }}>MERCURY/KERNEL</div>
            <div className="text-[8px] tracking-[0.4em]" style={{ color: C.dim }}>
              POST-QUANTUM OLFACTORY SOVEREIGNTY PROTOCOL · v9.4.castle
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 text-[10px]">
          <div className="flex items-center gap-2">
            <div
              ref={heartbeatPulseRef}
              className="w-2 h-2 rounded-full transition-opacity duration-150"
              style={{ background: C.crimson, boxShadow: `0 0 10px ${C.crimson}`, opacity: 0.25 }}
            />
            <span style={{ color: C.dim }}>TEMPO</span>
            <span className="tabular-nums" style={{ color: C.textHi }}>{TEMPO_BPM}.00 BPM</span>
            <span style={{ color: C.dim }}>·</span>
            <span className="tabular-nums" style={{ color: C.amber }}>T+{beat.toString().padStart(6, '0')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: C.dim }}>ALIVE</span>
            <span className="tabular-nums" style={{ color: C.phosphor }}>{aliveCount}/{processes.length}</span>
            <span style={{ color: C.dim }}>· CPU</span>
            <span className="tabular-nums" style={{ color: totalCpu > 200 ? C.crimson : totalCpu > 120 ? C.amber : C.phosphor }}>
              {totalCpu.toFixed(1)}%
            </span>
            <span style={{ color: C.dim }}>· MEM</span>
            <span className="tabular-nums" style={{ color: C.text }}>{fmtMem(totalMem)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleVolatilityToggle}
          className="text-[10px] tracking-widest inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-white/5"
          style={{
            color: volatility > 1.5 ? C.crimson : C.text,
            border: `1px solid ${volatility > 1.5 ? C.crimson + '88' : C.borderHi}`,
            background: volatility > 1.5 ? `${C.crimson}10` : 'transparent',
          }}
          title="Toggle entropy volatility coefficient"
        >
          <Zap size={12} />
          ENTROPY ×{volatility.toFixed(1)}
        </button>

        <button
          type="button"
          onClick={handleTempoToggle}
          className="text-[10px] tracking-widest inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-white/5"
          style={{
            color: tempoActive ? C.phosphor : C.amber,
            border: `1px solid ${tempoActive ? C.phosphor + '66' : C.amber + '88'}`,
            background: tempoActive ? `${C.phosphor}08` : `${C.amber}12`,
          }}
          title="Toggle 155 BPM heartbeat"
        >
          <Power size={12} />
          {tempoActive ? 'TEMPO LIVE' : 'TEMPO HALT'}
        </button>
      </header>

      {/* ════ ROW 1: Vector Telemetry + PQC Core ═════════════════════════ */}
      <div className="grid gap-px min-h-0" style={{ gridTemplateColumns: '3fr 2fr', background: C.borderHi }}>

        {/* ── Olfactory Vector Telemetry Matrix ── */}
        <Panel
          title="Olfactory Vector Telemetry"
          subtitle="gaseous molecular packet transfer matrix"
          icon={<Wind size={14} />}
          accent={C.phosphor}
          rightSlot={
            <div className="flex items-center gap-2 text-[9px]" style={{ color: C.dim }}>
              <FlaskConical size={11} />
              <span className="tracking-widest">/dev/scent0</span>
            </div>
          }
        >
          <div className="flex flex-col h-full overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.borderHi} transparent` }}>
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[8px] tracking-[0.3em]" style={{ color: C.dim, borderBottom: `1px solid ${C.border}`, background: C.panelHi }}>
              <div className="col-span-3">VECTOR</div>
              <div className="col-span-3 text-right">VALUE</div>
              <div className="col-span-3">SATURATION</div>
              <div className="col-span-3">{VECTOR_HISTORY}-BEAT TRACE</div>
            </div>
            {vectors.map(v => <VectorRow key={v.key} v={v} beat={beat} />)}
            {/* Aroma Synthesis Buffer — featured waveform */}
            <div className="px-3 py-3 mt-auto" style={{ background: C.panelHi, borderTop: `1px solid ${C.border}` }}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[10px] tracking-[0.25em]" style={{ color: C.textHi }}>
                  <Waves size={11} className="inline mr-1.5 align-text-bottom" style={{ color: C.cyan }} />
                  AROMA SYNTHESIS BUFFER WAVEFORM
                </div>
                <div className="text-[9px] tabular-nums" style={{ color: C.dim }}>
                  {VECTOR_HISTORY} samples · {TICK_MS}ms cadence
                </div>
              </div>
              <Sparkline data={vectors.find(v => v.key === 'ASB')?.history || []} color={C.cyan} height={42} />
            </div>
          </div>
        </Panel>

        {/* ── PQC Core Status ── */}
        <Panel
          title="PQC Core Status"
          subtitle="post-quantum key state machine"
          icon={<Shield size={14} />}
          accent={C.fuchsia}
          rightSlot={<PqcStateBadge state={pqcKeyState} />}
        >
          <div className="flex flex-col h-full">
            {/* Quantum Resistance Bar */}
            <div className="px-3 pt-3 pb-2.5 shrink-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[10px] tracking-[0.25em]" style={{ color: C.textHi }}>QUANTUM RESISTANCE</span>
                <span className="text-[13px] font-bold tabular-nums" style={{ color: qrColor, textShadow: `0 0 8px ${qrColor}55` }}>
                  {quantumResist.toFixed(3)}%
                </span>
              </div>
              <div className="h-3 rounded-sm overflow-hidden relative" style={{ background: C.grid, border: `1px solid ${C.border}` }}>
                {/* Tick marks at 90, 95, 99 */}
                {[90, 95, 99].map(t => (
                  <div key={t} className="absolute top-0 bottom-0 w-px" style={{ left: `${t}%`, background: `${C.dim}88` }} />
                ))}
                <div
                  className="h-full transition-[width] duration-[420ms] ease-out"
                  style={{
                    width: `${quantumResist}%`,
                    background: `linear-gradient(90deg, ${qrColor}aa, ${qrColor}66, ${qrColor}aa)`,
                    boxShadow: `0 0 12px ${qrColor}66, inset 0 0 4px ${qrColor}`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[8px] mt-1 tabular-nums" style={{ color: C.dim }}>
                <span>92.0</span><span>95.0</span><span>97.5</span><span>99.99</span>
              </div>
            </div>

            {/* Status grid: KEM, SIG, KEX, ROT-WINDOW */}
            <div className="grid grid-cols-2 gap-px shrink-0" style={{ background: C.border }}>
              {[
                { label: 'KEM',     v: 'Kyber-1024',    accent: C.phosphor,  icon: <Lock size={10} /> },
                { label: 'SIG',     v: 'Dilithium-5',   accent: C.cyan,      icon: <Atom size={10} /> },
                { label: 'KEX',     v: 'PQXDH',         accent: C.amber,     icon: <RefreshCw size={10} /> },
                { label: 'ROT-WIN', v: '4 beats',       accent: C.fuchsia,   icon: <Timer size={10} /> },
              ].map(s => (
                <div key={s.label} className="px-3 py-2" style={{ background: C.panel }}>
                  <div className="flex items-center gap-1.5 text-[8px] tracking-widest mb-0.5" style={{ color: C.dim }}>
                    <span style={{ color: s.accent }}>{s.icon}</span>{s.label}
                  </div>
                  <div className="text-[11px] tabular-nums" style={{ color: s.accent, textShadow: `0 0 6px ${s.accent}33` }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Rolling hex matrix */}
            <div className="px-3 py-2 text-[8px] tracking-[0.3em] shrink-0" style={{ color: C.dim }}>
              EPHEMERAL KEY MATERIAL · ROLLING WINDOW
            </div>
            <HexGrid grid={hexGrid} keyState={pqcKeyState} />

            {/* Latency / chatter stats */}
            <div className="mt-auto px-3 py-2 flex items-center justify-between text-[9px] tabular-nums" style={{ borderTop: `1px solid ${C.border}`, background: C.panelHi, color: C.dim }}>
              <span>handshake_lat: <span style={{ color: C.text }}>{(0.4 + Math.random() * 0.05).toFixed(3)}ms</span></span>
              <span>kex_per_min: <span style={{ color: C.text }}>{(TEMPO_BPM / 4).toFixed(0)}</span></span>
              <span>oracle_attempts: <span style={{ color: C.crimson }}>0</span></span>
            </div>
          </div>
        </Panel>
      </div>

      {/* ════ ROW 2: Kernel Thread Scheduler ═════════════════════════════ */}
      <Panel
        title="Kernel Thread Scheduler"
        subtitle="active process table · click row to KILL / RESTART"
        icon={<Cpu size={14} />}
        accent={C.cyan}
        rightSlot={
          <div className="flex items-center gap-3 text-[9px]" style={{ color: C.dim }}>
            <span>ALIVE: <span style={{ color: C.phosphor }} className="tabular-nums">{aliveCount}</span></span>
            <span>CPU: <span style={{ color: totalCpu > 200 ? C.crimson : C.text }} className="tabular-nums">{totalCpu.toFixed(1)}%</span></span>
            <span>RSS: <span style={{ color: C.text }} className="tabular-nums">{fmtMem(totalMem)}</span></span>
          </div>
        }
      >
        <div className="h-full flex flex-col">
          {/* Column headers */}
          <div
            className="grid items-center px-3 py-1.5 text-[8px] tracking-[0.3em] shrink-0"
            style={{
              gridTemplateColumns: '56px 1fr 80px 80px 64px 110px 36px',
              color: C.dim,
              borderBottom: `1px solid ${C.border}`,
              background: C.panelHi,
            }}
          >
            <span>PID</span>
            <span>COMMAND</span>
            <span className="text-right">CPU</span>
            <span className="text-right">RSS</span>
            <span className="text-right">PRI/NI</span>
            <span className="text-center">STATUS</span>
            <span className="text-right">ACT</span>
          </div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: `${C.borderHi} transparent` }}>
            {processes.map(p => <ProcessRow key={p.pid} p={p} onAction={handleProcessAction} />)}
          </div>
          {/* Footer hint */}
          <div className="shrink-0 px-3 py-1.5 text-[9px] flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}`, background: C.panelHi, color: C.dim }}>
            <span>
              <ChevronRight size={9} className="inline align-text-bottom" />
              tick = {TICK_MS}ms · status flickers on every beat · process state survives KILL → ZOMBIE → reaper
            </span>
            <span className="tabular-nums">scheduler_quantum: 4 beats</span>
          </div>
        </div>
      </Panel>

      {/* ════ ROW 3: TTY/0 Live System Log Stream ════════════════════════ */}
      <Panel
        title="TTY/0 · Live System Log Stream"
        subtitle="kernel ring buffer · last 96 lines · auto-scroll"
        icon={<Radio size={14} />}
        accent={C.amber}
        rightSlot={
          <div className="flex items-center gap-1.5">
            {(['ALL', 'OK', 'WARN', 'ERR', 'SYS', 'INFO', 'DBG'] as const).map(f => {
              const active = filter === f;
              const col = f === 'ALL' ? C.text : LEVEL_COLOR[f as LogLevel];
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className="text-[9px] tracking-widest px-1.5 py-0.5 transition-all"
                  style={{
                    color: active ? col : C.dim,
                    border: `1px solid ${active ? col + '88' : C.border}`,
                    background: active ? `${col}12` : 'transparent',
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        }
      >
        <div
          ref={logContainerRef}
          className="h-full overflow-y-auto py-1"
          style={{
            background: `linear-gradient(180deg, ${C.bg}, ${C.panel})`,
            scrollbarWidth: 'thin',
            scrollbarColor: `${C.borderHi} transparent`,
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[10px] tracking-widest" style={{ color: C.dim }}>
              {tempoActive ? 'waiting for kernel chatter…' : 'TEMPO HALTED — no new lines'}
            </div>
          ) : (
            filteredLogs.map(line => <LogRow key={line.id} line={line} />)
          )}
        </div>
      </Panel>

      {/* ════ FOOTER STATUS BAR ══════════════════════════════════════════ */}
      <footer
        className="flex items-center justify-between px-4 py-1.5 text-[9px] tracking-widest"
        style={{ borderTop: `1px solid ${C.borderHi}`, background: C.panelHi, color: C.dim }}
      >
        <div className="flex items-center gap-4">
          <span style={{ color: C.phosphor }}>● KERNEL OK</span>
          <span>uptime: <span className="tabular-nums" style={{ color: C.text }}>{Math.floor(beat * TICK_MS / 1000)}s</span></span>
          <span>beat: <span className="tabular-nums" style={{ color: C.amber }}>{beat}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span>logs: <span className="tabular-nums" style={{ color: C.text }}>{logs.length}/{LOG_BUFFER_SIZE}</span></span>
          <span>volatility: <span className="tabular-nums" style={{ color: volatility > 1.5 ? C.crimson : C.text }}>×{volatility.toFixed(1)}</span></span>
          <span><GaugeCircle size={10} className="inline align-text-bottom" /> QR: <span className="tabular-nums" style={{ color: qrColor }}>{quantumResist.toFixed(2)}%</span></span>
          <span><Activity size={10} className="inline align-text-bottom" /> {tempoActive ? 'LIVE' : 'HALTED'}</span>
        </div>
      </footer>
    </div>
  );
}
