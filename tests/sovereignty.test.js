import { describe, it, expect, beforeEach } from 'vitest';
import {
  RESISTANCE_WEIGHTS,
  REDACTION_MAP,
  CENSOR,
  assessSovereignty,
  redactCard,
  transitTag,
  publishAssessment,
  getLastAssessment,
  subscribeSovereignty,
  _resetSovereigntyForTests,
} from '../src/terminal/lib/sovereignty.js';

const accordOf = (sovereignty, cleanRoom) => ({ sovereignty, cleanRoom });
const expectedResistance = (s, c) =>
  Math.round((s * RESISTANCE_WEIGHTS.sovereignty + c * RESISTANCE_WEIGHTS.cleanRoom) * 100);

const CARD = Object.freeze({
  name: 'TEST × CHIMERA', id: 'a-b-123',
  conc: 'EAU DE PARFUM', concPct: '15–20%', longevity: '6–10 hours',
  topNotes: ['bergamot', 'yuzu'], heartNotes: ['jasmine', 'rose', 'clove'], baseNotes: ['cedar', 'musk'],
  dom: 'floral', sec: 'fresh', hueA: 10, hueB: 200,
  nodeClass: 'RTA', polLabel: 'MERIDIAN', evap: [0.4, 0.35, 0.25],
});

describe('assessSovereignty', () => {
  it('resistance follows RESISTANCE_WEIGHTS', () => {
    const a = assessSovereignty({ panopticonIndex: 61, accord: accordOf(0.4, 0.5) });
    expect(a.resistance).toBe(expectedResistance(0.4, 0.5));
    expect(a.threat).toBe(61);
    expect(a.exposure).toBe(Math.max(0, Math.min(100, Math.round(61 - a.resistance))));
  });

  it('missing scalars default to resistance 0 — maximum vulnerability', () => {
    const a = assessSovereignty({ panopticonIndex: 61, accord: {} });
    expect(a.resistance).toBe(0);
    expect(a.exposure).toBe(61);
    const b = assessSovereignty({ panopticonIndex: 61, accord: null });
    expect(b.resistance).toBe(0);
  });

  it('null threat → OFFLINE verdict, exposure 0, no redactions', () => {
    const a = assessSovereignty({ panopticonIndex: null, accord: accordOf(0.4, 0.5) });
    expect(a.threat).toBeNull();
    expect(a.exposure).toBe(0);
    expect(a.redactions).toEqual([]);
    expect(a.verdict).toBe('PANOPTICON OFFLINE — SEALED WITHOUT ASSESSMENT');
  });

  it('exposure clamps to [0, 100]', () => {
    expect(assessSovereignty({ panopticonIndex: 5, accord: accordOf(1, 1) }).exposure).toBe(0);
    expect(assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) }).exposure).toBe(100);
  });

  it('each threshold fires at exactly its boundary and not one below', () => {
    for (const entry of REDACTION_MAP) {
      // Exposure exactly at threshold: entry fires.
      const at = assessSovereignty({ panopticonIndex: entry.threshold, accord: accordOf(0, 0) });
      expect(at.redactions.some((r) => r.vectorId === entry.vectorId)).toBe(true);
      // One below: entry does not fire.
      const below = assessSovereignty({ panopticonIndex: entry.threshold - 1, accord: accordOf(0, 0) });
      expect(below.redactions.some((r) => r.vectorId === entry.vectorId)).toBe(false);
    }
  });

  it('redaction is cumulative — all entries at or below exposure fire', () => {
    const mid = REDACTION_MAP[2].threshold; // third entry's threshold
    const a = assessSovereignty({ panopticonIndex: mid, accord: accordOf(0, 0) });
    const firedIds = new Set(a.redactions.map((r) => r.vectorId));
    for (const entry of REDACTION_MAP) {
      expect(firedIds.has(entry.vectorId)).toBe(entry.threshold <= mid);
    }
    // Every fired entry contributes ALL its fields.
    const expectedFieldCount = REDACTION_MAP
      .filter((e) => e.threshold <= mid)
      .reduce((n, e) => n + e.fields.length, 0);
    expect(a.redactions).toHaveLength(expectedFieldCount);
  });

  it('is deterministic — same inputs, deep-equal output', () => {
    const args = { panopticonIndex: 61, accord: accordOf(0.31, 0.62) };
    expect(assessSovereignty(args)).toEqual(assessSovereignty(args));
  });

  it('verdict names fired vectors when redacting, CLEAN COMPILE otherwise', () => {
    const clean = assessSovereignty({ panopticonIndex: 10, accord: accordOf(1, 1) });
    expect(clean.verdict).toBe('CLEAN COMPILE — NO FIELDS VAULTED');
    const dirty = assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) });
    for (const entry of REDACTION_MAP) expect(dirty.verdict).toContain(entry.vectorId);
  });
});

