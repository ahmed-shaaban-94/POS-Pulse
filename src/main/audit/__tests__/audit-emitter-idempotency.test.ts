/**
 * T040 — Unit tests: AuditEmitter idempotency via INSERT OR IGNORE semantics.
 *
 * Emitting the same event twice (same event_id + tenant_id) must:
 *   1. Not throw on the second call.
 *   2. Result in exactly one row in the store (the second call is a no-op).
 *
 * The store fake tracks calls and deduplicates by (event_id, tenant_id) to
 * mirror the SQL `INSERT OR IGNORE` behaviour specified in AD-3.
 */

import { describe, it, expect } from 'vitest';
import { AuditEmitter, type AuditEventsStore } from '../audit-emitter.js';
import type { AuditEvent } from '../../../shared/audit/event-shape.js';

/** Minimal valid event used as the idempotency target. */
const BASE_EVENT: AuditEvent = {
  event_id: 'evt-idem-0001',
  tenant_id: 'tenant-A',
  branch_id: 'branch-1',
  originating_terminal_id: 'term-1',
  acting_operator_id: 'clerk-user-1',
  session_id: null,
  shift_id: null,
  action_category: 'shift.open',
  created_at: '2026-05-07T10:00:00.000Z',
  approving_supervisor_id: null,
  payload: {},
};

/**
 * Fake store that implements INSERT OR IGNORE semantics:
 * duplicate (event_id, tenant_id) is silently dropped.
 */
function makeIdempotentFakeStore(): {
  store: AuditEventsStore;
  rows: AuditEvent[];
  insertCalls: number;
} {
  const rows: AuditEvent[] = [];
  let insertCalls = 0;

  const store: AuditEventsStore = {
    insertIgnore(event: AuditEvent): void {
      insertCalls += 1;
      const exists = rows.some(
        (r) => r.event_id === event.event_id && r.tenant_id === event.tenant_id,
      );
      if (!exists) {
        rows.push(event);
      }
    },
  };

  return {
    store,
    rows,
    get insertCalls(): number {
      return insertCalls;
    },
  };
}

describe('AuditEmitter — idempotency (T040)', () => {
  it('emitting the same event twice does not throw', () => {
    const { store } = makeIdempotentFakeStore();
    const emitter = new AuditEmitter(store);
    emitter.emit(BASE_EVENT);
    expect(() => {
      emitter.emit(BASE_EVENT);
    }).not.toThrow();
  });

  it('emitting the same event twice results in exactly one stored row', () => {
    const { store, rows } = makeIdempotentFakeStore();
    const emitter = new AuditEmitter(store);
    emitter.emit(BASE_EVENT);
    emitter.emit(BASE_EVENT);
    expect(rows).toHaveLength(1);
  });

  it('store.insertIgnore is called twice but only one row is persisted', () => {
    const fake = makeIdempotentFakeStore();
    const emitter = new AuditEmitter(fake.store);
    emitter.emit(BASE_EVENT);
    emitter.emit(BASE_EVENT);
    // The emitter always delegates to the store — deduplication is the store's job.
    expect(fake.insertCalls).toBe(2);
    // But only one row survived.
    expect(fake.rows).toHaveLength(1);
  });

  it('different tenant_id with same event_id is treated as a distinct event', () => {
    const { store, rows } = makeIdempotentFakeStore();
    const emitter = new AuditEmitter(store);
    emitter.emit(BASE_EVENT);
    emitter.emit({ ...BASE_EVENT, tenant_id: 'tenant-B' });
    expect(rows).toHaveLength(2);
  });

  it('different event_id with same tenant_id is treated as a distinct event', () => {
    const { store, rows } = makeIdempotentFakeStore();
    const emitter = new AuditEmitter(store);
    emitter.emit(BASE_EVENT);
    emitter.emit({ ...BASE_EVENT, event_id: 'evt-idem-0002' });
    expect(rows).toHaveLength(2);
  });

  it('three emissions of the same event produce exactly one row', () => {
    const { store, rows } = makeIdempotentFakeStore();
    const emitter = new AuditEmitter(store);
    emitter.emit(BASE_EVENT);
    emitter.emit(BASE_EVENT);
    emitter.emit(BASE_EVENT);
    expect(rows).toHaveLength(1);
  });
});
