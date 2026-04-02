import { useState, useCallback, useEffect } from 'react';
import SubmissionForm from './ledger/SubmissionForm';
import { fetchUSGS, fetchEEA } from '../ledger/apiIngest';
import { generateJsonLd, generatePdf, generateEmbedHtml } from '../ledger/exportFormats';
import VerdictCard from './ledger/VerdictCard';
import { createVerdict } from '../ledger/verdictModel';
import { storeVerdict, getAllVerdicts, getVerdictCount } from '../ledger/verdictStore';
import { ledgerBus } from '../ledger/ledgerBus';
import { loadWasm } from '../../wasm/wasmSingleton';
import wasmRegistry from '../../wasm/wasm.generated';

const CHRONO_ENTRY = wasmRegistry['CHRONO-ACTUARY-KERNEL-2.0'];

export default function LedgerTab() {
  const [verdicts, setVerdicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [verdictCount, setVerdictCount] = useState(0);
  const [view, setView] = useState('submit'); // 'submit' | 'archive'
  const [apiData, setApiData] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  useEffect(() => {
    getAllVerdicts().then(setVerdicts);
    getVerdictCount().then(setVerdictCount);
  }, []);

  const handleSubmit = useCallback(async (input) => {
    setLoading(true);
    try {
      const mod = await loadWasm();
      const args = [
        input.temp, input.do, input.bod, input.dt,
        input.epi, input.nitrate, input.flow,
        0.1,  // lsi default
        30,   // years default
        1000000, // profit default
      ];
      const result = mod[CHRONO_ENTRY.fn](...args);
      const verdict = createVerdict(input, result, CHRONO_ENTRY.id);
      const stored = await storeVerdict(verdict);
      setVerdicts(prev => [stored, ...prev]);
      setVerdictCount(prev => prev + 1);
      setView('archive');
      ledgerBus.emit({ type: 'VERDICT_ISSUED', verdict: stored });
    } catch (err) {
      console.error('Audit execution failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-[4px] text-teal-600">The Open Ledger</span>
          <span className="text-[10px] font-mono text-gray-600">v1.0</span>
        </div>
        <h1 className="text-xl font-bold font-mono text-teal-300 tracking-wider mb-2">
          THERMODYNAMIC AUDIT INFRASTRUCTURE
        </h1>
        <p className="text-xs font-mono text-gray-500 leading-relaxed max-w-2xl">
          Submit river parameters. Receive a sovereign permit ruling. The verdict is SHA-256 hashed,
          immutable, and citable. The equations are the authority.
        </p>
        {verdictCount > 0 && (
          <div className="mt-2 text-[10px] font-mono text-teal-700 tracking-widest">
            {verdictCount} VERDICT{verdictCount !== 1 ? 'S' : ''} ISSUED
          </div>
        )}
      </div>

      {/* View Toggle */}
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

      {/* Content */}
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
            verdicts.map(v => (
              <VerdictCard key={v.hash} verdict={v} onExport={handleExport} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
