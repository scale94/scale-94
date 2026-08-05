// artBeatClock.js — visual-only beat clock for the sphere's ambient pulse.
//
// Extracted from SomaAudio.startBeatClock when the /art tab's audio was
// removed. The "Ambient beat pulse glow" layer decays a beat phase every
// frame and needs something to set it back to 1 on the beat. That something
// used to be the audio engine, which made a purely visual effect depend on
// an AudioContext — and made the pulse the least obvious casualty of
// deleting the sound.

export const DEFAULT_BPM = 114;

/**
 * createBeatClock({ bpm, onBeat }) — a bare interval that fires immediately
 * on start and then once per beat. Timing is identical to the audio clock it
 * replaces; only the sound is gone.
 */
export function createBeatClock({ bpm = DEFAULT_BPM, onBeat } = {}) {
  const intervalMs = Math.round(60000 / bpm);
  let id = null;

  const stop = () => {
    if (id != null) { clearInterval(id); id = null; }
  };

  const start = () => {
    stop();                       // never double-schedule
    onBeat?.();                   // fire immediately so the pulse starts on toggle
    id = setInterval(() => onBeat?.(), intervalMs);
  };

  return {
    start,
    stop,
    intervalMs,
    get running() { return id != null; },
  };
}
