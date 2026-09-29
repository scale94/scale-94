// Dev-only preview for the Ledger ocean (ledger-ocean-preview.html).
// Query: ?w=1024 (canvas CSS width; height = w/2) &dps=9 (simulated days per second).
import { createRoot } from 'react-dom/client';
import LedgerOcean from './LedgerOcean';

const q = new URLSearchParams(window.location.search);
const w = Number(q.get('w') || 1024);
const dps = Number(q.get('dps') || 9);
window.__ocean = { ready: false, simDays: 0 };

createRoot(document.getElementById('root')).render(
  <LedgerOcean
    width={w}
    height={w / 2}
    daysPerSecond={dps}
    onFrame={(d) => { window.__ocean.ready = true; window.__ocean.simDays = d; }}
  />,
);
