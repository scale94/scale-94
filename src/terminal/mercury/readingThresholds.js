// Pure reading-time math for the retrograde reading witness.
export function countWords(text) {
  if (!text) return 0;
  const m = String(text).trim().match(/\S+/g);
  return m ? m.length : 0;
}

// Expected active reading seconds for a body of `words`, discounted by leniency
// so we reward genuine reading without punishing fast technical readers.
export function requiredSeconds(words, { wpm = 200, leniency = 0.55 } = {}) {
  if (!words || words <= 0) return 0;
  return (words / wpm) * 60 * leniency;
}
