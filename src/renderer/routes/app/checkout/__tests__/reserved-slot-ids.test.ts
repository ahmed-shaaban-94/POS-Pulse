import { describe, it, expect } from 'vitest';

import { reservedSlotIds } from '../reserved-slot-ids';

/**
 * T049 — reserved-slot-ids: asserts the exported `reservedSlotIds` const equals
 * the eleven frozen ids in the contract, in the documented order.
 */
describe('reservedSlotIds (T049)', () => {
  const EXPECTED = [
    'tender.cash',
    'tender.card',
    'tender.bank-transfer',
    'tender.voucher',
    'tender.insurance',
    'tender.split',
    'totals.amount-due',
    'totals.amount-paid',
    'totals.remaining',
    'totals.change-due',
    'receipt.breakdown',
  ] as const;

  it('has exactly eleven members', () => {
    expect(reservedSlotIds).toHaveLength(11);
  });

  it('matches the documented order exactly', () => {
    expect([...reservedSlotIds]).toStrictEqual([...EXPECTED]);
  });

  it('contains no extra members beyond the eleven', () => {
    for (const id of reservedSlotIds) {
      expect(EXPECTED).toContain(id);
    }
  });

  it('receipt.breakdown keeps its receipt prefix (Plan §"Note B")', () => {
    expect(reservedSlotIds[10]).toBe('receipt.breakdown');
  });
});
