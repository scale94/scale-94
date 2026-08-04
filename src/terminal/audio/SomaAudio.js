// SomaAudio.js — SOMA-9.4 // FEIGENBAUM_FADE // ARS ELECTRONICA 2027
//
// Web Audio API sonification engine for the orbital sphere.
// Each node activation triggers FM synthesis shaped by its 16D feature tensor.
// Cluster-based timbral identity via just-intonation base frequencies.
// Edge hover → dyad harmony. Bifurcation → descending cascade sweep.
// Ambient drone provides continuous low-frequency spatial presence.
//
// Usage:
//   import { somaAudio } from './SomaAudio';
//   somaAudio.init();               // call on first user gesture
//   somaAudio.playNode(nodeId);     // node activation
//   somaAudio.playEdge(idA, idB);   // edge dyad
//   somaAudio.playBifurcation(n);   // cascade sweep
//   somaAudio.playBeat();           // 909-style kick (left click / tap)
//   somaAudio.playDrop();           // multi-layer heavy drop (right click / hold)
//   somaAudio.setEnergy(0-1);       // modulate ambient drone
//   somaAudio.startRecording();     // begin event capture
//   somaAudio.stopRecording();      // end capture, get events
//   somaAudio.exportMIDI();         // Standard MIDI File (Uint8Array)
//   somaAudio.exportScore();        // JSON graphic score

import { NODES, NODE_IDX, FEATURES, DIM_NAMES } from '../data/nodeFeatures';

// ── Cluster base frequencies (just intonation ratios from A2 = 110 Hz) ──────
const CLUSTER_FREQ = {
  eco:    110.00,       // A2       — earth, grounded
  sync:   146.83,       // D3       — perfect fourth above A
  phys:   164.81,       // E3       — perfect fifth above A
  crypto: 196.00,       // G3       — minor seventh
  drk:    130.81,       // C3       — minor third
};

// ── MIDI note mapping per cluster ────────────────────────────────────────────
const CLUSTER_MIDI_NOTE = {
  eco:    45,  // A2
  sync:   50,  // D3
  phys:   52,  // E3
  crypto: 55,  // G3
  drk:    48,  // C3
};

// ── MIDI channel per cluster ─────────────────────────────────────────────────
const CLUSTER_MIDI_CH = {
  eco:    0,
  sync:   1,
  phys:   2,
  crypto: 3,
  drk:    4,
};

// ── Dimension-to-modulation mapping ─────────────────────────────────────────
// Each 16D feature dimension modulates a specific synthesis parameter.
// This creates unique timbral fingerprints per node.
const DIM_MAP = {
  dynamical:      'modIndex',      // FM depth
  nonlinearity:   'modFreqRatio',  // FM frequency ratio
  dimensionality: 'attack',        // envelope attack time
  criticality:    'harmonics',     // overtone richness
  entropy:        'detune',        // pitch instability
  synchrony:      'tremoloRate',   // amplitude modulation speed
  conservation:   'sustain',       // envelope sustain level
  temporal:       'decay',         // envelope decay time
  spatial:        'pan',           // stereo position
  stochastic:     'noise',         // noise mix amount
  game_theory:    'filterQ',       // resonance peak
  thermodynamic:  'filterFreq',    // brightness
  information:    'release',       // envelope release time
  cryptographic:  'bitcrush',      // digital artifact amount
  biological:     'chorus',        // detuned doubling
  economic:       'compression',   // dynamic range
};

// ── MIDI helpers ─────────────────────────────────────────────────────────────

/**
 * Encode an integer as MIDI variable-length quantity.
 * @param {number} value — non-negative integer
 * @returns {number[]} — array of bytes
 */
function midiVarLength(value) {
  if (value < 0) value = 0;
  const bytes = [];
  bytes.unshift(value & 0x7F);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7F) | 0x80);
    value >>= 7;
  }
  return bytes;
}

/**
 * Build a MIDI track chunk (MTrk) from an array of raw event bytes.
 * Each element in `events` is already a complete MIDI event with delta-time prefix.
 * Appends the mandatory End-of-Track meta event.
 * @param {number[][]} events — array of byte-arrays
 * @returns {Uint8Array}
 */
function buildTrackChunk(events) {
  // Flatten all events + append end-of-track
  const endOfTrack = [0x00, 0xFF, 0x2F, 0x00];
  const body = [];
  for (const ev of events) {
    for (const b of ev) body.push(b);
  }
  for (const b of endOfTrack) body.push(b);

  const header = [
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    (body.length >> 24) & 0xFF,
    (body.length >> 16) & 0xFF,
    (body.length >> 8) & 0xFF,
    body.length & 0xFF,
  ];
  const chunk = new Uint8Array(header.length + body.length);
  chunk.set(header, 0);
  chunk.set(body, header.length);
  return chunk;
}

/**
 * Convert seconds to MIDI ticks at 120 BPM, 480 ticks/quarter.
 * @param {number} seconds
 * @returns {number}
 */
function secondsToTicks(seconds) {
  // 120 BPM = 2 beats/sec → 960 ticks/sec
  return Math.max(0, Math.round(seconds * 960));
}

