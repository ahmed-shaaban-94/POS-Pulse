/**
 * T093 — 008 audit category extension test (RED).
 *
 * Asserts the 10 new 008 categories (per AD-9 + tasks.md §"Canonical audit
 * action categories") are present in the shared closed-set tuple
 * `AUDIT_ACTION_CATEGORIES` in `src/shared/audit/event-shape.ts`. Until they
 * are appended there, TypeScript will refuse to compile any audit-emitter
 * call site that uses one of these strings as an `action_category` — so this
 * runtime tuple check doubles as the gate.
 *
 * Migration 0026 is intentionally a no-op SELECT 1 (audit_events.action_category
 * is open-set at the SQL layer; the closed-set enforcement lives at the
 * emitter type). This test is therefore the canonical proof that the
 * type-level extension landed.
 */

import { describe, expect, it } from 'vitest';
import { AUDIT_ACTION_CATEGORIES } from '../../../../src/shared/audit/event-shape.js';

const REQUIRED_008_CATEGORIES = [
  'sale.finalized',
  'sale.finalization_refused',
  'sale.receipt.printed',
  'sale.receipt.reprinted',
  'sale.receipt.print_failed',
  'sale.receipt.print_retried_success',
  'sale.receipt.manual_override',
  'sale.drawer.opened',
  'sale.drawer.suppressed',
  'sale.drawer.failed',
] as const;

describe('T093 — AUDIT_ACTION_CATEGORIES includes the 10 new 008 categories', () => {
  for (const category of REQUIRED_008_CATEGORIES) {
    it(`includes "${category}"`, () => {
      expect((AUDIT_ACTION_CATEGORIES as readonly string[]).includes(category)).toBe(true);
    });
  }

  it('AUDIT_ACTION_CATEGORIES is non-shrinking — all prior categories still present', () => {
    // Defence against accidental tuple replacement that would silently
    // remove 004/005/006 categories.
    const priorCategories = [
      'shift.open',
      'shift.close',
      'shift.forced_close',
      'operator.session.takeover',
      'cashier.pin.reset',
      'cashier.pin.unlock',
      'cart.handoff_to_payment',
      'cart.cancel.post_handoff',
      'cart.discount.above_threshold',
      'cart.discarded_on_session_end',
    ] as const;
    for (const prior of priorCategories) {
      expect((AUDIT_ACTION_CATEGORIES as readonly string[]).includes(prior)).toBe(true);
    }
  });
});
