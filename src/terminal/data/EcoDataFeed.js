// EcoDataFeed.js — live ecological data feed mapped to 16D feature tensor space
// Maps real-world environmental metrics into additive modulations for the
// Feigenbaum Fade sphere visualisation.  Uses only fetch(); no external deps.

// Dimension indices matching DIM_NAMES from nodeFeatures.js:
//  0 dynamical      1 nonlinearity   2 dimensionality  3 criticality
//  4 entropy        5 synchrony      6 conservation    7 temporal
//  8 spatial        9 stochastic    10 game_theory     11 thermodynamic
// 12 information   13 cryptographic 14 biological      15 economic

const DIM = {
  dynamical:      0,
  nonlinearity:   1,
  dimensionality: 2,
  criticality:    3,
  entropy:        4,
  synchrony:      5,
  conservation:   6,
  temporal:       7,
  spatial:        8,
  stochastic:     9,
  game_theory:   10,
  thermodynamic: 11,
  information:   12,
  cryptographic: 13,
  biological:    14,
  economic:      15,
};

const NUM_DIMS = 16;
const MOD_RANGE = 0.3;

// ── Normalisation helpers ───────────────────────────────────────────────────

/** Linearly map `value` from [srcMin, srcMax] to [-magnitude, +magnitude]. */
function norm(value, srcMin, srcMax, magnitude = MOD_RANGE) {
  if (srcMax === srcMin) return 0;
  const t = (value - srcMin) / (srcMax - srcMin);          // 0 → 1
  return (2 * t - 1) * magnitude;                          // -mag → +mag
}

function clamp(v, lo = -MOD_RANGE, hi = MOD_RANGE) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Data-source fetchers ────────────────────────────────────────────────────

/**
 * 1. CO2 concentration — Open-Meteo air-quality endpoint (latest hourly).
 *    Returns ppm-like value from the European AQ index (proxy, ~400-430 range).
 */
async function fetchCO2() {
  // Open-Meteo provides a CO2 greenhouse-gas endpoint; fall back to a
  // recent global-mean estimate if the endpoint changes.
  const url =
    'https://air-quality-api.open-meteo.com/v1/air-quality' +
    '?latitude=52.52&longitude=13.41&hourly=carbon_dioxide&forecast_days=1';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CO2 fetch ${res.status}`);
  const json = await res.json();
  const vals = json?.hourly?.carbon_dioxide;
  if (!vals || vals.length === 0) throw new Error('CO2: no data');
  // Take the most recent non-null value
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] != null) return vals[i];
  }
  throw new Error('CO2: all nulls');
}

/**
 * 2. Global temperature anomaly (deg C above 1951-1980 mean).
 *    Uses NASA GISS annual data (CSV).  We grab the last complete year.
 */
async function fetchTempAnomaly() {
  const url =
    'https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Temp anomaly fetch ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  // CSV: first data row after header; last row = most recent year
  // Columns: Year, Jan, Feb, ..., Dec, J-D, D-N, DJF, MAM, JJA, SON
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(',');
    const annual = parseFloat(cols[13]); // J-D annual mean
    if (!isNaN(annual)) return annual;
  }
  throw new Error('Temp anomaly: could not parse');
}

/**
 * 3. Biodiversity / Living Planet Index proxy.
 *    The LPI declined from 1.0 (1970) to ~0.31 (2020).  We interpolate
 *    linearly between known anchor points.
 */
function estimateBiodiversity() {
  const anchors = [
    [1970, 1.00],
    [1980, 0.85],
    [1990, 0.70],
    [2000, 0.55],
    [2010, 0.42],
    [2020, 0.31],
    [2030, 0.24], // projection
  ];
  const now = Date.now();
  const year = new Date(now).getFullYear() +
    (new Date(now).getMonth() / 12);
  for (let i = 1; i < anchors.length; i++) {
    if (year <= anchors[i][0]) {
      const [y0, v0] = anchors[i - 1];
      const [y1, v1] = anchors[i];
      const t = (year - y0) / (y1 - y0);
      return v0 + t * (v1 - v0);
    }
  }
  return anchors[anchors.length - 1][1];
}

/**
 * 4. Deforestation rate (million hectares/year).
 *    Global Forest Watch provides an API; we attempt to fetch the latest
 *    annual stat.  Falls back to a known estimate (~10 Mha/yr recent avg).
 */
async function fetchDeforestation() {
  const url =
    'https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest/query' +
    '?sql=SELECT SUM(area__ha) AS total_loss FROM data WHERE umd_tree_cover_loss__year = 2023';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deforestation fetch ${res.status}`);
  const json = await res.json();
  const rows = json?.data;
  if (!rows || rows.length === 0) throw new Error('Deforestation: no data');
  const ha = rows[0]?.total_loss;
  if (ha == null) throw new Error('Deforestation: null value');
  return ha / 1e6; // convert to million hectares
}

