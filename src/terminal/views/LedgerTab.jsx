import { useState, useCallback, useEffect, useRef } from 'react';
import SubmissionForm from './ledger/SubmissionForm';
import LedgerMap from './ledger/LedgerMap';
import LedgerParticles from './ledger/LedgerParticles';
import AuditCascade from './ledger/AuditCascade';
import { fetchUSGS, fetchEEA } from '../ledger/apiIngest';
import { generateJsonLd, generatePdf, generateEmbedHtml } from '../ledger/exportFormats';
import VerdictCard from './ledger/VerdictCard';
import { createVerdict } from '../ledger/verdictModel';
import { storeVerdict, getAllVerdicts, getVerdictCount } from '../ledger/verdictStore';
import { ledgerBus } from '../ledger/ledgerBus';
import { loadWasm } from '../../wasm/wasmSingleton';
import wasmRegistry from '../../wasm/wasm.generated';
import { toMapXY } from '../data/worldMapPolys';

const CHRONO_ENTRY = wasmRegistry['CHRONO-ACTUARY-KERNEL-2.0'];

// ── Boot choreography phases ──────────────────────────────────────────────────
// Phase 0: blank
// Phase 1: map fades in (0→0.8s)
// Phase 2: header reveals with letter-spacing (0.8→1.5s)
// Phase 3: form slides up with blur transition (1.5→2.0s)
const PHASE_MAP   = 800;
const PHASE_TITLE = 1500;
const PHASE_FORM  = 2000;

// ── Keyframes ─────────────────────────────────────────────────────────────────
const LEDGER_STYLES = `
@keyframes lt-titleReveal {
  0%   { opacity: 0; filter: brightness(3) blur(6px); letter-spacing: 0.4em; }
  40%  { opacity: 1; filter: brightness(2) blur(1px); letter-spacing: 0.15em; }
  100% { opacity: 1; filter: brightness(1) blur(0); letter-spacing: 0.05em; }
}
@keyframes lt-subtitleFade {
  0%   { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes lt-formSlide {
  0%   { opacity: 0; transform: translateY(24px); filter: blur(8px); }
  60%  { filter: blur(1px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes lt-scanBeam {
  0%   { left: -4%; }
  100% { left: 104%; }
}
@keyframes lt-verdictDrop {
  0%   { opacity: 0; transform: translateY(-20px) scale(0.95); filter: blur(4px); }
  50%  { filter: blur(0); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes lt-glowPulse {
  0%, 100% { opacity: 0.03; }
  50%      { opacity: 0.07; }
}
@keyframes lt-energyLine {
  0%   { width: 0; opacity: 0; }
  20%  { opacity: 1; }
  100% { width: 100%; opacity: 0.5; }
}
@keyframes lt-energyPulse {
  0%, 100% { opacity: 0.3; filter: brightness(1); }
  50%      { opacity: 0.8; filter: brightness(1.5); }
}
@keyframes lt-countReveal {
  0%   { opacity: 0; transform: translateY(4px) scale(0.95); filter: blur(2px); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
@keyframes lt-viewToggleIn {
  0%   { opacity: 0; transform: translateX(-8px); }
  100% { opacity: 1; transform: translateX(0); }
}
`;

