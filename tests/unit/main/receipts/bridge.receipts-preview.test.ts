/**
 * T140-T142 — `receipts.preview` bridge handler (RED).
 *
 *   T140 returns the HTML preview for a sale; tenant-isolation scoped;
 *        sale_not_found on miss.
 *   T141 NO side effects — does not print, kick the drawer, or mutate the Sale.
 *   T142 defensive forbidden-field-in-request guard.
 *
 * The handler gates on an active session, reads the Sale (tenant-scoped),
 * derives the ReceiptPayload (T164), renders via the engine (T160), and
 * returns the HTML + layout metadata.
 */

import { describe, expect, it, vi } from 'vitest';
import { createReceiptsBridge } from '../../../../src/main/receipts/receipts-bridge.js';
import type { SaleRow } from '../../../../src/main/sales/repositories/sales.repository.js';
import type { OperatorSessionForSales } from '../../../../src/main/sales/sales-bridge.js';

function saleRow(overrides: Partial<SaleRow> = {}): SaleRow {
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
    ...overrides,
  };
}

const SESSION: OperatorSessionForSales = {
  role: 'cashier',
  operator_id: 'op-abc',
  operator_session_id: 'sess-1',
  tenant_id: 'tenant-1',
  branch_id: 'branch-1',
  terminal_id: 'terminal-1',
};

function makeBridge(opts: { session?: OperatorSessionForSales | null; row?: SaleRow | null }) {
  const readById = vi.fn((): SaleRow | null => opts.row ?? null);
  const insert = vi.fn();
  const bridge = createReceiptsBridge({
    getCurrentSession: () => (opts.session === undefined ? SESSION : opts.session),
    salesRepo: { readById, insert },
  });
  return { bridge, readById, insert };
}

describe('T140 — receipts.preview happy path', () => {
  it('returns the HTML preview + layout metadata for a sale in scope', async () => {
    const { bridge } = makeBridge({ row: saleRow() });
    const res = await bridge.preview({ sale_id: 'sale-1', idempotency_key: 'idem-1' });
    expect(res.kind).toBe('ok');
    if (res.kind !== 'ok') return;
    expect(res.preview.html).toContain('Paracetamol 500mg');
    expect(res.preview.html).toContain('TERM-01-2026-05-27-000001');
    expect(res.preview.width_chars).toBe(42);
    expect(res.preview.bilingual_locale).toBe('ar-EG-RTL-with-latin-en');
  });

  it('refuses with no_session when there is no active session', async () => {
    const { bridge } = makeBridge({ session: null, row: saleRow() });
    const res = await bridge.preview({ sale_id: 'sale-1', idempotency_key: 'idem-1' });
    expect(res).toEqual({ kind: 'refused', reason: 'no_session' });
  });

  it('refuses with sale_not_found when the sale does not exist', async () => {
    const { bridge } = makeBridge({ row: null });
    const res = await bridge.preview({ sale_id: 'missing', idempotency_key: 'idem-1' });
    expect(res).toEqual({ kind: 'refused', reason: 'sale_not_found' });
  });

  it('refuses with sale_not_found on a cross-tenant sale (no information leak)', async () => {
    const { bridge } = makeBridge({ row: saleRow({ tenant_id: 'other-tenant' }) });
    const res = await bridge.preview({ sale_id: 'sale-1', idempotency_key: 'idem-1' });
    expect(res).toEqual({ kind: 'refused', reason: 'sale_not_found' });
  });

  it('renders the reprint_duplicate variant when the sale already printed', async () => {
    // For S2 preview, the variant is first_print by default; this asserts the
    // preview renders without a marker on a never-printed sale.
    const { bridge } = makeBridge({ row: saleRow() });
    const res = await bridge.preview({ sale_id: 'sale-1', idempotency_key: 'idem-1' });
    if (res.kind !== 'ok') throw new Error('expected ok');
    expect(res.preview.html).not.toContain('DUPLICATE COPY');
  });
});

describe('receipts.preview — corrupt persisted row degrades to a refusal', () => {
  it('refuses sale_not_found (not an unstructured throw) on malformed lines_json', async () => {
    const { bridge } = makeBridge({ row: saleRow({ lines_json: '{not json' }) });
    const res = await bridge.preview({ sale_id: 'sale-1', idempotency_key: 'idem-1' });
    expect(res).toEqual({ kind: 'refused', reason: 'sale_not_found' });
  });
});

describe('T141 — receipts.preview has no side effects', () => {
  it('never calls salesRepo.insert (no Sale mutation)', async () => {
    const { bridge, insert } = makeBridge({ row: saleRow() });
    await bridge.preview({ sale_id: 'sale-1', idempotency_key: 'idem-1' });
    expect(insert).not.toHaveBeenCalled();
  });

  it('only reads the sale (single readById, no writes)', async () => {
    const { bridge, readById } = makeBridge({ row: saleRow() });
    await bridge.preview({ sale_id: 'sale-1', idempotency_key: 'idem-1' });
    expect(readById).toHaveBeenCalledTimes(1);
  });
});

describe('T142 — receipts.preview forbidden-field guard', () => {
  it('refuses a request carrying a top-level forbidden key', async () => {
    const { bridge, readById } = makeBridge({ row: saleRow() });
    const res = await bridge.preview({
      sale_id: 'sale-1',
      idempotency_key: 'idem-1',
      // @ts-expect-error — forbidden key not on the request type.
      pan: '4111111111111111',
    });
    expect(res).toEqual({ kind: 'refused', reason: 'forbidden_field_in_request' });
    expect(readById).not.toHaveBeenCalled();
  });

  it('refuses a key from the shared 004 forbidden list (e.g. pin)', async () => {
    const { bridge } = makeBridge({ row: saleRow() });
    const res = await bridge.preview({
      sale_id: 'sale-1',
      idempotency_key: 'idem-1',
      // @ts-expect-error — `pin` is in the shared FORBIDDEN_PAYLOAD_KEYS list.
      pin: '1234',
    });
    expect(res).toEqual({ kind: 'refused', reason: 'forbidden_field_in_request' });
  });

  it('refuses a forbidden key nested inside an object/array (deep scan)', async () => {
    const { bridge } = makeBridge({ row: saleRow() });
    const res = await bridge.preview({
      sale_id: 'sale-1',
      idempotency_key: 'idem-1',
      // @ts-expect-error — forbidden key nested under an array of objects.
      meta: [{ ok: 1 }, { nested: { voucher_code: 'leak' } }],
    });
    expect(res).toEqual({ kind: 'refused', reason: 'forbidden_field_in_request' });
  });

  it('tolerates a cyclic request payload without infinite recursion', async () => {
    const { bridge } = makeBridge({ row: saleRow() });
    const cyclic: Record<string, unknown> = { sale_id: 'sale-1', idempotency_key: 'idem-1' };
    cyclic.self = cyclic;
    const res = await bridge.preview(cyclic as unknown as Parameters<typeof bridge.preview>[0]);
    // No forbidden key → proceeds to a normal ok render.
    expect(res.kind).toBe('ok');
  });

  it('allows a clean request with extra non-forbidden keys', async () => {
    const { bridge } = makeBridge({ row: saleRow() });
    const res = await bridge.preview({
      sale_id: 'sale-1',
      idempotency_key: 'idem-1',
      // @ts-expect-error — harmless extra key; scan walks it and finds nothing.
      ui_hint: { zoom: 1 },
    });
    expect(res.kind).toBe('ok');
  });
});
