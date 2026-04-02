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
  let status = 'UNKNOWN';
  let audit = {};
  const dataMatch = kernelOutput.match(/DATA:(\{[\s\S]*\})$/);
  if (dataMatch) {
    try {
      const parsed = JSON.parse(dataMatch[1]);
      status = parsed.status || status;
      audit = parsed;
    } catch { /* keep defaults */ }
  }
  // Match "PERMIT: [REJECTED]" or "PERMIT: [GRANTED]" etc.
  if (status === 'UNKNOWN') {
    const permitMatch = kernelOutput.match(/PERMIT:\s*\[(\w+)]/);
    if (permitMatch) status = permitMatch[1];
  }
  // Legacy fallback: "PERMIT_STATUS: REJECTED"
  if (status === 'UNKNOWN') {
    const statusMatch = kernelOutput.match(/PERMIT_STATUS:\s*(\S+)/);
    if (statusMatch) status = statusMatch[1];
  }
  // Map kernel permit codes to display statuses
  const STATUS_MAP = {
    GRANTED:        'APPROVED',
    APPROVED:       'APPROVED',
    CONDITIONAL:    'CONDITIONAL',
    DEFERRED:       'CONDITIONAL',
    REJECTED:       'REJECTED',
    EMERGENCY_VETO: 'EMERGENCY_VETO',
  };
  status = STATUS_MAP[status] || status;

  return {
    status,
    coordinates: { lat: input.lat, lon: input.lon },
    dependency: input.dependency || 'sovereign',
    kernelId,
    timestamp: new Date().toISOString(),
    input: { ...input },
    audit,
    ruling: kernelOutput.split('\n').filter(l => !l.startsWith('DATA:')).join('\n'),
  };
}

export async function hashVerdict(verdict) {
  const canonical = JSON.stringify(verdict, Object.keys(verdict).sort());
  const encoded = new TextEncoder().encode(canonical);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
