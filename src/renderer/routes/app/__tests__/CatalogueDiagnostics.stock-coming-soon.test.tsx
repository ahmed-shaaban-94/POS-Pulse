/**
 * POS v3.5 Phase 4 — CatalogueDiagnostics stock/expiry coming-soon section.
 *
 * The diagnostics surface is the FUNCTIONAL inventory surface (real
 * catalogue.counts() / freshness / search). The v3.5 inventory design also
 * shows stock, expiry, and availability — none of which have a renderer-facing
 * source yet (deferred to POS-013). Phase 4 surfaces them as an honest
 * "coming soon" section, never fabricated numbers.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { CatalogueDiagnostics, type DiagnosticsBridge } from '../CatalogueDiagnostics';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function bridge(): DiagnosticsBridge {
  return {
    getStatus: vi.fn().mockResolvedValue({ kind: 'unpaired' }),
    counts: vi.fn().mockResolvedValue({ kind: 'ok', products: 50, barcodes: 49 }),
    freshness: vi.fn().mockResolvedValue({ kind: 'ok', last_success_at: null, is_empty: true }),
    refresh: vi.fn().mockResolvedValue({ kind: 'started' }),
    search: vi.fn().mockResolvedValue({ kind: 'not_found' }),
  };
}

describe('CatalogueDiagnostics — stock/expiry coming-soon (Phase 4)', () => {
  it('renders a coming-soon stock & expiry section', async () => {
    render(<CatalogueDiagnostics bridge={bridge()} />);
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-stock-coming-soon')).toBeInTheDocument(),
    );
    const section = screen.getByTestId('diagnostics-stock-coming-soon');
    expect(section).toHaveTextContent(/stock/i);
    expect(section).toHaveTextContent(/coming soon/i);
  });

  it('the coming-soon section carries no fabricated stock figure', async () => {
    render(<CatalogueDiagnostics bridge={bridge()} />);
    await waitFor(() =>
      expect(screen.getByTestId('diagnostics-stock-coming-soon')).toBeInTheDocument(),
    );
    // No digits in the placeholder — stock/expiry numbers do not exist yet.
    expect(screen.getByTestId('diagnostics-stock-coming-soon')).not.toHaveTextContent(/\d/);
  });
});
