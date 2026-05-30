/**
 * T200 — production OS-print transport (RED).
 *
 * `os-print-transport.ts` builds the REAL `OsPrintFn` that `createOsPrintAdapter`
 * (T271) consumes — the one that drives a genuine Windows OS print through an
 * offscreen Electron `BrowserWindow` + `webContents.print`. The thin Electron
 * binding (actually constructing a BrowserWindow) is glue verified by the T301
 * human bench smoke; THESE tests pin the pure, deterministic parts:
 *
 *   - device-name resolution from the system printer list + optional config,
 *   - print-options construction (80 mm pageSize, silent, background),
 *   - the load → print → destroy orchestration over INJECTED seams (a fake
 *     window factory + fake printer list), so no live Electron runtime is
 *     needed,
 *   - success / failure / throw / no-print-window mapping into the
 *     `(success, failureReason)` callback shape `createOsPrintAdapter` expects,
 *   - the slip HTML never leaks into the injected logger (FR-071 / AD-9).
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createOsPrintTransport,
  resolvePrinterDeviceName,
  buildPrintOptions,
  wrapReceiptDocument,
  RECEIPT_WIDTH_MICRONS,
  type PrintWindow,
  type PrinterInfoLike,
} from '../../../../src/main/receipts/os-print-transport.js';

const HTML = '<div class="receipt">نقدًا — Cash 12.00</div>';

/** A fake offscreen print window honoring the PrintWindow port. */
function makeFakeWindow(
  overrides: Partial<{
    loadHtml: PrintWindow['loadHtml'];
    print: PrintWindow['print'];
    destroy: PrintWindow['destroy'];
  }> = {},
): PrintWindow & { destroyed: boolean } {
  const state = { destroyed: false };
  return {
    get destroyed(): boolean {
      return state.destroyed;
    },
    loadHtml: overrides.loadHtml ?? ((): Promise<void> => Promise.resolve()),
    print:
      overrides.print ??
      ((_options, cb): void => {
        cb(true, '');
      }),
    destroy:
      overrides.destroy ??
      ((): void => {
        state.destroyed = true;
      }),
  };
}

describe('T200 — resolvePrinterDeviceName', () => {
  const printers: PrinterInfoLike[] = [
    { name: 'Microsoft_Print_to_PDF', isDefault: false },
    { name: 'BIXOLON_SRP-330II', isDefault: true },
  ];

  it('returns the configured device name verbatim when set (exact system name)', () => {
    expect(resolvePrinterDeviceName(printers, 'BIXOLON_SRP-330II')).toBe('BIXOLON_SRP-330II');
  });

  it('returns the system default printer name when no device is configured', () => {
    expect(resolvePrinterDeviceName(printers, undefined)).toBe('BIXOLON_SRP-330II');
  });

  it('returns empty string when no default and none configured (Electron picks default)', () => {
    const noDefault: PrinterInfoLike[] = [{ name: 'A', isDefault: false }];
    expect(resolvePrinterDeviceName(noDefault, undefined)).toBe('');
  });

  it('returns empty string for an empty printer list and no config', () => {
    expect(resolvePrinterDeviceName([], undefined)).toBe('');
  });

  it('honors the configured name even when it is not in the discovered list (let the OS decide)', () => {
    expect(resolvePrinterDeviceName(printers, 'Some_Unlisted_Queue')).toBe('Some_Unlisted_Queue');
  });
});

describe('T200 — buildPrintOptions', () => {
  it('prints silently to the resolved device with an 80 mm continuous page width', () => {
    const opts = buildPrintOptions('BIXOLON_SRP-330II');
    expect(opts.silent).toBe(true);
    expect(opts.printBackground).toBe(true);
    expect(opts.deviceName).toBe('BIXOLON_SRP-330II');
    // 80 mm thermal roll width expressed in microns for Electron's Size pageSize.
    const pageSize = opts.pageSize as { width: number; height: number };
    expect(pageSize.width).toBe(RECEIPT_WIDTH_MICRONS);
    expect(pageSize.width).toBe(80_000);
    expect(typeof pageSize.height).toBe('number');
  });

  it('omits deviceName when empty so Electron falls back to the system default', () => {
    const opts = buildPrintOptions('');
    expect(opts.deviceName).toBeUndefined();
    expect(opts.silent).toBe(true);
  });
});

describe('T200 — wrapReceiptDocument (print-parity styling)', () => {
  // The template engine's toHtml emits a BARE fragment (<div class="receipt"
  // dir="rtl">…</div>) with no document shell or CSS — the renderer supplies the
  // 80 mm / monospace / RTL styling for the on-screen preview. For the OS-print
  // path to MATCH the recorded browser/HTML render-quality smoke (Arabic legible,
  // fits 80 mm), the transport must wrap the fragment in a full styled document.
  const FRAGMENT = '<div class="receipt" dir="rtl"><div class="band" dir="rtl">نقدًا</div></div>';

  it('produces a complete HTML document around the fragment', () => {
    const doc = wrapReceiptDocument(FRAGMENT);
    expect(doc).toMatch(/^<!doctype html>/i);
    expect(doc).toContain('<html');
    expect(doc).toContain('<head>');
    expect(doc).toContain('</html>');
    // The fragment is embedded verbatim (not re-escaped — it is trusted
    // template-engine output that already escaped its own text).
    expect(doc).toContain(FRAGMENT);
  });

  it('embeds the 80 mm width, monospace font, and RTL direction in the print CSS', () => {
    const doc = wrapReceiptDocument(FRAGMENT);
    expect(doc).toContain('80mm');
    expect(doc).toContain('monospace');
    // Column alignment (rule lines + bands) depends on preserved whitespace.
    expect(doc).toContain('white-space: pre');
    expect(doc).toMatch(/<html[^>]*dir="rtl"|direction:\s*rtl/);
  });

  it('declares UTF-8 so Arabic glyphs render', () => {
    const doc = wrapReceiptDocument(FRAGMENT);
    expect(doc.toLowerCase()).toContain('charset="utf-8"');
  });
});