describe('redactCard', () => {
  it('returns the same object when there are no redactions', () => {
    expect(redactCard(CARD, [])).toBe(CARD);
    expect(redactCard(CARD, null)).toBe(CARD);
  });

  it('censors note arrays preserving length, strings to CENSOR, evap to zeros', () => {
    const a = assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) }); // everything fires
    const r = redactCard(CARD, a.redactions);
    expect(r.topNotes).toEqual([CENSOR, CENSOR]);
    expect(r.heartNotes).toEqual([CENSOR, CENSOR, CENSOR]);
    expect(r.baseNotes).toEqual([CENSOR, CENSOR]);
    expect(r.longevity).toBe(CENSOR);
    expect(r.concPct).toBe(CENSOR);
    expect(r.nodeClass).toBe(CENSOR);
    expect(r.polLabel).toBe(CENSOR);
    expect(r.evap).toEqual([0, 0, 0]);
    expect(r.__redacted).toEqual(a.redactions.map((x) => x.field));
  });

  it('never touches identity fields and never mutates the original', () => {
    const a = assessSovereignty({ panopticonIndex: 100, accord: accordOf(0, 0) });
    const r = redactCard(CARD, a.redactions);
    expect(r.name).toBe(CARD.name);
    expect(r.id).toBe(CARD.id);
    expect(r.conc).toBe(CARD.conc);
    expect(r.dom).toBe(CARD.dom);
    expect(r.sec).toBe(CARD.sec);
    // Original untouched (CARD is frozen — mutation would have thrown — but verify values too):
    expect(CARD.heartNotes).toEqual(['jasmine', 'rose', 'clove']);
    expect(CARD.evap).toEqual([0.4, 0.35, 0.25]);
  });
});

describe('transitTag', () => {
  it('annotates a redacted field with its claiming vector', () => {
    // Parameterized against REDACTION_MAP so threshold retunes don't break this:
    // exposure exactly at COOKIE_STATUS's threshold fires heartNotes but not topNotes.
    const cookie = REDACTION_MAP.find((e) => e.vectorId === 'COOKIE_STATUS');
    const a = assessSovereignty({ panopticonIndex: cookie.threshold, accord: accordOf(0, 0) });
    expect(transitTag(a.redactions, 'heartNotes')).toBe(' [COOKIE_STATUS]');
    expect(transitTag(a.redactions, 'topNotes')).toBe('');
    expect(transitTag(null, 'heartNotes')).toBe('');
  });
});

describe('last-assessment store', () => {
  beforeEach(() => _resetSovereigntyForTests());

  it('starts empty, publishes, notifies, unsubscribes', () => {
    expect(getLastAssessment()).toBeNull();
    let seen = null;
    const un = subscribeSovereignty((a) => { seen = a; });
    const assessment = assessSovereignty({ panopticonIndex: 61, accord: accordOf(0.4, 0.5) });
    publishAssessment(assessment);
    expect(getLastAssessment()).toBe(assessment);
    expect(seen).toBe(assessment);
    un();
    publishAssessment(null);
    expect(seen).toBe(assessment); // no further notification
  });
});
