import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
const CoordinatePicker = lazy(() => import('./CoordinatePicker'));
import { PARAM_RANGES, VALID_DEPENDENCIES, validateSubmission } from '../../ledger/verdictModel';
import RiverPulse from './RiverPulse';
import { paramSeverity, discreteSeverity } from './severityEngine';

const DEPENDENCY_LABELS = {
  sovereign: 'SOVEREIGN — user-supplied measurements',
  external:  'EXTERNAL — pulled from monitoring API',
  attested:  'ATTESTED — uploaded dataset with provenance claim',
};

const SEV_DOT_COLORS = {
  safe:     '#14b8a6',
  stress:   '#f59e0b',
  critical: '#ef4444',
};

const SEV_DOT_STYLES = `
@keyframes sev-dot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50%      { transform: scale(1.4); opacity: 1; }
}
`;

function SeverityDot({ paramKey, value }) {
  const sev = paramSeverity(paramKey, value);
  const level = discreteSeverity(sev);
  const color = SEV_DOT_COLORS[level];
  const hasValue = value !== '' && value !== undefined && value !== null;

  return (
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: hasValue ? color : 'rgba(107,114,128,0.3)',
        boxShadow: hasValue && sev > 0.3 ? `0 0 6px ${color}88` : 'none',
        transition: 'background 0.4s ease, box-shadow 0.4s ease',
        animation: hasValue && sev > 0.5 ? 'sev-dot-pulse 1.5s ease-in-out infinite' : 'none',
        marginLeft: '6px',
        verticalAlign: 'middle',
      }}
    />
  );
}