/**
 * Compute feature tensor magnitude (L2 norm) clamped to 0-1.
 * @param {Float32Array|number[]} feat
 * @returns {number}
 */
function featureMagnitude(feat) {
  let sum = 0;
  for (let i = 0; i < feat.length; i++) sum += feat[i] * feat[i];
  // Normalise: typical max magnitude ~4 for 16-dim unit features
  return Math.min(1, Math.sqrt(sum) / 4);
}

class SomaAudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.convolver = null;
    this.droneGain = null;
    this.droneOsc = null;
    this.droneFilter = null;
    this.initialized = false;
    this._energy = 0.3;
    this._muted = false;
    this._volume = 0.35;

    // ── Recording state ────────────────────────────────────────────────────
    this._recording = false;
    this._recordedEvents = [];
    this._recordStartTime = 0;

    // ── Beat clock ─────────────────────────────────────────────────────────
    this._beatClockId = null;
  }

  // ── Initialize on first user gesture ──────────────────────────────────────
  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return; }

    // Master output chain: dry → compressor → destination
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.15;

    this.master = this.ctx.createGain();
    this.master.gain.value = this._volume;

    // Convolver reverb — algorithmic impulse response (no external file)
    this._buildReverb();

    // Wet/dry mix
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 0.7;
    this.wetGain = this.ctx.createGain();
    this.wetGain.gain.value = 0.3;

    this.master.connect(this.dryGain);
    this.dryGain.connect(this.compressor);
    if (this.convolver) {
      this.master.connect(this.convolver);
      this.convolver.connect(this.wetGain);
      this.wetGain.connect(this.compressor);
    }
    this.compressor.connect(this.ctx.destination);

    // Ambient drone
    this._startDrone();

    // Continuous sonification layers (state-driven, parameter-modulated)
    this._startContinuousLayers();

    this.initialized = true;
  }

  // ── Algorithmic reverb impulse ────────────────────────────────────────────
  _buildReverb() {
    const duration = 2.2;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);
    const buffer = this.ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Exponential decay with diffuse noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
      }
    }

    this.convolver = this.ctx.createConvolver();
    this.convolver.buffer = buffer;
  }

  // ── Ambient drone (sub oscillator + filtered noise) ───────────────────────
  _startDrone() {
    const now = this.ctx.currentTime;

    // Sub oscillator — very low sine
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sine';
    this.droneOsc.frequency.value = 55; // A1

    // Slow LFO on drone pitch for organic drift
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07; // ~14s cycle
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.8; // ±0.8 Hz drift
    lfo.connect(lfoGain);
    lfoGain.connect(this.droneOsc.frequency);
    lfo.start(now);

    // Filtered noise layer
    const noiseLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;

    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noiseBuf;
    noiseNode.loop = true;

    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 120;
    this.droneFilter.Q.value = 2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.04;

    noiseNode.connect(this.droneFilter);
    this.droneFilter.connect(noiseGain);

    // Drone output gain
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.06;

    const oscGain = this.ctx.createGain();
    oscGain.gain.value = 0.08;

    this.droneOsc.connect(oscGain);
    oscGain.connect(this.droneGain);
    noiseGain.connect(this.droneGain);
    this.droneGain.connect(this.master);

    this.droneOsc.start(now);
    noiseNode.start(now);
  }

  // ── Node activation: FM synthesis shaped by 16D tensor ────────────────────
  playNode(nodeId) {
    if (!this.initialized || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const idx = NODE_IDX[nodeId];
    if (idx == null) return;
    const node = NODES[idx];
    const feat = FEATURES[idx];
    if (!node || !feat) return;

    const now = this.ctx.currentTime;
    const baseFreq = CLUSTER_FREQ[node.cluster] || 130.81;

    // Extract synthesis parameters from feature tensor
    const modIndex    = 1.0 + feat[0] * 6.0;     // dynamical → FM depth
    const modRatio    = 1.0 + feat[1] * 3.0;     // nonlinearity → FM ratio
    const attack      = 0.005 + feat[2] * 0.08;  // dimensionality → attack
    const decay       = 0.1 + feat[7] * 0.5;     // temporal → decay
    const sustain     = 0.1 + feat[6] * 0.5;     // conservation → sustain
    const release     = 0.2 + feat[12] * 0.8;    // information → release
    const brightness  = 400 + feat[11] * 4000;   // thermodynamic → filter
    const pan         = feat[8] * 2 - 1;          // spatial → pan (-1 to +1)
    const detune      = feat[4] * 30;             // entropy → detune cents
    const noiseAmt    = feat[9] * 0.15;           // stochastic → noise mix

    // FM carrier
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = baseFreq;
    carrier.detune.value = detune;

    // FM modulator
    const modulator = this.ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = baseFreq * modRatio;

    const modGain = this.ctx.createGain();
    modGain.gain.value = baseFreq * modIndex;

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Brightness filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = brightness;
    filter.Q.value = 1 + feat[10] * 4; // game_theory → resonance

    // ADSR envelope
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.25, now + attack);
    env.gain.linearRampToValueAtTime(0.25 * sustain, now + attack + decay);
    env.gain.linearRampToValueAtTime(0, now + attack + decay + release);

    // Stereo panner
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan * 0.6; // moderate stereo width

    // Noise layer (stochastic dimension)
    if (noiseAmt > 0.02) {
      const nLen = Math.floor(this.ctx.sampleRate * (attack + decay + release));
      const nBuf = this.ctx.createBuffer(1, nLen, this.ctx.sampleRate);
      const nData = nBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) nData[i] = (Math.random() * 2 - 1) * noiseAmt;
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = nBuf;
      const nGain = this.ctx.createGain();
      nGain.gain.value = noiseAmt;
      nSrc.connect(nGain);
      nGain.connect(env);
      nSrc.start(now);
    }

    // Connect chain
    carrier.connect(filter);
    filter.connect(env);
    env.connect(panner);
    panner.connect(this.master);

    // Schedule start + stop
    const totalDur = attack + decay + release + 0.05;
    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + totalDur);
    modulator.stop(now + totalDur);

    // ── Record event ──────────────────────────────────────────────────────
    if (this._recording) {
      this._recordedEvents.push({
        time: now - this._recordStartTime,
        type: 'node',
        nodeId,
        cluster: node.cluster,
        freq: baseFreq,
        duration: attack + decay + release,
        velocity: featureMagnitude(feat),
        midiNote: CLUSTER_MIDI_NOTE[node.cluster] || 48,
        attack, decay, sustain, release,
      });
    }

    // Cleanup
    const cleanup = () => {
      try { carrier.disconnect(); modulator.disconnect(); filter.disconnect();
            env.disconnect(); panner.disconnect(); modGain.disconnect(); }
      catch { /* nodes already torn down by the context — nothing to release */ }
    };
    setTimeout(cleanup, (totalDur + 0.1) * 1000);
  }

  // ── Edge dyad: two-tone harmony proportional to cosine similarity ─────────
  playEdge(idA, idB, similarity = 0.5) {
    if (!this.initialized || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const iA = NODE_IDX[idA], iB = NODE_IDX[idB];
    if (iA == null || iB == null) return;
    const nA = NODES[iA], nB = NODES[iB];

    const now = this.ctx.currentTime;
    const fA = CLUSTER_FREQ[nA.cluster] || 130.81;
    const fB = CLUSTER_FREQ[nB.cluster] || 130.81;

    // Consonance: high similarity → octave/fifth, low → tritone tension
    const interval = similarity > 0.7 ? 1.5   // perfect fifth
                   : similarity > 0.5 ? 1.333 // perfect fourth
                   : 1.414;                    // tritone (sqrt 2)

    for (const [freq, panVal] of [[fA, -0.3], [fB * interval, 0.3]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.08 * similarity, now + 0.02);
      env.gain.linearRampToValueAtTime(0, now + 0.6);

      const pan = this.ctx.createStereoPanner();
      pan.pan.value = panVal;

      osc.connect(env);
      env.connect(pan);
      pan.connect(this.master);

      osc.start(now);
      osc.stop(now + 0.65);

      setTimeout(() => {
        try { osc.disconnect(); env.disconnect(); pan.disconnect(); }
        catch { /* nodes already torn down by the context — nothing to release */ }
      }, 750);
    }

    // ── Record event ──────────────────────────────────────────────────────
    if (this._recording) {
      this._recordedEvents.push({
        time: now - this._recordStartTime,
        type: 'edge',
        nodeIdA: idA,
        nodeIdB: idB,
        clusterA: nA.cluster,
        clusterB: nB.cluster,
        freqA: fA,
        freqB: fB * interval,
        duration: 0.6,
        similarity,
        velocity: similarity,
        midiNoteA: CLUSTER_MIDI_NOTE[nA.cluster] || 48,
        midiNoteB: CLUSTER_MIDI_NOTE[nB.cluster] || 48,
      });
    }
  }

  // ── Bifurcation cascade: descending FM sweep with period-doubling rhythm ──
  playBifurcation(childCount = 1) {
    if (!this.initialized || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;

    // Each child gets a staggered descending tone
    for (let i = 0; i < Math.min(childCount, 6); i++) {
      const delay = i * 0.08;
      const freq = 880 / Math.pow(2, i * 0.5); // descending octaves

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.25, now + delay + 0.4);

      // FM modulator for metallic texture
      const mod = this.ctx.createOscillator();
      mod.type = 'square';
      mod.frequency.value = freq * 1.414; // tritone ratio
      const modG = this.ctx.createGain();
      modG.gain.value = freq * 0.5;
      mod.connect(modG);
      modG.connect(osc.frequency);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0, now + delay);
      env.gain.linearRampToValueAtTime(0.12, now + delay + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq * 2;
      filter.Q.value = 3;

      osc.connect(filter);
      filter.connect(env);
      env.connect(this.master);

      osc.start(now + delay);
      mod.start(now + delay);
      osc.stop(now + delay + 0.55);
      mod.stop(now + delay + 0.55);

      setTimeout(() => {
        try { osc.disconnect(); mod.disconnect(); filter.disconnect();
              env.disconnect(); modG.disconnect(); }
        catch { /* nodes already torn down by the context — nothing to release */ }
      }, (delay + 0.65) * 1000);
    }

    // ── Record event ──────────────────────────────────────────────────────
    if (this._recording) {
      const clamped = Math.min(childCount, 6);
      const notes = [];
      for (let i = 0; i < clamped; i++) {
        const freq = 880 / Math.pow(2, i * 0.5);
        // Map descending frequencies to MIDI notes (A5=81 descending)
        const midiNote = Math.max(21, Math.min(108,
          Math.round(69 + 12 * Math.log2(freq / 440))));
        notes.push({ delay: i * 0.08, freq, midiNote });
      }
      this._recordedEvents.push({
        time: now - this._recordStartTime,
        type: 'bifurcation',
        childCount: clamped,
        notes,
        duration: (clamped - 1) * 0.08 + 0.5,
        velocity: 0.8,
      });
    }
  }

  // ── Techno beat: 909-style kick transient ────────────────────────────────
  playBeat() {
    if (!this.initialized || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;

    // Click transient — short noise burst (8ms)
    const clickLen = Math.floor(this.ctx.sampleRate * 0.008);
    const clickBuf = this.ctx.createBuffer(1, clickLen, this.ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) clickData[i] = Math.random() * 2 - 1;
    const clickSrc = this.ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickEnv = this.ctx.createGain();
    clickEnv.gain.setValueAtTime(0.55, now);
    clickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
    clickSrc.connect(clickEnv);
    clickEnv.connect(this.master);
    clickSrc.start(now);

    // Pitch-swept sine kick body (200 Hz → 45 Hz over 180ms)
    const kick = this.ctx.createOscillator();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(200, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.18);
    const kickEnv = this.ctx.createGain();
    kickEnv.gain.setValueAtTime(0, now);
    kickEnv.gain.linearRampToValueAtTime(0.65, now + 0.002);
    kickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    kick.connect(kickEnv);
    kickEnv.connect(this.master);
    kick.start(now);
    kick.stop(now + 0.30);

    setTimeout(() => {
      try {
        clickSrc.disconnect(); clickEnv.disconnect();
        kick.disconnect(); kickEnv.disconnect();
      } catch { /* nodes already torn down by the context — nothing to release */ }
    }, 450);
  }

  // ── Techno drop: multi-layer heavy impact ─────────────────────────────────
  playDrop() {
    if (!this.initialized || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;

    // Layer 1: Hard kick (pitched lower, louder)
    const kick = this.ctx.createOscillator();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(220, now);
    kick.frequency.exponentialRampToValueAtTime(35, now + 0.22);
    const kickEnv = this.ctx.createGain();
    kickEnv.gain.setValueAtTime(0, now);
    kickEnv.gain.linearRampToValueAtTime(0.9, now + 0.002);
    kickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    kick.connect(kickEnv);
    kickEnv.connect(this.master);
    kick.start(now);
    kick.stop(now + 0.42);

    // Layer 2: Sub bass swell (40 Hz, 1.5s)
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 40;
    const subEnv = this.ctx.createGain();
    subEnv.gain.setValueAtTime(0, now);
    subEnv.gain.linearRampToValueAtTime(0.38, now + 0.28);
    subEnv.gain.setValueAtTime(0.38, now + 0.85);
    subEnv.gain.linearRampToValueAtTime(0, now + 1.55);
    sub.connect(subEnv);
    subEnv.connect(this.master);
    sub.start(now);
    sub.stop(now + 1.6);

    // Layer 3: Resonant noise sweep (8kHz → 120Hz bandpass whoosh)
    const noiseLen = Math.floor(this.ctx.sampleRate * 1.2);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const sweepFilter = this.ctx.createBiquadFilter();
    sweepFilter.type = 'bandpass';
    sweepFilter.frequency.setValueAtTime(8000, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(120, now + 0.8);
    sweepFilter.Q.setValueAtTime(14, now);
    sweepFilter.Q.linearRampToValueAtTime(3, now + 0.8);
    const sweepEnv = this.ctx.createGain();
    sweepEnv.gain.setValueAtTime(0.20, now);
    sweepEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    noiseSrc.connect(sweepFilter);
    sweepFilter.connect(sweepEnv);
    sweepEnv.connect(this.master);
    noiseSrc.start(now);

    // Layer 4: Click transient (sharper than beat)
    const clickLen = Math.floor(this.ctx.sampleRate * 0.008);
    const clickBuf = this.ctx.createBuffer(1, clickLen, this.ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) clickData[i] = Math.random() * 2 - 1;
    const clickSrc = this.ctx.createBufferSource();
    clickSrc.buffer = clickBuf;
    const clickEnv = this.ctx.createGain();
    clickEnv.gain.setValueAtTime(0.75, now);
    clickEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
    clickSrc.connect(clickEnv);
    clickEnv.connect(this.master);
    clickSrc.start(now);

    setTimeout(() => {
      try {
        kick.disconnect(); kickEnv.disconnect();
        sub.disconnect(); subEnv.disconnect();
        noiseSrc.disconnect(); sweepFilter.disconnect(); sweepEnv.disconnect();
        clickSrc.disconnect(); clickEnv.disconnect();
      } catch { /* nodes already torn down by the context — nothing to release */ }
    }, 2000);
  }

  // ── Resonance ping: crystalline tone when two nodes are compared ──────────
  playResonance(similarity) {
    if (!this.initialized || this._muted) return;
    if (!Number.isFinite(similarity)) return; // guard against NaN from dynamic nodes
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const freq = 440 + similarity * 440; // A4 → A5 proportional to sim

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // Harmonic overtone
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * (similarity > 0.7 ? 2 : 1.5);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.15 * similarity, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    const env2 = this.ctx.createGain();
    env2.gain.setValueAtTime(0, now);
    env2.gain.linearRampToValueAtTime(0.06 * similarity, now + 0.05);
    env2.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    osc.connect(env); env.connect(this.master);
    osc2.connect(env2); env2.connect(this.master);

    osc.start(now); osc2.start(now);
    osc.stop(now + 1.6); osc2.stop(now + 2.1);

    // ── Record event ──────────────────────────────────────────────────────
    if (this._recording) {
      const midiNote = Math.max(21, Math.min(108,
        Math.round(69 + 12 * Math.log2(freq / 440))));
      this._recordedEvents.push({
        time: now - this._recordStartTime,
        type: 'resonance',
        freq,
        freqOvertone: freq * (similarity > 0.7 ? 2 : 1.5),
        duration: 1.5,
        similarity,
        velocity: similarity,
        midiNote,
      });
    }

    setTimeout(() => {
      try { osc.disconnect(); osc2.disconnect(); env.disconnect(); env2.disconnect(); }
      catch { /* nodes already torn down by the context — nothing to release */ }
    }, 2200);
  }

  // ── Recording: capture audio events with timestamps ───────────────────────

  /**
   * Begin recording all audio events (node plays, edge dyads, bifurcations,
   * resonances) with timestamps relative to the recording start.
   */
  startRecording() {
    if (!this.initialized) return;
    this._recording = true;
    this._recordedEvents = [];
    this._recordStartTime = this.ctx.currentTime;
  }

  /**
   * Stop recording and return the list of recorded events.
   * @returns {{ time: number, type: string }[]}
   */
  stopRecording() {
    this._recording = false;
    return this._recordedEvents.slice(); // return copy
  }

  // ── MIDI export: Standard MIDI File format 1 ──────────────────────────────

  /**
   * Convert the recorded event list to a Standard MIDI File (SMF format 1)
   * as a Uint8Array. Produces a valid .mid file openable in any DAW.
   *
   * Track layout:
   *   Track 0 — tempo map (120 BPM)
   *   Track 1 — node activations (channels 0-4 per cluster)
   *   Track 2 — edge dyads (channels 5-6)
   *   Track 3 — bifurcation cascades (channel 9, drum)
   *
   * @returns {Uint8Array}
   */
  exportMIDI() {
    const events = this._recordedEvents;
    const TPQN = 480; // ticks per quarter note

    // ── Track 0: Tempo map ────────────────────────────────────────────────
    const tempoEvents = [];
    // Tempo meta event: 120 BPM = 500000 μs/beat
    const usPerBeat = 500000;
    tempoEvents.push([
      0x00,                     // delta time 0
      0xFF, 0x51, 0x03,         // tempo meta event, length 3
      (usPerBeat >> 16) & 0xFF,
      (usPerBeat >> 8) & 0xFF,
      usPerBeat & 0xFF,
    ]);
    // Time signature: 4/4
    tempoEvents.push([
      0x00,
      0xFF, 0x58, 0x04,
      0x04, 0x02, 0x18, 0x08,
    ]);
    const track0 = buildTrackChunk(tempoEvents);

    // ── Track 1: Node activations ─────────────────────────────────────────
    const nodeEvents = events
      .filter(e => e.type === 'node')
      .sort((a, b) => a.time - b.time);

    const track1Evts = [];
    let lastTick1 = 0;
    for (const ev of nodeEvents) {
      const tick = secondsToTicks(ev.time);
      const delta = Math.max(0, tick - lastTick1);
      const ch = CLUSTER_MIDI_CH[ev.cluster] != null ? CLUSTER_MIDI_CH[ev.cluster] : 0;
      const note = ev.midiNote || 48;
      const vel = Math.max(1, Math.min(127, Math.round(ev.velocity * 127)));
      const durTicks = Math.max(1, secondsToTicks(ev.duration));

      // Note On
      const deltaBytes = midiVarLength(delta);
      track1Evts.push([...deltaBytes, 0x90 | ch, note, vel]);

      // Note Off after duration
      const offDelta = midiVarLength(durTicks);
      track1Evts.push([...offDelta, 0x80 | ch, note, 0x00]);

      lastTick1 = tick + durTicks;
    }
    const track1 = buildTrackChunk(track1Evts);

    // ── Track 2: Edge dyads ───────────────────────────────────────────────
    const edgeEvents = events
      .filter(e => e.type === 'edge')
      .sort((a, b) => a.time - b.time);

    const track2Evts = [];
    let lastTick2 = 0;
    for (const ev of edgeEvents) {
      const tick = secondsToTicks(ev.time);
      const delta = Math.max(0, tick - lastTick2);
      const noteA = ev.midiNoteA || 48;
      const noteB = ev.midiNoteB || 48;
      const vel = Math.max(1, Math.min(127, Math.round(ev.velocity * 127)));
      const durTicks = Math.max(1, secondsToTicks(ev.duration));

      // Note On for both notes (channel 5 and 6), delta only on first
      const deltaBytes = midiVarLength(delta);
      track2Evts.push([...deltaBytes, 0x90 | 5, noteA, vel]);
      track2Evts.push([0x00, 0x90 | 6, noteB, vel]);   // simultaneous (delta 0)

      // Note Off for both after duration
      const offDelta = midiVarLength(durTicks);
      track2Evts.push([...offDelta, 0x80 | 5, noteA, 0x00]);
      track2Evts.push([0x00, 0x80 | 6, noteB, 0x00]);

      lastTick2 = tick + durTicks;
    }
    const track2 = buildTrackChunk(track2Evts);

    // ── Track 3: Bifurcation cascades (channel 9 — GM drum) ──────────────
    const bifEvents = events
      .filter(e => e.type === 'bifurcation')
      .sort((a, b) => a.time - b.time);

    const track3Evts = [];
    let lastTick3 = 0;
    for (const ev of bifEvents) {
      const baseTick = secondsToTicks(ev.time);
      for (let i = 0; i < ev.notes.length; i++) {
        const n = ev.notes[i];
        const noteTick = baseTick + secondsToTicks(n.delay);
        const delta = Math.max(0, noteTick - lastTick3);
        // Clamp to valid MIDI drum range
        const drumNote = Math.max(27, Math.min(87, n.midiNote));
        const vel = Math.max(1, Math.min(127, Math.round(ev.velocity * 127)));
        const noteDurTicks = Math.max(1, secondsToTicks(0.4));

        const deltaBytes = midiVarLength(delta);
        track3Evts.push([...deltaBytes, 0x99, drumNote, vel]); // 0x99 = NoteOn ch9
        const offDelta = midiVarLength(noteDurTicks);
        track3Evts.push([...offDelta, 0x89, drumNote, 0x00]);  // 0x89 = NoteOff ch9

        lastTick3 = noteTick + noteDurTicks;
      }
    }
    const track3 = buildTrackChunk(track3Evts);

    // ── MThd header ───────────────────────────────────────────────────────
    const numTracks = 4;
    const header = new Uint8Array([
      0x4D, 0x54, 0x68, 0x64,  // "MThd"
      0x00, 0x00, 0x00, 0x06,  // header length = 6
      0x00, 0x01,              // format 1
      (numTracks >> 8) & 0xFF, numTracks & 0xFF,
      (TPQN >> 8) & 0xFF, TPQN & 0xFF,
    ]);

    // ── Concatenate all chunks ────────────────────────────────────────────
    const totalLen = header.length + track0.length + track1.length +
                     track2.length + track3.length;
    const midi = new Uint8Array(totalLen);
    let offset = 0;
    midi.set(header, offset); offset += header.length;
    midi.set(track0, offset); offset += track0.length;
    midi.set(track1, offset); offset += track1.length;
    midi.set(track2, offset); offset += track2.length;
    midi.set(track3, offset); offset += track3.length;

    return midi;
  }

  // ── Graphic score export ──────────────────────────────────────────────────

  /**
   * Return a JSON-serialisable graphic score representation of recorded events.
   * Each entry is suitable for rendering as a visual timeline / graphic notation.
   * @returns {{ time: number, type: string, nodeId?: string, cluster?: string,
   *             freq: number, duration: number, velocity: number, midiNote: number }[]}
   */
  exportScore() {
    const score = [];
    for (const ev of this._recordedEvents) {
      switch (ev.type) {
        case 'node':
          score.push({
            time: ev.time,
            type: 'node',
            nodeId: ev.nodeId,
            cluster: ev.cluster,
            freq: ev.freq,
            duration: ev.duration,
            velocity: ev.velocity,
            midiNote: ev.midiNote,
          });
          break;

        case 'edge':
          // Two simultaneous notes for the dyad
          score.push({
            time: ev.time,
            type: 'edge',
            nodeId: ev.nodeIdA,
            cluster: ev.clusterA,
            freq: ev.freqA,
            duration: ev.duration,
            velocity: ev.velocity,
            midiNote: ev.midiNoteA,
          });
          score.push({
            time: ev.time,
            type: 'edge',
            nodeId: ev.nodeIdB,
            cluster: ev.clusterB,
            freq: ev.freqB,
            duration: ev.duration,
            velocity: ev.velocity,
            midiNote: ev.midiNoteB,
          });
          break;

        case 'bifurcation':
          for (const n of ev.notes) {
            score.push({
              time: ev.time + n.delay,
              type: 'bifurcation',
              nodeId: undefined,
              cluster: undefined,
              freq: n.freq,
              duration: 0.4,
              velocity: ev.velocity,
              midiNote: n.midiNote,
            });
          }
          break;

        case 'resonance':
          score.push({
            time: ev.time,
            type: 'resonance',
            nodeId: undefined,
            cluster: undefined,
            freq: ev.freq,
            duration: ev.duration,
            velocity: ev.velocity,
            midiNote: ev.midiNote,
          });
          break;
      }
    }
    return score.sort((a, b) => a.time - b.time);
  }

  // ── Continuous sonification layers ──────────────────────────────────────────
  // Created once in init(), parameter-modulated via stepContinuous() from RAF.
  // All interpolation via setTargetAtTime — native audio thread, zero JS per sample.

  _startContinuousLayers() {
    const now = this.ctx.currentTime;

    // ── Layer 1: Bifurcation FM drone voice ──────────────────────────────────
    // r value modulates FM depth and drone filter brightness
    this._bifurcFM = this.ctx.createOscillator();
    this._bifurcFM.type = 'sine';
    this._bifurcFM.frequency.value = 82.41;  // E2

    this._bifurcFMmod = this.ctx.createOscillator();
    this._bifurcFMmod.type = 'sine';
    this._bifurcFMmod.frequency.value = 82.41 * 1.5;  // B2 (perfect fifth)

    this._bifurcFMmodGain = this.ctx.createGain();
    this._bifurcFMmodGain.gain.value = 0;  // mod index starts silent

    this._bifurcFMmod.connect(this._bifurcFMmodGain);
    this._bifurcFMmodGain.connect(this._bifurcFM.frequency);

    this._bifurcFMenv = this.ctx.createGain();
    this._bifurcFMenv.gain.value = 0.025;  // quiet layer

    this._bifurcFM.connect(this._bifurcFMenv);
    this._bifurcFMenv.connect(this.master);

    this._bifurcFM.start(now);
    this._bifurcFMmod.start(now);

    // ── Layer 2: Phase consonance — 3 oscillators that drift in/out of tune ──
    this._phaseOscs = [];
    const phaseFreqs = [220, 329.63, 440];  // A3, E4, A4 (octave + fifth)
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = phaseFreqs[i];
      const g = this.ctx.createGain();
      g.gain.value = 0;  // start silent, activated by stepContinuous
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      this._phaseOscs.push({ osc, gain: g });
    }

    // ── Layer 3: Spectral dimensionality — filtered noise texture ────────────
    const specNoiseLen = this.ctx.sampleRate * 2;
    const specNoiseBuf = this.ctx.createBuffer(1, specNoiseLen, this.ctx.sampleRate);
    const specNoiseData = specNoiseBuf.getChannelData(0);
    for (let i = 0; i < specNoiseLen; i++) specNoiseData[i] = Math.random() * 2 - 1;

    this._specNoise = this.ctx.createBufferSource();
    this._specNoise.buffer = specNoiseBuf;
    this._specNoise.loop = true;

    this._specFilter = this.ctx.createBiquadFilter();
    this._specFilter.type = 'bandpass';
    this._specFilter.frequency.value = 200;
    this._specFilter.Q.value = 12;

    this._specGain = this.ctx.createGain();
    this._specGain.gain.value = 0;  // start silent

    this._specNoise.connect(this._specFilter);
    this._specFilter.connect(this._specGain);
    this._specGain.connect(this.master);
    this._specNoise.start(now);

    // ── Layer 4: Spatial edge flow — 4 micro-tone voice pool ─────────────────
    this._edgeVoices = [];
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 440;
      const pan = this.ctx.createStereoPanner();
      pan.pan.value = 0;
      const env = this.ctx.createGain();
      env.gain.value = 0;
      osc.connect(env);
      env.connect(pan);
      pan.connect(this.master);
      osc.start(now);
      this._edgeVoices.push({ osc, panner: pan, env });
    }
    this._edgeVoiceIdx = 0;
    this._contInitialized = true;
  }

  // ── Per-frame continuous sonification step ──────────────────────────────────
  // Called from ArtTab RAF loop every 4 frames (~15Hz).
  // Receives simulation state snapshot; smoothly ramps audio parameters.
  stepContinuous({ r, activations, participationRatio, spectralFlux, edgePulses }) {
    if (!this.initialized || !this._contInitialized || this._muted) return;
    const now = this.ctx.currentTime;

    // ── Layer 1: Bifurcation drone modulation ─────────────────────────────────
    const rNorm = Math.max(0, Math.min(1, (r - 1.0) / 3.0));
    // FM modulation depth scales with r
    this._bifurcFMmodGain.gain.setTargetAtTime(82 * rNorm * 4, now, 0.3);
    // Drone filter brightness tracks r (overrides setEnergy for this param)
    if (this.droneFilter) {
      this.droneFilter.frequency.setTargetAtTime(80 + rNorm * 720, now, 0.3);
    }
    // FM voice volume — fades in as r increases
    this._bifurcFMenv.gain.setTargetAtTime(0.01 + rNorm * 0.025, now, 0.3);

    // ── Layer 2: Phase consonance (Kuramoto order parameter) ──────────────────
    if (activations && activations.length > 0) {
      // Compute phase coherence: treat activations as phases on unit circle
      let sumCos = 0, sumSin = 0;
      const N = activations.length;
      for (let i = 0; i < N; i++) {
        const theta = (activations[i] || 0) * Math.PI * 2;
        sumCos += Math.cos(theta);
        sumSin += Math.sin(theta);
      }
      const coherence = Math.sqrt(sumCos * sumCos + sumSin * sumSin) / N;

      const detuneMax = (1 - coherence) * 15;  // cents
      for (let i = 0; i < this._phaseOscs.length; i++) {
        const { osc, gain } = this._phaseOscs[i];
        // Slowly drifting detune based on coherence
        const drift = Math.sin(now * (0.1 + i * 0.07)) * detuneMax;
        osc.detune.setTargetAtTime(drift, now, 0.2);
        // Volume scales with coherence — more coherent = louder harmonics
        gain.gain.setTargetAtTime(0.004 + coherence * 0.009, now, 0.3);
      }
    }

    // ── Layer 3: Spectral dimensionality texture ──────────────────────────────
    if (participationRatio != null) {
      const prNorm = Math.min(1, Math.max(0, (participationRatio - 1) / 15));
      const specFreq = 200 + prNorm * 1800;
      const specQ = Math.max(1, 12 - prNorm * 11);
      const fluxMod = (spectralFlux || 0) * 400;
      this._specFilter.frequency.setTargetAtTime(specFreq + fluxMod, now, 0.5);
      this._specFilter.Q.setTargetAtTime(specQ, now, 0.5);
      // Volume: quiet but present
      this._specGain.gain.setTargetAtTime(0.008 + prNorm * 0.012, now, 0.4);
    }

    // ── Layer 4: Spatial edge flow micro-tones ────────────────────────────────
    if (edgePulses) {
      for (const ep of edgePulses) {
        if (ep.pulse < 0.3) continue;
        const voice = this._edgeVoices[this._edgeVoiceIdx];
        this._edgeVoiceIdx = (this._edgeVoiceIdx + 1) % 4;
        voice.osc.frequency.setValueAtTime(ep.freq, now);
        voice.panner.pan.setValueAtTime(Math.max(-1, Math.min(1, ep.pan)), now);
        voice.env.gain.cancelScheduledValues(now);
        voice.env.gain.setValueAtTime(0, now);
        voice.env.gain.linearRampToValueAtTime(0.035 * ep.pulse, now + 0.01);
        voice.env.gain.linearRampToValueAtTime(0, now + 0.06);
      }
    }
  }

  // ── Beat clock: rhythmic pulse at fixed BPM (ambient mode) ──────────────
  /**
   * Start firing playBeat() at the given BPM.
   * @param {number} bpm      — beats per minute (default 114)
   * @param {function} onBeat — optional visual callback fired on each beat
   */
  startBeatClock(bpm = 114, onBeat) {
    this.stopBeatClock();
    const intervalMs = Math.round(60000 / bpm);
    const fire = () => {
      if (this.initialized && !this._muted) this.playBeat();
      if (onBeat) onBeat();
    };
    fire();  // fire immediately so beat starts on toggle
    this._beatClockId = setInterval(fire, intervalMs);
  }

  /** Stop the beat clock. */
  stopBeatClock() {
    if (this._beatClockId != null) {
      clearInterval(this._beatClockId);
      this._beatClockId = null;
    }
  }

  // ── Energy modulation: controls drone intensity + filter ──────────────────
  setEnergy(e) {
    this._energy = Math.max(0, Math.min(1, e));
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    if (this.droneGain) {
      this.droneGain.gain.linearRampToValueAtTime(0.03 + this._energy * 0.08, now + 0.5);
    }
    if (this.droneFilter) {
      this.droneFilter.frequency.linearRampToValueAtTime(80 + this._energy * 200, now + 0.5);
    }
  }

  // ── Volume / mute ─────────────────────────────────────────────────────────
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.master) {
      this.master.gain.linearRampToValueAtTime(this._volume, this.ctx.currentTime + 0.05);
    }
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this.master) {
      this.master.gain.linearRampToValueAtTime(
        this._muted ? 0 : this._volume,
        this.ctx.currentTime + 0.1
      );
    }
    return this._muted;
  }

  get muted() { return this._muted; }
  get volume() { return this._volume; }

  /** Suspend audio context — silences all output without destroying nodes. */
  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /** Resume audio context after suspend. */
  resume() {
    if (this.ctx && this.ctx.state === 'suspended' && !this._muted) {
      this.ctx.resume().catch(() => {});
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  dispose() {
    this.stopBeatClock();
    // Stop continuous layer oscillators
    try {
      if (this._bifurcFM) this._bifurcFM.stop();
      if (this._bifurcFMmod) this._bifurcFMmod.stop();
      if (this._specNoise) this._specNoise.stop();
      if (this._phaseOscs) this._phaseOscs.forEach(p => p.osc.stop());
      if (this._edgeVoices) this._edgeVoices.forEach(v => v.osc.stop());
    } catch { /* already stopped */ }
    this._contInitialized = false;

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.initialized = false;
    this._recording = false;
    this._recordedEvents = [];
  }
}

// Singleton — shared across all components
export const somaAudio = new SomaAudioEngine();
export default somaAudio;