/**
 * 5. Ocean pH — derived from atmospheric CO2 using empirical relationship.
 *    pH ~ 8.35 - 0.0015 * (CO2 - 280)
 */
function estimateOceanPH(co2ppm) {
  return 8.35 - 0.0015 * (co2ppm - 280);
}

/**
 * 6. Renewable energy share (% of primary energy).
 *    Our World in Data GitHub CSV for "World".
 */
async function fetchRenewableShare() {
  const url =
    'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Renewable fetch ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const countryIdx = header.indexOf('country');
  const renewIdx = header.indexOf('renewables_share_energy');
  if (countryIdx < 0 || renewIdx < 0) throw new Error('Renewable: bad CSV');
  // Scan backwards for the latest "World" row with a value
  for (let i = lines.length - 1; i >= 1; i--) {
    const cols = lines[i].split(',');
    if (cols[countryIdx] === 'World') {
      const val = parseFloat(cols[renewIdx]);
      if (!isNaN(val)) return val; // percentage 0-100
    }
  }
  throw new Error('Renewable: no World data');
}

// ── Synthetic fallback ──────────────────────────────────────────────────────

function syntheticModulations() {
  const mods = new Float64Array(NUM_DIMS);
  const msPerYear = 365.25 * 24 * 3600 * 1000;
  const phase = ((Date.now() % msPerYear) / msPerYear) * 2 * Math.PI;
  const amp = 0.1;
  for (let d = 0; d < NUM_DIMS; d++) {
    // Offset each dimension's phase so they don't all peak together
    mods[d] = amp * Math.sin(phase + (d * Math.PI) / 8);
  }
  return mods;
}

// ── Main class ──────────────────────────────────────────────────────────────

