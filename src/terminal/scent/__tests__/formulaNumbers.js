// Test-only (P3 Review Focus 4).
import { expect } from 'vitest';

// Every number on screen is a formula number (or its ×100 percent), Review Focus 4.
function formulaNumbers(f) {
  const nums = new Set();
  const add = (x) => { nums.add(String(x)); };
  const walk = (v) => {
    if (typeof v === 'number') {
      for (const d of [0, 1, 2, 3, 4]) { add(Number(v.toFixed(d))); add(Number((v * 100).toFixed(d))); }
    } else if (typeof v === 'string') {
      for (const m of v.matchAll(/\d+(?:\.\d+)?/g)) add(Number(m[0]));
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(f);
  return nums;
}
export function expectEveryNumberFromFormula(text, f) {
  const allowed = formulaNumbers(f);
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    expect(allowed.has(String(Number(m[0]))), `"${m[0]}" is not a formula number`).toBe(true);
  }
}
