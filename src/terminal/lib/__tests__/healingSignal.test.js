import { describe, it, expect, beforeEach } from 'vitest';
import {
  publishHealing, readHealing, subscribeHealing,
  HEALING_STORAGE_KEY, HEALING_EXPIRY_MS, _resetHealingForTests,
} from '../healingSignal';

const NOW = Date.parse('2026-07-07T12:00:00Z');

describe('healingSignal', () => {
  beforeEach(() => _resetHealingForTests());

  it('publish → read round-trip keeps only the healing payload fields', () => {
    publishHealing({ healingIndex: 62, bandwidth: 55, harvestedAt: NOW, signals: [{ big: 'blob' }] });
    const sig = readHealing(NOW + 1000);
    expect(sig).toEqual({ healingIndex: 62, bandwidth: 55, harvestedAt: NOW });
  });

  it('expires after 24h — a dead harvest cannot prop up the biosphere', () => {
    publishHealing({ healingIndex: 62, bandwidth: 55, harvestedAt: NOW });
    expect(readHealing(NOW + HEALING_EXPIRY_MS + 1)).toBeNull();
  });

  it('returns null for absent or garbage storage', () => {
    expect(readHealing(NOW)).toBeNull();
    localStorage.setItem(HEALING_STORAGE_KEY, '{broken');
    expect(readHealing(NOW)).toBeNull();
  });

  it('notifies live subscribers and honors unsubscribe', () => {
    const seen = [];
    const off = subscribeHealing(s => seen.push(s));
    publishHealing({ healingIndex: 10, bandwidth: 10, harvestedAt: NOW });
    off();
    publishHealing({ healingIndex: 20, bandwidth: 20, harvestedAt: NOW });
    expect(seen).toHaveLength(1);
    expect(seen[0].healingIndex).toBe(10);
  });
});
