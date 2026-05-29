/**
 * T221 — ESC/POS adapter timeout (RED).
 *
 * If the status poll exceeds the configured timeout (Constitution §IV), the
 * adapter returns an `escpos_status_unknown` failure. The Sale row remains
 * durable regardless (the print is not part of the AD-2 atomic transaction —
 * that is enforced by the pipeline/finalize wiring, not the adapter; this test
 * asserts only the adapter's timeout → typed-failure contract).
 */

import { describe, expect, it, vi } from 'vitest';
import { createEscposAdapter } from '../../../../src/main/receipts/escpos-adapter.js';
import type { EscposTransport } from '../../../../src/main/receipts/escpos-adapter.js';

const RENDERED = { escpos: new Uint8Array([0x1b, 0x40]), html: '<div>x</div>' };

describe('T221 — ESC/POS adapter timeout', () => {
  it('returns escpos_status_unknown when pollStatus never resolves before the timeout', async () => {
    vi.useFakeTimers();
    const transport: EscposTransport = {
      write: vi.fn(() => Promise.resolve()),
      // A poll that never settles — the timeout must win.
      pollStatus: vi.fn(() => new Promise(() => {})),
    };
    const adapter = createEscposAdapter({ transport, statusTimeoutMs: 500 });

    const resultPromise = adapter.print(RENDERED);
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      render_path: 'escpos_direct',
      failure_reason: 'escpos_status_unknown',
    });
    vi.useRealTimers();
  });

  it('does not time out when the poll resolves before the deadline', async () => {
    vi.useFakeTimers();
    const transport: EscposTransport = {
      write: vi.fn(() => Promise.resolve()),
      pollStatus: vi.fn(
        () =>
          new Promise<'ok'>((resolve) => {
            setTimeout(() => {
              resolve('ok');
            }, 100);
          }),
      ),
    };
    const adapter = createEscposAdapter({ transport, statusTimeoutMs: 500 });

    const resultPromise = adapter.print(RENDERED);
    await vi.advanceTimersByTimeAsync(100);
    const result = await resultPromise;

    expect(result).toEqual({ ok: true, render_path: 'escpos_direct' });
    vi.useRealTimers();
  });
});
