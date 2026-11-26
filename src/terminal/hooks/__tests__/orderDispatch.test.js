import { describe, it, expect, beforeEach } from 'vitest';
import { recordDispatchedOrder, getStoredHash } from '../useOrderStatus';

beforeEach(() => localStorage.clear());

describe('recordDispatchedOrder', () => {
  it.each([[{ ok: true, status: 201 }], [{ ok: false, status: 409 }]])(
    'remembers the hash when the server holds the order (%o)', (res) => {
      recordDispatchedOrder(res, 'abc');
      expect(getStoredHash(null)).toBe('abc');
    });

  it.each([[400], [413], [429], [500]])('does not remember a rejected order (%i)', (status) => {
    recordDispatchedOrder({ ok: false, status }, 'abc');
    expect(getStoredHash(null)).toBeNull();
  });
});
