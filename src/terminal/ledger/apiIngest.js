const USGS_PARAM_MAP = {
  '00010': 'temp',
  '00300': 'do',
  '00310': 'bod',
  '00060': 'flow',
  '00630': 'nitrate',
};

const EEA_PARAM_MAP = {
  'Water temperature': 'temp',
  'Dissolved oxygen':  'do',
  'BOD5':              'bod',
  'BOD7':              'bod',
  'Nitrate':           'nitrate',
};

export function parseUSGSResponse(json) {
  const params = { temp: null, do: null, bod: null, flow: null, nitrate: null };
  const series = json?.value?.timeSeries ?? [];
  for (const ts of series) {
    const code = ts.variable?.variableCode?.[0]?.value;
    const field = USGS_PARAM_MAP[code];
    if (!field) continue;
    const latest = ts.values?.[0]?.value?.[0];
    if (!latest) continue;
    let val = parseFloat(latest.value);
    if (isNaN(val)) continue;
    if (code === '00060') val *= 0.0283168;
    params[field] = Math.round(val * 100) / 100;
  }
  return params;
}

export function parseEEAResponse(records) {
  const params = { temp: null, do: null, bod: null, nitrate: null };
  for (const rec of records) {
    const label = rec.observedPropertyDeterminandLabel;
    const field = EEA_PARAM_MAP[label];
    if (!field) continue;
    const val = parseFloat(rec.resultObservedValue);
    if (!isNaN(val)) params[field] = Math.round(val * 100) / 100;
  }
  return params;
}

export async function fetchUSGS(lat, lon, radiusMiles = 10) {
  const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${lon - 0.15},${lat - 0.15},${lon + 0.15},${lat + 0.15}&parameterCd=00010,00300,00310,00060,00630&siteStatus=active`;
  const res = await fetch(url);
  if (!res.ok) return { params: {}, stations: [], error: `USGS returned ${res.status}` };
  const json = await res.json();
  const params = parseUSGSResponse(json);
  const stations = (json.value?.timeSeries ?? [])
    .map(ts => ts.sourceInfo?.siteName)
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
  return { params, stations, source: 'USGS NWIS', retrievedAt: new Date().toISOString() };
}

export async function fetchEEA(lat, lon) {
  const url = `https://discodata.eea.europa.eu/sql?query=SELECT%20*%20FROM%20%5BWISE_SOE%5D.%5Blatest%5D.%5Bv_WISE_SOE_Waterbase%5D%20WHERE%20lat%20BETWEEN%20${lat - 0.1}%20AND%20${lat + 0.1}%20AND%20lon%20BETWEEN%20${lon - 0.1}%20AND%20${lon + 0.1}%20ORDER%20BY%20phenomenonTimeSamplingDate%20DESC`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { params: {}, error: `EEA returned ${res.status}` };
    const json = await res.json();
    const records = json.results ?? json.data ?? [];
    const params = parseEEAResponse(records);
    return { params, source: 'EEA Waterbase', retrievedAt: new Date().toISOString() };
  } catch (err) {
    return { params: {}, error: err.message };
  }
}
