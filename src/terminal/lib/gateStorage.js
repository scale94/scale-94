export const GATE_KEY = 'scale94.gate';

let memoryFallback = null;

function safeStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function getGateState() {
  const storage = safeStorage();
  if (!storage) return memoryFallback;
  try {
    return storage.getItem(GATE_KEY);
  } catch {
    return memoryFallback;
  }
}

export function setGateState(value) {
  const storage = safeStorage();
  memoryFallback = value;
  if (!storage) return;
  try {
    if (value == null) storage.removeItem(GATE_KEY);
    else storage.setItem(GATE_KEY, value);
  } catch {
    /* in-memory fallback already updated */
  }
}
