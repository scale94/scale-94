// Dev-only preview for the Ledger ocean (ledger-ocean-preview.html).
// Query: ?w=1024 (canvas CSS width; height = w/2) &dps=9 (simulated days per second).
// Publishes window.__ocean = { ready, readyAt, simDays, warmAt } for the CDP
// scripts (readyAt / warmAt are performance.now() stamps).
import { createRoot } from 'react-dom/client';
import LedgerOcean from './LedgerOcean';
import { REDUCED_MOTION_DAYS } from './oceanDriver';

const q = new URLSearchParams(window.location.search);
const w = Number(q.get('w') || 1024);
const dps = Number(q.get('dps') || 9);
window.__ocean = { ready: false, readyAt: null, simDays: 0, warmAt: null };

function onFrame(d) {
  const o = window.__ocean;
  if (!o.ready) {
    o.ready = true;
    o.readyAt = performance.now();
  }
  o.simDays = d;
  if (o.warmAt === null && d >= REDUCED_MOTION_DAYS - 1e-6) o.warmAt = performance.now();
}

createRoot(document.getElementById('root')).render(
  <LedgerOcean width={w} height={w / 2} daysPerSecond={dps} onFrame={onFrame} />,
);
