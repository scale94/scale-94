// src/terminal/mercury/mercuryKernelUnlock.js — the systemless-root flag.
// Mirrors sealedArtifact.js: storage concerns live in a storage module, wrapped
// in try/catch (a rooted phone doesn't panic when the drawer is locked). The
// bypass persists like Android Developer Options — flip it once, it stays.
const STORAGE_KEY = 'mercury_kernel_v1';
const EVENT = 'mercurykernel:change';

export function isMercuryKernelUnlocked() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
}

export function unlockMercuryKernel() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* unwitnessed */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* no window */ }
}

// Dev/QA only — no UI surfaces this. Once rooted, rooted.
export function relockMercuryKernel() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* unwitnessed */ }
  try { window.dispatchEvent(new CustomEvent(EVENT)); } catch { /* no window */ }
}

export function subscribeMercuryKernel(fn) {
  const handler = () => fn();
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
