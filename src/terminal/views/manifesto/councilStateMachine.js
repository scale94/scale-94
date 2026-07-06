// Pure interaction reducer for the Council collider (spec §1).
// AMBIENT → ARMED → FIRING → SYNTHESIZED. No side effects here — the hook
// performs ledger appends / animations and dispatches results back in.

export const initialCouncilState = { mode: 'AMBIENT', armedDim: null, pair: null, record: null };

export function councilReducer(state, action) {
  switch (action.type) {
    case 'NODE_CLICK': {
      if (state.mode === 'FIRING') return state; // input lock during flight
      if (state.mode === 'ARMED') {
        if (action.dimIndex === state.armedDim) {
          return { ...state, mode: 'AMBIENT', armedDim: null }; // disarm
        }
        return { mode: 'FIRING', armedDim: null, pair: [state.armedDim, action.dimIndex], record: state.record };
      }
      // AMBIENT or SYNTHESIZED: arm (panel/record persists until replaced)
      return { ...state, mode: 'ARMED', armedDim: action.dimIndex, pair: null };
    }
    case 'SYNTHESIS_READY':
      if (state.mode !== 'FIRING') return state;
      return { ...state, mode: 'SYNTHESIZED', record: action.record };
    case 'TIMEOUT':
      return state.mode === 'ARMED' ? { ...state, mode: 'AMBIENT', armedDim: null } : state;
    case 'DISARM':
      return state.mode === 'ARMED' ? { ...state, mode: 'AMBIENT', armedDim: null } : state;
    case 'RESET':
      return initialCouncilState;
    case 'HYDRATE':
      // Spread over defaults so a partial payload can never yield an
      // inconsistent shape (e.g. pair: undefined instead of null).
      return { ...initialCouncilState, ...action.state };
    default:
      return state;
  }
}
