/**
 * T273 — finalize → first-print seam (008 Slice 3).
 *
 * Extracted out of the coverage-excluded composition root so its load-bearing
 * branch is unit-tested (mirrors `buildFinalizeInput`'s extraction from the
 * same dispatch closure). The composition root wires the real ESC/POS
 * transport into the `printDispatcher` and calls this after the finalize
 * transaction returns:
 *
 *   const result = finalizeTransaction.finalize(input);   // sync, atomic
 *   void dispatchFirstPrintOnFinalize(result, deps).catch(logUnexpected);
 *
 * The print is NOT part of the AD-2 atomic transaction — the Sale row is
 * already durably committed by the time this runs, and a print failure leaves
 * it untouched (the dispatcher writes a failure `print_events` row + banner).
 *
 * Load-bearing branch: ONLY `kind:'finalized'` fires the print. A
 * `finalized_idempotent` result means the sale was finalized on a PRIOR tick —
 * its first-print was already attempted — so re-dispatching would double-print
 * on every re-scan of the same settled row.
 */

import { deriveReceiptPayload } from './receipts-payload.js';
import type { PrintDispatcher, PrintDispatchContext } from './print-dispatcher.js';
import type { SaleRow, SalesRepository } from '../sales/repositories/sales.repository.js';
import type { FinalizeResult } from '../sales/finalize-transaction.js';

export interface DispatchFirstPrintOnFinalizeDependencies {
  salesRepo: Pick<SalesRepository, 'readById'>;
  printDispatcher: PrintDispatcher;
}

function toContext(row: SaleRow): PrintDispatchContext {
  return {
    sale_id: row.sale_id,
    tenant_id: row.tenant_id,
    branch_id: row.branch_id,
    terminal_id: row.terminal_id,
    session_id: row.selling_operator_session_id,
    // The selling operator is the attributor for an auto-fired first print
    // (FR-013 / FR-014). A reprint/retry by a different operator carries its
    // own attribution at the bridge handler (Slice 3 retry / Slice 5 reprint).
    attribution_operator_id: row.selling_operator_id,
  };
}

export async function dispatchFirstPrintOnFinalize(
  result: FinalizeResult,
  deps: DispatchFirstPrintOnFinalizeDependencies,
): Promise<void> {
  // Only a fresh finalize fires the first print. Idempotent replays + refusals
  // are no-ops (the print was already attempted on the original finalize).
  if (result.kind !== 'finalized') return;

  const row = deps.salesRepo.readById(result.sale_id);
  if (row === null) return;

  // A malformed persisted JSON column degrades to no-print (never throws across
  // the async tick boundary) — same discipline as receipts-bridge / finalize-
  // dispatch. The startup print-recovery sub-scan will re-attempt later.
  let payload;
  try {
    payload = deriveReceiptPayload(row, { variant: 'first_print' });
  } catch {
    return;
  }

  await deps.printDispatcher.dispatchFirstPrint(payload, toContext(row));
}
