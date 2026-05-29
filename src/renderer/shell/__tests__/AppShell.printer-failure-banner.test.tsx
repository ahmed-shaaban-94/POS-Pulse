/**
 * T291 — AppShell mounts <PrinterFailureBanner> fed by useBannerState.
 *
 * The banner is a sibling under the connection StatusBanner (per §A1 brief (f)
 * stack order; AppShell is the real host — `BannerHost.tsx` never existed).
 * Its `printFailure` is sourced from the snapshot-poll hook (useBannerState →
 * sales.subscribe(banner_state)). When the terminal has no print failure the
 * banner is unmounted (renders nothing).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from '../AppShell';
import type { SalesBridgeAPI } from '../../../shared/bridge-api';
import type { BannerState } from '../../../shared/sales/types';

afterEach(() => {
  cleanup();
  delete (window as unknown as { api?: unknown }).api;
});

function salesBridge(banner: BannerState): SalesBridgeAPI {
  return {
    read: vi.fn(),
    findByNumber: vi.fn(),
    subscribe: vi.fn(() =>
      Promise.resolve({ kind: 'ok' as const, subscription_token: 't', banner_state: banner }),
    ),
    unsubscribe: vi.fn(() => Promise.resolve({ kind: 'ok' as const })),
  };
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <Routes>
        <Route path="/app/*" element={<AppShell />}>
          <Route path="dashboard" element={<div data-testid="dashboard-outlet">Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('T291 — AppShell printer-failure banner integration', () => {
  it('mounts the banner when the terminal has an unresolved print failure', async () => {
    (window as unknown as { api: { sales: SalesBridgeAPI } }).api = {
      sales: salesBridge({
        kind: 'printer_failure',
        sale_id: 'sale-1',
        failure_reason: 'printer_offline',
        has_successful_print: false,
      }),
    };
    renderShell();
    await waitFor(() => expect(screen.getByText(/Receipt print failed/i)).toBeInTheDocument());
  });

  it('does NOT render the banner when there is no print failure (kind:none)', async () => {
    (window as unknown as { api: { sales: SalesBridgeAPI } }).api = {
      sales: salesBridge({ kind: 'none' }),
    };
    renderShell();
    // The dashboard renders; the banner does not.
    await screen.findByTestId('dashboard-outlet');
    expect(screen.queryByText(/Receipt print failed/i)).toBeNull();
  });

  it('does not crash when no sales bridge is available (banner stays unmounted)', () => {
    renderShell();
    expect(screen.getByTestId('dashboard-outlet')).toBeInTheDocument();
    expect(screen.queryByText(/Receipt print failed/i)).toBeNull();
  });

  it('the Reprint + Manual entry-point callbacks are wired (clicking does not crash)', async () => {
    // has_successful_print:true enables Reprint. Both entry-points are Slice
    // 5/6 stubs; this proves they are wired (enabled⟹wired) and inert-safe.
    (window as unknown as { api: { sales: SalesBridgeAPI } }).api = {
      sales: salesBridge({
        kind: 'printer_failure',
        sale_id: 'sale-1',
        failure_reason: 'printer_offline',
        has_successful_print: true,
      }),
    };
    renderShell();
    await waitFor(() => expect(screen.getByText(/Receipt print failed/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /reprint/i }));
    await userEvent.click(screen.getByRole('button', { name: /manual/i }));
    // No throw; banner still present (entry-points are inert stubs).
    expect(screen.getByText(/Receipt print failed/i)).toBeInTheDocument();
  });
});
