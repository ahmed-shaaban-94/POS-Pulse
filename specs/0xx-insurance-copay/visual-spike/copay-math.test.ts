/**
 * copay-math.test.ts — proves the SPIKE arithmetic (round-once, no drift).
 *
 * ⚠️ SPIKE-ONLY. Lives under specs/, not src/. Run with:
 *   npx vitest run specs/0xx-insurance-copay/visual-spike/copay-math.test.ts
 */
import { describe, expect, it } from 'vitest';

import {
  canConfirm,
  computeCoPay,
  formatMinor,
  memberIdValid,
  methodLabel,
  type SpikeCartLine,
} from './copay-math.js';

// A mixed basket: 2 medicines (eligible) + 1 device (not).
const MIXED: readonly SpikeCartLine[] = [
  { display_name: 'Panadol', quantity: 2, unit_price_minor: 1550, eligible: true }, // 31.00
  { display_name: 'Amoxil', quantity: 1, unit_price_minor: 8900, eligible: true }, //  89.00
  { display_name: 'BP monitor', quantity: 1, unit_price_minor: 45000, eligible: false }, // 450.00
];
// total = 3100 + 8900 + 45000 = 57000 ; eligible = 12000 ; nonEligible = 45000

describe('computeCoPay — core arithmetic', () => {
  it('sums total and eligible correctly (minor units)', () => {
    const b = computeCoPay(MIXED, null, null);
    expect(b.total).toBe(57000);
    expect(b.eligible).toBe(12000);
    expect(b.nonEligible).toBe(45000);
  });

  it('rounds covered ONCE and derives patientDue by subtraction (no drift)', () => {
    // 80% of 12000 = 9600 exactly.
    const b = computeCoPay(MIXED, 80, null);
    expect(b.covered).toBe(9600);
    expect(b.patientDue).toBe(57000 - 9600);
    // The identity that prevents piaster drift:
    expect(b.covered + b.patientDue).toBe(b.total);
  });

  it('rounds half-up on a non-exact percentage and STILL sums to total', () => {
    // eligible 12000 @ 90% = 10800 ; @ 70% = 8400 ; pick a fractional case:
    // eligible 333 @ 50% = 166.5 → round half-up → 167.
    const frac: readonly SpikeCartLine[] = [
      { display_name: 'odd', quantity: 1, unit_price_minor: 333, eligible: true },
      { display_name: 'pad', quantity: 1, unit_price_minor: 1000, eligible: false },
    ];
    const b = computeCoPay(frac, 50, null);
    expect(b.covered).toBe(167);
    expect(b.patientDue).toBe(1333 - 167);
    expect(b.covered + b.patientDue).toBe(b.total); // identity holds
  });

  it('fully-covered: 100% all-medicine basket has no co-pay', () => {
    const allMeds: readonly SpikeCartLine[] = [
      { display_name: 'A', quantity: 1, unit_price_minor: 5000, eligible: true },
      { display_name: 'B', quantity: 1, unit_price_minor: 2500, eligible: true },
    ];
    const b = computeCoPay(allMeds, 100, null);
    expect(b.covered).toBe(7500);
    expect(b.patientDue).toBe(0);
    expect(b.fullyCovered).toBe(true);
  });

  it('no-eligible basket: covered 0, patient pays everything', () => {
    const allDevices: readonly SpikeCartLine[] = [
      { display_name: 'device', quantity: 1, unit_price_minor: 45000, eligible: false },
    ];
    const b = computeCoPay(allDevices, 80, null);
    expect(b.eligible).toBe(0);
    expect(b.covered).toBe(0);
    expect(b.patientDue).toBe(45000);
    expect(b.fullyCovered).toBe(false);
  });

  it('change is clamped at zero when under-tendered', () => {
    const b = computeCoPay(MIXED, 80, 40000); // patientDue 47400, under
    expect(b.change).toBe(0);
  });

  it('change = tendered − patientDue when met/over', () => {
    const b = computeCoPay(MIXED, 80, 50000); // patientDue 47400
    expect(b.change).toBe(2600);
  });
});

describe('gating + labels', () => {
  it('memberIdValid requires ≥ 4 trimmed chars', () => {
    expect(memberIdValid('   ')).toBe(false);
    expect(memberIdValid('AB')).toBe(false);
    expect(memberIdValid('UHI-1')).toBe(true);
  });

  it('canConfirm: blocked without plan or valid member', () => {
    const b = computeCoPay(MIXED, 80, 50000);
    expect(canConfirm(false, 'UHI-1234', b, 50000)).toBe(false);
    expect(canConfirm(true, 'AB', b, 50000)).toBe(false);
  });

  it('canConfirm: requires sufficient co-pay when patientDue > 0', () => {
    const b = computeCoPay(MIXED, 80, null);
    expect(canConfirm(true, 'UHI-1234', b, null)).toBe(false);
    expect(canConfirm(true, 'UHI-1234', b, 40000)).toBe(false); // under
    expect(canConfirm(true, 'UHI-1234', b, 47400)).toBe(true); // exact
  });

  it('canConfirm: fully-covered needs only a valid member', () => {
    const allMeds: readonly SpikeCartLine[] = [
      { display_name: 'A', quantity: 1, unit_price_minor: 5000, eligible: true },
    ];
    const b = computeCoPay(allMeds, 100, null);
    expect(canConfirm(true, 'UHI-1234', b, null)).toBe(true);
  });

  it('methodLabel reflects whether a co-pay was collected', () => {
    expect(methodLabel(computeCoPay(MIXED, 80, null))).toBe('تأمين + نقدي');
    const allDevices: readonly SpikeCartLine[] = [
      { display_name: 'd', quantity: 1, unit_price_minor: 100, eligible: false },
    ];
    // covered 0 → label drops the "+ نقدي"
    expect(methodLabel(computeCoPay(allDevices, 80, null))).toBe('تأمين');
  });
});

describe('formatMinor', () => {
  it('formats minor units as EGP with two fractional digits, Latin numerals', () => {
    expect(formatMinor(0)).toBe('EGP 0.00');
    expect(formatMinor(57000)).toBe('EGP 570.00');
    expect(formatMinor(123456)).toBe('EGP 1,234.56');
    expect(formatMinor(5)).toBe('EGP 0.05');
  });

  it('renders a leading minus for deduction display', () => {
    expect(formatMinor(-9600)).toBe('−EGP 96.00');
  });
});
