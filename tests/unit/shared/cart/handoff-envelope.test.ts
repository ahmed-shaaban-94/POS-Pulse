import { describe, it, expect } from 'vitest';
import {
  freezeEnvelope,
  type PaymentIntentEnvelope,
  type LineSnapshot,
  type DiscountPlaceholderSnapshot,
} from '../../../../src/shared/cart/handoff-envelope.js';

function makeLineSnapshot(overrides?: Partial<LineSnapshot>): LineSnapshot {
  return {
    line_id: 'line-uuid-1',
    item_ref: 'SKU-001',
    display_name: 'Aspirin 500mg',
    quantity: 2,
    unit_price_minor: 150,
    line_subtotal_minor: 300,
    note: null,
    version: 1,
    last_action_id: 'action-uuid-1',
    ...overrides,
  };
}

function makeDiscountSnapshot(
  overrides?: Partial<DiscountPlaceholderSnapshot>,
): DiscountPlaceholderSnapshot {
  return {
    placeholder_id: 'placeholder-uuid-1',
    line_id: 'line-uuid-1',
    placeholder_kind: 'STAFF_10PCT',
    requires_manager_attribution: false,
    attribution_operator_id: null,
    ...overrides,
  };
}

function makeEnvelope(overrides?: Partial<PaymentIntentEnvelope>): PaymentIntentEnvelope {
  return {
    envelope_version: 'v1',
    cart_id: 'cart-uuid-1',
    operator_session_id: 'session-uuid-1',
    owning_operator_id: 'operator-id-1',
    tenant_id: 'tenant-id-1',
    branch_id: 'branch-id-1',
    terminal_id: 'terminal-id-1',
    lines: [makeLineSnapshot()],
    discount_placeholders: [],
    subtotal_minor: 300,
    created_at: '2026-05-14T10:00:00.000Z',
    handoff_action_id: 'action-uuid-handoff-1',
    ...overrides,
  };
}

describe('PaymentIntentEnvelope type shape', () => {
  it('has envelope_version = "v1"', () => {
    const env = makeEnvelope();
    expect(env.envelope_version).toBe('v1');
  });

  it('carries all required top-level fields', () => {
    const env = makeEnvelope();
    const required: (keyof PaymentIntentEnvelope)[] = [
      'envelope_version',
      'cart_id',
      'operator_session_id',
      'owning_operator_id',
      'tenant_id',
      'branch_id',
      'terminal_id',
      'lines',
      'discount_placeholders',
      'subtotal_minor',
      'created_at',
      'handoff_action_id',
    ];
    for (const field of required) {
      expect(env).toHaveProperty(field);
    }
  });

  it('subtotal_minor is an integer', () => {
    const env = makeEnvelope({ subtotal_minor: 300 });
    expect(Number.isInteger(env.subtotal_minor)).toBe(true);
  });

  it('line unit_price_minor is an integer', () => {
    const line = makeLineSnapshot({ unit_price_minor: 150 });
    expect(Number.isInteger(line.unit_price_minor)).toBe(true);
  });

  it('line line_subtotal_minor is an integer', () => {
    const line = makeLineSnapshot({ line_subtotal_minor: 300 });
    expect(Number.isInteger(line.line_subtotal_minor)).toBe(true);
  });

  it('line note can be null', () => {
    const line = makeLineSnapshot({ note: null });
    expect(line.note).toBeNull();
  });

  it('line note can be a string', () => {
    const line = makeLineSnapshot({ note: 'No substitutions' });
    expect(typeof line.note).toBe('string');
  });

  it('discount placeholder attribution_operator_id can be null', () => {
    const d = makeDiscountSnapshot({ attribution_operator_id: null });
    expect(d.attribution_operator_id).toBeNull();
  });

  it('envelope can have empty discount_placeholders array', () => {
    const env = makeEnvelope({ discount_placeholders: [] });
    expect(env.discount_placeholders).toHaveLength(0);
  });
});

describe('freezeEnvelope', () => {
  it('returns an object where Object.isFrozen is true at the top level', () => {
    const env = makeEnvelope();
    const frozen = freezeEnvelope(env);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it('freezes the lines array', () => {
    const env = makeEnvelope();
    const frozen = freezeEnvelope(env);
    expect(Object.isFrozen(frozen.lines)).toBe(true);
  });

  it('freezes each LineSnapshot object inside lines', () => {
    const env = makeEnvelope({
      lines: [makeLineSnapshot(), makeLineSnapshot({ line_id: 'line-2' })],
    });
    const frozen = freezeEnvelope(env);
    for (const line of frozen.lines) {
      expect(Object.isFrozen(line)).toBe(true);
    }
  });

  it('freezes the discount_placeholders array', () => {
    const env = makeEnvelope({
      discount_placeholders: [makeDiscountSnapshot()],
    });
    const frozen = freezeEnvelope(env);
    expect(Object.isFrozen(frozen.discount_placeholders)).toBe(true);
  });

  it('freezes each DiscountPlaceholderSnapshot inside discount_placeholders', () => {
    const env = makeEnvelope({
      discount_placeholders: [makeDiscountSnapshot()],
    });
    const frozen = freezeEnvelope(env);
    for (const d of frozen.discount_placeholders) {
      expect(Object.isFrozen(d)).toBe(true);
    }
  });

  it('throws or silently fails when mutating a frozen top-level field (strict mode)', () => {
    const env = makeEnvelope();
    const frozen = freezeEnvelope(env);
    expect(() => {
      'use strict';
      (frozen as Record<string, unknown>)['cart_id'] = 'mutated';
    }).toThrow();
  });

  it('returns the same shape after freezing', () => {
    const env = makeEnvelope();
    const frozen = freezeEnvelope(env);
    expect(frozen.cart_id).toBe(env.cart_id);
    expect(frozen.subtotal_minor).toBe(env.subtotal_minor);
    expect(frozen.lines[0]?.line_id).toBe(env.lines[0]?.line_id);
  });

  it('handles an envelope with empty lines and empty placeholders', () => {
    const env = makeEnvelope({ lines: [], discount_placeholders: [] });
    const frozen = freezeEnvelope(env);
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.lines)).toBe(true);
    expect(Object.isFrozen(frozen.discount_placeholders)).toBe(true);
  });
});
