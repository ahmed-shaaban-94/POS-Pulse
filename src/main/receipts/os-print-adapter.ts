/**
 * T271 — OS-print fallback adapter (008 Slice 3).
 *
 * Wraps `webContents.print`'s callback API as a promise. Used when the
 * connected printer does not report ESC/POS support (path selection lives in
 * the pipeline). Renders the SAME template-engine HTML the ESC/POS path
 * transports as bytes — AD-6 single-source invariant.
 *
 * The print function is injected (a stand-in for `webContents.print`'s
 * `(options, callback)` signature, pre-bound to the HTML render), so the
 * adapter is unit-testable without an Electron BrowserWindow (T230).
 *
 * Timeout (CodeRabbit #280): Electron's `webContents.print` callback is NOT
 * guaranteed to fire in all failure modes (destroyed webContents, renderer
 * crash). Without a deadline the adapter would hang forever, leaving the Sale
 * with no print_events row and no banner. A configured timeout maps a
 * non-firing callback to `os_print_error` so the failure is recorded loudly.
 */

import type { PrintAdapter, PrintAdapterResult, RenderedReceipt } from './print-pipeline.js';

/**
 * The injected OS-print invocation. Receives the HTML to print and a
 * Node-style completion callback `(success, failureReason?)`. The real
 * implementation closes over a hidden offscreen `BrowserWindow` /
 * `webContents.print`; tests inject a fake that invokes the callback directly.
 */
export type OsPrintFn = (
  html: string,
  callback: (success: boolean, failureReason?: string) => void,
) => void;

export interface OsPrintAdapterConfig {
  print: OsPrintFn;
  /** Callback deadline (ms). On overrun → os_print_error. Defaults to 10_000. */
  timeoutMs?: number;
}

const DEFAULT_OS_PRINT_TIMEOUT_MS = 10_000;

export function createOsPrintAdapter(config: OsPrintAdapterConfig): PrintAdapter {
  const { print } = config;
  const timeoutMs = config.timeoutMs ?? DEFAULT_OS_PRINT_TIMEOUT_MS;
  const OS_PRINT_ERROR: PrintAdapterResult = {
    ok: false,
    render_path: 'os_print',
    failure_reason: 'os_print_error',
  };

  return {
    render_path: 'os_print',

    print(rendered: RenderedReceipt): Promise<PrintAdapterResult> {
      return new Promise<PrintAdapterResult>((resolve) => {
        let settled = false;
        const settle = (result: PrintAdapterResult): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutHandle);
          resolve(result);
        };
        // A callback that never fires (destroyed webContents / crash) loses to
        // the deadline → os_print_error (the Sale stays durable, banner raised).
        const timeoutHandle = setTimeout(() => {
          settle(OS_PRINT_ERROR);
        }, timeoutMs);
        try {
          print(rendered.html, (success) => {
            settle(success ? { ok: true, render_path: 'os_print' } : OS_PRINT_ERROR);
          });
        } catch {
          settle(OS_PRINT_ERROR);
        }
      });
    },
  };
}
