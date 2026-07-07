// Cross-tab healing signal — TRANSMISSION publishes, ECOCIDE subscribes.
// Same pub/sub shape as councilBus, plus localStorage persistence so the
// Ecocide tab can read the last harvest without TRANSMISSION ever mounting.
// No pending buffer needed: the signal is a scalar, latest-wins, and cold
// reads go through localStorage.

export const HEALING_STORAGE_KEY = 'scale94_healing_signal';
export const HEALING_EXPIRY_MS = 24 * 60 * 60 * 1000;

const listeners = [];

export function publishHealing({ healingIndex, bandwidth, harvestedAt }) {
  const payload = { healingIndex, bandwidth, harvestedAt };
  try {
    localStorage.setItem(HEALING_STORAGE_KEY, JSON.stringify(payload));
  } catch { /* quota or private mode — silently no-op */ }
  listeners.forEach(fn => fn(payload));
}

export function readHealing(now = Date.now()) {
  try {
    const raw = localStorage.getItem(HEALING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.healingIndex !== 'number' || typeof parsed?.harvestedAt !== 'number') return null;
    if (now - parsed.harvestedAt > HEALING_EXPIRY_MS) return null;
    return parsed;
  } catch { return null; }
}

export function subscribeHealing(fn) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function _resetHealingForTests() {
  listeners.length = 0;
  try { localStorage.removeItem(HEALING_STORAGE_KEY); } catch { /* no-op */ }
}
