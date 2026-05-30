/**
 * T200 — production OS-print transport (008 Slice 3).
 *
 * Builds the REAL `OsPrintFn` consumed by `createOsPrintAdapter` (T271) — the
 * one that drives a genuine Windows OS print through an offscreen Electron
 * `BrowserWindow` + `webContents.print`. Until this module, `src/main/index.ts`
 * injected a stub that always failed with `os_print_transport_not_wired_until_T200`;
 * wiring this transport in is what makes an actual 008 receipt print via the
 * Windows OS print path.
 *
 * Design — testable seam, thin glue:
 *   - The pure parts (`resolvePrinterDeviceName`, `buildPrintOptions`) and the
 *     load → print → destroy orchestration run over INJECTED ports
 *     (`createPrintWindow`, `listPrinters`), so they are unit-tested without a
 *     live Electron runtime.
 *   - The ONE Electron-bound leaf — actually constructing a secure offscreen
 *     `BrowserWindow` and calling `webContents.print` — is the default
 *     `createDefaultPrintWindow` factory. It cannot be unit-tested (no Electron
 *     runtime in vitest) and is verified by the T301 human bench smoke, the
 *     same posture as the rest of `index.ts` glue.
 *
 * Security (Constitution): the offscreen print window is a BrowserWindow and so
 * carries `contextIsolation:true, nodeIntegration:false, sandbox:true` like
 * every other window. It loads ONLY the in-memory template-engine HTML via a
 * `data:` URL — no remote content, no preload.
 *
 * Redaction (FR-071 / AD-9): the slip HTML is slip content. It is loaded into
 * the print window but NEVER logged. The injected logger receives structural
 * fields only (device name, outcome) — never the HTML.
 *
 * Page geometry: the print uses an 80 mm page width (the BIXOLON SRP-330 II
 * continuous-roll setting recorded in the §A5 bench evidence) so the OS-path
 * output matches the browser/HTML render-quality smoke already on `main`
 * (Arabic legible, fits 80 mm).
 */

import { BrowserWindow } from 'electron';
import type { WebContentsPrintOptions } from 'electron';

/** 80 mm thermal-roll width, in microns (Electron `Size` pageSize unit). */
export const RECEIPT_WIDTH_MICRONS = 80_000;

/**
 * Continuous-roll height cap, in microns. The BIXOLON's best-observed driver
 * setting is an 80 × 3276 mm continuous roll (§A5 bench evidence); we cap the
 * page height generously so a long receipt is not truncated, while the driver's
 * continuous-roll feed handles the actual cut.
 */
export const RECEIPT_MAX_HEIGHT_MICRONS = 3_276_000;

/** Default deadline for the whole load+print round-trip (ms). */
const DEFAULT_PRINT_TIMEOUT_MS = 15_000;

/** The minimal `PrinterInfo` shape this module needs (subset of Electron's). */
export interface PrinterInfoLike {
  name: string;
  isDefault: boolean;
}

/** Structural logger port — never receives slip content. */
export interface OsPrintTransportLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
}

/**
 * An offscreen print surface. The default impl wraps a secure `BrowserWindow`;
 * tests inject a fake so orchestration is verifiable without Electron.
 */
export interface PrintWindow {
  /** Load the receipt HTML (via a data: URL in the real impl). */
  loadHtml(html: string): Promise<void>;
  /** Invoke `webContents.print(options, callback)`. */
  print(
    options: WebContentsPrintOptions,
    callback: (success: boolean, failureReason: string) => void,
  ): void;
  /** Tear down the window. Idempotent. */
  destroy(): void;
}

export interface OsPrintTransportConfig {
  /** Factory for a fresh offscreen print window per print. */
  createPrintWindow: () => PrintWindow;
  /** Enumerate system printers (Electron `getPrintersAsync` in production). */
  listPrinters: () => Promise<PrinterInfoLike[]>;
  /**
   * Exact system printer name to target (NOT the friendly name, per Electron).
   * When unset, the system default printer is used. Sourced from config; today
   * pairing (T094a) carries USB vendor/product/com-port ids, NOT the Windows
   * print-queue name, so mapping a specific BIXOLON queue is a follow-up.
   */
  deviceName?: string;
  /** Round-trip deadline (ms). Defaults to 15_000. */
  timeoutMs?: number;
  /** Optional structural logger; defaults to no-op. Never receives slip content. */
  logger?: OsPrintTransportLogger;
}

