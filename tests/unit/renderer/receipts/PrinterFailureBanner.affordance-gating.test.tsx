/* eslint-disable @typescript-eslint/unbound-method --
 * vi.fn-typed bridge spies trigger this rule on expect(...) assertions.
 */
/**
 * T262 — `<PrinterFailureBanner>` affordance gating (RED).
 *
 * Reprint is DISABLED until a successful print exists (AD-10 precondition:
 * contract line 310 — reprint requires ≥1 prior outcome='success' PrintEvent).
 * In the failure state none exists → Reprint disabled. Retry is ALWAYS enabled
 * while in the failure state. Manual override is always enabled while failed.
 *
 * (The §A1 brief (f) prose loosely calls the failure-banner Reprint a "fresh
 * first-print attempt"; the data-model is decisive — see coordination.md S3c
 * preflight #3. T262 encodes the AD-10-consistent behavior.)
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { PrinterFailureBanner } from '../../../../src/renderer/ui/receipts/PrinterFailureBanner.js';
import type { ReceiptsBridgeAPI } from '../../../../src/shared/bridge-api.js';

function retryBridge(): ReceiptsBridgeAPI {
  return {
    preview: vi.fn(),
    retryPrint: vi.fn(() =>
      Promise.resolve({
        kind: 'ok' as const,
        outcome: 'success' as const,
        print_event_id: 'pe-1',
        purpose: 'retry_after_failure' as const,
        render_path: 'escpos_direct' as const,
        printed_at: '2026-05-27T10:00:09.000Z',
      }),
    ),
  };
}

afterEach(() => {
  cleanup();
});

describe('T262 — affordance gating', () => {
  it('disables Reprint in the failure state (no prior successful print — AD-10)', () => {
    render(
      <PrinterFailureBanner
        printFailure={{
          sale_id: 'sale-1',
          failure_reason: 'printer_offline',
          has_successful_print: false,
        }}
        onManualOverride={() => {}}
        _testReceiptsBridge={retryBridge()}
      />,
    );
    expect(screen.getByRole('button', { name: /reprint/i })).toBeDisabled();
  });

  it('enables Reprint once a successful print exists for the sale', () => {
    render(
      <PrinterFailureBanner
        printFailure={{
          sale_id: 'sale-1',
          failure_reason: 'printer_offline',
          has_successful_print: true,
        }}
        onManualOverride={() => {}}
        _testReceiptsBridge={retryBridge()}
      />,
    );
    expect(screen.getByRole('button', { name: /reprint/i })).toBeEnabled();
  });

  it('Retry is enabled in the failure state and calls receipts.retryPrint on click', async () => {
    const bridge = retryBridge();
    render(
      <PrinterFailureBanner
        printFailure={{
          sale_id: 'sale-1',
          failure_reason: 'printer_offline',
          has_successful_print: false,
        }}
        onManualOverride={() => {}}
        _testReceiptsBridge={bridge}
      />,
    );
    const retry = screen.getByRole('button', { name: /retry/i });
    expect(retry).toBeEnabled();
    await userEvent.click(retry);
    expect(bridge.retryPrint).toHaveBeenCalledWith(expect.objectContaining({ sale_id: 'sale-1' }));
  });

  it('Manual receipt is always enabled while failed and calls onManualOverride', async () => {
    const onManualOverride = vi.fn();
    render(
      <PrinterFailureBanner
        printFailure={{
          sale_id: 'sale-1',
          failure_reason: 'printer_offline',
          has_successful_print: false,
        }}
        onManualOverride={onManualOverride}
        _testReceiptsBridge={retryBridge()}
      />,
    );
    const manual = screen.getByRole('button', { name: /manual/i });
    expect(manual).toBeEnabled();
    await userEvent.click(manual);
    expect(onManualOverride).toHaveBeenCalledWith('sale-1');
  });

  it('passes a fresh idempotency_key on each Retry (FR-053)', async () => {
    const bridge = retryBridge();
    render(
      <PrinterFailureBanner
        printFailure={{
          sale_id: 'sale-1',
          failure_reason: 'printer_offline',
          has_successful_print: false,
        }}
        onManualOverride={() => {}}
        _testReceiptsBridge={bridge}
        _idempotencyKeyFactory={() => 'fixed-key-1'}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    const call = (bridge.retryPrint as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      idempotency_key: string;
    };
    expect(call.idempotency_key).toBe('fixed-key-1');
  });

  it('recovers (no crash, button re-enabled) when retryPrint rejects', async () => {
    const rejecting: ReceiptsBridgeAPI = {
      preview: vi.fn(),
      retryPrint: vi.fn(() => Promise.reject(new Error('ipc boom'))),
    };
    render(
      <PrinterFailureBanner
        printFailure={{
          sale_id: 'sale-1',
          failure_reason: 'printer_offline',
          has_successful_print: false,
        }}
        onManualOverride={() => {}}
        _testReceiptsBridge={rejecting}
      />,
    );
    const retry = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retry);
    // The catch arm clears the in-flight phase → button is interactive again.
    await waitFor(() => expect(retry).toBeEnabled());
  });

  it('Retry is a no-op when no receipts bridge is available (null resolve, no crash)', async () => {
    // No _testReceiptsBridge and no window.api.receipts → resolveReceiptsBridge null.
    render(
      <PrinterFailureBanner
        printFailure={{
          sale_id: 'sale-1',
          failure_reason: 'printer_offline',
          has_successful_print: false,
        }}
        onManualOverride={() => {}}
      />,
    );
    const retry = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retry);
    // No throw; the banner stays up.
    expect(screen.getByText(/Receipt print failed/i)).toBeInTheDocument();
  });
});
