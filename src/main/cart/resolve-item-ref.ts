/**
 * 005-sales-cart T053 — R7 seam fixture resolver.
 *
 * S1+S2 ships a fixture-based ItemRefResolver with a small set of known
 * test SKUs. A production catalogue resolver lands when the item-catalogue
 * feature ships. Unknown item_refs refuse with reason='unknown_item'.
 *
 * This module is injected into CartBridgeHandlers via deps.resolveItemRef.
 * It does NOT modify the DEFAULT_ITEM_REF_RESOLVER in cart-bridge.ts, which
 * remains the production fallback (refuses generically).
 *
 * SECURITY: No note content, credentials, or sensitive data passes through
 * this resolver. It maps opaque item_refs to display snapshots only.
 */

import type { ItemRefResolver } from './cart-bridge.js';

interface FixtureSku {
  readonly display_name: string;
  readonly unit_price_minor: number;
}

const FIXTURE_CATALOGUE: ReadonlyMap<string, FixtureSku> = new Map([
  ['SKU-PARA-500', { display_name: 'Paracetamol 500mg', unit_price_minor: 150 }],
  ['SKU-IBUP-400', { display_name: 'Ibuprofen 400mg', unit_price_minor: 200 }],
  ['SKU-AMOX-250', { display_name: 'Amoxicillin 250mg', unit_price_minor: 450 }],
  ['SKU-VITA-C', { display_name: 'Vitamin C 1000mg', unit_price_minor: 100 }],
  ['SKU-OMEP-20', { display_name: 'Omeprazole 20mg', unit_price_minor: 300 }],
]);

/** All fixture SKU identifiers — exported for tests. */
export const FIXTURE_SKUS: readonly string[] = Array.from(FIXTURE_CATALOGUE.keys());

/**
 * Fixture ItemRefResolver for S1/S2 (T053).
 *
 * Resolves known fixture SKUs; refuses all others with 'unknown_item'.
 * Injected into CartBridgeHandlers for integration and E2E test scenarios.
 */
export const resolveItemRef: ItemRefResolver = (item_ref: string) => {
  const entry = FIXTURE_CATALOGUE.get(item_ref);
  if (entry === undefined) {
    return Promise.resolve({ kind: 'refused', reason: 'unknown_item' });
  }
  return Promise.resolve({ kind: 'ok', ...entry });
};
