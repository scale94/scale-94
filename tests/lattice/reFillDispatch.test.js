import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommandDispatch } from '../../src/terminal/hooks/useCommandDispatch';

// Minimal ctx — re$$ill branch fires before WASM lookup, so most fields are unused.
function makeCtx(overrides = {}) {
  const logs = [];
  return {
    articles: [], classifiedSession: null, transmissionStories: [], tagIndex: {},
    systemArticles: {}, activeTab: 'kernel',
    setSystemLogs:   vi.fn((updater) => { if (typeof updater === 'function') logs.splice(0, logs.length, ...updater(logs)); }),
    setClassifiedSession: vi.fn(), setActiveTab: vi.fn(), setSelectedArticle: vi.fn(),
    setSearchFilter: vi.fn(), setCurrentPath: vi.fn(), setRelicMode: vi.fn(), setBreachOpen: vi.fn(),
    applyEcoCost: vi.fn(), applyRefill: vi.fn(() => ({ ok: true })),
    latticeState: { unlocked: true, lastRefillAt: 0 },
    setOriginTab: vi.fn(), setArchitectThesis: vi.fn(), setTagCloudView: vi.fn(),
    appendSystemLog: vi.fn((entry) => { logs.push(entry); }),
    handleNav: vi.fn(), handleKernelClick: vi.fn(), handleTransmissionSelect: vi.fn(),
    loadAbortRef: { current: null }, activeKernels: { current: {} },
    setKuramotoViz: vi.fn(), setAssociativeField: vi.fn(), setSpectralBridges: vi.fn(),
    setEnclaveKeys: vi.fn(), setProbeNode: vi.fn(), setBoneFusions: vi.fn(),
    fusionLog: [], setFusionLog: vi.fn(),
    ...overrides,
    _logs: logs,
  };
}

describe('re$$ill command branch', () => {
  it('calls applyRefill when unlocked and emits success log', () => {
    const ctx = makeCtx();
    const { result } = renderHook(() => useCommandDispatch(ctx));
    act(() => { result.current('run', 're$$ill', 'run re$$ill', '12:00:00', {}); });
    expect(ctx.applyRefill).toHaveBeenCalled();
    expect(ctx._logs.some(l => l.msg.includes('RE$$ILL') && l.msg.includes('100%'))).toBe(true);
  });

  it('logs RE$$ILL_LOCKED when applyRefill returns locked', () => {
    const ctx = makeCtx({ applyRefill: vi.fn(() => ({ ok: false, reason: 'locked' })) });
    const { result } = renderHook(() => useCommandDispatch(ctx));
    act(() => { result.current('run', 're$$ill', 'run re$$ill', '12:00:00', {}); });
    expect(ctx._logs.some(l => l.msg.includes('RE$$ILL_LOCKED'))).toBe(true);
  });

  it('logs cooldown with seconds remaining when applyRefill returns cooldown', () => {
    const ctx = makeCtx({ applyRefill: vi.fn(() => ({ ok: false, reason: 'cooldown', remainingMs: 23_400 })) });
    const { result } = renderHook(() => useCommandDispatch(ctx));
    act(() => { result.current('run', 're$$ill', 'run re$$ill', '12:00:00', {}); });
    const cd = ctx._logs.find(l => l.msg.includes('RE$$ILL_COOLDOWN'));
    expect(cd).toBeDefined();
    expect(cd.msg).toMatch(/24s remaining/); // 23.4s ceil → 24s
  });
});
