/**
 * T270 — ESC/POS adapter (008 Slice 3).
 *
 * Wraps the chosen ESC/POS library (`node-thermal-printer`) behind a
 * write-and-status-poll port. The adapter does NOT render — it transports the
 * pre-composed byte stream produced by the Slice 2 template engine (AD-6
 * single-source invariant) and reports a typed outcome.
 *
 * The transport (write + pollStatus) is injected so the adapter is unit-
 * testable without a real printer (T220/T221) — same DI posture as the
 * `DatabaseHandle` → sql.js test adapter. The real `node-thermal-printer`
 * transport is constructed only at the main entry point.
 */

import type { PrintAdapter, PrintAdapterResult, RenderedReceipt } from './print-pipeline.js';
import type { PrintEventFailureReason } from '../sales/repositories/print-events.repository.js';

/**
 * Printer status as reported by the status-byte poll. A closed set mapped to
 * the canonical `PrintEventFailureReason` enum.
 */
export type EscposStatus = 'ok' | 'paper_out' | 'jam' | 'offline' | 'unknown';

/**
 * The injected hardware transport. `write` pushes the byte stream; `pollStatus`
 * reads the printer status byte and classifies it. The real implementation
 * wraps `node-thermal-printer`; tests inject a fake returning scripted statuses.
 */
export interface EscposTransport {
  write(bytes: Uint8Array): Promise<void>;
  pollStatus(): Promise<EscposStatus>;
}

export interface EscposAdapterConfig {
  transport: EscposTransport;
  /** Status-poll deadline (Constitution §IV). On overrun → escpos_status_unknown. */
  statusTimeoutMs: number;
}

const STATUS_FAILURE: Record<Exclude<EscposStatus, 'ok'>, PrintEventFailureReason> = {
  paper_out: 'printer_out_of_paper',
  jam: 'printer_jam',
  offline: 'printer_offline',
  unknown: 'escpos_status_unknown',
};

export function createEscposAdapter(config: EscposAdapterConfig): PrintAdapter {
  const { transport, statusTimeoutMs } = config;

  return {
    render_path: 'escpos_direct',

    async print(rendered: RenderedReceipt): Promise<PrintAdapterResult> {
      try {
        await transport.write(rendered.escpos);
      } catch {
        return { ok: false, render_path: 'escpos_direct', failure_reason: 'escpos_write_failure' };
      }

      // Race the status poll against the configured timeout. A poll that never
      // settles must lose to the deadline (T221) → escpos_status_unknown. A poll
      // that *rejects* (real printer/USB fault) must ALSO degrade to a typed
      // failure, never propagate — the Sale-durable / banner-loud invariant
      // (T241 / US1 scenario 8) depends on print() always resolving.
      // The Promise executor runs synchronously, so `resolveTimeout` is always
      // assigned before the await below — no `| undefined` guard needed.
      // The default is never invoked — the Promise executor runs synchronously,
      // so `resolveTimeout` is reassigned before any await. It exists only to
      // satisfy TS definite-assignment (the assignment is inside a closure).
      /* c8 ignore next */
      let resolveTimeout: (status: EscposStatus) => void = () => {};
      const timeout = new Promise<EscposStatus>((resolve) => {
        resolveTimeout = resolve;
      });
      const timeoutHandle = setTimeout(() => {
        resolveTimeout('unknown');
      }, statusTimeoutMs);
      let status: EscposStatus;
      try {
        status = await Promise.race([transport.pollStatus(), timeout]);
      } catch {
        return { ok: false, render_path: 'escpos_direct', failure_reason: 'escpos_status_unknown' };
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (status === 'ok') {
        return { ok: true, render_path: 'escpos_direct' };
      }
      return { ok: false, render_path: 'escpos_direct', failure_reason: STATUS_FAILURE[status] };
    },
  };
}
