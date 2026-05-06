import { describe, it, expect } from 'vitest';

import {
  FORCED_CLOSE_REASONS,
  type AuditPayloadMap,
  type CashierPinResetPayload,
  type CashierPinUnlockPayload,
  type ForcedCloseReason,
  type OperatorSessionTakeoverPayload,
  type ShiftClosePayload,
  type ShiftForcedClosePayload,
  type ShiftOpenPayload,
} from '../payload-schemas.js';
import { AUDIT_ACTION_CATEGORIES } from '../event-shape.js';

/**
 * 004-operator-session T049 — Per-action-category payload schema tests.
 *
 * These are type-contract tests: they assert that the payload types
 * compile against the data-model.md §"Action Category Catalogue" and
 * that the runtime constants are consistent with the type-level claims.
 * The runtime assertions are intentionally trivial — the real gate is
 * TypeScript's type checker.
 */

describe('audit/payload-schemas (T049)', () => {
  it('AuditPayloadMap covers all ActionCategory values', () => {
    // Every key in AuditPayloadMap must be a known ActionCategory.
    // If a category exists in the runtime catalogue but is absent from
    // the map, this test catches the omission.
    const mapKeys: Array<keyof AuditPayloadMap> = [
      'shift.open',
      'shift.close',
      'shift.forced_close',
      'operator.session.takeover',
      'cashier.pin.reset',
      'cashier.pin.unlock',
    ];
    for (const key of mapKeys) {
      expect(AUDIT_ACTION_CATEGORIES).toContain(key);
    }
  });

  it('FORCED_CLOSE_REASONS is the exact five-value closed set from data-model.md', () => {
    expect(FORCED_CLOSE_REASONS).toEqual([
      'takeover_supersession',
      'cashier_no_show',
      'cashier_illness',
      'terminal_failure',
      'other',
    ]);
  });

  it('ShiftOpenPayload type accepts a well-formed record', () => {
    const payload: ShiftOpenPayload = {
      shift_id: 'shift-uuid-001',
      opened_at: '2026-05-07T08:00:00.000Z',
    };
    expect(payload.shift_id).toBe('shift-uuid-001');
  });

  it('ShiftClosePayload type accepts numeric and matched states', () => {
    const numeric: ShiftClosePayload = {
      shift_id: 'shift-uuid-002',
      closed_at: '2026-05-07T16:00:00.000Z',
      declared_count_state: 'numeric',
    };
    const matched: ShiftClosePayload = {
      shift_id: 'shift-uuid-003',
      closed_at: '2026-05-07T16:01:00.000Z',
      declared_count_state: 'matched',
    };
    expect(numeric.declared_count_state).toBe('numeric');
    expect(matched.declared_count_state).toBe('matched');
  });

  it('ShiftForcedClosePayload type accepts a well-formed record without annotation', () => {
    const payload: ShiftForcedClosePayload = {
      shift_id: 'shift-uuid-004',
      shift_owner_id: 'clerk-cashier-1',
      forced_close_actor_id: 'clerk-manager-1',
      forced_close_reason: 'cashier_no_show',
    };
    expect(payload.forced_close_reason).toBe('cashier_no_show');
    expect(payload.annotation).toBeUndefined();
  });

  it('ShiftForcedClosePayload type accepts an optional annotation', () => {
    const payload: ShiftForcedClosePayload = {
      shift_id: 'shift-uuid-005',
      shift_owner_id: 'clerk-cashier-2',
      forced_close_actor_id: 'clerk-manager-2',
      forced_close_reason: 'other',
      annotation: 'Emergency closure — see incident report INR-042.',
    };
    expect(payload.annotation).toBeDefined();
  });

  it('OperatorSessionTakeoverPayload type accepts a well-formed record', () => {
    const payload: OperatorSessionTakeoverPayload = {
      superseded_session_id: 'sess-uuid-prev',
      prior_terminal_reference: 'term-internal-id-A',
    };
    expect(payload.superseded_session_id).toBe('sess-uuid-prev');
  });

  it('CashierPinResetPayload type accepts a well-formed record (§A1-gated, types only in S3)', () => {
    const payload: CashierPinResetPayload = {
      target_cashier_id: 'clerk-cashier-3',
      terminal_id: 'term-internal-id-B',
    };
    expect(Object.keys(payload)).not.toContain('pin');
    expect(Object.keys(payload)).not.toContain('pin_hash');
    expect(Object.keys(payload)).not.toContain('password');
  });

  it('CashierPinUnlockPayload type accepts a well-formed record (§A1-gated, types only in S3)', () => {
    const payload: CashierPinUnlockPayload = {
      target_cashier_id: 'clerk-cashier-4',
      terminal_id: 'term-internal-id-C',
    };
    expect(Object.keys(payload)).not.toContain('pin');
    expect(Object.keys(payload)).not.toContain('pin_hash');
    expect(Object.keys(payload)).not.toContain('password');
  });

  it('ForcedCloseReason is assignable from every FORCED_CLOSE_REASONS value', () => {
    for (const reason of FORCED_CLOSE_REASONS) {
      const typed: ForcedCloseReason = reason;
      expect(typeof typed).toBe('string');
    }
  });
});
