// CAS Registry Number check (spec §7.1). Format \d{2,7}-\d{2}-\d; the check
// digit is Σ(digitᵢ × positionᵢ, counted from the right, excluding the check
// digit) mod 10. Pure.
export function isValidCas(cas) {
  const m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(typeof cas === 'string' ? cas : '');
  if (!m) return false;
  const digits = (m[1] + m[2]).split('').reverse();
  const sum = digits.reduce((s, d, i) => s + Number(d) * (i + 1), 0);
  return sum % 10 === Number(m[3]);
}
