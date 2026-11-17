import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrivacyDrawer } from '../usePrivacyDrawer';
import { getTotals, _resetForTests } from '../../../observatory/observatoryBus';

const privacyVisits = () => getTotals().gaze.tabsVisited?.privacy || 0;

describe('usePrivacyDrawer', () => {
  let handleNav;
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    handleNav = vi.fn();
  });
  afterEach(() => vi.useRealTimers());

  const mount = (activeTab = 'kernel') =>
    renderHook((props) => usePrivacyDrawer(props), { initialProps: { handleNav, activeTab } });

  it('g p / the command: goes to /SURVEILLANCE, opens, asks for focus, one visit', () => {
    const { result } = mount();
    act(() => { result.current.openPrivacy(); });
    act(() => { vi.runAllTimers(); });
    expect(handleNav).toHaveBeenCalledWith('~/system/surveillance', 'surveillance');
    expect(result.current.privacyOpen).toBe(true);
    expect(result.current.privacyFocusToken).toBe(1);
    expect(privacyVisits()).toBe(1);
  });

  it('asking again while open is not another visit', () => {
    const { result, rerender } = mount();
    act(() => { result.current.openPrivacy(); });
    rerender({ handleNav, activeTab: 'surveillance' });
    act(() => { result.current.openPrivacy(); });
    act(() => { result.current.onPrivacyOpenChange(true); });
    act(() => { vi.runAllTimers(); });
    expect(privacyVisits()).toBe(1);
    expect(result.current.privacyFocusToken).toBe(2);
  });

  it('close then reopen with the button is a second visit', () => {
    const { result } = mount('surveillance');
    act(() => { result.current.onPrivacyOpenChange(true); });
    act(() => { result.current.onPrivacyOpenChange(false); });
    act(() => { result.current.onPrivacyOpenChange(true); });
    act(() => { vi.runAllTimers(); });
    expect(privacyVisits()).toBe(2);
    expect(result.current.privacyOpen).toBe(true);
  });

  it('leaving /SURVEILLANCE closes it; coming back and opening is a new visit', () => {
    const { result, rerender } = mount('surveillance');
    act(() => { result.current.onPrivacyOpenChange(true); });
    rerender({ handleNav, activeTab: 'sol' });
    expect(result.current.privacyOpen).toBe(false);
    rerender({ handleNav, activeTab: 'surveillance' });
    act(() => { result.current.onPrivacyOpenChange(true); });
    act(() => { vi.runAllTimers(); });
    expect(privacyVisits()).toBe(2);
  });

  it('clearPrivacyFocus resets the token', () => {
    const { result } = mount();
    act(() => { result.current.openPrivacy(); });
    act(() => { result.current.clearPrivacyFocus(); });
    expect(result.current.privacyFocusToken).toBe(0);
  });
});
