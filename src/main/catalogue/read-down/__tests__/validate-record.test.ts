import { describe, expect, it } from 'vitest';

import { validateRecord } from '../validate-record.js';
import type { MappedRecord } from '../map-sellable-row.js';

/**
 * 010 T016 (RED) — `validateRecord`.
 *
 * Validates the MAPPED internal record (runs after `mapSellableRow`):
 *   • `price_minor` accepted only if `Number.isSafeInteger` and >= 0 (P1).
 *   • `name_ar` non-empty (post-mapping name_ar is the backend `name`, so empty
 *     ⇒ a bad source row).
 *   • required identity present: `product_id`, `sku`.
 * Invalid → `{ ok:false, reason }` (the writer skips + counts; FR-9). No arithmetic.
 */

function mapped(overrides: Partial<MappedRecord['product']> = {}): MappedRecord {
  return {
    product: {
      product_id: 'p-1',
      sku: 'SKU-1',
      name_ar: 'بنادول',
      name_en: null,
      aliases_json: null,
      price_minor: 999,
      tax_category: 'standard',
      unit_pack_label: null,
      active: 1,
      controlled_substance: 0,
      prescription_required: 0,
      row_version: 'cur-1',
      created_at: 'cur-1',
      updated_at: 'cur-1',
      ...overrides,
    },
    barcodes: [],
  };
}

describe('T016 — validateRecord', () => {
  it('accepts a well-formed record', () => {
    const r = validateRecord(mapped());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.product.product_id).toBe('p-1');
  });

  it('accepts a zero price (>= 0 is valid)', () => {
    expect(validateRecord(mapped({ price_minor: 0 })).ok).toBe(true);
  });

  it('rejects a negative price (P1)', () => {
    const r = validateRecord(mapped({ price_minor: -1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/price|money/i);
  });

  it('rejects a non-safe-integer price (never coerced — FR-9)', () => {
    expect(validateRecord(mapped({ price_minor: 9.99 })).ok).toBe(false);
    expect(validateRecord(mapped({ price_minor: Number.MAX_SAFE_INTEGER + 1 })).ok).toBe(false);
    expect(validateRecord(mapped({ price_minor: NaN })).ok).toBe(false);
  });

  it('rejects an empty or whitespace-only name_ar', () => {
    expect(validateRecord(mapped({ name_ar: '' })).ok).toBe(false);
    expect(validateRecord(mapped({ name_ar: '   ' })).ok).toBe(false);
  });

  it('rejects a missing product_id', () => {
    expect(validateRecord(mapped({ product_id: '' })).ok).toBe(false);
  });

  it('rejects a missing sku', () => {
    expect(validateRecord(mapped({ sku: '' })).ok).toBe(false);
  });
});
