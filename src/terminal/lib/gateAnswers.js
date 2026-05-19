export const GATE_PROMPT = 'from perihelion, growth reads as ___';

export const ACCEPTED_ANSWERS = ['bargain'];

export function normalizeGateAnswer(text) {
  if (text == null) return '';
  return String(text).trim().toLowerCase();
}

export function isAcceptedAnswer(text) {
  const norm = normalizeGateAnswer(text);
  if (!norm) return false;
  return ACCEPTED_ANSWERS.includes(norm);
}
