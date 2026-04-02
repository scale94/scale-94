// Ledger Event Bus — cross-tab verdict notifications
// Follows the same pattern as colliderBus and ecocideBus.

export const ledgerBus = {
  _listeners: [],
  _pending: [],
  emit(data) {
    this._listeners.forEach(fn => fn(data));
    if (data.type === 'VERDICT_ISSUED') this._pending.push(data);
  },
  on(fn) {
    this._listeners.push(fn);
    if (this._pending.length) {
      const queue = [...this._pending];
      this._pending = [];
      queue.forEach(d => fn(d));
    }
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },
};
