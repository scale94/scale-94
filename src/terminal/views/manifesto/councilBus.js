// Cross-tab event channel for Council Ring collisions — the hook the future
// final-compilation step subscribes to. Same pattern as colliderBus, with a
// bounded pending buffer: the ambient loop emits forever, so unbounded
// buffering would leak.
const PENDING_CAP = 32;

export const councilBus = {
  _listeners: [],
  _pending: [],
  emit(event) {
    if (this._listeners.length === 0) {
      this._pending.push(event);
      if (this._pending.length > PENDING_CAP) this._pending.shift();
      return;
    }
    this._listeners.forEach(fn => fn(event));
  },
  on(fn) {
    this._listeners.push(fn);
    if (this._pending.length) {
      const queue = this._pending;
      this._pending = [];
      queue.forEach(e => fn(e));
    }
    return () => { this._listeners = this._listeners.filter(f => f !== fn); };
  },
  _resetForTests() { this._listeners = []; this._pending = []; },
};
