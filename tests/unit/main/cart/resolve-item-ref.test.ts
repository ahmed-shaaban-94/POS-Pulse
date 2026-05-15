/**
 * 005-sales-cart T053 — resolveItemRef fixture stub unit tests.
 *
 * Covers:
 *   1. Known fixture SKUs resolve to ok with display_name + unit_price_minor.
 *   2. Unknown item_ref resolves to refused with reason='unknown_item'.
 *   3. Empty string resolves to refused.
 *   4. display_name is non-empty string for all fixture SKUs.
 *   5. unit_price_minor is a non-negative safe integer for all fixture SKUs.
 */

import { describe, expect, it } from 'vitest';
import { resolveItemRef, FIXTURE_SKUS } from '../../../../src/main/cart/resolve-item-ref.js';

describe('T053 — resolveItemRef fixture resolver — known SKUs', () => {
  it('resolves all fixture SKUs to ok', async () => {
    for (const sku of FIXTURE_SKUS) {
      const result = await resolveItemRef(sku);
      expect(result.kind).toBe('ok');
    }
  });

  it('resolved display_name is a non-empty string for all fixture SKUs', async () => {
    for (const sku of FIXTURE_SKUS) {
      const result = await resolveItemRef(sku);
      if (result.kind !== 'ok') throw new Error('Expected ok');
      expect(typeof result.display_name).toBe('string');
      expect(result.display_name.length).toBeGreaterThan(0);
    }
  });

  it('resolved unit_price_minor is a non-negative safe integer for all fixture SKUs', async () => {
    for (const sku of FIXTURE_SKUS) {
      const result = await resolveItemRef(sku);
      if (result.kind !== 'ok') throw new Error('Expected ok');
      expect(Number.isSafeInteger(result.unit_price_minor)).toBe(true);
      expect(result.unit_price_minor).toBeGreaterThanOrEqual(0);
    }
  });

  it('FIXTURE_SKUS contains at least 3 entries', () => {
    expect(FIXTURE_SKUS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('T053 — resolveItemRef fixture resolver — unknown items', () => {
  it('refuses an unknown item_ref with reason unknown_item', async () => {
    const result = await resolveItemRef('UNKNOWN-SKU-9999');
    expect(result).toEqual({ kind: 'refused', reason: 'unknown_item' });
  });

  it('refuses an empty string item_ref', async () => {
    const result = await resolveItemRef('');
    expect(result.kind).toBe('refused');
  });

  it('refuses a random UUID as item_ref', async () => {
    const result = await resolveItemRef('123e4567-e89b-12d3-a456-426614174000');
    expect(result.kind).toBe('refused');
  });
});

describe('T053 — resolveItemRef is async (returns Promise)', () => {
  it('returns a Promise', () => {
    const firstSku = FIXTURE_SKUS[0];
    if (firstSku === undefined) throw new Error('FIXTURE_SKUS must be non-empty');
    const r = resolveItemRef(firstSku);
    expect(r).toBeInstanceOf(Promise);
  });
});
