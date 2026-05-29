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
}

export function createOsPrintAdapter(config: OsPrintAdapterConfig): PrintAdapter {
  const { print } = config;

  return {
    render_path: 'os_print',

    print(rendered: RenderedReceipt): Promise<PrintAdapterResult> {
      return new Promise<PrintAdapterResult>((resolve) => {
        try {
          print(rendered.html, (success) => {
            resolve(
              success
                ? { ok: true, render_path: 'os_print' }
                : { ok: false, render_path: 'os_print', failure_reason: 'os_print_error' },
            );
          });
        } catch {
          resolve({ ok: false, render_path: 'os_print', failure_reason: 'os_print_error' });
        }
      });
    },
  };
}
