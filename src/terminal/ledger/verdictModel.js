const REQUIRED_FIELDS = ['temp', 'do', 'bod', 'dt', 'epi', 'nitrate', 'flow'];
const VALID_DEPENDENCIES = ['sovereign', 'external', 'attested'];

const PARAM_RANGES = {
  temp:    { min: -5,  max: 50,  unit: 'C',    label: 'Water Temperature' },
  do:      { min: 0,   max: 20,  unit: 'mg/L', label: 'Dissolved Oxygen' },
  bod:     { min: 0,   max: 100, unit: 'mg/L', label: 'BOD Load' },
  dt:      { min: -10, max: 20,  unit: 'C',    label: 'Thermal Discharge Delta' },
  epi:     { min: 0,   max: 20,  unit: 'm',    label: 'Epilimnion Depth' },
  nitrate: { min: 0,   max: 100, unit: 'mg/L', label: 'Nitrate Concentration' },
  flow:    { min: 0,   max: 100, unit: 'm3/s', label: 'Flow Rate' },
};

export { PARAM_RANGES, VALID_DEPENDENCIES };

const SIGNAL_RE = /\[.*?(GREEN|AMBER|RED|VETO|EMERGENCY)\]/;
const MODULE_HEADERS = [
  { key: 'do_ledger',   pattern: /MODULE 01.*DISSOLVED OXYGEN/  },
  { key: 'thermal',     pattern: /MODULE 02.*THERMAL RENT/      },
  { key: 'nutrient',    pattern: /MODULE 03.*NUTRIENT DEBT/     },
  { key: 'hydraulic',   pattern: /MODULE 04.*HYDRAULIC/         },
  { key: 'langelier',   pattern: /MODULE 05.*LANGELIER/         },
];

const MODULE_LABELS = {
  do_ledger: 'DISSOLVED OXYGEN',
  thermal:   'THERMAL RENT',
  nutrient:  'NUTRIENT DEBT',
  hydraulic: 'HYDRAULIC SOVEREIGNTY',
  langelier: 'LANGELIER INDEX',
};

export function parseKernelOutput(text) {
  if (!text || typeof text !== 'string') {
    return { modules: [], fiscal: {}, permit: 'UNKNOWN', ruling: '' };
  }

  const lines = text.split('\n');
  const modules = [];

  for (let mi = 0; mi < MODULE_HEADERS.length; mi++) {
    const { key, pattern } = MODULE_HEADERS[mi];
    const startIdx = lines.findIndex(l => pattern.test(l));
    if (startIdx === -1) continue;

    let endIdx = lines.length;
    for (let j = startIdx + 1; j < lines.length; j++) {
      if (/^──\s*MODULE\s+\d|^──\s*FISCAL|^──\s*RULING/.test(lines[j])) {
        endIdx = j;
        break;
      }
    }

    const section = lines.slice(startIdx, endIdx).join('\n');

    let signal = 'UNKNOWN';
    const sigMatch = section.match(SIGNAL_RE);
    if (sigMatch) signal = sigMatch[1];

    let status = '';
    const statusMatch = section.match(/STATUS:\s*(\S+)/);
    const arrowMatch = section.match(/→\s+(\S+)/);
    if (statusMatch) status = statusMatch[1];
    else if (arrowMatch) status = arrowMatch[1];

    const values = {};
    const numericRe = /([A-Z_]+):\s+([-+]?\d+\.?\d*)/g;
    let m;
    while ((m = numericRe.exec(section)) !== null) {
      values[m[1]] = parseFloat(m[2]);
    }

    modules.push({ key, label: MODULE_LABELS[key], signal, status, values });
  }

  const fiscal = {};
  const fiscalRe = /([A-Z_]+):\s+([-+]?\d[\d,]*)\s*EUR/g;
  let fm;
  while ((fm = fiscalRe.exec(text)) !== null) {
    fiscal[fm[1]] = parseInt(fm[2].replace(/,/g, ''), 10);
  }

  let permit = 'UNKNOWN';
  const permitMatch = text.match(/PERMIT:\s*\[(\w+)]/);
  if (permitMatch) permit = permitMatch[1];
  // Legacy fallback: "PERMIT_STATUS: APPROVED"
  if (permit === 'UNKNOWN') {
    const legacyMatch = text.match(/PERMIT_STATUS:\s*(\S+)/);
    if (legacyMatch) permit = legacyMatch[1];
  }

  let ruling = '';
  const rulingIdx = lines.findIndex(l => /^──\s*RULING/.test(l));
  if (rulingIdx !== -1) {
    const rulingLines = [];
    for (let i = rulingIdx + 1; i < lines.length; i++) {
      if (/^PERMIT:/.test(lines[i])) break;
      if (lines[i].trim()) rulingLines.push(lines[i].trim());
    }
    ruling = rulingLines.join(' ');
  }

  return { modules, fiscal, permit, ruling };
}

export function validateSubmission(input) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push({ field, message: `${PARAM_RANGES[field].label} is required` });
      continue;
    }
    const val = Number(input[field]);
    if (isNaN(val)) {
      errors.push({ field, message: `${PARAM_RANGES[field].label} must be a number` });
      continue;
    }
    const range = PARAM_RANGES[field];
    if (val < range.min || val > range.max) {
      errors.push({ field, message: `${range.label} must be between ${range.min} and ${range.max} ${range.unit}` });
    }
  }
  if (input.dependency && !VALID_DEPENDENCIES.includes(input.dependency)) {
    errors.push({ field: 'dependency', message: `Dependency must be one of: ${VALID_DEPENDENCIES.join(', ')}` });
  }
  return errors;
}

export function createVerdict(input, kernelOutput, kernelId) {
  const parsed = parseKernelOutput(kernelOutput);

  const STATUS_MAP = {
    GRANTED:        'APPROVED',
    APPROVED:       'APPROVED',
    CONDITIONAL:    'CONDITIONAL',
    DEFERRED:       'CONDITIONAL',
    REJECTED:       'REJECTED',
    EMERGENCY_VETO: 'EMERGENCY_VETO',
  };
  const status = STATUS_MAP[parsed.permit] || parsed.permit;

  return {
    status,
    coordinates: { lat: input.lat, lon: input.lon },
    dependency: input.dependency || 'sovereign',
    kernelId,
    timestamp: new Date().toISOString(),
    input: { ...input },
    audit: parsed,
    ruling: kernelOutput.split('\n').filter(l => !l.startsWith('DATA:')).join('\n'),
  };
}

export async function hashVerdict(verdict) {
  const canonical = JSON.stringify(verdict, Object.keys(verdict).sort());
  const encoded = new TextEncoder().encode(canonical);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