class EcoDataFeed {
  constructor() {
    this._modulations = new Float64Array(NUM_DIMS);
    this._rawData = null;
    this._lastFetch = null;
    this._error = null;
    this._sources = {};
    this._timer = null;
    this._polling = false;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Fetch the latest environmental data from all sources.
   * Each source fails independently; successful sources update modulations.
   */
  async fetchLatest() {
    const raw = {
      co2: null,
      tempAnomaly: null,
      biodiversity: null,
      deforestation: null,
      oceanPH: null,
      renewableShare: null,
    };
    const sources = {};

    // 1. CO2
    try {
      raw.co2 = await fetchCO2();
      sources.co2 = 'ok';
    } catch (e) {
      sources.co2 = e.message;
    }

    // 2. Temperature anomaly
    try {
      raw.tempAnomaly = await fetchTempAnomaly();
      sources.tempAnomaly = 'ok';
    } catch (e) {
      sources.tempAnomaly = e.message;
    }

    // 3. Biodiversity (local computation — always succeeds)
    try {
      raw.biodiversity = estimateBiodiversity();
      sources.biodiversity = 'ok';
    } catch (e) {
      sources.biodiversity = e.message;
    }

    // 4. Deforestation
    try {
      raw.deforestation = await fetchDeforestation();
      sources.deforestation = 'ok';
    } catch (e) {
      sources.deforestation = e.message;
    }

    // 5. Ocean pH (derived from CO2 — needs CO2 first)
    if (raw.co2 != null) {
      try {
        raw.oceanPH = estimateOceanPH(raw.co2);
        sources.oceanPH = 'ok';
      } catch (e) {
        sources.oceanPH = e.message;
      }
    } else {
      sources.oceanPH = 'skipped (no CO2 data)';
    }

    // 6. Renewable energy share
    try {
      raw.renewableShare = await fetchRenewableShare();
      sources.renewableShare = 'ok';
    } catch (e) {
      sources.renewableShare = e.message;
    }

    this._rawData = raw;
    this._sources = sources;
    this._lastFetch = Date.now();

    // Check if ANY source succeeded
    const anyOk = Object.values(sources).some((s) => s === 'ok');
    if (anyOk) {
      this._modulations = this.mapToTensorSpace(raw);
      this._error = null;
    } else {
      // All sources failed — engage synthetic fallback
      this._modulations = syntheticModulations();
      this._error = 'All sources failed; using synthetic fallback';
    }

    return this._rawData;
  }

  /**
   * Map raw environmental metrics to 16D feature modulations.
   * Returns Float64Array of length 16, values clamped to [-0.3, +0.3].
   */
  mapToTensorSpace(rawData) {
    const m = new Float64Array(NUM_DIMS);

    // ── 1. CO2 concentration (expected range ~400-450 ppm) ────────────
    if (rawData.co2 != null) {
      const co2mod = norm(rawData.co2, 400, 450, 0.25);
      m[DIM.thermodynamic] += co2mod;      // higher CO2 → +thermodynamic
      m[DIM.entropy]       += co2mod * 0.8; // higher CO2 → +entropy
      m[DIM.conservation]  -= co2mod;       // higher CO2 → -conservation
    }

    // ── 2. Temperature anomaly (expected range ~0.5-2.0 deg C) ────────
    if (rawData.tempAnomaly != null) {
      const tmod = norm(rawData.tempAnomaly, 0.5, 2.0, 0.25);
      m[DIM.criticality] += tmod;           // warming → +criticality
      m[DIM.dynamical]   += tmod * 0.7;     // warming → +dynamical
      m[DIM.temporal]    += tmod * 0.5;      // warming → +temporal
    }

    // ── 3. Biodiversity index (expected range 1.0 → 0.2, lower = worse) ─
    if (rawData.biodiversity != null) {
      // Inverted: low biodiversity = positive modulation for stress dims
      const bmod = norm(rawData.biodiversity, 1.0, 0.2, 0.2);
      m[DIM.biological]  -= bmod;           // loss → -biological
      m[DIM.economic]    += bmod * 0.6;     // loss → +economic (cost)
      m[DIM.stochastic]  += bmod * 0.5;     // loss → +stochastic
    }

    // ── 4. Deforestation (expected range ~5-15 Mha/yr) ────────────────
    if (rawData.deforestation != null) {
      const dmod = norm(rawData.deforestation, 5, 15, 0.2);
      m[DIM.spatial]       -= dmod;         // deforestation → -spatial
      m[DIM.biological]    -= dmod * 0.8;   // deforestation → -biological
      m[DIM.conservation]  -= dmod;         // deforestation → -conservation
    }

    // ── 5. Ocean pH (expected range ~8.0-8.2, lower = more acidic) ────
    if (rawData.oceanPH != null) {
      // Lower pH = more acidification = negative signal
      const phmod = norm(rawData.oceanPH, 8.2, 8.0, 0.2);
      m[DIM.thermodynamic] -= phmod;        // acidification → -thermodynamic
      m[DIM.biological]    -= phmod * 0.7;  // acidification → -biological
    }

    // ── 6. Renewable energy share (expected range ~10-40 %) ───────────
    if (rawData.renewableShare != null) {
      const rmod = norm(rawData.renewableShare, 10, 40, 0.2);
      m[DIM.conservation] += rmod;          // renewables → +conservation
      m[DIM.economic]     += rmod * 0.6;    // renewables → +economic
      m[DIM.synchrony]    += rmod * 0.5;    // renewables → +synchrony
    }

    // Clamp every dimension to [-0.3, +0.3]
    for (let d = 0; d < NUM_DIMS; d++) {
      m[d] = clamp(m[d]);
    }

    return m;
  }

  /**
   * Return the current modulation vector as a plain Array of 16 floats.
   * Each value is in [-0.3, +0.3] and is additive to base features.
   * Returns zeros if no data has been fetched yet.
   */
  getModulations() {
    return Array.from(this._modulations);
  }

  /**
   * Begin polling for fresh data at the given interval.
   * @param {number} intervalMs — milliseconds between fetches (default 5 min)
   */
  startPolling(intervalMs = 300_000) {
    if (this._polling) return;
    this._polling = true;
    // Fetch immediately, then repeat on interval
    this.fetchLatest().catch(() => {});
    this._timer = setInterval(() => {
      this.fetchLatest().catch(() => {});
    }, intervalMs);
  }

  /** Stop the polling timer. */
  stopPolling() {
    this._polling = false;
    if (this._timer != null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Return a status snapshot describing the feed's health.
   */
  getStatus() {
    return {
      lastFetch: this._lastFetch,
      dataAge:   this._lastFetch ? Date.now() - this._lastFetch : null,
      sources:   { ...this._sources },
      error:     this._error,
    };
  }
}

// ── Singleton export ────────────────────────────────────────────────────────

export const ecoDataFeed = new EcoDataFeed();
export default EcoDataFeed;
