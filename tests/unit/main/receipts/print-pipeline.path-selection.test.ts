/* eslint-disable @typescript-eslint/unbound-method --
 * vi.fn-typed `print` methods on the adapter spies trigger this rule on every
 * `expect(adapter.print)` assertion. Same posture as the payments bridge tests.
 */
/**
 * T210 — print-pipeline path selection (RED).
 *
 * When the connected printer reports ESC/POS support (status-byte probe
 * resolves `true`), the pipeline dispatches via the ESC/POS adapter;
 * otherwise it falls back to the OS-print (`webContents.print`) adapter.
 *
 * The pipeline is fully dependency-injected: the two adapters + the printer
 * probe are caller-provided, so no hardware (and no `node-thermal-printer` /
 * `electron` import) is touched in unit tests. Same DI discipline as the
 * `DatabaseHandle` → sql.js test adapter elsewhere in the codebase.
 */

import { describe, expect, it, vi } from 'vitest';
import { createPrintPipeline } from '../../../../src/main/receipts/print-pipeline.js';
import type {
  PrintAdapter,
  PrintPipelineDependencies,
} from '../../../../src/main/receipts/print-pipeline.js';
import type { ReceiptPayload } from '../../../../src/shared/receipts/types.js';
import type { SaleId, SaleNumber } from '../../../../src/shared/sales/types.js';

function payload(): ReceiptPayload {
  return {
    variant: 'first_print',
    sale_id: 'sale-1' as SaleId,
    sale_number: 'TERM-01-2026-05-27-000001' as SaleNumber,
    receipt_number: 'TERM-01-2026-05-27-000001',
    tenant_tax_registration_id: 'TRN-100',
    branch_name: 'Maadi Branch',
    branch_address: '12 Road 9',
    terminal_label: 'TERM-01',
    selling_operator_display_name: 'Mohamed Ahmed',
    subtotal_minor: 5500,
    total_tax_minor: 0,
    total_change_due_minor: 0,
    lines: [
      {
        item_ref: 'SKU-001',
        display_name: 'Paracetamol 500mg',
        quantity: 1,
        unit_price_minor: 5500,
        line_subtotal_minor: 5500,
        note: null,
      },
    ],
    tender_lines_summary: [
      { tender_type: 'cash', amount_applied_minor: 5500, change_due_minor: 0 },
    ],
    settled_at: '2026-05-27T10:00:05.000Z',
    finalized_at: '2026-05-27T10:00:06.000Z',
    local_calendar_day: '2026-05-27',
  };
}

function okEscposAdapter(): PrintAdapter {
  return {
    render_path: 'escpos_direct',
    print: vi.fn(() =>
      Promise.resolve({ ok: true as const, render_path: 'escpos_direct' as const }),
    ),
  };
}

function okOsPrintAdapter(): PrintAdapter {
  return {
    render_path: 'os_print',
    print: vi.fn(() => Promise.resolve({ ok: true as const, render_path: 'os_print' as const })),
  };
}

function deps(over: Partial<PrintPipelineDependencies> = {}): PrintPipelineDependencies {
  return {
    escposAdapter: okEscposAdapter(),
    osPrintAdapter: okOsPrintAdapter(),
    probeEscposSupport: () => Promise.resolve(true),
    ...over,
  };
}

describe('T210 — path selection', () => {
  it('dispatches via the ESC/POS adapter when the printer reports ESC/POS support', async () => {
    const escpos = okEscposAdapter();
    const osPrint = okOsPrintAdapter();
    const pipeline = createPrintPipeline(
      deps({
        escposAdapter: escpos,
        osPrintAdapter: osPrint,
        probeEscposSupport: () => Promise.resolve(true),
      }),
    );

    const result = await pipeline.render(payload());

    expect(escpos.print).toHaveBeenCalledTimes(1);
    expect(osPrint.print).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.render_path).toBe('escpos_direct');
  });

  it('falls back to the OS-print adapter when ESC/POS support is absent', async () => {
    const escpos = okEscposAdapter();
    const osPrint = okOsPrintAdapter();
    const pipeline = createPrintPipeline(
      deps({
        escposAdapter: escpos,
        osPrintAdapter: osPrint,
        probeEscposSupport: () => Promise.resolve(false),
      }),
    );

    const result = await pipeline.render(payload());

    expect(osPrint.print).toHaveBeenCalledTimes(1);
    expect(escpos.print).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.render_path).toBe('os_print');
  });
});

describe('T211 — both paths render from the same payload + same template', () => {
  it('passes the SAME rendered output struct (escpos + html) to whichever adapter is chosen', async () => {
    const escpos = okEscposAdapter();
    const pipelineEscpos = createPrintPipeline(
      deps({ escposAdapter: escpos, probeEscposSupport: () => Promise.resolve(true) }),
    );
    await pipelineEscpos.render(payload());

    const osPrint = okOsPrintAdapter();
    const pipelineOs = createPrintPipeline(
      deps({ osPrintAdapter: osPrint, probeEscposSupport: () => Promise.resolve(false) }),
    );
    await pipelineOs.render(payload());

    const escposArg = (escpos.print as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      escpos: Uint8Array;
      html: string;
    };
    const osArg = (osPrint.print as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      escpos: Uint8Array;
      html: string;
    };

    // Same payload → same template output → byte-identical user-visible content
    // across both paths (R-4 mitigation; AD-6 single-source invariant).
    expect(osArg.html).toBe(escposArg.html);
    expect(Array.from(osArg.escpos)).toEqual(Array.from(escposArg.escpos));
  });
});

describe('T212 — path is opaque to the cashier on success', () => {
  it('returns render_path for audit only; the success result is otherwise path-agnostic in shape', async () => {
    const pipeline = createPrintPipeline(deps({ probeEscposSupport: () => Promise.resolve(true) }));
    const result = await pipeline.render(payload());
    expect(result.ok).toBe(true);
    if (result.ok) {
      // render_path present (audit), but it is the ONLY path-distinguishing field.
      expect(result.render_path).toBe('escpos_direct');
      expect(Object.keys(result).sort()).toEqual(['ok', 'render_path']);
    }
  });
});
