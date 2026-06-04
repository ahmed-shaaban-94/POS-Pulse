/**
 * 010-pos-catalog-read-down-consumption T017 — `validateRecord`.
 *
 * Per-record validation at the ingest boundary (R5 / FR-9). Runs on the MAPPED
 * internal record (after `mapSellableRow`). Invalid rows are NOT staged — the
 * writer skips and counts them. No arithmetic (the money parse already happened
 * in the mapper); this only GUARDS the result.
 *
 * Rules (Constitution P1 / data-model.md invariant 3):
 *   • `price_minor` MUST be a safe integer >= 0 (P1: integer minor units under a
 *     `Number.isSafeInteger` guard; a non-safe / fractional / negative value is
 *     malformed, never coerced — FR-9).
 *   • `name_ar` MUST be non-empty (post-mapping it is the backend `name`; empty
 *     ⇒ a bad source row).
 *   • required identity present: `product_id`, `sku`.
 *
 * Returns `{ ok, value }` on success or `{ ok:false, reason }` on rejection, so
 * the writer's per-record loop can count rejections uniformly with mapping
 * rejections.
 */

import type { MappedRecord } from './map-sellable-row.js';

export type ValidateResult = { ok: true; value: MappedRecord } | { ok: false; reason: string };

function isNonEmpty(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateRecord(record: MappedRecord): ValidateResult {
  const { product } = record;

  if (!isNonEmpty(product.product_id)) {
    return { ok: false, reason: 'missing_product_id' };
  }
  if (!isNonEmpty(product.sku)) {
    return { ok: false, reason: 'missing_sku' };
  }
  if (!isNonEmpty(product.name_ar)) {
    return { ok: false, reason: 'empty_name' };
  }
  // P1: integer minor units, safe-integer-guarded, non-negative. Never coerced.
  if (!Number.isSafeInteger(product.price_minor) || product.price_minor < 0) {
    return { ok: false, reason: `invalid_price_minor: ${String(product.price_minor)}` };
  }

  return { ok: true, value: record };
}
