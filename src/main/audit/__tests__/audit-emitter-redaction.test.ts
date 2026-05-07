/**
 * T044 — Unit tests: AuditEmitter refuses forbidden payload field names.
 *
 * PR-1 / FR-027: credential fragments, PIN values, card data, Clerk JWTs, and
 * session tokens MUST NOT appear in any audit payload field, at any nesting
 * depth.
 *
 * The emitter performs a recursive key walk before delegating to the store.
 * These tests cover: top-level keys, nested objects, deeply nested objects,
 * and arrays containing objects with forbidden keys. Clean payloads must pass.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AuditEmitter,
  ForbiddenPayloadKeyError,
  FORBIDDEN_PAYLOAD_KEYS,
  type AuditEventsStore,
} from '../audit-emitter.js';
import type { AuditEvent } from '../../../shared/audit/event-shape.js';

/** Minimal valid event — payload is overridden per test. */
const BASE_EVENT: AuditEvent = {
  event_id: 'evt-redact-0001',
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

function makeFakeStore(): { store: AuditEventsStore; insertIgnore: ReturnType<typeof vi.fn> } {
  const insertIgnore = vi.fn();
  return { store: { insertIgnore }, insertIgnore };
}

function emitWith(payload: Record<string, unknown>): void {
  const { store } = makeFakeStore();
  const emitter = new AuditEmitter(store);
  emitter.emit({ ...BASE_EVENT, payload });
}

describe('AuditEmitter — forbidden payload field names (T044)', () => {
  it('empty payload {} is clean', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    expect(() => {
      emitter.emit({ ...BASE_EVENT, payload: {} });
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });

  it('clean domain payload passes validation', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    const event: AuditEvent = {
      ...BASE_EVENT,
      payload: { shift_id: 'shift-1', opened_at: '2026-05-07T09:00:00.000Z' },
    };
    expect(() => {
      emitter.emit(event);
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });

  // Test every forbidden key at the top level.
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    it(`rejects top-level forbidden key '${key}'`, () => {
      expect(() => {
        emitWith({ [key]: 'value' });
      }).toThrow(ForbiddenPayloadKeyError);
    });

    it(`ForbiddenPayloadKeyError.key is '${key}' for top-level hit`, () => {
      let caught: unknown;
      try {
        emitWith({ [key]: 'value' });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ForbiddenPayloadKeyError);
      expect((caught as ForbiddenPayloadKeyError).key).toBe(key);
    });
  }

  it('rejects forbidden key nested one level deep', () => {
    expect(() => {
      emitWith({ meta: { pin: '1234' } });
    }).toThrow(ForbiddenPayloadKeyError);
  });

  it('rejects forbidden key nested two levels deep', () => {
    expect(() => {
      emitWith({ outer: { inner: { password_hash: 'hashed' } } });
    }).toThrow(ForbiddenPayloadKeyError);
  });

  it('rejects forbidden key inside an array element', () => {
    expect(() => {
      emitWith({ items: [{ token: 'abc' }, { safe: 'yes' }] });
    }).toThrow(ForbiddenPayloadKeyError);
  });

  it('rejects forbidden key inside a deeply nested array element', () => {
    expect(() => {
      emitWith({ level1: { level2: [{ level3: { secret: 'shh' } }] } });
    }).toThrow(ForbiddenPayloadKeyError);
  });

  it('clean key whose value happens to be "pin" string is not rejected (value check, not value)', () => {
    // Only key names are forbidden, not values that happen to contain a
    // forbidden word. A field named "annotation" with value "pin policy"
    // is perfectly safe.
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    expect(() => {
      emitter.emit({ ...BASE_EVENT, payload: { annotation: 'pin policy applies' } });
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });

  it('does not call store.insertIgnore when payload is rejected', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    try {
      emitter.emit({ ...BASE_EVENT, payload: { pin: '0000' } });
    } catch {
      // expected
    }
    expect(insertIgnore).not.toHaveBeenCalled();
  });

  it('array containing only clean objects is permitted', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    expect(() => {
      emitter.emit({
        ...BASE_EVENT,
        payload: {
          tags: [{ label: 'forced_close' }, { label: 'supervisor_approved' }],
        },
      });
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });

  it('null values inside payload tree do not crash the walker', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    expect(() => {
      emitter.emit({
        ...BASE_EVENT,
        payload: { annotation: null, meta: null },
      });
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });

  it('numeric values inside payload tree do not crash the walker', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    expect(() => {
      emitter.emit({
        ...BASE_EVENT,
        payload: { count: 42, rate: 3.14 },
      });
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });
});
