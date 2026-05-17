/**
 * T077 — Envelope immutability: Object.isFrozen and strict-mode throw.
 *
 * freezeEnvelope (from Phase 2 / T012) must produce an object where:
 *   - Object.isFrozen(envelope) === true
 *   - Object.isFrozen(envelope.lines) === true
 *   - Object.isFrozen(each LineSnapshot) === true
 *   - Object.isFrozen(envelope.discount_placeholders) === true
 *   - Object.isFrozen(each DiscountPlaceholderSnapshot) === true
 *   - Mutation attempts throw in strict mode (TypeScript modules run strict)
 */
import { describe, it, expect } from 'vitest';
import {
  freezeEnvelope,
  type PaymentIntentEnvelope,
  type LineSnapshot,
  type DiscountPlaceholderSnapshot,
} from '../../../../src/shared/cart/handoff-envelope.js';

function makeLine(overrides?: Partial<LineSnapshot>): LineSnapshot {
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

function makeDiscount(
  overrides?: Partial<DiscountPlaceholderSnapshot>,
): DiscountPlaceholderSnapshot {
  return {
    placeholder_id: 'ph-uuid-1',
    line_id: 'line-uuid-1',
    placeholder_kind: 'percent_5',
    requires_manager_attribution: false,
    attribution_operator_id: null,
    ...overrides,
  };
}

function makeEnvelope(overrides?: Partial<PaymentIntentEnvelope>): PaymentIntentEnvelope {
  return {
    envelope_version: 'v1',
    cart_id: 'cart-uuid-1',
    operator_session_id: 'sess-uuid-1',
    owning_operator_id: 'op-uuid-1',
    tenant_id: 'tenant-uuid-1',
    branch_id: 'branch-uuid-1',
    terminal_id: 'terminal-uuid-1',
    lines: [makeLine()],
    discount_placeholders: [],
    subtotal_minor: 300,
    created_at: '2026-05-17T10:00:00.000Z',
    handoff_action_id: 'action-uuid-handoff-1',
    ...overrides,
  };
}

describe('freezeEnvelope — immutability (T077)', () => {
  it('Object.isFrozen(envelope) === true after freeze', () => {
    const frozen = freezeEnvelope(makeEnvelope());
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it('Object.isFrozen(envelope.lines) === true after freeze', () => {
    const frozen = freezeEnvelope(makeEnvelope());
    expect(Object.isFrozen(frozen.lines)).toBe(true);
  });

  it('each LineSnapshot is frozen', () => {
    const frozen = freezeEnvelope(
      makeEnvelope({ lines: [makeLine(), makeLine({ line_id: 'line-2' })] }),
    );
    for (const line of frozen.lines) {
      expect(Object.isFrozen(line)).toBe(true);
    }
  });

  it('Object.isFrozen(envelope.discount_placeholders) === true after freeze', () => {
    const frozen = freezeEnvelope(makeEnvelope({ discount_placeholders: [makeDiscount()] }));
    expect(Object.isFrozen(frozen.discount_placeholders)).toBe(true);
  });

  it('each DiscountPlaceholderSnapshot is frozen', () => {
    const frozen = freezeEnvelope(
      makeEnvelope({
        discount_placeholders: [makeDiscount(), makeDiscount({ placeholder_id: 'ph-2' })],
      }),
    );
    for (const d of frozen.discount_placeholders) {
      expect(Object.isFrozen(d)).toBe(true);
    }
  });

  it('mutation of a top-level frozen field throws in strict mode', () => {
    const frozen = freezeEnvelope(makeEnvelope());
    expect(() => {
      'use strict';
      (frozen as Record<string, unknown>)['cart_id'] = 'mutated';
    }).toThrow();
  });

  it('mutation of a frozen line field throws in strict mode', () => {
    const frozen = freezeEnvelope(makeEnvelope({ lines: [makeLine()] }));
    expect(() => {
      'use strict';
      (frozen.lines[0] as Record<string, unknown>)['quantity'] = 999;
    }).toThrow();
  });

  it('mutation of a frozen discount placeholder field throws in strict mode', () => {
    const frozen = freezeEnvelope(makeEnvelope({ discount_placeholders: [makeDiscount()] }));
    expect(() => {
      'use strict';
      (frozen.discount_placeholders[0] as Record<string, unknown>)['placeholder_kind'] = 'mutated';
    }).toThrow();
  });

  it('handles empty lines and empty discount_placeholders without error', () => {
    const frozen = freezeEnvelope(makeEnvelope({ lines: [], discount_placeholders: [] }));
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(Object.isFrozen(frozen.lines)).toBe(true);
    expect(Object.isFrozen(frozen.discount_placeholders)).toBe(true);
  });

  it('frozen envelope retains all field values unchanged', () => {
    const env = makeEnvelope({ lines: [makeLine()], discount_placeholders: [makeDiscount()] });
    const frozen = freezeEnvelope(env);
    expect(frozen.cart_id).toBe(env.cart_id);
    expect(frozen.subtotal_minor).toBe(env.subtotal_minor);
    expect(frozen.lines[0]?.line_id).toBe(env.lines[0]?.line_id);
    expect(frozen.discount_placeholders[0]?.placeholder_id).toBe(
      env.discount_placeholders[0]?.placeholder_id,
    );
  });
});