/** The callback shape `createOsPrintAdapter`'s injected `OsPrintFn` expects. */
type OsPrintCallback = (success: boolean, failureReason?: string) => void;
type OsPrintFnLike = (html: string, callback: OsPrintCallback) => void;

const NOOP_LOGGER: OsPrintTransportLogger = { info: () => {}, warn: () => {} };

/**
 * Pick the device name to print to:
 *   1. an explicitly configured exact system name wins (even if not currently
 *      discovered — let the OS decide / fail loudly rather than silently retarget);
 *   2. else the discovered system-default printer's name;
 *   3. else `''` — Electron then picks the system default when `silent` + empty.
 */
export function resolvePrinterDeviceName(
  printers: readonly PrinterInfoLike[],
  configured: string | undefined,
): string {
  if (configured !== undefined && configured !== '') return configured;
  const fallback = printers.find((p) => p.isDefault);
  return fallback?.name ?? '';
}

/**
 * Wrap the template engine's BARE receipt fragment (`<div class="receipt"
 * dir="rtl">…</div>`, no shell, no CSS) in a complete print document.
 *
 * The on-screen `<ReceiptPreview>` styles the same fragment via the renderer's
 * stylesheet; the OS-print path has no renderer, so it must carry equivalent
 * CSS itself — otherwise the printed slip renders in the OS default
 * proportional font with no width constraint and DIVERGES from the recorded
 * browser/HTML render-quality smoke (Arabic legible, fits 80 mm). The CSS
 * mirrors `ReceiptPreview`'s slip style (80 mm width, `ui-monospace`,
 * 0.7rem/1.35) and adds `white-space: pre` so the rule lines + column layout
 * keep their alignment.
 *
 * The fragment is trusted template-engine output (it already HTML-escaped its
 * own text in `toHtml`), so it is embedded verbatim — not re-escaped.
 *
 * Tuning (T301 bench, BIXOLON SRP-330 II): the physical page stays 80 mm
 * (`pageSize` in `buildPrintOptions`), but the printable BODY is narrowed to
 * {@link RECEIPT_BODY_WIDTH} and centred, so content sits inside the printhead's
 * reliable marking zone (the outer ~3-4 mm of a thermal head often will not mark
 * cleanly → edge clipping). Darkness on the OS-print path cannot use ESC/POS
 * density commands, so we lean on glyph coverage: explicit pure-black text plus
 * a heavier base weight ({@link RECEIPT_BASE_FONT_WEIGHT}).
 */

/** Printable body width — narrower than the 80 mm roll for a horizontal safety margin. */
export const RECEIPT_BODY_WIDTH = '73mm';
/** Base font weight — heavier than normal so thermal output reads darker. */
export const RECEIPT_BASE_FONT_WEIGHT = 600;

export function wrapReceiptDocument(fragmentHtml: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    inline-size: 80mm;
    width: 80mm;
    box-sizing: border-box;
    font-family: ui-monospace, 'Cascadia Code', 'JetBrains Mono', monospace;
    font-size: 0.7rem;
    line-height: 1.35;
    direction: rtl;
    /* Pure black + heavier weight → darker thermal output (no ESC/POS density
       on the OS-print path). */
    color: #000;
    font-weight: ${String(RECEIPT_BASE_FONT_WEIGHT)};
  }
  .receipt {
    /* Narrower than the 80 mm roll, centred — keeps content inside the
       printhead's reliable marking zone (T301 edge-clipping tuning). */
    inline-size: ${RECEIPT_BODY_WIDTH};
    max-inline-size: ${RECEIPT_BODY_WIDTH};
    margin-inline: auto;
  }
  .band, .rule { white-space: pre; }
  .receipt-emph { font-weight: 800; }
