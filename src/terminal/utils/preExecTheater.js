// ── preExecTheater ────────────────────────────────────────────────────────────
// Injects variable artificial delay + memory-address hex stream into any log
// callback. Shared by the terminal RUN path and the LatentCollider CRYSTALLIZE
// ACCORD path.
//
// appendLog  — (line: string) => void  — called every ~30ms during delay
// durationMs — number                  — total theater duration in ms
// returns    — Promise<void>           — resolves when duration elapses

const HEX = '0123456789abcdef';

function randHex8() {
  let s = '';
  for (let i = 0; i < 8; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
}

function hexLine() {
  return `0x${randHex8()}  0x${randHex8()}  0x${randHex8()}  0x${randHex8()}`;
}

/**
 * Runs the pre-execution theater: streams hex address lines into `appendLog`
 * every 30ms for `durationMs` milliseconds.
 */
export function runPreExecTheater(appendLog, durationMs) {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      try { appendLog(hexLine()); } catch { /* log callback errors are non-fatal */ }
    }, 30);
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, durationMs);
  });
}

/**
 * Returns a random integer in [200, 450] for use as theater duration.
 * Called independently by each consumer so RUN and CRYSTALLIZE get different durations.
 */
export function theaterDuration() {
  return Math.floor(Math.random() * 251) + 200;
}
