/**
 * T230 — OS-print fallback adapter (RED).
 *
 * The OS-print adapter wraps `webContents.print`'s callback API as a promise.
 * The callback `(success, failureReason)` is injected so no Electron import is
 * needed in unit tests: success → `{ ok:true, render_path:'os_print' }`;
 * failure → `{ ok:false, failure_reason:'os_print_error' }`.
 */

import { describe, expect, it, vi } from 'vitest';
import { createOsPrintAdapter } from '../../../../src/main/receipts/os-print-adapter.js';
import type { OsPrintFn } from '../../../../src/main/receipts/os-print-adapter.js';

const RENDERED = { escpos: new Uint8Array([0x1b, 0x40]), html: '<div class="receipt">x</div>' };

describe('T230 — OS-print fallback', () => {
  it('renders the HTML and resolves success when the print callback reports success', async () => {
    const printFn: OsPrintFn = vi.fn<OsPrintFn>((html, cb) => {
      cb(true);
    });
    const adapter = createOsPrintAdapter({ print: printFn });
    const result = await adapter.print(RENDERED);
    expect(printFn).toHaveBeenCalledWith(RENDERED.html, expect.any(Function));
    expect(result).toEqual({ ok: true, render_path: 'os_print' });
  });

  it('resolves os_print_error when the print callback reports failure', async () => {
    const printFn: OsPrintFn = vi.fn<OsPrintFn>((html, cb) => {
      cb(false, 'cancelled');
    });
    const adapter = createOsPrintAdapter({ print: printFn });
    const result = await adapter.print(RENDERED);
    expect(result).toEqual({
      ok: false,
      render_path: 'os_print',
      failure_reason: 'os_print_error',
    });
  });

  it('resolves os_print_error when the print invocation throws synchronously', async () => {
    const printFn: OsPrintFn = vi.fn(() => {
      throw new Error('no webContents');
    });
    const adapter = createOsPrintAdapter({ print: printFn });
    const result = await adapter.print(RENDERED);
    expect(result).toEqual({
      ok: false,
      render_path: 'os_print',
      failure_reason: 'os_print_error',
    });
  });

  it('exposes its render_path tag', () => {
    const adapter = createOsPrintAdapter({ print: vi.fn() });
    expect(adapter.render_path).toBe('os_print');
  });

  it('resolves os_print_error when the print callback never fires (timeout)', async () => {
    vi.useFakeTimers();
    // A print that never invokes its callback (destroyed webContents / crash).
    const printFn: OsPrintFn = vi.fn();
    const adapter = createOsPrintAdapter({ print: printFn, timeoutMs: 500 });
    const resultPromise = adapter.print(RENDERED);
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;
    expect(result).toEqual({
      ok: false,
      render_path: 'os_print',
      failure_reason: 'os_print_error',
    });
    vi.useRealTimers();
  });

  it('a late callback after timeout does not double-resolve', async () => {
    vi.useFakeTimers();
    let captured: ((success: boolean) => void) | undefined;
    const printFn: OsPrintFn = vi.fn<OsPrintFn>((_html, cb) => {
      captured = cb;
    });
    const adapter = createOsPrintAdapter({ print: printFn, timeoutMs: 500 });
    const resultPromise = adapter.print(RENDERED);
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;
    expect(result.ok).toBe(false);
    // Fire the callback AFTER the timeout already settled — must be a no-op.
    captured?.(true);
    await Promise.resolve();
    expect(result.ok).toBe(false);
    vi.useRealTimers();
  });
});
