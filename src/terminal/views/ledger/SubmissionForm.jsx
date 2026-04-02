import { useState, useCallback, useEffect } from 'react';
import { PARAM_RANGES, VALID_DEPENDENCIES, validateSubmission } from '../../ledger/verdictModel';

const DEPENDENCY_LABELS = {
  sovereign: 'SOVEREIGN — user-supplied measurements',
  external:  'EXTERNAL — pulled from monitoring API',
  attested:  'ATTESTED — uploaded dataset with provenance claim',
};

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
    const numericForm = { ...form };
    for (const key of Object.keys(PARAM_RANGES)) {
      numericForm[key] = Number(numericForm[key]);
    }
    numericForm.lat = Number(numericForm.lat);
    numericForm.lon = Number(numericForm.lon);
    const validationErrors = validateSubmission(numericForm);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit(numericForm);
  }, [form, onSubmit]);

  const fieldError = (field) => errors.find(e => e.field === field)?.message;

  return (
    <div className="space-y-6">
      {/* Coordinates */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Coordinates</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">Latitude</label>
            <input
              type="number" step="any" placeholder="48.2082"
              value={form.lat} onChange={e => update('lat', e.target.value)}
              className="w-full bg-black border border-teal-900/40 text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">Longitude</label>
            <input
              type="number" step="any" placeholder="16.3738"
              value={form.lon} onChange={e => update('lon', e.target.value)}
              className="w-full bg-black border border-teal-900/40 text-teal-100 font-mono text-sm px-3 py-2 rounded-sm focus:border-teal-500 focus:outline-none transition-colors"
            />
          </div>
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

      {/* Parameters */}
      <div>
        <div className="text-[10px] uppercase tracking-[3px] text-teal-500 font-mono mb-3">Audit Parameters</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(PARAM_RANGES).map(([key, range]) => (
            <div key={key}>
              <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-1">
                {range.label} <span className="text-gray-600">({range.unit})</span>
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
            <label key={dep} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-3 h-3 border rounded-full flex items-center justify-center transition-colors ${form.dependency === dep ? 'border-teal-400 bg-teal-400' : 'border-gray-600 group-hover:border-teal-600'}`}>
                {form.dependency === dep && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
              </div>
              <span className="text-xs font-mono">
                <span className={form.dependency === dep ? 'text-teal-300' : 'text-gray-400'}>{dep.toUpperCase()}</span>
                <span className="text-gray-600 ml-2">— {DEPENDENCY_LABELS[dep].split('—')[1]}</span>
              </span>
            </label>
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
