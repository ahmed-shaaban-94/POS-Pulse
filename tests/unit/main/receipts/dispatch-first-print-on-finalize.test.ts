/**
 * T273 — dispatchFirstPrintOnFinalize (RED).
 *
 * The testable half of the finalize→print seam, extracted out of the
 * coverage-excluded composition root (mirrors how buildFinalizeInput is
 * extracted from the same dispatch closure). It decides whether to fire the
 * print and derives the payload; the real ESC/POS transport is wired (and
 * smoke-verified) separately at the main entry point.
 *
 * Load-bearing branch: a `finalized_idempotent` result means the sale was
 * already finalized on a prior tick — its first-print was already attempted —
 * so re-dispatching would double-print on every re-scan. Only `kind:'finalized'`
 * fires the print. (Same integration-timing class as the F-007 scope bug.)
 */

import { describe, expect, it, vi } from 'vitest';
import { dispatchFirstPrintOnFinalize } from '../../../../src/main/receipts/dispatch-first-print-on-finalize.js';
import type { SaleRow } from '../../../../src/main/sales/repositories/sales.repository.js';
import type {
  FinalizeFinalized,
  FinalizeFinalizedIdempotent,
} from '../../../../src/main/sales/finalize-transaction.js';

function saleRow(over: Partial<SaleRow> = {}): SaleRow {
  return {
    sale_id: 'sale-1',
    sale_number: 'TERM-01-2026-05-27-000001',
    receipt_number: 'TERM-01-2026-05-27-000001',
    envelope_handoff_action_id: 'handoff-1',
    payment_attempt_id: 'pa-1',
    envelope_cart_id: 'cart-1',
    tenant_id: 'tenant-1',
    branch_id: 'branch-1',
    terminal_id: 'terminal-1',
    terminal_label: 'TERM-01',
    selling_operator_id: 'op-abc',
    selling_operator_display_name: 'Mohamed Ahmed',
    selling_operator_session_id: 'sess-1',
    subtotal_minor: 5500,
    total_tax_minor: 0,
    total_change_due_minor: 0,
    tender_lines_summary_json: JSON.stringify([
      { tender_type: 'cash', amount_applied_minor: 5500, change_due_minor: 0 },
    ]),
    settled_at: '2026-05-27T10:00:05.000Z',
    finalized_at: '2026-05-27T10:00:06.000Z',
    tenant_tax_registration_id: 'TRN-100',
    branch_name: 'Maadi Branch',
    branch_address: '12 Road 9',
    local_calendar_day: '2026-05-27',
    lines_json: JSON.stringify([
      {
        line_id: 'l1',
        item_ref: 'SKU-001',
        display_name: 'Paracetamol 500mg',
        quantity: 1,
        unit_price_minor: 5500,
        line_subtotal_minor: 5500,
        note: null,
        version: 1,
        last_action_id: 'a1',
      },
    ]),
    ...over,
  };
}

const FINALIZED: FinalizeFinalized = {
  kind: 'finalized',
  sale_id: 'sale-1',
  sale_number: 'TERM-01-2026-05-27-000001',
  receipt_number: 'TERM-01-2026-05-27-000001',
  finalized_at: '2026-05-27T10:00:06.000Z',
};

const IDEMPOTENT: FinalizeFinalizedIdempotent = {
  kind: 'finalized_idempotent',
  sale_id: 'sale-1',
  sale_number: 'TERM-01-2026-05-27-000001',
  receipt_number: 'TERM-01-2026-05-27-000001',
};

function deps(row: SaleRow | null) {
  const dispatchFirstPrint = vi.fn(() =>
    Promise.resolve({ ok: true as const, render_path: 'escpos_direct' as const }),
  );
  return {
    dispatchFirstPrint,
    salesRepo: { readById: vi.fn(() => row) },
    printDispatcher: { dispatchFirstPrint },
  };
}

describe('T273 — dispatchFirstPrintOnFinalize', () => {
  it('fires the print on a freshly finalized sale', async () => {
    const d = deps(saleRow());
    await dispatchFirstPrintOnFinalize(FINALIZED, {
      salesRepo: d.salesRepo,
      printDispatcher: d.printDispatcher,
    });
    expect(d.dispatchFirstPrint).toHaveBeenCalledTimes(1);
    const [payloadArg, ctxArg] = d.dispatchFirstPrint.mock.calls[0] as [
      { sale_id: string; variant: string },
      { sale_id: string; attribution_operator_id: string },
    ];
    expect(payloadArg.variant).toBe('first_print');
    expect(payloadArg.sale_id).toBe('sale-1');
    expect(ctxArg.attribution_operator_id).toBe('op-abc');
  });

  it('does NOT fire the print on an idempotent replay (would double-print)', async () => {
    const d = deps(saleRow());
    await dispatchFirstPrintOnFinalize(IDEMPOTENT, {
      salesRepo: d.salesRepo,
      printDispatcher: d.printDispatcher,
    });
    expect(d.dispatchFirstPrint).not.toHaveBeenCalled();
  });

  it('degrades to no-print (no throw) when the finalized sale row is missing', async () => {
    const d = deps(null);
    await expect(
      dispatchFirstPrintOnFinalize(FINALIZED, {
        salesRepo: d.salesRepo,
        printDispatcher: d.printDispatcher,
      }),
    ).resolves.toBeUndefined();
    expect(d.dispatchFirstPrint).not.toHaveBeenCalled();
  });

  it('degrades to no-print (no throw) when lines_json is malformed', async () => {
    const d = deps(saleRow({ lines_json: 'not-json' }));
    await expect(
      dispatchFirstPrintOnFinalize(FINALIZED, {
        salesRepo: d.salesRepo,
        printDispatcher: d.printDispatcher,
      }),
    ).resolves.toBeUndefined();
    expect(d.dispatchFirstPrint).not.toHaveBeenCalled();
  });

  it('catches + logs an INFRA throw from the dispatcher (resolves void; no rejection)', async () => {
    // No-unhandled-rejection safety net (CodeRabbit #280): a dispatcher that
    // throws an infra error (render/INSERT/emit bug) must not reject this
    // fire-and-forget seam.
    const thrower = vi.fn(() => Promise.reject(new Error('db exploded')));
    const logError = vi.fn();
    await expect(
      dispatchFirstPrintOnFinalize(FINALIZED, {
        salesRepo: { readById: vi.fn(() => saleRow()) },
        printDispatcher: { dispatchFirstPrint: thrower } as unknown as Parameters<
          typeof dispatchFirstPrintOnFinalize
        >[1]['printDispatcher'],
        logError,
      }),
    ).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
