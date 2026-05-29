/* eslint-disable @typescript-eslint/unbound-method --
 * vi.fn-typed transport methods trigger this rule on `expect(t.write)` /
 * `expect(t.pollStatus)` assertions. Same posture as the payments bridge tests.
 */
/**
 * T220 — ESC/POS adapter status handling (RED).
 *
 * The adapter writes the pre-composed byte stream to an injected transport,
 * then polls the printer status byte. It returns success on an "ok" status and
 * a typed failure on "paper out" / "jam" / "offline" / "unknown".
 *
 * The transport is injected (write + pollStatus), so the adapter is fully
 * unit-testable without a real printer — same DI posture as the DatabaseHandle
 * → sql.js adapter. The real `node-thermal-printer` transport is wired only at
 * the main entry point.
 */

import { describe, expect, it, vi } from 'vitest';
import { createEscposAdapter } from '../../../../src/main/receipts/escpos-adapter.js';
import type { EscposTransport } from '../../../../src/main/receipts/escpos-adapter.js';

const RENDERED = { escpos: new Uint8Array([0x1b, 0x40, 0x41]), html: '<div>x</div>' };

function transport(over: Partial<EscposTransport> = {}): EscposTransport {
  return {
    write: vi.fn(() => Promise.resolve()),
    pollStatus: vi.fn(() => Promise.resolve('ok' as const)),
    ...over,
  };
}

describe('T220 — ESC/POS adapter status handling', () => {
  it('writes the byte stream then polls status', async () => {
    const t = transport();
    const adapter = createEscposAdapter({ transport: t, statusTimeoutMs: 1000 });
    await adapter.print(RENDERED);
    expect(t.write).toHaveBeenCalledWith(RENDERED.escpos);
    expect(t.pollStatus).toHaveBeenCalled();
  });

  it('returns success on "ok" status', async () => {
    const adapter = createEscposAdapter({ transport: transport(), statusTimeoutMs: 1000 });
    const result = await adapter.print(RENDERED);
    expect(result).toEqual({ ok: true, render_path: 'escpos_direct' });
  });

  it.each([
    ['paper_out', 'printer_out_of_paper'],
    ['jam', 'printer_jam'],
    ['offline', 'printer_offline'],
    ['unknown', 'escpos_status_unknown'],
  ] as const)('maps "%s" status to %s failure', async (status, expectedReason) => {
    const adapter = createEscposAdapter({
      transport: transport({ pollStatus: vi.fn(() => Promise.resolve(status)) }),
      statusTimeoutMs: 1000,
    });
    const result = await adapter.print(RENDERED);
    expect(result).toEqual({
      ok: false,
      render_path: 'escpos_direct',
      failure_reason: expectedReason,
    });
  });

  it('returns escpos_write_failure when the transport write throws', async () => {
    const adapter = createEscposAdapter({
      transport: transport({ write: vi.fn(() => Promise.reject(new Error('usb gone'))) }),
      statusTimeoutMs: 1000,
    });
    const result = await adapter.print(RENDERED);
    expect(result).toEqual({
      ok: false,
      render_path: 'escpos_direct',
      failure_reason: 'escpos_write_failure',
    });
  });

  it('returns escpos_status_unknown when the status poll REJECTS (field USB fault)', async () => {
    // A rejecting poll must degrade to a typed failure, never propagate — the
    // Sale-durable / banner-loud invariant depends on print() always resolving.
    const adapter = createEscposAdapter({
      transport: transport({ pollStatus: vi.fn(() => Promise.reject(new Error('device fault'))) }),
      statusTimeoutMs: 1000,
    });
    const result = await adapter.print(RENDERED);
    expect(result).toEqual({
      ok: false,
      render_path: 'escpos_direct',
      failure_reason: 'escpos_status_unknown',
    });
  });

  it('exposes its render_path tag', () => {
    const adapter = createEscposAdapter({ transport: transport(), statusTimeoutMs: 1000 });
    expect(adapter.render_path).toBe('escpos_direct');
  });
});