describe('T200 — createOsPrintTransport (orchestration over injected seams)', () => {
  it('loads the HTML, prints to the resolved device, and resolves success(true)', async () => {
    const win = makeFakeWindow();
    const loadSpy = vi.spyOn(win, 'loadHtml');
    const printSpy = vi.spyOn(win, 'print');
    const transport = createOsPrintTransport({
      createPrintWindow: () => win,
      listPrinters: () => Promise.resolve([{ name: 'BIXOLON_SRP-330II', isDefault: true }]),
    });

    const success = await new Promise<boolean>((resolve) => {
      transport(HTML, (ok) => {
        resolve(ok);
      });
    });

    expect(success).toBe(true);
    // The transport wraps the bare fragment in a full styled print document
    // (80 mm / monospace / RTL) before loading — so the loaded HTML CONTAINS
    // the fragment but is not byte-equal to it.
    const loadedHtml = loadSpy.mock.calls[0]?.[0] ?? '';
    expect(loadedHtml).toContain(HTML);
    expect(loadedHtml).toMatch(/^<!doctype html>/i);
    expect(printSpy).toHaveBeenCalledWith(
      expect.objectContaining({ silent: true, deviceName: 'BIXOLON_SRP-330II' }),
      expect.any(Function),
    );
  });

  it('destroys the offscreen window after a successful print (no leak)', async () => {
    const win = makeFakeWindow();
    const destroySpy = vi.spyOn(win, 'destroy');
    const transport = createOsPrintTransport({
      createPrintWindow: () => win,
      listPrinters: () => Promise.resolve([]),
    });
    await new Promise<boolean>((resolve) => {
      transport(HTML, (ok) => {
        resolve(ok);
      });
    });
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('destroys the offscreen window after a print FAILURE too', async () => {
    const win = makeFakeWindow({
      print: (_o, cb) => {
        cb(false, 'cancelled');
      },
    });
    const destroySpy = vi.spyOn(win, 'destroy');
    const transport = createOsPrintTransport({
      createPrintWindow: () => win,
      listPrinters: () => Promise.resolve([]),
    });
    const ok = await new Promise<boolean>((resolve) => {
      transport(HTML, (s) => {
        resolve(s);
      });
    });
    expect(ok).toBe(false);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('maps a print-callback failure to success(false) with the failure reason', async () => {
    const win = makeFakeWindow({
      print: (_o, cb) => {
        cb(false, 'no paper');
      },
    });
    const transport = createOsPrintTransport({
      createPrintWindow: () => win,
      listPrinters: () => Promise.resolve([]),
    });
    const result = await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
      transport(HTML, (ok, reason) => {
        resolve({ ok, reason });
      });
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no paper');
  });

  it('maps a loadHtml rejection to success(false) and still destroys the window', async () => {
    const win = makeFakeWindow({
      loadHtml: () => Promise.reject(new Error('load failed')),
    });
    const destroySpy = vi.spyOn(win, 'destroy');
    const transport = createOsPrintTransport({
      createPrintWindow: () => win,
      listPrinters: () => Promise.resolve([]),
    });
    const ok = await new Promise<boolean>((resolve) => {
      transport(HTML, (s) => {
        resolve(s);
      });
    });
    expect(ok).toBe(false);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('maps a synchronous throw in window creation to success(false)', async () => {
    const transport = createOsPrintTransport({
      createPrintWindow: () => {
        throw new Error('cannot create window');
      },
      listPrinters: () => Promise.resolve([]),
    });
    const ok = await new Promise<boolean>((resolve) => {
      transport(HTML, (s) => {
        resolve(s);
      });
    });
    expect(ok).toBe(false);
  });

  it('never passes the slip HTML to the injected logger (FR-071 / AD-9 by-value)', async () => {
    const win = makeFakeWindow();
    const logger = { info: vi.fn(), warn: vi.fn() };
    const transport = createOsPrintTransport({
      createPrintWindow: () => win,
      listPrinters: () => Promise.resolve([]),
      logger,
    });
    await new Promise<boolean>((resolve) => {
      transport(HTML, (ok) => {
        resolve(ok);
      });
    });
    const allArgs = [...logger.info.mock.calls, ...logger.warn.mock.calls].flat();
    const serialized = JSON.stringify(allArgs);
    expect(serialized).not.toContain('نقدًا');
    expect(serialized).not.toContain('Cash 12.00');
    expect(serialized).not.toContain('<div');
  });
});
