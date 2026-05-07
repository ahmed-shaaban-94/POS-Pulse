/**
 * T039 — Unit tests: AuditEmitter rejects events missing FR-025 mandatory
 * attributes.
 *
 * FR-025 requires five attributes to be present on every audit event:
 *   acting_operator_id, originating_terminal_id, created_at,
 *   action_category, shift_id.
 *
 * "Present" means the key exists on the object — a null value is valid (e.g.
 * shift_id is nullable for non-shift-scoped categories). Only absence of the
 * key itself is rejected.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AuditEmitter,
  MissingMandatoryAttributeError,
  type AuditEventsStore,
} from '../audit-emitter.js';
import type { AuditEvent } from '../../../shared/audit/event-shape.js';
import { FR025_MANDATORY_ATTRIBUTES } from '../../../shared/audit/event-shape.js';

/** Minimal valid event — all FR-025 keys present, payload clean. */
const VALID_EVENT: AuditEvent = {
  event_id: 'evt-0001',
  tenant_id: 'tenant-A',
  branch_id: 'branch-1',
  originating_terminal_id: 'term-1',
  acting_operator_id: 'clerk-user-1',
  session_id: null,
  shift_id: null, // nullable — key is present, value is null → valid
  action_category: 'shift.open',
  created_at: '2026-05-07T10:00:00.000Z',
  approving_supervisor_id: null,
  payload: {},
};

function makeFakeStore(): { store: AuditEventsStore; insertIgnore: ReturnType<typeof vi.fn> } {
  const insertIgnore = vi.fn();
  return { store: { insertIgnore }, insertIgnore };
}

describe('AuditEmitter — FR-025 mandatory attribute validation (T039)', () => {
  it('emits successfully when all mandatory attributes are present', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    expect(() => {
      emitter.emit(VALID_EVENT);
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
    expect(insertIgnore).toHaveBeenCalledWith(VALID_EVENT);
  });

  it('shift_id = null is valid (key present, value nullable)', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    const event: AuditEvent = { ...VALID_EVENT, shift_id: null };
    expect(() => {
      emitter.emit(event);
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });

  it('shift_id = non-null string is valid', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    const event: AuditEvent = { ...VALID_EVENT, shift_id: 'shift-42' };
    expect(() => {
      emitter.emit(event);
    }).not.toThrow();
    expect(insertIgnore).toHaveBeenCalledOnce();
  });

  // Test all five FR-025 mandatory keys individually.
  for (const attr of FR025_MANDATORY_ATTRIBUTES) {
    it(`throws MissingMandatoryAttributeError when '${attr}' is absent`, () => {
      const { store, insertIgnore } = makeFakeStore();
      const emitter = new AuditEmitter(store);

      // Remove the key entirely (not set to null — key absence is what we test).
      const { [attr]: _removed, ...eventWithout } = VALID_EVENT;
      void _removed;

      expect(() => {
        emitter.emit(eventWithout as AuditEvent);
      }).toThrow(MissingMandatoryAttributeError);
      expect(insertIgnore).not.toHaveBeenCalled();
    });

    it(`MissingMandatoryAttributeError.attribute is '${attr}' when that key is absent`, () => {
      const { store } = makeFakeStore();
      const emitter = new AuditEmitter(store);
      const { [attr]: _removed, ...eventWithout } = VALID_EVENT;
      void _removed;

      let caught: unknown;
      try {
        emitter.emit(eventWithout as AuditEvent);
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(MissingMandatoryAttributeError);
      expect((caught as MissingMandatoryAttributeError).attribute).toBe(attr);
    });
  }

  it('does not call store.insertIgnore when validation fails', () => {
    const { store, insertIgnore } = makeFakeStore();
    const emitter = new AuditEmitter(store);
    const { acting_operator_id: _removed, ...eventWithout } = VALID_EVENT;
    void _removed;

    try {
      emitter.emit(eventWithout as AuditEvent);
    } catch {
      // expected
    }

    expect(insertIgnore).not.toHaveBeenCalled();
  });
});
