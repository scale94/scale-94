import { describe, it, expect, beforeEach } from 'vitest';
import { emit, getTotals, _resetForTests } from '../observatoryBus';

describe('gaze.tabsVisited', () => {
  beforeEach(() => _resetForTests());

  it('starts empty', () => {
    expect(getTotals().gaze.tabsVisited).toEqual({});
  });

  it('records distinct visited tabs with counts', () => {
    emit('gaze', 'tab_navigated', { tab: 'ecocide' });
    emit('gaze', 'tab_navigated', { tab: 'ecocide' });
    emit('gaze', 'tab_navigated', { tab: 'privacy' });
    expect(getTotals().gaze.tabsVisited).toEqual({ ecocide: 2, privacy: 1 });
  });

  it('ignores tab_navigated without a tab payload', () => {
    emit('gaze', 'tab_navigated', {});
    expect(getTotals().gaze.tabsVisited).toEqual({});
  });
});