export default function SubmissionForm({ onSubmit, loading, apiData, onApiFetch, apiLoading, apiError }) {
  const [form, setForm] = useState({
    lat: apiData?.lat ?? '',
    lon: apiData?.lon ?? '',
    siteName: apiData?.siteName ?? '',
    temp: apiData?.temp ?? '',
    do: apiData?.do ?? '',
    bod: apiData?.bod ?? '',
    dt: apiData?.dt ?? '',
    epi: apiData?.epi ?? '',
    nitrate: apiData?.nitrate ?? '',
    flow: apiData?.flow ?? '',
    dependency: apiData ? 'external' : 'sovereign',
    notes: '',
  });
  const [errors, setErrors] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (apiData) {
      setForm(prev => {
        const next = { ...prev, dependency: 'external' };
        if (apiData.lat) next.lat = apiData.lat;
        if (apiData.lon) next.lon = apiData.lon;
        for (const key of Object.keys(PARAM_RANGES)) {
          if (apiData[key] !== null && apiData[key] !== undefined) {
            next[key] = apiData[key];
          }
        }
        return next;
      });
    }
  }, [apiData]);

  const update = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => prev.filter(e => e.field !== field));
  }, []);

  const handleSubmit = useCallback(() => {
    // Catch empty fields BEFORE Number() converts '' → 0
    const emptyErrors = [];
    for (const key of Object.keys(PARAM_RANGES)) {
      if (form[key] === '' || form[key] === undefined || form[key] === null) {
        emptyErrors.push({ field: key, message: `${PARAM_RANGES[key].label} is required` });
      }
    }
    if (form.lat === '' || form.lon === '') {
      if (form.lat === '') emptyErrors.push({ field: 'lat', message: 'Latitude is required' });
      if (form.lon === '') emptyErrors.push({ field: 'lon', message: 'Longitude is required' });
    }
    if (emptyErrors.length > 0) {
      setErrors(emptyErrors);
      // Scroll to first error field so it's visible on mobile
      const firstField = emptyErrors[0].field;
      const el = formRef.current?.querySelector(`[data-field="${firstField}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const numericForm = { ...form };
    for (const key of Object.keys(PARAM_RANGES)) {
      numericForm[key] = Number(numericForm[key]);
    }
    numericForm.lat = Number(numericForm.lat);
    numericForm.lon = Number(numericForm.lon);
    const validationErrors = validateSubmission(numericForm);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      const firstField = validationErrors[0].field;
      const el = formRef.current?.querySelector(`[data-field="${firstField}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onSubmit(numericForm);
  }, [form, onSubmit]);

  const fieldError = (field) => errors.find(e => e.field === field)?.message;

  return (
    <div className="space-y-6" ref={formRef}>
      <style>{SEV_DOT_STYLES}</style>
      {/* Coordinates */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Coordinates</div>
        <div className="grid grid-cols-2 gap-3">
          <div data-field="lat">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">Latitude</label>
            <input
              type="number" step="any" placeholder="48.2082"
              value={form.lat} onChange={e => update('lat', e.target.value)}
              className={`w-full bg-black border ${fieldError('lat') ? 'border-red-500' : 'border-teal-900/40'} text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors`}
            />
            {fieldError('lat') && (
              <div className="text-red-400 text-[10px] font-mono mt-1">{fieldError('lat')}</div>
            )}
          </div>
          <div data-field="lon">
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">Longitude</label>
            <input
              type="number" step="any" placeholder="16.3738"
              value={form.lon} onChange={e => update('lon', e.target.value)}
              className={`w-full bg-black border ${fieldError('lon') ? 'border-red-500' : 'border-teal-900/40'} text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors`}
            />
            {fieldError('lon') && (
              <div className="text-red-400 text-[10px] font-mono mt-1">{fieldError('lon')}</div>
            )}
          </div>
        </div>
        <div className="mt-2">
          <button
            onClick={() => setShowMap(!showMap)}
            className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest transition-colors"
          >
            {showMap ? '[ - ] HIDE MAP' : '[ + ] SELECT ON MAP'}
          </button>
          {showMap && (
            <Suspense fallback={<div className="h-[280px] flex items-center justify-center font-mono text-xs text-gray-600">Loading map...</div>}>
              <div className="mt-2">
                <CoordinatePicker
                  lat={Number(form.lat) || null}
                  lon={Number(form.lon) || null}
                  onSelect={(lat, lon) => {
                    update('lat', lat.toFixed(6));
                    update('lon', lon.toFixed(6));
                  }}
                  onClose={() => setShowMap(false)}
                />
              </div>
            </Suspense>
          )}
        </div>
        <input
          type="text" placeholder="Site name (optional)"
          value={form.siteName} onChange={e => update('siteName', e.target.value)}
          className="w-full mt-2 bg-black border border-teal-900/20 text-gray-400 font-mono text-xs px-3 py-1.5 rounded-sm focus:border-teal-500 focus:outline-none transition-colors"
        />
      </div>

      {/* API Fetch */}
      {form.lat && form.lon && onApiFetch && (
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onApiFetch(Number(form.lat), Number(form.lon), 'usgs')}
            disabled={apiLoading}
            className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors disabled:opacity-30"
          >
            {apiLoading ? '...' : 'PULL USGS'}
          </button>
          <button
            onClick={() => onApiFetch(Number(form.lat), Number(form.lon), 'eea')}
            disabled={apiLoading}
            className="text-[9px] font-mono text-teal-600 hover:text-teal-400 uppercase tracking-widest border border-teal-900/30 px-2 py-1 rounded-sm transition-colors disabled:opacity-30"
          >
            {apiLoading ? '...' : 'PULL EEA'}
          </button>
          {apiError && <span className="text-[9px] font-mono text-red-500">{apiError}</span>}
        </div>
      )}

      {/* River Pulse — live parameter visualization */}
      <RiverPulse params={form} />

      {/* Parameters */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Audit Parameters</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(PARAM_RANGES).map(([key, range]) => (
            <div key={key} data-field={key}>
              <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">
                {range.label} <span className="text-gray-600">({range.unit})</span>
                <SeverityDot paramKey={key} value={form[key]} />
              </label>
              <input
                type="number" step="any"
                placeholder={`${range.min}–${range.max}`}
                value={form[key]} onChange={e => update(key, e.target.value)}
                className={`w-full bg-black border ${fieldError(key) ? 'border-red-500' : 'border-teal-900/40'} text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors`}
              />
              {fieldError(key) && (
                <div className="text-red-400 text-[10px] font-mono mt-1">{fieldError(key)}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dependency Classification */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Data Supply Chain</div>
        <div className="space-y-2">
          {VALID_DEPENDENCIES.map(dep => (
            <div
              key={dep}
              role="radio"
              aria-checked={form.dependency === dep}
              tabIndex={0}
              onClick={() => update('dependency', dep)}
              onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); update('dependency', dep); } }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className={`w-3 h-3 border rounded-full flex items-center justify-center transition-colors ${form.dependency === dep ? 'border-teal-400 bg-teal-400' : 'border-gray-600 group-hover:border-teal-600'}`}>
                {form.dependency === dep && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
              </div>
              <span className="text-xs font-mono">
                <span className={form.dependency === dep ? 'text-teal-300' : 'text-gray-400'}>{dep.toUpperCase()}</span>
                <span className="text-gray-600 ml-2">— {DEPENDENCY_LABELS[dep].split('—')[1]}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <textarea
          placeholder="Notes (optional) — site context, data source, observation conditions"
          value={form.notes} onChange={e => update('notes', e.target.value)}
          rows={2}
          className="w-full bg-black border border-teal-900/20 text-gray-400 font-mono text-xs px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* Error summary — visible near submit button on mobile */}
      {errors.length > 0 && (
        <div className="text-red-400 text-[10px] font-mono border border-red-900/30 bg-red-950/20 rounded-sm px-3 py-2">
          {errors.length} field{errors.length !== 1 ? 's' : ''} required — {errors.map(e => e.field).join(', ')}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-3 font-mono text-sm uppercase tracking-[4px] rounded-sm transition-all duration-300 ${
          loading
            ? 'bg-teal-900/30 text-teal-600 cursor-wait'
            : 'bg-teal-900/20 text-teal-300 border border-teal-700/40 hover:bg-teal-800/30 hover:border-teal-500 hover:shadow-[0_0_20px_rgba(20,184,166,0.15)]'
        }`}
      >
        {loading ? '// EXECUTING AUDIT...' : 'RUN AUDIT'}
      </button>
    </div>
  );
}
