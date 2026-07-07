import { describe, it, expect } from 'vitest';
import {
  ENGINE_TUNING, PROBE_GROUPS, HEALING_LEXICON,
  lexiconScore, sicknessScore, inverseViralityWeight, scorePost,
  subthresholdFilter, healingIndex, sicknessCap, bandwidth,
  activeProbeGroup, healingGrowthOffset, healingSargLift, postUrl,
} from '../inverseEngine';

const NOW = Date.parse('2026-07-07T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 24 * 3600 * 1000).toISOString();

const post = (over = {}) => ({
  uri: 'at://did:plc:abc/app.bsky.feed.post/3k1',
  handle: 'gardener.bsky.social',
  displayName: 'Gardener',
  text: 'Our seed library is open — free seeds and mutual aid for neighbors',
  createdAt: daysAgo(2),
  likes: 2, reposts: 0, replies: 1,
  ...over,
});

describe('lexicon matcher', () => {
  it('sums weights of matched terms, once per term, case-insensitive', () => {
    expect(lexiconScore('MUTUAL AID and more mutual aid', { 'mutual aid': 3 })).toBe(3);
    expect(lexiconScore('repair and rewild', { repair: 2, rewild: 3 })).toBe(5);
  });
  it('requires word boundaries — no substring matches', () => {
    expect(lexiconScore('freedom', { free: 1 })).toBe(0);
    expect(lexiconScore('shared repairing', { share: 1, repair: 2 })).toBe(0);
  });
  it('returns 0 for empty/missing text', () => {
    expect(lexiconScore('', { free: 1 })).toBe(0);
    expect(lexiconScore(null, { free: 1 })).toBe(0);
  });
});

describe('sickness scoring', () => {
  it('adds ALL-CAPS ratio penalty on shouty posts', () => {
    const shouty = 'EVERYTHING IS FALLING APART AND NOBODY CARES AT ALL';
    expect(sicknessScore(shouty)).toBeGreaterThanOrEqual(2);
  });
  it('adds exclamation penalty at 3+ marks', () => {
    const calm = sicknessScore('a quiet note about tea');
    const excl = sicknessScore('a quiet note about tea!!!');
    expect(excl).toBe(calm + 1);
  });
  it('scores panic lexicon terms', () => {
    expect(sicknessScore('total outrage, we are doomed')).toBeGreaterThan(0);
  });
});

describe('inverse-virality weight', () => {
  it('weights zero-engagement posts highest', () => {
    expect(inverseViralityWeight(0, 0)).toBeCloseTo(1 / Math.log(2), 4);
  });
  it('decreases monotonically with engagement', () => {
    expect(inverseViralityWeight(0, 0)).toBeGreaterThan(inverseViralityWeight(10, 14));
  });
});

describe('scorePost', () => {
  it('contribution = max(0, healing − sickness) × weight', () => {
    const s = scorePost(post());
    expect(s.contribution).toBeCloseTo(
      Math.max(0, s.healingScore - s.sicknessScore) * s.weight, 6);
    expect(s.healingScore).toBeGreaterThan(0);
  });
  it('never yields negative contribution', () => {
    const s = scorePost(post({ text: 'OUTRAGE!!! PANIC!!! DOOMED!!!' }));
    expect(s.contribution).toBe(0);
  });
});

describe('subthresholdFilter', () => {
  it('drops posts above the engagement cap — the inversion', () => {
    const loud = post({ uri: 'at://x/app.bsky.feed.post/loud', likes: 500, reposts: 40 });
    expect(subthresholdFilter([post(), loud], NOW)).toHaveLength(1);
  });
  it('keeps posts exactly at the cap', () => {
    const atCap = post({ likes: ENGINE_TUNING.SUBTHRESHOLD_MAX, reposts: 0 });
    expect(subthresholdFilter([atCap], NOW)).toHaveLength(1);
  });
  it('drops posts older than 14 days or with no createdAt', () => {
    expect(subthresholdFilter([post({ createdAt: daysAgo(20) })], NOW)).toHaveLength(0);
    expect(subthresholdFilter([post({ createdAt: null })], NOW)).toHaveLength(0);
  });
  it('keeps at most 2 posts per author', () => {
    const posts = [1, 2, 3].map(i => post({ uri: `at://x/app.bsky.feed.post/${i}` }));
    expect(subthresholdFilter(posts, NOW)).toHaveLength(2);
  });
});

describe('healing index + sickness cap + bandwidth', () => {
  it('is 0 for an empty corpus and saturates below 100', () => {
    expect(healingIndex([])).toBe(0);
    const many = Array.from({ length: 200 }, () => ({ contribution: 5 }));
    const H = healingIndex(many);
    expect(H).toBeGreaterThan(99);
    expect(H).toBeLessThanOrEqual(100);
  });
  it('grows monotonically with contributions', () => {
    const a = healingIndex([{ contribution: 3 }]);
    const b = healingIndex([{ contribution: 3 }, { contribution: 3 }]);
    expect(b).toBeGreaterThan(a);
  });
  it('sicknessCap = fraction of posts where sickness beats healing', () => {
    const corpus = [
      { sicknessScore: 5, healingScore: 1 },
      { sicknessScore: 0, healingScore: 3 },
      { sicknessScore: 0, healingScore: 2 },
      { sicknessScore: 4, healingScore: 0 },
    ];
    expect(sicknessCap(corpus)).toBeCloseTo(0.5, 6);
    expect(sicknessCap([])).toBe(0);
  });
  it('bandwidth throttles H by the sickness cap', () => {
    expect(bandwidth(80, 0)).toBe(80);
    expect(bandwidth(80, 1)).toBeCloseTo(40, 6);
  });
});

describe('probe rotation', () => {
  it('is deterministic per 8h window and cycles all 4 groups', () => {
    expect(activeProbeGroup(0)).toEqual(PROBE_GROUPS[0]);
    expect(activeProbeGroup(ENGINE_TUNING.TTL_MS)).toEqual(PROBE_GROUPS[1]);
    expect(activeProbeGroup(4 * ENGINE_TUNING.TTL_MS)).toEqual(PROBE_GROUPS[0]);
  });
  it('fires exactly 3 probes per group', () => {
    for (const g of PROBE_GROUPS) expect(g).toHaveLength(3);
  });
});

describe('ecocide injection math', () => {
  it('growth offset: 0 at H=0, 0.5pp at H=100, clamped outside range', () => {
    expect(healingGrowthOffset(0)).toBe(0);
    expect(healingGrowthOffset(100)).toBeCloseTo(0.5, 6);
    expect(healingGrowthOffset(50)).toBeCloseTo(0.25, 6);
    expect(healingGrowthOffset(150)).toBeCloseTo(0.5, 6);
    expect(healingGrowthOffset(-10)).toBe(0);
  });
  it('SARG lift: +15% max, ceiling 10, identity at H=0', () => {
    expect(healingSargLift(5, 0)).toBe(5);
    expect(healingSargLift(5, 100)).toBeCloseTo(5.75, 6);
    expect(healingSargLift(10, 100)).toBe(10);
  });
});

describe('postUrl', () => {
  it('builds the bsky.app profile/post URL from the at:// uri rkey', () => {
    expect(postUrl(post())).toBe('https://bsky.app/profile/gardener.bsky.social/post/3k1');
  });
});

describe('lexicon sanity', () => {
  it('healing lexicon recognises the probe themes', () => {
    for (const term of ['mutual aid', 'rewild', 'permaculture', 'seed library']) {
      expect(lexiconScore(`we love ${term} here`, HEALING_LEXICON)).toBeGreaterThan(0);
    }
  });
});