export default function LedgerTab() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [verdicts, setVerdicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verdictCount, setVerdictCount] = useState(0);
  const [view, setView] = useState('submit'); // 'submit' | 'archive'
  const [apiData, setApiData] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Boot phases
  const [mapBooted, setMapBooted] = useState(false);
  const [titleBooted, setTitleBooted] = useState(false);
  const [formBooted, setFormBooted] = useState(false);

  // Audit cascade state
  const [cascadeVerdict, setCascadeVerdict] = useState(null);
  const [cascadeVisible, setCascadeVisible] = useState(false);
  const [latestHash, setLatestHash] = useState(null);

  const stylesInjected = useRef(false);
  const particlesRef = useRef(null);
  const mapContainerRef = useRef(null);

  // ── Boot sequence ──────────────────────────────────────────────────────────
  useEffect(() => {
    getAllVerdicts().then(setVerdicts);
    getVerdictCount().then(setVerdictCount);

    const t1 = setTimeout(() => setMapBooted(true), PHASE_MAP);
    const t2 = setTimeout(() => setTitleBooted(true), PHASE_TITLE);
    const t3 = setTimeout(() => setFormBooted(true), PHASE_FORM);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Inject keyframes once
  useEffect(() => {
    if (stylesInjected.current) return;
    stylesInjected.current = true;
    const el = document.createElement('style');
    el.textContent = LEDGER_STYLES;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (input) => {
    setLoading(true);
    try {
      const mod = await loadWasm();
      const args = [
        input.temp, input.do, input.bod, input.dt,
        input.epi, input.nitrate, input.flow,
        0.1,       // lsi default
        30,        // years default
        1000000,   // profit default
      ];
      const result = mod[CHRONO_ENTRY.fn](...args);
      const verdict = createVerdict(input, result, CHRONO_ENTRY.id);
      const stored = await storeVerdict(verdict);

      // Show cascade animation instead of immediately switching view
      setCascadeVerdict(stored);
      setCascadeVisible(true);
    } catch (err) {
      console.error('Audit execution failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCascadeComplete = useCallback(() => {
    if (!cascadeVerdict) return;
    setVerdicts(prev => [cascadeVerdict, ...prev]);
    setVerdictCount(prev => prev + 1);
    setLatestHash(cascadeVerdict.hash);
    setView('archive');
    ledgerBus.emit({ type: 'VERDICT_ISSUED', verdict: cascadeVerdict });

    // Fire particle burst at the verdict's map position
    if (particlesRef.current && cascadeVerdict.coordinates && mapContainerRef.current) {
      const { lat, lon } = cascadeVerdict.coordinates;
      const [svgX, svgY] = toMapXY(lon, lat);
      const rect = mapContainerRef.current.getBoundingClientRect();
      // Convert SVG viewBox coords (800x400) to pixel coords
      const px = (svgX / 800) * rect.width;
      const py = (svgY / 400) * rect.height;
      particlesRef.current.burst(px, py, cascadeVerdict.status);
    }

    // Reset cascade after a beat
    setTimeout(() => {
      setCascadeVisible(false);
      setCascadeVerdict(null);
    }, 600);
  }, [cascadeVerdict]);

  const handleApiFetch = useCallback(async (lat, lon, source) => {
    setApiLoading(true);
    setApiError(null);
    try {
      const result = source === 'usgs' ? await fetchUSGS(lat, lon) : await fetchEEA(lat, lon);
      if (result.error) {
        setApiError(result.error);
      } else {
        setApiData({ ...result.params, lat, lon, source: result.source, retrievedAt: result.retrievedAt });
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setApiLoading(false);
    }
  }, []);

  const handleExport = useCallback(async (verdict, format) => {
    if (format === 'json') {
      const blob = new Blob([generateJsonLd(verdict)], { type: 'application/ld+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `verdict-${verdict.hash?.slice(0, 12)}.jsonld`;
      a.click(); URL.revokeObjectURL(url);
    } else if (format === 'pdf') {
      await generatePdf(verdict);
    } else if (format === 'embed') {
      const html = generateEmbedHtml(verdict);
      await navigator.clipboard.writeText(html);
    }
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto relative px-3 sm:px-0">
      {/* Ambient glow behind the map */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(20,184,166,0.04) 0%, transparent 70%)',
          animation: 'lt-glowPulse 6s ease-in-out infinite',
        }}
      />

      {/* ── Hero: Verdict Map ─────────────────────────────────────────────── */}
      <div className="mb-6 relative" ref={mapContainerRef}>
        <LedgerMap
          verdicts={verdicts}
          latestHash={latestHash}
          height={320}
          booted={mapBooted}
        />
        {/* Particle burst canvas overlay */}
        <LedgerParticles ref={particlesRef} />
        {/* Vignette overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-sm"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.5) 100%)',
          }}
        />
        {/* Scanline overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px)',
          }}
        />
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div
          style={{
            opacity: titleBooted ? 1 : 0,
            animation: titleBooted ? 'lt-titleReveal 1.2s cubic-bezier(0.16,1,0.3,1) forwards' : 'none',
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-[4px] text-teal-600">The Open Ledger</span>
            <span className="text-[10px] font-mono text-gray-600">v1.0</span>
          </div>
          <h1 className="text-sm sm:text-xl font-bold font-mono text-teal-300 tracking-wider mb-2">
            THERMODYNAMIC AUDIT INFRASTRUCTURE
          </h1>
        </div>
        <p
          className="text-xs font-mono text-gray-500 leading-relaxed max-w-2xl"
          style={{
            opacity: titleBooted ? 1 : 0,
            animation: titleBooted ? 'lt-subtitleFade 0.8s 0.4s cubic-bezier(0.16,1,0.3,1) both' : 'none',
          }}
        >
          Submit river parameters. Receive a sovereign permit ruling. The verdict is SHA-256 hashed,
          immutable, and citable. The equations are the authority.
        </p>
        {verdictCount > 0 && titleBooted && (
          <div
            className="mt-2 text-[10px] font-mono text-teal-700 tracking-widest"
            style={{ animation: 'lt-countReveal 0.6s 0.8s cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {verdictCount} VERDICT{verdictCount !== 1 ? 'S' : ''} ISSUED
          </div>
        )}
        {/* Energy line separator */}
        {titleBooted && (
          <div className="mt-4 relative h-[1px]">
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '1px',
                background: 'linear-gradient(90deg, rgba(20,184,166,0.6), rgba(20,184,166,0.1), transparent)',
                animation: 'lt-energyLine 1.2s 0.5s cubic-bezier(0.16,1,0.3,1) both',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '-1px',
                width: '60px',
                height: '3px',
                background: 'linear-gradient(90deg, rgba(20,184,166,0.4), transparent)',
                filter: 'blur(2px)',
                animation: 'lt-energyPulse 3s 1.5s ease-in-out infinite both',
              }}
            />
          </div>
        )}
      </div>

      {/* ── Audit Cascade (overlay during execution) ──────────────────────── */}
      {cascadeVerdict && (
        <div
          className="mb-8"
          style={{ animation: 'lt-verdictDrop 0.5s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <AuditCascade
            verdict={cascadeVerdict}
            visible={cascadeVisible}
            onComplete={handleCascadeComplete}
          />
        </div>
      )}

      {/* ── View Toggle ───────────────────────────────────────────────────── */}
      {!cascadeVisible && (
        <div
          style={{
            opacity: formBooted ? 1 : 0,
            animation: formBooted ? 'lt-formSlide 0.7s cubic-bezier(0.16,1,0.3,1) both' : 'none',
          }}
        >
          <div className="flex gap-4 mb-6 border-b border-teal-900/20 pb-3">
            <button
              onClick={() => setView('submit')}
              className={`text-[10px] font-mono uppercase tracking-[3px] pb-1 transition-colors ${
                view === 'submit' ? 'text-teal-300 border-b border-teal-500' : 'text-gray-600 hover:text-teal-500'
              }`}
            >
              Submit Audit
            </button>
            <button
              onClick={() => setView('archive')}
              className={`text-[10px] font-mono uppercase tracking-[3px] pb-1 transition-colors ${
                view === 'archive' ? 'text-teal-300 border-b border-teal-500' : 'text-gray-600 hover:text-teal-500'
              }`}
            >
              Verdict Archive ({verdictCount})
            </button>
          </div>

          {/* ── Content ─────────────────────────────────────────────────────── */}
          {view === 'submit' && (
            <SubmissionForm
              onSubmit={handleSubmit}
              loading={loading}
              apiData={apiData}
              onApiFetch={handleApiFetch}
              apiLoading={apiLoading}
              apiError={apiError}
            />
          )}

          {view === 'archive' && (
            <div className="space-y-4">
              {verdicts.length === 0 ? (
                <div className="text-center py-12 font-mono text-gray-600 text-sm">
                  No verdicts issued yet. Submit your first audit.
                </div>
              ) : (
                verdicts.map((v, i) => (
                  <div
                    key={v.hash}
                    style={{
                      animation: `lt-verdictDrop 0.4s ${i * 0.08}s cubic-bezier(0.16,1,0.3,1) both`,
                    }}
                  >
                    <VerdictCard verdict={v} onExport={handleExport} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
