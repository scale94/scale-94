// The /mercury element lifecycle (spec 2026-10-07 neutral state): neutral is a fifth state — the held-liquid planet,
// no gas. Every switch passes fadeOut → neutral beat → spinUp. Pure, allocation-free in advance(); the hook drives it.
export const ELEMENTS = ['fluid', 'thermal', 'earth', 'air'];
export const FADE_OUT_MS = 400;
export const NEUTRAL_MS = 300;
export const SPIN_UP_MS = 600;
const EPS_MS = 1e-6; // a beat whose remainder is float dust ends now, not on a later frame

// Fades store the eased OUTPUT; entering a beat inverts that beat's curve for its linear progress p, so a retarget
// continues from the current value with no jump. fadeOut f = 1 − p² (easeIn), spinUp f = 1 − (1 − p)² (easeOut).
const fadeOutP = (f) => Math.sqrt(Math.max(0, 1 - f));
const spinUpP = (f) => 1 - Math.sqrt(Math.max(0, 1 - f));

export function createMachine() {
  return { state: 'neutral', target: 'neutral', beat: 'idle', p: 0, beatMs: 0, fade: { fluid: 0, thermal: 0, earth: 0, air: 0 } };
}

// The element whose fade is rising or at 1 — the lit node. None in neutral or while one fades out.
export function activeElement(m) {
  if (m.beat === 'spinUp') return m.state;
  if (m.beat === 'idle' && m.state !== 'neutral') return m.state;
  return null;
}

export function holdLiquid(m) {
  return m.state === 'neutral' || m.beat === 'neutral';
}

export function isSteady(m) {
  return m.beat === 'idle';
}

function enterFadeOut(m) { m.beat = 'fadeOut'; m.p = fadeOutP(m.fade[m.state]); }
function enterSpinUp(m, e) { m.state = e; m.beat = 'spinUp'; m.p = spinUpP(m.fade[e]); }

// A node tap. Tapping the lit element means "go to neutral".
export function request(m, element) {
  m.target = element === activeElement(m) ? 'neutral' : element;
  if (m.beat === 'idle') {
    if (m.state === 'neutral') { if (m.target !== 'neutral') enterSpinUp(m, m.target); }
    else if (m.target !== m.state) enterFadeOut(m);
  } else if (m.beat === 'fadeOut') {
    if (m.target === m.state) enterSpinUp(m, m.state); // reversal: no neutral beat
  } else if (m.beat === 'neutral') {
    if (m.target === 'neutral') { m.beat = 'idle'; m.beatMs = 0; }
  } else if (m.beat === 'spinUp') {
    if (m.target !== m.state) enterFadeOut(m);
  }
  return m;
}

// Mutates m; one call with a large dt resolves every remaining beat and lands on the target's steady state.
export function advance(m, dtMs) {
  let dt = dtMs > 0 ? dtMs : 0;
  while (dt > 0 && m.beat !== 'idle') {
    if (m.beat === 'fadeOut') {
      const left = (1 - m.p) * FADE_OUT_MS;
      if (dt < left - EPS_MS) { m.p += dt / FADE_OUT_MS; m.fade[m.state] = 1 - m.p * m.p; dt = 0; }
      else {
        dt = Math.max(0, dt - left);
        m.fade[m.state] = 0;
        m.state = 'neutral';
        if (m.target === 'neutral') m.beat = 'idle';
        else { m.beat = 'neutral'; m.beatMs = 0; }
      }
    } else if (m.beat === 'neutral') {
      const left = NEUTRAL_MS - m.beatMs;
      if (dt < left - EPS_MS) { m.beatMs += dt; dt = 0; }
      else { dt = Math.max(0, dt - left); m.beatMs = 0; enterSpinUp(m, m.target); }
    } else { // spinUp
      const left = (1 - m.p) * SPIN_UP_MS;
      if (dt < left - EPS_MS) { m.p += dt / SPIN_UP_MS; const q = 1 - m.p; m.fade[m.state] = 1 - q * q; dt = 0; }
      else { dt = 0; m.fade[m.state] = 1; m.beat = 'idle'; }
    }
  }
  return m;
}
