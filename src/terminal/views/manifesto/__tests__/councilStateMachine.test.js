import { describe, it, expect } from 'vitest';
import { initialCouncilState, councilReducer } from '../councilStateMachine';

describe('councilReducer', () => {
  it('AMBIENT + NODE_CLICK → ARMED with that mind', () => {
    const s = councilReducer(initialCouncilState, { type: 'NODE_CLICK', dimIndex: 3 });
    expect(s).toEqual({ mode: 'ARMED', armedDim: 3, pair: null, record: null });
  });

  it('ARMED + click same node → AMBIENT (disarm)', () => {
    let s = councilReducer(initialCouncilState, { type: 'NODE_CLICK', dimIndex: 3 });
    s = councilReducer(s, { type: 'NODE_CLICK', dimIndex: 3 });
    expect(s.mode).toBe('AMBIENT');
    expect(s.armedDim).toBeNull();
  });

  it('ARMED + click different node → FIRING with ordered pair', () => {
    let s = councilReducer(initialCouncilState, { type: 'NODE_CLICK', dimIndex: 3 });
    s = councilReducer(s, { type: 'NODE_CLICK', dimIndex: 9 });
    expect(s).toEqual({ mode: 'FIRING', armedDim: null, pair: [3, 9], record: null });
  });

  it('FIRING ignores node clicks (input lock)', () => {
    let s = { mode: 'FIRING', armedDim: null, pair: [3, 9], record: null };
    expect(councilReducer(s, { type: 'NODE_CLICK', dimIndex: 1 })).toBe(s);
  });

  it('FIRING + SYNTHESIS_READY → SYNTHESIZED carrying the record', () => {
    let s = { mode: 'FIRING', armedDim: null, pair: [3, 9], record: null };
    s = councilReducer(s, { type: 'SYNTHESIS_READY', record: { id: 'r1' } });
    expect(s.mode).toBe('SYNTHESIZED');
    expect(s.record.id).toBe('r1');
    expect(s.pair).toEqual([3, 9]);
  });

  it('SYNTHESIZED + NODE_CLICK → ARMED (new cycle), record retained until replaced', () => {
    let s = { mode: 'SYNTHESIZED', armedDim: null, pair: [3, 9], record: { id: 'r1' } };
    s = councilReducer(s, { type: 'NODE_CLICK', dimIndex: 5 });
    expect(s.mode).toBe('ARMED');
    expect(s.armedDim).toBe(5);
    expect(s.record).toEqual({ id: 'r1' }); // panel persists while re-arming
  });

  it('RESET from any state → AMBIENT, everything cleared', () => {
    for (const from of [
      initialCouncilState,
      { mode: 'ARMED', armedDim: 2, pair: null, record: null },
      { mode: 'SYNTHESIZED', armedDim: null, pair: [1, 2], record: { id: 'r' } },
    ]) {
      expect(councilReducer(from, { type: 'RESET' })).toEqual(initialCouncilState);
    }
  });

  it('ARMED + TIMEOUT → AMBIENT; other states ignore TIMEOUT', () => {
    const armed = { mode: 'ARMED', armedDim: 2, pair: null, record: null };
    expect(councilReducer(armed, { type: 'TIMEOUT' }).mode).toBe('AMBIENT');
    const synth = { mode: 'SYNTHESIZED', armedDim: null, pair: [1, 2], record: { id: 'r' } };
    expect(councilReducer(synth, { type: 'TIMEOUT' })).toBe(synth);
  });

  it('HYDRATE replaces state wholesale', () => {
    const s = councilReducer(initialCouncilState, {
      type: 'HYDRATE',
      state: { mode: 'SYNTHESIZED', armedDim: null, pair: [0, 4], record: { id: 'x' } },
    });
    expect(s.mode).toBe('SYNTHESIZED');
    expect(s.record.id).toBe('x');
  });
});