</style>
</head>
<body>${fragmentHtml}</body>
</html>`;
}

/**
 * Construct the `webContents.print` options: silent (no settings dialog),
 * background graphics on, 80 mm continuous page width. An empty device name is
 * omitted so Electron falls back to the system default.
 */
export function buildPrintOptions(deviceName: string): WebContentsPrintOptions {
  const options: WebContentsPrintOptions = {
    silent: true,
    printBackground: true,
    pageSize: { width: RECEIPT_WIDTH_MICRONS, height: RECEIPT_MAX_HEIGHT_MICRONS },
    margins: { marginType: 'none' },
  };
  if (deviceName !== '') options.deviceName = deviceName;
  return options;
}

/**
 * Build the production `OsPrintFn`. The returned function is what
 * `createOsPrintAdapter({ print })` wraps as a promise; it MUST invoke its
 * callback exactly once with `(success, failureReason?)` and must not throw.
 */
export function createOsPrintTransport(config: OsPrintTransportConfig): OsPrintFnLike {
  const logger = config.logger ?? NOOP_LOGGER;
  const timeoutMs = config.timeoutMs ?? DEFAULT_PRINT_TIMEOUT_MS;

  return function osPrint(html: string, callback: OsPrintCallback): void {
    let win: PrintWindow | undefined;
    let settled = false;

    const settle = (success: boolean, failureReason?: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      // Tear the window down on EVERY exit path — success, failure, throw,
      // timeout — so an offscreen window never leaks.
      try {
        win?.destroy();
      } catch {
        // A destroy failure must not mask the print outcome.
      }
      // Structural logging only — never the slip HTML (FR-071 / AD-9).
      if (success) {
        logger.info({ msg: 'os_print:success' });
      } else {
        logger.warn({ msg: 'os_print:failure', failure_reason: failureReason ?? 'os_print_error' });
      }
      callback(success, failureReason);
    };

    const timeoutHandle = setTimeout(() => {
      settle(false, 'os_print_timeout');
    }, timeoutMs);

    void (async (): Promise<void> => {
      try {
        const printers = await config.listPrinters().catch(() => [] as PrinterInfoLike[]);
        const deviceName = resolvePrinterDeviceName(printers, config.deviceName);
        win = config.createPrintWindow();
        // Wrap the bare template fragment in a full styled print document so
        // the OS-path slip matches the recorded render-quality smoke.
        await win.loadHtml(wrapReceiptDocument(html));
        win.print(buildPrintOptions(deviceName), (success, failureReason) => {
          settle(success, success ? undefined : failureReason);
        });
      } catch {
        // Window creation / load failure — record loudly, keep the Sale durable
        // (the dispatcher writes a failure print_events row + raises the banner).
        settle(false, 'os_print_error');
      }
    })();
  };
}

/**
 * Default Electron-bound `PrintWindow` factory (the un-unit-tested glue leaf,
 * verified by the T301 human bench smoke). Constructs a secure offscreen
 * `BrowserWindow`, loads the receipt HTML via a `data:` URL (in-memory, no
 * remote content), and exposes `webContents.print`.
 */
/* c8 ignore start — Electron-bound glue: constructs a real BrowserWindow and
   calls webContents.print. No Electron runtime in vitest; verified by the T301
   human bench smoke (same posture as finalize-listener's start/stop driver). */
export function createDefaultPrintWindow(): PrintWindow {
  const win = new BrowserWindow({
    show: false,
    // Printing from a HIDDEN window is the #1 real-world failure mode for this
    // pattern: Chromium can throttle/never-paint a backgrounded window, so the
    // print "succeeds" but the slip is BLANK. Disable background throttling and
    // force an initial paint while hidden so the content is rendered before
    // `webContents.print` captures it. (Headline item for the T301 bench smoke:
    // if the slip prints blank, this is the place to look.)
    paintWhenInitiallyHidden: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  return {
    loadHtml(html: string): Promise<void> {
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      return win.loadURL(dataUrl);
    },
    print(options, callback): void {
      win.webContents.print(options, callback);
    },
    destroy(): void {
      if (!win.isDestroyed()) win.destroy();
    },
  };
}
/* c8 ignore stop */
